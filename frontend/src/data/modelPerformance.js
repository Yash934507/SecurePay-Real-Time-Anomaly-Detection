// Sources: performance_analysis_report.md (Model comparison and Confusion matrices),
// real_time_anomaly_detection.ipynb (saved outputs of cells at indices 7, 9, 11),
// models/metadata.json (saved thresholds and preprocessing).
// Metrics are calculated from the exact saved test counts, not rounded report metrics.
// This is a static offline evaluation snapshot, independent of AnalysisContext.
export const evaluation = {
    datasetRows: 284807,
    datasetFraud: 492,
    trainRows: 170883,
    validationRows: 56962,
    testRows: 56962,
    testFraud: 98,
    randomState: 42,
}

function withMetrics(model) {
    const { tp, fp, fn } = model.confusion
    return {
        ...model,
        precision: tp / (tp + fp),
        recall: tp / (tp + fn),
        f1: 2 * tp / (2 * tp + fp + fn),
    }
}

export const modelPerformance = [
    withMetrics({
        id: 'isolation_forest',
        name: 'Isolation Forest',
        shortName: 'Isolation Forest',
        color: '#7dd3fc',
        trainingRows: 170588,
        threshold: 0.647690607885569,
        confusion: { tn: 56760, fp: 104, fn: 69, tp: 29 },
        description: 'Detects unusual observations using random partitioning. Transactions that are easier to isolate receive higher anomaly scores.',
        trainingDescription: 'Trained on all 170,588 normal training transactions using 300 trees.',
    }),
    withMetrics({
        id: 'lof',
        name: 'Local Outlier Factor (LOF)',
        shortName: 'LOF',
        color: '#70d5be',
        trainingRows: 50000,
        threshold: 3.1168357873545602,
        confusion: { tn: 56743, fp: 121, fn: 49, tp: 49 },
        description: 'Detects observations with unusually low local density compared with their neighbors. Novelty detection is enabled to score unseen transactions.',
        trainingDescription: 'Trained on a reproducible sample of 50,000 normal training transactions, using 20 neighbors.',
    }),
]

export const performanceMetrics = [
    { key: 'precision', label: 'Precision', definition: 'Of the transactions flagged Suspicious, the share labeled fraud in the test dataset.' },
    { key: 'recall', label: 'Recall', definition: 'Of the fraud-labeled test transactions, the share flagged Suspicious.' },
    { key: 'f1', label: 'F1-score', definition: 'The harmonic mean of precision and recall, balancing both measures.' },
]

export const comparisonChartData = performanceMetrics.map(({ key, label }) => ({
    metric: label,
    ...Object.fromEntries(modelPerformance.map((model) => [model.id, model[key]])),
}))

export const formatPercent = (value) => `${(value * 100).toFixed(2)}%`
