"""LSTM pequena: 20 sessões passadas -> direção da próxima sessão."""
import numpy as np
import torch
from torch import nn

from .market import FEATURES

WINDOW = 20


class TrendLSTM(nn.Module):
    def __init__(self):
        super().__init__()
        self.lstm = nn.LSTM(len(FEATURES), 16, batch_first=True)
        self.output = nn.Linear(16, 1)

    def forward(self, x):
        sequence, _ = self.lstm(x)
        return self.output(sequence[:, -1]).squeeze(-1)


def sequences(values):
    return np.stack([values[i-WINDOW+1:i+1] for i in range(WINDOW-1, len(values))]).astype("float32")


def fit_lstm(values, targets, epochs=30):
    torch.manual_seed(42)
    torch.set_num_threads(2)
    model = TrendLSTM()
    X = torch.from_numpy(sequences(values))
    y = torch.tensor(np.asarray(targets)[WINDOW-1:], dtype=torch.float32)
    optimizer = torch.optim.Adam(model.parameters(), lr=0.003)
    loss_function = nn.BCEWithLogitsLoss()
    model.train()
    for _ in range(epochs):
        for start in range(0, len(X), 64):
            optimizer.zero_grad()
            loss = loss_function(model(X[start:start+64]), y[start:start+64])
            loss.backward()
            optimizer.step()
    model.eval()
    return model


def load_lstm(path):
    artifact = torch.load(path, map_location="cpu", weights_only=True)
    model = TrendLSTM()
    model.load_state_dict(artifact["state_dict"])
    model.eval()
    return model, artifact


def predict_lstm(frame, path):
    model, artifact = load_lstm(path)
    values = frame[FEATURES].dropna().tail(WINDOW).to_numpy()
    if len(values) < WINDOW:
        raise ValueError("The LSTM needs 20 complete indicator sessions.")
    values = (values - np.array(artifact["mean"])) / np.array(artifact["scale"])
    with torch.no_grad():
        return float(torch.sigmoid(model(torch.tensor(values[None], dtype=torch.float32)))[0])
