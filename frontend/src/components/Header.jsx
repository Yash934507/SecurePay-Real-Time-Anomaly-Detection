import { Menu, ShieldCheck, X } from 'lucide-react'

export default function Header({ activePage, isSidebarOpen, onMenuToggle }) {
    return (
        <header className="sticky top-0 z-30 flex min-h-[76px] items-center justify-between border-b border-line/[0.07] bg-canvas/90 px-4 backdrop-blur-md sm:px-6 lg:px-9">
            <div className="flex min-w-0 items-center gap-3 sm:gap-4">
                <button
                    aria-controls="securepay-sidebar"
                    aria-expanded={isSidebarOpen}
                    aria-label={isSidebarOpen ? 'Close navigation menu' : 'Open navigation menu'}
                    className="flex h-10 w-10 shrink-0 items-center justify-center border border-line/10 text-body transition hover:bg-wash/[0.06] hover:text-ink lg:hidden"
                    onClick={onMenuToggle}
                    type="button"
                >
                    {isSidebarOpen ? <X aria-hidden="true" size={19} /> : <Menu aria-hidden="true" size={19} />}
                </button>
                <div className="min-w-0">
                    <p className="hidden text-[10px] font-semibold uppercase tracking-[0.18em] text-muted sm:block">
                        SecurePay / Internship project
                    </p>
                    <h1 className="truncate font-display text-base font-semibold text-ink sm:mt-1 sm:text-lg">
                        {activePage}
                    </h1>
                </div>
            </div>

            <div className="flex shrink-0 items-center gap-2.5 sm:gap-3">
                <div className="hidden items-center gap-2 text-sm font-semibold text-body sm:flex">
                    <ShieldCheck aria-hidden="true" className="text-success" size={18} />
                    SecurePay
                </div>
                <span className="border border-amber-200/15 bg-amber-200/[0.06] px-2.5 py-1.5 text-[10px] font-semibold uppercase tracking-[0.1em] text-warning sm:text-[11px]">
                    Prototype
                </span>
            </div>
        </header>
    )
}