import type { Metadata } from 'next'
import { Inter, Playfair_Display } from 'next/font/google'
import './globals.css'
import AdminBackdoor from './AdminBackdoor'
import { HeaderWrapper, FooterWrapper } from './LayoutWrappers'

const inter = Inter({ subsets: ['latin'], variable: '--font-inter', display: 'swap' })
const playfair = Playfair_Display({
    subsets: ['latin'],
    variable: '--font-playfair',
    style: ['normal', 'italic'],
    display: 'swap',
})

export const metadata: Metadata = {
    title: 'SAT Synthesis — Digital Question Engine',
    description: 'Entity-swap pipeline for generating copyright-free SAT questions at scale.',
}

export default function RootLayout({
    children,
}: {
    children: React.ReactNode
}) {
    return (
        <html lang="en" className={`${inter.variable} ${playfair.variable}`}>
            <body className={inter.className} style={{ backgroundColor: '#FBFBF2', color: '#0D0D0D', margin: 0 }}>

                {/* ── Header ───────────────────────────────────────────── */}
                <HeaderWrapper>
                    <header style={{ backgroundColor: '#FBFBF2', borderBottom: '1px solid #0D0D0D' }} className="sticky top-0 z-40">
                        <div style={{ maxWidth: '1100px', margin: '0 auto', padding: '0 1.5rem', display: 'flex', height: '3.5rem', alignItems: 'center', justifyContent: 'space-between' }}>
                            <a href="/" style={{ textDecoration: 'none', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                                <span style={{
                                    fontFamily: "'Playfair Display', serif",
                                    fontWeight: 700,
                                    fontSize: '1.05rem',
                                    letterSpacing: '-0.01em',
                                    color: '#0D0D0D',
                                }}>
                                    SAT Synthesis
                                </span>
                            </a>
                            <nav style={{ display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
                                <a
                                    href="/"
                                    style={{
                                        fontFamily: "'Inter', sans-serif",
                                        fontSize: '0.8rem',
                                        fontWeight: 500,
                                        color: '#555550',
                                        padding: '0.3rem 0.8rem',
                                        borderRadius: '9999px',
                                        textDecoration: 'none',
                                        transition: 'all 0.15s ease',
                                    }}
                                >
                                    Home
                                </a>
                            </nav>
                        </div>
                    </header>
                </HeaderWrapper>

                {/* ── Main ─────────────────────────────────────────────── */}
                <main>
                    {children}
                </main>

                {/* ── Footer ───────────────────────────────────────────── */}
                <FooterWrapper>
                    <footer style={{ borderTop: '1px solid #D0D0C8', backgroundColor: '#FBFBF2', marginTop: '6rem' }}>
                        <div style={{
                            maxWidth: '1100px',
                            margin: '0 auto',
                            padding: '2rem 1.5rem',
                            display: 'flex',
                            flexWrap: 'wrap',
                            alignItems: 'center',
                            justifyContent: 'space-between',
                            gap: '1rem',
                        }}>
                            <p style={{ fontFamily: "'Inter', sans-serif", fontSize: '0.72rem', color: '#888880', margin: 0 }}>
                                © 2025 Digital SAT Synthesis. All rights reserved.
                            </p>
                            <div style={{ display: 'flex', gap: '1.5rem' }}>
                                <a href="#" style={{ fontFamily: "'Inter', sans-serif", fontSize: '0.72rem', color: '#888880', textDecoration: 'none' }}>Privacy Policy</a>
                                <a href="#" style={{ fontFamily: "'Inter', sans-serif", fontSize: '0.72rem', color: '#888880', textDecoration: 'none' }}>Terms of Use</a>
                            </div>
                        </div>
                    </footer>
                </FooterWrapper>

                {/* ── Hidden Admin Backdoor (Client Component) ─────────── */}
                <AdminBackdoor />

            </body>
        </html>
    )
}
