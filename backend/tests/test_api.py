import asyncio
import csv
import io
import json
import sys
from pathlib import Path
from unittest.mock import patch

import numpy as np
import pandas as pd
import pytest
from fastapi.testclient import TestClient
from sklearn.model_selection import train_test_split

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

import app.main as main
from app.ml_service import MODEL_FEATURES, ModelArtifactsUnavailable, get_prediction_service


ROOT = Path(__file__).resolve().parents[2]
DATA_PATH = ROOT / "Data" / "creditcard.csv"


@pytest.fixture(scope="module")
def client():
    with TestClient(main.app) as test_client:
        yield test_client


@pytest.fixture(scope="module")
def held_out_examples():
    dataset = pd.read_csv(DATA_PATH, usecols=["Class", *MODEL_FEATURES])
    _, test_data = train_test_split(
        dataset,
        test_size=0.20,
        stratify=dataset["Class"],
        random_state=42,
    )
    return {
        label: test_data.loc[test_data["Class"] == label].iloc[0]
        for label in (0, 1)
    }


def request_features(row):
    return {feature: float(row[feature]) for feature in MODEL_FEATURES}


def make_csv(headers, rows):
    output = io.StringIO(newline="")
    writer = csv.writer(output, lineterminator="\n")
    writer.writerow(headers)
    writer.writerows(rows)
    return output.getvalue().encode("utf-8")


def post_csv(client, content, filename="transactions.csv", content_type="text/csv", model="lof"):
    return client.post(
        "/predict/batch",
        data={"model": model},
        files={"file": (filename, content, content_type)},
    )


def test_basic_routes_docs_and_cors(client):
    assert client.get("/").json() == {"message": "Welcome to the SecurePay API."}
    assert client.get("/health").json() == {"status": "ok", "service": "SecurePay API"}
    assert client.get("/docs").status_code == 200
    assert client.get("/openapi.json").json()["info"]["title"] == "SecurePay API"

    allowed = client.options(
        "/predict",
        headers={
            "Origin": "http://localhost:5173",
            "Access-Control-Request-Method": "POST",
        },
    )
    denied = client.options(
        "/predict",
        headers={
            "Origin": "https://untrusted.example",
            "Access-Control-Request-Method": "POST",
        },
    )
    assert allowed.headers["access-control-allow-origin"] == "http://localhost:5173"
    assert "access-control-allow-origin" not in denied.headers


@pytest.mark.parametrize("model", ["lof", "isolation_forest"])
def test_single_prediction_uses_metadata_threshold_and_amount_scaler(client, held_out_examples, model):
    service = get_prediction_service()
    metadata = json.loads((ROOT / "models" / "metadata.json").read_text(encoding="utf-8"))
    assert list(service.feature_names) == metadata["feature_names_in_order"]

    for label, row in held_out_examples.items():
        features = request_features(row)
        response = client.post("/predict", json={**features, "model": model})
        assert response.status_code == 200
        body = response.json()

        ordered = np.asarray([[features[name] for name in service.feature_names]], dtype=np.float64)
        amount_index = service.feature_names.index("Amount")
        raw_amount = ordered[0, amount_index]
        ordered[0, amount_index] = service.amount_scaler.transform(
            pd.DataFrame({"Amount": [raw_amount]})
        )[0, 0]
        expected_score = float(-service.models[model].score_samples(ordered)[0])
        saved_threshold = metadata["thresholds"][service.models[model].__class__.__name__.replace("IsolationForest", "Isolation Forest").replace("LocalOutlierFactor", "Local Outlier Factor")]

        assert body["selected_model"] == model
        assert body["anomaly_score"] == pytest.approx(expected_score, abs=1e-12)
        assert body["threshold"] == saved_threshold
        assert body["is_anomaly"] is (expected_score >= saved_threshold)
        assert body["prediction"] == ("Suspicious" if expected_score >= saved_threshold else "Normal")
        assert "Class" not in body and "Time" not in body
        assert label in (0, 1)  # Labels only selected held-out examples; they are never sent to the API.


@pytest.mark.parametrize(
    "mutation",
    [
        lambda payload: payload.pop("V1"),
        lambda payload: payload.update(Class=1),
        lambda payload: payload.update(V1="not-a-number"),
        lambda payload: payload.update(V1=True),
        lambda payload: payload.update(Amount=-0.01),
    ],
)
def test_single_invalid_inputs_return_422(client, held_out_examples, mutation):
    payload = request_features(held_out_examples[0])
    mutation(payload)
    response = client.post("/predict", json=payload)
    assert response.status_code == 422
    assert "Traceback" not in response.text
    assert str(ROOT) not in response.text


