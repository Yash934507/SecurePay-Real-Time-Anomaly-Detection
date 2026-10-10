const API_BASE_URL = (
    import.meta.env.VITE_API_BASE_URL || 'http://127.0.0.1:8000'
).replace(/\/+$/, '')

export class PredictionApiError extends Error {
    constructor(message, status = null) {
        super(message)
        this.name = 'PredictionApiError'
        this.status = status
    }
}

function formatValidationError(detail) {
    if (typeof detail === 'string') {
        return detail
    }
    if (!Array.isArray(detail) || detail.length === 0) {
        return 'Check the transaction values and try again.'
    }

    const firstError = detail[0]
    const location = Array.isArray(firstError.loc) ? firstError.loc : []
    const fieldName = location.length > 0 ? location[location.length - 1] : null
    const message = String(firstError.msg || 'The value is invalid.').replace(/^Value error,\s*/i, '')

    return fieldName ? `Please check ${fieldName}: ${message}` : message
}

async function postForPrediction(path, options) {
    let response

    try {
        response = await fetch(`${API_BASE_URL}${path}`, options)
    } catch {
        throw new PredictionApiError(
            'Could not connect to the SecurePay API. Confirm the backend is running and try again.',
        )
    }

    let responseBody
    try {
        responseBody = await response.json()
    } catch {
        throw new PredictionApiError('The SecurePay API returned an unreadable response.', response.status)
    }

    if (!response.ok) {
        if (response.status === 413) {
            throw new PredictionApiError(
                typeof responseBody.detail === 'string'
                    ? responseBody.detail
                    : 'The CSV exceeds the server upload or row limit.',
                413,
            )
        }
        if (response.status === 415) {
            throw new PredictionApiError('Only CSV files are supported.', 415)
        }
        if (response.status === 422) {
            throw new PredictionApiError(formatValidationError(responseBody.detail), 422)
        }
        if (response.status === 503) {
            throw new PredictionApiError(
                'The ML prediction service is unavailable. Check the backend model setup and try again.',
                503,
            )
        }
        throw new PredictionApiError(
            'The SecurePay API could not complete this request. Please try again.',
            response.status,
        )
    }

    return responseBody
}

function isPredictionResponse(responseBody) {
    return (
        responseBody &&
        ['lof', 'isolation_forest'].includes(responseBody.selected_model) &&
        ['Normal', 'Suspicious'].includes(responseBody.prediction) &&
        typeof responseBody.is_anomaly === 'boolean' &&
        Number.isFinite(responseBody.anomaly_score) &&
        Number.isFinite(responseBody.threshold)
    )
}

export async function predictTransaction(transaction, { signal } = {}) {
    const responseBody = await postForPrediction('/predict', {
        method: 'POST',
        headers: {
            Accept: 'application/json',
            'Content-Type': 'application/json',
        },
        body: JSON.stringify(transaction),
        signal,
    })

    if (!isPredictionResponse(responseBody)) {
        throw new PredictionApiError('The SecurePay API returned an unexpected prediction format.')
    }

    return responseBody
}

export async function analyzeBatchCsv(file, model) {
    const formData = new FormData()
    formData.append('file', file)
    formData.append('model', model)

    const responseBody = await postForPrediction('/predict/batch', {
        method: 'POST',
        headers: { Accept: 'application/json' },
        body: formData,
    })

    const validRows = Array.isArray(responseBody?.results) && responseBody.results.every((row) => (
        Number.isInteger(row.row_number) &&
        row.row_number > 0 &&
        ['Normal', 'Suspicious'].includes(row.prediction) &&
        typeof row.is_anomaly === 'boolean' &&
        Number.isFinite(row.anomaly_score) &&
        Number.isFinite(row.threshold)
    ))
    const validSummary = (
        ['lof', 'isolation_forest'].includes(responseBody?.selected_model) &&
        Number.isInteger(responseBody?.total_transactions) &&
        Number.isInteger(responseBody?.normal_transactions) &&
        Number.isInteger(responseBody?.suspicious_transactions) &&
        Number.isFinite(responseBody?.suspicious_rate) &&
        responseBody.total_transactions === responseBody.results?.length &&
        responseBody.normal_transactions + responseBody.suspicious_transactions === responseBody.total_transactions &&
        responseBody.suspicious_rate >= 0 && responseBody.suspicious_rate <= 1
    )

    if (!validRows || !validSummary) {
        throw new PredictionApiError('The SecurePay API returned an unexpected batch response format.')
    }

    return responseBody
}