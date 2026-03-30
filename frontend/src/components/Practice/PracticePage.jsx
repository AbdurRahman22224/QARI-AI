import React, { useState, useEffect, useMemo, useRef } from 'react';
import { Mic, Loader2, AlertCircle, Info, BarChart3, RotateCcw, Volume2, Headphones, RefreshCw, Target, Clock, AudioLines, X, PlayCircle, Check, Zap, BookOpen, XCircle } from 'lucide-react';
import WaveSurfer from 'wavesurfer.js';
import RegionsPlugin from 'wavesurfer.js/dist/plugins/regions.esm.js';
import { renderTajweed, getLastVowel, splitVerseTajweedIntoWords, generateTajweedMap } from '../../utils/tajweedUtils';

const pad = (num) => String(num).padStart(3, '0');
const generateWordAudioUrl = (surah, ayah, position) =>
  `https://audio.qurancdn.com/wbw/${pad(surah)}_${pad(ayah)}_${pad(position)}.mp3`;


const RECITERS = [
  { id: 7, name: "Mishary Rashid Alafasy" },
  { id: 1, name: "AbdulBaset AbdulSamad (Murattal)" },
  { id: 2, name: "AbdulBaset AbdulSamad (Mujawwad)" },
  { id: 4, name: "Abu Bakr al-Shatri" },
  { id: 5, name: "Hani ar-Rifai" },
  { id: 9, name: "Mohamed Siddiq al-Minshawi" },
  { id: 8, name: "Yasser Ad-Dossari" },
  { id: 10, name: "Sa`ud ash-Shuraym" }
];
// Helper to convert English digits to Arabic digits (1 -> ١)
const toArabicDigits = (num) => {
  const arabicDigits = ['٠', '١', '٢', '٣', '٤', '٥', '٦', '٧', '٨', '٩'];
  return num.toString().split('').map(d => arabicDigits[parseInt(d)] || d).join('');
};

