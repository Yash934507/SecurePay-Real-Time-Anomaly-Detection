import { useState } from 'react'
import {
    Activity,
    AlertCircle,
    CheckCircle2,
    ChevronDown,
    LoaderCircle,
    ScanSearch,
    ShieldAlert,
    ShieldCheck,
} from 'lucide-react'
import { predictTransaction } from '../services/api'
import BatchAnalysis from '../components/BatchAnalysis'
import { useAnalysis } from '../context/AnalysisContext'
import { usePreferences } from '../context/PreferencesContext'

const PCA_FEATURES = Array.from({ length: 28 }, (_, index) => `V${index + 1}`)
const MODEL_LABELS = {
    lof: 'Local Outlier Factor (LOF)',
    isolation_forest: 'Isolation Forest',
}

function createEmptyFeatures() {
    return Object.fromEntries(PCA_FEATURES.map((feature) => [feature, '']))
}

function validateNumber(value, fieldName, { nonNegative = false } = {}) {
    if (value.trim() === '') {
        return { error: `${fieldName} is required.` }
    }

    const parsedValue = Number(value)
    if (!Number.isFinite(parsedValue)) {
        return { error: `${fieldName} must be a finite number.` }
    }
    if (nonNegative && parsedValue < 0) {
        return { error: 'Amount cannot be negative.' }
    }

    return { value: parsedValue }
}

