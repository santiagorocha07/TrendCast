import unittest

import numpy as np
import torch

from lstm_model import WINDOW, TrendLSTM, sequences
from market import FEATURES


class LSTMTests(unittest.TestCase):
    def test_sequences_end_on_prediction_day(self):
        data = np.arange(30 * len(FEATURES)).reshape(30, len(FEATURES))
        windows = sequences(data)
        self.assertEqual(windows.shape, (30 - WINDOW + 1, WINDOW, len(FEATURES)))
        np.testing.assert_array_equal(windows[0, -1], data[WINDOW - 1])
        np.testing.assert_array_equal(windows[-1, -1], data[-1])
        self.assertEqual(TrendLSTM()(torch.from_numpy(windows)).shape, (len(windows),))
