"""A mesma preparação é usada no treino e na API."""
from pathlib import Path
import re

import numpy as np
import pandas as pd
import yfinance as yf

ROOT = Path(__file__).resolve().parent.parent
DATA = ROOT / "data"
MODELS = ROOT / "models"
FEATURES = ["Close_SMA20_ratio", "Close_SMA50_ratio", "SMA20_SMA50_ratio", "Daily_Return"]


class MarketDataError(ValueError):
    pass


def validate_ticker(ticker):
    ticker = ticker.strip().upper()
    if not re.fullmatch(r"[A-Z][A-Z0-9.^=-]{0,14}", ticker):
        raise ValueError("Use a valid ticker, for example AAPL, MSFT or BRK-B.")
    return ticker


def search_stocks(query):
    query = query.strip()
    if not 1 <= len(query) <= 80 or not query.isprintable():
        raise ValueError("Search with a ticker or company name between 1 and 80 characters.")
    try:
        result = yf.Search(query, max_results=8, news_count=0, lists_count=0,
                           recommended=0, include_cb=False, timeout=10)
        if not isinstance(result.response, dict) or not isinstance(result.response.get("quotes"), list):
            raise ValueError("Invalid Yahoo Finance search response.")
    except Exception as exc:
        raise MarketDataError("Yahoo Finance search is unavailable. Please try again later.") from exc
    stocks = []
    for quote in result.quotes:
        if (not isinstance(quote, dict) or quote.get("quoteType") != "EQUITY"
                or quote.get("exchange") not in {"NMS", "NGM", "NCM", "NYQ", "ASE", "PCX"}):
            continue
        try:
            ticker = validate_ticker(quote.get("symbol", ""))
        except (ValueError, AttributeError):
            continue
        stocks.append({"ticker": ticker, "name": quote.get("shortname") or quote.get("longname") or ticker,
                       "exchange": quote.get("exchDisp") or quote.get("exchange")})
    return stocks[:8]


def prepare_data(frame):
    frame = frame.copy()
    if isinstance(frame.columns, pd.MultiIndex):
        frame.columns = frame.columns.get_level_values(0)
    if "Close" not in frame or frame.empty:
        raise MarketDataError("No daily prices available for this ticker.")
    frame.index = pd.to_datetime(frame.index, utc=True).tz_convert(None).normalize()
    frame = frame.sort_index().loc[lambda x: ~x.index.duplicated(keep="last")]
    frame["Close"] = pd.to_numeric(frame["Close"], errors="coerce")
    frame = frame.loc[np.isfinite(frame["Close"]) & (frame["Close"] > 0)]
    frame["SMA20"] = frame["Close"].rolling(20).mean()
    frame["SMA50"] = frame["Close"].rolling(50).mean()
    frame["Close_SMA20_ratio"] = frame["Close"] / frame["SMA20"] - 1
    frame["Close_SMA50_ratio"] = frame["Close"] / frame["SMA50"] - 1
    frame["SMA20_SMA50_ratio"] = frame["SMA20"] / frame["SMA50"] - 1
    frame["Daily_Return"] = frame["Close"].pct_change(fill_method=None) * 100
    return frame


def download_data(ticker, period="5y"):
    try:
        frame = yf.download(ticker, period=period, auto_adjust=True,
                            progress=False, threads=False, timeout=15)
    except Exception as exc:
        raise MarketDataError("Yahoo Finance is unavailable. Please try again later.") from exc
    frame = prepare_data(frame)
    # A vela diária de hoje pode ainda estar a formar-se; usar só sessões anteriores.
    frame = frame.loc[frame.index < pd.Timestamp.now(tz="UTC").tz_localize(None).normalize()]
    if frame.empty:
        raise MarketDataError("No completed daily sessions available for this ticker.")
    return frame


def load_training_data():
    return prepare_data(pd.read_csv(DATA / "appl_processado.csv", index_col="Date", parse_dates=True))


def labelled_data(frame):
    frame = prepare_data(frame)
    # A última sessão não tem o fecho de amanhã; não é um exemplo negativo.
    frame["Target"] = (frame["Close"].shift(-1) > frame["Close"]).astype(int)
    return frame.iloc[:-1].dropna(subset=FEATURES)


def chronological_split(frame):
    split = int(len(frame) * 0.8)
    if split < 100 or len(frame) - split < 20:
        raise ValueError("At least 150 labelled trading sessions are required.")
    # O alvo de ontem usa o fecho de hoje: deixar uma sessão de separação.
    return frame.iloc[:split - 1], frame.iloc[split:]


def history_records(frame):
    return [{"date": str(day.date()), "close": float(row.Close),
             "sma20": None if pd.isna(row.SMA20) else float(row.SMA20),
             "sma50": None if pd.isna(row.SMA50) else float(row.SMA50)}
            for day, row in frame.iterrows()]


def history_frame(records):
    return prepare_data(pd.DataFrame(records).set_index("date").rename(columns={"close": "Close"}))
