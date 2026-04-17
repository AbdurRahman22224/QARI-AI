import React, { useState, useEffect, Suspense, lazy } from 'react';
import { Activity, Star, TrendingUp, BookOpen, ArrowRight, Loader2, Filter, AlertCircle } from 'lucide-react';
import { getReadableRuleName } from '../../utils/tajweedUtils';
import { API } from '../../config/api';

// Lazy Components for secondary/heavy sections
const DashboardActivityList = lazy(() => import('./DashboardActivityList'));
const DashboardTajweedFocus = lazy(() => import('./DashboardTajweedFocus'));

// --- SHIM COMPONENTS / SKELETONS ---
const HeroSkeleton = () => (
  <div className="h-64 bg-slate-100 rounded-[40px] animate-pulse relative overflow-hidden">
    <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/20 to-transparent -translate-x-full animate-[shimmer_2s_infinite]" />
  </div>
);

const MetricsSkeleton = () => (
  <div className="grid grid-cols-3 gap-10 py-10 border-y border-slate-50">
    {[1, 2, 3].map(i => <div key={i} className="h-12 bg-slate-50 rounded-2xl animate-pulse" />)}
  </div>
);

const ListSkeleton = () => (
  <div className="space-y-6">
    {[1, 2, 3, 4].map(i => <div key={i} className="h-20 bg-slate-50/50 rounded-2xl animate-pulse border border-slate-100" />)}
  </div>
);

