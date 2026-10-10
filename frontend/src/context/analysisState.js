export const MAX_ACTIVITY_EVENTS = 100
export const MAX_RECENT_SUSPICIOUS = 20

export function createInitialAnalysisState() {
    return {
        totalAnalyzed: 0,
        normalPredictions: 0,
        suspiciousPredictions: 0,
        suspiciousRate: 0,
        activity: [],
        recentSuspicious: [],
        nextEventId: 1,
    }
}

export function analysisReducer(state, action) {
    if (action.type === 'clear') {
        return createInitialAnalysisState()
    }

    if (action.type === 'record-single') {
        const { prediction, source, reference, receivedAt } = action
        const isSuspicious = prediction.is_anomaly
        const totalAnalyzed = state.totalAnalyzed + 1
        const normalPredictions = state.normalPredictions + (isSuspicious ? 0 : 1)
        const suspiciousPredictions = state.suspiciousPredictions + (isSuspicious ? 1 : 0)
        const activityEvent = {
            id: state.nextEventId,
            timestamp: receivedAt.getTime(),
            analysisTime: receivedAt.toISOString(),
            source,
            transactionCount: 1,
            normalCount: isSuspicious ? 0 : 1,
            suspiciousCount: isSuspicious ? 1 : 0,
        }
        const suspiciousEvent = isSuspicious
            ? [{
                id: state.nextEventId,
                source,
                reference: reference || null,
                selectedModel: prediction.selected_model,
                anomalyScore: prediction.anomaly_score,
                analysisTime: receivedAt.toISOString(),
            }]
            : []

        return {
            totalAnalyzed,
            normalPredictions,
            suspiciousPredictions,
            suspiciousRate: suspiciousPredictions / totalAnalyzed * 100,
            activity: [...state.activity, activityEvent].slice(-MAX_ACTIVITY_EVENTS),
            recentSuspicious: [...suspiciousEvent, ...state.recentSuspicious].slice(0, MAX_RECENT_SUSPICIOUS),
            nextEventId: state.nextEventId + 1,
        }
    }

    if (action.type === 'record-batch') {
        const { batch, receivedAt } = action
        const totalAnalyzed = state.totalAnalyzed + batch.total_transactions
        const normalPredictions = state.normalPredictions + batch.normal_transactions
        const suspiciousPredictions = state.suspiciousPredictions + batch.suspicious_transactions
        const batchId = state.nextEventId
        const activityEvent = {
            id: batchId,
            timestamp: receivedAt.getTime(),
            analysisTime: receivedAt.toISOString(),
            source: 'CSV Batch',
            transactionCount: batch.total_transactions,
            normalCount: batch.normal_transactions,
            suspiciousCount: batch.suspicious_transactions,
        }
        const suspiciousEvents = batch.results
            .filter((row) => row.is_anomaly)
            .map((row, index) => ({
                id: `${batchId}-${index}`,
                source: 'CSV Batch',
                reference: `CSV row ${row.row_number}`,
                selectedModel: batch.selected_model,
                anomalyScore: row.anomaly_score,
                analysisTime: receivedAt.toISOString(),
            }))

        return {
            totalAnalyzed,
            normalPredictions,
            suspiciousPredictions,
            suspiciousRate: totalAnalyzed === 0 ? 0 : suspiciousPredictions / totalAnalyzed * 100,
            activity: [...state.activity, activityEvent].slice(-MAX_ACTIVITY_EVENTS),
            recentSuspicious: [...suspiciousEvents, ...state.recentSuspicious].slice(0, MAX_RECENT_SUSPICIOUS),
            nextEventId: state.nextEventId + 1,
        }
    }

    return state
}