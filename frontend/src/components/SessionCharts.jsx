import { Activity, BarChart3 } from 'lucide-react'
import {
    Area,
    AreaChart,
    Bar,
    BarChart,
    CartesianGrid,
    Cell,
    ResponsiveContainer,
    Tooltip,
    XAxis,
    YAxis,
} from 'recharts'

function ChartEmptyState({ message }) {
    return (
        <div className="flex h-full min-h-[240px] flex-col items-center justify-center rounded-md border border-dashed border-line/[0.1] px-5 text-center">
            <Activity aria-hidden="true" className="text-muted" size={20} />
            <p className="mt-3 text-xs leading-5 text-muted">{message}</p>
        </div>
    )
}

export default function SessionCharts({ totalAnalyzed, normalPredictions, suspiciousPredictions, activity }) {
    const predictionDistribution = [
        { prediction: 'Normal', count: normalPredictions, color: 'var(--chart-teal)' },
        { prediction: 'Suspicious', count: suspiciousPredictions, color: 'var(--chart-amber)' },
    ]
    const activityData = activity.map((event, index) => ({
        ...event,
        index: index + 1,
        timeLabel: new Date(event.timestamp).toLocaleTimeString([], {
            hour: '2-digit',
            minute: '2-digit',
            second: '2-digit',
        }),
    }))

    return (
        <section aria-labelledby="analytics-title">
            <div className="mb-4">
                <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-muted">Session analytics</p>
                <h3 id="analytics-title" className="mt-2 font-display text-xl font-semibold text-ink">Analysis Results</h3>
            </div>
            <div className="grid gap-4 lg:grid-cols-2">
                <section aria-labelledby="distribution-title" className="rounded-lg border border-line/[0.08] bg-panel/90 p-4 shadow-panel sm:p-5">
                    <div className="flex items-center gap-3">
                        <span className="flex h-9 w-9 items-center justify-center rounded-md border border-sky-300/15 bg-sky-300/10 text-info">
                            <BarChart3 aria-hidden="true" size={17} />
                        </span>
                        <div>
                            <h4 id="distribution-title" className="font-display text-base font-semibold text-ink">Prediction Distribution</h4>
                            <p className="mt-1 text-[11px] text-muted">Current session prediction counts</p>
                        </div>
                    </div>
                    {totalAnalyzed === 0 ? (
                        <ChartEmptyState message="Distribution will appear after the first successful analysis." />
                    ) : (
                        <div aria-label="Normal and Suspicious prediction counts" className="mt-4 h-[240px] w-full min-w-0 overflow-hidden">
                            <ResponsiveContainer height="100%" width="100%">
                                <BarChart data={predictionDistribution} margin={{ top: 10, right: 12, bottom: 0, left: -16 }}>
                                    <CartesianGrid stroke="rgb(var(--line) / 0.15)" strokeDasharray="3 3" vertical={false} />
                                    <XAxis axisLine={false} dataKey="prediction" tick={{ fill: 'rgb(var(--muted))', fontSize: 11 }} tickLine={false} />
                                    <YAxis allowDecimals={false} axisLine={false} tick={{ fill: 'rgb(var(--muted))', fontSize: 10 }} tickLine={false} />
                                    <Tooltip
                                        contentStyle={{ background: 'rgb(var(--table))', border: '1px solid rgb(var(--line) / 0.2)', borderRadius: 6, color: 'rgb(var(--ink))' }}
                                        cursor={{ fill: 'rgba(148,163,184,0.08)' }}
                                    />
                                    <Bar dataKey="count" name="Predictions" radius={[4, 4, 0, 0]}>
                                        {predictionDistribution.map((entry) => <Cell fill={entry.color} key={entry.prediction} />)}
                                    </Bar>
                                </BarChart>
                            </ResponsiveContainer>
                        </div>
                    )}
                </section>

                <section aria-labelledby="activity-title" className="rounded-lg border border-line/[0.08] bg-panel/90 p-4 shadow-panel sm:p-5">
                    <div className="flex items-center gap-3">
                        <span className="flex h-9 w-9 items-center justify-center rounded-md border border-teal-300/15 bg-teal-300/10 text-success">
                            <Activity aria-hidden="true" size={17} />
                        </span>
                        <div>
                            <h4 id="activity-title" className="font-display text-base font-semibold text-ink">Transaction Activity</h4>
                            <p className="mt-1 text-[11px] text-muted">Successful analyses by analysis time</p>
                        </div>
                    </div>
                    {activityData.length === 0 ? (
                        <ChartEmptyState message="Activity will appear after an analysis succeeds." />
                    ) : (
                        <div aria-label="Transactions analyzed over session analysis time" className="mt-4 h-[240px] w-full min-w-0 overflow-hidden">
                            <ResponsiveContainer height="100%" width="100%">
                                <AreaChart data={activityData} margin={{ top: 10, right: 12, bottom: 0, left: -16 }}>
                                    <defs>
                                        <linearGradient id="sessionActivityFill" x1="0" x2="0" y1="0" y2="1">
                                            <stop offset="0%" stopColor="var(--chart-teal)" stopOpacity={0.3} />
                                            <stop offset="95%" stopColor="var(--chart-teal)" stopOpacity={0.01} />
                                        </linearGradient>
                                    </defs>
                                    <CartesianGrid stroke="rgb(var(--line) / 0.15)" strokeDasharray="3 3" vertical={false} />
                                    <XAxis axisLine={false} dataKey="timeLabel" tick={{ fill: 'rgb(var(--muted))', fontSize: 10 }} tickLine={false} />
                                    <YAxis allowDecimals={false} axisLine={false} tick={{ fill: 'rgb(var(--muted))', fontSize: 10 }} tickLine={false} />
                                    <Tooltip
                                        contentStyle={{ background: 'rgb(var(--table))', border: '1px solid rgb(var(--line) / 0.2)', borderRadius: 6, color: 'rgb(var(--ink))' }}
                                        formatter={(value) => [value, 'Transactions analyzed']}
                                        labelFormatter={(label) => `Analysis time ${label}`}
                                    />
                                    <Area dataKey="transactionCount" name="Transactions analyzed" stroke="var(--chart-teal)" strokeWidth={2} fill="url(#sessionActivityFill)" type="monotone" />
                                </AreaChart>
                            </ResponsiveContainer>
                        </div>
                    )}
                </section>
            </div>
            <p className="mt-2 text-[10px] leading-5 text-muted">History is limited to 100 recent analysis actions. A CSV batch is plotted once when its response succeeds.</p>
        </section>
    )
}