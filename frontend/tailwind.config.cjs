/** @type {import('tailwindcss').Config} */
module.exports = {
    content: ['./index.html', './src/**/*.{js,jsx}'],
    theme: {
        extend: {
            // Semantic RGB tokens support Tailwind opacity modifiers in both themes.
            colors: Object.fromEntries([
                'canvas', 'panel', 'field', 'sidebar', 'table', 'ink', 'body', 'muted',
                'success', 'warning', 'info', 'danger', 'line', 'wash', 'control',
            ].map((name) => [name, `rgb(var(--${name}) / <alpha-value>)`])),
            fontFamily: {
                display: ['Space Grotesk', 'DM Sans', 'sans-serif'],
                sans: ['DM Sans', 'sans-serif'],
            },
        },
    },
    plugins: [],
}
