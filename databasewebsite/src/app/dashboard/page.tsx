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

function fmt(iso: string) {
  return new Date(iso).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
}
function fmtTime(s: number) {
  const m = Math.floor(s / 60); const sec = s % 60;
  return `${m}m ${sec.toString().padStart(2, '0')}s`;
}

const ALL_DOMAINS = [
  'Algebra', 'Advanced Math', 'Problem-solving and Data Analysis', 'Geometry and Trigonometry',
  'Information and Ideas', 'Craft and Structure', 'Expression of Ideas', 'Standard English Conventions',
];

export default function DashboardPage() {
  const router = useRouter();
  const supabase = createClient();
  const [user, setUser] = useState<any>(null);
  const [sessions, setSessions] = useState<Session[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => {
      if (!data.user) { router.push('/login'); return; }
      setUser(data.user);
      supabase
        .from('user_test_sessions')
        .select('*')
        .eq('user_id', data.user.id)
        .order('completed_at', { ascending: false })
        .limit(20)
        .then(({ data: rows, error: err }) => {
          if (err) setError(err.message);
          else setSessions((rows ?? []) as Session[]);
          setLoading(false);
        });
    });
  }, []);

  if (loading) return (
    <div className="min-h-screen bg-[#F8F7F2] flex items-center justify-center">
      <div className="flex flex-col items-center gap-3">
        <div className="w-8 h-8 border-[3px] border-[#0A0A0A] border-t-transparent rounded-full animate-spin" />
        <p className="text-sm text-gray-400 font-medium">Loading your dashboard…</p>
      </div>
    </div>
  );

  const displayName = user?.user_metadata?.full_name?.split(' ')[0] || user?.email?.split('@')[0] || 'there';
  const best = sessions.length ? Math.max(...sessions.map(s => s.composite_score)) : null;
  const avg = sessions.length ? Math.round(sessions.reduce((a, s) => a + s.composite_score, 0) / sessions.length) : null;
  const latest = sessions[0] ?? null;
  const prev = sessions[1] ?? null;
  const improvement = latest && prev ? latest.composite_score - prev.composite_score : null;

  // Aggregate domain accuracy
  const domainAgg: Record<string, { correct: number; total: number }> = {};
  for (const s of sessions) {
    for (const [domain, stats] of Object.entries(s.domain_scores || {})) {
      if (!domainAgg[domain]) domainAgg[domain] = { correct: 0, total: 0 };
      domainAgg[domain].correct += stats.correct;
      domainAgg[domain].total += stats.total;
    }
  }

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
          <a href="/leaderboard" className="text-sm font-medium text-gray-500 hover:text-black transition-colors px-3 py-2 hidden sm:block">Leaderboard</a>
          <a href="/history" className="text-sm font-medium text-gray-500 hover:text-black transition-colors px-3 py-2 hidden sm:block">All Tests</a>
          <button onClick={() => router.push('/test/session')}
            className="px-5 py-2 bg-[#0A0A0A] text-white rounded-full text-sm font-bold hover:bg-[#222] transition-all">
            New Test →
          </button>
          <button onClick={() => supabase.auth.signOut().then(() => router.push('/'))}
            className="text-xs text-gray-400 hover:text-gray-700 px-2 py-2 transition-colors font-medium">
            Sign out
          </button>
        </div>
      </nav>

      <div className="max-w-5xl mx-auto px-6 sm:px-12 py-12">

        {/* Welcome */}
        <div className="mb-10">
          <h1 className="font-serif text-4xl font-black tracking-tight mb-1">
            Welcome back, {displayName}.
          </h1>
          <p className="text-gray-400 text-sm">
            {sessions.length === 0
              ? "No tests yet — start your first one below."
              : `${sessions.length} test${sessions.length !== 1 ? 's' : ''} completed · Last attempt ${fmt(sessions[0].completed_at)}`
            }
          </p>
        </div>

        {error && (
          <div className="bg-red-50 border border-red-200 rounded-xl px-5 py-4 mb-6 text-sm text-red-700 font-medium">
            ⚠ Could not load sessions: {error}
          </div>
        )}

        {sessions.length === 0 ? (
          <div className="bg-white border border-black/5 rounded-3xl p-16 text-center">
            <div className="w-16 h-16 bg-[#F8F7F2] rounded-2xl flex items-center justify-center mx-auto mb-5">
              <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="#9CA3AF" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M9 11l3 3L22 4"/><path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11"/></svg>
            </div>
            <h2 className="font-serif text-2xl font-black mb-2">No tests yet</h2>
            <p className="text-gray-400 text-sm mb-8 max-w-sm mx-auto">Take your first full adaptive test to see your scores, domain breakdown, and leaderboard ranking.</p>
            <button onClick={() => router.push('/test/session')}
              className="px-10 py-3.5 bg-[#0A0A0A] text-white font-bold rounded-full hover:bg-[#222] transition-all text-sm">
              Start Your First Test →
            </button>
          </div>
        ) : (
          <>
            {/* Stats row */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-8">
              {[
                { label: 'Best Score', value: best, suffix: '/ 1600', color: 'text-[#0A0A0A]' },
                { label: 'Average Score', value: avg, suffix: '/ 1600', color: 'text-[#0A0A0A]' },
                { label: 'Tests Taken', value: sessions.length, suffix: '', color: 'text-[#0A0A0A]' },
                {
                  label: 'vs. Previous',
                  value: improvement !== null ? (improvement >= 0 ? `+${improvement}` : `${improvement}`) : '—',
                  suffix: improvement !== null ? 'pts' : '',
                  color: improvement !== null ? (improvement >= 0 ? 'text-emerald-600' : 'text-red-500') : 'text-gray-300',
                },
              ].map((s, i) => (
                <div key={i} className="bg-white border border-black/5 rounded-2xl px-5 py-5">
                  <p className={`font-mono text-3xl font-black leading-none mb-1 ${s.color}`}>{s.value}</p>
                  {s.suffix && <p className="text-[10px] text-gray-400 mb-1">{s.suffix}</p>}
                  <p className="text-[10px] font-bold uppercase tracking-widest text-gray-400">{s.label}</p>
                </div>
              ))}
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-8">
              {/* Domain bars */}
              <div className="lg:col-span-2 bg-white border border-black/5 rounded-2xl p-6">
                <p className="text-[10px] font-black uppercase tracking-widest text-gray-400 mb-5">Domain Performance (All Tests)</p>
                <div className="flex flex-col gap-3">
                  {ALL_DOMAINS.map(domain => {
                    const stats = domainAgg[domain] || { correct: 0, total: 0 };
                    const pct = stats.total > 0 ? Math.round((stats.correct / stats.total) * 100) : null;
                    const barCol = pct === null ? 'bg-gray-100' : pct >= 75 ? 'bg-emerald-500' : pct >= 55 ? 'bg-yellow-400' : 'bg-red-400';
                    const textCol = pct === null ? 'text-gray-200' : pct >= 75 ? 'text-emerald-600' : pct >= 55 ? 'text-yellow-600' : 'text-red-500';
                    return (
                      <div key={domain} className="flex items-center gap-3">
                        <span className="text-xs text-gray-500 w-44 truncate flex-shrink-0">{domain}</span>
                        <div className="flex-1 h-1.5 bg-black/4 rounded-full overflow-hidden">
                          <div className={`h-full rounded-full ${barCol}`} style={{ width: `${pct ?? 0}%` }} />
                        </div>
                        <span className={`font-mono text-xs font-bold w-10 text-right flex-shrink-0 ${textCol}`}>
                          {pct !== null ? `${pct}%` : '—'}
                        </span>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Right column */}
              <div className="flex flex-col gap-4">
                {latest && (
                  <div className="bg-white border border-black/5 rounded-2xl p-6">
                    <p className="text-[10px] font-black uppercase tracking-widest text-gray-400 mb-4">Latest Test</p>
                    <p className="font-mono text-4xl font-black text-[#0A0A0A] mb-0.5">{latest.composite_score}</p>
                    <p className="text-xs text-gray-400 mb-4">out of 1600 · {fmt(latest.completed_at)}</p>
                    <div className="flex gap-4 mb-4">
                      <div>
                        <p className="font-mono text-xl font-black text-blue-600">{latest.rw_score}</p>
                        <p className="text-[10px] font-bold uppercase tracking-wider text-gray-400">R&amp;W</p>
                      </div>
                      <div>
                        <p className="font-mono text-xl font-black text-purple-600">{latest.math_score}</p>
                        <p className="text-[10px] font-bold uppercase tracking-wider text-gray-400">Math</p>
                      </div>
                    </div>
                    <div className="flex gap-1.5 flex-wrap">
                      <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${latest.rw_higher_path ? 'bg-blue-50 text-blue-600' : 'bg-gray-100 text-gray-500'}`}>
                        R&amp;W {latest.rw_higher_path ? 'Hard' : 'Standard'}
                      </span>
                      <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${latest.math_higher_path ? 'bg-purple-50 text-purple-600' : 'bg-gray-100 text-gray-500'}`}>
                        Math {latest.math_higher_path ? 'Hard' : 'Standard'}
                      </span>
                    </div>
                  </div>
                )}
                <button onClick={() => router.push('/test/session')}
                  className="w-full py-4 bg-[#0A0A0A] text-white font-bold rounded-2xl text-sm hover:bg-[#222] transition-all">
                  Start New Test →
                </button>
                <a href="/leaderboard" className="w-full py-3.5 bg-white border border-black/8 text-[#0A0A0A] font-bold rounded-2xl text-sm text-center hover:bg-[#F8F7F2] transition-all">
                  Leaderboard →
                </a>
                <a href="/history" className="w-full py-3.5 bg-white border border-black/8 text-gray-500 font-semibold rounded-2xl text-sm text-center hover:bg-[#F8F7F2] transition-all">
                  Full Score History
                </a>
              </div>
            </div>

            {/* Recent tests */}
            <div className="bg-white border border-black/5 rounded-2xl overflow-hidden">
              <div className="px-6 py-4 border-b border-black/4 flex items-center justify-between">
                <p className="text-[10px] font-black uppercase tracking-widest text-gray-400">Recent Tests</p>
                <a href="/history" className="text-xs font-bold text-gray-400 hover:text-black transition-colors">View all →</a>
              </div>
              <div className="divide-y divide-black/4">
                {sessions.slice(0, 5).map((s, i) => {
                  const correct = s.answers?.filter(a => a.is_correct).length ?? 0;
                  const total = s.answers?.length ?? 0;
                  return (
                    <div key={s.id} className="flex items-center justify-between px-6 py-4 hover:bg-[#F8F7F2] transition-colors">
                      <div className="flex items-center gap-5">
                        <span className="font-mono text-[11px] text-gray-300 w-4">{i + 1}</span>
                        <div>
                          <p className="font-mono text-lg font-black text-[#0A0A0A]">{s.composite_score}</p>
                          <p className="text-[10px] text-gray-400">{fmt(s.completed_at)}</p>
                        </div>
                      </div>
                      <div className="hidden sm:flex items-center gap-5 text-xs text-gray-400">
                        <span><span className="font-bold text-blue-600">{s.rw_score}</span> R&amp;W</span>
                        <span><span className="font-bold text-purple-600">{s.math_score}</span> Math</span>
                        <span>{correct}/{total} correct</span>
                        <span>{fmtTime(s.total_time_seconds)}</span>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
