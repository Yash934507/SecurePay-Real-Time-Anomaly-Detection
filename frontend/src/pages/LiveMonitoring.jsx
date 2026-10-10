import { useEffect, useRef, useState } from 'react'
import Papa from 'papaparse'
import {
    Activity,
    AlertCircle,
    CheckCircle2,
    CirclePause,
    CirclePlay,
    FileSpreadsheet,
    LoaderCircle,
    RotateCcw,
    ShieldAlert,
    Square,
} from 'lucide-react'
import { predictTransaction } from '../services/api'
import { useAnalysis } from '../context/AnalysisContext'
import { usePreferences } from '../context/PreferencesContext'

const PCA_FEATURES = Array.from({ length: 28 }, (_, index) => `V${index + 1}`)
const REQUIRED_FEATURES = [...PCA_FEATURES, 'Amount']
const MAX_REPLAY_ROWS = 500
const MAX_CSV_BYTES = 5 * 1024 * 1024
const SPEED_OPTIONS = [
    { label: 'Slow · 2 seconds', value: 2000 },
    { label: 'Normal · 1 second', value: 1000 },
    { label: 'Fast · 0.5 seconds', value: 500 },
]
const MODEL_LABELS = {
    lof: 'Local Outlier Factor (LOF)',
    isolation_forest: 'Isolation Forest',
}

function blankRecord(record) {
    return record.every((value) => String(value ?? '').trim() === '')
}

function parseReplayFile(file) {
    if (!file || file.size === 0) {
        return Promise.reject(new Error('Choose a non-empty CSV file.'))
    }
    if (file.size > MAX_CSV_BYTES) {
        return Promise.reject(new Error('The simulation CSV must be 5 MiB or smaller.'))
    }

    return new Promise((resolve, reject) => {
        Papa.parse(file, {
            header: false,
            delimiter: ',',
            skipEmptyLines: false,
            complete: ({ data, errors }) => {
                if (errors.length > 0) {
                    const parserError = errors[0]
                    const csvLine = Number.isInteger(parserError.row) ? parserError.row + 1 : null
                    reject(new Error(csvLine
                        ? `Could not parse CSV near line ${csvLine}. Check its quoting and column structure.`
                        : 'Could not parse the CSV. Check its quoting and column structure.'))
                    return
                }

                const records = [...data]
                while (records.length > 0 && blankRecord(records[records.length - 1])) {
                    records.pop()
                }
                if (records.length < 2) {
                    reject(new Error('The CSV must contain a header and at least one transaction row.'))
                    return
                }

                const headers = records[0].map((value, index) => {
                    const header = String(value ?? '').trim()
                    return index === 0 ? header.replace(/^\uFEFF/, '') : header
                })
                if (headers.some((header) => header === '')) {
                    reject(new Error('Every CSV column must have a name.'))
                    return
                }

                const duplicateHeaders = [...new Set(headers.filter((header, index) => headers.indexOf(header) !== index))]
                if (duplicateHeaders.length > 0) {
                    reject(new Error(`Duplicate CSV column names: ${duplicateHeaders.join(', ')}.`))
                    return
                }

                const missingFeatures = REQUIRED_FEATURES.filter((feature) => !headers.includes(feature))
                if (missingFeatures.length > 0) {
                    reject(new Error(`CSV is missing required columns: ${missingFeatures.join(', ')}.`))
                    return
                }

                const dataRows = records.slice(1)
                if (dataRows.length > MAX_REPLAY_ROWS) {
                    reject(new Error(`Historical replay is limited to ${MAX_REPLAY_ROWS} transactions per file.`))
                    return
                }

                const featurePositions = REQUIRED_FEATURES.map((feature) => headers.indexOf(feature))
                const transactions = []
                for (let rowIndex = 0; rowIndex < dataRows.length; rowIndex += 1) {
                    const row = dataRows[rowIndex]
                    const rowNumber = rowIndex + 1
                    if (blankRecord(row)) {
                        reject(new Error(`CSV data row ${rowNumber} is empty.`))
                        return
                    }
                    if (row.length !== headers.length) {
                        reject(new Error(`CSV data row ${rowNumber} has an unexpected number of columns.`))
                        return
                    }

                    const transaction = {}
                    for (let featureIndex = 0; featureIndex < REQUIRED_FEATURES.length; featureIndex += 1) {
                        const feature = REQUIRED_FEATURES[featureIndex]
                        const rawValue = String(row[featurePositions[featureIndex]] ?? '').trim()
                        if (rawValue === '') {
                            reject(new Error(`CSV data row ${rowNumber} is missing a value for ${feature}.`))
                            return
                        }
                        if (!/^[+-]?(?:\d+\.?\d*|\.\d+)(?:[eE][+-]?\d+)?$/.test(rawValue)) {
                            reject(new Error(`CSV data row ${rowNumber} has a non-numeric value in ${feature}.`))
                            return
                        }

                        const value = Number(rawValue)
                        if (!Number.isFinite(value)) {
                            reject(new Error(`CSV data row ${rowNumber} has a non-finite value in ${feature}.`))
                            return
                        }
                        if (feature === 'Amount' && value < 0) {
                            reject(new Error(`CSV data row ${rowNumber} has a negative Amount.`))
                            return
                        }
                        transaction[feature] = value
                    }
                    transactions.push(transaction)
                }

                resolve(transactions)
            },
            error: () => reject(new Error('Could not read the selected CSV file.')),
        })
    })
}

