import React, { useEffect, useRef, useState } from 'react';
import {
  BookOpen, Mic, FlaskConical, LayoutDashboard,
  ArrowRight, ArrowLeft, ChevronRight, Sparkles, Volume2,
  BarChart3, Target, Waves, Zap, Shield, Star,
  Music, CircleDot, ArrowUpRight
} from 'lucide-react';
import './LandingPage.css';
import { renderTajweed, getLastVowel } from '../../utils/tajweedUtils';

const BISMILLAH_WORDS = [
  {
    text_uthmani: "بِسْمِ",
    text_uthmani_tajweed: "بِسۡمِ"
  },
  {
    text_uthmani: "ٱللَّهِ",
    text_uthmani_tajweed: "<rule class=ham_wasl>ٱ</rule>للَّهِ"
  },
  {
    text_uthmani: "ٱلرَّحْمَـٰنِ",
    text_uthmani_tajweed: "<rule class=ham_wasl>ٱ</rule><rule class=laam_shamsiyah>ل</rule>رَّحۡمَ<rule class=madda_normal>ـٰ</rule>نِ"
  },
  {
    text_uthmani: "ٱلرَّحِيمِ",
    text_uthmani_tajweed: "<rule class=ham_wasl>ٱ</rule><rule class=laam_shamsiyah>ل</rule>رَّح<rule class=madda_permissible>ِي</rule>مِ"
  }
];

/* ── Intersection Observer hook for scroll-reveal ── */
function useScrollReveal() {
  const observerRef = useRef(null);

  const getObserver = () => {
    if (!observerRef.current && typeof window !== 'undefined') {
      observerRef.current = new IntersectionObserver(
        (entries) => {
          entries.forEach((entry) => {
            if (entry.isIntersecting) {
              entry.target.classList.add('visible');
            }
          });
        },
        { threshold: 0.12, rootMargin: '0px 0px -40px 0px' }
      );
    }
    return observerRef.current;
  };

  useEffect(() => {
    return () => {
      if (observerRef.current) {
        observerRef.current.disconnect();
      }
    };
  }, []);

  const addRef = (el) => {
    if (el) {
      const observer = getObserver();
      if (observer) {
        observer.observe(el);
      }
    }
  };

  return addRef;
}

/* ═══════════════════════════════════════════════════
   TAJWEED RULES DATA
   ═══════════════════════════════════════════════════ */
const TAJWEED_RULES = [
  {
    name: 'Ghunnah',
    nameAr: 'غُنَّة',
    category: 'nasal_echo',
    color: '#4CAF50',
    description: 'A nasal sound held for two counts when Noon or Meem carry a Shaddah. It resonates through the nose, giving the recitation a melodic depth.',
  },
  {
    name: 'Qalqalah',
    nameAr: 'قَلْقَلَة',
    category: 'nasal_echo',
    color: '#00BCD4',
    description: 'An echoing bounce produced on the letters ق ط ب ج د when they carry a Sukoon. The sound bounces off the articulation point.',
  },
  {
    name: 'Madd (Natural)',
    nameAr: 'مَدّ طَبِيعِي',
    category: 'madd',
    color: '#F48FB1',
    description: 'The basic elongation of vowel sounds held for exactly two counts. It is the foundation of all other Madd rules.',
  },
  {
    name: 'Madd Munfasil',
    nameAr: 'مَدّ مُنْفَصِل',
    category: 'madd',
    color: '#FF9800',
    description: 'A separated elongation (2–5 counts) occurring when a Madd letter ends one word and a Hamzah starts the next.',
  },
  {
    name: 'Madd Muttasil',
    nameAr: 'مَدّ مُتَّصِل',
    category: 'madd',
    color: '#F06292',
    description: 'A connected, obligatory elongation (4–5 counts) when a Madd letter and Hamzah occur within the same word.',
  },
  {
    name: 'Madd Lazim',
    nameAr: 'مَدّ لَازِم',
    category: 'madd',
    color: '#D32F2F',
    description: 'The necessary elongation of six full counts, required when a Madd letter is followed by a Shaddah or permanent Sukoon.',
  },
  {
    name: 'Tafkhim',
    nameAr: 'تَفْخِيم',
    category: 'letters_articles',
    color: '#6169da',
    description: 'The heavy, emphatic pronunciation of specific letters (ص ض ط ظ خ غ ق). The sound fills the mouth and is projected upward.',
  },
  {
    name: 'Idgham',
    nameAr: 'إِدْغَام',
    category: 'nasal_echo',
    color: '#21c54a',
    description: 'Merging a Noon Sakinah or Tanween into the following letter (ي ر م ل و ن), creating a smooth, connected sound.',
  },
  {
    name: 'Ikhfa\'',
    nameAr: 'إِخْفَاء',
    category: 'nasal_echo',
    color: '#4CAF50',
    description: 'Concealing the Noon Sakinah or Tanween with a nasal sound before 15 specific letters, blending without full pronunciation.',
  },
  {
    name: 'Iqlab',
    nameAr: 'إِقْلَاب',
    category: 'nasal_echo',
    color: '#FDB927',
    description: 'Converting a Noon Sakinah or Tanween into a Meem sound when followed by the letter Ba (ب), accompanied by Ghunnah.',
  },
  {
    name: 'Lam Shamsiyyah',
    nameAr: 'لَام شَمْسِيَّة',
    category: 'letters_articles',
    color: '#2196F3',
    description: 'The silent Lam in "Al" that assimilates into the following sun letter. The Lam is written but not pronounced.',
  },
  {
    name: 'Lam Qamariyyah',
    nameAr: 'لَام قَمَرِيَّة',
    category: 'letters_articles',
    color: '#3F51B5',
    description: 'The clearly pronounced Lam in "Al" before a moon letter. The Lam is both written and distinctly articulated.',
  },
];

