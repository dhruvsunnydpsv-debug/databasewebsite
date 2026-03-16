'use client';
import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase-browser';

type Session = {
  id: string;
  rw_score: number;
  math_score: number;
  composite_score: number;
  rw_higher_path: boolean;
  math_higher_path: boolean;
  total_time_seconds: number;
  domain_scores: Record<string, { correct: number; total: number }>;
  answers: { domain: string; difficulty: string; is_correct: boolean }[];
  completed_at: string;
};

function fmtDate(iso: string) {
  return new Date(iso).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' });
}
function fmtTime(s: number) {
  const m = Math.floor(s / 60); const sec = s % 60;
  return `${m}m ${sec.toString().padStart(2, '0')}s`;
}
function scoreColor(score: number, max: number) {
  const p = score / max;
  if (p >= 0.85) return 'text-emerald-600';
  if (p >= 0.70) return 'text-blue-600';
  if (p >= 0.55) return 'text-yellow-600';
  return 'text-red-500';
}
function barColor(pct: number) {
  if (pct >= 75) return 'bg-emerald-500';
  if (pct >= 55) return 'bg-yellow-400';
  return 'bg-red-400';
}

const ALL_DOMAINS = [
  'Algebra', 'Advanced Math', 'Problem-solving and Data Analysis', 'Geometry and Trigonometry',
  'Information and Ideas', 'Craft and Structure', 'Expression of Ideas', 'Standard English Conventions',
];

