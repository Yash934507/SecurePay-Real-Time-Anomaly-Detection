# SecurePay - Financial Transaction Anomaly Detection

SecurePay is a college internship project that explores unusual patterns in historical credit card transactions. It combines a machine-learning notebook, saved Isolation Forest and Local Outlier Factor (LOF) models, a FastAPI prediction service, and a React dashboard.

**Academic prototype:** a Suspicious prediction means an anomaly-score threshold was reached. It is not confirmed fraud, and an anomaly score is not a calibrated fraud probability. Historical replay is not connected to a bank or live payment feed.

## Problem statement and objectives

Fraud labels are rare in this dataset, so accuracy alone can hide missed fraud cases. The project studies the trade-off between detecting labeled fraud and generating false alerts.

- Load and explore transaction data, including Amount, Time, and class imbalance.
- Train and compare two anomaly detectors using normal transactions.
- Select thresholds on validation data and evaluate on held-out test data.
- Present precision, recall, F1, confusion matrices, precision-recall curves, and PCA visual diagnostics.
- Demonstrate single prediction, CSV analysis, historical replay, session analytics, and user preferences through a local application.

## Dataset and input requirements

The current workspace contains **Data/creditcard.csv**: 284,807 transactions, including 492 fraud labels. Its columns include Time, Amount, Class, and precomputed PCA features V1 through V28. Class uses 0 for normal and 1 for fraud. Time is used for exploration, not as a prediction feature.

The saved models require exactly **V1 through V28 plus Amount**. Supply finite numeric values; Amount must be nonnegative. PCA values must come from the same feature space as the training dataset. The API does not transform ordinary merchant or account fields into PCA features.

- Single JSON requests reject extra fields, including Time and Class; numeric strings and booleans are not accepted as feature values.
- CSV uploads require headers V1 through V28 and Amount, in any order. Additional columns such as Time and Class are ignored for scoring.
- The default batch limits are **5 MiB and 10,000 data rows**. Historical replay accepts at most **500 rows and 5 MiB**. The complete training CSV is not a valid upload within these limits; use a compatible smaller file.
- The local dataset is excluded from Git; see Dataset Setup below for download and placement instructions.

## Dataset Setup