const AyahOrnament = ({ number }) => {
  const digits = toArabicDigits(number);
  const len = digits.length;

  return (
    <span className="inline-flex items-center justify-center relative select-none ml-[-4px] align-middle translate-y-[6px] mr-[-5px]">

      {/* Clean Quran-style ornament */}
      <svg width="36" height="36" viewBox="0 0 100 100" fill="none">

        {/* Outer white ring */}
        <circle cx="50" cy="50" r="40" stroke="white" strokeWidth="3" fill="none" />

        {/* Inner green circle */}
        <circle cx="50" cy="50" r="36" fill="#2D4A44" />

        {/* Top gold triangle */}
        <path d="M45 6L50 0L55 6Z" fill="#B59348" />

        {/* Bottom gold triangle */}
        <path d="M45 94L50 100L55 94Z" fill="#B59348" />

        {/* Small top dot */}
        <circle cx="50" cy="10" r="2.5" fill="#10B981" stroke="#B59348" strokeWidth="0.8" />

      </svg>

      {/* Number */}
      <span
        dir="ltr"
        className="absolute inset-0 flex items-center justify-center text-white font-bold leading-none"
        style={{
          fontSize: len === 1 ? '18px' : len === 2 ? '16px' : '14px',
          letterSpacing: len === 1 ? '0px' : len === 2 ? '-0.28em' : '-0.05em',
          fontFamily: 'Amiri, serif',
          transform: `
                  translateY(0px)
                  translateX(${len === 1 ? '0.5px' : len === 2 ? '1px' : '0px'})
                `
        }}
      >
        {digits}
      </span>

    </span>
  );
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

// Tajweed logic moved to tajweedUtils.js

// Aggressively strip native verse numbers or end-of-ayah symbols (۝)
const stripAyahMarkers = (text) => {
  if (!text) return '';
  return text.replace(/([٠-٩0-9\u06DD\u06DE]+(?![^<]*>))/g, '').trim();
};

export default function PracticePage() {
  const [chapters, setChapters] = useState([]);
  const [selectedChapter, setSelectedChapter] = useState(1);
  const [selectedAyah, setSelectedAyah] = useState(1);
  const [selectedReciter, setSelectedReciter] = useState(7);
  const [verseData, setVerseData] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isPlaying, setIsPlaying] = useState(false);
  const [isAutoPlayEnabled, setIsAutoPlayEnabled] = useState(false);
  const [isNavigatorOpen, setIsNavigatorOpen] = useState(false);
  const [surahSearch, setSurahSearch] = useState("");
  const [verseSearch, setVerseSearch] = useState("");
  const isAutoPlayEnabledRef = useRef(false); // live ref — readable inside closures
  const audioRef = React.useRef(null);

  // Recording states
  const [isRecording, setIsRecording] = useState(false);
  const [recordedBlob, setRecordedBlob] = useState(null);
  const [recordedUrl, setRecordedUrl] = useState(null);
  const [isPlayingRecording, setIsPlayingRecording] = useState(false);
  const [refDuration, setRefDuration] = useState(0); // 🕒 Duration of master recitation
  const [recordingTime, setRecordingTime] = useState(0);
  const mediaRecorderRef = useRef(null);
  const recordingTimerRef = useRef(null);
  const recordingAudioRef = useRef(null);

  // Wavesurfer refs
  const waveformRef = useRef(null);
  const wavesurferRef = useRef(null);

  // Analysis States
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [analysisResult, setAnalysisResult] = useState(null);
  const analysisResultRef = useRef(null);
  const [analysisError, setAnalysisError] = useState(null);
  const [difficultWords, setDifficultWords] = useState([]);

  // Word Focus states
  const [focusedWord, setFocusedWord] = useState(null);
  const [isWordPreparing, setIsWordPreparing] = useState(false);
  const wordFocusAudioRef = useRef(null);

  const translationText = useMemo(() => {
    if (!verseData?.translations?.length) return "";
    // Preserve <sup> tags for footnotes, strip others
    return verseData.translations[0].text.replace(/<(?!sup|\/sup)[^>]*>?/gm, '');
  }, [verseData]);

  const handleWordClick = (word, index) => {
    setFocusedWord({ ...word, index });
  };

  const analyzeRecording = async () => {
    if (!recordedBlob || !verseData) return;

    // 🕒 Resilience Check: If refDuration is null, 0, or undefined, we ESTIMATE
    const fallbackEstimate = (verseData.words.length * 2.5);
    const effectiveRefDuration = (refDuration && refDuration > 0) ? refDuration : fallbackEstimate;

    console.log(`[ASR] Starting analysis. RefDuration: ${refDuration}s, Effective: ${effectiveRefDuration}s (Fallback: ${fallbackEstimate}s)`);

    setIsAnalyzing(true);
    setAnalysisError(null);
    const formData = new FormData();
    formData.append('audio', recordedBlob, 'recitation.webm');
    formData.append('chapter_id', selectedChapter);
    formData.append('verse_id', selectedAyah);

    // Prepare word list and tajweed map for alignment
    const stripTajweed = (html) => html ? html.replace(/<[^>]+>/g, "").trim() : "";

    // Ensure word_list and tajweedMap use the same robust text extraction logic
    const words = verseData.words.map(w => w.text_uthmani || stripTajweed(w.text_uthmani_tajweed) || "");
    const tajweedMap = generateTajweedMap(verseData.words);

    formData.append('expected_text', words.join(' '));
    formData.append('word_list', JSON.stringify(words));
    formData.append('tajweed_map', JSON.stringify(tajweedMap));
    formData.append('reference_duration', effectiveRefDuration.toString()); // 🕒 Pass ref duration

    try {
      // #region agent log
      fetch('http://127.0.0.1:7576/ingest/f90dd0e0-036c-4373-9b72-19fc8b11d411', { method: 'POST', headers: { 'Content-Type': 'application/json', 'X-Debug-Session-Id': 'bc17f4' }, body: JSON.stringify({ sessionId: 'bc17f4', hypothesisId: 'H2', location: 'PracticePage.jsx:analyzeRecording', message: 'analyze preflight', data: { blobSize: recordedBlob?.size ?? null, blobType: recordedBlob?.type ?? null, wordCount: words.length, chapter: selectedChapter, ayah: selectedAyah, expectedLenChars: words.join(' ').length }, timestamp: Date.now() }) }).catch(() => { });
      // #endregion
      const res = await fetch('http://localhost:5000/api/analyze', {
        method: 'POST',
        body: formData,
      });
      if (!res.ok) {
        const errText = await res.text();
        // #region agent log
        fetch('http://127.0.0.1:7576/ingest/f90dd0e0-036c-4373-9b72-19fc8b11d411', { method: 'POST', headers: { 'Content-Type': 'application/json', 'X-Debug-Session-Id': 'bc17f4' }, body: JSON.stringify({ sessionId: 'bc17f4', hypothesisId: 'H1', location: 'PracticePage.jsx:analyzeRecording', message: 'analyze http error', data: { status: res.status, bodyPreview: errText.slice(0, 400) }, timestamp: Date.now() }) }).catch(() => { });
        // #endregion
        throw new Error('Analysis service error');
      }
      const data = await res.json();
      // #region agent log
      const wf = data.word_feedback;
      const segs = data.word_segments;
      fetch('http://127.0.0.1:7576/ingest/f90dd0e0-036c-4373-9b72-19fc8b11d411', { method: 'POST', headers: { 'Content-Type': 'application/json', 'X-Debug-Session-Id': 'bc17f4' }, body: JSON.stringify({ sessionId: 'bc17f4', hypothesisId: 'H3', location: 'PracticePage.jsx:analyzeRecording', message: 'analyze success shape', data: { score: data.score, hasRawText: Boolean(data.raw_text), rawTextLen: (data.raw_text || '').length, wordFeedbackLen: Array.isArray(wf) ? wf.length : -1, wordSegmentsLen: Array.isArray(segs) ? segs.length : -1, alignMismatch: Array.isArray(wf) && Array.isArray(segs) ? wf.length !== segs.length : null, apiError: data.error || null }, timestamp: Date.now() }) }).catch(() => { });
      // #endregion
      setAnalysisResult(data);
      if (data.difficult_words) setDifficultWords(data.difficult_words);
    } catch (err) {
      // #region agent log
      fetch('http://127.0.0.1:7576/ingest/f90dd0e0-036c-4373-9b72-19fc8b11d411', { method: 'POST', headers: { 'Content-Type': 'application/json', 'X-Debug-Session-Id': 'bc17f4' }, body: JSON.stringify({ sessionId: 'bc17f4', hypothesisId: 'H1', location: 'PracticePage.jsx:analyzeRecording', message: 'analyze catch', data: { errMsg: String(err?.message || err) }, timestamp: Date.now() }) }).catch(() => { });
      // #endregion
      setAnalysisError("Could not analyze recording. Please try again.");
      console.error(err);
    } finally {
      setIsAnalyzing(false);
    }
  };

  // ✅ Fixed ReferenceError: trackPractice
  const trackPractice = (chapter, ayah) => {
    try {
      const today = new Date().toISOString().slice(0, 10);
      const dates = JSON.parse(localStorage.getItem('practice_dates') || '[]');
      if (!dates.includes(today)) {
        dates.push(today);
        localStorage.setItem('practice_dates', JSON.stringify(dates));
      }
      const key = `${chapter}:${ayah}`;
      const ayahs = JSON.parse(localStorage.getItem('practiced_ayahs') || '[]');
      if (!ayahs.includes(key)) {
        ayahs.push(key);
        localStorage.setItem('practiced_ayahs', JSON.stringify(ayahs));
      }
      const sessions = JSON.parse(localStorage.getItem('practice_sessions') || '{}');
      sessions[key] = (sessions[key] || 0) + 1;
      localStorage.setItem('practice_sessions', JSON.stringify(sessions));
      console.log(`[Stats] Tracked practice for Surah ${chapter}, Ayah ${ayah}`);
    } catch (e) {
      console.warn("Failed to track practice stats:", e);
    }
  };

  // Word Focus Modal Component (Word Lab 3.0)
  const WordFocusModal = ({ word, onClose }) => {
    const [isModallyRecording, setIsModallyRecording] = useState(false);
    const [modalRecordedBlob, setModalRecordedBlob] = useState(null);
    const [isModallyAnalyzing, setIsModallyAnalyzing] = useState(false);
    const [hybridResult, setHybridResult] = useState(null);
    const [refMetrics, setRefMetrics] = useState(null);
    const [liveDuration, setLiveDuration] = useState(0);
    const [liveRMS, setLiveRMS] = useState(0);

    const modalRecorderRef = useRef(null);
    const liveIntervalRef = useRef(null);

    // Resolve audio URL from the ORIGINAL word (CDN truth)
    const resolveAudioUrl = (w) => {
      const src = w.originalWord || w;
      return generateWordAudioUrl(selectedChapter, selectedAyah, src.position);
    };

    // Preload Reference Metrics
    useEffect(() => {
      if (!word) return;
      const preloadRef = async () => {
        const refUrl = resolveAudioUrl(word);
        try {
          const res = await fetch('http://localhost:5000/api/analyze-reference', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ reference_audio_url: refUrl })
          });
          if (res.ok) {
            const data = await res.json();
            setRefMetrics(data);
          }
        } catch (e) { console.error("Preload error:", e); }
      };
      preloadRef();
    }, [word]);

    if (!word) return null;

    const wordIndex = word.displayIndex ?? word.index;
    const contextWords = verseData?.words?.slice(Math.max(0, wordIndex - 1), wordIndex + 2) || [];
    const tipKey = Object.keys(MAKHRAJ_TIPS).find(letter => word.text_uthmani?.includes(letter));
    const makhrajTip = tipKey ? MAKHRAJ_TIPS[tipKey] : null;

    // Calculate context for Tajweed (Divine Name rules)
    const prevWordVowel = wordIndex > 0 ? getLastVowel(verseData?.words[wordIndex - 1]?.text_uthmani || '') : null;
    const isFirst = wordIndex === 0;

    const startModalRecording = async () => {
      setHybridResult(null);
      setModalRecordedBlob(null);
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
          setModalRecordedBlob(blob);
          analyzeWordHybrid(blob);
        };
        recorder.start();
        modalRecorderRef.current = recorder;
        setIsModallyRecording(true);
      } catch (err) {
        console.error("Modal recording error:", err);
      }
    };

    const stopModalRecording = () => {
      if (modalRecorderRef.current) {
        modalRecorderRef.current.stop();
        setIsModallyRecording(false);
        clearInterval(liveIntervalRef.current);
      }
    };

    const analyzeWordHybrid = async (blob) => {
      setIsModallyAnalyzing(true);
      setHybridResult(null);

      const refUrl = resolveAudioUrl(word);

      const formData = new FormData();
      formData.append('audio', blob, 'practice.wav');
      formData.append('reference_audio_url', refUrl);
      formData.append('word_text', word.text_uthmani);

      // Extract tajweed rules from the word's HTML for the backend
      const wordTajweedMap = generateTajweedMap([word]);
      formData.append('tajweed_map', JSON.stringify(wordTajweedMap));

      try {
        console.log(`[Word Lab] Analyzing: ${word.text_uthmani}`);
        const res = await fetch('http://localhost:5000/api/analyze-word-hybrid', {
          method: 'POST',
          body: formData,
        });
        const result = await res.json();
        console.log("[Word Lab Result] Received from backend:", result);
        setHybridResult(result);
      } catch (err) {
        console.error("Hybrid analysis error:", err);
      } finally {
        setIsModallyAnalyzing(false);
      }
    };

    const playWordAudio = () => {
      const url = resolveAudioUrl(word);
      console.log('[Word Lab] Playing audio from CDN:', url);
      if (wordFocusAudioRef.current) wordFocusAudioRef.current.pause();
      wordFocusAudioRef.current = new Audio(url);
      wordFocusAudioRef.current.onerror = () => {
        console.warn("[Word Lab] Audio not found for position:", word.position);
      };
      wordFocusAudioRef.current.play().catch(err => {
        console.warn('[Word Lab] Playback error:', err);
      });
    };

    const MetricCard = ({ label, status, msg, icon }) => {
      if (status === null || status === undefined) return null;

      const st = typeof status === 'string' ? status.toLowerCase() : '';
      const isOk = st === 'ok' || st === 'balanced' || st === 'good' || st.includes('good');

      return (
        <div className={`p-4 rounded-2xl border flex items-center justify-between transition-all ${isOk ? 'bg-emerald-50/50 border-emerald-100/50 text-emerald-700' : 'bg-rose-50/50 border-rose-100/50 text-rose-700'}`}>
          <div className="flex items-center gap-3">
            <div className="p-2 bg-white rounded-xl shadow-sm">{icon}</div>
            <div className="flex flex-col">
              <span className="text-[10px] font-black uppercase tracking-wider opacity-60">{label}</span>
              <span className="text-sm font-bold leading-tight">{msg || (st === 'ok' ? 'Passed' : status)}</span>
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

    return (
      <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xl animate-in fade-in duration-300">
        <div className="bg-white w-full max-w-md rounded-[3rem] shadow-2xl flex flex-col max-h-[90vh] border border-white/20 animate-in zoom-in-95 duration-500">
          {/* Header */}
          <div className="px-8 py-5 flex items-center justify-between border-b border-gray-100 flex-shrink-0">
            <div className="flex items-center gap-3">
              <div className="w-1.5 h-6 bg-emerald-500 rounded-full" />
              <h3 className="text-lg font-black text-slate-800 tracking-tight">Word Lab</h3>
            </div>
            <button onClick={onClose} className="p-2.5 rounded-full hover:bg-slate-100 text-slate-400 hover:text-slate-900 transition-all active:scale-90"><X size={20} /></button>
          </div>

          {/* Scrollable Content */}
          <div className="flex-1 overflow-y-auto px-8 py-6 space-y-8 scrollbar-hide">
            {/* Main Word Display */}
            <div className="flex flex-col items-center w-full">
              <span
                className="text-5xl sm:text-7xl font-arabic font-bold text-emerald-600 leading-[2.2] sm:leading-[2] drop-shadow-md select-none transition-all hover:scale-105 duration-500 text-center px-4"
                dangerouslySetInnerHTML={{
                  __html: renderTajweed(
                    stripAyahMarkers(word.text_uthmani_tajweed || word.text_uthmani || ''),
                    (word.displayIndex > 0 && verseData?.words) ? getLastVowel(verseData.words[word.displayIndex - 1].text_uthmani) : null
                  )
                }}
              />
              <button
                onClick={playWordAudio}
                className="mt-6 sm:mt-4 flex items-center gap-3 px-8 py-3 sm:px-6 sm:py-2.5 bg-emerald-50 text-emerald-600 rounded-full font-black text-[10px] sm:text-xs hover:bg-emerald-100 transition-all active:scale-95 shadow-sm"
              >
                <PlayCircle size={20} />
                LISTEN REFERENCE
              </button>
            </div>

            {/* Comparison Results Area */}
            {hybridResult ? (
              <div className="w-full flex flex-col gap-6 animate-in slide-in-from-bottom-4 duration-700">
                {/* Score UI (Reduced & Centered) */}
                <div className="flex flex-col items-center gap-2">
                  <div className={`w-28 h-28 rounded-full flex items-center justify-center text-white shadow-xl transition-all duration-1000 animate-in zoom-in-75 ${(hybridResult?.score || 0) >= 90 ? 'bg-gradient-to-br from-emerald-400 to-teal-500 shadow-emerald-100' : (hybridResult?.score || 0) >= 75 ? 'bg-gradient-to-br from-amber-400 to-orange-500 shadow-amber-100' : 'bg-gradient-to-br from-rose-400 to-red-500 shadow-rose-100'}`}>
                    <span className="text-4xl font-black">{(hybridResult?.score || 0)}%</span>
                  </div>
                  <div className="text-center">
                    <span className="text-sm font-black uppercase tracking-[0.2em] text-slate-400 block">{hybridResult?.grade || 'Analysis Ready'}</span>
                    {hybridResult?.got_text && (
                      <div className={`mt-1 flex items-center justify-center gap-1.5 px-3 py-1 rounded-full text-[10px] font-bold ${hybridResult.text_match ? 'bg-emerald-50 text-emerald-600' : 'bg-rose-50 text-rose-600 animate-pulse'}`}>
                        {hybridResult.text_match ? <Check size={10} /> : <AlertCircle size={10} />}
                        HEARD: {hybridResult.got_text}
                      </div>
                    )}
                  </div>
                </div>

                {/* Comparison Clarity */}
                <div className="grid grid-cols-3 gap-3 bg-slate-50/50 p-5 rounded-[2rem] border border-slate-100 shadow-inner">
                  <div className="flex flex-col items-center">
                    <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-1">Your</span>
                    <span className="text-base font-black text-slate-700 tracking-tight">{hybridResult?.user_duration || '0.0'}s</span>
                  </div>
                  <div className="flex flex-col items-center border-x border-slate-200">
                    <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-1">Expected</span>
                    <span className="text-base font-black text-slate-700 tracking-tight">{hybridResult?.ref_duration || '0.0'}s</span>
                  </div>
                  <div className="flex flex-col items-center">
                    <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-1">Result</span>
                    <span className={`text-base font-black tracking-tight ${(hybridResult?.ratio_result === 'Good' || hybridResult?.ratio_result === 'Perfect') ? 'text-emerald-500' : 'text-amber-500'}`}>{hybridResult?.ratio_result || '-'}</span>
                  </div>
                </div>

                {/* Tajweed Specific Metrics */}
                <div className="space-y-3">
                  {!hybridResult?.text_match && (
                    <div className="p-4 rounded-2xl bg-rose-50 border border-rose-100 text-rose-700 flex items-center gap-3 mb-2">
                      <div className="p-2 bg-white rounded-xl shadow-sm"><XCircle size={16} className="text-rose-500" /></div>
                      <div>
                        <p className="text-[10px] font-black uppercase tracking-wider opacity-60">Accuracy Alert</p>
                        <p className="text-sm font-bold italic">"Pronunciation didn't match the word perfectly."</p>
                      </div>
                    </div>
                  )}
                  <MetricCard label="Madd Duration Check" status={hybridResult?.madd_status} msg={hybridResult?.madd_message} icon={<Clock size={16} />} />
                  <MetricCard label="Ghunnah Presence" status={hybridResult?.ghunnah_status} icon={<Mic size={16} />} />
                  <MetricCard label="Heavy Letter (Tafkhim)" status={hybridResult?.heavy_status} icon={<Volume2 size={16} />} />
                  <MetricCard label="Qalqalah Bounce" status={hybridResult?.qalqalah_status} icon={<Zap size={16} />} />
                </div>

                {/* Meaningful Suggestion */}
                {/* <div className="p-6 bg-slate-900 rounded-[2.5rem] flex items-start gap-4 shadow-xl border border-white/5">
                  <div className="p-3 bg-white/10 rounded-2xl text-emerald-400 flex-shrink-0 animate-pulse"><Zap size={20} /></div>
                  <div className="flex flex-col">
                    <span className="text-[10px] font-black text-slate-500 uppercase tracking-[0.2em] mb-1">Suggestion</span>
                    <p className="text-[15px] font-bold text-slate-100 leading-tight tracking-tight">{hybridResult?.suggestion || 'Great practice! Keep refining your Tajweed.'}</p>
                  </div>
                </div> */}
              </div>
            ) : (
              <div className="w-full space-y-6">
                {/* Practice Context */}
                <div className="bg-slate-50/30 p-8 rounded-[2.5rem] flex flex-col items-center border border-dashed border-slate-200">
                  <p className="text-[10px] font-black text-slate-300 uppercase tracking-[0.3em] mb-6">PRACTICE PATH</p>
                  <div className="flex flex-row-reverse gap-5 items-center">
                    {contextWords.map((cw, idx) => (
                      <span key={idx} className={`text-3xl font-arabic transition-all duration-700 ${cw.id === word.id ? 'text-emerald-500 font-bold scale-125' : 'text-slate-200'}`}>
                        {cw.text_uthmani}
                      </span>
                    ))}
                  </div>
                </div>

                {isModallyRecording && (
                  <div className="flex flex-col items-center gap-4 py-8 animate-in fade-in duration-500">
                    <div className="text-[4rem] font-black text-rose-500 tracking-tighter tabular-nums px-8 py-4 bg-rose-50 rounded-[2rem] shadow-inner">{liveDuration}s</div>
                    <p className="text-xs font-black text-rose-400 uppercase tracking-[0.3em] animate-pulse">RECORDING PRACTICE</p>
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Sticky Actions */}
          <div className="p-8 border-t border-gray-50 flex-shrink-0 bg-white rounded-b-[3rem]">
            {isModallyRecording ? (
              <button
                onClick={stopModalRecording}
                className="w-full py-5 bg-gradient-to-b from-rose-500 to-red-600 text-white rounded-[2rem] font-black text-lg flex items-center justify-center gap-3 shadow-2xl shadow-rose-200 active:scale-95 transition-all"
              >
                <div className="w-4 h-4 rounded-full bg-white animate-ping" />
                FINISH RECORDING
              </button>
            ) : isModallyAnalyzing ? (
              <button className="w-full py-5 bg-slate-100 text-slate-400 rounded-[2rem] font-black text-lg flex items-center justify-center gap-3 cursor-not-allowed">
                <RefreshCw className="animate-spin" size={24} />
                COACHING NOW...
              </button>
            ) : (
              <div className="flex flex-col gap-4 w-full">
                <button
                  onClick={startModalRecording}
                  className="w-full py-6 bg-slate-900 text-white rounded-[2rem] font-black text-lg hover:bg-slate-800 transition-all active:scale-[0.98] shadow-2xl shadow-slate-200 flex items-center justify-center gap-4 group"
                >
                  <Mic size={26} className="group-hover:scale-110 transition-transform text-emerald-400" />
                  {hybridResult ? 'REFINE AGAIN' : 'START RECORD'}
                </button>
                {hybridResult && (
                  <p className="text-center text-[10px] font-black text-slate-300 uppercase tracking-[0.2em]">
                    Goal: Aim for <span className="text-emerald-500 underline underline-offset-4">85%+</span> to master
                  </p>
                )}
              </div>
            )}
          </div>
        </div>
      </div>
    );
  };

  // Keep refs in sync with state
  useEffect(() => { isAutoPlayEnabledRef.current = isAutoPlayEnabled; }, [isAutoPlayEnabled]);
  useEffect(() => { analysisResultRef.current = analysisResult; }, [analysisResult]);

  // Fetch Chapters List
  useEffect(() => {
    fetch('https://api.quran.com/api/v4/chapters?language=en')
      .then(res => res.json())
      .then(data => setChapters(data.chapters || []))
      .catch(console.error);
  }, []);

  // Reset Ayah when Chapter changes
  useEffect(() => {
    setSelectedAyah(1);
    setIsAutoPlayEnabled(false);
  }, [selectedChapter]);

  // Clear recording when Ayah/Chapter changes
  useEffect(() => {
    setRecordedBlob(null);
    setRecordedUrl(null);
    setIsPlayingRecording(false);
    setRecordingTime(0);
    setAnalysisResult(null);
    setAnalysisError(null);
  }, [selectedChapter, selectedAyah]);

  // Fetch Verse of Selected Chapter and Ayah
  useEffect(() => {
    if (!selectedChapter) return;
    setIsLoading(true);

    fetch(`https://api.quran.com/api/v4/verses/by_chapter/${selectedChapter}?language=en&words=true&translations=20&audio=${selectedReciter}&per_page=1&page=${selectedAyah}&fields=text_uthmani_tajweed,text_uthmani&word_fields=text_uthmani,text_uthmani_tajweed,audio_url,char_type_name,position&segments=true&foot_notes=true`)
      .then(res => res.json())
      .then(data => {
        if (data.verses && data.verses.length > 0) {
          const rawWords = data.verses[0].words || [];
          const sanitized = [];

          rawWords.forEach((w, i) => {
            const stripTajweed = (html) => html ? html.replace(/<[^>]+>/g, "").trim() : "";
            const text = w.text_uthmani || stripTajweed(w.text_uthmani_tajweed) || "";

            const isWaqf =
              /^[ۖۗۘۙۚۛۜ۞]+$/.test(text) ||
              w.char_type_name === "waqf";

            // 🔑 SINGLE GATE: Must be a word type to be spoken
            if (w.char_type_name !== "word") {
              // Still merge waqf text into previous word for display
              if (isWaqf && sanitized.length > 0) {
                const prev = sanitized[sanitized.length - 1];
                prev.text_uthmani += text;
                prev.text_uthmani_tajweed =
                  (prev.text_uthmani_tajweed || prev.text_uthmani) +
                  (w.text_uthmani_tajweed || text);
              }
              return;
            }

            // Waqf WITH audio — still merge display text but keep as separate entry
            if (isWaqf && sanitized.length > 0) {
              const prev = sanitized[sanitized.length - 1];
              prev.text_uthmani += text;
              prev.text_uthmani_tajweed =
                (prev.text_uthmani_tajweed || prev.text_uthmani) +
                (w.text_uthmani_tajweed || text);
              return;
            }

            const isBism =
              Number(selectedChapter) !== 1 &&
              Number(selectedChapter) !== 9 &&
              i < 4 &&
              (text.includes("بِسْمِ") || text.includes("اللَّهِ"));

            if (isBism) {
              return;
            }

            // ✅ Only valid words reach here
            sanitized.push({
              ...w,
              audio_url: generateWordAudioUrl(selectedChapter, selectedAyah, w.position),
              originalWord: w,               // 🔑 Immutable CDN reference
              originalIndex: i,              // 🔑 Raw API index for debug tracking
              displayIndex: sanitized.length, // Index in the sanitized (UI) array
              text_uthmani: text,
              text_uthmani_tajweed: w.text_uthmani_tajweed || text
            });
          });

          // Split verse-level tajweed into per-word chunks
          const verseTajweedHtml = data.verses[0].text_uthmani_tajweed || '';
          const tajweedChunks = splitVerseTajweedIntoWords(verseTajweedHtml);

          // Map verse-level tajweed chunks to sanitized words
          sanitized.forEach((word, idx) => {
            if (idx < tajweedChunks.length) {
              word.verse_tajweed = tajweedChunks[idx];
            }
          });

          setVerseData({ ...data.verses[0], words: sanitized });

          // 🕒 Phase 1: Try to get duration from API segments (Instantly available!)
          if (data.verses[0].audio?.segments?.length > 0) {
            const segments = data.verses[0].audio.segments;
            const lastSeg = segments[segments.length - 1];
            if (lastSeg && lastSeg.stop) {
              const durSec = lastSeg.stop / 1000;
              setRefDuration(durSec);
              console.log(`🕒 Duration extracted from API segments: ${durSec}s`);
            }
          }

          // 🕒 Phase 2: Fire reliable Backend Fetch (just in case segments are missing)
          const audioUrl = data.verses[0].audio?.url || `https://verses.quran.com/${data.verses[0].audio_url}`;
          if (audioUrl) {
            fetch('http://localhost:5000/api/analyze-reference', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ reference_audio_url: audioUrl })
            })
              .then(res => res.json())
              .then(resData => {
                if (resData.duration && resData.duration > 0) {
                  setRefDuration(resData.duration);
                  console.log(`🕒 Reliable Ref Duration Sync: ${resData.duration}s`);
                }
              })
              .catch(err => console.error("Duration sync fetch failed:", err));
          }
        }

        if (audioRef.current && !isAutoPlayEnabled) {
          audioRef.current.pause();
          setIsPlaying(false);
        }
      })
      .catch(console.error)
      .finally(() => setIsLoading(false));

  }, [selectedChapter, selectedAyah, selectedReciter]);

  const currentChapterNode = chapters.find(c => c.id === parseInt(selectedChapter));
  const totalAyahs = currentChapterNode?.verses_count || 1;

  // Auto-play hook once verseData finishes loading
  useEffect(() => {
    if (isAutoPlayEnabled && verseData && !isLoading) {
      if (!verseData.audio?.url) {
        setIsAutoPlayEnabled(false);
        return;
      }
      playAudio();
    }
  }, [verseData, isLoading, isAutoPlayEnabled]);

  const playAudio = () => {
    if (!verseData?.audio?.url) return;

    // Some API URLs are relative paths, some are full URLs.
    // Base CDN can be verses.quran.com or audio.qurancdn.com
    let audioUrl = verseData.audio.url;
    if (!audioUrl.startsWith('http')) {
      audioUrl = `https://verses.quran.com/${audioUrl}`;
    }

    console.log("Playing Reference audio from:", audioUrl);

    if (!audioRef.current || audioRef.current.src !== audioUrl) {
      if (audioRef.current) audioRef.current.pause();
      audioRef.current = new Audio(audioUrl);

      audioRef.current.onended = () => {
        setIsPlaying(false);
        // Read live refs — never use stale closure values
        if (isAutoPlayEnabledRef.current && !analysisResultRef.current) {
          // Only advance if auto-play is on AND no report is visible
          setSelectedAyah(prev => {
            const cur = Number(prev);
            return cur < totalAyahs ? cur + 1 : cur;
          });
          if (Number(selectedAyah) >= totalAyahs) setIsAutoPlayEnabled(false);
        } else {
          setIsAutoPlayEnabled(false);
        }
      };
    }

    audioRef.current.play().catch(e => {
      console.error("Audio playback blocked", e);
      setIsPlaying(false);
      setIsAutoPlayEnabled(false);
    });
    setIsPlaying(true);
  };

  // Handle Play/Pause Toggle
  const togglePlay = () => {
    if (!verseData?.audio?.url) {
      alert("No reference audio available for this specific reciter/verse combination on the API yet.");
      return;
    }

    if (isPlaying && audioRef.current) {
      audioRef.current.pause();
      setIsPlaying(false);
      setIsAutoPlayEnabled(false);
    } else {
      setIsAutoPlayEnabled(true);
    }
  };

  // ── Recording Logic ──
  const startRecording = async () => {
    try {

      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mediaRecorder = new MediaRecorder(stream);
      const chunks = [];

      mediaRecorder.ondataavailable = (e) => {
        if (e.data.size > 0) chunks.push(e.data);
      };

      mediaRecorder.onstop = () => {
        const blob = new Blob(chunks, { type: 'audio/webm' });
        const url = URL.createObjectURL(blob);
        setRecordedBlob(blob);
        setRecordedUrl(url);
        stream.getTracks().forEach(track => track.stop());

        // ✅ Track practice ONLY after successful recording
        trackPractice(selectedChapter, selectedAyah);
      };

      mediaRecorderRef.current = mediaRecorder;
      mediaRecorder.start();
      setIsRecording(true);
      setRecordedBlob(null);
      setRecordedUrl(null);
      setRecordingTime(0);

      // Timer
      recordingTimerRef.current = setInterval(() => {
        setRecordingTime(prev => prev + 1);
      }, 1000);
    } catch (err) {
      console.error("Microphone access denied:", err);
      alert("Please allow microphone access to record your recitation.");
    }
  };

  const stopRecording = () => {
    if (mediaRecorderRef.current && isRecording) {
      mediaRecorderRef.current.stop();
      setIsRecording(false);
      clearInterval(recordingTimerRef.current);
    }
  };

  const playRecording = () => {
    if (wavesurferRef.current) {
      // After analysis: WaveSurfer controls playback
      wavesurferRef.current.play();
      setIsPlayingRecording(true);
      wavesurferRef.current.once('finish', () => setIsPlayingRecording(false));
      wavesurferRef.current.once('pause', () => setIsPlayingRecording(false));
    } else if (recordedUrl) {
      // Before analysis: create a fresh Audio element imperatively
      if (recordingAudioRef.current) {
        recordingAudioRef.current.pause();
      }
      const audio = new Audio(recordedUrl);
      recordingAudioRef.current = audio;
      audio.play().catch(e => console.error('Recording playback error:', e));
      setIsPlayingRecording(true);
      audio.onended = () => setIsPlayingRecording(false);
      audio.onpause = () => setIsPlayingRecording(false);
    }
  };

  const pauseRecording = () => {
    if (wavesurferRef.current) {
      wavesurferRef.current.pause();
      setIsPlayingRecording(false);
    } else if (recordingAudioRef.current) {
      recordingAudioRef.current.pause();
      setIsPlayingRecording(false);
    }
  };

  // Play reference once without enabling auto-advance.
  // Used inside the report so the ayah never increments when the verse ends.
  const playReferenceOnce = () => {
    if (!verseData?.audio?.url) return;
    const audioUrl = verseData.audio.url.startsWith('http')
      ? verseData.audio.url
      : `https://verses.quran.com/${verseData.audio.url}`;

    if (isPlaying && audioRef.current) {
      audioRef.current.pause();
      setIsPlaying(false);
      return;
    }

    // Always create a fresh audio object with auto-advance disabled
    if (audioRef.current) audioRef.current.pause();
    const audio = new Audio(audioUrl);
    audioRef.current = audio;
    audio.onended = () => setIsPlaying(false); // No ayah increment
    audio.play().catch(e => {
      console.error('Reference playback error:', e);
      setIsPlaying(false);
    });
    setIsPlaying(true);
    setIsAutoPlayEnabled(false); // Ensure auto-advance stays off
  };

  const formatTime = (s) => `${Math.floor(s / 60).toString().padStart(2, '0')}:${(s % 60).toString().padStart(2, '0')}`;

  // ── WaveSurfer Visualizer Effect ──
  useEffect(() => {
    if (!waveformRef.current || !recordedUrl || !analysisResult) return;

    if (wavesurferRef.current) {
      wavesurferRef.current.destroy();
    }

    const ws = WaveSurfer.create({
      container: waveformRef.current,
      waveColor: '#D1D5DB', // gray-300
      progressColor: '#3B82F6', // blue-500
      cursorColor: '#1E3A8A',
      barWidth: 2,
      barGap: 1,
      barRadius: 2,
      height: 80,
      url: recordedUrl
    });

    const wsRegions = ws.registerPlugin(RegionsPlugin.create());

    ws.on('ready', () => {
      // Draw Word Segments
      if (analysisResult.word_segments && analysisResult.word_feedback) {
        analysisResult.word_feedback.forEach((w, i) => {
          if (w.status !== 'missing' && analysisResult.word_segments[i]) {
            const seg = analysisResult.word_segments[i];
            const hasTajweed = w.tajweed && w.tajweed.some(t => t.severity === 'warning');

            // Determine color
            let color = 'rgba(16, 185, 129, 0.2)'; // green (correct)
            if (w.status === 'partial') color = 'rgba(59, 130, 246, 0.2)'; // blue
            if (hasTajweed) color = 'rgba(245, 158, 11, 0.3)'; // yellow
            if (w.status === 'incorrect') color = 'rgba(239, 68, 68, 0.2)'; // red

            wsRegions.addRegion({
              start: seg.start,
              end: seg.end,
              content: w.expected,
              color: color,
              drag: false,
              resize: false
            });
          }
        });
      }

      // Draw Pauses
      if (analysisResult.pauses) {
        analysisResult.pauses.forEach(p => {
          wsRegions.addRegion({
            start: p.start,
            end: p.end,
            content: '⏸️ Pause',
            color: 'rgba(239, 68, 68, 0.3)', // Red
            drag: false,
            resize: false
          });
        });
      }
    });

    wavesurferRef.current = ws;

    return () => {
      if (wavesurferRef.current) {
        wavesurferRef.current.destroy();
        wavesurferRef.current = null;
      }
    };
  }, [recordedUrl, analysisResult]);


  return (
    <div className="flex flex-col items-center justify-center min-h-full p-2 sm:p-6 animate-fade-in overflow-y-auto w-full">
      <AdvancedNavigator
        isNavigatorOpen={isNavigatorOpen}
        setIsNavigatorOpen={setIsNavigatorOpen}
        chapters={chapters}
        selectedChapter={selectedChapter}
        setSelectedChapter={setSelectedChapter}
        selectedAyah={selectedAyah}
        setSelectedAyah={setSelectedAyah}
        surahSearch={surahSearch}
        setSurahSearch={setSurahSearch}
        verseSearch={verseSearch}
        setVerseSearch={setVerseSearch}
      />
      <div className="w-full max-w-4xl bg-white/80 backdrop-blur-xl rounded-[2rem] sm:rounded-[3rem] shadow-2xl overflow-visible border border-white/40">

        {/* Controls Header */}
        <div className="p-4 sm:p-6 border-b border-gray-100 flex flex-col sm:flex-row gap-4 items-stretch sm:items-center justify-between bg-gradient-to-r from-emerald-50 to-teal-50 shadow-sm z-10 relative rounded-t-[2rem] sm:rounded-t-[3rem]">

          <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3">
            {/* New Advanced Navigator Trigger */}
            <button
              onClick={() => setIsNavigatorOpen(true)}
              className="flex items-center gap-4 pl-4 pr-6 py-2.5 bg-white border border-emerald-100 rounded-2xl shadow-sm hover:shadow-md hover:border-emerald-300 transition-all group"
            >
              <div className="p-2 bg-emerald-500 rounded-xl text-white shadow-inner group-hover:scale-110 transition-transform">
                <BookOpen size={18} />
              </div>
              <div className="flex flex-col items-start leading-none">
                <span className="text-[10px] font-black text-emerald-600 uppercase tracking-widest mb-1">Current Verse</span>
                <span className="text-sm font-black text-slate-800">
                  {chapters.find(c => c.id === selectedChapter)?.name_simple || 'Loading...'} : {selectedAyah}
                </span>
              </div>
            </button>
          </div>

          <div className="flex items-center justify-between sm:justify-start gap-3 bg-white/50 p-2 sm:p-0 rounded-xl sm:bg-transparent">
            <span className="text-[10px] sm:text-xs font-semibold text-gray-500 uppercase tracking-wider">Reciter:</span>
            <select
              className="bg-white border text-sm border-gray-200 text-gray-700 rounded-xl px-4 py-2 font-medium shadow-sm focus:ring-2 focus:ring-gray-500 focus:outline-none cursor-pointer flex-1 sm:w-auto"
              value={selectedReciter}
              onChange={(e) => setSelectedReciter(e.target.value)}
            >
              {RECITERS.map(reciter => (
                <option key={reciter.id} value={reciter.id}>{reciter.name}</option>
              ))}
            </select>
          </div>
        </div>

        {/* Display Content */}
        <div className="px-4 py-8 sm:p-10 flex flex-col items-center space-y-6 sm:space-y-8 min-h-[300px] justify-center relative">
          {isLoading ? (
            <div className="flex flex-col items-center justify-center space-y-4 w-full">
              <Loader2 className="animate-spin text-emerald-500" size={36} />
              <p className="text-emerald-600/70 font-medium text-sm">Fetching Divine Words...</p>
            </div>
          ) : (
            <>
              {/* Arabic Verse + Tajweed Legend */}
              <div className="w-full relative flex flex-col sm:flex-row items-center sm:items-start justify-center gap-3">
                <div className={`flex-1 flex flex-col items-center p-2 sm:p-6 rounded-3xl transition-all duration-700 ${isRecording ? 'bg-rose-50/30' : ''}`}>
                  <h2
                    className={`text-2xl sm:text-4xl font-arabic drop-shadow-sm leading-[2.5] sm:leading-relaxed text-center flex flex-wrap justify-center gap-x-3 gap-y-4 sm:gap-y-6 transition-all duration-700 ${isPlaying ? 'text-emerald-700' : 'text-slate-800'}`}
                    style={{ fontWeight: 550 }}
                    dir="rtl"
                  >
                    {verseData?.words?.map((w, i) => {
                      const isDiff = difficultWords.includes(i);
                      // Allah Rule Context: Peek back at previous word's last vowel
                      const prevWord = i > 0 ? verseData.words[i - 1] : null;
                      const precedingVowel = prevWord ? getLastVowel(prevWord.text_uthmani) : null;

                      // Prefer verse-level tajweed (uses <tajweed> tags, handles cross-word rules)
                      const tajweedText = w.verse_tajweed || w.text_uthmani_tajweed || w.text_uthmani || '';

                      return (
                        <button
                          key={i}
                          onClick={() => handleWordClick(w, i)}
                          className={`relative transition-all hover:scale-110 active:scale-95 focus:outline-none ${focusedWord?.index === i ? 'text-emerald-500 scale-105' : ''}`}
                        >
                          <span dangerouslySetInnerHTML={{ __html: renderTajweed(stripAyahMarkers(tajweedText), precedingVowel) }} />
                          {isDiff && (
                            <span className="absolute -top-1 -right-1 w-2 h-2 bg-amber-400 rounded-full shadow-[0_0_8px_rgba(251,191,36,0.8)] animate-pulse"></span>
                          )}
                        </button>
                      );
                    })}
                    <AyahOrnament number={verseData?.verse_number || selectedAyah} />
                  </h2>
                </div>

                {/* Tajweed Legend Button (Absolute on desktop, relative flex on mobile) */}
                <div className="group relative flex-shrink-0 mt-4 sm:mt-0">
                  <button className="text-gray-400 hover:text-emerald-500 hover:bg-emerald-50 rounded-lg p-3 sm:p-2 transition-all border border-gray-100 sm:border-transparent flex items-center gap-2">
                    <Info size={18} />
                    <span className="sm:hidden text-xs font-bold uppercase tracking-widest text-gray-500">Legend</span>
                  </button>
                  {/* Hoverable Tajweed Legend Card */}
                  <div className="absolute left-1/2 sm:left-0 -translate-x-1/2 sm:translate-x-0 bottom-full sm:bottom-auto sm:top-0 w-[240px] bg-white/95 backdrop-blur-xl rounded-2xl shadow-2xl border border-gray-100 p-4 opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all duration-300 z-[60] pointer-events-none group-hover:pointer-events-auto">
                    <p className="text-[11px] font-bold text-gray-400 uppercase tracking-widest mb-3">Tajweed Legend</p>
                    <div className="space-y-2.5">
                      <div className="flex items-center gap-2.5">
                        <span className="w-3 h-3 rounded-full bg-[#9E9E9E]"></span>
                        <span className="text-xs font-semibold text-gray-700">Silent Letter</span>
                      </div>
                      <div className="flex items-center gap-2.5">
                        <span className="w-3 h-3 rounded-full bg-[#F48FB1]"></span>
                        <span className="text-xs font-semibold text-gray-700">Normal Madd (2)</span>
                      </div>
                      <div className="flex items-center gap-2.5">
                        <span className="w-3 h-3 rounded-full bg-[#FF9800]"></span>
                        <span className="text-xs font-semibold text-gray-700">Separated Madd</span>
                      </div>
                      <div className="flex items-center gap-2.5">
                        <span className="w-3 h-3 rounded-full bg-[#F06292]"></span>
                        <span className="text-xs font-semibold text-gray-700">Connected Madd</span>
                      </div>
                      <div className="flex items-center gap-2.5">
                        <span className="w-3 h-3 rounded-full bg-[#D32F2F]"></span>
                        <span className="text-xs font-semibold text-gray-700">Necessary Madd (6)</span>
                      </div>
                      <div className="flex items-center gap-2.5">
                        <span className="w-3 h-3 rounded-full bg-[#4CAF50]"></span>
                        <span className="text-xs font-semibold text-gray-700">Ghunnah/Nasal</span>
                      </div>
                      <div className="flex items-center gap-2.5">
                        <span className="w-3 h-3 rounded-full bg-[#00BCD4]"></span>
                        <span className="text-xs font-semibold text-gray-700">Qalqala (Echo)</span>
                      </div>
                      <div className="flex items-center gap-2.5">
                        <span className="w-3 h-3 rounded-full bg-[#6169da]"></span>
                        <span className="text-xs font-semibold text-gray-700">Tafkhim (Heavy)</span>
                      </div>
                      <div className="border-t border-gray-100 my-1 pt-2">
                        <p className="text-[10px] font-bold text-gray-400 uppercase tracking-tighter mb-2">Extended Rules</p>
                        <div className="grid grid-cols-1 gap-2">
                          <div className="flex items-center gap-2">
                            <span className="w-2.5 h-2.5 rounded-full bg-[#21c54a]"></span>
                            <span className="text-[10px] font-medium text-gray-600">Idgham / Ghunnah</span>
                          </div>
                          <div className="flex items-center gap-2">
                            <span className="w-2.5 h-2.5 rounded-full bg-[#FDB927]"></span>
                            <span className="text-[10px] font-medium text-gray-600">Iqlab</span>
                          </div>
                          <div className="flex items-center gap-2">
                            <span className="w-2.5 h-2.5 rounded-full bg-[#2196F3]"></span>
                            <span className="text-[10px] font-medium text-gray-600">Lam Shamsiyah</span>
                          </div>
                          <div className="flex items-center gap-2">
                            <span className="w-2.5 h-2.5 rounded-full bg-[#3F51B5]"></span>
                            <span className="text-[10px] font-medium text-gray-600">Lam Qamariyah</span>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              {/* Meaning Card */}
              <div className={`w-full max-w-3xl mt-4 sm:mt-8 p-5 sm:p-8 rounded-[1.5rem] sm:rounded-[2.5rem] border transition-all duration-700 relative overflow-hidden group ${isPlaying ? 'bg-emerald-50/40 border-emerald-100 shadow-emerald-50' : 'bg-slate-50/50 border-slate-100 shadow-slate-50'}`}>
                {/* Background Decoration */}
                <div className="absolute -right-8 -top-8 w-24 sm:w-32 h-24 sm:h-32 bg-emerald-500/5 rounded-full blur-3xl group-hover:bg-emerald-500/10 transition-colors" />

                <div className="relative flex flex-col items-center gap-2 sm:gap-4">
                  <div className="flex items-center gap-2.5 opacity-60">
                    <BookOpen size={14} className="text-emerald-500" />
                    <span className="text-[9px] sm:text-[11px] font-black uppercase tracking-[0.3em] text-slate-400">Verse Meaning</span>
                  </div>

                  <p
                    className={`text-center text-base sm:text-lg font-medium leading-relaxed italic transition-colors duration-500 ${isPlaying ? 'text-emerald-900/90' : 'text-slate-700'}`}
                    dangerouslySetInnerHTML={{ __html: `"${translationText}"` }}
                  />
                </div>
              </div>

              {/* Action Buttons */}
              <div className="w-full flex flex-col sm:flex-row justify-center items-stretch sm:items-center gap-4 sm:gap-6 mt-4 sm:mt-8 px-2 sm:px-0">
                <button
                  onClick={togglePlay}
                  disabled={isRecording}
                  className={`flex items-center justify-center gap-4 px-8 py-5 rounded-[1.8rem] transition-all shadow-md border group ${isPlaying ? 'bg-amber-100 text-amber-800 border-amber-300 transform scale-[0.98]' : 'bg-emerald-50 text-emerald-700 hover:bg-emerald-100 border-emerald-200 hover:shadow-lg'} ${isRecording ? 'opacity-40 cursor-not-allowed' : ''}`}
                >
                  <BookOpen className={`flex-shrink-0 ${isPlaying ? 'animate-pulse text-amber-600' : 'group-hover:scale-110 transition-transform text-emerald-600'}`} size={32} />
                  <div className="flex flex-col items-start leading-tight">
                    <span className="font-black text-lg uppercase tracking-wider">{isPlaying ? 'Pause' : 'Reference'}</span>
                    <span className="text-[10px] font-bold opacity-60 uppercase">Listen Verse</span>
                  </div>
                </button>

                {/* Record Button */}
                {!isRecording && !recordedBlob && (
                  <button
                    onClick={startRecording}
                    disabled={isPlaying}
                    className={`flex items-center justify-center gap-4 px-10 py-5 bg-gradient-to-br from-red-500 to-rose-600 text-white rounded-[1.8rem] hover:from-red-600 hover:to-rose-700 shadow-xl shadow-rose-100 transform hover:-translate-y-1 transition-all group ${isPlaying ? 'opacity-40 cursor-not-allowed' : ''}`}
                  >
                    <Mic className="flex-shrink-0 group-hover:scale-110 transition-transform" size={32} />
                    <div className="flex flex-col items-start leading-tight">
                      <span className="font-black text-xl uppercase tracking-wider">Record</span>
                      <span className="text-[10px] font-bold opacity-60 uppercase">Start Practice</span>
                    </div>
                  </button>
                )}

                {/* Recording In Progress */}
                {isRecording && (
                  <button
                    onClick={stopRecording}
                    className="flex flex-row items-center justify-center gap-4 px-10 py-5 bg-gradient-to-b from-rose-600 to-red-700 text-white rounded-[1.8rem] shadow-xl shadow-red-300 animate-pulse transition-all"
                  >
                    <div className="flex items-center gap-3">
                      <div className="flex items-center gap-1.5 px-3 py-1 bg-white/10 rounded-full">
                        <span className="w-2 h-2 rounded-full bg-white animate-ping"></span>
                        <span className="text-xl font-mono font-bold leading-none">{formatTime(recordingTime)}</span>
                      </div>
                      <span className="font-black text-lg uppercase tracking-wider">STOP</span>
                    </div>
                  </button>
                )}

                {/* Recorded — Playback + Analyze Controls */}
                {!isRecording && recordedBlob && (
                  <div className="flex flex-col items-stretch sm:items-center gap-3 w-full sm:w-auto">
                    <div className="flex flex-col sm:flex-row gap-3 w-full">
                      <button
                        onClick={isPlayingRecording ? pauseRecording : playRecording}
                        className="flex items-center justify-center gap-3 px-6 py-4 bg-blue-50 text-blue-700 border border-blue-200 rounded-2xl hover:bg-blue-100 shadow-sm transition-all font-black text-xs uppercase tracking-widest"
                      >
                        <Volume2 size={18} />
                        {isPlayingRecording ? 'Pause' : 'My Recording'}
                      </button>
                      <button
                        onClick={analyzeRecording}
                        disabled={isAnalyzing}
                        className="flex-1 flex items-center justify-center gap-3 px-6 py-4 bg-gradient-to-r from-violet-500 to-purple-600 text-white rounded-2xl hover:from-violet-600 hover:to-purple-700 shadow-lg shadow-purple-200 transition-all font-black text-xs uppercase tracking-widest disabled:opacity-60"
                      >
                        {isAnalyzing ? <Loader2 size={18} className="animate-spin" /> : <BarChart3 size={18} />}
                        {isAnalyzing ? 'Analyzing...' : 'Analyze'}
                      </button>
                      <button
                        onClick={() => { setRecordedBlob(null); setRecordedUrl(null); setAnalysisResult(null); }}
                        className="flex items-center justify-center p-4 bg-rose-50 text-rose-700 border border-rose-200 rounded-2xl hover:bg-rose-100 shadow-sm transition-all"
                        title="Re-record"
                      >
                        <RotateCcw size={18} />
                      </button>
                    </div>
                    {!analysisResult && !isAnalyzing && (
                      <span className="text-[10px] text-emerald-600 font-black uppercase tracking-widest text-center px-3 py-1 bg-emerald-50 rounded-full animate-in fade-in slide-in-from-bottom-2">✓ Recording Saved</span>
                    )}
                  </div>
                )}
              </div>

              {/* Analysis Error */}
              {analysisError && (
                <div className="w-full max-w-2xl p-4 bg-red-50 border border-red-200 rounded-2xl flex items-start gap-3 mt-4">
                  <AlertCircle size={18} className="text-red-500 mt-0.5 flex-shrink-0" />
                  <p className="text-red-700 text-sm font-medium">{analysisError}</p>
                </div>
              )}

              {/* Analysis Results - Full Report */}
              {analysisResult && (
                <div className="w-full max-w-2xl mt-6 space-y-4 animate-fade-in">

                  {/* ── Score Header ── */}
                  <div className={`p-6 rounded-2xl border-2 shadow-lg text-center ${analysisResult.color === 'green' ? 'bg-gradient-to-br from-emerald-50 to-green-50 border-emerald-300' :
                    analysisResult.color === 'blue' ? 'bg-gradient-to-br from-blue-50 to-sky-50 border-blue-300' :
                      analysisResult.color === 'amber' ? 'bg-gradient-to-br from-amber-50 to-yellow-50 border-amber-300' :
                        'bg-gradient-to-br from-red-50 to-rose-50 border-red-300'
                    }`}>
                    <p className={`text-6xl font-black mb-1 ${analysisResult.color === 'green' ? 'text-emerald-600' :
                      analysisResult.color === 'blue' ? 'text-blue-600' :
                        analysisResult.color === 'amber' ? 'text-amber-600' : 'text-red-600'
                      }`}>{analysisResult.score}<span className="text-2xl text-gray-400 font-bold"> / 100</span></p>
                    <p className={`text-lg font-bold mb-2 ${analysisResult.color === 'green' ? 'text-emerald-700' :
                      analysisResult.color === 'blue' ? 'text-blue-700' :
                        analysisResult.color === 'amber' ? 'text-amber-700' : 'text-red-700'
                      }`}>{analysisResult.grade}</p>
                    <p className="text-gray-600 text-sm font-medium italic">"{analysisResult.summary}"</p>
                  </div>

                  {/* ── Metric Cards ── */}
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                    <div className="bg-white rounded-2xl shadow-md border border-gray-100 p-5 flex sm:flex-col items-center justify-between sm:justify-center gap-4">
                      <div className="flex items-center gap-4 sm:flex-col sm:gap-2">
                        <div className="p-2.5 bg-emerald-50 rounded-xl text-emerald-500"><Target size={22} /></div>
                        <div className="flex flex-col sm:items-center">
                          <p className="text-2xl font-black text-gray-800 leading-none">{analysisResult.accuracy}%</p>
                          <p className="text-[10px] font-bold text-gray-400 uppercase tracking-[0.2em] mt-1">Accuracy</p>
                        </div>
                      </div>
                    </div>
                    <div className="bg-white rounded-2xl shadow-md border border-gray-100 p-5 flex sm:flex-col items-center justify-between sm:justify-center gap-4">
                      <div className="flex items-center gap-4 sm:flex-col sm:gap-2">
                        <div className="p-2.5 bg-blue-50 rounded-xl text-blue-500"><Clock size={22} /></div>
                        <div className="flex flex-col sm:items-center">
                          <p className="text-2xl font-black text-gray-800 leading-none">{analysisResult.timing}%</p>
                          <p className="text-[10px] font-bold text-gray-400 uppercase tracking-[0.2em] mt-1">Timing</p>
                        </div>
                      </div>
                    </div>
                    <div className="bg-white rounded-2xl shadow-md border border-gray-100 p-5 flex sm:flex-col items-center justify-between sm:justify-center gap-4">
                      <div className="flex items-center gap-4 sm:flex-col sm:gap-2">
                        <div className="p-2.5 bg-purple-50 rounded-xl text-purple-500"><AudioLines size={22} /></div>
                        <div className="flex flex-col sm:items-center">
                          <p className="text-2xl font-black text-gray-800 leading-none">{analysisResult.integrity}%</p>
                          <p className="text-[10px] font-bold text-gray-400 uppercase tracking-[0.2em] mt-1">Tajweed</p>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* ── Word-by-Word Highlight ── */}
                  {analysisResult.word_feedback && analysisResult.word_feedback.length > 0 && (
                    <div className="bg-white rounded-2xl shadow-md border border-gray-100 p-4 sm:p-6">
                      <p className="text-[11px] font-black text-gray-400 uppercase tracking-[0.3em] mb-6 text-center">Visual Timeline</p>
                      <div className="flex flex-wrap gap-2.5 sm:gap-3 justify-center" dir="rtl">
                        {analysisResult.word_feedback.map((w, i) => {
                          const hasTajweed = w.tajweed && w.tajweed.some(t => t.severity === 'warning');
                          const bgColor = w.status === 'correct' && !hasTajweed ? 'bg-emerald-100 text-emerald-800 border-emerald-300' :
                            w.status === 'partial' ? 'bg-blue-100 text-blue-800 border-blue-300' :
                              hasTajweed ? 'bg-amber-100 text-amber-800 border-amber-300' :
                                w.status === 'missing' ? 'bg-red-100 text-red-800 border-red-300' :
                                  'bg-red-100 text-red-800 border-red-300';
                          const tooltip = w.status === 'missing' ? 'Missing word' :
                            w.status === 'incorrect' ? `Heard: ${w.got || '?'}` :
                              hasTajweed ? w.tajweed.filter(t => t.severity === 'warning').map(t => t.message).join('; ') :
                                w.status === 'partial' ? `Partial (${w.similarity}%)` : 'Correct ✓';
                          return (
                            <span key={i}
                              className={`group relative px-3 py-1.5 rounded-xl text-sm font-bold border cursor-default transition-all hover:scale-105 ${bgColor}`}
                              title={tooltip}
                            >
                              {w.expected}
                              <span className="absolute -top-8 left-1/2 -translate-x-1/2 bg-gray-900 text-white text-[10px] px-2 py-1 rounded-lg opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap pointer-events-none z-50">
                                {tooltip}
                              </span>
                            </span>
                          );
                        })}
                      </div>
                      <div className="flex gap-4 justify-center mt-4 text-[10px] font-semibold text-gray-400">
                        <span className="flex items-center gap-1"><span className="w-2.5 h-2.5 rounded-full bg-emerald-400"></span> Correct</span>
                        <span className="flex items-center gap-1"><span className="w-2.5 h-2.5 rounded-full bg-blue-400"></span> Partial</span>
                        <span className="flex items-center gap-1"><span className="w-2.5 h-2.5 rounded-full bg-amber-400"></span> Tajweed</span>
                        <span className="flex items-center gap-1"><span className="w-2.5 h-2.5 rounded-full bg-red-400"></span> Missing</span>
                      </div>
                    </div>
                  )}

                  {/* ── Feedback List ── */}
                  {analysisResult.feedback && analysisResult.feedback.length > 0 && (
                    <div className="bg-white rounded-2xl shadow-md border border-gray-100 p-5">
                      <p className="text-[11px] font-bold text-gray-400 uppercase tracking-widest mb-3">Detailed Feedback</p>
                      <div className="space-y-2">
                        {analysisResult.feedback.map((f, i) => (
                          <div key={i} className={`flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-3 rounded-xl text-sm font-medium ${f.type === 'error' ? 'bg-red-50 text-red-700' :
                            f.type === 'warning' ? 'bg-amber-50 text-amber-700' :
                              'bg-blue-50 text-blue-700'
                            }`}>
                            <div className="flex items-start gap-3">
                              <span className="text-base flex-shrink-0 mt-0.5">{f.icon}</span>
                              <span className="leading-relaxed">{f.message}</span>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* ── Suggestions ── */}
                  {analysisResult.suggestions && analysisResult.suggestions.length > 0 && (
                    <div className="bg-gray-50 rounded-2xl border border-gray-200 p-4">
                      <p className="text-[11px] font-bold text-gray-400 uppercase tracking-widest mb-2">💡 Suggestions</p>
                      {analysisResult.suggestions.map((s, i) => (
                        <p key={i} className="text-gray-600 text-sm font-medium leading-relaxed">• {s}</p>
                      ))}
                    </div>
                  )}

                  {/* ── Audio Waveform Visualizer ── */}
                  <div className="bg-white rounded-2xl shadow-md border border-gray-100 p-4">
                    <p className="text-[11px] font-bold text-gray-400 uppercase tracking-widest mb-2">Waveform Analysis</p>
                    <div ref={waveformRef} className="w-full rounded-xl overflow-hidden bg-gray-50 border border-gray-100 mb-3 relative">
                      {/* WaveSurfer mounts here */}
                    </div>

                    {/* What We Heard text underneath */}
                    <div className="pt-2 border-t border-gray-100 mt-2">
                      <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-1">Raw Output</p>
                      <p className="text-gray-700 font-medium text-xs" dir="rtl">{analysisResult.raw_text || '(no speech detected)'}</p>
                    </div>
                  </div>

                  {/* ── Audio Controls ── */}
                  <div className="flex gap-3 justify-center flex-wrap">
                    <button
                      onClick={isPlayingRecording ? pauseRecording : playRecording}
                      className="flex items-center gap-2 px-4 py-2.5 bg-blue-50 text-blue-700 border border-blue-200 rounded-xl hover:bg-blue-100 shadow-sm transition-all font-semibold text-sm"
                    >
                      <Volume2 size={16} />
                      {isPlayingRecording ? 'Pause Yours' : '▶ Play Yours'}
                    </button>
                    <button
                      onClick={playReferenceOnce}
                      className="flex items-center gap-2 px-4 py-2.5 bg-emerald-50 text-emerald-700 border border-emerald-200 rounded-xl hover:bg-emerald-100 shadow-sm transition-all font-semibold text-sm"
                    >
                      <Headphones size={16} />
                      🎧 Reference
                    </button>
                    <button
                      onClick={() => { setRecordedBlob(null); setRecordedUrl(null); setAnalysisResult(null); }}
                      className="flex items-center gap-2 px-4 py-2.5 bg-rose-50 text-rose-700 border border-rose-200 rounded-xl hover:bg-rose-100 shadow-sm transition-all font-semibold text-sm"
                    >
                      <RefreshCw size={16} />
                      🔁 Try Again
                    </button>
                  </div>

                </div>
              )}
            </>
          )}
        </div>

        <div className="bg-gray-50 p-6 flex items-center justify-between text-sm text-gray-500 border-t border-gray-100">
          <span>Mode: <strong className="text-emerald-700 font-semibold bg-emerald-100 px-3 py-1.5 rounded-lg shadow-sm">Tartil (Slow)</strong></span>
          <span className={`flex items-center gap-3 font-medium px-4 py-2 rounded-xl shadow-sm border ${isRecording ? 'bg-red-50 border-red-200 text-red-600' : 'bg-white border-gray-100'}`}>
            <span className="relative flex h-3 w-3">
              <span className={`animate-ping absolute inline-flex h-full w-full rounded-full ${isRecording ? 'bg-red-400' : 'bg-emerald-400'} opacity-75`}></span>
              <span className={`relative inline-flex rounded-full h-3 w-3 ${isRecording ? 'bg-red-500' : 'bg-emerald-500'} shadow-sm`}></span>
            </span>
            {isRecording ? 'Recording...' : recordedBlob ? 'Recording saved' : 'Ready to record'}
          </span>
        </div>
      </div>

      {focusedWord && (
        <WordFocusModal
          word={focusedWord}
          onClose={() => setFocusedWord(null)}
        />
      )}
    </div>
  );
}

const AdvancedNavigator = ({
  isNavigatorOpen, setIsNavigatorOpen,
  chapters, selectedChapter, setSelectedChapter,
  selectedAyah, setSelectedAyah,
  surahSearch, setSurahSearch,
  verseSearch, setVerseSearch
}) => {
  if (!isNavigatorOpen) return null;

  const filteredChapters = chapters.filter(c =>
    c.name_simple.toLowerCase().includes(surahSearch.toLowerCase()) ||
    c.id.toString().includes(surahSearch)
  );

  const currentChapter = chapters.find(c => c.id === selectedChapter);
  const ayahsCount = currentChapter?.verses_count || 1;

  return (
    <div
      className="fixed inset-0 z-[120] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xl animate-in fade-in duration-300"
      onClick={() => setIsNavigatorOpen(false)}
    >
      <div
        className="bg-white w-full max-w-2xl rounded-[3rem] shadow-2xl flex flex-col h-[80vh] border border-white/20 animate-in zoom-in-95 duration-500 overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="px-8 py-6 flex items-center justify-between border-b border-gray-100 bg-emerald-50/30">
          <div className="flex items-center gap-4">
            <div className="p-3 bg-emerald-500 rounded-2xl text-white shadow-lg shadow-emerald-200">
              <Target size={24} />
            </div>
            <div>
              <h3 className="text-xl font-black text-slate-800 tracking-tight leading-none">Quick Navigator</h3>
              <p className="text-[10px] font-black text-emerald-600 uppercase tracking-widest mt-1">Select Surah & Verse</p>
            </div>
          </div>
          <button
            onClick={() => setIsNavigatorOpen(false)}
            className="p-3 rounded-full hover:bg-white hover:shadow-md text-slate-400 hover:text-slate-900 transition-all active:scale-90"
          >
            <X size={24} />
          </button>
        </div>

        <div className="flex-1 flex overflow-hidden">
          {/* Left: Surah Search & List */}
          <div className="w-2/3 flex flex-col border-r border-gray-100">
            <div className="p-6">
              <div className="relative group">
                <input
                  type="text"
                  placeholder="Search Surah..."
                  className="w-full pl-12 pr-4 py-4 bg-slate-50 border-none rounded-2xl text-slate-700 font-bold placeholder:text-slate-300 focus:ring-2 focus:ring-emerald-500/20 transition-all"
                  value={surahSearch}
                  onChange={(e) => setSurahSearch(e.target.value)}
                  autoFocus
                />
                <Mic size={20} className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-300 group-hover:text-emerald-500 transition-colors" />
              </div>
            </div>

            <div className="flex-1 overflow-y-auto px-4 pb-6 space-y-1 scrollbar-hide">
              {filteredChapters.map(chapter => (
                <button
                  key={chapter.id}
                  onClick={() => {
                    setSelectedChapter(chapter.id);
                    setSelectedAyah(1); // Reset to first ayah when surah changes
                  }}
                  className={`w-full flex items-center justify-between px-4 py-4 rounded-2xl transition-all group ${selectedChapter === chapter.id ? 'bg-emerald-500 text-white shadow-lg shadow-emerald-100' : 'hover:bg-slate-50 text-slate-600'}`}
                >
                  <div className="flex items-center gap-4">
                    <span className={`text-xs font-black w-8 h-8 rounded-lg flex items-center justify-center ${selectedChapter === chapter.id ? 'bg-white/20' : 'bg-slate-100 group-hover:bg-emerald-100 group-hover:text-emerald-600'}`}>
                      {chapter.id}
                    </span>
                    <span className="font-bold tracking-tight text-lg">{chapter.name_simple}</span>
                  </div>
                  {selectedChapter === chapter.id && <div className="w-2 h-2 rounded-full bg-white animate-pulse" />}
                </button>
              ))}
            </div>
          </div>

          {/* Right: Verse List */}
          <div className="w-1/3 flex flex-col bg-slate-50/30">
            <div className="p-6 border-b border-gray-100 space-y-3">
              <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest text-center">VERSE</p>
              <input
                type="text"
                placeholder="Go to..."
                className="w-full px-3 py-2 bg-white border border-slate-100 rounded-xl text-center font-bold text-slate-700 placeholder:text-slate-300 focus:ring-2 focus:ring-emerald-500/20 transition-all text-sm"
                value={verseSearch}
                onChange={(e) => {
                  const val = e.target.value.replace(/\D/g, ''); // Numbers only
                  if (Number(val) <= ayahsCount) setVerseSearch(val);
                }}
              />
            </div>
            <div className="flex-1 overflow-y-auto p-4 space-y-1 scrollbar-hide">
              {[...Array(ayahsCount)].map((_, i) => {
                const num = i + 1;
                // Filter list if searching
                if (verseSearch && !num.toString().includes(verseSearch)) return null;

                return (
                  <button
                    key={num}
                    onClick={() => {
                      setSelectedAyah(num);
                      setVerseSearch(""); // Clear search
                      setIsNavigatorOpen(false); // Close on selection
                    }}
                    className={`w-full py-4 rounded-xl font-bold transition-all ${selectedAyah === num ? 'bg-slate-900 text-white shadow-xl scale-105' : 'text-slate-500 hover:bg-white hover:text-emerald-600 shadow-sm'}`}
                  >
                    {num}
                  </button>
                );
              })}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
