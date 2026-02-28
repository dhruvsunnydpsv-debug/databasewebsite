"use client";

import { useEffect, useState } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import { useAuth } from '@/lib/auth-context';
import Link from 'next/link';
import { 
    LayoutDashboard, 
    BookOpen, 
    Upload, 
    LogOut, 
    Settings, 
    AlertCircle,
    UserCheck
} from 'lucide-react';

export default function AdminLayout({ children }: { children: React.ReactNode }) {
    const { user, profile, loading, signOut } = useAuth();
    const router = useRouter();
    const pathname = usePathname();
    const [isClient, setIsClient] = useState(false);

    useEffect(() => {
        setIsClient(true);
    }, []);

    useEffect(() => {
        if (!loading && isClient) {
            if (!user) {
                router.push('/login');
            } else if (profile && profile.role !== 'admin') {
                router.push('/');
            }
        }
    }, [user, profile, loading, router, isClient]);

    if (!isClient || loading) {
        return (
            <div style={{
                height: '100vh',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                backgroundColor: '#FBFBF2'
            }}>
                <div style={{
                    width: '32px',
                    height: '32px',
                    border: '3px solid #0D0D0D',
                    borderTop: '3px solid transparent',
                    borderRadius: '50%',
                    animation: 'spin 1s linear infinite'
                }} />
                <style>{`
                    @keyframes spin {
                        0% { transform: rotate(0deg); }
                        100% { transform: rotate(360deg); }
                    }
                `}</style>
            </div>
        );
    }

    if (!user || (profile && profile.role !== 'admin')) {
        return null; // Redirecting...
    }

    const NavItem = ({ href, icon: Icon, label }: { href: string, icon: any, label: string }) => {
        const isActive = pathname === href;
        return (
            <Link 
                href={href}
                style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '0.75rem',
                    padding: '0.75rem 1rem',
                    textDecoration: 'none',
                    color: isActive ? '#FBFBF2' : '#555550',
                    backgroundColor: isActive ? '#0D0D0D' : 'transparent',
                    borderRadius: '8px',
                    fontSize: '0.9rem',
                    fontWeight: isActive ? 600 : 500,
                    transition: 'all 0.2s ease',
                    marginBottom: '0.25rem'
                }}
            >
                <Icon size={18} strokeWidth={isActive ? 2.5 : 2} />
                {label}
            </Link>
        );
    };

    return (
        <div style={{ display: 'flex', minHeight: '100vh', backgroundColor: '#FBFBF2' }}>
            {/* Sidebar */}
            <aside style={{
                width: '260px',
                borderRight: '1px solid #D0D0C8',
                padding: '1.5rem',
                display: 'flex',
                flexDirection: 'column',
                position: 'fixed',
                height: '100vh',
                backgroundColor: '#FBFBF2',
                zIndex: 50
            }}>
                <div style={{ marginBottom: '2.5rem', padding: '0 0.5rem' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '0.25rem' }}>
                        <div style={{
                            width: '32px',
                            height: '32px',
                            backgroundColor: '#0D0D0D',
                            color: '#FBFBF2',
                            borderRadius: '8px',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            fontWeight: 900,
                            fontSize: '1rem'
                        }}>S</div>
                        <h2 style={{
                            fontFamily: "'Playfair Display', serif",
                            fontSize: '1.2rem',
                            fontWeight: 900,
                            margin: 0
                        }}>SAT Portal</h2>
                    </div>
                    <p style={{ fontSize: '0.65rem', color: '#888880', fontWeight: 600, letterSpacing: '0.05em', textTransform: 'uppercase', marginTop: '0.25rem' }}>
                        Admin Dashboard v2.0
                    </p>
                </div>

                <nav style={{ flex: 1 }}>
                    <NavItem href="/admin" icon={LayoutDashboard} label="Dashboard" />
                    <NavItem href="/admin/questions" icon={BookOpen} label="Manage Questions" />
                    <NavItem href="/admin/bulk-upload" icon={Upload} label="Bulk Upload" />
                    <div style={{ height: '1px', backgroundColor: '#D0D0C8', margin: '1.5rem 0.5rem' }} />
                    <NavItem href="/admin/audit" icon={AlertCircle} label="Audit Logs" />
                    <NavItem href="/admin/ingest" icon={Settings} label="Legacy Ingest" />
                </nav>

                <div style={{ marginTop: 'auto' }}>
                    <div style={{
                        padding: '1rem',
                        backgroundColor: '#F5F5ED',
                        borderRadius: '12px',
                        marginBottom: '1rem',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '0.75rem'
                    }}>
                        <div style={{
                            width: '32px',
                            height: '32px',
                            borderRadius: '50%',
                            backgroundColor: '#D0D0C8',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center'
                        }}>
                            <UserCheck size={16} />
                        </div>
                        <div style={{ overflow: 'hidden' }}>
                            <p style={{ fontSize: '0.8rem', fontWeight: 600, margin: 0, textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                                {user.email?.split('@')[0]}
                            </p>
                            <p style={{ fontSize: '0.65rem', color: '#888880', margin: 0 }}>Administrator</p>
                        </div>
                    </div>
                    <button 
                        onClick={() => signOut()}
                        style={{
                            display: 'flex',
                            alignItems: 'center',
                            gap: '0.75rem',
                            padding: '0.75rem 1rem',
                            width: '100%',
                            textAlign: 'left',
                            backgroundColor: 'transparent',
                            border: '1px solid #D0D0C8',
                            color: '#E74C3C',
                            borderRadius: '8px',
                            fontSize: '0.9rem',
                            fontWeight: 600,
                            cursor: 'pointer',
                            transition: 'all 0.2s ease'
                        }}
                    >
                        <LogOut size={18} />
                        Logout
                    </button>
                </div>
            </aside>

            {/* Main Content */}
            <main style={{
                marginLeft: '260px',
                flex: 1,
                padding: '3rem',
                maxWidth: '1200px',
                minWidth: 0
            }}>
                {children}
            </main>
        </div>
    );
}
