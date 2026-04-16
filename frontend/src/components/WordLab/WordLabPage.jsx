import React, { useState, useEffect, useMemo, useRef } from 'react';
import { Mic, Loader2, Info, Volume2, RefreshCw, Clock, X, PlayCircle, Check, Zap, XCircle, ArrowLeft, AlertCircle, Sparkles, Award, Star, ChevronRight, FlaskConical } from 'lucide-react';
import { renderTajweed, getLastVowel, splitVerseTajweedIntoWords, generateTajweedMap } from '../../utils/tajweedUtils';
import { API, QURAN_CONTENT_BASE } from '../../config/api';

const pad = (num) => String(num).padStart(3, '0');
const generateWordAudioUrl = (surah, ayah, position) =>
  `https://audio.qurancdn.com/wbw/${pad(surah)}_${pad(ayah)}_${pad(position)}.mp3`;

const stripAyahMarkers = (text) => {
  if (!text) return '';
  return text.replace(/([٠-٩0-9\u06DD\u06DE]+(?![^<]*>))/g, '').trim();
};

const MAKHRAJ_TIPS = {
  'ع': 'Ayn: Middle of the throat, constricted sound.',
  'ح': 'Ha: Middle of the throat, sharp friction.',
  'خ': 'Kha: Top of the throat, grazing sound.',
  'ض': 'Dad: Side of the tongue against upper molars.',
  'ظ': 'Zha: Tip of the tongue against edge of upper front teeth.',
  'غ': 'Ghayn: Top of the throat, gurgling sound.',
  'ق': 'Qaf: Deepest part of the tongue against the soft palate.',
  'ص': 'Sad: Whistling sound, tip of tongue against lower teeth.',
};

// ─── Difficulty Levels ────────────────────────────────────────────────────────
const LEVELS = {
  beginner: {
    id: 'beginner',
    title: 'Foundation',
    subtitle: 'Heavy Letters & Basic Harakat',
    description: 'Master the articulation of Tafkhim (heavy) letters and build a strong pronunciation foundation.',
    icon: Sparkles,
    gradient: 'from-emerald-400 to-teal-500',
    cardBg: 'bg-gradient-to-br from-emerald-50 to-teal-50',
    cardBorder: 'border-emerald-200/60',
    cardHover: 'hover:border-emerald-300 hover:shadow-emerald-100/50',
    accentText: 'text-emerald-600',
    accentBg: 'bg-emerald-500',
    accentLight: 'bg-emerald-50',
    selectedRing: 'ring-emerald-400',
    shadowColor: 'shadow-emerald-200',
    words: [
      { id: 'b1', surah: 1, ayah: 3, position: 1 },
      { id: 'b2', surah: 96, ayah: 1, position: 5 },
      { id: 'b3', surah: 1, ayah: 6, position: 3 },
      { id: 'b4', surah: 33, ayah: 23, position: 15 },
      { id: 'b5', surah: 4, ayah: 155, position: 15 },
      { id: 'b6', surah: 16, ayah: 75, position: 1 },
    ],
  },
  medium: {
    id: 'medium',
    title: 'Precision',
    subtitle: 'Qalqalah & Ghunnah',
    description: 'Refine your Qalqalah bounce and nasal Ghunnah duration for intermediate mastery.',
    icon: Award,
    gradient: 'from-amber-400 to-orange-500',
    cardBg: 'bg-gradient-to-br from-amber-50 to-orange-50',
    cardBorder: 'border-amber-200/60',
    cardHover: 'hover:border-amber-300 hover:shadow-amber-100/50',
    accentText: 'text-amber-600',
    accentBg: 'bg-amber-500',
    accentLight: 'bg-amber-50',
    selectedRing: 'ring-amber-400',
    shadowColor: 'shadow-amber-200',
    words: [
      { id: 'm1', surah: 2, ayah: 128, position: 7 }, // وَلَأُدْخِلَنَّهُمْ — Ghunnah (noon shaddah)
      { id: 'm2', surah: 48, ayah: 29, position: 34 },
      { id: 'm3', surah: 2, ayah: 137, position: 15 }, // فَسَيَكْفِيكَهُمُ   — Complex phonetic chain
      { id: 'm4', surah: 21, ayah: 40, position: 3 },    // مَـٰلِكِ             — Madd + articulation
      { id: 'm5', surah: 111, ayah: 1, position: 5 },    // وتب — Surah Al-Masad
      { id: 'm6', surah: 2, ayah: 27, position: 8 },    // نَسْتَعِينُ          — Ayn from the throat
    ],
  },
  advanced: {
    id: 'advanced',
    title: 'Mastery',
    subtitle: 'Complex Madds & Long Sequences',
    description: 'Tackle 4–6 count Madds, multi-syllable words, and the most demanding phonetic sequences.',
    icon: Star,
    gradient: 'from-indigo-400 to-violet-500',
    cardBg: 'bg-gradient-to-br from-indigo-50 to-violet-50',
    cardBorder: 'border-indigo-200/60',
    cardHover: 'hover:border-indigo-300 hover:shadow-indigo-100/50',
    accentText: 'text-indigo-600',
    accentBg: 'bg-indigo-500',
    accentLight: 'bg-indigo-50',
    selectedRing: 'ring-indigo-400',
    shadowColor: 'shadow-indigo-200',
    words: [
      { id: 'a1', surah: 24, ayah: 55, position: 8 },  // وَلَيَسْتَخْلِفَنَّهُمْ — Ghunnah + long
      { id: 'a2', surah: 11, ayah: 28, position: 16 },  // أَنُلْزِمُكُمُوهَا      — Longest word challenge
      { id: 'a3', surah: 25, ayah: 48, position: 11 },     // أَنْعَمْتَ               — Ikhfa + articulation
      { id: 'a4', surah: 2, ayah: 1, position: 1 },     // ٱلدِّينِ                — Lam Shamsiyyah + Madd
      { id: 'a5', surah: 1, ayah: 1, position: 3 },     // ٱلرَّحْمَـٰنِ            — Opening Bismillah precision
      { id: 'a6', surah: 12, ayah: 18, position: 1 },     // ٱلرَّحِيمِ               — Madd + heavy context
    ],
  },
};

