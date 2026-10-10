import json
import logging
from functools import lru_cache
from pathlib import Path
from typing import Mapping

import joblib
import numpy as np
import pandas as pd
import sklearn
from sklearn.ensemble import IsolationForest
from sklearn.neighbors import LocalOutlierFactor

logger = logging.getLogger(__name__)

MODEL_FEATURES = tuple([f"V{index}" for index in range(1, 29)] + ["Amount"])
MODEL_KEYS = {
    "isolation_forest": "Isolation Forest",
    "lof": "Local Outlier Factor",
}
ARTIFACT_FILES = {
    "isolation_forest": "isolation_forest.joblib",
    "lof": "lof_model.joblib",
    "scaler": "amount_scaler.joblib",
}
EXPECTED_MODEL_CLASSES = {
    "isolation_forest": IsolationForest,
    "lof": LocalOutlierFactor,
}


class ModelArtifactsUnavailable(Exception):
    """Raised when trusted prediction artifacts cannot be loaded or validated."""


class PredictionService:
    def __init__(self, artifact_directory: Path | None = None):
        self._artifact_directory = artifact_directory or Path(__file__).resolve().parents[2] / "models"
        try:
            self._load_artifacts()
        except Exception as error:
            logger.exception("Unable to load SecurePay model artifacts")
            raise ModelArtifactsUnavailable from error

    def _load_artifacts(self):
        metadata_path = self._artifact_directory / "metadata.json"
        with metadata_path.open("r", encoding="utf-8") as metadata_file:
            metadata = json.load(metadata_file)

        features = metadata.get("feature_names_in_order")
        if (
            not isinstance(features, list)
            or len(features) != len(MODEL_FEATURES)
            or len(set(features)) != len(features)
            or set(features) != set(MODEL_FEATURES)
        ):
            raise ValueError("Artifact feature metadata is invalid.")

        if metadata.get("scikit_learn_version") != sklearn.__version__:
            raise ValueError("Artifact scikit-learn version does not match the runtime.")

        thresholds = metadata.get("thresholds")
        if not isinstance(thresholds, dict):
            raise ValueError("Artifact threshold metadata is invalid.")

        preprocessing = metadata.get("preprocessing", {})
        if preprocessing.get("scaled_features") != ["Amount"]:
            raise ValueError("Artifact preprocessing metadata is invalid.")

        self.feature_names = tuple(features)
        self.thresholds = {}
        for model_key, metadata_name in MODEL_KEYS.items():
            threshold = thresholds.get(metadata_name)
            if isinstance(threshold, bool) or not isinstance(threshold, (int, float)):
                raise ValueError("Artifact threshold metadata is invalid.")
            if not np.isfinite(threshold):
                raise ValueError("Artifact threshold metadata is invalid.")
            self.thresholds[model_key] = float(threshold)

        self.models = {
            model_key: joblib.load(self._artifact_directory / ARTIFACT_FILES[model_key])
            for model_key in MODEL_KEYS
        }
        self.amount_scaler = joblib.load(self._artifact_directory / ARTIFACT_FILES["scaler"])

        for model_key, model in self.models.items():
            if not isinstance(model, EXPECTED_MODEL_CLASSES[model_key]):
                raise ValueError("A model artifact has an unexpected type.")
            if not callable(getattr(model, "score_samples", None)):
                raise ValueError("A model artifact does not support score_samples.")
            if getattr(model, "n_features_in_", None) != len(self.feature_names):
                raise ValueError("A model artifact has an unexpected feature count.")

        if not callable(getattr(self.amount_scaler, "transform", None)):
            raise ValueError("The Amount scaler artifact is invalid.")
        if getattr(self.amount_scaler, "n_features_in_", None) != 1:
            raise ValueError("The Amount scaler must be fitted to one feature.")

    def predict(self, transaction: Mapping[str, float], model_key: str = "lof"):
        if model_key not in MODEL_KEYS:
            raise ValueError("Unsupported model selection.")

        missing_features = set(self.feature_names).difference(transaction)
        if missing_features:
            raise ValueError("Transaction is missing required features.")

        extra_features = set(transaction).difference(self.feature_names)
        if extra_features:
            raise ValueError("Transaction contains unsupported features.")

        values = []
        for feature_name in self.feature_names:
            value = transaction[feature_name]
            if isinstance(value, bool) or not isinstance(value, (int, float)):
                raise ValueError("Feature values must be finite numbers.")
            if not np.isfinite(value):
                raise ValueError("Feature values must be finite numbers.")
            values.append(float(value))

        scores, threshold = self._score_feature_matrix(
            np.asarray(values, dtype=np.float64).reshape(1, -1), model_key
        )
        anomaly_score = float(scores[0])
        is_anomaly = anomaly_score >= threshold

        return {
            "selected_model": model_key,
            "prediction": "Suspicious" if is_anomaly else "Normal",
            "is_anomaly": bool(is_anomaly),
            "anomaly_score": anomaly_score,
            "threshold": threshold,
        }

    def predict_batch(self, feature_matrix: np.ndarray, model_key: str = "lof"):
        if model_key not in MODEL_KEYS:
            raise ValueError("Unsupported model selection.")

        scores, threshold = self._score_feature_matrix(feature_matrix, model_key)
        anomaly_flags = scores >= threshold
        total_transactions = len(scores)
        suspicious_transactions = int(np.count_nonzero(anomaly_flags))

        return {
            "selected_model": model_key,
            "total_transactions": total_transactions,
            "normal_transactions": total_transactions - suspicious_transactions,
            "suspicious_transactions": suspicious_transactions,
            "suspicious_rate": float(suspicious_transactions / total_transactions),
            "results": [
                {
                    "row_number": row_number,
                    "prediction": "Suspicious" if is_anomaly else "Normal",
                    "is_anomaly": bool(is_anomaly),
                    "anomaly_score": float(score),
                    "threshold": threshold,
                }
                for row_number, (score, is_anomaly) in enumerate(
                    zip(scores, anomaly_flags), start=1
                )
            ],
        }

    def _score_feature_matrix(self, feature_matrix: np.ndarray, model_key: str):
        matrix = np.asarray(feature_matrix, dtype=np.float64)
        if matrix.ndim != 2 or matrix.shape[1] != len(self.feature_names):
            raise ValueError("Feature matrix shape does not match artifact metadata.")
        if not np.isfinite(matrix).all():
            raise ValueError("Feature matrix values must be finite.")

        matrix = matrix.copy()
        amount_index = self.feature_names.index("Amount")
        scaled_amount = self.amount_scaler.transform(
            pd.DataFrame({"Amount": matrix[:, amount_index]})
        ).ravel()
        matrix[:, amount_index] = scaled_amount

        scores = -self.models[model_key].score_samples(matrix)
        if not np.isfinite(scores).all():
            raise ValueError("The selected model returned non-finite anomaly scores.")
        return np.asarray(scores, dtype=np.float64), self.thresholds[model_key]


@lru_cache(maxsize=1)
def get_prediction_service() -> PredictionService:
    return PredictionService()