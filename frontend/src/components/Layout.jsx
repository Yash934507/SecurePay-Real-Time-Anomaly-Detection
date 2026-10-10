import { useState } from 'react'
import Header from './Header'
import Sidebar from './Sidebar'

export default function Layout({ activePage, onNavigate, children }) {
    const [isSidebarOpen, setIsSidebarOpen] = useState(false)

    return (
        <div className="min-h-screen">
            <Sidebar
                activePage={activePage}
                isOpen={isSidebarOpen}
                onNavigate={onNavigate}
                onClose={() => setIsSidebarOpen(false)}
            />
            <div className="min-h-screen lg:pl-[268px]">
                <Header
                    activePage={activePage}
                    isSidebarOpen={isSidebarOpen}
                    onMenuToggle={() => setIsSidebarOpen((open) => !open)}
                />
                <main className="mx-auto w-full max-w-[1500px] px-4 pb-14 pt-7 sm:px-6 sm:pt-9 lg:px-9 lg:pt-10">
                    {children}
                </main>
            </div>
        </div>
    )
}