export default function DashboardPage({ userProfile }) {
  const [data, setData] = useState(null);
  const [tajweedMastery, setTajweedMastery] = useState({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [reloading, setReloading] = useState(false);
  const [filter, setFilter] = useState('recent');
  const [secondaryVisible, setSecondaryVisible] = useState(false);

  // Audio state
  const [playingId, setPlayingId] = useState(null);
  const [audio, setAudio] = useState(null);
  const [playbackProgress, setPlaybackProgress] = useState(0);

  const token = localStorage.getItem('user_access_token') || localStorage.getItem('qari_auth_token');
  const DASHBOARD_FETCH_TIMEOUT_MS = 12000;

  const fetchWithTimeout = async (url, options = {}, timeoutMs = DASHBOARD_FETCH_TIMEOUT_MS) => {
    const controller = new AbortController();
    const timeoutId = window.setTimeout(() => controller.abort(), timeoutMs);

    try {
      return await fetch(url, { ...options, signal: controller.signal });
    } finally {
      window.clearTimeout(timeoutId);
    }
  };

  // Safe localStorage parsing
  const getSafeUser = () => {
    try {
      return JSON.parse(localStorage.getItem('user_profile') || localStorage.getItem('qari_user') || '{}');
    } catch {
      return {};
    }
  };

  const user = getSafeUser();
  const displayName = userProfile?.name || userProfile?.preferred_username || userProfile?.given_name || (userProfile?.email ? userProfile.email.split('@')[0] : null) || user?.name || "Student";

  const fetchData = async (currentFilter = filter) => {
    if (!token) {
      // Guest fallback (local simulation)
      const local = simulateLocalData();
      setData(local);
      setLoading(false);
      setSecondaryVisible(true); // Ensure UI shows up for guests
      return;
    }

    if (currentFilter !== filter) setReloading(true);

    try {
      setError(null);
      // 1. Critical Path Fetch (Stats & Metrics)
      const statsRes = await fetchWithTimeout(`${API.DASHBOARD_STATS}?filter=${currentFilter}`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });

      if (!statsRes.ok) throw new Error(`Server returned ${statsRes.status}`);

      const stats = await statsRes.json();

      // Robustness check: Ensure essential fields exist
      if (!stats || typeof stats !== 'object' || stats.error) {
        throw new Error(stats?.error || 'Malformed dashboard data received');
      }

      setData(stats);
      setLoading(false);
      setReloading(false);
      setSecondaryVisible(true); // Show UI immediately after primary data loads

      // 2. Delayed Path (Tajweed Mastery)
      setTimeout(async () => {
        try {
          const tajRes = await fetchWithTimeout(API.DASHBOARD_TAJWEED, {
            headers: { 'Authorization': `Bearer ${token}` }
          });
          if (tajRes.ok) {
            const taj = await tajRes.json();
            setTajweedMastery(taj.mastery || {});
          }
        } catch (err) {
          console.error('Tajweed fetch error:', err);
        }
      }, 300); // 300ms staggered load

    } catch (err) {
      console.error('Fetch error:', err);
      setError(err.message);
      setLoading(false);
      setReloading(false);
      setSecondaryVisible(true); // Show UI even on error
    }
  };

  useEffect(() => {
    fetchData();
    return () => { if (audio) audio.pause(); };
  }, []);

  const handleFilterChange = (newFilter) => {
    setFilter(newFilter);
    fetchData(newFilter);
  };

  const playAudio = async (sessionId) => {
    try {
      if (audio) {
        audio.pause();
        if (playingId === sessionId) {
          setPlayingId(null);
          return;
        }
      }

      // Try to find if we already have the URL (rare for new logic, common for cached)
      // Use loose equality to handle possible string/number mismatches
      const session = data.recentSessions.find(s => s.id == sessionId);
      let url = session?.audio_url;

      // ON-DEMAND FETCH: If no URL, fetch specifically now
      if (!url && token) {
        setPlayingId(sessionId); // Show loading state early
        try {
          const res = await fetch(API.DASHBOARD_AUDIO(sessionId), {
            headers: { 'Authorization': `Bearer ${token}` }
          });
          if (res.ok) {
            const urlData = await res.json();
            url = urlData.url;
          }
        } catch (e) {
          console.warn('Could not fetch server audio:', e);
        }
      }

      // ON-DEMAND FETCH: If no URL and it's a guest, check the Local Vault
      if (!url && !token) {
        try {
          const vault = JSON.parse(localStorage.getItem('guest_audio_vault') || '{}');
          url = vault[sessionId];
        } catch (e) { console.warn('Local vault access failed:', e); }
      }

      if (!url) {
        console.warn('No audio source found for session:', sessionId);
        setPlayingId(null);
        return;
      }

      const newAudio = new Audio(url);
      setAudio(newAudio);
      setPlayingId(sessionId);

      newAudio.oncanplaythrough = () => {
        newAudio.play().catch(err => {
          console.error('Audio play error:', err);
          setPlayingId(null);
        });
      };

      newAudio.onerror = (e) => {
        console.error('Audio object error:', e);
        setPlayingId(null);
      };

      const updateProgress = () => {
        if (!newAudio.paused && !newAudio.ended) {
          setPlaybackProgress((newAudio.currentTime / newAudio.duration) * 100);
          requestAnimationFrame(updateProgress);
        }
      };

      newAudio.onplay = () => {
        requestAnimationFrame(updateProgress);
      };

      newAudio.onended = () => {
        setPlayingId(null);
        setPlaybackProgress(0);
      };
    } catch (err) {
      console.error('Audio subsystem error:', err);
      setPlayingId(null);
    }
  };

  const simulateLocalData = () => {
    const dates = JSON.parse(localStorage.getItem('practice_dates') || '[]');
    const history = JSON.parse(localStorage.getItem('practice_history_list') || '[]'); // List of objects
    const ayahs = JSON.parse(localStorage.getItem('completed_ayahs') || '[]');
    const streak = calculateStreak(dates);
    const recentSessions = history.slice(-50).reverse().map(s => ({
      ...s,
      accuracy: s.accuracy || 0,
      mistake_count: s.mistake_count || 0,
      total_words: s.total_words || 0,
      grade: s.grade || 'N/A',
      tajweedAvg: s.tajweedAvg || s.score || 0,
      confidence: s.score >= 90 ? 'High' : 'Medium'
    }));

    const reviewPending = recentSessions.filter(s => s.score < 80).slice(0, 3).map(r => ({
      ...r,
      insight: r.weakestRule ? `${getReadableRuleName(r.weakestRule.rule_name)} needs work` : 'Accuracy issue'
    }));

    let nextAction = null;
    if (reviewPending.length > 0) {
      const target = reviewPending.sort((a, b) => a.score - b.score)[0];
      nextAction = {
        type: 'review',
        label: `Review Required: Surah ${target.surah_number}, Ayah ${target.ayah_number} ⚠️`,
        sub: `Focus on accuracy to improve your ${target.score}% score. This affects pronunciation clarity.`,
        surah: target.surah_number,
        ayah: target.ayah_number
      };
    } else if (recentSessions.length > 0) {
      const latest = recentSessions[0];
      nextAction = {
        type: 'progression',
        label: 'Ready for your next verse?',
        sub: 'Consistent practice is key to mastery.',
        surah: latest.surah_number,
        ayah: latest.ayah_number + 1
      };
    }

    return {
      streak,
      totalSessions: history.length,
      uniqueAyahs: ayahs.length,
      avgScore: recentSessions.length ? Math.round(recentSessions.reduce((a, b) => a + b.score, 0) / recentSessions.length) : 0,
      daysThisWeek: streak > 7 ? 7 : streak,
      recentSessions,
      reviewPending,
      nextAction,
      source: 'local'
    };
  };

  const calculateStreak = (dates) => {
    if (!dates.length) return 0;
    const sorted = [...new Set(dates)].sort().reverse();
    let streak = 0;
    const today = new Date().toISOString().slice(0, 10);
    let current = today;
    for (const d of sorted) {
      if (d === current) {
        streak++;
        const prev = new Date(current);
        prev.setDate(prev.getDate() - 1);
        current = prev.toISOString().slice(0, 10);
      } else if (d > current) continue;
      else break;
    }
    return streak;
  };

  if (loading) return (
    <div className="bg-[#fcfdfe] min-h-screen p-6 space-y-8">
      <div className="max-w-5xl mx-auto space-y-8">
        <header className="h-8 w-40 bg-slate-50 rounded-lg animate-pulse" />
        <HeroSkeleton />
        <MetricsSkeleton />
      </div>
    </div>
  );

  if (error || !data) return (
    <div className="bg-[#fcfdfe] min-h-screen p-6 flex flex-col items-center justify-center text-center">
      <div className="bg-white p-10 rounded-[32px] shadow-xl border border-slate-100 max-w-lg space-y-5">
        <div className="w-16 h-16 bg-rose-50 text-rose-500 rounded-2xl flex items-center justify-center mx-auto mb-3">
          <AlertCircle size={32} />
        </div>
        <h2 className="text-xl font-black text-slate-900">Unable to load your dashboard</h2>
        <p className="text-slate-500 font-bold leading-relaxed text-sm">{error || "We couldn't retrieve your latest practice stats. Please check your connection."}</p>
        <button
          onClick={() => { setLoading(true); fetchData(); }}
          className="px-6 py-3 bg-slate-900 text-white rounded-xl font-black uppercase tracking-widest text-sm hover:bg-slate-800 transition-all active:scale-95"
        >
          Retry Connection
        </button>
      </div>
    </div>
  );

  const groupedSessions = (data.recentSessions || []).reduce((acc, s) => {
    const date = new Date(s.created_at);
    const today = new Date();
    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);

    let label = date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
    if (date.toDateString() === today.toDateString()) label = 'Today';
    else if (date.toDateString() === yesterday.toDateString()) label = 'Yesterday';

    if (!acc[label]) acc[label] = [];
    acc[label].push(s);
    return acc;
  }, {});

  const reviewPending = data.reviewPending || [];

  return (
    <div className="bg-[#fcfdfe] min-h-screen p-2.5 md:p-5.5 transition-all duration-700 animate-in fade-in slide-in-from-bottom-2">
      <div className="max-w-5xl mx-auto space-y-7">

        {/* --- HEADER --- */}
        <header className="flex justify-between items-end">
          <div className="space-y-2.5">
            {data.streak > 0 ? (
              <div className="inline-flex items-center gap-1.5 px-4 py-1.5 rounded-full bg-gradient-to-r from-orange-400 via-orange-500 to-rose-400 text-white shadow-lg shadow-orange-500/20 mb-2">
                <span className="text-sm font-black">🔥 {data.streak} Day Streak</span>
                <span className="text-xs font-bold opacity-80">• Keep it going</span>
              </div>
            ) : (
              <div className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-100 mb-2">
                <span className="text-[10px] font-bold tracking-wide">Getting Started</span>
              </div>
            )}
            <h1 className="text-xl md:text-2xl text-slate-900 tracking-tight leading-tight">
              <span className="font-semibold text-slate-700">Assalamu Alaikum, </span>
              <span className="font-extrabold text-slate-900">{data?.dbName || displayName}</span>
            </h1>
          </div>
          {data.source === 'db' && (
            <div className="hidden lg:flex items-center gap-2.5 px-3 py-1.5 bg-white border border-slate-200 rounded-full shadow-sm hover:shadow-md transition-all duration-200">
              <div className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
              <span className="text-[9px] font-bold text-slate-500 uppercase tracking-widest">Live</span>
            </div>
          )}
        </header>

        {/* --- NEXT ACTION HERO (Contextual) --- */}
        <section className={`relative overflow-hidden rounded-[20px] p-4 md:p-5 text-white transition-all duration-500 ${data.nextAction?.type === 'review' ? 'bg-gradient-to-br from-slate-700 to-slate-800 border border-slate-600/50 shadow-lg' : 'bg-slate-700 border border-slate-600/50 shadow-lg'}`}>
          <div className={`absolute top-0 right-0 opacity-15 blur-[60px] rounded-full -mr-20 -mt-20 w-64 h-64 ${data.nextAction?.type === 'review' ? 'bg-rose-400' : 'bg-emerald-400'}`} />
          <div className="relative z-10 space-y-5 max-w-lg">
            <div className="space-y-2">
              <div className="inline-flex items-center gap-1.5 px-2 py-0.5 bg-white/10 rounded-full border border-white/5 mb-1">
                <div className={`w-1.5 h-1.5 rounded-full ${data.nextAction?.type === 'review' ? 'bg-rose-300' : 'bg-emerald-300'}`} />
                <span className="text-[9px] font-bold tracking-widest opacity-80 uppercase">{data.nextAction?.type === 'review' ? 'Correction Priority' : 'Next Step'}</span>
              </div>
              <h2 className="text-lg md:text-xl font-black tracking-tight leading-[1.15] text-white">
                {data.nextAction ? data.nextAction.label.replace(' ⚠️', '') : 'Continue your journey'}
              </h2>
              {data.nextAction?.type === 'review' && (
                <p className="text-xs font-medium text-rose-200/80 leading-relaxed border-l-[3px] border-rose-500/20 pl-3 rounded-sm">
                  You made mistakes here. Fix to improve mastery.
                </p>
              )}
              {data.nextAction?.rule && (
                <p className="text-xs font-medium text-white/70 leading-relaxed">
                  {getReadableRuleName(data.nextAction.rule)} needs focus
                </p>
              )}
            </div>

            <button
              className={`group flex items-center w-fit gap-2 px-5 py-2 rounded-[8px] font-black text-[10px] uppercase tracking-wide transition-all duration-200 hover:scale-[1.03] active:scale-95 shadow-md ${data.nextAction?.type === 'review' ? 'bg-rose-500 text-white hover:bg-rose-600 shadow-rose-500/30' : 'bg-emerald-500 text-white hover:bg-emerald-600 shadow-emerald-500/30'}`}
              onClick={() => window.location.href = `/practice?surah=${data.nextAction?.surah || 1}&ayah=${data.nextAction?.ayah || 1}`}
            >
              {data.nextAction?.type === 'review' ? 'Review Now' : 'Start'}
              <ArrowRight size={16} className="group-hover:translate-x-1 transition-transform duration-200" />
            </button>
          </div>
        </section>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 lg:gap-9">
          <div className="lg:col-span-2 space-y-9">

            {/* --- REVIEW PENDING (Contextual) --- */}
            {reviewPending.length > 0 && (
              <section className="space-y-3 animate-in fade-in slide-in-from-left-4 duration-500">
                <div className="px-1">
                  <h3 className="text-[10px] font-black text-slate-700 uppercase tracking-widest leading-none mb-1">Review Needed</h3>
                  <p className="text-[9px] font-bold text-slate-400 italic">Focus on these verses to strengthen your foundation</p>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  {reviewPending.map((r, idx) => {
                    const isWorst = idx === 0; // reviewPending is sorted by backend
                    return (
                      <button
                        key={idx}
                        onClick={() => window.location.href = `/practice?surah=${r.surah_number}&ayah=${r.ayah_number}`}
                        className={`group bg-white p-3.5 rounded-[15px] border transition-all duration-300 text-left flex items-center gap-2.5 hover:shadow-lg hover:-translate-y-[2px] w-full ${isWorst ? 'border-amber-300 shadow-sm shadow-amber-500/5' : 'border-slate-100 hover:border-slate-200 hover:bg-slate-50/30'}`}
                      >
                        <div className={`w-8 h-8 rounded-[10px] flex items-center justify-center font-black text-[10px] flex-shrink-0 ${isWorst ? 'bg-amber-500 text-white shadow-inner' : 'bg-slate-50 text-slate-600 border border-slate-100/50'}`}>
                          {r.score}%
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className={`text-[10px] font-bold tracking-wide leading-tight mb-1 ${isWorst ? 'text-slate-900' : 'text-slate-800'}`}>Surah {r.surah_number} • Ayah {r.ayah_number}</p>
                          <p className="text-[10px] font-medium text-slate-500 truncate">{r.insight || 'Accuracy needs improvement'}</p>
                        </div>
                        <div className={`w-7 h-7 rounded-full flex items-center justify-center flex-shrink-0 transition-all duration-300 ${isWorst ? 'bg-amber-50 text-amber-600 group-hover:bg-amber-100 group-hover:text-amber-700' : 'bg-slate-50 text-slate-400 group-hover:bg-slate-100 group-hover:text-slate-600'}`}>
                          <ArrowRight size={14} className="transition-transform group-hover:translate-x-0.5" />
                        </div>
                      </button>
                    );
                  })}
                </div>
              </section>
            )}

            {/* --- PRIMARY METRICS (Critical Path) --- */}
            {(loading || reloading) ? <MetricsSkeleton /> : (
              <section className="grid grid-cols-3 gap-4 py-5 border-y border-slate-100">
                <div className="flex items-center gap-2.5 group">
                  <div className="w-8 h-8 rounded-lg bg-amber-50 text-amber-600 flex items-center justify-center group-hover:bg-amber-100 transition-colors shadow-sm flex-shrink-0">
                    <Activity size={14} />
                  </div>
                  <div>
                    <p className="text-[9px] font-bold text-slate-500 uppercase tracking-wider mb-0.5">Weekly Volume</p>
                    <p className="text-sm font-bold text-slate-900 tracking-tight">{data.daysThisWeek} Days</p>
                  </div>
                </div>
                <div className="flex items-center gap-2.5 group">
                  <div className="w-8 h-8 rounded-lg bg-indigo-50 text-indigo-600 flex items-center justify-center group-hover:bg-indigo-100 transition-colors shadow-sm flex-shrink-0">
                    <TrendingUp size={14} />
                  </div>
                  <div>
                    <p className="text-[9px] font-bold text-slate-500 uppercase tracking-wider mb-0.5">Global Mastery</p>
                    <p className="text-sm font-bold text-slate-900 tracking-tight">{data.avgScore}%</p>
                  </div>
                </div>
                <div className="flex items-center gap-2.5 group">
                  <div className="w-8 h-8 rounded-lg bg-emerald-50 text-emerald-600 flex items-center justify-center group-hover:bg-emerald-100 transition-colors shadow-sm flex-shrink-0">
                    <BookOpen size={14} />
                  </div>
                  <div>
                    <p className="text-[9px] font-bold text-slate-500 uppercase tracking-wider mb-0.5">Impact</p>
                    <p className="text-sm font-bold text-slate-900 tracking-tight">{data.uniqueAyahs} Ayahs</p>
                  </div>
                </div>
              </section>
            )}

            {/* --- ACTIVITY SECTION (Delayed/Staggered Path) --- */}
            <div className={`space-y-5 transition-all duration-700 ${secondaryVisible && !reloading ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-4'}`}>
              <div className="flex flex-col md:flex-row md:items-center justify-between gap-3.5">
                <div>
                  <h3 className="text-[11px] font-black text-slate-900 uppercase tracking-[0.25em] mb-1.5 px-1">Session History</h3>
                  <p className="text-[9px] font-bold text-slate-500 px-1">Review your recent recitations and trace your improvements over time</p>
                </div>

                {/* Smart Filter Pills */}
                <div className="flex items-center bg-white p-0.5 rounded-lg border border-slate-200 shadow-sm">
                  <button
                    onClick={() => handleFilterChange('recent')}
                    className={`px-2.5 py-1 rounded-md text-[8px] font-black uppercase tracking-widest transition-all duration-200 ${filter === 'recent' ? 'bg-slate-100 text-slate-900 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
                  >
                    Recent
                  </button>
                  <button
                    onClick={() => handleFilterChange('struggling')}
                    className={`px-2.5 py-1 rounded-md text-[8px] font-black uppercase tracking-widest transition-all duration-200 ${filter === 'struggling' ? 'bg-slate-100 text-slate-900 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
                  >
                    Mistakes
                  </button>
                  <button
                    onClick={() => handleFilterChange('this_week')}
                    className={`px-2.5 py-1 rounded-md text-[8px] font-black uppercase tracking-widest transition-all duration-200 ${filter === 'this_week' ? 'bg-slate-100 text-slate-900 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
                  >
                    Week
                  </button>
                </div>
              </div>

              <Suspense fallback={<ListSkeleton />}>
                <DashboardActivityList
                  groupedSessions={groupedSessions}
                  playingId={playingId}
                  playAudio={playAudio}
                  playbackProgress={playbackProgress}
                />
              </Suspense>
            </div>
          </div>

          {/* --- SIDEBAR (Staggered Path) --- */}
          <div className={`transition-all duration-1000 delay-150 ${secondaryVisible ? 'opacity-100 translate-x-0' : 'opacity-0 translate-x-8'}`}>
            <Suspense fallback={<div className="h-64 bg-slate-50 rounded-[32px] animate-pulse" />}>
              <DashboardTajweedFocus tajweedMastery={tajweedMastery} />
            </Suspense>
          </div>
        </div>
      </div>
    </div>
  );
}
