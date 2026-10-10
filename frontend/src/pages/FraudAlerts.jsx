import { useEffect, useRef, useState } from 'react'
import { BellRing, Info, Search, X } from 'lucide-react'
import { useAnalysis } from '../context/AnalysisContext'
import { MAX_RECENT_SUSPICIOUS } from '../context/analysisState'

const MODEL_LABELS = { lof: 'LOF', isolation_forest: 'Isolation Forest' }
const fieldClass = 'mt-2 min-h-11 w-full rounded-md border border-line/15 bg-field px-3 text-sm text-body'
const formatTime = (value) => new Date(value).toLocaleString()

function AlertDetails({ alert, onClose }) {
    const dialogRef = useRef(null)

    useEffect(() => {
        const dialog = dialogRef.current
        dialog.showModal()
        return () => dialog.close()
    }, [])

    const fields = [
        ['Prediction status', 'Suspicious'],
        ['Model used', MODEL_LABELS[alert.selectedModel] ?? alert.selectedModel],
        ['Anomaly score', String(alert.anomalyScore)],
        ['Source', alert.source],
        ['Analysis time', formatTime(alert.analysisTime)],
        ['Reference', alert.reference ?? 'Not available'],
    ]

    return (
        <dialog ref={dialogRef} aria-labelledby="alert-details-title" onCancel={(event) => { event.preventDefault(); onClose() }}
            onKeyDown={(event) => { if (event.key === 'Escape') { event.preventDefault(); onClose() } }}
            className="fixed inset-0 m-auto max-h-[85vh] w-[calc(100%-2rem)] max-w-lg overflow-y-auto rounded-lg border border-teal-200/20 bg-panel p-5 text-body shadow-panel backdrop:bg-slate-950/80 sm:p-6">
            <div className="flex items-center justify-between gap-4">
                <h3 id="alert-details-title" className="font-display text-xl font-semibold text-ink">Alert details</h3>
                <button autoFocus type="button" aria-label="Close alert details" onClick={onClose}
                    className="flex h-10 w-10 shrink-0 items-center justify-center rounded-md border border-line/10 hover:bg-wash/5">
                    <X aria-hidden="true" size={18} />
                </button>
            </div>
            <dl className="mt-5 divide-y divide-line/10">
                {fields.map(([label, value]) => (
                    <div key={label} className="grid gap-1 py-3 text-sm sm:grid-cols-2 sm:gap-4">
                        <dt className="text-muted">{label}</dt>
                        <dd className="break-words font-medium">{value}</dd>
                    </div>
                ))}
            </dl>
            <p className="mt-5 text-xs leading-6 text-muted">An anomaly score is a model output, not a fraud probability. This prediction is not a confirmed case of fraud.</p>
        </dialog>
    )
}