const TAJWEED_CATEGORIES = [
  { id: 'all', label: 'All Rules' },
  { id: 'madd', label: 'Madd (Elongation)' },
  { id: 'nasal_echo', label: 'Nasal & Echo' },
  { id: 'letters_articles', label: 'Letters & Articles' }
];

/* ═══════════════════════════════════════════════════
   FEATURES DATA
   ═══════════════════════════════════════════════════ */
const FEATURES = [
  {
    icon: Mic,
    title: 'Practice Mode',
    subtitle: 'Recite Any Verse, Get Instant Feedback',
    description: 'Select any Surah and Ayah, record your recitation, and receive word-by-word AI analysis. Compare against master Qaris like Mishary Rashid Alafasy with side-by-side audio.',
    gradient: 'from-emerald-400 to-teal-500',
    shadowColor: 'rgba(16, 185, 129, 0.2)',
  },
  {
    icon: FlaskConical,
    title: 'Word Lab',
    subtitle: 'Master Tajweed, One Rule at a Time',
    description: 'Three progressive levels — Foundation, Precision, and Mastery — guide you from heavy letters through Qalqalah and Ghunnah to complex Madd sequences with targeted coaching.',
    gradient: 'from-amber-400 to-orange-500',
    shadowColor: 'rgba(245, 158, 11, 0.2)',
  },
  {
    icon: LayoutDashboard,
    title: 'Smart Dashboard',
    subtitle: 'Track Your Journey',
    description: 'See weekly volume, global mastery percentage, and Ayahs covered. Review session history, identify recurring mistakes, and get AI insights on your Tajweed strengths.',
    gradient: 'from-violet-400 to-purple-600',
    shadowColor: 'rgba(139, 92, 246, 0.2)',
  },
];

/* ═══════════════════════════════════════════════════
   HOW IT WORKS DATA
   ═══════════════════════════════════════════════════ */
const STEPS = [
  { icon: BookOpen, title: 'Choose a Verse', description: 'Browse by Surah and Ayah with built-in translation and Tajweed color-coding.' },
  { icon: Volume2, title: 'Record Your Recitation', description: 'Hit record — Qari AI captures your voice directly in the browser. No app download needed.' },
  { icon: Sparkles, title: 'Get AI Feedback', description: 'Instant word-by-word analysis highlighting pronunciation accuracy, missed rules, and Tajweed errors.' },
  { icon: BarChart3, title: 'Track & Improve', description: 'Your dashboard builds over time — see patterns, replay past sessions, and watch your Tajweed IQ grow.' },
];


/* ═══════════════════════════════════════════════════
   LANDING PAGE COMPONENT
   ═══════════════════════════════════════════════════ */