@pytest.mark.parametrize("model", ["lof", "isolation_forest"])
def test_batch_matches_individual_predictions_and_ignores_extra_columns(client, held_out_examples, model):
    service = get_prediction_service()
    headers = ["Time", *reversed(MODEL_FEATURES), "Class"]
    rows = []
    ordered_examples = [held_out_examples[0], held_out_examples[1]]
    for index, item in enumerate(ordered_examples):
        rows.append([index, *[float(item[name]) for name in reversed(MODEL_FEATURES)], index])

    response = post_csv(client, make_csv(headers, rows), model=model)
    assert response.status_code == 200
    batch = response.json()
    assert batch["selected_model"] == model
    assert batch["total_transactions"] == 2
    assert batch["normal_transactions"] + batch["suspicious_transactions"] == 2
    assert batch["suspicious_rate"] == pytest.approx(batch["suspicious_transactions"] / 2)
    assert [item["row_number"] for item in batch["results"]] == [1, 2]
    assert "Class" not in batch
    assert all("Class" not in item and "Time" not in item for item in batch["results"])

    for item, held_out_row in zip(batch["results"], ordered_examples):
        single = client.post(
            "/predict",
            json={**request_features(held_out_row), "model": model},
        ).json()
        assert item["prediction"] == single["prediction"]
        assert item["is_anomaly"] == single["is_anomaly"]
        assert item["threshold"] == single["threshold"]
        assert item["anomaly_score"] == pytest.approx(single["anomaly_score"], abs=1e-12)

    assert len(service.feature_names) == 29


@pytest.mark.parametrize(
    ("headers", "values", "expected_message"),
    [
        (list(MODEL_FEATURES[:-1]), [0.0] * (len(MODEL_FEATURES) - 1), "Missing required columns"),
        (list(MODEL_FEATURES) + ["V1"], [0.0] * (len(MODEL_FEATURES) + 1), "Duplicate required column names"),
        (list(MODEL_FEATURES), ["invalid" if feature == "V1" else 0.0 for feature in MODEL_FEATURES], "non-numeric value"),
        (list(MODEL_FEATURES), ["NaN" if feature == "V1" else 0.0 for feature in MODEL_FEATURES], "non-finite value"),
        (list(MODEL_FEATURES), ["Infinity" if feature == "V1" else 0.0 for feature in MODEL_FEATURES], "non-finite value"),
        (list(MODEL_FEATURES), [-1.0 if feature == "Amount" else 0.0 for feature in MODEL_FEATURES], "negative Amount"),
        (list(MODEL_FEATURES), ["" if feature == "V2" else 0.0 for feature in MODEL_FEATURES], "missing a value"),
    ],
)
def test_batch_invalid_features_return_422(client, headers, values, expected_message):
    response = post_csv(client, make_csv(headers, [values]))
    assert response.status_code == 422
    assert expected_message in response.json()["detail"]
    assert "Traceback" not in response.text
    assert str(ROOT) not in response.text


def test_batch_empty_malformed_and_wrong_type(client):
    headers = list(MODEL_FEATURES)
    assert post_csv(client, b"").status_code == 422
    assert post_csv(client, make_csv(headers, []), filename="empty.csv").status_code == 422
    malformed = (",".join(headers) + '\n"unterminated\n').encode("utf-8")
    assert post_csv(client, malformed).status_code == 422
    assert post_csv(client, make_csv(headers, [[0.0] * len(headers)]), filename="rows.txt", content_type="text/plain").status_code == 415


def test_batch_row_and_file_limits(client, monkeypatch):
    headers = list(MODEL_FEATURES)
    valid_row = [0.0] * len(headers)
    monkeypatch.setattr(main, "MAX_BATCH_ROWS", 1)
    too_many = post_csv(client, make_csv(headers, [valid_row, valid_row]))
    assert too_many.status_code == 422
    assert "maximum of 1 data rows" in too_many.json()["detail"]

    monkeypatch.setattr(main, "MAX_BATCH_UPLOAD_BYTES", 32)
    oversized = post_csv(client, make_csv(headers, [valid_row]))
    assert oversized.status_code == 413


def test_chunked_batch_request_without_content_length_is_limited():
    body = b"x" * (main.MAX_BATCH_UPLOAD_BYTES + main.MULTIPART_OVERHEAD_BYTES + 1)
    scope = {
        "type": "http",
        "asgi": {"version": "3.0", "spec_version": "2.3"},
        "http_version": "1.1",
        "method": "POST",
        "scheme": "http",
        "path": "/predict/batch",
        "raw_path": b"/predict/batch",
        "query_string": b"",
        "root_path": "",
        "headers": [(b"content-type", b"multipart/form-data; boundary=test")],
        "client": ("testclient", 1234),
        "server": ("testserver", 80),
        "state": {},
    }
    received = False
    messages = []

    async def receive():
        nonlocal received
        if not received:
            received = True
            return {"type": "http.request", "body": body, "more_body": False}
        return {"type": "http.disconnect"}

    async def send(message):
        messages.append(message)

    asyncio.run(main.app(scope, receive, send))
    status = next(message["status"] for message in messages if message["type"] == "http.response.start")
    response_body = b"".join(
        message.get("body", b"")
        for message in messages
        if message["type"] == "http.response.body"
    )
    assert status == 413
    assert str(ROOT).encode() not in response_body
    assert b"Traceback" not in response_body


def test_missing_artifacts_return_sanitized_503(client, held_out_examples):
    payload = {**request_features(held_out_examples[0]), "model": "lof"}
    with patch("app.main.get_prediction_service", side_effect=ModelArtifactsUnavailable):
        response = client.post("/predict", json=payload)
    assert response.status_code == 503
    assert "model artifacts" in response.json()["detail"]
    assert str(ROOT) not in response.text
    assert "Traceback" not in response.text