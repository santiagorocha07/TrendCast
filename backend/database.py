"""PostgreSQL: cache de preços e dados privados da sessão anónima."""
from pathlib import Path

import psycopg
from psycopg.rows import dict_row
from psycopg.types.json import Jsonb


class Storage:
    def __init__(self, url):
        self.url = url

    def connect(self):
        if not self.url:
            raise psycopg.OperationalError("DATABASE_URL is required")
        return psycopg.connect(self.url, connect_timeout=5, row_factory=dict_row)

    def initialize(self):
        with self.connect() as conn:
            conn.execute(Path(__file__).with_name("schema.sql").read_text())

    def cached_prices(self, ticker, fresh=False):
        with self.connect() as conn:
            return conn.execute("SELECT payload, updated_at FROM price_cache WHERE ticker = %s "
                + ("AND updated_at > now() - interval '1 hour'" if fresh else ""), (ticker,)).fetchone()

    def save_prices(self, ticker, records):
        with self.connect() as conn:
            conn.execute("INSERT INTO price_cache(ticker, payload) VALUES (%s, %s) "
                "ON CONFLICT(ticker) DO UPDATE SET payload=excluded.payload, updated_at=now()",
                (ticker, Jsonb(records)))

    def save_prediction(self, owner, payload):
        with self.connect() as conn:
            conn.execute("INSERT INTO predictions(owner, ticker, as_of, model, version, source, payload) "
                "VALUES (%s,%s,%s,%s,%s,%s,%s) ON CONFLICT(owner,ticker,as_of,model,version,source) "
                "DO UPDATE SET payload=excluded.payload",
                (owner, payload["ticker"], payload["as_of"], payload["model"], payload["version"],
                 payload["source"], Jsonb(payload)))

    def predictions(self, owner):
        with self.connect() as conn:
            rows = conn.execute("SELECT payload, created_at FROM predictions WHERE owner=%s "
                "ORDER BY created_at DESC LIMIT 30", (owner,)).fetchall()
            return [{**row["payload"], "saved_at": row["created_at"].isoformat()} for row in rows]

    def favorites(self, owner):
        with self.connect() as conn:
            return [row["ticker"] for row in conn.execute(
                "SELECT ticker FROM favorites WHERE owner=%s ORDER BY ticker", (owner,)).fetchall()]

    def favorite(self, owner, ticker, remove=False):
        with self.connect() as conn:
            if remove:
                conn.execute("DELETE FROM favorites WHERE owner=%s AND ticker=%s", (owner, ticker))
            else:
                conn.execute("INSERT INTO favorites(owner,ticker) VALUES (%s,%s) ON CONFLICT DO NOTHING", (owner, ticker))