export default function HistoryPage() {
  const router = useRouter();
  const supabase = createClient();
  const [sessions, setSessions] = useState<Session[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [user, setUser] = useState<any>(null);
  const [expanded, setExpanded] = useState<string | null>(null);

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => {
      if (!data.user) { router.push('/login'); return; }
      setUser(data.user);
      supabase
        .from('user_test_sessions')
        .select('*')
        .eq('user_id', data.user.id)
        .order('completed_at', { ascending: false })
        .limit(50)
        .then(({ data: rows, error: err }) => {
          if (err) setError(err.message);
          else setSessions((rows ?? []) as Session[]);
          setLoading(false);
        });
    });
  }, []);

  const best = sessions.length ? Math.max(...sessions.map(s => s.composite_score)) : null;
  const avg = sessions.length ? Math.round(sessions.reduce((a, s) => a + s.composite_score, 0) / sessions.length) : null;
  const latest = sessions[0];
  const prev = sessions[1];
  const trend = latest && prev ? latest.composite_score - prev.composite_score : null;

  // Aggregate domain accuracy
  const domainAgg: Record<string, { correct: number; total: number }> = {};
  for (const s of sessions) {
    for (const [d, stats] of Object.entries(s.domain_scores || {})) {
      if (!domainAgg[d]) domainAgg[d] = { correct: 0, total: 0 };
      domainAgg[d].correct += stats.correct;
      domainAgg[d].total += stats.total;
    }
  }

  if (loading) return (
    <div className="min-h-screen bg-[#F8F7F2] flex items-center justify-center">
      <div className="flex flex-col items-center gap-3">
        <div className="w-8 h-8 border-[3px] border-[#0A0A0A] border-t-transparent rounded-full animate-spin" />
        <p className="text-sm text-gray-400 font-medium">Loading your scores…</p>
      </div>
    </div>
  );

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
          <a href="/dashboard" className="text-sm font-medium text-gray-500 hover:text-black transition-colors px-3 py-2">Dashboard</a>
          <a href="/leaderboard" className="text-sm font-medium text-gray-500 hover:text-black transition-colors px-3 py-2 hidden sm:block">Leaderboard</a>
          <button onClick={() => router.push('/test/session')} className="px-5 py-2 bg-[#0A0A0A] text-white rounded-full text-sm font-bold hover:bg-[#222] transition-all">
            New Test →
          </button>
          <button onClick={() => supabase.auth.signOut().then(() => router.push('/'))} className="text-xs text-gray-400 hover:text-gray-700 px-2 py-2 transition-colors font-medium">
            Sign out
          </button>
        </div>
      </nav>

      <div className="max-w-5xl mx-auto px-6 sm:px-12 py-12">

        {/* Header */}
        <div className="mb-10 flex items-end justify-between gap-4 flex-wrap">
          <div>
            <h1 className="font-serif text-4xl font-black tracking-tight mb-1">Score History</h1>
            <p className="text-gray-400 text-sm">
              {user?.user_metadata?.full_name || user?.email?.split('@')[0] || 'Competitor'} · {sessions.length} test{sessions.length !== 1 ? 's' : ''} completed
            </p>
          </div>
          {sessions.length > 0 && (
            <a href="/leaderboard" className="text-sm font-bold text-gray-400 hover:text-black transition-colors border border-black/8 rounded-full px-4 py-2 bg-white">
              View Leaderboard →
            </a>
          )}
        </div>

        {error && (
          <div className="bg-red-50 border border-red-200 rounded-xl px-5 py-4 mb-6 text-sm text-red-700 font-medium">
            ⚠ Error loading sessions: {error}
          </div>
        )}

        {sessions.length === 0 && !error ? (
          <div className="bg-white border border-black/5 rounded-3xl p-16 text-center">
            <div className="w-16 h-16 bg-[#F8F7F2] rounded-2xl flex items-center justify-center mx-auto mb-5">
              <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="#9CA3AF" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="22 12 18 12 15 21 9 3 6 12 2 12"/></svg>
            </div>
            <h2 className="font-serif text-2xl font-black mb-2">No tests yet</h2>
            <p className="text-gray-400 text-sm mb-8 max-w-sm mx-auto">Complete your first adaptive test to start tracking your progress and competing on the leaderboard.</p>
            <button onClick={() => router.push('/test/session')} className="px-10 py-3.5 bg-[#0A0A0A] text-white font-bold rounded-full text-sm hover:bg-[#222] transition-all">
              Start Your First Test →
            </button>
          </div>
        ) : sessions.length > 0 && (
          <>
            {/* Stats row */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-8">
              {[
                { label: 'Best Score', value: best, suffix: '/ 1600', color: 'text-[#0A0A0A]' },
                { label: 'Average Score', value: avg, suffix: '/ 1600', color: 'text-[#0A0A0A]' },
                { label: 'Tests Taken', value: sessions.length, suffix: '', color: 'text-[#0A0A0A]' },
                {
                  label: 'Last vs Previous',
                  value: trend !== null ? (trend >= 0 ? `+${trend}` : `${trend}`) : '—',
                  suffix: trend !== null ? 'pts' : '',
                  color: trend !== null ? (trend >= 0 ? 'text-emerald-600' : 'text-red-500') : 'text-gray-300',
                },
              ].map((s, i) => (
                <div key={i} className="bg-white border border-black/5 rounded-2xl px-5 py-5">
                  <p className={`font-mono text-3xl font-black leading-none mb-1 ${s.color}`}>{s.value}</p>
                  {s.suffix && <p className="text-[10px] text-gray-400 mb-1">{s.suffix}</p>}
                  <p className="text-[10px] font-bold uppercase tracking-widest text-gray-400">{s.label}</p>
                </div>
              ))}
            </div>

            {/* Score progression sparkline */}
            {sessions.length > 1 && (
              <div className="bg-white border border-black/5 rounded-2xl p-6 mb-8">
                <p className="text-[10px] font-black uppercase tracking-widest text-gray-400 mb-4">Score Progression (most recent → oldest)</p>
                <div className="flex items-end gap-2 h-16">
                  {[...sessions].reverse().map((s, i) => {
                    const h = Math.round((s.composite_score / 1600) * 100);
                    const isLatest = i === sessions.length - 1;
                    return (
                      <div key={s.id} className="flex flex-col items-center gap-1 flex-1 group relative">
                        <div className="absolute -top-7 left-1/2 -translate-x-1/2 bg-[#0A0A0A] text-white text-[9px] font-bold px-2 py-0.5 rounded opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap z-10">
                          {s.composite_score}
                        </div>
                        <div
                          className={`w-full rounded-t transition-all ${isLatest ? 'bg-[#0A0A0A]' : 'bg-black/15 hover:bg-black/30'}`}
                          style={{ height: `${Math.max(h, 8)}%` }}
                        />
                        <span className="text-[8px] text-gray-300 font-mono">{i + 1}</span>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-8">
              {/* Domain heatmap */}
              <div className="lg:col-span-2 bg-white border border-black/5 rounded-2xl p-6">
                <p className="text-[10px] font-black uppercase tracking-widest text-gray-400 mb-5">Cumulative Domain Accuracy</p>
                <div className="flex flex-col gap-3">
                  {ALL_DOMAINS.map(domain => {
                    const stats = domainAgg[domain] || { correct: 0, total: 0 };
                    const pct = stats.total > 0 ? Math.round((stats.correct / stats.total) * 100) : null;
                    return (
                      <div key={domain} className="flex items-center gap-3">
                        <span className="text-xs text-gray-500 w-44 truncate flex-shrink-0">{domain}</span>
                        <div className="flex-1 h-1.5 bg-black/4 rounded-full overflow-hidden">
                          <div className={`h-full rounded-full transition-all ${pct !== null ? barColor(pct) : 'bg-gray-100'}`}
                            style={{ width: `${pct ?? 0}%` }} />
                        </div>
                        <span className={`font-mono text-xs font-bold w-10 text-right flex-shrink-0 ${pct !== null ? (pct >= 75 ? 'text-emerald-600' : pct >= 55 ? 'text-yellow-600' : 'text-red-500') : 'text-gray-200'}`}>
                          {pct !== null ? `${pct}%` : '—'}
                        </span>
                        <span className="text-[10px] text-gray-300 w-12 text-right flex-shrink-0">{stats.total > 0 ? `${stats.correct}/${stats.total}` : '—'}</span>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Best test card */}
              {latest && (
                <div className="flex flex-col gap-4">
                  <div className="bg-white border border-black/5 rounded-2xl p-6">
                    <p className="text-[10px] font-black uppercase tracking-widest text-gray-400 mb-4">Latest Test</p>
                    <p className={`font-mono text-5xl font-black mb-1 ${scoreColor(latest.composite_score, 1600)}`}>{latest.composite_score}</p>
                    <p className="text-xs text-gray-400 mb-5">out of 1600</p>
                    <div className="flex gap-5 mb-4">
                      <div>
                        <p className="font-mono text-xl font-black text-blue-600">{latest.rw_score}</p>
                        <p className="text-[10px] font-bold uppercase tracking-widest text-gray-400">R&amp;W</p>
                      </div>
                      <div>
                        <p className="font-mono text-xl font-black text-purple-600">{latest.math_score}</p>
                        <p className="text-[10px] font-bold uppercase tracking-widest text-gray-400">Math</p>
                      </div>
                    </div>
                    <div className="flex flex-wrap gap-1.5">
                      <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${latest.rw_higher_path ? 'bg-blue-50 text-blue-600' : 'bg-gray-100 text-gray-500'}`}>
                        R&amp;W {latest.rw_higher_path ? 'Hard' : 'Standard'}
                      </span>
                      <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${latest.math_higher_path ? 'bg-purple-50 text-purple-600' : 'bg-gray-100 text-gray-500'}`}>
                        Math {latest.math_higher_path ? 'Hard' : 'Standard'}
                      </span>
                    </div>
                  </div>
                  <button onClick={() => router.push('/test/session')}
                    className="w-full py-4 bg-[#0A0A0A] text-white font-bold rounded-2xl text-sm hover:bg-[#222] transition-all">
                    Start New Test →
                  </button>
                </div>
              )}
            </div>

            {/* Session list */}
            <div className="flex flex-col gap-3">
              <p className="text-[10px] font-black uppercase tracking-widest text-gray-400 mb-1">All Tests</p>
              {sessions.map((s, idx) => {
                const isOpen = expanded === s.id;
                const correct = s.answers?.filter(a => a.is_correct).length ?? 0;
                const total = s.answers?.length ?? 0;
                const domains = Object.entries(s.domain_scores || {}).sort((a, b) =>
                  (a[1].total > 0 ? a[1].correct / a[1].total : 0) - (b[1].total > 0 ? b[1].correct / b[1].total : 0)
                );
                const isPersonalBest = s.composite_score === best && idx === sessions.findIndex(x => x.composite_score === best);

                return (
                  <div key={s.id} className={`bg-white rounded-2xl border overflow-hidden transition-all ${isPersonalBest ? 'border-amber-200 ring-1 ring-amber-100' : 'border-black/5'}`}>
                    <button
                      onClick={() => setExpanded(isOpen ? null : s.id)}
                      className="w-full flex items-center justify-between px-6 py-5 hover:bg-[#F8F7F2] transition-colors text-left"
                    >
                      <div className="flex items-center gap-5 flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-shrink-0">
                          <span className="font-mono text-xs text-gray-300">{String(idx + 1).padStart(2, '0')}</span>
                          {isPersonalBest && <span className="text-[9px] font-black text-amber-600 bg-amber-50 px-1.5 py-0.5 rounded-full uppercase tracking-wider">PB</span>}
                        </div>
                        <div className="flex-shrink-0">
                          <p className={`font-mono text-2xl font-black leading-none ${scoreColor(s.composite_score, 1600)}`}>{s.composite_score}</p>
                          <p className="text-[9px] text-gray-400 mt-0.5">/ 1600</p>
                        </div>
                        <div className="hidden sm:flex gap-5">
                          <div>
                            <p className="font-mono text-sm font-bold text-blue-600">{s.rw_score}</p>
                            <p className="text-[9px] text-gray-400 font-bold uppercase tracking-wider">R&amp;W</p>
                          </div>
                          <div>
                            <p className="font-mono text-sm font-bold text-purple-600">{s.math_score}</p>
                            <p className="text-[9px] text-gray-400 font-bold uppercase tracking-wider">Math</p>
                          </div>
                        </div>
                        <div className="hidden md:block text-xs text-gray-400">
                          {correct}/{total} correct · {fmtTime(s.total_time_seconds)}
                        </div>
                      </div>
                      <div className="flex items-center gap-3 flex-shrink-0">
                        <span className="text-xs text-gray-400 hidden sm:block">{fmtDate(s.completed_at)}</span>
                        <svg className={`w-4 h-4 text-gray-400 transition-transform ${isOpen ? 'rotate-180' : ''}`} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="6 9 12 15 18 9"/></svg>
                      </div>
                    </button>

                    {isOpen && (
                      <div className="border-t border-black/4 px-6 pb-6 pt-5">
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                          {domains.map(([domain, stats]) => {
                            const pct = stats.total > 0 ? Math.round((stats.correct / stats.total) * 100) : 0;
                            const bg = pct >= 70 ? 'bg-emerald-50 text-emerald-700' : pct >= 50 ? 'bg-yellow-50 text-yellow-700' : 'bg-red-50 text-red-600';
                            return (
                              <div key={domain} className="flex items-center justify-between bg-[#F8F7F2] rounded-xl px-4 py-3">
                                <div className="flex items-center gap-3 min-w-0">
                                  <div className="flex-1 min-w-0">
                                    <p className="text-sm font-medium text-gray-700 truncate">{domain}</p>
                                    <div className="mt-1 h-1 bg-black/5 rounded-full overflow-hidden w-full">
                                      <div className={`h-full rounded-full ${barColor(pct)}`} style={{ width: `${pct}%` }} />
                                    </div>
                                  </div>
                                </div>
                                <div className="flex items-center gap-2 ml-3 flex-shrink-0">
                                  <span className="text-[10px] text-gray-400">{stats.correct}/{stats.total}</span>
                                  <span className={`text-xs font-black px-2 py-0.5 rounded-full ${bg}`}>{pct}%</span>
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </>
        )}
      </div>
    </div>
  );
}
