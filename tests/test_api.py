"""Integration checks use real PostgreSQL; only Yahoo is replaced with the saved CSV."""
import os
import unittest
from unittest.mock import patch

from app import create_app
from market import MarketDataError, load_training_data


@unittest.skipUnless(os.getenv("TEST_DATABASE_URL"), "Set TEST_DATABASE_URL to run PostgreSQL integration checks")
class APITests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.app = create_app({"TESTING": True, "SECRET_KEY": "test-only",
                              "DATABASE_URL": os.environ["TEST_DATABASE_URL"]})
        cls.frame = load_training_data()

    def setUp(self):
        self.client = self.app.test_client()
        self.other = self.app.test_client()

    def test_demo_predictions_saved_once_and_isolated(self):
        for name in ["random_forest", "logistic_regression", "lstm"]:
            url = f"/api/predict/AAPL?source=demo&model={name}"
            response = self.client.get(url)
            self.assertEqual(response.status_code, 200, response.json)
            data = response.json
            self.assertTrue(0 <= data["probability_up"] <= 1)
            self.assertTrue(data["historical_replay"])
            self.assertEqual(data["source"], "demo")
            self.assertIn("sma50", data["history"][-1])
            self.assertEqual(self.client.get(url).status_code, 200)
        self.assertEqual(len(self.client.get("/api/predictions").json["predictions"]), 3)
        self.assertEqual(self.other.get("/api/predictions").json["predictions"], [])

    def test_favorites_persist_and_are_private(self):
        response = self.client.put("/api/favorites/MSFT")
        self.assertEqual(response.json["favorites"], ["MSFT"])
        self.assertEqual(self.client.get("/api/favorites").json["favorites"], ["MSFT"])
        self.assertEqual(self.other.get("/api/favorites").json["favorites"], [])
        self.assertEqual(self.client.delete("/api/favorites/MSFT").json["favorites"], [])
        self.assertEqual(self.client.put("/api/favorites/MSFT", headers={"Sec-Fetch-Site": "cross-site"}).status_code, 403)

    def test_invalid_inputs(self):
        for path in ["/api/predict/AAPL?period=bad", "/api/predict/AAPL?model=bad", "/api/predict/AAPL?source=bad", "/api/predict/MSFT?source=demo", "/api/predict/%3Cscript%3E"]:
            self.assertEqual(self.client.get(path).status_code, 400, path)
        self.assertEqual(self.client.get("/api/missing").status_code, 404)

    def test_live_cache_and_stale_fallback(self):
        storage = self.app.extensions["storage"]
        with storage.connect() as conn:
            conn.execute("DELETE FROM price_cache WHERE ticker='TST'")
        with patch("app.download_data", return_value=self.frame) as download:
            first = self.client.get("/api/predict/TST")
            self.assertEqual(first.status_code, 200, first.json)
            self.assertEqual(first.json["source"], "yahoo_finance")
            self.assertTrue(first.json["experimental_ticker"])
            self.assertEqual(self.client.get("/api/history/TST").json["source"], "cache")
            self.assertEqual(download.call_count, 1)
        with storage.connect() as conn:
            conn.execute("UPDATE price_cache SET updated_at=now()-interval '2 hours' WHERE ticker='TST'")
        with patch("app.download_data", side_effect=MarketDataError("Yahoo unavailable")):
            stale = self.client.get("/api/predict/TST")
            self.assertEqual(stale.status_code, 200)
            self.assertEqual(stale.json["source"], "stale_cache")
            self.assertIsNotNone(stale.json["warning"])
        with storage.connect() as conn:
            conn.execute("DELETE FROM price_cache WHERE ticker='TST'")

    def test_missing_database_returns_actionable_error(self):
        app = create_app({"TESTING": True, "DATABASE_URL": None})
        response = app.test_client().get("/api/favorites")
        self.assertEqual(response.status_code, 503)
        self.assertIn("PostgreSQL", response.json["error"])

    def test_upstream_failure_without_cache(self):
        with patch("app.download_data", side_effect=MarketDataError("Yahoo unavailable")):
            response = self.client.get("/api/predict/UNKNOWNTEST")
            self.assertEqual(response.status_code, 502)


if __name__ == "__main__":
    unittest.main()
