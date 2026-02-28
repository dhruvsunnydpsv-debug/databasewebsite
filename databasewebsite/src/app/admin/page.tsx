"use client";
export const dynamic = 'force-dynamic';

import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { 
    BookOpen, 
    CheckCircle, 
    XCircle, 
    BarChart3,
    Clock,
    PlusCircle,
    ArrowRight,
    Upload
} from 'lucide-react';
import Link from 'next/link';

interface Stats {
    total: number;
    enabled: number;
    math: number;
    readingWriting: number;
    easy: number;
    medium: number;
    hard: number;
}

export default function AdminDashboard() {
    const [stats, setStats] = useState<Stats | null>(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        async function fetchStats() {
            setLoading(true);
            const { data, error } = await supabase
                .from('sat_question_bank')
                .select('module, difficulty, is_enabled');

            if (data) {
                const s: Stats = {
                    total: data.length,
                    enabled: data.filter(q => q.is_enabled !== false).length,
                    math: data.filter(q => q.module === 'Math').length,
                    readingWriting: data.filter(q => q.module === 'Reading_Writing').length,
                    easy: data.filter(q => q.difficulty === 'Easy').length,
                    medium: data.filter(q => q.difficulty === 'Medium').length,
                    hard: data.filter(q => q.difficulty === 'Hard').length,
                };
                setStats(s);
            }
            setLoading(false);
        }
        fetchStats();
    }, []);

    const StatCard = ({ label, value, icon: Icon, color }: { label: string, value: number, icon: any, color: string }) => (
        <div style={{
            backgroundColor: '#FFF',
            padding: '1.5rem',
            borderRadius: '16px',
            border: '1px solid #D0D0C8',
            display: 'flex',
            alignItems: 'center',
            gap: '1.25rem'
        }}>
            <div style={{
                width: '48px',
                height: '48px',
                borderRadius: '12px',
                backgroundColor: `${color}15`,
                color: color,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center'
            }}>
                <Icon size={24} />
            </div>
            <div>
                <p style={{ fontSize: '0.8rem', color: '#888880', margin: 0, fontWeight: 500 }}>{label}</p>
                <h3 style={{ fontSize: '1.5rem', fontWeight: 700, margin: 0 }}>{value.toLocaleString()}</h3>
            </div>
        </div>
    );

    if (loading) return <div>Loading statistics...</div>;

    return (
        <div>
            <div style={{ marginBottom: '2.5rem' }}>
                <h1 style={{
                    fontFamily: "'Playfair Display', serif",
                    fontSize: '2.5rem',
                    fontWeight: 900,
                    marginBottom: '0.5rem'
                }}>Overview</h1>
                <p style={{ color: '#888880', fontSize: '0.95rem' }}>Analytics and status for 5,000+ SAT Question Repository.</p>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: '1.5rem', marginBottom: '3rem' }}>
                <StatCard label="Total Questions" value={stats?.total || 0} icon={BookOpen} color="#0D0D0D" />
                <StatCard label="Enabled" value={stats?.enabled || 0} icon={CheckCircle} color="#2ECC71" />
                <StatCard label="Math Section" value={stats?.math || 0} icon={BarChart3} color="#3498DB" />
                <StatCard label="R&W Section" value={stats?.readingWriting || 0} icon={Clock} color="#9B59B6" />
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1.5fr 1fr', gap: '2rem' }}>
                {/* Quick Actions */}
                <div style={{
                    backgroundColor: '#FFF',
                    padding: '2rem',
                    borderRadius: '16px',
                    border: '1px solid #0D0D0D'
                }}>
                    <h3 style={{ fontSize: '1.25rem', fontFamily: "'Playfair Display', serif", fontWeight: 700, marginBottom: '1.5rem' }}>Quick Actions</h3>
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '1rem' }}>
                        <Link href="/admin/questions?modal=create" style={{
                            display: 'flex',
                            flexDirection: 'column',
                            gap: '1rem',
                            padding: '1.5rem',
                            backgroundColor: '#FBFBF2',
                            border: '1px solid #D0D0C8',
                            borderRadius: '12px',
                            textDecoration: 'none',
                            color: '#0D0D0D',
                            transition: 'all 0.2s ease'
                        }}>
                            <PlusCircle size={24} />
                            <div>
                                <p style={{ fontSize: '0.9rem', fontWeight: 700, margin: 0 }}>Create Question</p>
                                <p style={{ fontSize: '0.75rem', color: '#888880', margin: 0 }}>Manually add a single item.</p>
                            </div>
                        </Link>
                        <Link href="/admin/bulk-upload" style={{
                            display: 'flex',
                            flexDirection: 'column',
                            gap: '1rem',
                            padding: '1.5rem',
                            backgroundColor: '#FBFBF2',
                            border: '1px solid #D0D0C8',
                            borderRadius: '12px',
                            textDecoration: 'none',
                            color: '#0D0D0D',
                            transition: 'all 0.2s ease'
                        }}>
                            <Upload size={24} />
                            <div>
                                <p style={{ fontSize: '0.9rem', fontWeight: 700, margin: 0 }}>Bulk CSV Upload</p>
                                <p style={{ fontSize: '0.75rem', color: '#888880', margin: 0 }}>Import thousands at once.</p>
                            </div>
                        </Link>
                    </div>
                </div>

                {/* Difficulty Distribution */}
                <div style={{
                    backgroundColor: '#FFF',
                    padding: '2rem',
                    borderRadius: '16px',
                    border: '1px solid #D0D0C8'
                }}>
                    <h3 style={{ fontSize: '1.25rem', fontFamily: "'Playfair Display', serif", fontWeight: 700, marginBottom: '1.5rem' }}>Difficulty</h3>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                        {[
                            { label: 'Easy', value: stats?.easy || 0, color: '#2ECC71', total: stats?.total || 1 },
                            { label: 'Medium', value: stats?.medium || 0, color: '#F1C40F', total: stats?.total || 1 },
                            { label: 'Hard', value: stats?.hard || 0, color: '#E74C3C', total: stats?.total || 1 }
                        ].map((d) => (
                            <div key={d.label}>
                                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.5rem', fontSize: '0.8rem', fontWeight: 600 }}>
                                    <span>{d.label}</span>
                                    <span>{Math.round((d.value / d.total) * 100)}%</span>
                                </div>
                                <div style={{ width: '100%', height: '8px', backgroundColor: '#F5F5ED', borderRadius: '4px', overflow: 'hidden' }}>
                                    <div style={{ width: `${(d.value / d.total) * 100}%`, height: '100%', backgroundColor: d.color }} />
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            </div>
        </div>
    );
}
