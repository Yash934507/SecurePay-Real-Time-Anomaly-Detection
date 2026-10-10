import {
  Activity,
  Bell,
  ChartNoAxesCombined,
  LayoutDashboard,
  ScanSearch,
  Settings,
  ShieldCheck,
} from 'lucide-react'

const navigation = [
  { label: 'Dashboard', icon: LayoutDashboard },
  { label: 'Transaction Analysis', icon: ScanSearch },
  { label: 'Live Monitoring', icon: Activity },
  { label: 'Fraud Alerts', icon: Bell },
  { label: 'Model Performance', icon: ChartNoAxesCombined },
  { label: 'Settings', icon: Settings },
]

export default function Sidebar({ activePage, isOpen, onNavigate, onClose }) {
  return (
    <>
      {isOpen && (
        <button
          aria-label="Close navigation menu"
          className="fixed inset-0 z-40 bg-slate-950/70 lg:hidden"
          onClick={onClose}
          type="button"
        />
      )}
      <aside
        aria-label="Main sidebar"
        className={`fixed inset-y-0 left-0 z-50 flex w-[268px] flex-col border-r border-line/[0.07] bg-sidebar transition-transform duration-200 lg:translate-x-0 ${isOpen ? 'translate-x-0' : '-translate-x-full'
          }`}
        id="securepay-sidebar"
      >
        <div className="flex h-[88px] items-center gap-3 border-b border-line/[0.07] px-6">
          <div className="flex h-10 w-10 items-center justify-center border border-teal-300/25 bg-teal-300/10 text-success">
            <ShieldCheck aria-hidden="true" size={22} strokeWidth={1.8} />
          </div>
          <div>
            <p className="font-display text-lg font-semibold tracking-[0.01em] text-ink">SecurePay</p>
            <p className="mt-0.5 text-[10px] font-semibold uppercase tracking-[0.17em] text-muted">
              Transaction security
            </p>
          </div>
        </div>

        <div className="px-4 pt-7">
          <p className="px-3 text-[10px] font-semibold uppercase tracking-[0.18em] text-muted">
            Workspace
          </p>
          <nav aria-label="Primary navigation" className="mt-3 space-y-1">
            {navigation.map(({ label, icon: Icon }) => {
              const isActive = activePage === label
              return (
                <button
                  aria-current={isActive ? 'page' : undefined}
                  className={`group flex min-h-11 w-full items-center gap-3 border px-3 text-left text-sm transition-colors ${isActive
                    ? 'border-teal-300/15 bg-teal-300/[0.09] font-medium text-success'
                    : 'border-transparent text-muted hover:border-line/[0.06] hover:bg-wash/[0.035] hover:text-body'
                    }`}
                  key={label}
                  onClick={() => {
                    onNavigate(label)
                    onClose()
                  }}
                  type="button"
                >
                  <Icon
                    aria-hidden="true"
                    className={isActive ? 'text-success' : 'text-muted group-hover:text-body'}
                    size={18}
                    strokeWidth={1.8}
                  />
                  <span className="flex-1">{label}</span>
                </button>
              )
            })}
          </nav>
        </div>

        <div className="mt-auto border-t border-line/[0.07] px-6 py-5">
          <div className="flex items-center gap-2 text-xs text-muted">
            <span aria-hidden="true" className="h-1.5 w-1.5 bg-amber-300" />
            Frontend prototype
          </div>
          <p className="mt-2 text-[11px] leading-5 text-muted">
            Historical replay and single requests only; no live feed.
          </p>
        </div>
      </aside>
    </>
  )
}
