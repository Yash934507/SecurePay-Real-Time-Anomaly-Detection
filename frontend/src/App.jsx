import { lazy, Suspense, useState } from 'react'
import { PreferencesProvider } from './context/PreferencesContext'
import { AnalysisProvider } from './context/AnalysisContext'
import Layout from './components/Layout'
import Dashboard from './pages/Dashboard'
import TransactionAnalysis from './pages/TransactionAnalysis'
import LiveMonitoring from './pages/LiveMonitoring'
import FraudAlerts from './pages/FraudAlerts'
import Settings from './pages/Settings'

const ModelPerformance = lazy(() => import('./pages/ModelPerformance'))

export default function App() {
  const [activePage, setActivePage] = useState('Dashboard')

  return (
    <PreferencesProvider>
    <AnalysisProvider>
      <Layout activePage={activePage} onNavigate={setActivePage}>
        {activePage === 'Dashboard' ? (
          <Dashboard />
        ) : activePage === 'Transaction Analysis' ? (
          <TransactionAnalysis />
        ) : activePage === 'Live Monitoring' ? (
          <LiveMonitoring />
        ) : activePage === 'Fraud Alerts' ? (
          <FraudAlerts />
        ) : activePage === 'Model Performance' ? (
          <Suspense fallback={<p role="status" className="text-sm text-muted">Loading model evaluation…</p>}>
            <ModelPerformance />
          </Suspense>
        ) : (
          <Settings />
        )}
      </Layout>
    </AnalysisProvider>
    </PreferencesProvider>
  )
}
