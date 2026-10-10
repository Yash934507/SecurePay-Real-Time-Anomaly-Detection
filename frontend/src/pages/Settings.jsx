import { useState } from 'react'
import { usePreferences } from '../context/PreferencesContext'
import { useAnalysis } from '../context/AnalysisContext'

const panel = 'rounded-lg border border-line/15 bg-panel p-4 shadow-panel sm:p-6'
const control = 'mt-2 min-h-11 w-full rounded-md border border-control bg-field px-3 text-sm text-ink'

export default function Settings() {
    const { theme, setTheme, defaultModel, setDefaultModel, defaultSpeed, setDefaultSpeed } = usePreferences()
    const { totalAnalyzed, normalPredictions, suspiciousPredictions, suspiciousRate, clearAnalysisResults } = useAnalysis()
    const [message, setMessage] = useState('')

    function clearSession() {
        if (window.confirm('Clear all current-session analysis results? This removes Dashboard counters, activity history, and retained Fraud Alerts. Files, models, offline evaluation, and preferences will not be changed.')) {
            clearAnalysisResults()
            setMessage('Session results cleared.')
        }
    }

    const metrics = [
        ['Total analyzed transactions', totalAnalyzed.toLocaleString()],
        ['Normal predictions', normalPredictions.toLocaleString()],
        ['Suspicious predictions', suspiciousPredictions.toLocaleString()],
        ['Suspicious rate', totalAnalyzed ? `${suspiciousRate.toFixed(2)}%` : '—'],
    ]

    return <div className="space-y-7 sm:space-y-9">
        <section className="border-b border-line/15 pb-7" aria-labelledby="settings-title">
            <h2 id="settings-title" className="font-display text-3xl font-semibold text-ink sm:text-4xl">Settings</h2>
            <p className="mt-3 text-sm leading-6 text-muted">Manage application preferences and current-session data.</p>
            <p className="mt-3 text-xs leading-6 text-muted">Preferences are kept in React memory for this tab. Refreshing restores Dark, LOF, and Normal speed. Transaction data is not saved in browser storage.</p>
        </section>
        <section className={panel} aria-labelledby="appearance-title">
            <h3 id="appearance-title" className="font-display text-xl font-semibold text-ink">Appearance</h3>
            <label className="mt-4 block max-w-md text-sm font-medium text-body" htmlFor="theme-preference">Theme</label>
            <select id="theme-preference" className={`${control} max-w-md`} value={theme} onChange={(event) => setTheme(event.target.value)}>
                <option value="dark">Dark</option><option value="light">Light</option>
            </select>
            <p className="mt-3 text-xs leading-6 text-muted">Applies immediately across navigation, pages, charts, and alert details.</p>
        </section>
        <section className={panel} aria-labelledby="preferences-title">
            <h3 id="preferences-title" className="font-display text-xl font-semibold text-ink">Analysis Preferences</h3>
            <div className="mt-4 grid gap-5 md:grid-cols-2">
                <div><label htmlFor="default-model" className="text-sm font-medium text-body">Default ML model</label>
                    <select id="default-model" className={control} value={defaultModel} onChange={(event) => setDefaultModel(event.target.value)}>
                        <option value="lof">Local Outlier Factor (LOF)</option><option value="isolation_forest">Isolation Forest</option>
                    </select>
                </div>
                <div><label htmlFor="default-speed" className="text-sm font-medium text-body">Default simulation speed</label>
                    <select id="default-speed" className={control} value={defaultSpeed} onChange={(event) => setDefaultSpeed(Number(event.target.value))}>
                        <option value={2000}>Slow: 2 seconds</option><option value={1000}>Normal: 1 second</option><option value={500}>Fast: 0.5 seconds</option>
                    </select>
                </div>
            </div>
            <p className="mt-4 text-xs leading-6 text-muted">Defaults apply when opening Single Transaction Analysis, CSV Batch Analysis, and Live Monitoring. You can override them on each page. Changing a preference never submits a prediction or changes model thresholds.</p>
        </section>
        <section className={panel} aria-labelledby="session-title">
            <h3 id="session-title" className="font-display text-xl font-semibold text-ink">Session Management</h3>
            <dl className="mt-5 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">{metrics.map(([label, value]) => <div key={label} className="rounded-md border border-line/15 bg-field p-4"><dt className="text-xs text-muted">{label}</dt><dd className="mt-2 font-display text-2xl font-semibold text-ink">{value}</dd></div>)}</dl>
            <p className="mt-4 text-sm leading-7 text-muted">Clearing removes Dashboard counters, session activity history, and retained Fraud Alerts. It does not delete files from disk or change model artifacts, offline evaluation metrics, or preferences.</p>
            <p className="mt-3 text-xs leading-6 text-muted">Leaving Live Monitoring stops the replay and cancels its in-flight request. Opening Settings therefore ends an active replay. Results from requests started before a session clear are ignored if they arrive afterward; new analyses can populate the session again.</p>
            <button type="button" disabled={totalAnalyzed === 0} onClick={clearSession} className="mt-4 min-h-11 rounded-md border border-danger/50 px-4 text-sm font-semibold text-danger hover:bg-danger/10 disabled:cursor-not-allowed disabled:opacity-50">Clear Session Results</button>
            <p role="status" className="mt-3 text-sm text-success">{message}</p>
        </section>
        <section className={panel} aria-labelledby="application-title">
            <h3 id="application-title" className="font-display text-xl font-semibold text-ink">Application Information</h3>
            <dl className="mt-4 divide-y divide-line/15 text-sm">{[
                ['Project', 'SecurePay — Financial Transaction Anomaly Detection'],
                ['Frontend', 'React, Vite, Tailwind CSS'],
                ['Backend', 'Python, FastAPI'],
                ['Machine Learning', 'Isolation Forest and Local Outlier Factor'],
                ['Data', 'Historical credit card transaction dataset with precomputed V1–V28 PCA features and Amount.'],
            ].map(([label, value]) => <div key={label} className="grid gap-2 py-3 sm:grid-cols-[150px_1fr]"><dt className="font-medium text-body">{label}</dt><dd className="text-muted">{value}</dd></div>)}</dl>
            <ul className="mt-4 list-disc space-y-2 pl-5 text-sm leading-7 text-muted">
                <li>This is an academic prototype. Suspicious predictions are not confirmed fraud.</li>
                <li>Historical replay is not connected to live banking systems.</li>
                <li>Dashboard and alert data are session-only and reset on refresh.</li>
                <li>Offline model evaluation metrics are not live fraud statistics.</li>
            </ul>
        </section>
    </div>
}
