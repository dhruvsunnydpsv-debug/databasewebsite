'use client';
import { useEffect, useState } from 'react';
import { createClient } from '@/lib/supabase-browser';

type Entry = {
    user_id: string;
    display: string;
    composite_score: number;
    rw_score: number;
    math_score: number;
    created_at: string;
};

function fmt(iso: string) {
    return new Date(iso).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
}

const MEDALS = ['🥇', '🥈', '🥉'];

export default function LeaderboardPage() {
    const supabase = createClient();
    const [entries, setEntries] = useState<Entry[]>([]);
    const [loading, setLoading] = useState(true);
    const [user, setUser] = useState<any>(null);

    useEffect(() => {
        supabase.auth.getUser().then(({ data }) => setUser(data.user));
        fetch('/api/leaderboard')
            .then(r => r.json())
            .then(({ data }) => { setEntries(data ?? []); setLoading(false); });
    }, []);

    return (
        <div className="min-h-screen bg-[#F8F7F2] text-[#0A0A0A]">
            {/* Nav */}
            <nav className="w-full h-[64px] flex items-center justify-between px-6 sm:px-12 border-b border-black/6 bg-white/80 backdrop-blur-md sticky top-0 z-40">
                <a href="/" className="flex items-center gap-2">
                    <div className="w-7 h-7 bg-[#0A0A0A] rounded-lg flex items-center justify-center">
                        <span className="text-white text-[10px] font-black">SF</span>
                    </div>
                    <span className="font-serif text-lg font-black tracking-tight">SAT Foundation</span>
                </a>
                <div className="flex items-center gap-2">
                    {user ? (
                        <>
                            <a href="/dashboard" className="text-sm font-medium text-gray-500 hover:text-black transition-colors px-3 py-2">Dashboard</a>
                            <a href="/test/session" className="px-5 py-2 bg-[#0A0A0A] text-white rounded-full text-sm font-bold hover:bg-[#222] transition-all">
                                New Test →
                            </a>
                        </>
                    ) : (
                        <a href="/login" className="px-5 py-2 bg-[#0A0A0A] text-white rounded-full text-sm font-bold hover:bg-[#222] transition-all">
                            Sign In →
                        </a>
                    )}
                </div>
            </nav>

            <div className="max-w-3xl mx-auto px-6 sm:px-12 py-14">
                {/* Header */}
                <div className="mb-10 text-center">
                    <p className="text-[11px] font-black uppercase tracking-[0.2em] text-gray-400 mb-3">Global Rankings</p>
                    <h1 className="font-serif text-5xl font-black tracking-tight mb-3">Leaderboard</h1>
                    <p className="text-gray-400 text-sm max-w-sm mx-auto">
                        Best score per competitor. Rankings update in real time after every completed test.
                    </p>
                </div>

                {loading ? (
                    <div className="flex justify-center py-20">
                        <div className="w-8 h-8 border-[3px] border-[#0A0A0A] border-t-transparent rounded-full animate-spin" />
                    </div>
                ) : entries.length === 0 ? (
                    <div className="bg-white border border-black/5 rounded-2xl p-16 text-center">
                        <p className="text-4xl mb-4">🏆</p>
                        <p className="font-semibold text-lg mb-2">No scores yet</p>
                        <p className="text-gray-400 text-sm mb-6">Be the first on the board.</p>
                        <a href={user ? "/test/session" : "/login"} className="inline-block px-8 py-3 bg-[#0A0A0A] text-white font-bold rounded-full text-sm">
                            {user ? "Take a Test →" : "Sign In to Compete →"}
                        </a>
                    </div>
                ) : (
                    <>
                        {/* Top 3 podium */}
                        {entries.length >= 3 && (
                            <div className="grid grid-cols-3 gap-4 mb-8">
                                {[entries[1], entries[0], entries[2]].map((e, i) => {
                                    const rank = i === 1 ? 1 : i === 0 ? 2 : 3;
                                    const isMe = user && e.user_id === user.id;
                                    const heights = ['h-28', 'h-36', 'h-24'];
                                    return (
                                        <div key={e.user_id} className={`bg-white border rounded-2xl flex flex-col items-center justify-end px-4 py-5 ${heights[i]} ${isMe ? 'border-blue-300 ring-2 ring-blue-200' : 'border-black/5'} ${rank === 1 ? 'shadow-lg' : 'shadow-sm'}`}>
                                            <span className="text-2xl mb-1">{MEDALS[rank - 1]}</span>
                                            <p className="font-mono text-lg font-black text-[#0A0A0A]">{e.composite_score}</p>
                                            <p className="text-[11px] text-gray-400 font-medium truncate max-w-full text-center mt-0.5">
                                                {isMe ? 'You' : e.display}
                                            </p>
                                            <p className="text-[10px] text-gray-300 mt-0.5">#{rank}</p>
                                        </div>
                                    );
                                })}
                            </div>
                        )}

                        {/* Full table */}
                        <div className="bg-white border border-black/5 rounded-2xl overflow-hidden">
                            <div className="grid grid-cols-12 px-5 py-3 border-b border-black/4 text-[10px] font-black uppercase tracking-widest text-gray-400">
                                <span className="col-span-1">#</span>
                                <span className="col-span-4">Competitor</span>
                                <span className="col-span-3 text-right">Composite</span>
                                <span className="col-span-2 text-right">R&amp;W</span>
                                <span className="col-span-2 text-right">Math</span>
                            </div>
                            {entries.map((e, i) => {
                                const isMe = user && e.user_id === user.id;
                                return (
                                    <div key={e.user_id}
                                        className={`grid grid-cols-12 items-center px-5 py-4 border-b border-black/3 last:border-0 transition-colors
                                            ${isMe ? 'bg-blue-50 border-l-2 border-l-blue-400' : 'hover:bg-[#F8F7F2]'}`}>
                                        <span className="col-span-1 font-mono text-xs text-gray-300 font-bold">
                                            {i < 3 ? MEDALS[i] : `${i + 1}`}
                                        </span>
                                        <div className="col-span-4">
                                            <p className={`text-sm font-semibold ${isMe ? 'text-blue-700' : 'text-[#0A0A0A]'}`}>
                                                {isMe ? 'You' : e.display}
                                            </p>
                                            <p className="text-[10px] text-gray-400">{fmt(e.created_at)}</p>
                                        </div>
                                        <div className="col-span-3 text-right">
                                            <span className={`font-mono text-lg font-black ${i === 0 ? 'text-yellow-500' : i === 1 ? 'text-gray-400' : i === 2 ? 'text-amber-600' : 'text-[#0A0A0A]'}`}>
                                                {e.composite_score}
                                            </span>
                                        </div>
                                        <span className="col-span-2 text-right font-mono text-sm font-bold text-blue-500">{e.rw_score}</span>
                                        <span className="col-span-2 text-right font-mono text-sm font-bold text-purple-500">{e.math_score}</span>
                                    </div>
                                );
                            })}
                        </div>

                        {/* Your rank (if not in top 20) */}
                        {user && !entries.find(e => e.user_id === user.id) && (
                            <p className="text-center text-xs text-gray-400 mt-6">
                                Complete a test to appear on the leaderboard.{' '}
                                <a href="/test/session" className="text-[#0A0A0A] font-bold hover:underline">Start now →</a>
                            </p>
                        )}
                    </>
                )}
            </div>
        </div>
    );
}