function formatAmount(value) {
    return value.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })
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

export default function LiveMonitoring() {
    const { recordSinglePrediction } = useAnalysis()
    const [fileName, setFileName] = useState('')
    const [transactions, setTransactions] = useState([])
    const { defaultModel, defaultSpeed } = usePreferences()
    const [selectedModel, setSelectedModel] = useState(defaultModel)
    const [speed, setSpeed] = useState(defaultSpeed)
    const [processedResults, setProcessedResults] = useState([])
    const [currentTransaction, setCurrentTransaction] = useState(null)
    const [failedTransaction, setFailedTransaction] = useState(null)
    const [simulationStatus, setSimulationStatus] = useState('idle')
    const [fileError, setFileError] = useState('')
    const [simulationError, setSimulationError] = useState('')

    const mountedRef = useRef(false)
    const activeRunRef = useRef(false)
    const runIdRef = useRef(0)
    const parseIdRef = useRef(0)
    const pausedRef = useRef(false)
    const requestControllerRef = useRef(null)
    const timerRef = useRef(null)
    const delayResolverRef = useRef(null)
    const speedRef = useRef(speed)
    const rowsRef = useRef(transactions)
    const modelRef = useRef(selectedModel)

    speedRef.current = speed
    rowsRef.current = transactions
    modelRef.current = selectedModel

    function clearReplayDelay() {
        if (timerRef.current !== null) {
            window.clearTimeout(timerRef.current)
            timerRef.current = null
        }
        if (delayResolverRef.current) {
            const resolveDelay = delayResolverRef.current
            delayResolverRef.current = null
            resolveDelay()
        }
    }

    function invalidateCurrentRun() {
        runIdRef.current += 1
        activeRunRef.current = false
        pausedRef.current = false
        clearReplayDelay()
        if (requestControllerRef.current) {
            requestControllerRef.current.abort()
            requestControllerRef.current = null
        }
        return runIdRef.current
    }

    useEffect(() => {
        mountedRef.current = true
        return () => {
            mountedRef.current = false
            parseIdRef.current += 1
            invalidateCurrentRun()
        }
    }, [])

    function handleFileChange(event) {
        const file = event.target.files?.[0]
        const parseId = parseIdRef.current + 1
        parseIdRef.current = parseId
        invalidateCurrentRun()
        setFileName(file?.name || '')
        setTransactions([])
        rowsRef.current = []
        setProcessedResults([])
        setCurrentTransaction(null)
        setFailedTransaction(null)
        setSimulationError('')
        setFileError('')

        if (!file) {
            setSimulationStatus('idle')
            return
        }
        if (!file.name.toLowerCase().endsWith('.csv')) {
            setFileError('Choose a CSV file with a .csv extension.')
            setSimulationStatus('error')
            event.target.value = ''
            return
        }

        setSimulationStatus('loading')
        parseReplayFile(file)
            .then((parsedTransactions) => {
                if (parseIdRef.current !== parseId || !mountedRef.current) return
                setTransactions(parsedTransactions)
                rowsRef.current = parsedTransactions
                setSimulationStatus('ready')
            })
            .catch((error) => {
                if (parseIdRef.current !== parseId || !mountedRef.current) return
                setFileError(error.message || 'The CSV could not be validated.')
                setSimulationStatus('error')
            })
    }

    function waitBeforeNextTransaction(delay) {
        return new Promise((resolve) => {
            delayResolverRef.current = resolve
            timerRef.current = window.setTimeout(() => {
                timerRef.current = null
                delayResolverRef.current = null
                resolve()
            }, delay)
        })
    }

    async function replayFrom(startIndex, runId) {
        const replayRows = rowsRef.current
        const replayModel = modelRef.current

        for (let index = startIndex; index < replayRows.length; index += 1) {
            if (runIdRef.current !== runId || !mountedRef.current) return
            if (pausedRef.current) {
                activeRunRef.current = false
                setSimulationStatus('paused')
                return
            }

            setCurrentTransaction(index + 1)
            const controller = new AbortController()
            requestControllerRef.current = controller
            let prediction
            try {
                prediction = await predictTransaction(
                    { ...replayRows[index], model: replayModel },
                    { signal: controller.signal },
                )
            } catch (error) {
                if (runIdRef.current !== runId || !mountedRef.current || error.name === 'AbortError') return
                setFailedTransaction(index + 1)
                setCurrentTransaction(null)
                setSimulationError(`Transaction ${index + 1} was not processed: ${error.message}`)
                activeRunRef.current = false
                setSimulationStatus('error')
                return
            } finally {
                if (requestControllerRef.current === controller) {
                    requestControllerRef.current = null
                }
            }

            if (runIdRef.current !== runId || !mountedRef.current) return
            recordSinglePrediction(prediction, {
                source: 'Simulation',
                reference: `Transaction ${index + 1}`,
            })
            setProcessedResults((current) => [
                ...current,
                {
                    transactionNumber: index + 1,
                    amount: replayRows[index].Amount,
                    ...prediction,
                    status: 'Processed',
                },
            ])
            setCurrentTransaction(null)
            setFailedTransaction(null)
            setSimulationError('')

            if (pausedRef.current) {
                activeRunRef.current = false
                setSimulationStatus('paused')
                return
            }
            if (index === replayRows.length - 1) {
                activeRunRef.current = false
                setSimulationStatus('completed')
                return
            }

            await waitBeforeNextTransaction(speedRef.current)
            if (runIdRef.current !== runId || !mountedRef.current) return
            if (pausedRef.current) {
                activeRunRef.current = false
                setSimulationStatus('paused')
                return
            }
        }
    }

    function startSimulation(startIndex = 0) {
        if (rowsRef.current.length === 0 || activeRunRef.current) return
        const runId = runIdRef.current + 1
        runIdRef.current = runId
        activeRunRef.current = true
        pausedRef.current = false
        setSimulationError('')
        setFileError('')
        setFailedTransaction(null)
        setSimulationStatus('running')
        void replayFrom(startIndex, runId)
    }

    function pauseSimulation() {
        if (simulationStatus !== 'running') return
        pausedRef.current = true
        if (requestControllerRef.current) {
            setSimulationStatus('pausing')
        } else {
            clearReplayDelay()
            activeRunRef.current = false
            setSimulationStatus('paused')
        }
    }

    function resumeSimulation() {
        if (simulationStatus !== 'paused') return
        startSimulation(processedResults.length)
    }

    function stopAndReset() {
        invalidateCurrentRun()
        setProcessedResults([])
        setCurrentTransaction(null)
        setFailedTransaction(null)
        setSimulationError('')
        setFileError('')
        setSimulationStatus(rowsRef.current.length > 0 ? 'ready' : 'idle')
    }

    const normalTransactions = processedResults.filter((row) => !row.is_anomaly).length
    const suspiciousResults = processedResults.filter((row) => row.is_anomaly)
    const suspiciousRate = processedResults.length > 0
        ? suspiciousResults.length / processedResults.length
        : null
    const resultsByTransaction = new Map(
        processedResults.map((result) => [result.transactionNumber, result]),
    )
    const isBusy = ['loading', 'running', 'pausing'].includes(simulationStatus)
    const canStart = transactions.length > 0 && ['ready', 'error'].includes(simulationStatus)
    const canPause = ['running', 'pausing', 'paused'].includes(simulationStatus)
    const canStop = fileName !== '' || processedResults.length > 0 || isBusy

    return (
        <div className="space-y-7 sm:space-y-9">
            <section aria-labelledby="live-monitoring-title" className="border-b border-line/[0.08] pb-7 sm:pb-8">
                <div className="flex flex-wrap items-center gap-2">
                    <span className="rounded-md border border-amber-200/15 bg-amber-200/[0.06] px-2.5 py-1.5 text-[10px] font-semibold uppercase tracking-[0.12em] text-warning">
                        Historical Data Simulation
                    </span>
                    <span className="text-[10px] font-medium uppercase tracking-[0.12em] text-muted">No live banking connection</span>
                </div>
                <div className="mt-3 flex flex-col justify-between gap-5 lg:flex-row lg:items-end">
                    <div className="max-w-3xl">
                        <h2 id="live-monitoring-title" className="font-display text-3xl font-semibold leading-tight text-ink sm:text-4xl">
                            Live Transaction Monitoring
                        </h2>
                        <p className="mt-3 text-sm leading-6 text-muted">
                            Replay up to {MAX_REPLAY_ROWS} historical CSV rows one at a time. Each displayed prediction comes from the existing SecurePay API; this is not a live feed or confirmed fraud determination.
                        </p>
                    </div>
                    <span className="flex shrink-0 items-center gap-2 self-start rounded-md border border-sky-200/15 bg-sky-200/[0.05] px-3 py-2 text-xs font-medium text-info lg:self-auto">
                        <Activity aria-hidden="true" size={15} />
                        Sequential replay
                    </span>
                </div>
            </section>

            <section aria-labelledby="simulation-controls-title" className="rounded-lg border border-line/[0.08] bg-panel/90 p-4 shadow-panel sm:p-5">
                <div className="flex items-center gap-3 border-b border-line/[0.07] pb-4">
                    <span className="flex h-9 w-9 items-center justify-center rounded-md border border-teal-300/15 bg-teal-300/10 text-success">
                        <FileSpreadsheet aria-hidden="true" size={17} />
                    </span>
                    <div>
                        <h3 id="simulation-controls-title" className="font-display text-base font-semibold text-ink">Replay controls</h3>
                        <p className="mt-1 text-xs text-muted">Required columns: V1–V28 and Amount. Time and Class are ignored.</p>
                    </div>
                </div>

                <div className="mt-5 grid gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(220px,0.4fr)_minmax(220px,0.4fr)] lg:items-end">
                    <div>
                        <label className="mb-2 block text-xs font-medium text-body" htmlFor="replay-csv-file">Historical CSV</label>
                        <input
                            accept=".csv,text/csv"
                            className="block min-h-11 w-full rounded-md border border-line/[0.12] bg-field text-xs text-body file:mr-3 file:min-h-11 file:border-0 file:border-r file:border-solid file:border-line/10 file:bg-wash/[0.045] file:px-3 file:text-xs file:font-semibold file:text-success hover:file:bg-wash/[0.08] focus:outline-none focus:ring-1 focus:ring-teal-300/60"
                            disabled={isBusy}
                            id="replay-csv-file"
                            onChange={handleFileChange}
                            type="file"
                        />
                        {fileName && (
                            <p className="mt-1.5 break-all text-[11px] text-muted" role="status">{fileName}</p>
                        )}
                    </div>

                    <div>
                        <label className="mb-2 block text-xs font-medium text-body" htmlFor="replay-model">Detection model</label>
                        <select
                            className="min-h-11 w-full rounded-md border border-line/[0.12] bg-field px-3 text-sm text-body outline-none focus:border-teal-300/60"
                            disabled={isBusy || processedResults.length > 0}
                            id="replay-model"
                            onChange={(event) => setSelectedModel(event.target.value)}
                            value={selectedModel}
                        >
                            <option value="lof">Local Outlier Factor (LOF)</option>
                            <option value="isolation_forest">Isolation Forest</option>
                        </select>
                    </div>

                    <div>
                        <label className="mb-2 block text-xs font-medium text-body" htmlFor="replay-speed">Simulation speed</label>
                        <select
                            className="min-h-11 w-full rounded-md border border-line/[0.12] bg-field px-3 text-sm text-body outline-none focus:border-teal-300/60"
                            disabled={isBusy}
                            id="replay-speed"
                            onChange={(event) => setSpeed(Number(event.target.value))}
                            value={speed}
                        >
                            {SPEED_OPTIONS.map((option) => (
                                <option key={option.value} value={option.value}>{option.label}</option>
                            ))}
                        </select>
                    </div>
                </div>

                <div className="mt-5 rounded-md border border-sky-200/10 bg-sky-200/[0.035] p-3.5">
                    <p className="text-xs leading-5 text-muted">
                        V1–V28 must already be computed in the trained dataset’s PCA feature space. Do not include card numbers, CVV, passwords, or banking credentials. CSV contents stay in browser memory and each request sends only the required model features.
                    </p>
                </div>

                {(fileError || simulationError) && (
                    <div className="mt-4 flex gap-2.5 rounded-md border border-rose-300/20 bg-rose-300/[0.06] p-3.5 text-xs leading-5 text-danger" role="alert">
                        <AlertCircle aria-hidden="true" className="mt-0.5 shrink-0" size={15} />
                        <p>{fileError || simulationError}</p>
                    </div>
                )}

                <div className="mt-5 flex flex-wrap items-center gap-2 border-t border-line/[0.07] pt-5">
                    <button
                        className="inline-flex min-h-10 items-center justify-center gap-2 rounded-md border border-teal-200/20 bg-teal-300 px-4 text-xs font-semibold text-[#062029] transition hover:bg-teal-200 disabled:cursor-not-allowed disabled:opacity-45"
                        disabled={!canStart || simulationStatus === 'completed'}
                        onClick={() => startSimulation(simulationStatus === 'error' ? processedResults.length : 0)}
                        type="button"
                    >
                        <CirclePlay aria-hidden="true" size={16} />
                        {failedTransaction ? 'Retry Current Transaction' : 'Start Simulation'}
                    </button>
                    <button
                        className="inline-flex min-h-10 items-center justify-center gap-2 rounded-md border border-line/[0.12] px-4 text-xs font-medium text-body transition hover:bg-wash/[0.05] disabled:cursor-not-allowed disabled:opacity-40"
                        disabled={!canPause || simulationStatus === 'pausing'}
                        onClick={simulationStatus === 'paused' ? resumeSimulation : pauseSimulation}
                        type="button"
                    >
                        {simulationStatus === 'paused' ? <CirclePlay aria-hidden="true" size={16} /> : <CirclePause aria-hidden="true" size={16} />}
                        {simulationStatus === 'pausing' ? 'Pausing…' : simulationStatus === 'paused' ? 'Resume' : 'Pause'}
                    </button>
                    <button
                        className="inline-flex min-h-10 items-center justify-center gap-2 rounded-md border border-rose-200/15 px-4 text-xs font-medium text-danger transition hover:bg-rose-200/[0.06] disabled:cursor-not-allowed disabled:opacity-40"
                        disabled={!canStop}
                        onClick={stopAndReset}
                        type="button"
                    >
                        {simulationStatus === 'running' || simulationStatus === 'pausing' ? <Square aria-hidden="true" size={14} /> : <RotateCcw aria-hidden="true" size={15} />}
                        Stop / Reset
                    </button>
                    <span className="ml-auto inline-flex items-center gap-2 text-[11px] text-muted" role="status">
                        {isBusy && <LoaderCircle aria-hidden="true" className="animate-spin text-success" size={14} />}
                        {simulationStatus === 'idle' && 'Choose a CSV to prepare a replay.'}
                        {simulationStatus === 'loading' && 'Validating CSV in memory…'}
                        {simulationStatus === 'ready' && `${transactions.length} transactions ready.`}
                        {simulationStatus === 'running' && `Processing ${currentTransaction ?? processedResults.length + 1} of ${transactions.length}.`}
                        {simulationStatus === 'pausing' && 'Finishing the current request before pausing…'}
                        {simulationStatus === 'paused' && `Paused after ${processedResults.length} processed.`}
                        {simulationStatus === 'completed' && 'Replay complete.'}
                        {simulationStatus === 'error' && !fileError && `Stopped at transaction ${failedTransaction ?? processedResults.length + 1}.`}
                        {simulationStatus === 'error' && fileError && 'CSV validation failed.'}
                    </span>
                </div>
            </section>

            <section aria-labelledby="monitoring-summary-title">
                <div className="mb-4 flex flex-wrap items-end justify-between gap-3">
                    <div>
                        <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-muted">Replay session</p>
                        <h3 id="monitoring-summary-title" className="mt-2 font-display text-xl font-semibold text-ink">Monitoring Summary</h3>
                    </div>
                    <span className="text-xs text-muted">{processedResults.length} of {transactions.length} processed</span>
                </div>

                <div className="grid grid-cols-2 gap-3 xl:grid-cols-4">
                    <SummaryCard title="Total Transactions Processed" value={processedResults.length} detail="Successful API responses" />
                    <SummaryCard title="Normal Transactions" value={normalTransactions} detail="From completed predictions" tone="text-success" />
                    <SummaryCard title="Suspicious Transactions" value={suspiciousResults.length} detail="Anomaly signals only" tone="text-warning" />
                    <SummaryCard title="Suspicious Rate" value={suspiciousRate === null ? '—' : `${(suspiciousRate * 100).toFixed(2)}%`} detail="Among processed responses" tone="text-info" />
                </div>
            </section>

            <div className="grid items-start gap-5 xl:grid-cols-[minmax(0,1.35fr)_minmax(280px,0.65fr)]">
                <section aria-labelledby="transaction-feed-title" className="overflow-hidden rounded-lg border border-line/[0.08] bg-panel/90 shadow-panel">
                    <div className="border-b border-line/[0.07] px-4 py-4 sm:px-5">
                        <h3 id="transaction-feed-title" className="font-display text-base font-semibold text-ink">Transaction Feed</h3>
                        <p className="mt-1 text-xs text-muted">Only successful API responses are counted as processed.</p>
                    </div>
                    <div className="max-h-[460px] overflow-auto">
                        <table className="min-w-[760px] w-full border-collapse text-left text-xs">
                            <thead className="sticky top-0 z-10 bg-table text-[10px] uppercase tracking-[0.1em] text-muted">
                                <tr>
                                    <th className="px-3 py-3 font-semibold">Transaction</th>
                                    <th className="px-3 py-3 text-right font-semibold">Amount</th>
                                    <th className="px-3 py-3 font-semibold">Model</th>
                                    <th className="px-3 py-3 font-semibold">Prediction</th>
                                    <th className="px-3 py-3 text-right font-semibold">Score</th>
                                    <th className="px-3 py-3 font-semibold">Status</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-line/[0.06]">
                                {transactions.map((transaction, index) => {
                                    const transactionNumber = index + 1
                                    const result = resultsByTransaction.get(transactionNumber)
                                    const rowStatus = result
                                        ? 'Processed'
                                        : failedTransaction === transactionNumber
                                            ? 'Request failed'
                                            : currentTransaction === transactionNumber
                                                ? 'Analyzing'
                                                : 'Queued'
                                    return (
                                        <tr className={`transition-colors ${result?.is_anomaly ? 'bg-amber-200/[0.035]' : 'hover:bg-wash/[0.02]'}`} key={transactionNumber}>
                                            <td className="px-3 py-3 font-mono text-muted">{transactionNumber}</td>
                                            <td className="px-3 py-3 text-right font-mono text-body">{formatAmount(transaction.Amount)}</td>
                                            <td className="px-3 py-3 text-muted">{result ? MODEL_LABELS[result.selected_model] : MODEL_LABELS[selectedModel]}</td>
                                            <td className={`px-3 py-3 font-medium ${result?.is_anomaly ? 'text-warning' : result ? 'text-success' : 'text-muted'}`}>
                                                {result?.prediction || '—'}
                                            </td>
                                            <td className="px-3 py-3 text-right font-mono text-body">{result ? result.anomaly_score.toFixed(6) : '—'}</td>
                                            <td className="px-3 py-3">
                                                <span className={`inline-flex items-center gap-1.5 ${rowStatus === 'Processed' ? result?.is_anomaly ? 'text-warning' : 'text-success' : rowStatus === 'Request failed' ? 'text-danger' : rowStatus === 'Analyzing' ? 'text-info' : 'text-muted'}`}>
                                                    {rowStatus === 'Processed'
                                                        ? <CheckCircle2 aria-hidden="true" size={13} />
                                                        : rowStatus === 'Analyzing'
                                                            ? <LoaderCircle aria-hidden="true" className="animate-spin" size={13} />
                                                            : null}
                                                    {rowStatus}
                                                </span>
                                            </td>
                                        </tr>
                                    )
                                })}
                                {transactions.length === 0 && (
                                    <tr>
                                        <td className="px-4 py-10 text-center text-xs text-muted" colSpan={6}>
                                            Validated transactions will appear here when a CSV is loaded.
                                        </td>
                                    </tr>
                                )}
                            </tbody>
                        </table>
                    </div>
                </section>

                <aside aria-labelledby="suspicious-activity-title" className="rounded-lg border border-line/[0.08] bg-panel/90 p-4 shadow-panel sm:p-5">
                    <div className="flex items-center gap-3 border-b border-line/[0.07] pb-4">
                        <span className="flex h-9 w-9 items-center justify-center rounded-md border border-amber-300/15 bg-amber-300/10 text-warning">
                            <ShieldAlert aria-hidden="true" size={17} />
                        </span>
                        <div>
                            <h3 id="suspicious-activity-title" className="font-display text-base font-semibold text-ink">Recent Suspicious Activity</h3>
                            <p className="mt-1 text-[11px] text-muted">Anomaly results, not confirmed fraud.</p>
                        </div>
                    </div>
                    <div className="mt-4 space-y-2.5">
                        {suspiciousResults.length > 0 ? (
                            [...suspiciousResults].reverse().slice(0, 10).map((result) => (
                                <div className="rounded-md border border-amber-200/10 bg-amber-200/[0.035] p-3" key={result.transactionNumber}>
                                    <div className="flex items-center justify-between gap-3">
                                        <p className="text-xs font-semibold text-warning">Transaction {result.transactionNumber}</p>
                                        <span className="font-mono text-[11px] text-warning">{result.anomaly_score.toFixed(6)}</span>
                                    </div>
                                    <p className="mt-1.5 text-[10px] leading-4 text-muted">
                                        Score met the {MODEL_LABELS[result.selected_model]} threshold. Review is required; this is not a fraud confirmation.
                                    </p>
                                </div>
                            ))
                        ) : (
                            <div className="flex min-h-[150px] flex-col items-center justify-center px-3 text-center">
                                <ShieldAlert aria-hidden="true" className="text-muted" size={20} />
                                <p className="mt-3 text-xs font-medium text-body">No suspicious results yet</p>
                                <p className="mt-1.5 max-w-xs text-[11px] leading-5 text-muted">
                                    This panel will list Suspicious predictions returned during this replay.
                                </p>
                            </div>
                        )}
                    </div>
                </aside>
            </div>
        </div>
    )
}