export default function FraudAlerts() {
    const { suspiciousPredictions, recentSuspicious } = useAnalysis()
    const [model, setModel] = useState('all')
    const [source, setSource] = useState('all')
    const [search, setSearch] = useState('')
    const [selectedAlert, setSelectedAlert] = useState(null)
    // Keep details tied to a retained object, so clearing or eviction cannot leave stale details.
    const activeAlert = recentSuspicious.includes(selectedAlert) ? selectedAlert : null
    const query = search.trim().toLowerCase()
    const filteredAlerts = recentSuspicious.filter((alert) => (
        (model === 'all' || alert.selectedModel === model)
        && (source === 'all' || alert.source === source)
        && (!query || String(alert.reference ?? '').toLowerCase().includes(query))
    ))
    const metrics = [
        ['Total Suspicious Predictions in Current Session', suspiciousPredictions, 'Aggregate count across all successful session analyses.'],
        ['Recent Suspicious Entries Retained', recentSuspicious.length, `Up to ${MAX_RECENT_SUSPICIOUS} entries; not the complete session history.`],
        ['LOF Suspicious Entries Retained', recentSuspicious.filter((alert) => alert.selectedModel === 'lof').length, 'LOF entries in the retained history.'],
        ['Isolation Forest Suspicious Entries Retained', recentSuspicious.filter((alert) => alert.selectedModel === 'isolation_forest').length, 'Isolation Forest entries in the retained history.'],
    ]

    function resetFilters() {
        setModel('all')
        setSource('all')
        setSearch('')
    }

    return (
        <div className="space-y-7 sm:space-y-9">
            <section aria-labelledby="fraud-alerts-title" className="border-b border-line/[0.08] pb-7">
                <p className="flex items-center gap-2 text-[11px] font-semibold uppercase tracking-[0.18em] text-success">
                    <BellRing aria-hidden="true" size={16} /> Current session
                </p>
                <h2 id="fraud-alerts-title" className="mt-3 font-display text-3xl font-semibold text-ink sm:text-4xl">Fraud Alerts</h2>
                <p className="mt-3 text-sm leading-6 text-muted">Suspicious transaction predictions recorded during the current session.</p>
                <div className="mt-5 flex items-start gap-3 rounded-md border border-teal-200/15 bg-teal-200/[0.05] p-4 text-sm leading-6 text-body">
                    <Info aria-hidden="true" size={18} className="mt-1 shrink-0 text-success" />
                    <p>These alerts indicate unusual transaction patterns detected by machine learning. They are not confirmed cases of fraud.</p>
                </div>
            </section>

            <section aria-label="Suspicious prediction summary" className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
                {metrics.map(([title, value, description]) => (
                    <article key={title} className="rounded-lg border border-line/[0.08] bg-panel/90 p-5 shadow-panel">
                        <h3 className="text-sm font-semibold leading-6 text-body">{title}</h3>
                        <p className="mt-4 font-display text-3xl font-semibold text-warning">{value.toLocaleString()}</p>
                        <p className="mt-3 text-xs leading-5 text-muted">{description}</p>
                    </article>
                ))}
            </section>

            <section aria-labelledby="retained-alerts-title" className="min-w-0 overflow-hidden rounded-lg border border-line/[0.08] bg-panel/90 shadow-panel">
                <div className="space-y-5 border-b border-line/[0.08] p-4 sm:p-5">
                    <div>
                        <h3 id="retained-alerts-title" className="font-display text-lg font-semibold text-ink">Retained suspicious predictions</h3>
                        <p className="mt-2 text-xs leading-6 text-muted">Only the most recent retained entries (up to {MAX_RECENT_SUSPICIOUS}) are available here. Filters and search apply to these entries only. Analysis times use your local timezone.</p>
                    </div>
                    <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-[1fr_1fr_2fr]">
                        <label className="text-xs font-medium text-body">Model
                            <select className={fieldClass} value={model} onChange={(event) => setModel(event.target.value)}>
                                <option value="all">All models</option><option value="lof">LOF</option><option value="isolation_forest">Isolation Forest</option>
                            </select>
                        </label>
                        <label className="text-xs font-medium text-body">Source
                            <select className={fieldClass} value={source} onChange={(event) => setSource(event.target.value)}>
                                <option value="all">All sources</option><option>Single</option><option>CSV Batch</option><option>Simulation</option>
                            </select>
                        </label>
                        <label className="text-xs font-medium text-body sm:col-span-2 xl:col-span-1">Search references
                            <span className="relative block">
                                <Search aria-hidden="true" size={16} className="absolute left-3 top-3.5 text-muted" />
                                <input type="search" className={`${fieldClass} pl-10`} placeholder="Transaction or CSV row reference" value={search} onChange={(event) => setSearch(event.target.value)} />
                            </span>
                        </label>
                    </div>
                    <div className="flex flex-wrap items-center justify-between gap-3 text-xs">
                        <p role="status" className="text-muted">Showing {filteredAlerts.length} of {recentSuspicious.length} retained entries</p>
                        <button type="button" onClick={resetFilters} className="min-h-9 rounded-md border border-line/10 px-3 text-success hover:bg-wash/5">Reset filters</button>
                    </div>
                </div>
                {filteredAlerts.length > 0 ? (
                    <div className="overflow-x-auto">
                        <table className="w-full min-w-[820px] border-collapse text-left text-xs">
                            <caption className="sr-only">Retained suspicious predictions. Use View details to inspect an alert.</caption>
                            <thead className="bg-table text-muted">
                                <tr>{['Analysis time', 'Source', 'Reference', 'Model', 'Anomaly score', 'Status', 'Details'].map((label) => <th key={label} scope="col" className="px-4 py-3 font-semibold">{label}</th>)}</tr>
                            </thead>
                            <tbody className="divide-y divide-line/[0.06]">
                                {filteredAlerts.map((alert) => (
                                    <tr key={alert.id} onClick={() => setSelectedAlert(alert)} className="cursor-pointer text-body transition hover:bg-teal-200/[0.04] focus-within:bg-teal-200/[0.04]">
                                        <td className="px-4 py-4"><time dateTime={alert.analysisTime}>{formatTime(alert.analysisTime)}</time></td>
                                        <td className="px-4 py-4">{alert.source}</td>
                                        <td className="px-4 py-4">{alert.reference ?? 'Not available'}</td>
                                        <td className="px-4 py-4">{MODEL_LABELS[alert.selectedModel] ?? alert.selectedModel}</td>
                                        <td className="px-4 py-4 font-mono">{alert.anomalyScore.toFixed(6)}</td>
                                        <td className="px-4 py-4"><span className="rounded border border-amber-200/15 bg-amber-200/5 px-2 py-1 text-warning">Suspicious</span></td>
                                        <td className="px-4 py-4"><button type="button" onClick={(event) => { event.stopPropagation(); setSelectedAlert(alert) }} className="min-h-9 whitespace-nowrap rounded px-2 text-success hover:bg-wash/5" aria-label={`View details for ${alert.source}, ${alert.reference ?? 'no reference'}, ${formatTime(alert.analysisTime)}`}>View details</button></td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                ) : (
                    <div className="px-5 py-14 text-center">
                        <BellRing aria-hidden="true" className="mx-auto text-muted" size={24} />
                        <h4 className="mt-4 font-medium text-body">{recentSuspicious.length === 0 ? 'No suspicious predictions in this session' : 'No matching alerts'}</h4>
                        <p className="mx-auto mt-2 max-w-md text-sm leading-6 text-muted">{recentSuspicious.length === 0 ? 'Suspicious results from Single, CSV Batch, and Simulation analyses will appear automatically.' : 'Try a different model, source, or reference, or reset the filters.'}</p>
                    </div>
                )}
            </section>
            <p className="text-xs leading-6 text-muted">Alerts are held in memory for this session. Navigation preserves them; refreshing the browser or using Clear Session Results on the Dashboard removes them.</p>
            {activeAlert && <AlertDetails alert={activeAlert} onClose={() => setSelectedAlert(null)} />}
        </div>
    )
}
