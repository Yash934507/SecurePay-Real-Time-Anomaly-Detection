import { lazy, Suspense } from 'react'
import {
    Activity,
    BellRing,
    CheckCircle2,
    Fingerprint,
    Info,
    Percent,
    ScanSearch,
    ShieldAlert,
    Trash2,
} from 'lucide-react'
import { useAnalysis } from '../context/AnalysisContext'

const SessionCharts = lazy(() => import('../components/SessionCharts'))

const models = [
    {
        name: 'Isolation Forest',
        shortName: 'IF',
        icon: ScanSearch,
        description:
            'Finds unusual transactions by identifying records that can be isolated quickly from the normal pattern.',
        tone: 'text-info bg-sky-300/10 border-sky-300/15',
    },
    {
        name: 'Local Outlier Factor (LOF)',
        shortName: 'LOF',
        icon: Fingerprint,
        description:
            'Compares each transaction with nearby records and highlights points in unusually sparse local areas.',
        tone: 'text-success bg-teal-300/10 border-teal-300/15',
    },
]

function MetricCard({ title, value, description, icon: Icon, tone }) {
    return (
        <article className="rounded-lg border border-line/[0.08] bg-panel/90 p-4 shadow-panel sm:p-5">
            <div className="flex items-center justify-between gap-3">
                <h3 className="text-xs font-semibold leading-5 text-body sm:text-sm">{title}</h3>
                <span className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-md border ${tone}`}>
                    <Icon aria-hidden="true" size={17} strokeWidth={1.8} />
                </span>
            </div>
            <p className="mt-5 font-display text-3xl font-semibold leading-none text-ink">{value}</p>
            <p className="mt-3 min-h-10 text-xs leading-5 text-muted">{description}</p>
        </article>
    )
}

function formatAnalysisTime(isoTime) {
    return new Date(isoTime).toLocaleString()
}

export default function Dashboard() {
    const {
        totalAnalyzed,
        normalPredictions,
        suspiciousPredictions,
        suspiciousRate,
        activity,
        recentSuspicious,
        clearAnalysisResults,
    } = useAnalysis()

    function handleClearSession() {
        const confirmed = window.confirm(
            'Clear all analysis results from this browser session? This clears only dashboard counters, charts, and recent suspicious activity.',
        )
        if (confirmed) clearAnalysisResults()
    }

    const metrics = [
        {
            title: 'Total Transactions Analyzed',
            value: totalAnalyzed.toLocaleString(),
            description: 'Successful analysis results in this session.',
            icon: Activity,
            tone: 'text-info bg-sky-300/10 border-sky-300/15',
        },
        {
            title: 'Normal Predictions',
            value: normalPredictions.toLocaleString(),
            description: 'Below the selected model thresholds.',
            icon: CheckCircle2,
            tone: 'text-success bg-teal-300/10 border-teal-300/15',
        },
        {
            title: 'Suspicious Predictions',
            value: suspiciousPredictions.toLocaleString(),
            description: 'Anomalies returned by the selected models.',
            icon: ShieldAlert,
            tone: 'text-warning bg-amber-300/10 border-amber-300/15',
        },
        {
            title: 'Suspicious Rate',
            value: totalAnalyzed > 0 ? `${suspiciousRate.toFixed(2)}%` : '—',
            description: 'Session suspicious predictions ÷ analyzed.',
            icon: Percent,
            tone: 'text-info bg-cyan-300/10 border-cyan-300/15',
        },
    ]

    return (
        <div className="space-y-7 sm:space-y-9">
            <section
                aria-labelledby="dashboard-title"
                className="flex flex-col justify-between gap-6 border-b border-line/[0.08] pb-7 sm:pb-8 lg:flex-row lg:items-end"
            >
                <div className="max-w-3xl">
                    <p className="flex items-center gap-2 text-[10px] font-semibold uppercase tracking-[0.18em] text-success sm:text-[11px]">
                        <span aria-hidden="true" className="h-px w-6 bg-teal-300" />
                        Financial security overview
                    </p>
                    <h2 id="dashboard-title" className="mt-3 font-display text-3xl font-semibold leading-tight text-ink sm:text-4xl">
                        SecurePay Dashboard
                    </h2>
                    <p className="mt-2 font-display text-base leading-7 text-body sm:text-lg">
                        Intelligent Financial Transaction Anomaly Detection
                    </p>
                    <p className="mt-4 max-w-2xl text-sm leading-6 text-muted">
                        Session-only results from successful SecurePay analyses. These exploratory model outputs are anomaly signals, not confirmed fraud determinations or production banking statistics.
                    </p>
                </div>

                <div className="flex shrink-0 items-center gap-3 self-start rounded-lg border border-teal-200/15 bg-teal-200/[0.05] px-4 py-3 lg:self-auto">
                    <span aria-hidden="true" className="h-2 w-2 rounded-full bg-teal-300" />
                    <div>
                        <p className="text-[10px] font-semibold uppercase tracking-[0.12em] text-success">Dashboard scope</p>
                        <p className="mt-1 text-xs font-semibold text-success sm:text-sm">Current Session</p>
                    </div>
                </div>
            </section>

            <section aria-label="Current session prediction metrics">
                <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
                    <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-muted">Current Session</p>
                    <button
                        className="inline-flex min-h-9 items-center gap-2 rounded-md border border-line/[0.1] px-3 text-xs font-medium text-muted transition hover:border-rose-200/20 hover:text-danger disabled:cursor-not-allowed disabled:opacity-40"
                        disabled={totalAnalyzed === 0}
                        onClick={handleClearSession}
                        type="button"
                    >
                        <Trash2 aria-hidden="true" size={14} />
                        Clear Session Results
                    </button>
                </div>
                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
                    {metrics.map((metric) => <MetricCard key={metric.title} {...metric} />)}
                </div>
                {totalAnalyzed === 0 && (
                    <p className="mt-3 text-xs text-muted">No successful analyses in this browser session yet. Results are held in memory and reset on refresh.</p>
                )}
            </section>

            <Suspense fallback={<p className="text-xs text-muted" role="status">Loading session charts…</p>}>
                <SessionCharts
                    activity={activity}
                    normalPredictions={normalPredictions}
                    suspiciousPredictions={suspiciousPredictions}
                    totalAnalyzed={totalAnalyzed}
                />
            </Suspense>

            <section aria-labelledby="alerts-title" className="rounded-lg border border-line/[0.08] bg-panel/90 p-4 shadow-panel sm:p-5">
                <div className="flex flex-wrap items-center justify-between gap-3 border-b border-line/[0.07] pb-4">
                    <div className="flex items-center gap-3">
                        <span className="flex h-9 w-9 items-center justify-center rounded-md border border-amber-300/15 bg-amber-300/10 text-warning">
                            <BellRing aria-hidden="true" size={17} strokeWidth={1.8} />
                        </span>
                        <div>
                            <h3 id="alerts-title" className="font-display text-base font-semibold text-ink">Recent Suspicious Activity</h3>
                            <p className="mt-1 text-xs text-muted">Anomaly signals only; not confirmed fraud.</p>
                        </div>
                    </div>
                    <span className="rounded-md border border-line/[0.08] px-2.5 py-1 text-[10px] font-medium uppercase tracking-[0.1em] text-muted">
                        Latest {recentSuspicious.length} of up to 20
                    </span>
                </div>
                {recentSuspicious.length > 0 ? (
                    <ul className="mt-3 divide-y divide-line/[0.06]">
                        {recentSuspicious.map((item) => (
                            <li className="flex flex-col gap-2 py-3 sm:flex-row sm:items-center sm:justify-between" key={item.id}>
                                <div className="flex min-w-0 items-start gap-3">
                                    <span className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-md border border-amber-200/15 bg-amber-200/[0.06] text-warning">
                                        <ShieldAlert aria-hidden="true" size={15} />
                                    </span>
                                    <div className="min-w-0">
                                        <p className="text-xs font-semibold text-warning">Suspicious · {item.source}</p>
                                        <p className="mt-1 text-[11px] text-muted">{item.reference || 'Single transaction'} · {item.selectedModel}</p>
                                        <p className="mt-1 text-[10px] text-muted">Analysis time: {formatAnalysisTime(item.analysisTime)}</p>
                                    </div>
                                </div>
                                <div className="pl-11 sm:pl-0 sm:text-right">
                                    <p className="font-mono text-xs text-body">Score {item.anomalyScore.toFixed(6)}</p>
                                    <p className="mt-1 text-[10px] text-muted">Anomaly result, not confirmed fraud</p>
                                </div>
                            </li>
                        ))}
                    </ul>
                ) : (
                    <div className="flex min-h-[118px] flex-col items-center justify-center px-3 py-6 text-center">
                        <Info aria-hidden="true" className="text-muted" size={18} />
                        <p className="mt-2 text-sm text-muted">No suspicious predictions in this session.</p>
                        <p className="mt-1 text-[11px] text-muted">Only Suspicious results returned by the prediction API appear here.</p>
                    </div>
                )}
            </section>

            <section aria-labelledby="models-title">
                <div className="flex flex-wrap items-end justify-between gap-3">
                    <div>
                        <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-muted">Existing machine learning</p>
                        <h3 id="models-title" className="mt-2 font-display text-xl font-semibold text-ink">Model Information</h3>
                    </div>
                    <span className="rounded-md border border-sky-200/15 bg-sky-200/[0.05] px-2.5 py-1.5 text-[10px] font-semibold uppercase tracking-[0.1em] text-info">
                        Available via analysis requests
                    </span>
                </div>
                <div className="mt-4 grid gap-3 md:grid-cols-2">
                    {models.map(({ name, shortName, icon: Icon, description, tone }) => (
                        <article className="rounded-lg border border-line/[0.08] bg-panel/90 p-4 shadow-panel sm:p-5" key={name}>
                            <div className="flex items-start gap-4">
                                <span className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-md border ${tone}`}>
                                    <Icon aria-hidden="true" size={18} strokeWidth={1.8} />
                                </span>
                                <div className="min-w-0">
                                    <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-muted">{shortName} model</p>
                                    <h4 className="mt-1 text-sm font-semibold text-body">{name}</h4>
                                    <p className="mt-2 text-xs leading-6 text-muted">{description}</p>
                                </div>
                            </div>
                        </article>
                    ))}
                </div>
            </section>
        </div>
    )
}