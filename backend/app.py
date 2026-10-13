"""Flask API + dashboard React compilado. Executar com DATABASE_URL definida."""
import hashlib
import json
import os
import secrets
import uuid
from pathlib import Path

import joblib
import psycopg
from flask import Flask, jsonify, request, session, send_from_directory

from .database import Storage
from ml.market import ROOT, MODELS, FEATURES, MarketDataError, download_data, history_frame, history_records, load_training_data, search_stocks, validate_ticker

MODEL_FILES = {"random_forest": "modelo_trendcast.pkl", "logistic_regression": "modelo_logistic.pkl", "lstm": "modelo_lstm.pt"}


class ModelUnavailable(ValueError):
    pass


PERIODS = {"3mo": 63, "6mo": 126, "1y": 252, "2y": 504, "5y": 1260}


def create_app(config=None):
    app = Flask(__name__, static_folder=None)
    app.config.update(SECRET_KEY=os.getenv("SECRET_KEY") or secrets.token_hex(32),
        DATABASE_URL=os.getenv("DATABASE_URL"), SESSION_COOKIE_HTTPONLY=True,
        SESSION_COOKIE_SAMESITE="Lax", SESSION_COOKIE_SECURE=os.getenv("COOKIE_SECURE") == "true",
        MAX_CONTENT_LENGTH=4096)
    if config:
        app.config.update(config)
    storage = Storage(app.config["DATABASE_URL"])
    app.extensions["storage"] = storage
    models = {}
    if app.config["DATABASE_URL"]:
        storage.initialize()

    def owner():
        if "owner" not in session:
            session["owner"] = str(uuid.uuid4())
        return session["owner"]

    def metrics(ticker):
        path = MODELS / ticker / "metricas_modelo.json"
        try:
            info = json.loads(path.read_text())
        except (FileNotFoundError, json.JSONDecodeError) as exc:
            raise ModelUnavailable(f"No trained models for {ticker}. Run: python -m ml.fetch_data {ticker} --no-plot; python -m ml.train_model {ticker}; python -m ml.train_lstm {ticker}") from exc
        if not isinstance(info, dict) or info.get("training_ticker") != ticker:
            raise ModelUnavailable(f"Model metadata does not match {ticker}. Retrain its models.")
        return info

    def prices(ticker):
        source = request.args.get("source", "live")
        if source not in ("live", "demo"):
            raise ValueError("Source must be live or demo.")
        if source == "demo":
            if ticker != "AAPL":
                raise ValueError("The saved demo dataset only contains AAPL.")
            return load_training_data(), "demo", "Saved AAPL dataset; not current market data."
        cached = storage.cached_prices(ticker, fresh=True)
        if cached:
            return history_frame(cached["payload"]), "cache", None
        try:
            frame = download_data(ticker)
        except MarketDataError:
            cached = storage.cached_prices(ticker)
            if not cached:
                raise
            return history_frame(cached["payload"]), "stale_cache", "Yahoo Finance unavailable; showing previously saved prices."
        storage.save_prices(ticker, history_records(frame))
        return frame, "yahoo_finance", None

    def period():
        selected = request.args.get("period", "6mo")
        if selected not in PERIODS:
            raise ValueError("Period must be 3mo, 6mo, 1y, 2y or 5y.")
        return PERIODS[selected]

    @app.errorhandler(ModelUnavailable)
    def model_unavailable(exc):
        return jsonify(error=str(exc)), 503

    @app.errorhandler(ValueError)
    def invalid(exc):
        return jsonify(error=str(exc)), 400

    @app.errorhandler(MarketDataError)
    def no_data(exc):
        return jsonify(error=str(exc)), 502

    @app.errorhandler(psycopg.Error)
    def database_error(exc):
        app.logger.error("Database request failed: %s", type(exc).__name__)
        return jsonify(error="PostgreSQL is unavailable. Check DATABASE_URL and start the database."), 503

    @app.errorhandler(404)
    def not_found(exc):
        return jsonify(error="Route not found."), 404

    @app.get("/api/health")
    def health():
        with storage.connect() as conn:
            conn.execute("SELECT 1")
        return jsonify(status="ok", database="postgresql")

    @app.get("/api/models")
    def model_metrics():
        ticker = validate_ticker(request.args.get("ticker", "AAPL"))
        info = metrics(ticker)
        info["available_models"] = [name for name, file in MODEL_FILES.items()
                                    if (MODELS / ticker / file).exists() and name in info["models"]]
        if not info["available_models"]:
            raise ModelUnavailable(f"No usable models for {ticker}. Run python -m ml.train_model {ticker} and python -m ml.train_lstm {ticker}.")
        return jsonify(info)

    @app.get("/api/stocks")
    def stocks():
        return jsonify(stocks=search_stocks(request.args.get("query", "")), source="yahoo_finance")

    @app.get("/api/history/<ticker>")
    def history(ticker):
        ticker = validate_ticker(ticker)
        length = period()
        frame, source, warning = prices(ticker)
        return jsonify(ticker=ticker, source=source, warning=warning, history=history_records(frame.tail(length)))

    @app.get("/api/predict/<ticker>")
    def predict(ticker):
        ticker = validate_ticker(ticker)
        length = period()
        name = request.args.get("model", "random_forest")
        if name not in MODEL_FILES:
            raise ValueError("Choose random_forest, logistic_regression or lstm.")
        path = MODELS / ticker / MODEL_FILES[name]
        info = metrics(ticker)
        if not path.exists() or name not in info["models"]:
            raise ModelUnavailable(f"{name} is not trained for {ticker}. Run python -m ml.train_model {ticker} and python -m ml.train_lstm {ticker}.")
        frame, source, warning = prices(ticker)
        complete = frame.dropna(subset=FEATURES)
        if complete.empty:
            raise MarketDataError("At least 50 daily sessions are needed for the indicators.")
        if name == "lstm":
            try:
                from ml.lstm_model import predict_lstm
            except ImportError:
                return jsonify(error="Install requirements-lstm.txt to use the LSTM."), 503
            probability = predict_lstm(complete, path)
        else:
            key = (ticker, name)
            if key not in models:
                models[key] = joblib.load(path)
            model = models[key]
            probability = float(model.predict_proba(complete[FEATURES].tail(1))[0, list(model.classes_).index(1)])
        payload = {"ticker": ticker, "model": name, "version": hashlib.sha256(path.read_bytes()).hexdigest()[:12],
            "as_of": str(complete.index[-1].date()), "horizon": "next trading session",
            "direction": "up" if probability >= 0.5 else "down_or_flat", "probability_up": probability,
            "close": float(complete.Close.iloc[-1]), "daily_return": float(complete.Daily_Return.iloc[-1]),
            "source": source, "warning": warning, "training_ticker": ticker,
            "experimental_ticker": False, "evaluation": info["models"].get(name),
            "baseline_accuracy": info["models"]["baseline"]["accuracy"],
            "test_period": info["test"], "production_training_end": info["production_training_end"],
            "historical_replay": str(complete.index[-1].date()) <= info["production_data_end"],
            "probability_note": "Uncalibrated model score, not a guarantee or investment advice."}
        storage.save_prediction(owner(), payload)
        return jsonify(**payload, history=history_records(frame.tail(length)))

    @app.get("/api/predictions")
    def predictions():
        return jsonify(predictions=storage.predictions(owner()))

    @app.get("/api/favorites")
    def favorites():
        return jsonify(favorites=storage.favorites(owner()))

    @app.route("/api/favorites/<ticker>", methods=["PUT", "DELETE"])
    def favorite(ticker):
        # SameSite bloqueia pedidos cross-site de escrita com o cookie da sessão.
        if request.headers.get("Sec-Fetch-Site") == "cross-site":
            return jsonify(error="Cross-site writes are not allowed."), 403
        storage.favorite(owner(), validate_ticker(ticker), remove=request.method == "DELETE")
        return jsonify(favorites=storage.favorites(owner()))

    @app.cli.command("init-db")
    def init_db():
        storage.initialize()
        print("PostgreSQL schema ready.")

    @app.get("/")
    def index():
        if not (ROOT / "frontend/dist/index.html").exists():
            return jsonify(error="Build frontend: cd frontend && npm install && npm run build"), 503
        return send_from_directory(ROOT / "frontend/dist", "index.html")

    @app.get("/assets/<path:filename>")
    def assets(filename):
        return send_from_directory(ROOT / "frontend/dist/assets", filename)

    return app


app = create_app()

if __name__ == "__main__":
    app.run(host="127.0.0.1", port=int(os.getenv("PORT", "5001")), debug=False)
