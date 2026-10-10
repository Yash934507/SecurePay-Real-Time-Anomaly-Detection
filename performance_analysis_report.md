# SecurePay Anomaly Detection: Performance Analysis

## Evaluation setup

- Dataset: `data\creditcard.csv` (284,807 transactions; 492 fraud labels).
- Features: 29 (V1, V2, V3, V4, V5, V6, V7, V8, V9, V10, V11, V12, V13, V14, V15, V16, V17, V18, V19, V20, V21, V22, V23, V24, V25, V26, V27, V28, Amount). Amount scaled with `RobustScaler` fitted on training data; PCA features unchanged.
- Split: 60% train / 20% validation / 20% test, stratified by class. Models fit only to normal training transactions.
- Threshold: selected by maximum validation F1; final metrics below are from held-out test data.

## Model comparison

                      Validation F1 (threshold selection)  Test precision  Test recall  Test F1  Test alert rate  Fit seconds  Selected anomaly-score threshold  Estimated contamination
Isolation Forest                                   0.1966          0.2180       0.2959   0.2511           0.0023       0.8992                            0.6477                   0.0020
Local Outlier Factor                               0.3399          0.2882       0.5000   0.3657           0.0030       3.5689                            3.1168                   0.0019

## Runtime comparison and provenance

Cell numbers below are one-based notebook positions, including Markdown cells, in `real_time_anomaly_detection.ipynb`.

| Saved measurement snapshot | Isolation Forest | Local Outlier Factor |
| --- | ---: | ---: |
| Cell 10 fitting output (execution count 4; two decimal places) | 1.01 s | 3.98 s |
| Cell 12 comparison/report output (execution count 21; four decimal places) | 0.8992 s | 3.5689 s |

**Measurements used in this report:** the model comparison retains **0.8992 s for Isolation Forest** and **3.5689 s for LOF**, matching the saved cell 12 comparison and printed report. These are the report snapshot values, not newly measured times or an assertion that this snapshot is the latest valid run. The differing cell 10 values are preserved above for transparency.

**Why the values differ:** the saved evidence does not establish the exact cause. Cell 10 records each fit in `fit_seconds`; cell 12 reads that same dictionary for its main comparison without timing those fits again. The difference cannot be explained by decimal rounding: 0.8992 and 3.5689 would round to 0.90 and 3.57, respectively. Cell 12 separately times Isolation Forest tree-count experiments using `fit_time`, but those timings do not replace `fit_seconds` or supply the main comparison. Thus, the displayed code does not explain the discrepancy as two different timing code paths for the main models. Separate executions, changed kernel state, or stale saved outputs could account for the inconsistent snapshots; the saved execution counts alone cannot distinguish these possibilities or establish run chronology. No specific explanation is confirmed, and these snapshots must not be treated as documented repeat trials or averaged together.

**What was timed:** these are wall-clock model fitting/training measurements. In cell 10, `time.perf_counter()` surrounds the fitting block, including conversion of the fit data to a NumPy array and warning-context overhead. Preprocessing, subsequent anomaly scoring, validation threshold selection, and API/network processing are outside this timer. These measurements do **not** establish real-time inference latency, per-transaction response time, or end-to-end throughput.

**Training sizes and comparison limits:** Isolation Forest fits **170,588 normal training rows** (cell 8 output and cell 10 fit-data mapping). LOF fits a randomly sampled **50,000 normal training rows**, capped by `LOF_MAX_TRAIN_ROWS` with `random_state=42` (cells 2 and 10). Isolation Forest uses 300 trees; LOF uses 20 neighbors and novelty detection. This is **not an equal-dataset benchmark**. The recorded durations describe these particular training configurations and unequal workloads; they do not isolate algorithm speed or establish a general speed advantage. There is no controlled repeated-run timing protocol, variability estimate, or per-run hardware/load record accompanying these snapshots.

This provenance section is a documentation-only clarification of saved results. Notebook code and saved outputs have not been rerun or changed. Cell 12 still contains the original report-writing template; any future regeneration of the report must preserve or reapply this clarification and reassess provenance against the new measurements.

## Isolation Forest experiments and contamination terminology

Sources: notebook cells 10 and 12 (one-based positions, including Markdown cells), their saved outputs, and [models/metadata.json](models/metadata.json). No experiments were rerun for this clarification.

### Tree-count experiment

Cell 12 fits separate Isolation Forest candidates with **n_estimators = 100 and 300**, both using **contamination='auto'**, normal-only training data, and random_state=42. Each candidate receives its own validation-F1-selected score threshold. The saved results are:

| Trees | Validation F1 | Validation-selected anomaly-score threshold |
| ---: | ---: | ---: |
| 100 | 0.190840 | 0.643093 |
| 300 | 0.196581 | 0.647691 |

