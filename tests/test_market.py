import unittest
from unittest.mock import patch

import numpy as np
import pandas as pd

from market import FEATURES, MarketDataError, chronological_split, download_data, labelled_data, prepare_data, validate_ticker


class MarketTests(unittest.TestCase):
    def setUp(self):
        self.raw = pd.DataFrame({"Close": np.arange(1, 301, dtype=float)},
            index=pd.date_range("2020-01-01", periods=300, freq="B"))

    def test_labels_drop_unobservable_last_session(self):
        data = labelled_data(self.raw)
        self.assertEqual(data.index[-1], self.raw.index[-2])
        self.assertEqual(data.Target.unique().tolist(), [1])
        self.assertTrue(np.isfinite(data[FEATURES]).all().all())

    def test_features_do_not_depend_on_future_prices(self):
        changed = self.raw.copy()
        changed.iloc[200:, 0] *= 2
        pd.testing.assert_frame_equal(prepare_data(self.raw).iloc[:200], prepare_data(changed).iloc[:200])

    def test_chronological_gap_excludes_label_overlap(self):
        data = labelled_data(self.raw)
        train, test = chronological_split(data)
        self.assertEqual(data.index.get_loc(test.index[0]) - data.index.get_loc(train.index[-1]), 2)
        self.assertLess(train.index[-1], test.index[0])

    def test_multiindex_sorted_and_duplicate_dates(self):
        raw = pd.concat([self.raw.iloc[::-1], self.raw.iloc[:1]])
        raw.columns = pd.MultiIndex.from_tuples([("Close", "AAPL")])
        clean = prepare_data(raw)
        self.assertEqual(len(clean), 300)
        self.assertTrue(clean.index.is_monotonic_increasing)

    def test_empty_and_invalid_ticker(self):
        with self.assertRaises(MarketDataError):
            prepare_data(pd.DataFrame())
        for value in ["", "AAPL;DROP TABLE", "../AAPL", "<script>"]:
            with self.assertRaises(ValueError):
                validate_ticker(value)
        self.assertEqual(validate_ticker(" brk-b "), "BRK-B")

    def test_live_download_excludes_todays_partial_candle(self):
        today = pd.Timestamp.now(tz="UTC").tz_localize(None).normalize()
        raw = pd.DataFrame({"Close": [100., 101.]}, index=[today - pd.Timedelta(days=1), today])
        with patch("market.yf.download", return_value=raw):
            frame = download_data("AAPL")
        self.assertEqual(len(frame), 1)
        self.assertLess(frame.index[-1], today)


if __name__ == "__main__":
    unittest.main()
