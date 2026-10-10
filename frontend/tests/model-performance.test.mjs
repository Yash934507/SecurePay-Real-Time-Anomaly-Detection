import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { modelPerformance, comparisonChartData, performanceMetrics, evaluation, formatPercent } from '../src/data/modelPerformance.js'

const report = readFileSync(new URL('../../performance_analysis_report.md', import.meta.url), 'utf8')
const notebook = JSON.parse(readFileSync(new URL('../../real_time_anomaly_detection.ipynb', import.meta.url), 'utf8'))
const metadata = JSON.parse(readFileSync(new URL('../../models/metadata.json', import.meta.url), 'utf8'))
const evaluationOutput = notebook.cells[11].outputs.map((output) => (output.text || output.data?.['text/plain'] || []).join('')).join('\n')
for (const model of modelPerformance) {
    const name = model.name.replace(' (LOF)', '')
    const matrix = report.match(new RegExp(name + ': `\\s*\\[\\[\\s*(\\d+)\\s+(\\d+)\\]\\s*\\[\\s*(\\d+)\\s+(\\d+)\\]\\]'))
    assert.ok(matrix, `${name}: source matrix present`)
    const [tn, fp, fn, tp] = matrix.slice(1).map(Number)
    assert.deepEqual(model.confusion, { tn, fp, fn, tp })
    assert.equal(tn + fp + fn + tp, evaluation.testRows)
    assert.equal(fn + tp, evaluation.testFraud)
    assert.equal(model.threshold, metadata.thresholds[name])
    const reportLine = report.split('\n').find((line) => line.startsWith(name) && /\d/.test(line))
    const reportMetrics = reportLine.slice(name.length).trim().split(/\s+/).map(Number)
    assert.ok(evaluationOutput.includes(reportLine.trimEnd()), 'Notebook and report agree')
    for (const [index, { key }] of performanceMetrics.entries()) {
        assert.equal(Number(model[key].toFixed(4)), reportMetrics[index + 1], `${name} ${key} agrees with report rounding`)
        assert.equal(comparisonChartData[index][model.id], model[key], 'Chart agrees with cards')
        assert.ok(model[key] >= 0 && model[key] <= 1)
    }
    assert.equal(model.precision, tp / (tp + fp))
    assert.equal(model.recall, tp / (tp + fn))
    assert.equal(model.f1, 2 * tp / (2 * tp + fp + fn))
}
for (const { key } of performanceMetrics) assert.ok(modelPerformance[1][key] > modelPerformance[0][key], 'LOF conclusion holds')
assert.equal(formatPercent(modelPerformance[0].recall), '29.59%')
assert.equal(formatPercent(modelPerformance[1].f1), '36.57%')
assert.equal(evaluation.trainRows + evaluation.validationRows + evaluation.testRows, evaluation.datasetRows)
console.log('Model performance source checks passed: report/notebook agreement, exact confusion counts, thresholds, metrics, chart data, split totals, and LOF conclusion.')