export default function TransactionAnalysis() {
    const { recordSinglePrediction } = useAnalysis()
    const { defaultModel } = usePreferences()
    const [model, setModel] = useState(defaultModel)
    const [amount, setAmount] = useState('')
    const [features, setFeatures] = useState(createEmptyFeatures)
    const [featuresExpanded, setFeaturesExpanded] = useState(false)
    const [validationErrors, setValidationErrors] = useState({})
    const [apiError, setApiError] = useState('')
    const [isSubmitting, setIsSubmitting] = useState(false)
    const [result, setResult] = useState(null)

    function clearPreviousOutcome() {
        setResult(null)
        setApiError('')
    }

    function updateFeature(featureName, value) {
        setFeatures((current) => ({ ...current, [featureName]: value }))
        setValidationErrors((current) => {
            const next = { ...current }
            delete next[featureName]
            return next
        })
        clearPreviousOutcome()
    }

    function handleSubmit(event) {
        event.preventDefault()

        const errors = {}
        const payloadFeatures = {}
        const amountValidation = validateNumber(amount, 'Amount', { nonNegative: true })
        if (amountValidation.error) {
            errors.Amount = amountValidation.error
        } else {
            payloadFeatures.Amount = amountValidation.value
        }

        for (const featureName of PCA_FEATURES) {
            const validation = validateNumber(features[featureName], featureName)
            if (validation.error) {
                errors[featureName] = validation.error
            } else {
                payloadFeatures[featureName] = validation.value
            }
        }

        setValidationErrors(errors)
        setResult(null)
        setApiError('')
        if (Object.keys(errors).length > 0) {
            if (PCA_FEATURES.some((featureName) => errors[featureName])) {
                setFeaturesExpanded(true)
            }
            return
        }

        setIsSubmitting(true)
        predictTransaction({ model, ...payloadFeatures })
            .then((response) => {
                setResult(response)
                recordSinglePrediction(response, { source: 'Single' })
            })
            .catch((error) => {
                setApiError(error.message || 'The prediction request failed. Please try again.')
            })
            .finally(() => setIsSubmitting(false))
    }

    const isSuspicious = result?.is_anomaly === true

    return (
        <div className="space-y-7 sm:space-y-9">
            <section aria-labelledby="transaction-analysis-title" className="border-b border-line/[0.08] pb-7 sm:pb-8">
                <p className="flex items-center gap-2 text-[10px] font-semibold uppercase tracking-[0.18em] text-success sm:text-[11px]">
                    <span aria-hidden="true" className="h-px w-6 bg-teal-300" />
                    Single transaction assessment
                </p>
                <div className="mt-3 flex flex-col justify-between gap-5 lg:flex-row lg:items-end">
                    <div className="max-w-3xl">
                        <h2 id="transaction-analysis-title" className="font-display text-3xl font-semibold leading-tight text-ink sm:text-4xl">
                            Transaction Analysis
                        </h2>
                        <p className="mt-3 max-w-2xl text-sm leading-6 text-muted">
                            Submit one transaction’s precomputed model features to the SecurePay API for an anomaly score.
                            This result is an anomaly signal, not a confirmation of fraud.
                        </p>
                    </div>
                    <span className="flex shrink-0 items-center gap-2 self-start rounded-md border border-amber-200/15 bg-amber-200/[0.06] px-3 py-2 text-xs font-medium text-warning lg:self-auto">
                        <span aria-hidden="true" className="h-1.5 w-1.5 rounded-full bg-amber-300" />
                        Request-based API analysis
                    </span>
                </div>
            </section>

            <div className="grid items-start gap-5 xl:grid-cols-[minmax(0,1.2fr)_minmax(320px,0.8fr)]">
                <form className="space-y-5" noValidate onSubmit={handleSubmit}>
                    <section aria-labelledby="transaction-input-title" className="rounded-lg border border-line/[0.08] bg-panel/90 p-4 shadow-panel sm:p-6">
                        <div className="flex items-center gap-3 border-b border-line/[0.07] pb-4">
                            <span className="flex h-9 w-9 items-center justify-center rounded-md border border-teal-300/15 bg-teal-300/10 text-success">
                                <Activity aria-hidden="true" size={17} />
                            </span>
                            <div>
                                <h3 id="transaction-input-title" className="font-display text-base font-semibold text-ink">Transaction features</h3>
                                <p className="mt-1 text-xs text-muted">All fields are required for a model prediction.</p>
                            </div>
                        </div>

                        <div className="mt-5 grid gap-4 sm:grid-cols-2">
                            <div>
                                <label className="mb-2 block text-xs font-medium text-body" htmlFor="model-selection">Detection model</label>
                                <select
                                    className="min-h-11 w-full rounded-md border border-line/[0.12] bg-field px-3 text-sm text-body outline-none transition focus:border-teal-300/60"
                                    id="model-selection"
                                    onChange={(event) => {
                                        setModel(event.target.value)
                                        clearPreviousOutcome()
                                    }}
                                    value={model}
                                >
                                    <option value="lof">Local Outlier Factor (LOF)</option>
                                    <option value="isolation_forest">Isolation Forest</option>
                                </select>
                            </div>
                            <div>
                                <label className="mb-2 block text-xs font-medium text-body" htmlFor="transaction-amount">Transaction Amount</label>
                                <input
                                    aria-describedby={validationErrors.Amount ? 'amount-error' : 'amount-help'}
                                    aria-invalid={Boolean(validationErrors.Amount)}
                                    autoComplete="off"
                                    className="min-h-11 w-full rounded-md border border-line/[0.12] bg-field px-3 text-sm text-body outline-none transition placeholder:text-muted focus:border-teal-300/60 aria-[invalid=true]:border-rose-300/60"
                                    id="transaction-amount"
                                    inputMode="decimal"
                                    onChange={(event) => {
                                        setAmount(event.target.value)
                                        setValidationErrors((current) => {
                                            const next = { ...current }
                                            delete next.Amount
                                            return next
                                        })
                                        clearPreviousOutcome()
                                    }}
                                    placeholder="Enter amount"
                                    type="number"
                                    min="0"
                                    step="any"
                                    value={amount}
                                />
                                {validationErrors.Amount ? (
                                    <p className="mt-1.5 text-xs text-danger" id="amount-error">{validationErrors.Amount}</p>
                                ) : (
                                    <p className="mt-1.5 text-xs text-muted" id="amount-help">Use a finite, nonnegative numeric value.</p>
                                )}
                            </div>
                        </div>

                        <div className="mt-5 rounded-md border border-sky-200/10 bg-sky-200/[0.04] p-3.5 sm:p-4">
                            <p className="flex items-start gap-2 text-xs leading-5 text-info">
                                <ShieldCheck aria-hidden="true" className="mt-0.5 shrink-0 text-info" size={15} />
                                <span>
                                    <strong className="font-semibold text-info">PCA features required.</strong>{' '}
                                    V1–V28 must be precomputed PCA values in the same feature space as the trained dataset models.
                                    SecurePay does not derive them from card or banking details. Do not enter card numbers, CVV, passwords,
                                    or personal banking information.
                                </span>
                            </p>
                        </div>

                        <section aria-labelledby="advanced-features-title" className="mt-5 border-t border-line/[0.07] pt-5">
                            <button
                                aria-controls="advanced-feature-fields"
                                aria-expanded={featuresExpanded}
                                className="flex min-h-10 w-full items-center justify-between gap-3 text-left"
                                onClick={() => setFeaturesExpanded((expanded) => !expanded)}
                                type="button"
                            >
                                <span>
                                    <span className="block text-sm font-semibold text-body" id="advanced-features-title">Advanced Features</span>
                                    <span className="mt-1 block text-xs text-muted">Enter all 28 precomputed PCA values.</span>
                                </span>
                                <ChevronDown aria-hidden="true" className={`shrink-0 text-muted transition-transform ${featuresExpanded ? 'rotate-180' : ''}`} size={18} />
                            </button>
                            <div className="mt-4" hidden={!featuresExpanded} id="advanced-feature-fields">
                                <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
                                    {PCA_FEATURES.map((featureName) => (
                                        <div key={featureName}>
                                            <label className="mb-1.5 block text-[11px] font-medium text-muted" htmlFor={featureName}>{featureName}</label>
                                            <input
                                                aria-describedby={validationErrors[featureName] ? `${featureName}-error` : undefined}
                                                aria-invalid={Boolean(validationErrors[featureName])}
                                                aria-required="true"
                                                autoComplete="off"
                                                className="min-h-10 w-full rounded-md border border-line/[0.1] bg-field px-2.5 text-sm text-body outline-none transition placeholder:text-muted focus:border-teal-300/60 aria-[invalid=true]:border-rose-300/60"
                                                id={featureName}
                                                inputMode="decimal"
                                                onChange={(event) => updateFeature(featureName, event.target.value)}
                                                placeholder="Required"
                                                type="number"
                                                step="any"
                                                value={features[featureName]}
                                            />
                                            {validationErrors[featureName] && (
                                                <p className="mt-1 text-[10px] leading-4 text-danger" id={`${featureName}-error`}>
                                                    {validationErrors[featureName]}
                                                </p>
                                            )}
                                        </div>
                                    ))}
                                </div>
                            </div>
                        </section>

                        {Object.keys(validationErrors).length > 0 && (
                            <div className="mt-5 flex gap-2.5 rounded-md border border-rose-300/20 bg-rose-300/[0.06] p-3.5 text-xs leading-5 text-danger" role="alert">
                                <AlertCircle aria-hidden="true" className="mt-0.5 shrink-0" size={15} />
                                <div>
                                    <p className="font-semibold">Review the transaction fields</p>
                                    <p className="mt-1">Enter a finite number for Amount and every PCA feature before analysis.</p>
                                </div>
                            </div>
                        )}

                        {apiError && (
                            <div className="mt-5 flex gap-2.5 rounded-md border border-rose-300/20 bg-rose-300/[0.06] p-3.5 text-xs leading-5 text-danger" role="alert">
                                <AlertCircle aria-hidden="true" className="mt-0.5 shrink-0" size={15} />
                                <p>{apiError}</p>
                            </div>
                        )}

                        <div className="mt-6 flex flex-col-reverse gap-3 border-t border-line/[0.07] pt-5 sm:flex-row sm:items-center sm:justify-between">
                            <p className="text-[11px] leading-5 text-muted">One request is sent to the selected model. No transaction is stored by this page.</p>
                            <button
                                className="inline-flex min-h-11 items-center justify-center gap-2 rounded-md border border-teal-200/20 bg-teal-300 px-5 text-sm font-semibold text-[#062029] transition hover:bg-teal-200 disabled:cursor-not-allowed disabled:opacity-60"
                                disabled={isSubmitting}
                                type="submit"
                            >
                                {isSubmitting ? <LoaderCircle aria-hidden="true" className="animate-spin" size={17} /> : <ScanSearch aria-hidden="true" size={17} />}
                                {isSubmitting ? 'Analyzing…' : 'Analyze Transaction'}
                            </button>
                        </div>
                    </section>
                </form>

                <section aria-labelledby="prediction-result-title" aria-live="polite" className="rounded-lg border border-line/[0.08] bg-panel/90 p-4 shadow-panel sm:p-5">
                    <div className="flex items-center justify-between gap-3 border-b border-line/[0.07] pb-4">
                        <div>
                            <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-muted">API response</p>
                            <h3 id="prediction-result-title" className="mt-1.5 font-display text-base font-semibold text-ink">Prediction Result</h3>
                        </div>
                        {result && <span className="rounded-md border border-line/[0.08] px-2 py-1 text-[10px] uppercase tracking-[0.1em] text-muted">Complete</span>}
                    </div>

                    {result ? (
                        <div className={`mt-5 rounded-md border p-4 ${isSuspicious ? 'border-amber-200/20 bg-amber-200/[0.06]' : 'border-teal-200/20 bg-teal-200/[0.055]'}`}>
                            <div className="flex items-center gap-3">
                                <span className={`flex h-10 w-10 items-center justify-center rounded-md border ${isSuspicious ? 'border-amber-200/20 bg-amber-200/10 text-warning' : 'border-teal-200/20 bg-teal-200/10 text-success'}`}>
                                    {isSuspicious ? <ShieldAlert aria-hidden="true" size={19} /> : <CheckCircle2 aria-hidden="true" size={19} />}
                                </span>
                                <div>
                                    <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-muted">Prediction</p>
                                    <p className={`mt-1 font-display text-xl font-semibold ${isSuspicious ? 'text-warning' : 'text-success'}`}>
                                        {result.prediction}
                                    </p>
                                </div>
                            </div>

                            <p className="mt-4 text-xs leading-5 text-body">
                                {isSuspicious
                                    ? 'The anomaly score meets or exceeds this model’s threshold. This indicates an unusual pattern, not confirmed fraud.'
                                    : 'The anomaly score is below this model’s threshold, so this transaction was not flagged as anomalous.'}
                            </p>

                            <dl className="mt-5 divide-y divide-line/[0.07] border-y border-line/[0.07]">
                                <div className="flex items-center justify-between gap-4 py-3 text-xs">
                                    <dt className="text-muted">Selected model</dt>
                                    <dd className="text-right font-medium text-body">{MODEL_LABELS[result.selected_model]}</dd>
                                </div>
                                <div className="flex items-center justify-between gap-4 py-3 text-xs">
                                    <dt className="text-muted">Anomaly score</dt>
                                    <dd className="font-mono text-right text-body">{result.anomaly_score.toFixed(6)}</dd>
                                </div>
                                <div className="flex items-center justify-between gap-4 py-3 text-xs">
                                    <dt className="text-muted">Model threshold</dt>
                                    <dd className="font-mono text-right text-body">{result.threshold.toFixed(6)}</dd>
                                </div>
                            </dl>
                            <p className="mt-4 text-[11px] leading-5 text-muted">
                                The model compares the anomaly score with its saved threshold. No fraud probability or confidence percentage is produced.
                            </p>
                        </div>
                    ) : (
                        <div className="mt-5 flex min-h-[230px] flex-col items-center justify-center rounded-md border border-dashed border-line/[0.1] px-5 py-7 text-center">
                            <span className="flex h-11 w-11 items-center justify-center rounded-full border border-line/[0.08] bg-wash/[0.025] text-muted">
                                {isSubmitting ? <LoaderCircle aria-hidden="true" className="animate-spin" size={19} /> : <Activity aria-hidden="true" size={19} />}
                            </span>
                            <h4 className="mt-4 text-sm font-semibold text-body">
                                {isSubmitting ? 'Waiting for model response' : 'Awaiting analysis'}
                            </h4>
                            <p className="mt-2 max-w-sm text-xs leading-5 text-muted">
                                {isSubmitting
                                    ? 'The selected model is processing this transaction.'
                                    : 'A prediction result will appear here only after the API returns successfully.'}
                            </p>
                        </div>
                    )}
                </section>
            </div>
            <BatchAnalysis />
        </div>
    )
}
