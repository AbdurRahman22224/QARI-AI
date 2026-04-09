import React from 'react';
import { Play, Pause, AlertCircle } from 'lucide-react';

const PrecisionBox = ({ label, value, color }) => (
  <div className={`py-1 px-2.5 rounded-[8px] flex flex-col justify-center min-w-[60px] ${color} border`}>
    <span className="text-[8px] font-bold opacity-80 uppercase tracking-widest mb-0.5">{label}</span>
    <span className="text-[11px] font-black tracking-tight leading-none">{value}</span>
  </div>
);

const ActivityItem = ({ s, playingId, playAudio, playbackProgress, insight }) => {
  const score = s.score || 0;
  const badgeBg = score >= 90 ? 'bg-emerald-100/60' : score >= 80 ? 'bg-teal-100/60' : score >= 70 ? 'bg-amber-100/60' : 'bg-rose-100/60';
  const textColor = score >= 90 ? 'text-emerald-700' : score >= 80 ? 'text-teal-700' : score >= 70 ? 'text-amber-700' : 'text-rose-700';

  return (
    <div className="group bg-slate-50 hover:bg-white p-5 rounded-[20px] border border-slate-200/60 transition-all duration-300 shadow-[0_2px_10px_-4px_rgba(0,0,0,0.05)] hover:shadow-[0_8px_30px_-6px_rgba(0,0,0,0.1)] hover:-translate-y-0.5 hover:border-slate-300/50">
      <div className="flex items-center justify-between gap-3.5">
        {/* Hierarchy 1: Verses and Metadata */}
        <div className="flex items-center gap-3 flex-1 min-w-0">
          <div className="flex flex-col items-center justify-center w-8 h-8 rounded-lg bg-slate-100 border border-slate-200 flex-shrink-0">
            <span className="text-[8px] font-bold text-slate-500 uppercase leading-none">S{s.surah_number}</span>
            <span className="text-[10px] font-bold text-slate-700 leading-none">V{s.ayah_number}</span>
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-[9px] font-medium text-slate-500 tracking-wide leading-none mb-2">{new Date(s.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</p>
            <div className="flex gap-1.5 flex-wrap">
              <PrecisionBox label="Accuracy" value={`${Math.round(s.accuracy || 0)}%`} color="bg-emerald-50 text-emerald-700 border-emerald-100" />
              <PrecisionBox label="Tajweed" value={`${Math.round(s.tajweedAvg || 0)}%`} color="bg-amber-50 text-amber-700 border-amber-100" />
              {(s.mistake_count > 0 || !s.total_words) && (
                <PrecisionBox
                  label="Mistakes"
                  value={s.total_words ? s.mistake_count : '--'}
                  color="bg-rose-50 text-rose-700 border-rose-100"
                />
              )}
            </div>
          </div>
        </div>

        {/* Hierarchy 2: Actions */}
        <div className="flex items-center gap-2.5 flex-shrink-0">
          {s.id && (
            <button
              onClick={() => playAudio(s.id)}
              className={`w-7 h-7 rounded-full flex items-center justify-center transition-all duration-200 flex-shrink-0 hover:scale-110 active:scale-95 ${playingId === s.id ? 'bg-emerald-500 text-white shadow-md shadow-emerald-500/30' : 'bg-slate-100/60 text-slate-400 hover:bg-slate-900 hover:text-white hover:shadow-md'
                }`}
            >
              {playingId === s.id ? <Pause size={12} fill="currentColor" /> : <Play size={12} fill="currentColor" className="ml-0.5" />}
            </button>
          )}
          <div className={`px-2.5 py-0.5 rounded-full text-[9px] font-bold tracking-wide flex-shrink-0 border-none ${badgeBg} ${textColor}`}>
            {s.grade}
          </div>
        </div>
      </div>

      {/* Logic-Driven Insight / Preload Scrubber */}
      <div className="mt-2 overflow-hidden transition-all duration-200">
        {playingId === s.id ? (
          <div className="animate-in slide-in-from-top-1">
            <div className="flex justify-between items-center text-[7px] font-bold text-emerald-600 uppercase tracking-wider mb-1 ml-11">
              <span>Playback</span>
              <span>{Math.round(playbackProgress)}%</span>
            </div>
            <div className="h-0.5 bg-emerald-100 rounded-full overflow-hidden ml-11">
              <div
                className="h-full bg-emerald-500 rounded-full"
                style={{ width: `${playbackProgress}%`, transition: 'none' }}
              />
            </div>
          </div>
        ) : insight ? (
          <div className="flex items-center gap-2 py-1 px-2.5 bg-slate-200/50 rounded-[8px] ml-11 w-fit">
            <AlertCircle size={10} className="text-slate-400 flex-shrink-0 mt-[0.5px]" />
            <p className="text-[9px] font-medium text-slate-500 leading-snug tracking-wide">
              {insight}
            </p>
          </div>
        ) : null}
      </div>
    </div>
  );
};

export default function DashboardActivityList({ groupedSessions, playingId, playAudio, playbackProgress }) {
  if (Object.keys(groupedSessions).length === 0) {
    return (
      <div className="py-12 text-center">
        <p className="text-xs font-bold text-slate-400">No sessions found for this filter.</p>
        <p className="text-[10px] text-slate-350 mt-1">Start a practice session to see your history.</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {Object.entries(groupedSessions).map(([dateLabel, sessions]) => (
        <div key={dateLabel} className="space-y-3">
          <h4 className="text-[9px] font-bold text-slate-500 uppercase tracking-wider pl-1">{dateLabel}</h4>
          <div className="space-y-4">
            {sessions.map(s => (
              <ActivityItem
                key={s.id}
                s={s}
                playingId={playingId}
                playAudio={playAudio}
                playbackProgress={playbackProgress}
                insight={s.insight}
              />
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}
