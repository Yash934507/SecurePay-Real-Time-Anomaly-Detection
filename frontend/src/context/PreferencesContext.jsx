import { createContext, useContext, useLayoutEffect, useState } from 'react'

const PreferencesContext = createContext(null)

export function PreferencesProvider({ children }) {
    const [theme, setTheme] = useState('dark')
    const [defaultModel, setDefaultModel] = useState('lof')
    const [defaultSpeed, setDefaultSpeed] = useState(1000)

    useLayoutEffect(() => {
        document.documentElement.dataset.theme = theme
    }, [theme])

    return <PreferencesContext.Provider value={{ theme, setTheme, defaultModel, setDefaultModel, defaultSpeed, setDefaultSpeed }}>{children}</PreferencesContext.Provider>
}

export function usePreferences() {
    const context = useContext(PreferencesContext)
    if (!context) throw new Error('usePreferences must be used inside PreferencesProvider.')
    return context
}
