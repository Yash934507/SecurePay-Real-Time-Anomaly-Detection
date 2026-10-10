import { createContext, useContext, useReducer, useRef } from 'react'
import { analysisReducer, createInitialAnalysisState } from './analysisState'

const AnalysisContext = createContext(null)

export function AnalysisProvider({ children }) {
    const [state, dispatch] = useReducer(analysisReducer, undefined, createInitialAnalysisState)
    const generationRef = useRef(0)
    // Async callers keep the recorder from the render that started their request.
    const generation = generationRef.current

    function recordSinglePrediction(prediction, { source = 'Single', reference = null } = {}) {
        if (generation !== generationRef.current) return
        if (
            !prediction ||
            !['Normal', 'Suspicious'].includes(prediction.prediction) ||
            typeof prediction.is_anomaly !== 'boolean' ||
            !Number.isFinite(prediction.anomaly_score) ||
            !['lof', 'isolation_forest'].includes(prediction.selected_model)
        ) {
            return
        }

        dispatch({
            type: 'record-single',
            prediction,
            source,
            reference,
            receivedAt: new Date(),
        })
    }

    function recordBatchAnalysis(batch) {
        if (generation !== generationRef.current) return
        if (
            !batch ||
            !Array.isArray(batch.results) ||
            !Number.isInteger(batch.total_transactions) ||
            !Number.isInteger(batch.normal_transactions) ||
            !Number.isInteger(batch.suspicious_transactions) ||
            batch.total_transactions !== batch.normal_transactions + batch.suspicious_transactions ||
            batch.results.length !== batch.total_transactions ||
            !['lof', 'isolation_forest'].includes(batch.selected_model)
        ) {
            return
        }

        dispatch({ type: 'record-batch', batch, receivedAt: new Date() })
    }

    function clearAnalysisResults() {
        generationRef.current += 1
        dispatch({ type: 'clear' })
    }

    return (
        <AnalysisContext.Provider value={{ ...state, recordSinglePrediction, recordBatchAnalysis, clearAnalysisResults }}>
            {children}
        </AnalysisContext.Provider>
    )
}

export function useAnalysis() {
    const context = useContext(AnalysisContext)
    if (!context) {
        throw new Error('useAnalysis must be used inside AnalysisProvider.')
    }
    return context
}
