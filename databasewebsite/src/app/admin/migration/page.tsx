'use client';
import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';

export const dynamic = "force-dynamic";

const domains = [
    "Algebra", "Advanced Math", "Problem-solving and Data Analysis", "Geometry and Trigonometry",
    "Craft and Structure", "Information and Ideas", "Standard English Conventions", "Expression of Ideas"
];

export default function MigrationDashboard() {
    const [stats, setStats] = useState<any>(null);
    const [distribution, setDistribution] = useState<any[]>([]);
    const [logs, setLogs] = useState<string[]>([]);
    const [loading, setLoading] = useState(true);

    const addLog = (msg: string) => {
        setLogs(prev => [`[${new Date().toLocaleTimeString()}] ${msg}`, ...prev].slice(0, 50));
    };

    const [lastUpdated, setLastUpdated] = useState<string>('');

    const fetchStats = async () => {
        try {
            const res = await fetch('/api/stats', { cache: 'no-store' });
            const data = await res.json();
            
            if (data.error) throw new Error(data.error);

            setStats({ total: data.total, migrated: data.migrated });
            setDistribution(data.distribution);
            setLastUpdated(new Date().toLocaleTimeString());
            addLog(`Updated: ${data.migrated}/${data.total} migrated.`);
        } catch (err: any) {
            addLog(`Error: ${err.message}`);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchStats();
        const interval = setInterval(fetchStats, 5000); // Faster updates
        return () => clearInterval(interval);
    }, []);

    if (loading && !stats) return <div className="p-8 text-white">Loading Migration Data...</div>;

    const percent = stats?.total ? Math.round((stats.migrated / stats.total) * 100) : 0;

    return (
        <div className="min-h-screen bg-slate-900 text-white p-8 font-sans">
            <div className="max-w-6xl mx-auto">
                <header className="mb-12 flex justify-between items-end">
                    <div>
                        <h1 className="text-4xl font-extrabold bg-gradient-to-r from-blue-400 to-emerald-400 bg-clip-text text-transparent">
                            2026 SAT Syllabus Migration
                        </h1>
                        <p className="text-slate-400 mt-2 text-lg">Live Database Audit & Re-categorization Tracker</p>
                    </div>
                    <div className="text-right">
                        <p className="text-xs font-mono text-slate-500 uppercase tracking-widest">Last Update</p>
                        <p className="text-xl font-bold text-emerald-400">{lastUpdated}</p>
                    </div>
                </header>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-8 mb-12">
                    <div className="bg-slate-800 p-8 rounded-2xl border border-slate-700 shadow-xl">
                        <h3 className="text-slate-400 text-sm font-bold uppercase tracking-widest">Total Questions</h3>
                        <p className="text-5xl font-black mt-4 text-white">{stats?.total}</p>
                    </div>
                    <div className="bg-slate-800 p-8 rounded-2xl border border-slate-700 shadow-xl border-l-4 border-l-emerald-500">
                        <h3 className="text-emerald-400 text-sm font-bold uppercase tracking-widest">Migrated (2026)</h3>
                        <p className="text-5xl font-black mt-4 text-emerald-400">{stats?.migrated}</p>
                    </div>
                    <div className="bg-slate-800 p-8 rounded-2xl border border-slate-700 shadow-xl border-l-4 border-l-blue-500">
                        <h3 className="text-blue-400 text-sm font-bold uppercase tracking-widest">Completion</h3>
                        <p className="text-5xl font-black mt-4 text-blue-400">{percent}%</p>
                    </div>
                </div>

                <div className="grid grid-cols-1 lg:grid-cols-2 gap-12">
                    <div className="bg-slate-800/50 p-8 rounded-3xl border border-slate-700">
                        <h2 className="text-2xl font-bold mb-8 flex items-center">
                            <span className="w-3 h-3 bg-blue-500 rounded-full mr-3 animate-pulse"></span>
                            Syllabus Distribution
                        </h2>
                        <div className="space-y-6">
                            {distribution.map(d => (
                                <div key={d.name} className="space-y-2">
                                    <div className="flex justify-between text-sm font-medium">
                                        <span className="text-slate-300">{d.name}</span>
                                        <span className="text-slate-400 font-mono">{d.count}</span>
                                    </div>
                                    <div className="h-2 bg-slate-700 rounded-full overflow-hidden">
                                        <div 
                                            className="h-full bg-gradient-to-r from-blue-500 to-emerald-500 transition-all duration-1000"
                                            style={{ width: `${stats?.total ? (d.count / stats.total) * 100 : 0}%` }}
                                        />
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>

                    <div className="bg-slate-800/50 p-8 rounded-3xl border border-slate-700">
                        <h2 className="text-2xl font-bold mb-8">System Activity Log</h2>
                        <div className="bg-slate-950 rounded-xl p-6 h-[400px] overflow-y-auto font-mono text-xs space-y-2 border border-slate-800">
                            {logs.map((log, i) => (
                                <p key={i} className={log.includes('Error') ? 'text-red-400' : 'text-slate-500'}>
                                    <span className="text-slate-700 mr-2">&gt;</span> {log}
                                </p>
                            ))}
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}
