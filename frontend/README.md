# SecurePay Frontend

SecurePay is a React 18 application built with Vite 4 and Tailwind CSS 3. Recharts displays session analytics and offline evaluation charts; Papa Parse reads historical replay CSV files. The interface connects to the existing FastAPI service for real predictions.

## Install and run

From the project root, in PowerShell:

~~~powershell
cd frontend
npm ci
npm run dev -- --host 127.0.0.1 --port 5173 --strictPort
~~~

Node.js and npm are required. Dependency ranges are in package.json and resolved versions are in package-lock.json. Use a compatible Node runtime and review engine warnings. Open http://127.0.0.1:5173. Start FastAPI separately using the [root setup instructions](../README.md#local-setup-and-running).

## FastAPI connection

src/services/api.js defaults to http://127.0.0.1:8000. Set VITE_API_BASE_URL in frontend/.env.local to override this public URL, then restart Vite. For example:

~~~dotenv
VITE_API_BASE_URL=http://127.0.0.1:8000
~~~

The backend CORS allowlist permits browser origins http://localhost:5173 and http://127.0.0.1:5173. Vite does not proxy requests; the browser calls the API directly. An unavailable API produces an error rather than fabricated results. The backend loads saved models; starting the frontend does not retrain them.

## Pages and workflows

- **Dashboard:** aggregate counts and charts from successful analyses recorded in the current React session.
- **Transaction Analysis:** select LOF or Isolation Forest, enter numeric V1-V28 and nonnegative Amount, and submit JSON to POST /predict. These must be precomputed PCA features compatible with the models, not ordinary customer or merchant fields.
- **CSV Batch Analysis:** a section on Transaction Analysis, not a separate sidebar page. Upload a CSV with V1-V28 and Amount headers and select a model. POST /predict/batch returns summary counts and row predictions. The default API limits are 5 MiB and 10,000 data rows; extra columns such as Time and Class are ignored for scoring.
- **Live Monitoring:** historical replay of a compatible CSV, limited to 500 rows and 5 MiB. Papa Parse validates the file, then the browser sends sequential POST /predict requests. Start, Pause/Resume, Stop, and Reset control replay. Pause lets the current request finish; leaving the page stops replay and attempts request cancellation. Slow/Normal/Fast wait 2/1/0.5 seconds between requests, in addition to API processing time. This is not a live bank feed or a real-time latency benchmark.
- **Fraud Alerts:** up to 20 retained suspicious entries, with model/source filters, reference search, and details. Available metadata includes analysis time, model, score, source, and reference. No fake identities or calibrated fraud probabilities are shown.
- **Model Performance:** static held-out evaluation metrics, comparison chart, confusion matrices, and methodology. src/data/modelPerformance.js uses verified notebook/report counts and metadata; it is independent of session analytics and makes no evaluation API request.
- **Settings:** Dark/Light theme, default analysis model, default replay speed, session counters, confirmed Clear Session Results, and project information.

Sidebar navigation is controlled by React state in App.jsx, not browser URL routes. CSV Batch Analysis is implemented in src/components/BatchAnalysis.jsx.

## Session data and preferences

AnalysisContext is the shared source of session statistics. Counters cover all recorded predictions since the last clear or refresh, while history retains at most 100 activity events and 20 suspicious entries. Retained alerts are not the complete session history. Reanalyzing a row counts another prediction.

PreferencesContext defaults to Dark theme, LOF, and Normal speed (1 second). Theme changes apply immediately through shared CSS theme tokens. Model and speed preferences set initial controls when analysis views open; users can override them. Changing preferences does not submit predictions or change trained models or thresholds.

Navigation preserves shared data/preferences; browser refresh resets them. There is no localStorage persistence or transaction-history database. Uploaded files are not permanently saved by the API.

Clear Session Results uses a browser confirmation dialog and removes shared counters, activity, and retained alerts. It leaves preferences, model artifacts, files on disk, and offline evaluation untouched. Opening Settings ends an active replay by leaving Live Monitoring. Responses from requests started before clearing are ignored by the shared session recorder if they arrive later. New analyses can populate the session again.

## Checks and build

Run these commands from frontend:

~~~powershell
npm run test:session
node tests/model-performance.test.mjs
node tests/theme-contrast.test.mjs
npm run build
~~~

- Session check: reducer counts, retained history, and clearing.
- Model-performance check: notebook/report agreement, exact confusion counts, saved thresholds, metrics, chart data, and model conclusion. It reads project files outside frontend, so retain the full project layout.
- Theme check: 70 semantic text/background pairs against a 4.5:1 contrast requirement; it is not a complete accessibility audit.
- Build: Vite production bundle in dist. No npm test or lint script is defined.

To preview the built app with the existing API CORS configuration, stop the development server first:

~~~powershell
npm run preview -- --host 127.0.0.1 --port 5173 --strictPort
~~~

Preview serves static assets locally; it does not start FastAPI or deploy a production service. Manually check keyboard navigation, dialogs, both themes, mobile layouts, and replay cancellation when UI behavior changes.

## Interpretation and limits

This is an academic prototype. Suspicious means an unusual pattern, not confirmed fraud. Anomaly scores are not calibrated fraud probabilities. Dashboard counts describe this tab's analyses; Model Performance describes a saved offline experiment. There is no authentication, real banking integration, persistent history, or notification delivery.

See the [root README](../README.md) for dataset requirements and setup, and the [performance report](../performance_analysis_report.md) for the preserved runtime and contamination-experiment limitations.
