import React, { useState, useEffect } from 'react';
import { BookOpen, LayoutDashboard, Mic, Power, ChevronRight, AlertCircle, Loader2 } from 'lucide-react';
import LoginPage from './components/Auth/LoginPage';
import PracticePage from './components/Practice/PracticePage';

const REDIRECT_URI = 'http://localhost:3000/callback'; // Configured callback URL


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
  const [isSidebarExpanded, setIsSidebarExpanded] = useState(false);
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
    if (window.confirm("Are you sure you want to logout? Any unsaved progress may be lost.")) {
      localStorage.clear();
      setIsAuthenticated(false);
      setUserProfile(null);
    }
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
    <div className="min-h-screen bg-slate-50 flex transition-all duration-300">
      {/* Expandable Sidebar */}
      <aside
        className={`${isSidebarExpanded ? 'w-64' : 'w-20'} bg-white/70 backdrop-blur-3xl border-r border-gray-100 flex flex-col items-center py-8 z-20 shadow-[8px_0_32px_-12px_rgba(0,0,0,0.08)] transition-all duration-500 ease-in-out relative group h-screen sticky top-0`}
        onMouseEnter={() => setIsSidebarExpanded(true)}
        onMouseLeave={() => setIsSidebarExpanded(false)}
      >
        {/* Toggle Indicator */}
        <div className="absolute -right-3 top-12 w-6 h-6 bg-white border border-gray-100 rounded-full flex items-center justify-center shadow-sm cursor-pointer hover:bg-emerald-50 transition-colors z-30">
          <ChevronRight className={`text-emerald-500 transition-transform duration-500 ${isSidebarExpanded ? 'rotate-180' : ''}`} size={14} />
        </div>

        {/* Logo Section */}
        <div className="flex items-center gap-3 mb-10">
          <div className="w-12 h-12 bg-gradient-to-br from-emerald-400 to-teal-500 rounded-2xl flex items-center justify-center shadow-lg shadow-emerald-100 flex-shrink-0">
            <BookOpen className="text-white" size={24} />
          </div>
          {isSidebarExpanded && (
            <span className="font-black text-xl bg-gradient-to-r from-emerald-600 to-teal-600 bg-clip-text text-transparent animate-fade-in whitespace-nowrap">
              Qari AI
            </span>
          )}
        </div>

        {/* Navigation Items */}
        <nav className="flex flex-col gap-3 w-full px-3 flex-1 overflow-hidden">
          <button
            onClick={() => setActiveTab('practice')}
            className={`flex items-center gap-4 p-4 rounded-2xl transition-all w-full group/btn ${activeTab === 'practice' ? 'bg-emerald-600 text-white shadow-lg shadow-emerald-100' : 'text-gray-400 hover:bg-emerald-50 hover:text-emerald-600'}`}
          >
            <Mic className={`flex-shrink-0 transition-transform ${activeTab === 'practice' ? 'scale-110' : 'group-hover/btn:scale-110'}`} size={24} />
            {isSidebarExpanded && <span className="font-bold text-sm tracking-wide animate-fade-in whitespace-nowrap">Practice</span>}
          </button>

          <button
            onClick={() => setActiveTab('dashboard')}
            className={`flex items-center gap-4 p-4 rounded-2xl transition-all w-full group/btn ${activeTab === 'dashboard' ? 'bg-emerald-600 text-white shadow-lg shadow-emerald-100' : 'text-gray-400 hover:bg-emerald-50 hover:text-emerald-600'}`}
          >
            <LayoutDashboard className={`flex-shrink-0 transition-transform ${activeTab === 'dashboard' ? 'scale-110' : 'group-hover/btn:scale-110'}`} size={24} />
            {isSidebarExpanded && <span className="font-bold text-sm tracking-wide animate-fade-in whitespace-nowrap">Dashboard</span>}
          </button>
        </nav>

        {/* Fixed Logout Button at Bottom */}
        <div className="w-full px-3 mt-auto pt-4 border-t border-gray-50">
          <button
            onClick={handleLogout}
            className="flex items-center gap-4 p-4 rounded-2xl text-gray-400 hover:bg-red-50 hover:text-red-500 transition-all w-full group/logout"
          >
            <Power className="flex-shrink-0 rotate-0 group-hover/logout:scale-110 transition-transform" size={24} />
            {isSidebarExpanded && <span className="font-bold text-sm tracking-wide animate-fade-in whitespace-nowrap">Sign Out</span>}
          </button>
        </div>
      </aside>

      <main className="flex-1 bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-teal-50/30 via-slate-50 to-white overflow-y-auto relative flex flex-col transition-all duration-300">
        {/* Top Navigation Bar for Profile */}
        <header className="w-full h-20 px-8 flex items-center justify-end z-10">
          <div className="flex items-center gap-4 bg-white/70 backdrop-blur-md px-4 py-2 rounded-full shadow-sm border border-white/40 hover:shadow-md transition-shadow cursor-default group">
            <div className="flex flex-col items-end">
              <span className="text-sm font-bold text-gray-800 leading-tight group-hover:text-emerald-600 transition-colors">
                {userProfile?.name || "Student"}
              </span>
              <span className="text-[10px] font-bold text-gray-400 grayscale group-hover:grayscale-0 transition-all">
                {userProfile?.email || "qari@learning"}
              </span>
            </div>
            <div className="w-10 h-10 bg-gradient-to-tr from-emerald-500 to-teal-400 rounded-full flex items-center justify-center shadow-inner border-2 border-white text-white font-black text-lg">
              {(userProfile?.name || "S").charAt(0).toUpperCase()}
            </div>
          </div>
        </header>

        {/* Main Content Area */}
        <div className="flex-1 p-2">
          {activeTab === 'practice' ? <PracticePage /> : <DashboardPage />}
        </div>
      </main>
    </div>
  );
}