Values above retain the saved output's six-decimal precision. The 300-tree candidate has the higher validation F1 in this comparison. The main model in cell 10 already specifies 300 trees; the experiment does not automatically replace it. This is a direct tree-count comparison, not a joint tree-count/contamination-parameter grid search.

### Estimator parameter versus score-cutoff sensitivity

**Estimator parameter:** setting IsolationForest(contamination=c) configures the estimator's internal offset during fitting for its built-in decision_function/predict boundary. A numeric c specifies the expected training outlier fraction; 'auto' uses the library's automatic offset, not validation-F1 optimization. The decision function is score_samples minus offset_. See the [scikit-learn IsolationForest documentation](https://scikit-learn.org/stable/modules/generated/sklearn.ensemble.IsolationForest.html). This parameter is distinct from the custom threshold used by this project.

**Existing experiment:** cell 12 keeps the fitted models unchanged and uses anomaly scores defined as **-score_samples**, with larger scores indicating greater anomaly. For each c in **0.005, 0.01, 0.02, 0.05**, it computes **candidate_threshold = np.quantile(train_normal_scores[name], 1 - c)**. Thus c represents a nominal upper-tail fraction (0.5%, 1%, 2%, or 5%); the quantile levels are 99.5%, 99%, 98%, and 95%. Validation rows are flagged when their score is **greater than or equal to** that cutoff. Ties and interpolation can affect the exact flagged training fraction; the validation alert rate need not equal c.

The loop evaluates validation precision, recall, F1, and alert rate for both already-fitted models. It performs no fitting and no estimator-parameter update. Its local variable named contamination is a quantile-cutoff input, not an assignment to IsolationForest(contamination=...). This is **contamination-based alert-threshold sensitivity, not direct estimator-parameter tuning**.

The saved Isolation Forest sensitivity results are reproduced below as fractions, at their original six-decimal display precision:

| Nominal upper-tail fraction c | Validation precision | Validation recall | Validation F1 | Validation alert rate |
| ---: | ---: | ---: | ---: | ---: |
| 0.005 | 0.102639 | 0.353535 | 0.159091 | 0.005986 |
| 0.010 | 0.081037 | 0.505051 | 0.139665 | 0.010832 |
| 0.020 | 0.056761 | 0.686869 | 0.104857 | 0.021032 |
| 0.050 | 0.026807 | 0.797980 | 0.051871 | 0.051736 |

Across these four saved settings, increasing the nominal tail fraction raises recall and alert volume while reducing precision and F1. The highest validation F1 among these four cutoffs is 0.159091 at c=0.005. These are validation sensitivity results, not the final held-out test metrics and not evidence that 0.005 is the final chosen setting.

### Why the saved threshold is validation-based

The main Isolation Forest retains **contamination='auto'**. Before the sensitivity loop, select_f1_threshold chooses the anomaly-score cutoff maximizing F1 from validation labels and validation scores. Test labels do not select the threshold. The saved Isolation Forest threshold is **0.647690607885569**, and the saved LOF threshold is **3.1168357873545602**, as recorded in models/metadata.json. These numbers are score cutoffs, not contamination fractions or fraud probabilities. The sensitivity loop neither replaces the thresholds dictionary nor updates the saved artifacts.

The report's **Estimated contamination** column is calculated afterward as the fraction of normal fitting scores at or above the validation-selected cutoff. It is a descriptive result of threshold selection, not its input, not the estimator's contamination parameter, and not measured fraud prevalence. The saved validation-based threshold is used for the final held-out evaluation and the saved prediction rule.

### Remaining experiment, if explicitly required

No direct numeric IsolationForest(contamination=...) parameter sweep is present in these experiments. If the internship rubric explicitly requires such a sweep, that deliverable remains outstanding and cannot be claimed complete from this score-cutoff study. It is an optional follow-up to the current documentation task, subject to approval; it is required for rubric compliance only if that direct sweep is explicitly demanded. No new experiment is performed here.

The unchanged notebook report-writing template does not include this clarification. If the report is regenerated later, preserve or reapply this section along with the runtime provenance section.

## Recommendation

Recommend **Local Outlier Factor** for the next evaluation stage because it achieved the higher validation F1 (0.3399). Its selected anomaly-score threshold is **3.116836**, with a normal-training-score contamination estimate of **0.19%**. On held-out test data: precision **0.2882**, recall **0.5000**, F1 **0.3657**, and alert rate **0.30%**.

The contamination estimate describes the fraction of normal fitting scores above the validation-selected cutoff; it is not a threshold-selection input or verified fraud prevalence. Validate the rate on a later time period and set the production threshold according to fraud-loss and false-decline costs. This random split is a baseline; a chronological evaluation is recommended before deployment.

## Confusion matrices

Rows are true labels (normal, fraud); columns are predicted labels (normal, fraud).

- Isolation Forest: `
[[56760   104]
 [   69    29]]`
- Local Outlier Factor: `
[[56743   121]
 [   49    49]]`
