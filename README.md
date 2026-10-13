# TrendCast

A full-stack app that predicts whether a stock's next closing price will be higher than its current close. It shows the price history, the model's direction forecast and how that model performed against a simple baseline.

I started this project to learn how a Python data script becomes a working web app. It grew from downloading Apple prices into a Flask API, a React dashboard and a PostgreSQL database. The aim is to predict direction, not an exact price, and to be clear about what the results actually show.

## What it does

- Downloads adjusted daily prices from Yahoo Finance and calculates 20/50-session moving averages and daily returns.
- Compares Logistic Regression, Random Forest and a small PyTorch LSTM on the same chronological holdout.
- Shows prices, moving averages, next-session direction, model scores and evaluation results.
- Saves price history, forecasts and a watchlist in PostgreSQL. Watchlists and forecasts belong to an anonymous browser session.
- Includes an explicit saved-data demo for AAPL when you want to try the app without Yahoo Finance.

## Run locally

You need Python 3.14, Node 24 and PostgreSQL 17 (or Docker Desktop).

```bash
python3 -m venv .venv
source .venv/bin/activate
python -m pip install -r requirements-lstm.txt
cp .env.example .env
python -c "import secrets; print(secrets.token_hex(32))"
```

Paste the generated value into `SECRET_KEY` in `.env`. Keep this file private. Then start PostgreSQL:

```bash
docker compose up -d db
```

The default development database listens on `127.0.0.1:5433`. If you already have PostgreSQL running, create a database and update `DATABASE_URL` instead.

```bash
python -m ml.train_model
python -m ml.train_lstm
cd frontend
npm ci
npm run build
cd ..
set -a
source .env
set +a
python -m backend.app
```

Open **http://127.0.0.1:5001**. Select **Saved AAPL demo** to explore the included dataset, or **Yahoo Finance** for live downloads. Today's candle is excluded because it may still be incomplete; the forecast uses the latest earlier session. Downloads are cached for an hour; if Yahoo is unavailable, an existing cache is shown with a warning.

For React development, keep Flask running and run `npm run dev` inside `frontend`. Vite forwards `/api` requests to Flask.

You can also run both services with Docker after configuring `.env`:

```bash
docker compose up --build
```

### Train or refresh a stock

```bash
python -m ml.fetch_data MSFT --no-plot
python -m ml.train_model MSFT
python -m ml.train_lstm MSFT
```

`ml.fetch_data` without `--no-plot` also opens a matplotlib chart. The ticker argument defaults to AAPL; replace MSFT with another valid ticker to train that stock. Data is saved as `data/MSFT.csv`, while its three models and metrics are saved in `models/MSFT/`. Training the LSTM requires the same dataset used for its scikit-learn comparison; if the CSV changes, run `ml.train_model` again first.

The included snapshots and models cover AAPL, MSFT, GOOGL and NVDA. Training happens through these commands, never inside a prediction request. An untrained ticker returns HTTP 503 with the commands to train it; it never falls back to another stock's model. Restart Flask after retraining so it loads the new models. Updating the dataset changes the evaluation period, so don't compare those results directly with the old ones.

## How the evaluation works

The target is `1` when tomorrow's close is higher than today's; otherwise it is `0` (down or unchanged). The final row is removed because tomorrow's close is unknown. Features only use information available at the end of the current session.

The first 80% of labelled sessions form the training region; the last 20% form the test region. One session is excluded at the boundary because a training target uses the following session's close. Random Forest parameters are chosen using time-series cross-validation with the same gap, entirely within training. Scaling for Logistic Regression and LSTM is fitted on training data only.

The baseline always predicts the most common class **in training**, not the most common class in the test set. The LSTM uses 20-session windows, 16 hidden units and 30 epochs, with a fixed seed and no test-set tuning. Test windows may contain preceding historical prices, but not future prices or test labels.

After evaluation, the production models are refitted on all labelled data. Their holdout metrics still describe the separate evaluation models. Forecasts made on dates already included in production training are labelled as historical replay.

### AAPL results on the included dataset

Test period: **23 September 2025 – 8 September 2026**, 241 sessions.

| Model | Accuracy |
| --- | ---: |
| Training-majority baseline | 53.1% |
| Logistic Regression | 53.1% |
| Random Forest | 52.3% |
| LSTM | 48.1% |

None of these models beats the baseline on this holdout. The LSTM adds a useful comparison, but it does not improve this result. The full confusion matrices, precision, recall and F1 scores are in `models/AAPL/metricas_modelo.json` and in the dashboard.

## API

