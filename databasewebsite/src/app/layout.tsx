import type { Metadata } from 'next'
import { Inter } from 'next/font/google'
import './globals.css'

const inter = Inter({ subsets: ['latin'] })

export const metadata: Metadata = {
    title: 'Digital SAT Admin | Synthesis Platform',
    description: 'Automated SAT Question Generation and Ingestion Engine',
}

export default function RootLayout({
    children,
}: {
    children: React.ReactNode
}) {
    return (
        <html lang="en">
            <body className={inter.className}>
                <div className="min-h-screen bg-slate-50">
                    <header className="sticky top-0 z-40 border-b bg-white">
                        <div className="container mx-auto flex h-16 items-center px-4 md:px-6">
                            <div className="mr-4 hidden md:flex">
                                <a className="flex items-center space-x-2" href="/">
                                    <span className="hidden font-bold sm:inline-block">SAT Admin Synthesis</span>
                                </a>
                            </div>
                            <div className="flex flex-1 items-center justify-between space-x-2 md:justify-end">
                                <nav className="flex items-center space-x-6 text-sm font-medium">
                                    <a className="transition-colors hover:text-foreground/80 text-foreground" href="/admin/ingestion">Ingestion Dropzone</a>
                                </nav>
                            </div>
                        </div>
                    </header>
                    <main className="container mx-auto py-6 px-4 md:px-6">
                        {children}
                    </main>
                </div>
            </body>
        </html>
    )
}
