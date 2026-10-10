import assert from 'node:assert/strict'
import {
    analysisReducer,
    createInitialAnalysisState,
    MAX_ACTIVITY_EVENTS,
    MAX_RECENT_SUSPICIOUS,
} from '../src/context/analysisState.js'

function singleAction(id, isAnomaly, timeOffset = id) {
    const receivedAt = new Date(Date.UTC(2026, 9, 9, 0, 0, timeOffset))
    return {
        type: 'record-single',
        source: 'Single',
        reference: `Transaction ${id}`,
        receivedAt,
        prediction: {
            selected_model: 'lof',
            prediction: isAnomaly ? 'Suspicious' : 'Normal',
            is_anomaly: isAnomaly,
            anomaly_score: isAnomaly ? 4.2 : 0.9,
            threshold: 3.1,
        },
    }
}

let state = createInitialAnalysisState()
assert.equal(state.totalAnalyzed, 0)
assert.deepEqual(state.activity, [])

state = analysisReducer(state, singleAction(1, false))
state = analysisReducer(state, singleAction(2, true))
assert.equal(state.totalAnalyzed, 2)
assert.equal(state.normalPredictions, 1)
assert.equal(state.suspiciousPredictions, 1)
assert.equal(state.suspiciousRate, 50)
assert.equal(state.activity.length, 2)
assert.equal(state.recentSuspicious[0].reference, 'Transaction 2')
assert.equal(state.recentSuspicious[0].analysisTime, new Date(Date.UTC(2026, 9, 9, 0, 0, 2)).toISOString())

const batchTime = new Date(Date.UTC(2026, 9, 9, 0, 1, 0))
state = analysisReducer(state, {
    type: 'record-batch',
    receivedAt: batchTime,
    batch: {
        selected_model: 'isolation_forest',
        total_transactions: 3,
        normal_transactions: 2,
        suspicious_transactions: 1,
        results: [
            { row_number: 1, is_anomaly: false, prediction: 'Normal', anomaly_score: 0.1, threshold: 0.6 },
            { row_number: 2, is_anomaly: true, prediction: 'Suspicious', anomaly_score: 0.9, threshold: 0.6 },
            { row_number: 3, is_anomaly: false, prediction: 'Normal', anomaly_score: 0.2, threshold: 0.6 },
        ],
    },
})
assert.equal(state.totalAnalyzed, 5)
assert.equal(state.normalPredictions, 3)
assert.equal(state.suspiciousPredictions, 2)
assert.equal(state.suspiciousRate, 40)
assert.equal(state.activity.length, 3)
assert.equal(state.activity[state.activity.length - 1].transactionCount, 3)
assert.equal(state.activity[state.activity.length - 1].source, 'CSV Batch')
assert.equal(state.activity[state.activity.length - 1].analysisTime, batchTime.toISOString())
assert.equal(state.recentSuspicious[0].reference, 'CSV row 2')
assert.equal(Object.prototype.hasOwnProperty.call(state.recentSuspicious[0], 'features'), false)

state = createInitialAnalysisState()
for (let index = 1; index <= MAX_ACTIVITY_EVENTS + 5; index += 1) {
    state = analysisReducer(state, singleAction(index, true, index))
}
assert.equal(state.totalAnalyzed, MAX_ACTIVITY_EVENTS + 5)
assert.equal(state.activity.length, MAX_ACTIVITY_EVENTS)
assert.equal(state.recentSuspicious.length, MAX_RECENT_SUSPICIOUS)
assert.equal(state.recentSuspicious[0].reference, `Transaction ${MAX_ACTIVITY_EVENTS + 5}`)

state = analysisReducer(state, { type: 'clear' })
assert.deepEqual(state, createInitialAnalysisState())

console.log('Session state tests passed: single counts, batch grouping, suspicious rate, bounded histories, and clear.')