| Method | Route | Purpose |
| --- | --- | --- |
| GET | `/api/health` | Check Flask and PostgreSQL |
| GET | `/api/models?ticker=MSFT` | That stock's metrics and available models (defaults to AAPL) |
| GET | `/api/stocks?query=Microsoft` | Find US stock symbols by ticker or company name |
| GET | `/api/predict/AAPL` | Forecast plus chart history; save the forecast |
| GET | `/api/history/AAPL` | Adjusted prices and moving averages |
| GET | `/api/predictions` | This browser session's last 30 forecasts |
| GET | `/api/favorites` | This browser session's watchlist |
| PUT / DELETE | `/api/favorites/AAPL` | Add / remove a ticker |

Predictions automatically use the available model with the highest chronological holdout accuracy for that ticker. Equal scores use a stable order (Random Forest, Logistic Regression, LSTM). This is a historical comparison, not a guarantee of future performance.

Prediction parameters: optional `model=random_forest|logistic_regression|lstm` for direct API comparisons, `period=3mo|6mo|1y|2y|5y`, `source=live|demo`.

```bash
curl 'http://127.0.0.1:5001/api/predict/AAPL?source=demo'
curl 'http://127.0.0.1:5001/api/stocks?query=Microsoft'
curl 'http://127.0.0.1:5001/api/history/MSFT?period=6mo'
```

Stock search uses the existing yfinance connection to Yahoo Finance and returns up to eight equity matches listed on Nasdaq or NYSE venues, with their ticker, name and exchange. ETFs, futures and overseas listings are excluded. Queries must contain 1–80 printable characters after trimming. No matches returns an empty list; an unavailable provider returns HTTP 502. Each search request uses a 10-second provider timeout. There is no extra API key to configure.

Demo data is available only for AAPL. Each ticker uses its own trained models, scaling, holdout metrics and baseline. The dashboard loads the selected stock's evaluation before forecasting. This project is intended for US stocks quoted in USD.

## Validation

Python and database checks run locally and are deliberately kept out of the public repository. They cover chronological boundaries, indicator leakage, the missing final target, LSTM windows, input validation, caching, database failures and session isolation.

The GitHub workflow only builds the frontend:

```bash
cd frontend
npm ci
npm run build
```

## Deployment (later)

The Dockerfile builds React, trains each ticker's models on its included CSV and runs Flask with Gunicorn. React and the API share one origin, so there is no separate CORS setup.

Hosting is deliberately pending while the project is reviewed. Vercel is the intended platform; its deployment configuration has not been added yet. The local implementation keeps the original React, Flask and PostgreSQL stack.

For any future hosted setup, supply `DATABASE_URL`, keep `SECRET_KEY` private and stable, and set `COOKIE_SECURE=true` on HTTPS. The LSTM needs more memory than the scikit-learn models; the container uses CPU PyTorch. Decide where inference and PostgreSQL will run before publishing the site.

## Project structure

```text
backend/            Flask API and PostgreSQL
  app.py              Routes and React serving
  database.py         Database queries
  schema.sql          Tables and indexes
ml/                 Data preparation and machine learning
  market.py           Shared indicators, labels and time split
  fetch_data.py       Download and visualize one ticker
  train_model.py      Evaluate and save scikit-learn models
  train_lstm.py       Evaluate and save the LSTM
  lstm_model.py       LSTM architecture and inference
data/               Separate training CSV per ticker
models/<ticker>/    That stock's models and evaluation metrics
frontend/           React + Vite + Recharts
tests/              Local checks (ignored by Git)
.github/workflows/  Frontend build
```

Run the Python commands from the project root using `python -m`, as shown above.

## Six-phase roadmap

| Phase | Deliverable | Status |
| --- | --- | --- |
| 1. Python data | Download, indicators, CSV and chart | Complete |
| 2. First ML models | Chronological evaluation and saved models | Complete |
| 3. Flask | JSON prediction API | Complete |
| 4. React | Interactive dashboard and charts | Complete |
| 5. PostgreSQL | Cached prices, forecasts and watchlist | Complete locally |
| 6. LSTM and deployment | Model comparison, container and public app | LSTM complete; hosting pending |

## Limits

This is a learning project, not investment advice. The model scores are uncalibrated probabilities. A historical accuracy figure says nothing on its own about trading profit: fees, slippage, risk and transaction timing are not modelled.

Each model is trained and evaluated on roughly five years of daily data for its own stock. Training on the correct stock does not guarantee that a model beats its baseline or generalizes to future market conditions. Yahoo Finance can be rate-limited, and adjusted historical prices can change after corporate actions. The included CSV is a fixed snapshot, not today's market.

Anonymous sessions are deliberately simple: there are no accounts, and clearing browser cookies loses access to that session's watchlist. Keep `SECRET_KEY` stable across restarts. Database records remain until you delete them yourself. Account login, backtesting and scheduled retraining are outside the current scope.
