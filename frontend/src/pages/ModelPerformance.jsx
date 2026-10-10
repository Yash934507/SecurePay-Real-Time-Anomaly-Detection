import { Bar, BarChart, CartesianGrid, Legend, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import { FlaskConical, Info } from 'lucide-react'
import { comparisonChartData, evaluation, formatPercent, modelPerformance, performanceMetrics } from '../data/modelPerformance'

const panelClass = 'min-w-0 rounded-lg border border-line/[0.08] bg-panel/90 p-4 shadow-panel sm:p-5'

function ConfusionMatrix({ model }) {
    const { tn, fp, fn, tp } = model.confusion
    return (
        <section aria-label={`${model.shortName} confusion matrix`} className={panelClass}>
            <h4 className="font-display text-base font-semibold text-ink">{model.name}</h4>
            <table className="mt-4 w-full table-fixed border-collapse text-center text-xs">
                <caption className="mb-3 text-left text-xs leading-5 text-muted">Rows: actual dataset label. Columns: model prediction.</caption>
                <thead><tr>
                    <th scope="col" className="p-2 text-muted">Actual / predicted</th>
                    <th scope="col" className="p-2 text-body">Normal</th>
                    <th scope="col" className="p-2 text-body">Suspicious</th>
                </tr></thead>
                <tbody>
                    <tr>
                        <th scope="row" className="p-2 text-body">Normal</th>
                        <td className="border border-teal-200/10 bg-teal-200/5 p-2"><span className="block font-display text-lg text-success">{tn.toLocaleString()}</span><span className="text-muted">True Negative</span></td>
                        <td className="border border-amber-200/10 bg-amber-200/5 p-2"><span className="block font-display text-lg text-warning">{fp.toLocaleString()}</span><span className="text-muted">False Positive</span></td>
                    </tr>
                    <tr>
                        <th scope="row" className="p-2 text-body">Fraud</th>
                        <td className="border border-amber-200/10 bg-amber-200/5 p-2"><span className="block font-display text-lg text-warning">{fn.toLocaleString()}</span><span className="text-muted">False Negative</span></td>
                        <td className="border border-teal-200/10 bg-teal-200/5 p-2"><span className="block font-display text-lg text-success">{tp.toLocaleString()}</span><span className="text-muted">True Positive</span></td>
                    </tr>
                </tbody>
            </table>
        </section>
    )
}

export default function ModelPerformance() {
    return (
        <div className="space-y-7 sm:space-y-9">
            <section aria-labelledby="performance-title" className="border-b border-line/[0.08] pb-7">
                <p className="inline-flex items-center gap-2 rounded-md border border-teal-200/20 bg-teal-200/5 px-3 py-2 text-xs font-semibold text-success"><FlaskConical aria-hidden="true" size={16} />Offline Model Evaluation</p>
                <h2 id="performance-title" className="mt-4 font-display text-3xl font-semibold text-ink sm:text-4xl">Model Performance</h2>
                <p className="mt-3 text-sm leading-6 text-body">Evaluation of anomaly detection models on the held-out test dataset.</p>
                <p className="mt-3 max-w-3xl text-sm leading-6 text-muted">These are saved offline test results, separate from current-session Dashboard statistics. Running analyses or clearing session results does not change this evaluation.</p>
                <p className="mt-4 text-xs leading-6 text-success">{evaluation.testRows.toLocaleString()} test transactions · {evaluation.testFraud} fraud labels · Same held-out test set for both models</p>
            </section>

            <section aria-label="Held-out test metrics" className="grid gap-4 lg:grid-cols-2">
                {modelPerformance.map((model) => (
                    <article key={model.id} className={panelClass}>
                        <h3 className="font-display text-xl font-semibold" style={{ color: (model.id === 'lof' ? 'var(--chart-teal)' : 'var(--chart-sky)') }}>{model.name}</h3>
                        <dl className="mt-5 grid grid-cols-1 gap-4 min-[390px]:grid-cols-3">
                            {performanceMetrics.map(({ key, label }) => (
                                <div key={key}><dt className="text-xs text-muted">{label}</dt><dd className="mt-2 font-display text-2xl font-semibold text-ink">{formatPercent(model[key])}</dd></div>
                            ))}
                        </dl>
                        <p className="mt-4 text-xs leading-5 text-muted">At this model’s saved validation-selected threshold.</p>
                    </article>
                ))}
            </section>

            <section aria-labelledby="comparison-title" className={panelClass}>
                <h3 id="comparison-title" className="font-display text-xl font-semibold text-ink">Precision, recall, and F1-score comparison</h3>
                <p className="mt-2 text-xs leading-6 text-muted">Higher is better for these metrics. Values are formatted as percentages; they are not per-transaction fraud probabilities.</p>
                <div className="mt-5 h-[320px] w-full min-w-0 overflow-hidden" role="img" aria-label="Grouped comparison of test precision, recall, and F1-score. Exact values are provided in the model cards above.">
                    <ResponsiveContainer width="100%" height="100%">
                        <BarChart data={comparisonChartData} margin={{ top: 12, right: 4, left: -16, bottom: 12 }} accessibilityLayer>
                            <CartesianGrid stroke="rgb(var(--line) / 0.15)" strokeDasharray="3 3" vertical={false} />
                            <XAxis dataKey="metric" axisLine={false} tickLine={false} interval={0} tick={{ fill: 'rgb(var(--muted))', fontSize: 11 }} />
                            <YAxis domain={[0, 1]} ticks={[0, 0.25, 0.5, 0.75, 1]} tickFormatter={(value) => `${value * 100}%`} axisLine={false} tickLine={false} tick={{ fill: 'rgb(var(--muted))', fontSize: 10 }} />
                            <Tooltip formatter={(value, name) => [formatPercent(value), name]} cursor={{ fill: 'rgba(148,163,184,0.08)' }} contentStyle={{ background: 'rgb(var(--table))', border: '1px solid rgb(var(--line) / 0.2)', borderRadius: 6, color: 'rgb(var(--ink))' }} />
                            <Legend wrapperStyle={{ fontSize: 12 }} />
                            {modelPerformance.map((model) => <Bar key={model.id} dataKey={model.id} name={model.shortName} fill={(model.id === 'lof' ? 'var(--chart-teal)' : 'var(--chart-sky)')} radius={[4, 4, 0, 0]} maxBarSize={60} isAnimationActive={false} />)}
                        </BarChart>
                    </ResponsiveContainer>
                </div>
                <dl className="mt-4 grid gap-4 border-t border-line/10 pt-4 sm:grid-cols-3">
                    {performanceMetrics.map(({ key, label, definition }) => <div key={key}><dt className="text-sm font-semibold text-body">{label}</dt><dd className="mt-1 text-xs leading-6 text-muted">{definition}</dd></div>)}
                </dl>
            </section>

            <section aria-labelledby="matrices-title">
                <h3 id="matrices-title" className="font-display text-xl font-semibold text-ink">Test confusion matrices</h3>
                <p className="mt-2 text-xs leading-6 text-muted">Positive means flagged Suspicious; fraud refers to the dataset’s actual label. A Suspicious prediction is not confirmation of fraud.</p>
                <div className="mt-4 grid gap-4 lg:grid-cols-2">{modelPerformance.map((model) => <ConfusionMatrix key={model.id} model={model} />)}</div>
            </section>

            <section aria-labelledby="recommendation-title" className="rounded-lg border border-teal-200/20 bg-teal-200/[0.05] p-5">
                <h3 id="recommendation-title" className="font-display text-xl font-semibold text-success">Current preferred model: LOF</h3>
                <p className="mt-3 text-sm leading-7 text-body">The report selected LOF for further evaluation based on its higher validation F1. LOF also achieved higher precision, recall, and F1-score on the held-out test set. It detected 49 of 98 fraud-labeled transactions, compared with 29 for Isolation Forest, while producing 121 false positives compared with 104.</p>
                <p className="mt-3 text-sm leading-7 text-muted">This does not make LOF universally superior. It missed half of the fraud-labeled test transactions, and most flagged transactions were normal. Performance may differ on new datasets; these results do not establish reliable fraud prevention.</p>
            </section>

            <section aria-labelledby="model-information-title">
                <h3 id="model-information-title" className="font-display text-xl font-semibold text-ink">How the models work</h3>
                <div className="mt-4 grid gap-4 lg:grid-cols-2">
                    {modelPerformance.map((model) => <article key={model.id} className={panelClass}>
                        <h4 className="font-semibold text-body">{model.name}</h4>
                        <p className="mt-3 text-sm leading-7 text-muted">{model.description}</p>
                        <p className="mt-3 text-sm leading-7 text-muted">{model.trainingDescription}</p>
                        <p className="mt-3 text-xs leading-6 text-body">Uses a saved anomaly threshold of <span className="font-mono">{model.threshold.toFixed(6)}</span> (rounded for display). Scores at or above the saved threshold are flagged Suspicious.</p>
                    </article>)}
                </div>
                <p className="mt-4 text-sm leading-7 text-muted">The models can disagree because Isolation Forest looks for records that are easy to isolate through random splits, while LOF compares each record with nearby examples. They learn different patterns and use different score scales and thresholds; their raw anomaly scores are not directly comparable.</p>
            </section>

            <section aria-labelledby="methodology-title" className={panelClass}>
                <h3 id="methodology-title" className="font-display text-xl font-semibold text-ink">Evaluation methodology</h3>
                <ol className="mt-4 list-decimal space-y-3 pl-5 text-sm leading-7 text-muted">
                    <li><strong className="text-body">Stratified split.</strong> The {evaluation.datasetRows.toLocaleString()} transactions were split approximately 60% / 20% / 20% into training ({evaluation.trainRows.toLocaleString()}), validation ({evaluation.validationRows.toLocaleString()}), and test ({evaluation.testRows.toLocaleString()}) sets, preserving class proportions with random seed {evaluation.randomState}.</li>
                    <li><strong className="text-body">Training-only preprocessing.</strong> RobustScaler was fitted on the training split’s Amount column before filtering to normal transactions. The same scaler transforms validation and test Amount values; the 28 precomputed PCA features remain unchanged.</li>
                    <li><strong className="text-body">Normal-only model training.</strong> Neither detector was fitted on fraud-labeled rows. LOF used a capped sample of normal training rows for computational efficiency.</li>
                    <li><strong className="text-body">Validation-based thresholds.</strong> Each cutoff maximized F1 using validation labels and anomaly scores. Test labels were not used to select the thresholds.</li>
                    <li><strong className="text-body">Held-out evaluation.</strong> The selected thresholds were applied to the untouched test split. The saved confusion counts determine the metrics shown here.</li>
                </ol>
                <div className="mt-5 flex items-start gap-3 rounded-md border border-amber-200/15 bg-amber-200/5 p-4">
                    <Info aria-hidden="true" size={18} className="mt-1 shrink-0 text-warning" />
                    <p className="text-sm leading-7 text-body">Fraud is rare: only {evaluation.datasetFraud} of {evaluation.datasetRows.toLocaleString()} dataset rows carry a fraud label. In the test set, {evaluation.testFraud} of {evaluation.testRows.toLocaleString()} rows are fraud-labeled ({formatPercent(evaluation.testFraud / evaluation.testRows)}). Predicting every test row as normal would achieve {formatPercent(1 - evaluation.testFraud / evaluation.testRows)} accuracy while detecting no fraud. Precision and recall make that failure visible.</p>
                </div>
                <p className="mt-4 text-xs leading-6 text-muted">This random split is a baseline. The report recommends evaluation on a later time period before deployment; it does not establish future performance.</p>
            </section>
            <footer className="text-xs leading-6 text-muted">Source: saved project performance analysis report and notebook evaluation outputs; thresholds and preprocessing verified against saved model metadata. Metrics use exact confusion counts and are rounded to two decimal places as percentages. This static snapshot does not update from session predictions.</footer>
        </div>
    )
}
