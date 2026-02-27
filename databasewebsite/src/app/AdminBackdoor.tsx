"use client";

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';

export default function AdminBackdoor() {
    const [modalOpen, setModalOpen] = useState(false);
    const [code, setCode] = useState('');
    const [error, setError] = useState(false);
    const router = useRouter();

    const handleCodeSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        if (code === '060911') {
            setModalOpen(false);
            setCode('');
            router.push('/admin/ingestion');
        } else {
            setError(true);
            setTimeout(() => setError(false), 1000);
        }
    };

    useEffect(() => {
        const handleKey = (e: KeyboardEvent) => {
            if (e.key === 'Escape') setModalOpen(false);
        };
        window.addEventListener('keydown', handleKey);
        return () => window.removeEventListener('keydown', handleKey);
    }, []);

    return (
        <>
            {/* Hidden Backdoor Trigger */}
            <button
                onClick={() => setModalOpen(true)}
                style={{
                    position: 'fixed',
                    bottom: '16px',
                    left: '16px',
                    zIndex: 50,
                    background: 'none',
                    border: 'none',
                    cursor: 'pointer',
                    padding: '4px',
                    opacity: 0.2,
                    transition: 'opacity 0.2s ease',
                    lineHeight: 1,
                    color: '#0D0D0D',
                }}
                onMouseEnter={e => (e.currentTarget.style.opacity = '0.5')}
                onMouseLeave={e => (e.currentTarget.style.opacity = '0.2')}
                aria-label="System access"
            >
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <rect width="18" height="11" x="3" y="11" rx="2" ry="2" />
                    <path d="M7 11V7a5 5 0 0 1 10 0v4" />
                </svg>
            </button>

            {/* Admin Modal */}
            {modalOpen && (
                <div
                    style={{
                        position: 'fixed', inset: 0, zIndex: 100,
                        backgroundColor: 'rgba(13,13,13,0.3)',
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                        backdropFilter: 'blur(4px)',
                    }}
                    onClick={() => setModalOpen(false)}
                >
                    <div
                        style={{
                            backgroundColor: '#FBFBF2',
                            border: '1px solid #0D0D0D',
                            borderRadius: '12px',
                            padding: '2rem',
                            width: '100%',
                            maxWidth: '320px',
                            boxShadow: '0 8px 40px rgba(13,13,13,0.12)',
                        }}
                        onClick={e => e.stopPropagation()}
                    >
                        <p style={{ fontFamily: "'Playfair Display', serif", fontSize: '1.2rem', fontWeight: 700, marginBottom: '0.5rem' }}>
                            System Access
                        </p>
                        <p style={{ fontFamily: "'Inter', sans-serif", fontSize: '0.8rem', color: '#888880', marginBottom: '1.25rem' }}>
                            Enter access code to continue.
                        </p>
                        <form onSubmit={handleCodeSubmit}>
                            <input
                                autoFocus
                                type="password"
                                value={code}
                                onChange={e => setCode(e.target.value)}
                                placeholder="••••••"
                                style={{
                                    width: '100%',
                                    padding: '0.625rem 1rem',
                                    border: error ? '1px solid #e74c3c' : '1px solid #0D0D0D',
                                    borderRadius: '8px',
                                    fontFamily: "'Inter', sans-serif",
                                    fontSize: '1rem',
                                    backgroundColor: '#FBFBF2',
                                    color: '#0D0D0D',
                                    outline: 'none',
                                    marginBottom: '1rem',
                                    letterSpacing: '0.15em',
                                    transition: 'border-color 0.2s ease',
                                }}
                            />
                            <button
                                type="submit"
                                style={{
                                    width: '100%',
                                    padding: '0.625rem',
                                    backgroundColor: '#0D0D0D',
                                    color: '#FBFBF2',
                                    border: '1px solid #0D0D0D',
                                    borderRadius: '9999px',
                                    fontFamily: "'Inter', sans-serif",
                                    fontSize: '0.875rem',
                                    fontWeight: 500,
                                    cursor: 'pointer',
                                }}
                            >
                                Enter
                            </button>
                        </form>
                    </div>
                </div>
            )}
        </>
    );
}
