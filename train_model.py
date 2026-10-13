"""Avaliar num teste cronológico intocado; só depois treinar para a API."""
import json

import joblib
import numpy as np
import sklearn
from sklearn.ensemble import RandomForestClassifier
from sklearn.linear_model import LogisticRegression
from sklearn.metrics import accuracy_score, classification_report, confusion_matrix
from sklearn.model_selection import GridSearchCV, TimeSeriesSplit
from sklearn.pipeline import make_pipeline
from sklearn.preprocessing import StandardScaler

from market import ROOT, FEATURES, load_training_data, labelled_data, chronological_split


def evaluate(y, prediction):
    return {"accuracy": float(accuracy_score(y, prediction)),
            "confusion_matrix": confusion_matrix(y, prediction, labels=[0, 1]).tolist(),
            "classification_report": classification_report(y, prediction, labels=[0, 1],
                target_names=["down_or_flat", "up"], output_dict=True, zero_division=0)}


def train():
    prices = load_training_data()
    data = labelled_data(prices)
    train_data, test = chronological_split(data)
    X_train, y_train = train_data[FEATURES], train_data.Target
    X_test, y_test = test[FEATURES], test.Target
    cv = TimeSeriesSplit(n_splits=5, gap=1)
    search = GridSearchCV(RandomForestClassifier(n_estimators=100, random_state=42),
        {"max_depth": [3, 5, None], "min_samples_leaf": [10, 20]},
        cv=cv, scoring="accuracy", n_jobs=-1)
    # A pesquisa só vê o treino. O teste não participa na escolha dos parâmetros.
    search.fit(X_train, y_train)
    logistic = make_pipeline(StandardScaler(), LogisticRegression(random_state=42))
    logistic.fit(X_train, y_train)
    majority = int(y_train.mode().iloc[0])
    metrics = {"training_ticker": "AAPL", "features": FEATURES,
        "sklearn_version": sklearn.__version__, "horizon": "next trading session",
        "train": {"start": str(train_data.index.min().date()), "end": str(train_data.index.max().date()), "rows": len(train_data)},
        "test": {"start": str(test.index.min().date()), "end": str(test.index.max().date()), "rows": len(test)},
        "gap_sessions": 1, "best_params": search.best_params_, "cv_accuracy": float(search.best_score_),
        "models": {"random_forest": evaluate(y_test, search.predict(X_test)),
                   "logistic_regression": evaluate(y_test, logistic.predict(X_test)),
                   "baseline": evaluate(y_test, np.full(len(y_test), majority))},
        "baseline_class": majority,
        "production_training_end": str(data.index.max().date()),
        "production_data_end": str(prices.index.max().date()),
        "interpretation": "Historical holdout accuracy is not a guarantee of future performance. Model probabilities are not calibrated."}
    for name, model in [("random_forest", search.best_estimator_), ("logistic_regression", logistic)]:
        model.fit(data[FEATURES], data.Target)
        path = "modelo_trendcast.pkl" if name == "random_forest" else "modelo_logistic.pkl"
        joblib.dump(model, ROOT / path)
    (ROOT / "metricas_modelo.json").write_text(json.dumps(metrics, indent=2), encoding="utf-8")
    print(json.dumps(metrics, indent=2))
    return metrics


if __name__ == "__main__":
    train()
