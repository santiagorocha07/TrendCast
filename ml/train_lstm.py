"""Comparar a LSTM com os modelos simples nas mesmas datas de teste."""
import json

import numpy as np
import torch
from sklearn.preprocessing import StandardScaler

from .lstm_model import WINDOW, fit_lstm, sequences
from .market import MODELS, FEATURES, labelled_data, load_training_data, chronological_split
from .train_model import evaluate


def train():
    data = labelled_data(load_training_data())
    train_data, test = chronological_split(data)
    metrics_path = MODELS / "metricas_modelo.json"
    metrics = json.loads(metrics_path.read_text())
    if metrics["test"]["start"] != str(test.index.min().date()) or metrics["test"]["end"] != str(test.index.max().date()):
        raise ValueError("Run train_model.py first: the test dates changed.")
    scaler = StandardScaler().fit(train_data[FEATURES])
    model = fit_lstm(scaler.transform(train_data[FEATURES]), train_data.Target)
    # As janelas de teste podem usar o passado, nunca o futuro nem os seus alvos.
    context = data.loc[:test.index[-1]].iloc[-(len(test)+WINDOW-1):]
    X_test = sequences(scaler.transform(context[FEATURES]))
    with torch.no_grad():
        probabilities = torch.sigmoid(model(torch.from_numpy(X_test))).numpy()
    metrics["models"]["lstm"] = evaluate(test.Target, (probabilities >= 0.5).astype(int))
    metrics["lstm"] = {"window": WINDOW, "hidden_units": 16, "epochs": 30,
                       "note": "Fixed architecture; no hyperparameter selection on the test set."}
    scaler = StandardScaler().fit(data[FEATURES])
    model = fit_lstm(scaler.transform(data[FEATURES]), data.Target)
    torch.save({"state_dict": model.state_dict(), "mean": scaler.mean_.tolist(),
                "scale": scaler.scale_.tolist(), "window": WINDOW}, MODELS / "modelo_lstm.pt")
    metrics_path.write_text(json.dumps(metrics, indent=2), encoding="utf-8")
    print(json.dumps(metrics["models"], indent=2))


if __name__ == "__main__":
    train()