**Dataset reference and download:** [Credit Card Fraud Detection on Kaggle (Machine Learning Group - ULB)](https://www.kaggle.com/datasets/mlg-ulb/creditcardfraud). The dataset page attributes collection and analysis to a collaboration between Worldline and the Machine Learning Group at ULB.

The local CSV matches the published dataset description: **31 columns** (Time, V1-V28, Amount, Class), **284,807 transactions**, **284,315 normal rows (Class=0)**, and **492 fraud rows (Class=1)**, approximately **0.1727% fraud**. These checks support this dataset identification; they do not establish byte-for-byte equivalence or verify where this local copy was originally downloaded. The project contains no original download record.

The file **creditcard.csv is excluded from GitHub because of its size**: 150,828,752 bytes (approximately 143.84 MiB). It remains available locally and is excluded by .gitignore; no Git LFS is used.

1. Open the Kaggle dataset page linked above and review its access terms and attribution guidance.
2. Use the dataset download option; sign in if prompted. Extract the downloaded archive if necessary to obtain creditcard.csv.
3. Create a Data directory in the project root if it is absent after cloning, then place the CSV at **Data/creditcard.csv**. Keep the filename and directory capitalization as shown.
4. Before running dataset-dependent analysis, confirm the expected columns and counts above. The project has no automatic dataset downloader.

The trained Isolation Forest and LOF models, Amount scaler, and metadata are included in **models/** for inference; running the application does not require retraining. The full CSV is needed for notebook analysis and dataset-dependent backend tests. Predictions still require compatible V1-V28 PCA features and Amount.

## Technologies

| Area | Technologies and source of dependency versions |
| --- | --- |
| Analysis | Python, NumPy, pandas, scikit-learn, Matplotlib, joblib, Jupyter/IPython |
| Backend | FastAPI, Uvicorn, python-multipart; see backend/requirements.txt |
| Frontend | React 18, Vite 4, Tailwind CSS 3, Recharts, Papa Parse, Lucide icons; see frontend/package.json and package-lock.json |
| Tests | pytest and HTTPX for the API; Node assertions for frontend source/state checks |

The existing Python environment records Python 3.14.7. Backend requirements pin scikit-learn 1.9.1, NumPy 2.5.3, pandas 3.0.6, and joblib 1.6.0. Preserve artifact-compatible versions when reproducing this environment. Runtime versions and security-audit findings are environment-dependent; this README does not claim a current vulnerability assessment.

## Methodology and evaluation

The notebook uses a stratified random **60% / 20% / 20% train/validation/test split**, with random_state=42: 170,883 training rows, 56,962 validation rows, and 56,962 test rows. The test split contains 98 fraud labels.

RobustScaler is fitted to Amount on the training split before normal-only filtering. It is then applied to validation and test Amount values. V1-V28 remain unchanged. Both detectors train only on normal transactions:

- **Isolation Forest:** random partitioning, 300 trees, 170,588 normal training rows, contamination='auto'.
- **LOF:** local-density comparison, 20 neighbors, novelty detection enabled for unseen rows, and a reproducible 50,000-row normal training sample; contamination='auto'.

Anomaly scores are computed as the negative of score_samples, so larger means more unusual. Validation labels select the score threshold that maximizes F1. Test labels do not select thresholds. The saved decision rule is anomaly_score >= threshold. Fitting is unsupervised, but threshold selection uses validation labels.

| Model | Test precision | Test recall | Test F1 |
| --- | ---: | ---: | ---: |
| Isolation Forest | 0.2180 | 0.2959 | 0.2511 |
| Local Outlier Factor | 0.2882 | 0.5000 | 0.3657 |

These are the four-decimal values in the [performance report](performance_analysis_report.md). The Model Performance page derives its display from exact saved confusion counts. LOF achieved higher validation F1 and better test precision, recall, and F1 in this experiment; it is the current preferred model, not a universally superior detector.

Saved score thresholds are **0.647690607885569** for Isolation Forest and **3.1168357873545602** for LOF, from [model metadata](models/metadata.json). They are not probabilities or contamination fractions.

The report preserves two important qualifications:

- [Runtime provenance](performance_analysis_report.md#runtime-comparison-and-provenance): report fitting times are 0.8992 s for Isolation Forest and 3.5689 s for LOF; cell 10 instead displays 1.01 s and 3.98 s. The exact cause is unresolved. Training sizes differ, so this is not an equal-dataset benchmark or evidence of real-time inference latency.
- [Contamination experiments](performance_analysis_report.md#isolation-forest-experiments-and-contamination-terminology): 100/300-tree candidates are compared directly. The 0.005, 0.01, 0.02, and 0.05 contamination inputs vary post-fit quantile cutoffs, not the estimator parameter. Final thresholds remain validation-F1-based. A direct numeric contamination-parameter sweep is unperformed and is a separate deliverable if explicitly required by the internship rubric.

## Completed interface

| Page or workflow | What it does |
| --- | --- |
| Dashboard | Session analyzed/normal/suspicious counters, suspicious rate, charts, and retained activity |
| Transaction Analysis | Select a model, enter V1-V28 and Amount, and submit a real single prediction |
| CSV Batch Analysis | Section within Transaction Analysis, not a separate sidebar route; upload a CSV and inspect API summaries and row results |
| Live Monitoring | Historical CSV simulation with sequential predictions, Start, Pause/Resume, Stop, and Reset |
| Fraud Alerts | Retained suspicious predictions with model/source filters, reference search, and metadata details |
| Model Performance | Static offline evaluation cards, comparison chart, confusion matrices, methodology, and model explanations |
| Settings | Dark/Light theme, initial model and replay-speed preferences, session counters, confirmed clearing, and project information |

Navigation uses React state rather than URL routes. AnalysisContext retains aggregate counts until clearing or refresh, up to 100 activity events, and up to 20 suspicious entries. The retained lists are not complete session history. Normal predictions do not create alerts; repeated analysis counts again rather than deduplicating a real-world transaction.

Session results and preferences survive navigation within the tab but reset on refresh. Defaults are **Dark, LOF, and Normal speed (1 second)**. Preferences initialize analysis controls; users can override them without changing saved models or thresholds. They do not automatically submit predictions. No localStorage or database stores transaction history.

Clear Session Results requires confirmation and clears shared counters, activity, and alerts. It leaves files, models, preferences, and offline evaluation unchanged. Navigating away from Live Monitoring stops replay and attempts to abort its request. Responses started before a clear cannot repopulate the cleared shared session; new analyses can populate it again.

Replay waits 2, 1, or 0.5 seconds between sequential requests for Slow, Normal, or Fast. API processing adds time; these settings are not latency or throughput guarantees. Pause waits for an in-flight result before pausing.

## Project structure

~~~text
Data/creditcard.csv
models/                         Saved models, Amount scaler, metadata
backend/
  app/main.py                   FastAPI routes and request validation
  app/ml_service.py             Artifact loading and prediction
  app/batch_csv.py               CSV validation
  tests/test_api.py
  requirements.txt
  requirements-dev.txt
frontend/
  src/App.jsx                   Navigation and shared providers
  src/pages/                    Dashboard, analysis, replay, alerts, evaluation, settings
  src/components/BatchAnalysis.jsx
  src/context/                  Session state and preferences
  src/data/modelPerformance.js  Verified static evaluation data
  src/services/api.js           FastAPI client
  tests/                        Three Node-based checks
  package.json
  package-lock.json
real_time_anomaly_detection.ipynb
performance_analysis_report.md
~~~

## Local setup and running

The following commands use **Windows PowerShell**, starting from the project root. Install Python and Node.js/npm before setup. Use a Node version compatible with the locked frontend dependencies; npm engine warnings should be investigated rather than ignored. There is no root JavaScript application: run npm commands inside frontend.

### Backend

If .venv is absent, create it with the Python 3.14 interpreter installed on your machine. Skip the first command when using the existing environment:

~~~powershell
py -3.14 -m venv .venv
.\.venv\Scripts\python.exe -m pip install -r backend\requirements.txt
.\.venv\Scripts\python.exe -m uvicorn app.main:app --app-dir backend --reload --host 127.0.0.1 --port 8000
~~~

Keep the trusted model files and metadata in models/. Running the application uses these files and does not require retraining or notebook execution. The API loads artifacts on demand; /health confirms the service responds, not that model loading has succeeded.

### Frontend

In a second terminal, starting from the root:

~~~powershell
cd frontend
npm ci
npm run dev -- --host 127.0.0.1 --port 5173 --strictPort
~~~

Open http://127.0.0.1:5173. The client defaults to http://127.0.0.1:8000. To override it, create frontend/.env.local containing VITE_API_BASE_URL=http://127.0.0.1:8000 with your desired API address, then restart Vite. This variable is public browser configuration, not a secret.

Backend CORS permits http://localhost:5173 and http://127.0.0.1:5173. Changing the browser origin or using the default preview port does not automatically update that allowlist. See the [frontend guide](frontend/README.md) for workflows and checks.

### Configure CORS for a deployed frontend

Both development origins, http://localhost:5173 and http://127.0.0.1:5173, remain allowed. Add production origins through the backend environment variable **SECUREPAY_CORS_ORIGINS**. On Render, set:

~~~dotenv
SECUREPAY_CORS_ORIGINS=https://securepay-demo.vercel.app
~~~

The URL above is an example placeholder: **replace it with your actual deployed frontend origin**. For multiple origins, separate them with commas, for example https://securepay-demo.vercel.app,https://your-custom-domain.example. Use only the scheme, hostname, and optional port, with no trailing slash or path. Restart/redeploy the backend after changing the variable.

Whitespace around entries is trimmed, empty entries are ignored, and duplicate entries are removed. Invalid entries fail backend startup instead of being silently accepted. Do not use wildcard origins, including * or https://*.vercel.app; preview deployments must be explicitly listed. Credentials remain disabled. CORS controls browser access and is not authentication or protection against non-browser clients.

## FastAPI endpoints

| Method | Path | Purpose |
| --- | --- | --- |
| GET | / | Welcome response |
| GET | /health | Basic service health response |
| POST | /predict | Single JSON transaction with V1-V28, Amount, and optional model |
| POST | /predict/batch | Multipart CSV in file plus optional model form field |
| GET | /docs | Interactive API documentation |
| GET | /redoc | Alternative API documentation |
| GET | /openapi.json | OpenAPI schema |

Model identifiers are lof and isolation_forest; the backend default is lof. Successful predictions include selected_model, prediction, is_anomaly, anomaly_score, and threshold. Batch results additionally include aggregate counts, a fractional suspicious_rate, and one-based row_number references. Uploads are not permanently saved. SECUREPAY_MAX_UPLOAD_BYTES and SECUREPAY_MAX_BATCH_ROWS configure backend limits before startup; frontend replay limits remain separate.

See [backend/README.md](backend/README.md) and http://127.0.0.1:8000/docs for request examples and validation rules. There is no endpoint providing persistent transaction history or live model evaluation.

## Tests and production build

From the root, install development dependencies and run backend tests:

~~~powershell
.\.venv\Scripts\python.exe -m pip install -r backend\requirements-dev.txt
.\.venv\Scripts\python.exe -m pytest backend\tests -q
~~~

These tests use FastAPI TestClient, the saved artifacts, and held-out examples from Data/creditcard.csv; a separately running API server is not required. They do not retrain models.

From frontend, run the existing checks and build:

~~~powershell
npm run test:session
node tests/model-performance.test.mjs
node tests/theme-contrast.test.mjs
npm run build
~~~

The checks cover session reducer behavior/retention/clearing, report-notebook-metadata metric consistency, and 70 semantic text/surface contrast pairs. They are not a complete browser end-to-end or accessibility suite. The build creates frontend/dist. There is no npm test or lint script currently defined. npm run preview serves the build locally; for API-connected preview, stop the dev server and use npm run preview -- --host 127.0.0.1 --port 5173 --strictPort to match the CORS allowlist. Preview is not a production deployment.

## Notebook and report

Open [real_time_anomaly_detection.ipynb](real_time_anomaly_detection.ipynb) to inspect saved EDA, training, threshold selection, visual diagnostics, and artifact verification. Read [performance_analysis_report.md](performance_analysis_report.md) for results and the runtime/contamination qualifications.

Cell 2 defines DATA_PATH = Path("Data/creditcard.csv"), relative to the kernel working directory. Use the project root as that directory. **CREDIT_CARD_CSV is not read by the notebook**; setting it has no effect. A future alternate dataset path requires explicitly editing DATA_PATH, not an environment setting. No such code change is needed to inspect the saved notebook.

The notebook needs NumPy, pandas, scikit-learn, Matplotlib, IPython, and joblib, plus a Jupyter-capable editor/kernel. Backend requirements supply the pinned ML libraries but do not include all notebook tools. Optional notebook environment setup from the root:

~~~powershell
.\.venv\Scripts\python.exe -m pip install matplotlib ipython ipykernel jupyterlab
.\.venv\Scripts\python.exe -m jupyter lab real_time_anomaly_detection.ipynb
~~~

Notebook-only dependencies are not fully pinned. Viewing saved results does not require Run All. Executing fitting cells retrains models; cell 12 overwrites the report and cell 13 writes artifacts. The unchanged report template omits the Step 15/16 documentation additions, so any separately approved regeneration must preserve/reapply them.

## Limitations and future improvements

- No authentication, database, persistent transaction history, bank integration, or notification service. This is not a production fraud-prevention system.
- Scores are anomaly measures, not fraud probabilities; offline metrics are not live fraud statistics. False positives and missed fraud remain substantial.
- Random-split results may not generalize to later transactions. Future work could add chronological evaluation, drift analysis, and business-cost-based threshold assessment.
- Runtime snapshots have unresolved provenance and unequal fitting sizes. A controlled runtime study and separate inference-latency measurement would be future experiments.
- A direct estimator contamination sweep would need separate approval if required by the rubric; the current quantile study is accurately labeled in the report.
- PCA features must be provided upstream. The visualization PCA in the notebook does not make arbitrary raw payment data compatible with the saved models.
- Session summaries are bounded and temporary. Manual browser checks remain necessary for navigation, cancellation, dialogs, and mobile layouts.
- Fresh installation and dependency/security compatibility must be checked on the submission machine. No production certification or deployment readiness is claimed.