// Helper to generate a unique fingerprint for the word list to automate cache clearing
const getLevelFingerprint = (words) => {
  const str = JSON.stringify(words);
  let hash = 0;
  for (let i = 0; i < str.length; i++) hash = ((hash << 5) - hash) + str.charCodeAt(i) | 0;
  return Math.abs(hash).toString(36);
};

// ─── Component ────────────────────────────────────────────────────────────────
export default function WordLabPage() {
  const [selectedLevel, setSelectedLevel] = useState(null);
  const [selectedWord, setSelectedWord] = useState(null);
  const [resolvedWords, setResolvedWords] = useState({});
  const [loadingLevel, setLoadingLevel] = useState(null);
  const [isTransitioning, setIsTransitioning] = useState(false);
  const [viewPhase, setViewPhase] = useState('selection'); // 'selection' | 'grid'

  // ─── Fetch Words for a Level ────────────────────────────────────────────────
  const fetchWordsForLevel = async (levelId) => {
    const level = LEVELS[levelId];
    if (!level) return;

    const fingerprint = getLevelFingerprint(level.words);
    const CACHE_KEY = `wordlab_${levelId}_autov1_${fingerprint}`;
    const CACHE_TTL = 7 * 24 * 60 * 60 * 1000;

    // Try cache
    try {
      const cached = JSON.parse(localStorage.getItem(CACHE_KEY));
      if (cached && Date.now() - cached.ts < CACHE_TTL && cached.data?.length > 0) {
        setResolvedWords(prev => ({ ...prev, [levelId]: cached.data }));
        return cached.data;
      }
    } catch (_) { }

    setLoadingLevel(levelId);

    // Group refs by surah:ayah
    const verseGroups = {};
    level.words.forEach(ref => {
      const key = `${ref.surah}:${ref.ayah}`;
      if (!verseGroups[key]) verseGroups[key] = { surah: ref.surah, ayah: ref.ayah, refs: [] };
      verseGroups[key].refs.push(ref);
    });

    const results = await Promise.all(
      Object.values(verseGroups).map(group =>
        fetch(
          API.QURAN(`${QURAN_CONTENT_BASE}/verses/by_chapter/${group.surah}?language=en&words=true&per_page=1&page=${group.ayah}&fields=text_uthmani_tajweed,text_uthmani&word_fields=text_uthmani,text_uthmani_tajweed,char_type_name,position`)
        )
          .then(res => res.json())
          .then(data => ({ group, verse: data.verses?.[0] || null }))
          .catch(() => ({ group, verse: null }))
      )
    );

    const resolved = [];
    for (const { group, verse } of results) {
      if (!verse) continue;
      const verseTajweedHtml = verse.text_uthmani_tajweed || '';
      const tajweedChunks = splitVerseTajweedIntoWords(verseTajweedHtml);
      const wordOnly = (verse.words || []).filter(w => w.char_type_name === 'word');

      for (const ref of group.refs) {
        const apiWord = (verse.words || []).find(w => w.position === ref.position);
        if (!apiWord) continue;
        const wordOnlyIdx = wordOnly.findIndex(w => w.position === ref.position);
        const verseTajweedForWord = wordOnlyIdx >= 0 ? tajweedChunks[wordOnlyIdx] : null;

        resolved.push({
          ...apiWord,
          id: ref.id,
          _surah: ref.surah,
          _ayah: ref.ayah,
          verse_tajweed: verseTajweedForWord,
          position: ref.position,
        });
      }
    }

    // Sort to match original order
    const idOrder = level.words.map(r => r.id);
    resolved.sort((a, b) => idOrder.indexOf(a.id) - idOrder.indexOf(b.id));

    if (resolved.length > 0) {
      setResolvedWords(prev => ({ ...prev, [levelId]: resolved }));
      try {
        localStorage.setItem(CACHE_KEY, JSON.stringify({ ts: Date.now(), data: resolved }));
      } catch (_) { }
    }

    setLoadingLevel(null);
    return resolved;
  };

  // ─── Level Selection Handler ────────────────────────────────────────────────
  const handleLevelSelect = async (levelId) => {
    setIsTransitioning(true);
    setSelectedLevel(levelId);

    // Fetch words if not already resolved
    if (!resolvedWords[levelId]) {
      await fetchWordsForLevel(levelId);
    }

    // Animate transition
    setTimeout(() => {
      setViewPhase('grid');
      setIsTransitioning(false);
    }, 400);
  };

  const handleBackToLevels = () => {
    setIsTransitioning(true);
    setSelectedWord(null);
    setTimeout(() => {
      setViewPhase('selection');
      setSelectedLevel(null);
      setIsTransitioning(false);
    }, 300);
  };

  // ─── Selection View ─────────────────────────────────────────────────────────
  const SelectionView = () => (
    <div className={`transition-all duration-500 ${isTransitioning ? 'opacity-0 translate-y-4' : 'opacity-100 translate-y-0'}`}>
      {/* Hero Header */}
      <div className="text-center mb-7">
        <div className="inline-flex items-center gap-2 px-3 py-1 bg-white/80 backdrop-blur-sm rounded-full border border-gray-100 shadow-sm mb-4">
          <FlaskConical size={14} className="text-emerald-500" />
          <span className="text-[11px] font-black text-gray-400 uppercase tracking-[0.2em]">Word Lab</span>
        </div>
        <h1 className="text-2xl md:text-3xl font-black text-gray-900 tracking-tight mb-1.5">
          Choose Your Level
        </h1>
        <p className="text-gray-400 text-xs max-w-sm mx-auto leading-relaxed">
          Select a mastery level to practice curated words with real-time Tajweed coaching.
        </p>
      </div>

      {/* Level Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 max-w-[44rem] mx-auto">
        {Object.values(LEVELS).map((level, idx) => {
          const Icon = level.icon;
          return (
            <button
              key={level.id}
              onClick={() => handleLevelSelect(level.id)}
              className={`
                group relative overflow-hidden
                ${level.cardBg} ${level.cardBorder} ${level.cardHover}
                border-2 rounded-[1.2rem] px-4.5 py-5
                flex flex-col items-center text-center
                transition-all duration-300 ease-out
                hover:-translate-y-1 hover:shadow-xl
                active:scale-[0.97]
                cursor-pointer
              `}
              style={{ animationDelay: `${idx * 120}ms` }}
            >
              {/* Glow Effect */}
              <div className={`absolute inset-0 bg-gradient-to-br ${level.gradient} opacity-0 group-hover:opacity-[0.08] transition-opacity duration-500 rounded-[1.2rem]`} />

              {/* Icon Container */}
              <div className={`
                relative w-12 h-12 rounded-xl mb-4
                bg-gradient-to-br ${level.gradient}
                flex items-center justify-center
                shadow-lg ${level.shadowColor}
                group-hover:shadow-xl group-hover:scale-110
                transition-all duration-500
              `}>
                <Icon className="text-white" size={20} />
                {/* Floating particles on hover */}
                <div className="absolute -top-1 -right-1 w-3 h-3 rounded-full bg-white/40 opacity-0 group-hover:opacity-100 group-hover:-translate-y-2 transition-all duration-700" />
                <div className="absolute -bottom-1 -left-1 w-2 h-2 rounded-full bg-white/30 opacity-0 group-hover:opacity-100 group-hover:translate-y-2 transition-all duration-700 delay-100" />
              </div>

              {/* Title */}
              <h3 className={`text-base font-black ${level.accentText} mb-0.5 tracking-tight`}>
                {level.title}
              </h3>
              <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-3">
                {level.subtitle}
              </p>

              {/* Description */}
              <p className="text-[11px] text-gray-500 leading-relaxed mb-4">
                {level.description}
              </p>

              {/* CTA Button */}
              <div className={`
                inline-flex items-center gap-1.5 px-4 py-2 rounded-full
                ${level.accentBg} text-white
                text-[11px] font-bold uppercase tracking-wider
                shadow-md ${level.shadowColor}
                group-hover:shadow-lg group-hover:scale-105
                transition-all duration-300
              `}>
                <span>Start Practice</span>
                <ChevronRight size={14} className="group-hover:translate-x-1 transition-transform" />
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );

  // ─── Grid View ──────────────────────────────────────────────────────────────
  const GridView = () => {
    const level = LEVELS[selectedLevel];
    if (!level) return null;
    const words = resolvedWords[selectedLevel] || [];
    const Icon = level.icon;

    return (
      <div className={`transition-all duration-500 ${isTransitioning ? 'opacity-0 -translate-y-4' : 'opacity-100 translate-y-0'}`}>
        {/* Grid Header */}
        <div className="max-w-[44rem] mx-auto">
          {/* Breadcrumb */}
          <div className="flex items-center gap-2 text-xs text-gray-400 mb-4">
            <button onClick={handleBackToLevels} className="hover:text-gray-600 transition-colors">← Back</button>
            <span className="text-gray-300">/</span>
            <span className={`font-bold ${level.accentText}`}>{level.title}</span>
          </div>

          <div className="flex items-center justify-between mb-5">
            <div className="flex items-center gap-3">
              <div className={`w-8 h-8 rounded-xl bg-gradient-to-br ${level.gradient} flex items-center justify-center shadow-sm`}>
                <Icon className="text-white" size={15} />
              </div>
              <div>
                <h2 className="text-lg font-black text-gray-900 tracking-tight">{level.title}</h2>
                <p className="text-[10px] text-gray-400 font-medium">{level.subtitle}</p>
              </div>
            </div>
            <span className={`px-3 py-1 rounded-xl ${level.accentLight} ${level.accentText} text-[9px] font-black uppercase tracking-wider`}>
              {words.length} Words
            </span>
          </div>

          {/* Instruction hint */}
          <p className="text-[11px] text-gray-400 mb-5">Tap any word to start practicing</p>

          {/* Word Grid */}
          {loadingLevel === selectedLevel || words.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16">
              <Loader2 className={`animate-spin ${level.accentText} mb-4`} size={32} />
              <span className="text-xs text-gray-400 font-bold">Loading practice words...</span>
            </div>
          ) : (
            <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
              {words.map((pw, idx) => (
                <button
                  key={pw.id}
                  onClick={() => setSelectedWord(pw)}
                  className={`
                    group relative overflow-hidden
                    rounded-xl px-4 py-6
                    text-center font-arabic text-xl md:text-2xl font-bold
                    cursor-pointer
                    transition-all duration-150 ease-out
                    active:scale-[0.97] active:bg-emerald-50
                    border
                    ${selectedWord?.id === pw.id
                      ? `${level.accentBg} text-white shadow-xl ${level.shadowColor} scale-[1.03] border-transparent`
                      : `bg-white text-slate-700 border-gray-200 hover:border-gray-300 hover:shadow-md hover:scale-[1.03]`
                    }
                  `}
                  style={{ animationDelay: `${idx * 80}ms` }}
                >
                  {/* Hover glow */}
                  {selectedWord?.id !== pw.id && (
                    <div className={`absolute inset-0 bg-gradient-to-br ${level.gradient} opacity-0 group-hover:opacity-[0.06] transition-opacity duration-300 rounded-2xl`} />
                  )}
                  <span
                    className="relative z-10 leading-[1.85]"
                    dangerouslySetInnerHTML={{
                      __html: selectedWord?.id === pw.id
                        ? (pw.text_uthmani || '')
                        : renderTajweed(stripAyahMarkers(pw.verse_tajweed || pw.text_uthmani_tajweed || pw.text_uthmani || ''), null)
                    }}
                  />
                </button>
              ))}
            </div>
          )}
        </div>
      </div>
    );
  };

  // ─── Word Drill Modal ────────────────────────────────────────────────────────
  const WordDrillModal = ({ word, onClose }) => {
    const [isRecording, setIsRecording] = useState(false);
    const [recordedBlob, setRecordedBlob] = useState(null);
    const [isAnalyzing, setIsAnalyzing] = useState(false);
    const [result, setResult] = useState(null);
    const [refMetrics, setRefMetrics] = useState(null);
    const [liveDuration, setLiveDuration] = useState(0);

    const recorderRef = useRef(null);
    const liveIntervalRef = useRef(null);
    const audioRef = useRef(null);

    const level = LEVELS[selectedLevel];

    const resolveAudioUrl = (w) => {
      return generateWordAudioUrl(w._surah, w._ayah, w.position);
    };

    // Preload reference metrics
    useEffect(() => {
      if (!word) return;
      const preload = async () => {
        try {
          const res = await fetch(API.ANALYZE_REFERENCE, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ reference_audio_url: resolveAudioUrl(word) })
          });
          if (res.ok) setRefMetrics(await res.json());
        } catch (e) { console.error("Preload error:", e); }
      };
      preload();
    }, [word]);

    if (!word) return null;

    const playWordAudio = () => {
      const url = resolveAudioUrl(word);
      if (audioRef.current) audioRef.current.pause();
      audioRef.current = new Audio(url);
      audioRef.current.play().catch(err => console.warn('[WordLab] Playback error:', err));
    };

    const startRecording = async () => {
      setResult(null);
      setRecordedBlob(null);
      setLiveDuration(0);
      try {
        const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
        const recorder = new MediaRecorder(stream);
        const chunks = [];
        const startTime = Date.now();

        liveIntervalRef.current = setInterval(() => {
          setLiveDuration(((Date.now() - startTime) / 1000).toFixed(1));
        }, 100);

        recorder.ondataavailable = (e) => chunks.push(e.data);
        recorder.onstop = () => {
          clearInterval(liveIntervalRef.current);
          const blob = new Blob(chunks, { type: 'audio/wav' });
          setRecordedBlob(blob);
          analyzeWord(blob);
        };
        recorder.start();
        recorderRef.current = recorder;
        setIsRecording(true);
      } catch (err) {
        console.error("Recording error:", err);
      }
    };

    const stopRecording = () => {
      if (recorderRef.current) {
        recorderRef.current.stop();
        setIsRecording(false);
        clearInterval(liveIntervalRef.current);
      }
    };

    const analyzeWord = async (blob) => {
      setIsAnalyzing(true);
      setResult(null);
      const formData = new FormData();
      formData.append('audio', blob, 'practice.webm');
      formData.append('reference_audio_url', resolveAudioUrl(word));
      formData.append('word_text', word.text_uthmani);
      formData.append('surah_number', word._surah);
      formData.append('ayah_number', word._ayah);
      formData.append('word_position', word.position);
      formData.append('difficulty', selectedLevel || 'intermediate');
      if (refMetrics?.duration) {
        formData.append('reference_duration', refMetrics.duration);
      }

      const wordTajweedMap = generateTajweedMap([word]);
      formData.append('tajweed_map', JSON.stringify(wordTajweedMap));

      try {
        const res = await fetch(API.ANALYZE_WORD, {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${localStorage.getItem('user_access_token') || ''}`
          },
          body: formData,
        });
        const data = await res.json();
        setResult(data);
      } catch (err) {
        console.error("Analysis error:", err);
      } finally {
        setIsAnalyzing(false);
      }
    };

    const MetricCard = ({ label, status, msg, icon }) => {
      if (status === null || status === undefined) return null;
      const st = typeof status === 'string' ? status.toLowerCase() : '';
      const isOk = st === 'ok' || st === 'balanced' || st === 'good' || st.includes('good');
      return (
        <div className={`p-3 rounded-xl border flex items-center justify-between transition-all ${isOk ? 'bg-emerald-50/50 border-emerald-100/50 text-emerald-700' : 'bg-rose-50/50 border-rose-100/50 text-rose-700'}`}>
          <div className="flex items-center gap-2.5 overflow-hidden">
            <div className="p-1.5 bg-white rounded-lg shadow-sm flex-shrink-0">{icon}</div>
            <div className="flex flex-col overflow-hidden">
              <span className="text-[10px] font-black uppercase tracking-wider opacity-60">{label}</span>
              <span className="text-xs font-bold leading-tight break-words">{msg || (st === 'ok' ? 'Passed' : status)}</span>
            </div>
          </div>
          {isOk ? (
            <div className="p-1 bg-emerald-500 rounded-full text-white"><Check size={12} /></div>
          ) : (
            <div className="p-1 bg-rose-500 rounded-full text-white"><X size={12} /></div>
          )}
        </div>
      );
    };

    const accentGradient = level ? `bg-gradient-to-br ${level.gradient}` : 'bg-emerald-500';

    return (
      <div className="fixed inset-0 z-[100] flex items-center justify-center p-3 bg-slate-900/50 backdrop-blur-lg animate-in fade-in duration-200">
        <div className="bg-white w-full max-w-[22rem] rounded-[2rem] shadow-xl flex flex-col max-h-[86vh] border border-gray-100 animate-in zoom-in-95 duration-300">
          {/* Header */}
          <div className="px-5 py-3.5 flex items-center justify-between border-b border-gray-100 flex-shrink-0">
            <div className="flex items-center gap-3">
              <div className={`w-1.5 h-6 rounded-full ${accentGradient}`} />
              <div>
                <h3 className="text-sm font-black text-slate-800 tracking-tight">Word Lab • {level?.title || 'Practice'}</h3>
                <p className="text-[10px] text-gray-400">Train your pronunciation</p>
              </div>
            </div>
            <button onClick={onClose} className="p-1.5 rounded-xl hover:bg-slate-100 text-slate-400 hover:text-slate-900 transition-all duration-200 active:scale-90"><X size={16} /></button>
          </div>

          {/* Scrollable Content */}
          <div className="flex-1 overflow-y-auto px-4 py-3.5 space-y-5 scrollbar-hide">
            {/* Main Word Display */}
            <div className="flex flex-col items-center w-full pt-2">
              <span
                className="text-4xl sm:text-5xl font-arabic font-bold text-emerald-600 leading-[1.85] drop-shadow-sm select-none transition-all hover:scale-[1.03] duration-300 text-center px-3"
                dangerouslySetInnerHTML={{
                  __html: renderTajweed(
                    stripAyahMarkers(word.verse_tajweed || word.text_uthmani_tajweed || word.text_uthmani || ''),
                    null
                  )
                }}
              />
            </div>

            {/* Results Area */}
            {result ? (
              <div className="w-full flex flex-col gap-5 animate-in slide-in-from-bottom-4 duration-700">
                {/* Score */}
                <div className="flex flex-col items-center gap-2">
                  <div className={`w-20 h-20 rounded-full flex items-center justify-center text-white shadow-xl transition-all duration-1000 animate-in zoom-in-75 ${(result?.score || 0) >= 90 ? 'bg-gradient-to-br from-emerald-400 to-teal-500 shadow-emerald-100' : (result?.score || 0) >= 75 ? 'bg-gradient-to-br from-amber-400 to-orange-500 shadow-amber-100' : 'bg-gradient-to-br from-rose-400 to-red-500 shadow-rose-100'}`}>
                    <span className="text-2xl font-black">{(result?.score || 0)}%</span>
                  </div>
                  <div className="text-center">
                    <span className="text-xs font-black uppercase tracking-[0.18em] text-slate-400 block">{result?.grade || 'Analysis Ready'}</span>
                    {result?.got_text && (
                      <div className={`mt-1 flex items-center justify-center gap-1.5 px-3 py-1 rounded-full text-[10px] font-bold ${result.text_match ? 'bg-emerald-50 text-emerald-600' : 'bg-rose-50 text-rose-600 animate-pulse'}`}>
                        {result.text_match ? <Check size={10} /> : <AlertCircle size={10} />}
                        {result.phonetic_error ? (
                          <span>PRONUNCIATION UNCLEAR / INCORRECT</span>
                        ) : (
                          <span>HEARD: {result.got_text}</span>
                        )}
                      </div>
                    )}
                  </div>
                </div>

                {/* Timing Comparison */}
                <div className="grid grid-cols-3 gap-2 bg-slate-50/50 p-3.5 rounded-[1rem] border border-slate-100 shadow-inner">
                  <div className="flex flex-col items-center">
                    <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-1">Your</span>
                    <span className="text-sm font-black text-slate-700 tracking-tight">{Number(result?.user_duration || 0).toFixed(2)}s</span>
                  </div>
                  <div className="flex flex-col items-center border-x border-slate-200">
                    <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-1">Expected</span>
                    <span className="text-sm font-black text-slate-700 tracking-tight">{Number(result?.ref_duration || 0).toFixed(2)}s</span>
                  </div>
                  <div className="flex flex-col items-center">
                    <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-1">Pace</span>
                    <span className={`text-sm font-black tracking-tight ${result?.ratio_result === 'Balanced' ? 'text-emerald-500' : result?.ratio_result === 'Rushing' ? 'text-rose-500' : 'text-amber-500'}`}>
                      {result?.ratio_result || '-'}
                    </span>
                  </div>
                </div>

                {/* Tajweed Metrics */}
                <div className="space-y-3">
                  {!result?.text_match && (
                    <div className="p-3 rounded-xl bg-rose-50 border border-rose-100 text-rose-700 flex items-center gap-2.5 mb-2">
                      <div className="p-1.5 bg-white rounded-lg shadow-sm"><XCircle size={14} className="text-rose-500" /></div>
                      <div>
                        <p className="text-[10px] font-black uppercase tracking-wider opacity-60">Accuracy Alert</p>
                        <p className="text-xs font-bold italic">\"Pronunciation didn't match the word perfectly.\"</p>
                      </div>
                    </div>
                  )}
                  <MetricCard label="Madd Duration Check" status={result?.madd_status} msg={result?.madd_message?.split(':')?.[1]?.trim()} icon={<Clock size={16} />} />
                  {result?.madd_match_insight && (
                    <div className="px-3 py-2.5 bg-amber-50 border border-amber-100 rounded-xl flex items-start gap-2.5 animate-in slide-in-from-top-2 duration-500">
                      <div className="p-1.5 bg-white rounded-lg shadow-sm text-amber-500 flex-shrink-0"><Info size={14} /></div>
                      <div className="flex flex-col">
                        <span className="text-[10px] font-black text-amber-600 uppercase tracking-widest mb-0.5">Pedagogical Insight</span>
                        <p className="text-[11px] font-bold text-amber-800 leading-snug">
                          Your timing was more consistent with a 2-count Madd. Try extending the vowel further to reach the 4-6 count goal.
                        </p>
                      </div>
                    </div>
                  )}
                  <MetricCard label="Ghunnah Presence" status={result?.ghunnah_status} icon={<Mic size={16} />} />
                  <MetricCard label="Heavy Letter (Tafkhim)" status={result?.heavy_status} icon={<Volume2 size={16} />} />
                  <MetricCard label="Qalqalah Bounce" status={result?.qalqalah_status} icon={<Zap size={16} />} />
                </div>
              </div>
            ) : (
              <div className="w-full">
                {!isRecording && (
                  <p className="text-center text-xs text-gray-400 leading-relaxed py-4">
                    Listen to the reference, then record to get instant feedback.
                  </p>
                )}

                {isRecording && (
                  <div className="flex flex-col items-center gap-3 py-5 animate-in fade-in duration-300">
                    <div className="text-[2.4rem] font-black text-rose-500 tracking-tighter tabular-nums px-5 py-2 bg-rose-50 rounded-xl shadow-inner">{liveDuration}s</div>
                    <p className="text-[10px] font-black text-rose-400 uppercase tracking-[0.3em] animate-pulse">RECORDING</p>
                  </div>
                )}
              </div>
            )}

            {/* Tips Section */}
            <div className="w-full bg-gray-50 px-3 py-2.5 rounded-xl">
              <p className="text-[10px] font-bold text-gray-500 uppercase tracking-wider mb-2">Tips</p>
              <ul className="space-y-1 text-xs text-gray-400">
                <li className="flex items-start gap-1.5">
                  <span className={`${level?.accentText || 'text-emerald-500'} mt-px`}>•</span>
                  <span>Match the reference pronunciation and timing exactly.</span>
                </li>
                <li className="flex items-start gap-1.5">
                  <span className={`${level?.accentText || 'text-emerald-500'} mt-px`}>•</span>
                  <span>Heavy letters (ض, ظ, ص, ط) need the tongue raised toward the palate.</span>
                </li>
                <li className="flex items-start gap-1.5">
                  <span className={`${level?.accentText || 'text-emerald-500'} mt-px`}>•</span>
                  <span>Short Madd = 2 beats, connected Madd = 4-5 beats.</span>
                </li>
              </ul>
            </div>
          </div>

          {/* Sticky Actions */}
          <div className="px-4 py-3 border-t border-gray-100 flex-shrink-0 bg-white rounded-b-[2rem]">
            {isRecording ? (
              <button
                onClick={stopRecording}
                className="w-full py-3 bg-gradient-to-b from-rose-500 to-red-600 text-white rounded-xl font-black text-xs flex items-center justify-center gap-2.5 shadow-lg shadow-rose-100 active:scale-[0.97] transition-all duration-200"
              >
                <div className="w-3 h-3 rounded-full bg-white animate-ping" />
                STOP RECORDING
              </button>
            ) : isAnalyzing ? (
              <button className="w-full py-3 bg-slate-100 text-slate-400 rounded-xl font-bold text-xs flex items-center justify-center gap-2.5 cursor-not-allowed">
                <RefreshCw className="animate-spin" size={16} />
                Analyzing...
              </button>
            ) : (
              <div className="flex flex-col gap-3 w-full">
                <div className="flex gap-2.5">
                  <button
                    onClick={playWordAudio}
                    className={`flex-1 py-3 ${level?.accentLight || 'bg-emerald-50'} ${level?.accentText || 'text-emerald-600'} rounded-xl font-bold text-xs flex items-center justify-center gap-2 hover:opacity-80 transition-all duration-200 active:scale-[0.97]`}
                  >
                    <PlayCircle size={16} />
                    Listen
                  </button>
                  <button
                    onClick={startRecording}
                    className="flex-[2] py-3 bg-slate-900 text-white rounded-xl font-bold text-xs hover:bg-slate-800 transition-all duration-200 active:scale-[0.97] shadow-lg shadow-slate-200 flex items-center justify-center gap-2 group"
                  >
                    <Mic size={16} className="group-hover:scale-110 transition-transform text-emerald-400" />
                    {result ? 'Record Again' : 'Record'}
                  </button>
                </div>
                {result && (
                  <p className="text-center text-[10px] font-bold text-slate-300 uppercase tracking-wider">
                    Aim for <span className={`${level?.accentText || 'text-emerald-500'}`}>85%+</span> to master
                  </p>
                )}
              </div>
            )}
          </div>
        </div>
      </div>
    );
  };

  // ─── Render ─────────────────────────────────────────────────────────────────
  return (
    <div className="p-3 md:p-6 h-full">
      {viewPhase === 'selection' ? <SelectionView /> : <GridView />}

      {selectedWord && (
        <WordDrillModal
          word={selectedWord}
          onClose={() => setSelectedWord(null)}
        />
      )}
    </div>
  );
}
