import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

const css = readFileSync(new URL('../src/index.css', import.meta.url), 'utf8')
const luminance = (rgb) => rgb.map((value) => {
    const channel = value / 255
    return channel <= 0.04045 ? channel / 12.92 : ((channel + 0.055) / 1.055) ** 2.4
}).reduce((sum, value, index) => sum + value * [0.2126, 0.7152, 0.0722][index], 0)

for (const selector of [':root', ":root[data-theme='light']"]) {
    const block = css.slice(css.indexOf(`${selector} {`)).split('}')[0]
    const tokens = Object.fromEntries([...block.matchAll(/--([a-z-]+): (\d+) (\d+) (\d+);/g)].map((match) => [match[1], match.slice(2).map(Number)]))
    for (const foreground of ['ink', 'body', 'muted', 'success', 'warning', 'info', 'danger']) {
        for (const background of ['canvas', 'panel', 'field', 'sidebar', 'table']) {
            const a = luminance(tokens[foreground])
            const b = luminance(tokens[background])
            const contrast = (Math.max(a, b) + 0.05) / (Math.min(a, b) + 0.05)
            assert.ok(contrast >= 4.5, `${selector}: ${foreground} on ${background} = ${contrast.toFixed(2)}:1`)
        }
    }
}
console.log('Theme contrast passed: 70 semantic text/surface pairs meet WCAG AA 4.5:1 for normal text.')
