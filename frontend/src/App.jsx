import React, { useState, useEffect } from 'react';
import { BookOpen, Mic, LayoutDashboard, Settings, LogIn, Loader2, AlertCircle, Info, BarChart3, RotateCcw } from 'lucide-react';

const REDIRECT_URI = 'http://localhost:3000/callback'; // Configured callback URL

function LoginPage({ onFallback }) {
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');

  const handleLogin = async () => {
    setIsLoading(true);
    setError('');
    try {
      const res = await fetch(`http://localhost:5000/api/auth/login-url?redirect_uri=${encodeURIComponent(REDIRECT_URI)}`);
      const data = await res.json();
      if (data.url) {
        window.location.href = data.url;
      } else {
        setError('Failed to get authorization URL from server.');
        setIsLoading(false);
      }
    } catch (err) {
      console.error(err);
      setError('Cannot connect to backend server. Is it running?');
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col items-center justify-center p-4">
      <div className="w-full max-w-md bg-white rounded-3xl shadow-2xl overflow-hidden p-8 text-center border border-gray-100">
        <div className="w-20 h-20 mx-auto bg-gradient-to-br from-emerald-400 to-teal-500 rounded-3xl flex items-center justify-center shadow-lg shadow-emerald-200 mb-6">
          <BookOpen className="text-white" size={40} />
        </div>
        <h1 className="text-3xl font-bold text-gray-900 mb-2">Qari AI</h1>
        <p className="text-gray-500 mb-8">Your intelligent Quran recitation coach.</p>

        {error && (
          <div className="mb-6 p-4 bg-red-50 text-red-700 rounded-xl flex items-center text-sm text-left border border-red-100">
            <AlertCircle size={20} className="mr-2 flex-shrink-0" />
            {error}
          </div>
        )}

        <button
          onClick={handleLogin}
          disabled={isLoading}
          className="w-full flex items-center justify-center px-6 py-4 bg-emerald-600 text-white rounded-2xl hover:bg-emerald-700 transition-colors shadow-lg font-semibold text-lg mb-4 disabled:opacity-70"
        >
          {isLoading ? <Loader2 className="animate-spin text-white" size={24} /> : <LogIn className="mr-3" size={24} />}
          Login with Quran Foundation
        </button>

        <div className="relative flex items-center py-4">
          <div className="flex-grow border-t border-gray-200"></div>
          <span className="flex-shrink-0 mx-4 text-gray-400 text-sm">Or</span>
          <div className="flex-grow border-t border-gray-200"></div>
        </div>

        <button
          onClick={onFallback}
          className="w-full flex items-center justify-center px-6 py-3 bg-white text-gray-700 border border-gray-200 rounded-2xl hover:bg-gray-50 transition-colors font-medium"
        >
          Simulate Hackathon Login
        </button>
      </div>
    </div>
  );
}

const RECITERS = [
  { id: 7, name: "Mishari Rashid al-`Afasy" },
  { id: 97, name: "Yasser Ad Dussary" },
  { id: 1, name: "AbdulBaset AbdulSamad" },
  { id: 3, name: "Abdur-Rahman as-Sudais" },
  { id: 12, name: "Mahmoud Khalil Al-Husary" }
];

function PracticePage() {
  const [chapters, setChapters] = useState([]);
  const [selectedChapter, setSelectedChapter] = useState(1);
  const [selectedAyah, setSelectedAyah] = useState(1);
  const [selectedReciter, setSelectedReciter] = useState(7);
  const [verseData, setVerseData] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isPlaying, setIsPlaying] = useState(false);
  const [isAutoPlayEnabled, setIsAutoPlayEnabled] = useState(false);
  const audioRef = React.useRef(null);

  // Recording states
  const [isRecording, setIsRecording] = useState(false);
  const [recordedBlob, setRecordedBlob] = useState(null);
  const [recordedUrl, setRecordedUrl] = useState(null);
  const [isPlayingRecording, setIsPlayingRecording] = useState(false);
  const [recordingTime, setRecordingTime] = useState(0);
  const mediaRecorderRef = React.useRef(null);
  const recordingTimerRef = React.useRef(null);
  const recordingAudioRef = React.useRef(null);

  // Analysis states
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [analysisResult, setAnalysisResult] = useState(null);
  const [analysisError, setAnalysisError] = useState(null);

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

    fetch(`https://api.quran.com/api/v4/verses/by_chapter/${selectedChapter}?language=en&words=true&translations=20&audio=${selectedReciter}&per_page=1&page=${selectedAyah}&fields=text_uthmani_tajweed,text_uthmani&word_fields=text_uthmani_tajweed`)
      .then(res => res.json())
      .then(data => {
        if (data.verses && data.verses.length > 0) {
          setVerseData(data.verses[0]);
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
    const audioUrl = verseData.audio.url.startsWith('http') ? verseData.audio.url : `https://verses.quran.com/${verseData.audio.url}`;

    if (!audioRef.current || audioRef.current.src !== audioUrl) {
      if (audioRef.current) audioRef.current.pause();
      audioRef.current = new Audio(audioUrl);

      audioRef.current.onended = () => {
        setIsPlaying(false);
        if (isAutoPlayEnabled && selectedAyah < totalAyahs) {
          setSelectedAyah(Number(selectedAyah) + 1);
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
    if (!recordedUrl) return;
    if (recordingAudioRef.current) recordingAudioRef.current.pause();
    recordingAudioRef.current = new Audio(recordedUrl);
    recordingAudioRef.current.onended = () => setIsPlayingRecording(false);
    recordingAudioRef.current.play();
    setIsPlayingRecording(true);
  };

  const pauseRecording = () => {
    if (recordingAudioRef.current) {
      recordingAudioRef.current.pause();
      setIsPlayingRecording(false);
    }
  };

  const formatTime = (s) => `${Math.floor(s / 60).toString().padStart(2, '0')}:${(s % 60).toString().padStart(2, '0')}`;

  // ── Analyze Recording ──
  const analyzeRecording = async () => {
    if (!recordedBlob || !verseData) return;

    setIsAnalyzing(true);
    setAnalysisError(null);
    setAnalysisResult(null);

    try {
      const expectedText = verseData.text_uthmani || verseData.words?.map(w => w.text_uthmani || w.text || '').join(' ') || '';

      const formData = new FormData();
      formData.append('audio', recordedBlob, 'recording.webm');
      formData.append('expected_text', expectedText);

      const res = await fetch('http://localhost:5000/api/analyze', {
        method: 'POST',
        body: formData,
      });

      const data = await res.json();

      if (!res.ok) {
        setAnalysisError(data.error || 'Analysis failed');
      } else {
        setAnalysisResult(data);
      }
    } catch (err) {
      console.error('Analysis error:', err);
      setAnalysisError('Could not connect to analysis service. Make sure the ASR server is running.');
    } finally {
      setIsAnalyzing(false);
    }
  };

  const translationText = verseData?.translations?.[0]?.text
    ?.replace(/<sup[^>]*>/g, '<sup class="text-[10px] text-emerald-500 font-bold ml-0.5 cursor-default">')
    ?.replace(/<(?!\/?sup)[^>]*>/g, '')
    || "Translation loading...";

  // Aggregate Arabic text from API securely rendering tajweed
  const arabicText = verseData?.text_uthmani_tajweed || verseData?.text_uthmani || verseData?.words?.map(w => w.text_uthmani_tajweed || w.text_uthmani || w.text || '').join(' ') || "بِسْمِ ٱللَّهِ ٱلرَّحْمَـٰنِ ٱلرَّحِيمِ";

  return (
    <div className="flex flex-col items-center justify-center h-full p-8 animate-fade-in overflow-y-auto">
      <div className="w-full max-w-4xl bg-white/80 backdrop-blur-xl rounded-3xl shadow-2xl overflow-hidden border border-white/40">

        {/* Controls Header */}
        <div className="p-6 border-b border-gray-100 flex flex-wrap gap-4 items-center justify-between bg-gradient-to-r from-emerald-50 to-teal-50 shadow-sm z-10 relative">

          <div className="flex items-center gap-3">
            <select
              className="bg-white border text-sm border-emerald-200 text-emerald-800 rounded-xl px-4 py-2 font-medium shadow-sm focus:ring-2 focus:ring-emerald-500 focus:outline-none cursor-pointer"
              value={selectedChapter}
              onChange={(e) => setSelectedChapter(e.target.value)}
            >
              {chapters.length === 0 && <option value="1">Loading Surahs...</option>}
              {chapters.map(chapter => (
                <option key={chapter.id} value={chapter.id}>
                  {chapter.id}. {chapter.name_simple}
                </option>
              ))}
            </select>

            <select
              className="bg-emerald-600 border text-sm border-emerald-700 text-white rounded-xl px-4 py-2 font-bold shadow-sm hover:bg-emerald-700 focus:ring-2 focus:ring-emerald-500 focus:outline-none cursor-pointer"
              value={selectedAyah}
              onChange={(e) => {
                setSelectedAyah(e.target.value);
                setIsAutoPlayEnabled(false);
              }}
              disabled={chapters.length === 0}
            >
              {[...Array(totalAyahs)].map((_, i) => (
                <option key={i + 1} value={i + 1}>Ayah {i + 1}</option>
              ))}
            </select>
          </div>

          <div className="flex items-center gap-3">
            <span className="text-xs font-semibold text-gray-500 uppercase tracking-wider">Reciter:</span>
            <select
              className="bg-white border text-sm border-gray-200 text-gray-700 rounded-xl px-4 py-2 font-medium shadow-sm focus:ring-2 focus:ring-gray-500 focus:outline-none cursor-pointer"
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
        <div className="p-10 flex flex-col items-center space-y-8 min-h-[300px] justify-center relative">
          {isLoading ? (
            <div className="flex flex-col items-center justify-center space-y-4 w-full">
              <Loader2 className="animate-spin text-emerald-500" size={36} />
              <p className="text-emerald-600/70 font-medium">Fetching Divine Words...</p>
            </div>
          ) : (
            <>
              {/* Arabic Verse + Tajweed Legend */}
              <div className="w-full relative flex items-start justify-center gap-3">
                <h2
                  className={`text-3xl font-bold font-arabic drop-shadow-sm leading-relaxed text-center transition-all duration-700 flex-1 ${isPlaying ? 'text-emerald-700 scale-[1.03] drop-shadow-md' : isRecording ? 'text-rose-600 scale-[1.02]' : 'text-gray-900'}`}
                  dir="rtl"
                  dangerouslySetInnerHTML={{ __html: arabicText }}
                />

                {/* Tajweed Legend Button */}
                <div className="group relative flex-shrink-0 mt-2">
                  <button className="w-9 h-9 rounded-full bg-gray-100 hover:bg-emerald-100 text-gray-500 hover:text-emerald-700 flex items-center justify-center transition-all shadow-sm border border-gray-200 hover:border-emerald-300">
                    <Info size={16} />
                  </button>
                  {/* Hoverable Tajweed Legend Card */}
                  <div className="absolute right-0 top-full mt-2 w-56 bg-white/95 backdrop-blur-xl rounded-2xl shadow-2xl border border-gray-100 p-4 opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all duration-300 z-50 pointer-events-none group-hover:pointer-events-auto">
                    <p className="text-[11px] font-bold text-gray-400 uppercase tracking-widest mb-3">Tajweed Rules</p>
                    <div className="space-y-2.5">
                      <div className="flex items-center gap-2.5">
                        <span className="w-3 h-3 rounded-full bg-[#1692d0] shadow-sm shadow-blue-200"></span>
                        <span className="text-xs font-semibold text-gray-700">Madd</span>
                        <span className="text-[10px] text-gray-400 ml-auto">Elongation</span>
                      </div>
                      <div className="flex items-center gap-2.5">
                        <span className="w-3 h-3 rounded-full bg-[#d50000] shadow-sm shadow-red-200"></span>
                        <span className="text-xs font-semibold text-gray-700">Ikhfa</span>
                        <span className="text-[10px] text-gray-400 ml-auto">Concealment</span>
                      </div>
                      <div className="flex items-center gap-2.5">
                        <span className="w-3 h-3 rounded-full bg-[#f57f17] shadow-sm shadow-amber-200"></span>
                        <span className="text-xs font-semibold text-gray-700">Ghunnah</span>
                        <span className="text-[10px] text-gray-400 ml-auto">Nasalization</span>
                      </div>
                      <div className="flex items-center gap-2.5">
                        <span className="w-3 h-3 rounded-full bg-[#9c27b0] shadow-sm shadow-purple-200"></span>
                        <span className="text-xs font-semibold text-gray-700">Idgham</span>
                        <span className="text-[10px] text-gray-400 ml-auto">Assimilation</span>
                      </div>
                      <div className="flex items-center gap-2.5">
                        <span className="w-3 h-3 rounded-full bg-[#00c853] shadow-sm shadow-green-200"></span>
                        <span className="text-xs font-semibold text-gray-700">Iqlab</span>
                        <span className="text-[10px] text-gray-400 ml-auto">Conversion</span>
                      </div>
                      <div className="flex items-center gap-2.5">
                        <span className="w-3 h-3 rounded-full bg-[#00bcd4] shadow-sm shadow-cyan-200"></span>
                        <span className="text-xs font-semibold text-gray-700">Qalqalah</span>
                        <span className="text-[10px] text-gray-400 ml-auto">Echo</span>
                      </div>
                      <div className="flex items-center gap-2.5">
                        <span className="w-3 h-3 rounded-full bg-[#aaaaaa] shadow-sm shadow-gray-200"></span>
                        <span className="text-xs font-semibold text-gray-700">Silent</span>
                        <span className="text-[10px] text-gray-400 ml-auto">Not Pronounced</span>
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              <p
                className={`text-center max-w-2xl text-lg font-medium leading-relaxed italic border-t pt-8 transition-colors duration-500 ${isPlaying ? 'text-emerald-800/80 border-emerald-100' : 'text-gray-600 border-gray-100'}`}
                dangerouslySetInnerHTML={{ __html: `"${translationText}"` }}
              />

              {/* Action Buttons */}
              <div className="w-full flex justify-center gap-6 mt-8">
                <button
                  onClick={togglePlay}
                  disabled={isRecording}
                  className={`flex flex-col items-center justify-center min-w-[200px] px-8 py-4 rounded-2xl transition-all shadow-md border ${isPlaying ? 'bg-amber-100 text-amber-800 border-amber-300 transform scale-95' : 'bg-emerald-50 text-emerald-700 hover:bg-emerald-100 border-emerald-200 hover:shadow-lg'} ${isRecording ? 'opacity-40 cursor-not-allowed' : ''}`}
                >
                  <BookOpen className={`mb-2 ${isPlaying ? 'animate-pulse text-amber-600' : ''}`} size={28} />
                  <span className="font-bold text-lg">{isPlaying ? 'Pause' : (isAutoPlayEnabled ? 'Resuming...' : 'Play Reference')}</span>
                </button>

                {/* Record Button */}
                {!isRecording && !recordedBlob && (
                  <button
                    onClick={startRecording}
                    disabled={isPlaying}
                    className={`flex flex-col items-center justify-center min-w-[200px] px-10 py-5 bg-gradient-to-b from-red-500 to-rose-600 text-white rounded-2xl hover:from-red-600 hover:to-rose-700 shadow-xl shadow-rose-200 transform hover:-translate-y-1 transition-all ${isPlaying ? 'opacity-40 cursor-not-allowed' : ''}`}
                  >
                    <Mic className="mb-2" size={32} />
                    <span className="font-bold tracking-wide text-lg">Record Practice</span>
                  </button>
                )}

                {/* Recording In Progress */}
                {isRecording && (
                  <button
                    onClick={stopRecording}
                    className="flex flex-col items-center justify-center min-w-[200px] px-10 py-5 bg-gradient-to-b from-rose-600 to-red-700 text-white rounded-2xl shadow-xl shadow-red-300 animate-pulse transition-all"
                  >
                    <div className="flex items-center gap-2 mb-2">
                      <span className="w-3 h-3 rounded-full bg-white animate-ping"></span>
                      <span className="text-2xl font-mono font-bold">{formatTime(recordingTime)}</span>
                    </div>
                    <span className="font-bold tracking-wide text-lg">Stop Recording</span>
                  </button>
                )}

                {/* Recorded — Playback + Analyze Controls */}
                {!isRecording && recordedBlob && (
                  <div className="flex flex-col items-center gap-4">
                    <div className="flex gap-3 flex-wrap justify-center">
                      <button
                        onClick={isPlayingRecording ? pauseRecording : playRecording}
                        className="flex items-center justify-center gap-2 px-5 py-3 bg-blue-50 text-blue-700 border border-blue-200 rounded-2xl hover:bg-blue-100 shadow-sm transition-all font-semibold text-sm"
                      >
                        <Mic size={16} />
                        {isPlayingRecording ? 'Pause My Audio' : 'Play My Recording'}
                      </button>
                      <button
                        onClick={analyzeRecording}
                        disabled={isAnalyzing}
                        className="flex items-center justify-center gap-2 px-5 py-3 bg-gradient-to-r from-violet-500 to-purple-600 text-white rounded-2xl hover:from-violet-600 hover:to-purple-700 shadow-lg shadow-purple-200 transition-all font-semibold text-sm disabled:opacity-60"
                      >
                        {isAnalyzing ? <Loader2 size={16} className="animate-spin" /> : <BarChart3 size={16} />}
                        {isAnalyzing ? 'Analyzing...' : 'Analyze Recitation'}
                      </button>
                      <button
                        onClick={() => { setRecordedBlob(null); setRecordedUrl(null); setAnalysisResult(null); }}
                        className="flex items-center justify-center gap-2 px-5 py-3 bg-rose-50 text-rose-700 border border-rose-200 rounded-2xl hover:bg-rose-100 shadow-sm transition-all font-semibold text-sm"
                      >
                        <RotateCcw size={16} />
                        Re-record
                      </button>
                    </div>
                    {!analysisResult && !isAnalyzing && (
                      <span className="text-xs text-emerald-600 font-semibold bg-emerald-50 px-3 py-1 rounded-full">✓ Practice recorded! Click Analyze to get feedback.</span>
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

              {/* Analysis Results Card */}
              {analysisResult && (
                <div className="w-full max-w-2xl mt-4 animate-fade-in">
                  <div className={`p-6 rounded-2xl border-2 shadow-lg ${
                    analysisResult.decision?.color === 'green' ? 'bg-emerald-50 border-emerald-300' :
                    analysisResult.decision?.color === 'blue' ? 'bg-blue-50 border-blue-300' :
                    analysisResult.decision?.color === 'amber' ? 'bg-amber-50 border-amber-300' :
                    'bg-red-50 border-red-300'
                  }`}>
                    {/* Score Header */}
                    <div className="flex items-center justify-between mb-4">
                      <div>
                        <p className="text-xs font-bold text-gray-400 uppercase tracking-widest">Accuracy Score</p>
                        <p className={`text-5xl font-black ${
                          analysisResult.accuracy >= 80 ? 'text-emerald-600' :
                          analysisResult.accuracy >= 60 ? 'text-blue-600' :
                          analysisResult.accuracy >= 40 ? 'text-amber-600' : 'text-red-600'
                        }`}>{analysisResult.accuracy}%</p>
                      </div>
                      <div className={`px-4 py-2 rounded-xl text-sm font-bold ${
                        analysisResult.decision?.color === 'green' ? 'bg-emerald-200 text-emerald-800' :
                        analysisResult.decision?.color === 'blue' ? 'bg-blue-200 text-blue-800' :
                        analysisResult.decision?.color === 'amber' ? 'bg-amber-200 text-amber-800' :
                        'bg-red-200 text-red-800'
                      }`}>
                        {analysisResult.decision?.message}
                      </div>
                    </div>

                    {/* What Whisper Heard */}
                    <div className="mb-4 p-3 bg-white/60 rounded-xl">
                      <p className="text-[11px] font-bold text-gray-400 uppercase tracking-widest mb-1">What we heard</p>
                      <p className="text-gray-700 font-medium text-sm" dir="rtl">{analysisResult.raw_text || '(no speech detected)'}</p>
                    </div>

                    {/* Word Breakdown */}
                    <div className="grid grid-cols-3 gap-3 text-center">
                      <div className="p-3 bg-white/60 rounded-xl">
                        <p className="text-2xl font-black text-emerald-600">{analysisResult.matched_words?.length || 0}</p>
                        <p className="text-[10px] font-semibold text-gray-500 uppercase">Correct</p>
                      </div>
                      <div className="p-3 bg-white/60 rounded-xl">
                        <p className="text-2xl font-black text-amber-600">{analysisResult.partial_matches?.length || 0}</p>
                        <p className="text-[10px] font-semibold text-gray-500 uppercase">Partial</p>
                      </div>
                      <div className="p-3 bg-white/60 rounded-xl">
                        <p className="text-2xl font-black text-red-600">{analysisResult.incorrect_words?.length || 0}</p>
                        <p className="text-[10px] font-semibold text-gray-500 uppercase">Incorrect</p>
                      </div>
                    </div>

                    {/* Incorrect Word Details */}
                    {analysisResult.incorrect_words?.length > 0 && (
                      <div className="mt-4 p-3 bg-white/60 rounded-xl">
                        <p className="text-[11px] font-bold text-gray-400 uppercase tracking-widest mb-2">Words to improve</p>
                        <div className="flex flex-wrap gap-2">
                          {analysisResult.incorrect_words.map((w, i) => (
                            <span key={i} className="px-3 py-1 bg-red-100 text-red-700 rounded-lg text-sm font-semibold" dir="rtl">
                              {w.expected}
                            </span>
                          ))}
                        </div>
                      </div>
                    )}
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
    </div>
  );
}

// ── Practice Tracking Utility ──
function trackPractice(chapterId, ayahNumber) {
  const today = new Date().toISOString().slice(0, 10); // YYYY-MM-DD
  const key = `${chapterId}:${ayahNumber}`;

  // Track unique ayahs
  const ayahs = JSON.parse(localStorage.getItem('practiced_ayahs') || '[]');
  if (!ayahs.includes(key)) {
    ayahs.push(key);
    localStorage.setItem('practiced_ayahs', JSON.stringify(ayahs));
  }

  // Track sessions per day
  const sessions = JSON.parse(localStorage.getItem('practice_sessions') || '{}');
  sessions[today] = (sessions[today] || 0) + 1;
  localStorage.setItem('practice_sessions', JSON.stringify(sessions));

  // Track practice dates for streak
  const dates = JSON.parse(localStorage.getItem('practice_dates') || '[]');
  if (!dates.includes(today)) {
    dates.push(today);
    dates.sort();
    localStorage.setItem('practice_dates', JSON.stringify(dates));
  }
}

function getStreak() {
  const dates = JSON.parse(localStorage.getItem('practice_dates') || '[]');
  if (dates.length === 0) return 0;

  let streak = 0;
  const today = new Date();
  const check = new Date(today);

  // Check if today or yesterday was practiced (allow current day gap)
  const todayStr = today.toISOString().slice(0, 10);
  const yesterdayStr = new Date(today - 86400000).toISOString().slice(0, 10);

  if (!dates.includes(todayStr) && !dates.includes(yesterdayStr)) return 0;

  for (let i = 0; i < 365; i++) {
    const dateStr = check.toISOString().slice(0, 10);
    if (dates.includes(dateStr)) {
      streak++;
    } else if (i > 0) {
      break; // Streak broken
    }
    check.setDate(check.getDate() - 1);
  }
  return streak;
}

function DashboardPage() {
  const [stats, setStats] = useState({ streak: 0, totalAyahs: 0, totalSessions: 0 });

  useEffect(() => {
    const ayahs = JSON.parse(localStorage.getItem('practiced_ayahs') || '[]');
    const sessions = JSON.parse(localStorage.getItem('practice_sessions') || '{}');
    const totalSessions = Object.values(sessions).reduce((a, b) => a + b, 0);
    const streak = getStreak();

    setStats({ streak, totalAyahs: ayahs.length, totalSessions });
  }, []);

  return (
    <div className="p-8 h-full">
      <h1 className="text-3xl font-bold text-gray-900 mb-2 font-sans">Your Progress</h1>
      <p className="text-gray-400 text-sm mb-8">Stats update automatically as you practice.</p>
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="p-8 bg-white rounded-2xl shadow-sm border border-gray-100 flex flex-col justify-center items-center hover:shadow-md transition-shadow">
          <span className="text-xs font-semibold text-gray-400 uppercase tracking-widest mb-3">Current Streak</span>
          <span className="text-6xl font-black text-emerald-500 drop-shadow-sm">{stats.streak}</span>
          <span className="text-sm text-gray-500 mt-1">{stats.streak === 1 ? 'Day' : 'Days'}</span>
        </div>
        <div className="p-8 bg-white rounded-2xl shadow-sm border border-gray-100 flex flex-col justify-center items-center hover:shadow-md transition-shadow">
          <span className="text-xs font-semibold text-gray-400 uppercase tracking-widest mb-3">Total Sessions</span>
          <span className="text-6xl font-black text-blue-500 drop-shadow-sm">{stats.totalSessions}</span>
          <span className="text-sm text-gray-500 mt-1">Listens</span>
        </div>
        <div className="p-8 bg-white rounded-2xl shadow-sm border border-gray-100 flex flex-col justify-center items-center hover:shadow-md transition-shadow">
          <span className="text-xs font-semibold text-gray-400 uppercase tracking-widest mb-3">Unique Ayahs</span>
          <span className="text-6xl font-black text-purple-500 drop-shadow-sm">{stats.totalAyahs}</span>
          <span className="text-sm text-gray-500 mt-1">Practiced</span>
        </div>
      </div>
      {stats.totalSessions === 0 && (
        <div className="mt-10 text-center p-8 bg-emerald-50 rounded-2xl border border-emerald-100">
          <p className="text-emerald-700 font-semibold text-lg mb-1">No practice sessions yet!</p>
          <p className="text-emerald-600/70 text-sm">Go to the Practice tab, select an Ayah, and press Play to start tracking your journey.</p>
        </div>
      )}
    </div>
  );
}

// JWT Parser utility
function parseJwt(token) {
  try {
    const base64Url = token.split('.')[1];
    const base64 = base64Url.replace(/-/g, '+').replace(/_/g, '/');
    const jsonPayload = decodeURIComponent(atob(base64).split('').map(function (c) {
      return '%' + ('00' + c.charCodeAt(0).toString(16)).slice(-2);
    }).join(''));
    return JSON.parse(jsonPayload);
  } catch (e) {
    return null;
  }
}

export default function App() {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [userProfile, setUserProfile] = useState(null);
  const [activeTab, setActiveTab] = useState('practice');
  const [isProcessingCode, setIsProcessingCode] = useState(false);
  const [loginError, setLoginError] = useState('');
  const processedCode = React.useRef(false);

  useEffect(() => {
    const token = localStorage.getItem('user_access_token');
    const idToken = localStorage.getItem('user_id_token');
    const isMock = localStorage.getItem('is_mock_login');

    if (token) {
      setIsAuthenticated(true);
      if (idToken) {
        const decoded = parseJwt(idToken) || parseJwt(token);
        if (decoded) setUserProfile(decoded);
      } else {
        // Fallback if no ID token is present, try decoding access token
        const decoded = parseJwt(token);
        if (decoded) setUserProfile(decoded);
      }
    } else if (isMock) {
      setIsAuthenticated(true);
      setUserProfile({ name: "Guest Reciter", email: "guest@qari.ai" });
    }

    const url = new URL(window.location.href);
    if (url.pathname === '/callback' && url.searchParams.has('code')) {
      if (!processedCode.current) {
        processedCode.current = true;
        exchangeCodeForToken(url.searchParams.get('code'));
      }
    } else if (url.pathname === '/callback' && url.searchParams.has('error')) {
      setLoginError(`OAuth Error: ${url.searchParams.get('error_description') || url.searchParams.get('error')}`);
      window.history.replaceState({}, document.title, "/");
    }
  }, []);

  const exchangeCodeForToken = async (code) => {
    setIsProcessingCode(true);
    try {
      const res = await fetch('http://localhost:5000/api/auth/callback', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ code, redirect_uri: REDIRECT_URI })
      });
      const data = await res.json();
      if (data.access_token) {
        localStorage.setItem('user_access_token', data.access_token);
        if (data.id_token) localStorage.setItem('user_id_token', data.id_token);

        setIsAuthenticated(true);
        const decoded = parseJwt(data.id_token || data.access_token);
        if (decoded) setUserProfile(decoded);

        window.history.replaceState({}, document.title, "/"); // Clean up URL
      } else {
        const errorMessage = data.details
          ? JSON.stringify(data.details)
          : (data.error || 'Unknown Error');
        setLoginError("Exchange failed: " + errorMessage);
        window.history.replaceState({}, document.title, "/");
      }
    } catch (err) {
      console.error(err);
      setLoginError("Failed to communicate with backend server during code exchange.");
      window.history.replaceState({}, document.title, "/");
    } finally {
      setIsProcessingCode(false);
    }
  };

  const handleMockLogin = () => {
    localStorage.setItem('is_mock_login', 'true');
    setIsAuthenticated(true);
    setUserProfile({ name: "Guest Reciter", email: "guest@qari.ai" });
  };

  const handleLogout = () => {
    localStorage.clear();
    setIsAuthenticated(false);
    setUserProfile(null);
  };

  if (isProcessingCode) {
    return (
      <div className="min-h-screen bg-slate-50 flex flex-col items-center justify-center">
        <Loader2 className="animate-spin text-emerald-500 mb-4" size={48} />
        <p className="text-gray-500">Exchanging secure authorization code...</p>
      </div>
    );
  }

  if (!isAuthenticated) {
    return (
      <>
        {loginError && (
          <div className="absolute top-4 left-1/2 transform -translate-x-1/2 w-full max-w-md p-4 bg-red-100 text-red-700 rounded-xl shadow-lg flex items-center z-50">
            <AlertCircle className="mr-3 flex-shrink-0" />
            <span className="font-medium text-sm">{loginError}</span>
            <button onClick={() => setLoginError('')} className="ml-auto text-red-500 hover:text-red-800">×</button>
          </div>
        )}
        <LoginPage onFallback={handleMockLogin} />
      </>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50 flex">
      {/* Slim Sidebar */}
      <aside className="w-24 bg-white/60 backdrop-blur-3xl border-r border-gray-200 flex flex-col items-center py-8 gap-8 shadow-[4px_0_24px_-12px_rgba(0,0,0,0.1)] z-10 transition-all">
        <div className="w-12 h-12 bg-gradient-to-br from-emerald-400 to-teal-500 rounded-2xl flex items-center justify-center shadow-lg shadow-emerald-200">
          <BookOpen className="text-white" size={24} />
        </div>
        <nav className="flex flex-col gap-4 mt-8 flex-1">
          <button
            onClick={() => setActiveTab('practice')}
            className={`p-4 rounded-2xl transition-all ${activeTab === 'practice' ? 'bg-emerald-100 text-emerald-600 shadow-inner' : 'text-gray-400 hover:bg-gray-100 hover:text-gray-600'}`}
            title="Practice"
          >
            <Mic size={24} />
          </button>
          <button
            onClick={() => setActiveTab('dashboard')}
            className={`p-4 rounded-2xl transition-all ${activeTab === 'dashboard' ? 'bg-emerald-100 text-emerald-600 shadow-inner' : 'text-gray-400 hover:bg-gray-100 hover:text-gray-600'}`}
            title="Dashboard"
          >
            <LayoutDashboard size={24} />
          </button>
        </nav>
        <button
          onClick={handleLogout}
          className="p-4 rounded-2xl text-gray-400 hover:bg-red-50 hover:text-red-500 transition-all mb-4"
          title="Logout"
        >
          <LogIn className="rotate-180" size={24} />
        </button>
      </aside>

      <main className="flex-1 bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-teal-50 via-slate-50 to-white overflow-y-auto relative flex flex-col">
        {/* Top Navigation Bar for Profile */}
        <header className="w-full h-20 px-8 flex items-center justify-end">
          <div className="flex items-center gap-4 bg-white/50 backdrop-blur-md px-4 py-2 rounded-full shadow-sm border border-white">
            <div className="flex flex-col items-end">
              <span className="text-sm font-semibold text-gray-800 leading-tight">
                {userProfile?.name || "Student"}
              </span>
              <span className="text-xs text-gray-500 leading-tight">
                {userProfile?.email || "qari@learning"}
              </span>
            </div>
            <div className="w-10 h-10 bg-gradient-to-tr from-emerald-500 to-teal-400 rounded-full flex items-center justify-center shadow-inner border-2 border-white text-white font-bold">
              {(userProfile?.name || "S").charAt(0).toUpperCase()}
            </div>
          </div>
        </header>

        {/* Main Content Area */}
        <div className="flex-1">
          {activeTab === 'practice' ? <PracticePage /> : <DashboardPage />}
        </div>
      </main>
    </div>
  );
}
