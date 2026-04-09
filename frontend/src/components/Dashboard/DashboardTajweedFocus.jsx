import React from 'react';
import { Star } from 'lucide-react';
import { getReadableRuleName } from '../../utils/tajweedUtils';

const TajweedMasteryBar = ({ label, score, actionable }) => {
  const percentage = Math.round(score);
  const [width, setWidth] = React.useState(0);
  
  React.useEffect(() => {
    const t = setTimeout(() => setWidth(percentage), 150);
    return () => clearTimeout(t);
  }, [percentage]);

  // Proper title case for label
  const formattedLabel = getReadableRuleName(label);
  
  return (
    <div className="group/bar space-y-2">
      <div className="flex justify-between items-center px-1">
        <span className="text-[9px] font-bold text-slate-700 tracking-wide">{formattedLabel}</span>
        <span className="text-[10px] font-black text-slate-600">{percentage}%</span>
      </div>
      <div className="h-0.5 w-full bg-slate-100/80 rounded-full overflow-hidden">
        <div 
          className={`h-full transition-all duration-[1200ms] ease-out rounded-full ${percentage >= 85 ? 'bg-emerald-500' : percentage >= 70 ? 'bg-amber-500' : 'bg-rose-500'}`}
          style={{ width: `${width}%` }}
        />
      </div>
      {actionable && percentage < 80 && (
        <button className="text-[8px] font-black text-emerald-600 uppercase tracking-widest opacity-0 group-hover/bar:opacity-100 transition-opacity hover:underline px-1">
          Practice →
        </button>
      )}
    </div>
  );
};

export default function DashboardTajweedFocus({ tajweedMastery }) {
  const focusAreas = Object.entries(tajweedMastery).filter(t => t[1] < 80).sort((a, b) => a[1] - b[1]);
  const improvements = Object.entries(tajweedMastery).filter(t => t[1] >= 80).sort((a, b) => b[1] - a[1]);
  const hasData = Object.keys(tajweedMastery).length > 0;

  return (
    <aside className="space-y-6 animate-in fade-in slide-in-from-right-4 duration-700">
      <section className="space-y-4">
        <div className="flex items-center gap-2.5">
          <h3 className="text-[10px] font-black text-slate-900 uppercase tracking-widest pl-1">Tajweed IQ</h3>
          <div className="flex-1 h-px bg-slate-200" />
        </div>
        
        <div className="bg-white rounded-[24px] border border-slate-200/60 p-5 space-y-5 shadow-sm">
          {/* Focus Areas */}
          <div className="space-y-3">
            <div className="flex items-center gap-2">
              <div className={`w-1.5 h-1.5 rounded-full ${focusAreas.length > 0 ? 'bg-rose-400' : 'bg-emerald-400'} animate-pulse`} />
              <span className="text-[10px] font-black text-slate-600 uppercase tracking-wide">
                {focusAreas.length > 0 ? 'Areas to Improve' : 'All Strong'}
              </span>
            </div>
            <div className="space-y-4">
              {focusAreas.length > 0 ? (
                focusAreas.map(([rule, score]) => (
                  <TajweedMasteryBar key={rule} label={rule} score={score} actionable />
                ))
              ) : (
                <p className="text-[10px] font-bold text-emerald-600 italic px-1">No major issues detected. Keep practicing!</p>
              )}
            </div>
          </div>

          {/* Mastered / Improving */}
          {(hasData && improvements.length > 0) && (
            <div className="space-y-3 pt-4 border-t border-slate-100">
              <div className="flex items-center gap-2">
                <div className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
                <span className="text-[10px] font-black text-slate-600 uppercase tracking-wide">Excelling</span>
              </div>
              <div className="space-y-4">
                {improvements.map(([rule, score]) => (
                  <TajweedMasteryBar key={rule} label={rule} score={score} />
                ))}
              </div>
            </div>
          )}

          {/* Empty State */}
          {!hasData && (
            <div className="py-3 text-center">
              <p className="text-[10px] font-bold text-slate-400 italic">Stats will appear as you practice</p>
            </div>
          )}
        </div>
      </section>

      {/* AI Coach Insight */}
      <div className="p-5 bg-gradient-to-br from-slate-900 to-slate-800 rounded-[22px] space-y-3 text-white shadow-xl shadow-slate-900/10 border border-slate-700/50 hover:-translate-y-0.5 transition-transform duration-300">
        <div className="w-7 h-7 bg-slate-800 rounded-[10px] flex items-center justify-center text-emerald-400 shadow-[0_0_15px_rgba(52,211,153,0.3)]">
          <Star size={15} fill="currentColor" />
        </div>
        <h4 className="text-xs font-black tracking-tight">AI Insight</h4>
        <p className="text-[10px] font-medium text-slate-300 leading-relaxed">
          Focus on consistent practice. Your Tajweed will improve naturally over time.
        </p>
      </div>
    </aside>
  );
}
