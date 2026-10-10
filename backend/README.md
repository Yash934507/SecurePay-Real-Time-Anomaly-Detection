# SecurePay API

FastAPI service for health checks and single-transaction or CSV batch anomaly predictions using the trusted artifacts saved by the SecurePay notebook. The service does not retrain models, permanently store uploaded files, or authenticate users.

## Install dependencies

From the repository root, using the existing virtual environment:

```powershell
.\.venv\Scripts\python.exe -m pip install -r backend\requirements.txt
```

The scikit-learn, NumPy, pandas, and joblib versions are pinned to the versions used to create and verify the artifacts.

## Start the API

From the repository root:

```powershell
.\.venv\Scripts\python.exe -m uvicorn app.main:app --app-dir backend --reload --host 127.0.0.1 --port 8000
```

The root, health check, and interactive documentation are available at `http://127.0.0.1:8000/`, `http://127.0.0.1:8000/health`, and `http://127.0.0.1:8000/docs`.

## `POST /predict`

The model field is optional and defaults to `lof`. Supported values are `lof` and `isolation_forest`. Include all 28 PCA-transformed features and `Amount`; feature order in the request does not matter because the service applies the order stored in artifact metadata.

```json
{
	"model": "lof",
	"V1": 0.0,
	"V2": 0.0,
	"V3": 0.0,
	"V4": 0.0,
	"V5": 0.0,
	"V6": 0.0,
	"V7": 0.0,
	"V8": 0.0,
	"V9": 0.0,
	"V10": 0.0,
	"V11": 0.0,
	"V12": 0.0,
	"V13": 0.0,
	"V14": 0.0,
	"V15": 0.0,
	"V16": 0.0,
	"V17": 0.0,
	"V18": 0.0,
	"V19": 0.0,
	"V20": 0.0,
	"V21": 0.0,
	"V22": 0.0,
	"V23": 0.0,
	"V24": 0.0,
	"V25": 0.0,
	"V26": 0.0,
	"V27": 0.0,
	"V28": 0.0,
	"Amount": 12.5
}
```

The response identifies the selected model, its anomaly score, its saved threshold, and whether the transaction is Normal or Suspicious:

```json
{
	"selected_model": "lof",
	"prediction": "Normal",
	"is_anomaly": false,
	"anomaly_score": 1.25,
	"threshold": 3.1168357873545602
}
```

The response values above illustrate the schema only; the score and prediction depend on the submitted transaction.

## `POST /predict/batch`

Send a multipart form with a `file` CSV field and optional `model` field. The model defaults to `lof`; supported values are `lof` and `isolation_forest`.

```sh
curl -X POST http://127.0.0.1:8000/predict/batch \
	-F 'model=lof' \
	-F 'file=@transactions.csv;type=text/csv'
```

Required CSV columns are `V1` through `V28` and `Amount`. Additional columns, including `Time` and `Class`, are accepted but ignored by the prediction code and never returned. Feature order in the CSV may differ; the server orders values using `models/metadata.json`. `V1`-`V28` must already be computed PCA features from the same feature space as the trained models.

The response contains `selected_model`, `total_transactions`, `normal_transactions`, `suspicious_transactions`, `suspicious_rate` (a fraction from 0 to 1), and `results`. Each result contains `row_number`, `prediction`, `is_anomaly`, `anomaly_score`, and `threshold`. `row_number` starts at 1 for the first data row after the header. Suspicious means anomalous, not confirmed fraud.

Default safeguards are a 5 MiB upload limit and 10,000 data-row limit. Configure them before starting the server with `SECUREPAY_MAX_UPLOAD_BYTES` and `SECUREPAY_MAX_BATCH_ROWS`. The uploaded file is parsed in memory/spooled temporarily, validated, and closed after processing; it is not saved to a permanent location.

Invalid CSV content returns HTTP 422, unsupported files return HTTP 415, excessive upload size returns HTTP 413, and unavailable model artifacts return HTTP 503. Validation errors identify the column or CSV data row where possible. Raw transaction values are not logged or included in batch results.

## Validation and behavior

- All `V1`-`V28` and `Amount` values are required, numeric, and finite. Numeric strings, booleans, NaN, and positive or negative infinity are rejected with HTTP 422.
- Extra values, including `Class`, are rejected. An unknown model name is also rejected with HTTP 422.
- `RobustScaler` is applied only to `Amount`. PCA feature values are unchanged, and values are assembled in the exact order stored in `models/metadata.json`.
- Each loaded model's `score_samples` output is negated. A transaction is Suspicious when the resulting score is greater than or equal to that model's saved validation threshold.
- Artifacts are loaded once and reused. If they are unavailable or do not match the metadata/runtime, `/predict` returns HTTP 503 without exposing local paths or stack traces.
- Only artifacts created and trusted by this project should be loaded. `joblib` files can execute code during loading; do not use files from untrusted sources.

## Limitations

This API handles single transactions and bounded CSV batches. It has no authentication, database, real-time feed, or production monitoring. PCA feature values must be produced by a compatible upstream process; this service only scales `Amount` and does not calculate PCA features. Batch analysis is experimental and should not be treated as a confirmed fraud determination.