import { useState } from 'react'
import {
    AlertCircle,
    ArrowUpFromLine,
    CheckCircle2,
    FileSpreadsheet,
    LoaderCircle,
    ShieldAlert,
} from 'lucide-react'
import { analyzeBatchCsv } from '../services/api'
import { useAnalysis } from '../context/AnalysisContext'
import { usePreferences } from '../context/PreferencesContext'

const MODEL_LABELS = {
    lof: 'Local Outlier Factor (LOF)',
    isolation_forest: 'Isolation Forest',
}

function SummaryCard({ title, value, detail, tone = 'text-body' }) {
    return (
        <article className="rounded-md border border-line/[0.08] bg-field p-3.5 sm:p-4">
            <p className="text-[10px] font-semibold uppercase tracking-[0.12em] text-muted">{title}</p>
            <p className={`mt-2 font-display text-2xl font-semibold ${tone}`}>{value}</p>
            <p className="mt-1 text-[11px] leading-5 text-muted">{detail}</p>
        </article>
    )
}

export default function BatchAnalysis() {
    const { recordBatchAnalysis } = useAnalysis()
    const [file, setFile] = useState(null)
    const { defaultModel } = usePreferences()
    const [model, setModel] = useState(defaultModel)
    const [result, setResult] = useState(null)
    const [error, setError] = useState('')
    const [isSubmitting, setIsSubmitting] = useState(false)

    function clearResult() {
        setResult(null)
        setError('')
    }

    function handleFileChange(event) {
        const selectedFile = event.target.files?.[0] || null
        clearResult()

        if (selectedFile && !selectedFile.name.toLowerCase().endsWith('.csv')) {
            setFile(null)
            setError('Choose a CSV file with a .csv extension.')
            event.target.value = ''
            return
        }

        setFile(selectedFile)
    }

    async function handleSubmit(event) {
        event.preventDefault()
        clearResult()

        if (!file) {
            setError('Select a CSV file before starting batch analysis.')
            return
        }

        setIsSubmitting(true)
        try {
            const response = await analyzeBatchCsv(file, model)
            recordBatchAnalysis(response)
            setResult(response)
        } catch (requestError) {
            setError(requestError.message || 'The batch analysis request failed. Please try again.')
        } finally {
            setIsSubmitting(false)
        }
    }

    const formattedSize = file ? `${(file.size / (1024 * 1024)).toFixed(2)} MiB` : ''

    return (
        <section aria-labelledby="csv-batch-title" className="rounded-lg border border-line/[0.08] bg-panel/90 p-4 shadow-panel sm:p-6">
            <div className="flex items-start gap-3 border-b border-line/[0.07] pb-4">
                <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-md border border-sky-300/15 bg-sky-300/10 text-info">
                    <FileSpreadsheet aria-hidden="true" size={17} />
                </span>
                <div>
                    <h3 id="csv-batch-title" className="font-display text-base font-semibold text-ink">CSV Batch Analysis</h3>
                    <p className="mt-1 text-xs leading-5 text-muted">
                        Analyze multiple transactions with the selected saved model.
                    </p>
                </div>
            </div>

            <div className="mt-4 grid gap-3 md:grid-cols-2">
                <div className="rounded-md border border-teal-200/10 bg-teal-200/[0.035] p-3.5">
                    <p className="text-xs font-semibold text-success">Required columns</p>
                    <p className="mt-1.5 text-xs leading-5 text-muted">
                        Include V1 through V28 and Amount. Other columns, including Time and Class, are ignored for prediction.
                    </p>
                    <p className="mt-2 overflow-x-auto whitespace-nowrap rounded bg-black/15 px-2 py-1.5 font-mono text-[10px] text-body">
                        V1, V2, ..., V28, Amount
                    </p>
                </div>
                <div className="rounded-md border border-amber-200/10 bg-amber-200/[0.035] p-3.5">
                    <p className="flex items-center gap-2 text-xs font-semibold text-warning">
                        <ShieldAlert aria-hidden="true" size={15} />
                        Experimental anomaly screening
                    </p>
                    <p className="mt-1.5 text-xs leading-5 text-muted">
                        V1–V28 must already be computed in the trained dataset’s PCA feature space. A Suspicious result is an anomaly signal, not a confirmed fraud determination.
                    </p>
                    <p className="mt-2 text-[10px] leading-4 text-muted">Default server limits: 5 MiB and 10,000 data rows.</p>
                </div>
            </div>

            <form className="mt-5 grid gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(220px,0.55fr)_auto] lg:items-end" onSubmit={handleSubmit}>
                <div>
                    <label className="mb-2 block text-xs font-medium text-body" htmlFor="batch-csv-file">CSV file</label>
                    <input
                        accept=".csv,text/csv"
                        className="block min-h-11 w-full rounded-md border border-line/[0.12] bg-field text-xs text-body file:mr-3 file:min-h-11 file:border-0 file:border-r file:border-solid file:border-line/10 file:bg-wash/[0.045] file:px-3 file:text-xs file:font-semibold file:text-success hover:file:bg-wash/[0.08] focus:outline-none focus:ring-1 focus:ring-teal-300/60"
                        disabled={isSubmitting}
                        id="batch-csv-file"
                        onChange={handleFileChange}
                        type="file"
                    />
                    {file ? (
                        <p className="mt-1.5 break-all text-[11px] text-muted" role="status">{file.name} · {formattedSize}</p>
                    ) : (
                        <p className="mt-1.5 text-[11px] text-muted">The upload is processed temporarily and is not saved.</p>
                    )}
                </div>

                <div>
                    <label className="mb-2 block text-xs font-medium text-body" htmlFor="batch-model-selection">Detection model</label>
                    <select
                        className="min-h-11 w-full rounded-md border border-line/[0.12] bg-field px-3 text-sm text-body outline-none transition focus:border-teal-300/60"
                        disabled={isSubmitting}
                        id="batch-model-selection"
                        onChange={(event) => {
                            setModel(event.target.value)
                            clearResult()
                        }}
                        value={model}
                    >
                        <option value="lof">Local Outlier Factor (LOF)</option>
                        <option value="isolation_forest">Isolation Forest</option>
                    </select>
                </div>

                <button
                    className="inline-flex min-h-11 items-center justify-center gap-2 rounded-md border border-teal-200/20 bg-teal-300 px-4 text-sm font-semibold text-[#062029] transition hover:bg-teal-200 disabled:cursor-not-allowed disabled:opacity-50"
                    disabled={!file || isSubmitting}
                    type="submit"
                >
                    {isSubmitting ? <LoaderCircle aria-hidden="true" className="animate-spin" size={17} /> : <ArrowUpFromLine aria-hidden="true" size={17} />}
                    {isSubmitting ? 'Analyzing CSV…' : 'Analyze CSV'}
                </button>
            </form>

            {error && (
                <div className="mt-4 flex gap-2.5 rounded-md border border-rose-300/20 bg-rose-300/[0.06] p-3.5 text-xs leading-5 text-danger" role="alert">
                    <AlertCircle aria-hidden="true" className="mt-0.5 shrink-0" size={15} />
                    <p>{error}</p>
                </div>
            )}

            {isSubmitting && (
                <div className="mt-5 flex items-center gap-2 text-xs text-muted" role="status">
                    <LoaderCircle aria-hidden="true" className="animate-spin text-success" size={15} />
                    Waiting for the batch prediction response…
                </div>
            )}

            {result && (
                <div className="mt-6 border-t border-line/[0.07] pt-5">
                    <div className="flex flex-wrap items-end justify-between gap-3">
                        <div>
                            <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-muted">Batch response</p>
                            <h4 className="mt-1.5 font-display text-base font-semibold text-ink">{MODEL_LABELS[result.selected_model]}</h4>
                        </div>
                        <p className="text-[11px] text-muted">Suspicious means anomalous, not confirmed fraud.</p>
                    </div>

                    <div className="mt-4 grid grid-cols-2 gap-2.5 xl:grid-cols-4">
                        <SummaryCard title="Total Transactions" value={result.total_transactions.toLocaleString()} detail="Rows analyzed" />
                        <SummaryCard title="Normal Transactions" value={result.normal_transactions.toLocaleString()} detail="Below the saved threshold" tone="text-success" />
                        <SummaryCard title="Suspicious Transactions" value={result.suspicious_transactions.toLocaleString()} detail="At or above the saved threshold" tone="text-warning" />
                        <SummaryCard title="Suspicious Rate" value={`${(result.suspicious_rate * 100).toFixed(2)}%`} detail="Share of uploaded rows" tone="text-info" />
                    </div>

                    <div className="mt-4 overflow-hidden rounded-md border border-line/[0.08]">
                        <div className="border-b border-line/[0.07] bg-field px-3 py-2.5">
                            <h5 className="text-xs font-semibold text-body">Row results</h5>
                            <p className="mt-1 text-[10px] text-muted">Row number starts at 1 for the first data row after the CSV header. Raw feature values are not displayed.</p>
                        </div>
                        <div className="max-h-[430px] overflow-auto">
                            <table className="min-w-[620px] w-full border-collapse text-left text-xs">
                                <thead className="sticky top-0 z-10 bg-table text-[10px] uppercase tracking-[0.1em] text-muted">
                                    <tr>
                                        <th className="px-3 py-3 font-semibold">CSV row</th>
                                        <th className="px-3 py-3 font-semibold">Prediction</th>
                                        <th className="px-3 py-3 text-right font-semibold">Anomaly score</th>
                                        <th className="px-3 py-3 text-right font-semibold">Threshold</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-line/[0.06]">
                                    {result.results.map((row) => (
                                        <tr className="hover:bg-wash/[0.025]" key={row.row_number}>
                                            <td className="px-3 py-3 font-mono text-muted">{row.row_number}</td>
                                            <td className="px-3 py-3">
                                                <span className={`inline-flex items-center gap-1.5 font-medium ${row.is_anomaly ? 'text-warning' : 'text-success'}`}>
                                                    {row.is_anomaly ? <ShieldAlert aria-hidden="true" size={14} /> : <CheckCircle2 aria-hidden="true" size={14} />}
                                                    {row.prediction}
                                                </span>
                                            </td>
                                            <td className="px-3 py-3 text-right font-mono text-body">{row.anomaly_score.toFixed(6)}</td>
                                            <td className="px-3 py-3 text-right font-mono text-muted">{row.threshold.toFixed(6)}</td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    </div>
                </div>
            )}
        </section>
    )
}