export default function LandingPage({ onGetStarted, onGuestLogin, isAuthenticated = false, onBackToApp }) {
  const addRef = useScrollReveal();
  const [selectedCategory, setSelectedCategory] = useState('all');

  const filteredRules = selectedCategory === 'all'
    ? TAJWEED_RULES
    : TAJWEED_RULES.filter(rule => rule.category === selectedCategory);

  return (
    <div className="min-h-screen bg-slate-50 overflow-x-hidden">

      {/* ════════════════ NAVBAR ════════════════ */}
      <nav className="landing-navbar fixed top-0 left-0 right-0 z-50 px-6 md:px-10 py-3.5">
        <div className="max-w-7xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-gradient-to-br from-emerald-400 to-teal-500 rounded-xl flex items-center justify-center shadow-lg shadow-emerald-200/50">
              <BookOpen className="text-white" size={20} />
            </div>
            <span className="text-lg font-extrabold text-gray-800 tracking-tight">Qari AI</span>
          </div>
          {isAuthenticated ? (
            <button
              onClick={onBackToApp}
              className="flex items-center gap-2 px-5 py-2.5 bg-white text-gray-700 border border-gray-200 rounded-xl font-semibold text-sm shadow-sm hover:bg-gray-50 hover:border-gray-300 hover:scale-[1.03] active:scale-[0.98] transition-all duration-200"
            >
              <ArrowLeft size={16} />
              Back to App
            </button>
          ) : (
            <button
              onClick={onGetStarted}
              className="flex items-center gap-2 px-5 py-2.5 bg-gradient-to-r from-emerald-500 to-teal-500 text-white rounded-xl font-semibold text-sm shadow-lg shadow-emerald-200/50 hover:shadow-emerald-300/60 hover:scale-[1.03] active:scale-[0.98] transition-all duration-200"
            >
              Get Started
              <ArrowRight size={16} />
            </button>
          )}
        </div>
      </nav>


      {/* ════════════════ HERO ════════════════ */}
      <section className="relative pt-28 pb-20 md:pt-36 md:pb-28 px-6 overflow-hidden">
        {/* Background decorations */}
        <div className="absolute top-20 -left-32 w-96 h-96 bg-emerald-200/20 rounded-full blur-3xl landing-float"></div>
        <div className="absolute bottom-0 -right-24 w-80 h-80 bg-teal-200/20 rounded-full blur-3xl landing-float-delayed"></div>
        <div className="absolute top-40 right-1/4 w-4 h-4 bg-emerald-400/30 rounded-full landing-float"></div>
        <div className="absolute bottom-32 left-1/3 w-3 h-3 bg-teal-400/20 rounded-full landing-float-delayed"></div>

        <div className="max-w-7xl mx-auto landing-hero-grid grid grid-cols-1 lg:grid-cols-2 gap-12 items-center">
          {/* Left — Text Content */}
          <div className="space-y-7">
            <div className="inline-flex items-center gap-2 px-4 py-1.5 bg-emerald-50 border border-emerald-100 rounded-full">
              <Sparkles size={14} className="text-emerald-500" />
              <span className="text-xs font-bold text-emerald-600 tracking-wide">AI-Powered Tajweed Coach</span>
            </div>

            <h1 className="text-4xl md:text-5xl lg:text-[3.4rem] font-black text-gray-900 leading-[1.12] tracking-tight">
              Master Your <br />
              <span className="landing-gradient-text">Quran Recitation</span><br />
              with AI
            </h1>

            <p className="text-base md:text-lg text-gray-500 leading-relaxed max-w-lg">
              Qari AI listens to your recitation, analyzes your Tajweed in real-time, and gives you instant, personalized feedback — like having a private Quran tutor available 24/7.
            </p>

            <div className="flex flex-wrap gap-3 hero-cta-group">
              <button
                onClick={onGetStarted}
                className="flex items-center gap-2.5 px-7 py-3.5 bg-gradient-to-r from-emerald-500 to-teal-500 text-white rounded-2xl font-bold text-base shadow-xl shadow-emerald-200/40 hover:shadow-emerald-300/50 hover:scale-[1.03] active:scale-[0.97] transition-all duration-200"
              >
                {isAuthenticated ? 'Go to Practice' : 'Start Practicing'}
                <ArrowRight size={18} />
              </button>
              {!isAuthenticated && (
                <button
                  onClick={onGuestLogin}
                  className="flex items-center gap-2 px-6 py-3.5 bg-white text-gray-700 border border-gray-200 rounded-2xl font-semibold text-base hover:bg-gray-50 hover:border-gray-300 hover:scale-[1.02] active:scale-[0.98] transition-all duration-200 shadow-sm"
                >
                  Try as Guest
                  <ChevronRight size={16} className="text-gray-400" />
                </button>
              )}
            </div>

            <div className="flex items-center gap-6 pt-2">
              <div className="flex items-center gap-2">
                <Shield size={14} className="text-emerald-500" />
                <span className="text-xs font-semibold text-gray-400">Free to Use</span>
              </div>
              <div className="flex items-center gap-2">
                <Zap size={14} className="text-emerald-500" />
                <span className="text-xs font-semibold text-gray-400">Real-time Analysis</span>
              </div>
              <div className="flex items-center gap-2">
                <Star size={14} className="text-emerald-500" />
                <span className="text-xs font-semibold text-gray-400">Quran.com Powered</span>
              </div>
            </div>
          </div>

          {/* Right — Visual Showcase */}
          <div className="relative flex items-center justify-center">
            {/* Glow backdrop */}
            <div className="absolute w-80 h-80 bg-gradient-to-br from-emerald-200/30 to-teal-200/20 rounded-full blur-3xl"></div>

            {/* Main card */}
            <div className="relative bg-white/80 backdrop-blur-xl rounded-3xl shadow-2xl border border-white/60 p-8 md:p-10 max-w-md w-full landing-float">
              {/* Decorative badge */}
              <div className="absolute -top-4 -right-4 w-12 h-12 bg-gradient-to-br from-amber-400 to-orange-500 rounded-2xl flex items-center justify-center shadow-lg shadow-orange-200/40 rotate-12">
                <Star size={20} className="text-white" />
              </div>

              <p className="text-[10px] font-bold text-emerald-500 uppercase tracking-[0.2em] mb-4">Live Preview</p>

              {/* Bismillah showcase */}
              <div className="text-center py-6 landing-verse-glow">
                <p className="font-arabic text-3xl md:text-4xl text-gray-800 leading-[2.2] flex flex-wrap justify-center gap-x-2.5 select-none" dir="rtl">
                  {BISMILLAH_WORDS.map((w, i) => {
                    const prevWord = i > 0 ? BISMILLAH_WORDS[i - 1] : null;
                    const precedingVowel = prevWord ? getLastVowel(prevWord.text_uthmani) : null;
                    const tajweedText = w.text_uthmani_tajweed || w.text_uthmani || '';
                    return (
                      <span
                        key={i}
                        dangerouslySetInnerHTML={{
                          __html: renderTajweed(tajweedText, precedingVowel)
                        }}
                      />
                    );
                  })}
                </p>
              </div>

              {/* Simulated analysis bar */}
              <div className="mt-4 space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-gray-500">Tajweed Accuracy</span>
                  <span className="text-xs font-extrabold text-emerald-500">94%</span>
                </div>
                <div className="w-full h-2.5 bg-gray-100 rounded-full overflow-hidden">
                  <div className="h-full bg-gradient-to-r from-emerald-400 to-teal-500 rounded-full" style={{ width: '94%' }}></div>
                </div>
                <div className="flex gap-2 flex-wrap">
                  {['Ghunnah', 'Madd', 'Qalqalah'].map((tag) => (
                    <span key={tag} className="px-2.5 py-1 bg-emerald-50 text-emerald-600 text-[10px] font-bold rounded-lg border border-emerald-100">
                      ✓ {tag}
                    </span>
                  ))}
                </div>
              </div>
            </div>

            {/* Floating mini card */}
            <div className="absolute -bottom-4 -left-6 bg-white rounded-2xl shadow-xl border border-gray-100 px-4 py-3 landing-float-delayed">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 bg-gradient-to-br from-emerald-400 to-teal-500 rounded-lg flex items-center justify-center">
                  <Mic size={14} className="text-white" />
                </div>
                <div>
                  <p className="text-[10px] font-bold text-gray-800">Recording...</p>
                  <p className="text-[9px] text-gray-400">Al-Fatihah : 1</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>


      {/* ════════════════ FEATURES ════════════════ */}
      <section className="py-20 md:py-28 px-6 bg-gradient-to-b from-white to-slate-50/50">
        <div className="max-w-7xl mx-auto">
          <div ref={addRef} className="landing-fade-up text-center mb-16">
            <div className="inline-flex items-center gap-2 px-4 py-1.5 bg-emerald-50 border border-emerald-100 rounded-full mb-5">
              <Zap size={14} className="text-emerald-500" />
              <span className="text-xs font-bold text-emerald-600 tracking-wide">Powerful Features</span>
            </div>
            <h2 className="text-3xl md:text-4xl font-black text-gray-900 tracking-tight mb-4">
              Everything You Need to <span className="landing-gradient-text">Perfect Your Recitation</span>
            </h2>
            <p className="text-base text-gray-500 max-w-2xl mx-auto">
              Three integrated tools work together to build your Tajweed skills from the ground up.
            </p>
          </div>

          <div ref={addRef} className="landing-fade-up grid grid-cols-1 md:grid-cols-3 gap-6">
            {FEATURES.map((feature, i) => {
              const Icon = feature.icon;
              return (
                <div
                  key={i}
                  className={`feature-card bg-white rounded-3xl p-7 border border-gray-100 shadow-sm stagger-${i + 1}`}
                >
                  <div
                    className={`w-14 h-14 bg-gradient-to-br ${feature.gradient} rounded-2xl flex items-center justify-center shadow-lg mb-5`}
                    style={{ boxShadow: `0 8px 24px -4px ${feature.shadowColor}` }}
                  >
                    <Icon size={24} className="text-white" />
                  </div>
                  <h3 className="text-lg font-extrabold text-gray-900 mb-1">{feature.title}</h3>
                  <p className="text-sm font-semibold text-emerald-600 mb-3">{feature.subtitle}</p>
                  <p className="text-sm text-gray-500 leading-relaxed">{feature.description}</p>
                </div>
              );
            })}
          </div>
        </div>
      </section>


      {/* ════════════════ HOW IT WORKS ════════════════ */}
      <section className="py-20 md:py-28 px-6 relative">
        <div className="absolute inset-0 bg-gradient-to-br from-emerald-50/40 via-transparent to-teal-50/30"></div>
        <div className="max-w-5xl mx-auto relative">
          <div ref={addRef} className="landing-fade-up text-center mb-16">
            <div className="inline-flex items-center gap-2 px-4 py-1.5 bg-emerald-50 border border-emerald-100 rounded-full mb-5">
              <Target size={14} className="text-emerald-500" />
              <span className="text-xs font-bold text-emerald-600 tracking-wide">Simple Process</span>
            </div>
            <h2 className="text-3xl md:text-4xl font-black text-gray-900 tracking-tight mb-4">
              How It <span className="landing-gradient-text">Works</span>
            </h2>
            <p className="text-base text-gray-500 max-w-xl mx-auto">
              From choosing a verse to mastering its Tajweed — in four simple steps.
            </p>
          </div>

          <div ref={addRef} className="landing-fade-up grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            {STEPS.map((step, i) => {
              const Icon = step.icon;
              return (
                <div key={i} className={`relative text-center stagger-${i + 1}`}>
                  {/* Step number badge */}
                  <div className="relative inline-flex items-center justify-center mb-5">
                    <div className="w-16 h-16 bg-white rounded-2xl shadow-md border border-gray-100 flex items-center justify-center">
                      <Icon size={24} className="text-emerald-500" />
                    </div>
                    <span className="absolute -top-2 -right-2 w-7 h-7 bg-gradient-to-br from-emerald-400 to-teal-500 rounded-lg flex items-center justify-center text-white text-xs font-black shadow-md">
                      {i + 1}
                    </span>
                  </div>
                  {/* Connector arrow (hidden on last item and mobile) */}
                  {i < STEPS.length - 1 && (
                    <div className="hidden lg:block absolute top-8 -right-3 z-10">
                      <ChevronRight size={18} className="text-emerald-300" />
                    </div>
                  )}
                  <h4 className="text-base font-extrabold text-gray-900 mb-2">{step.title}</h4>
                  <p className="text-sm text-gray-500 leading-relaxed">{step.description}</p>
                </div>
              );
            })}
          </div>
        </div>
      </section>


      {/* ════════════════ AI EVALUATION METHODOLOGY ════════════════ */}
      <section className="py-20 md:py-28 px-6 bg-gradient-to-b from-white to-slate-50 text-slate-800 relative overflow-hidden border-t border-b border-slate-100">
        {/* Glow effects */}
        <div className="absolute top-1/4 left-1/10 w-96 h-96 bg-emerald-100/30 rounded-full blur-3xl pointer-events-none"></div>
        <div className="absolute bottom-1/4 right-1/10 w-96 h-96 bg-teal-100/30 rounded-full blur-3xl pointer-events-none"></div>

        <div className="max-w-7xl mx-auto relative z-10">
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-12 lg:gap-16 items-center">
            
            {/* Left Column — Simulated AI Analyzer Widget */}
            <div ref={addRef} className="landing-fade-up lg:col-span-5 flex justify-center">
              <div className="relative w-full max-w-sm bg-white border border-slate-200/80 rounded-3xl p-6 shadow-xl backdrop-blur-md overflow-hidden">
                {/* Scanner laser bar */}
                <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-transparent via-emerald-400 to-transparent animate-pulse shadow-[0_0_15px_#10b981] opacity-70"></div>
                
                <div className="flex items-center justify-between mb-6 border-b border-slate-100 pb-4">
                  <div className="flex items-center gap-2">
                    <span className="w-2.5 h-2.5 bg-emerald-500 rounded-full animate-ping"></span>
                    <span className="text-xs font-mono text-emerald-600 tracking-wider">AI ENGINE v2.0</span>
                  </div>
                  <span className="text-[10px] font-mono text-slate-500">ANALYZING...</span>
                </div>

                {/* Waveform Visualization */}
                <div className="h-28 bg-slate-50 rounded-2xl flex items-center justify-center gap-1.5 p-4 mb-6 relative overflow-hidden border border-slate-100">
                  {/* Subtle Grid */}
                  <div className="absolute inset-0 bg-[linear-gradient(to_right,#1e293b_1px,transparent_1px),linear-gradient(to_bottom,#1e293b_1px,transparent_1px)] bg-[size:14px_14px] opacity-5"></div>
                  {/* Simulated wave bars */}
                  {[35, 60, 45, 90, 75, 30, 85, 110, 65, 40, 80, 95, 55, 30, 50, 70, 35].map((height, i) => (
                    <div
                      key={i}
                      className="w-1.5 bg-gradient-to-t from-emerald-500 to-teal-400 rounded-full transition-all duration-300 animate-pulse"
                      style={{
                        height: `${height}%`,
                        animationDelay: `${i * 0.08}s`,
                        animationDuration: '1.2s'
                      }}
                    />
                  ))}
                </div>

                {/* Score indicators */}
                <div className="space-y-4">
                  <div>
                    <div className="flex justify-between text-xs mb-1.5 font-bold">
                      <span className="text-slate-600">Phonemic Alignment</span>
                      <span className="text-emerald-600">98.2%</span>
                    </div>
                    <div className="w-full h-1.5 bg-slate-100 rounded-full overflow-hidden">
                      <div className="h-full bg-emerald-500 rounded-full" style={{ width: '98%' }}></div>
                    </div>
                  </div>

                  <div>
                    <div className="flex justify-between text-xs mb-1.5 font-bold">
                      <span className="text-slate-600">Tajweed Holds</span>
                      <span className="text-teal-600">91.5%</span>
                    </div>
                    <div className="w-full h-1.5 bg-slate-100 rounded-full overflow-hidden">
                      <div className="h-full bg-teal-500 rounded-full" style={{ width: '91%' }}></div>
                    </div>
                  </div>

                  <div>
                    <div className="flex justify-between text-xs mb-1.5 font-bold">
                      <span className="text-slate-600">Pitch Accent (Makhraj)</span>
                      <span className="text-amber-600">89.1%</span>
                    </div>
                    <div className="w-full h-1.5 bg-slate-100 rounded-full overflow-hidden">
                      <div className="h-full bg-amber-500 rounded-full" style={{ width: '89%' }}></div>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* Right Column — Methodology Details */}
            <div ref={addRef} className="landing-fade-up lg:col-span-7 space-y-8">
              <div>
                <div className="inline-flex items-center gap-2 px-4 py-1.5 bg-emerald-50 border border-emerald-100 rounded-full mb-4">
                  <Zap size={14} className="text-emerald-500" />
                  <span className="text-xs font-bold text-emerald-600 tracking-wide">Behind the Scenes</span>
                </div>
                <h2 className="text-3xl md:text-4xl font-black tracking-tight mb-4 text-slate-900">
                  How We Evaluate Your <span className="landing-gradient-text">Recitation</span>
                </h2>
                <p className="text-slate-500 text-sm md:text-base max-w-xl leading-relaxed">
                  Our advanced audio processing engine breaks down your recitation in real-time, matching it against verified master readings.
                </p>
              </div>

              {/* Steps */}
              <div className="space-y-6">
                {[
                  {
                    num: '01',
                    title: 'Acoustic Alignment',
                    desc: 'We divide your audio into syllable-level frames and align them word-by-word with the correct text timing.',
                    color: 'from-emerald-500 to-teal-500'
                  },
                  {
                    num: '02',
                    title: 'Makhraj & Phonetics Check',
                    desc: 'Our neural acoustic model evaluates letter articulation points, identifying shifts in short vowels (Harakah) or mispronounced consonants.',
                    color: 'from-teal-500 to-cyan-500'
                  },
                  {
                    num: '03',
                    title: 'Tajweed Count Tracker',
                    desc: 'We map the temporal duration of nasal holds (Ghunnah), echoing bounces (Qalqalah), and elongation rules (Madd) down to the millisecond.',
                    color: 'from-cyan-500 to-indigo-500'
                  },
                  {
                    num: '04',
                    title: 'Comparative Feedback',
                    desc: 'We correlate your pitch contour and recitation tempo with a professional Qari reference, highlighting areas for flow refinement.',
                    color: 'from-indigo-500 to-purple-500'
                  }
                ].map((item, idx) => (
                  <div key={idx} className="flex gap-4 group">
                    <div className={`w-10 h-10 rounded-xl bg-gradient-to-br ${item.color} flex items-center justify-center flex-shrink-0 text-white font-black text-sm transition-transform group-hover:scale-110 duration-300 shadow-md shadow-emerald-100/50`}>
                      {item.num}
                    </div>
                    <div>
                      <h4 className="text-base font-bold text-slate-800 group-hover:text-emerald-600 transition-colors duration-300">{item.title}</h4>
                      <p className="text-slate-500 text-xs md:text-sm mt-1 leading-relaxed">{item.desc}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>

          </div>
        </div>
      </section>

      {/* ════════════════ TAJWEED RULES ════════════════ */}
      <section className="py-20 md:py-28 px-6 bg-gradient-to-b from-slate-50 to-white">
        <div className="max-w-7xl mx-auto">
          <div ref={addRef} className="landing-fade-up text-center mb-16">
            <div className="inline-flex items-center gap-2 px-4 py-1.5 bg-emerald-50 border border-emerald-100 rounded-full mb-5">
              <Waves size={14} className="text-emerald-500" />
              <span className="text-xs font-bold text-emerald-600 tracking-wide">Tajweed Science</span>
            </div>
            <h2 className="text-3xl md:text-4xl font-black text-gray-900 tracking-tight mb-4">
              <span className="landing-gradient-text">12 Tajweed Rules</span> We Analyze
            </h2>
            <p className="text-base text-gray-500 max-w-2xl mx-auto">
              Our AI listens for every major Tajweed rule in real-time. Each rule is color-coded so you can see exactly where corrections are needed.
            </p>
          </div>

          {/* Category Tabs */}
          <div ref={addRef} className="landing-fade-up flex justify-center flex-wrap gap-2.5 mb-10 max-w-2xl mx-auto">
            {TAJWEED_CATEGORIES.map((cat) => (
              <button
                key={cat.id}
                onClick={() => {
                  setSelectedCategory(prev => {
                    const next = prev === cat.id ? 'all' : cat.id;
                    console.log(`[Tajweed Filter] Category clicked: ${cat.id}. Previous: ${prev}. Next: ${next}`);
                    return next;
                  });
                }}
                className={`px-5 py-2.5 rounded-full text-xs font-extrabold transition-all duration-300 active:scale-95 border ${
                  selectedCategory === cat.id
                    ? 'bg-emerald-500 text-white shadow-lg shadow-emerald-200/50 border-emerald-500 scale-[1.03]'
                    : 'bg-white text-slate-600 border-slate-200/60 hover:bg-slate-50'
                }`}
              >
                {cat.label}
              </button>
            ))}
          </div>

          <div
            ref={addRef}
            key={selectedCategory}
            className="landing-fade-up grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-6"
          >
            {filteredRules.map((rule, i) => (
              <div
                key={rule.name}
                className="relative bg-white rounded-2xl p-5 sm:p-6 border border-slate-100 shadow-[0_4px_20px_-4px_rgba(0,0,0,0.02)] hover:shadow-[0_12px_30px_-6px_rgba(0,0,0,0.06)] hover:-translate-y-1 transition-all duration-300 flex flex-col justify-between group overflow-hidden"
              >
                {/* Glow backdrop on hover */}
                <div
                  className="absolute top-0 right-0 w-24 h-24 rounded-full blur-3xl opacity-0 group-hover:opacity-20 transition-opacity duration-500 pointer-events-none"
                  style={{ backgroundColor: rule.color }}
                />

                <div>
                  {/* Header: Icon & Arabic Badge */}
                  <div className="flex items-center justify-between mb-4">
                    <div
                      className="w-10 h-10 rounded-xl flex items-center justify-center transition-transform group-hover:scale-110 duration-300"
                      style={{
                        backgroundColor: `${rule.color}15`,
                        border: `1px solid ${rule.color}30`,
                      }}
                    >
                      <CircleDot size={18} style={{ color: rule.color }} />
                    </div>
                    
                    <span
                      className="px-2.5 py-1 rounded-lg text-sm md:text-base font-bold font-arabic"
                      style={{
                        backgroundColor: `${rule.color}08`,
                        color: rule.color,
                      }}
                      dir="rtl"
                    >
                      {rule.nameAr}
                    </span>
                  </div>

                  {/* Title */}
                  <h4 className="text-base font-bold text-slate-800 mb-2 group-hover:text-emerald-600 transition-colors duration-300">
                    {rule.name}
                  </h4>

                  {/* Description */}
                  <p className="text-xs text-slate-500 leading-relaxed font-medium">
                    {rule.description}
                  </p>
                </div>

                {/* Animated bottom bar indicator */}
                <div className="absolute bottom-0 left-0 right-0 h-[3px] bg-slate-100/80 group-hover:bg-slate-200/50 transition-colors mt-6">
                  <div
                    className="h-full w-0 group-hover:w-full transition-all duration-500 ease-out"
                    style={{ backgroundColor: rule.color }}
                  />
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>


      {/* ════════════════ FINAL CTA ════════════════ */}
      <section className="py-20 md:py-24 px-6">
        <div ref={addRef} className="landing-fade-up max-w-4xl mx-auto relative">
          {/* Background glow */}
          <div className="absolute inset-0 bg-gradient-to-r from-emerald-500 to-teal-600 rounded-3xl blur-2xl opacity-20"></div>

          <div className="relative bg-gradient-to-r from-emerald-600 via-emerald-500 to-teal-500 rounded-3xl px-8 md:px-16 py-14 md:py-16 text-center overflow-hidden">
            {/* Decorative circles */}
            <div className="absolute top-6 left-8 w-20 h-20 bg-white/5 rounded-full"></div>
            <div className="absolute bottom-4 right-12 w-32 h-32 bg-white/5 rounded-full"></div>
            <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-64 h-64 bg-white/5 rounded-full landing-slow-spin"></div>

            <div className="relative z-10">
              <h2 className="text-3xl md:text-4xl font-black text-white mb-4 tracking-tight">
                Your Recitation Journey Starts Here
              </h2>
              <p className="text-base md:text-lg text-emerald-100 max-w-xl mx-auto mb-8 leading-relaxed">
                Join learners around the world improving their Tajweed with AI-powered coaching. Free to start — log in with your Quran.com account or try as a guest.
              </p>
              <div className="flex flex-wrap gap-3 justify-center">
                <button
                  onClick={onGetStarted}
                  className="flex items-center gap-2.5 px-8 py-4 bg-white text-emerald-600 rounded-2xl font-bold text-base shadow-xl hover:shadow-2xl hover:scale-[1.03] active:scale-[0.97] transition-all duration-200"
                >
                  {isAuthenticated ? 'Go to Practice' : "Get Started — It's Free"}
                  <ArrowUpRight size={18} />
                </button>
                {!isAuthenticated && (
                  <button
                    onClick={onGuestLogin}
                    className="flex items-center gap-2 px-6 py-4 bg-white/15 text-white border border-white/25 rounded-2xl font-semibold text-base hover:bg-white/25 hover:scale-[1.02] active:scale-[0.98] transition-all duration-200 backdrop-blur-sm"
                  >
                    Continue as Guest
                    <ChevronRight size={16} />
                  </button>
                )}
              </div>
            </div>
          </div>
        </div>
      </section>


      {/* ════════════════ FOOTER ════════════════ */}
      <footer className="py-10 px-6 border-t border-gray-100 bg-slate-50/50">
        <div className="max-w-7xl mx-auto flex flex-col md:flex-row items-center justify-between gap-6">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 bg-gradient-to-br from-emerald-400 to-teal-500 rounded-lg flex items-center justify-center shadow-sm">
              <BookOpen className="text-white" size={14} />
            </div>
            <div>
              <span className="text-sm font-bold text-slate-700 block">Qari AI</span>
              <span className="text-[10px] font-semibold text-emerald-600 tracking-wide uppercase">Quran Foundation Hackathon</span>
            </div>
          </div>
          <div className="text-center md:text-left space-y-1">
            <p className="text-xs text-slate-500 font-medium">
              Built with ❤️ by{' '}
              <a
                href="https://abdurrahman22224.github.io/"
                target="_blank"
                rel="noopener noreferrer"
                className="text-emerald-600 hover:text-emerald-700 font-bold hover:underline transition-colors"
              >
                Abdur Rahman
              </a>
            </p>
            <p className="text-[11px] text-slate-400 font-medium">
              Built for the Quran Foundation Hackathon
            </p>
          </div>
          <div className="text-right md:text-right">
            <p className="text-xs text-slate-400">
              © {new Date().getFullYear()} Qari AI
            </p>
            <p className="text-[10px] text-slate-400 font-mono mt-0.5">
              Powered by Quran.com API
            </p>
          </div>
        </div>
      </footer>
    </div>
  );
}
