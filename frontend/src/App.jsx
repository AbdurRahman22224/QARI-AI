import React, { useState, useEffect } from 'react';
import { BookOpen, LayoutDashboard, Mic, Power, ChevronRight, AlertCircle, Loader2, FlaskConical } from 'lucide-react';
import LoginPage from './components/Auth/LoginPage';
import PracticePage from './components/Practice/PracticePage';
import WordLabPage from './components/WordLab/WordLabPage';
import DashboardPage from './components/Dashboard/DashboardPage';

import { API, CALLBACK_URI } from './config/api';
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
  const [activeTab, setActiveTab] = useState(() => {
    const path = window.location.pathname.replace('/', '');
    return ['practice', 'wordlab', 'dashboard'].includes(path) ? path : 'practice';
  });
  const [isProcessingCode, setIsProcessingCode] = useState(false);
  const [loginError, setLoginError] = useState('');
  const [isSidebarExpanded, setIsSidebarExpanded] = useState(false);
  const isPracticeTab = ['practice', 'wordlab', 'dashboard'].includes(activeTab);

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

    // Sync browser Back/Forward navigation with state
    const handlePopState = () => {
      const path = window.location.pathname.replace('/', '');
      if (['practice', 'wordlab', 'dashboard'].includes(path)) {
        setActiveTab(path);
      } else if (path === '') {
        setActiveTab('practice');
      }
    };
    window.addEventListener('popstate', handlePopState);
    return () => window.removeEventListener('popstate', handlePopState);
  }, []);

  const handleTabChange = (tab) => {
    setActiveTab(tab);
    if (window.location.pathname !== `/${tab}`) {
      window.history.pushState(null, '', `/${tab}`);
    }
  };

  const exchangeCodeForToken = async (code) => {
    setIsProcessingCode(true);
    try {
      const res = await fetch(API.AUTH_CALLBACK, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ code, redirect_uri: CALLBACK_URI })
      });
      const data = await res.json();
      if (data.access_token) {
        localStorage.setItem('user_access_token', data.access_token);
        if (data.id_token) localStorage.setItem('user_id_token', data.id_token);

        setIsAuthenticated(true);
        const decoded = parseJwt(data.id_token || data.access_token);
        if (decoded) setUserProfile(decoded);

        // Upsert user in DB (fire-and-forget)
        if (decoded?.sub) {
          const displayName = decoded.name || decoded.preferred_username || decoded.nickname || decoded.given_name || (decoded.email ? decoded.email.split('@')[0] : 'Student');
          fetch(API.AUTH_UPSERT, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${data.access_token}` },
            body: JSON.stringify({ qf_user_id: decoded.sub, name: displayName, email: decoded.email })
          }).catch(() => { });
        }

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
      window.history.replaceState({}, document.title, "/");
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
        className={`${isSidebarExpanded ? (isPracticeTab ? 'w-52' : 'w-64') : (isPracticeTab ? 'w-16' : 'w-20')} bg-white/70 backdrop-blur-3xl border-r border-gray-100 flex flex-col items-center ${isPracticeTab ? 'py-6' : 'py-8'} z-20 shadow-[8px_0_32px_-12px_rgba(0,0,0,0.08)] transition-all duration-500 ease-in-out relative group h-screen sticky top-0`}
        onMouseEnter={() => setIsSidebarExpanded(true)}
        onMouseLeave={() => setIsSidebarExpanded(false)}
      >
        {/* Toggle Indicator */}
        <div className={`absolute ${isPracticeTab ? '-right-3.5 top-10 w-7 h-7' : '-right-4 top-12 w-8 h-8'} bg-white border border-gray-100 rounded-full flex items-center justify-center shadow-sm cursor-pointer hover:bg-gray-100 transition-all z-30`} onClick={() => setIsSidebarExpanded(!isSidebarExpanded)}>
          <ChevronRight className={`text-emerald-500 transition-transform duration-500 ${isSidebarExpanded ? 'rotate-180' : ''}`} size={isPracticeTab ? 14 : 16} />
        </div>

        {/* Logo Section */}
        <div className={`flex items-center ${isPracticeTab ? 'gap-3 mb-5' : 'gap-4 mb-6'} w-full ${isSidebarExpanded ? (isPracticeTab ? 'px-4 justify-start' : 'px-6 justify-start') : 'justify-center'}`}>
          <div className={`${isPracticeTab ? 'w-10 h-10 rounded-xl' : 'w-12 h-12 rounded-2xl'} bg-gradient-to-br from-emerald-400 to-teal-500 flex items-center justify-center shadow-lg shadow-emerald-100 flex-shrink-0`}>
            <BookOpen className="text-white" size={isPracticeTab ? '1.15rem' : '1.4rem'} />
          </div>
          {isSidebarExpanded && (
            <span className={`${isPracticeTab ? 'text-xs' : 'text-sm'} font-bold text-gray-650 animate-fade-in whitespace-nowrap`}>
              Qari AI
            </span>
          )}
        </div>

        {/* Navigation Items */}
        <nav className={`flex flex-col ${isPracticeTab ? 'gap-2.5 px-2.5' : 'gap-3 px-3'} w-full flex-1 overflow-hidden`}>
          <button
            onClick={() => handleTabChange('practice')}
            className={`flex items-center ${isPracticeTab ? 'gap-3 py-2.5' : 'gap-4 py-3.5'} ${isSidebarExpanded ? (isPracticeTab ? 'px-3 justify-start' : 'px-4 justify-start') : 'justify-center'} ${isPracticeTab ? 'rounded-xl' : 'rounded-2xl'} transition-all duration-150 hover:translate-x-1 w-full group relative ${activeTab === 'practice' ? 'bg-emerald-100 text-emerald-700 shadow-sm scale-[1.02]' : 'text-gray-600 hover:bg-gray-100 hover:text-gray-900'}`}
          >
            <Mic className={`flex-shrink-0 transition-transform ${activeTab === 'practice' ? 'scale-110 text-emerald-700' : 'group-hover:scale-110'}`} size={isPracticeTab ? '1.1rem' : '1.4rem'} />
            {isSidebarExpanded && <span className={`${isPracticeTab ? 'text-xs' : 'text-sm'} font-bold tracking-wide animate-fade-in whitespace-nowrap`}>Practice</span>}
            {!isSidebarExpanded && (
              <span className="absolute left-full ml-4 px-2 py-1 bg-gray-900 text-white text-[10px] rounded-md opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none whitespace-nowrap z-50">
                Practice
              </span>
            )}
          </button>

          <button
            onClick={() => handleTabChange('wordlab')}
            className={`flex items-center ${isPracticeTab ? 'gap-3 py-2.5' : 'gap-4 py-3.5'} ${isSidebarExpanded ? (isPracticeTab ? 'px-3 justify-start' : 'px-4 justify-start') : 'justify-center'} ${isPracticeTab ? 'rounded-xl' : 'rounded-2xl'} transition-all duration-150 hover:translate-x-1 w-full group relative ${activeTab === 'wordlab' ? 'bg-emerald-100 text-emerald-700 shadow-sm scale-[1.02]' : 'text-gray-600 hover:bg-gray-100 hover:text-gray-900'}`}
          >
            <FlaskConical className={`flex-shrink-0 transition-transform ${activeTab === 'wordlab' ? 'scale-110 text-emerald-700' : 'group-hover:scale-110'}`} size={isPracticeTab ? '1.1rem' : '1.4rem'} />
            {isSidebarExpanded && <span className={`${isPracticeTab ? 'text-xs' : 'text-sm'} font-bold tracking-wide animate-fade-in whitespace-nowrap`}>Word Lab</span>}
            {!isSidebarExpanded && (
              <span className="absolute left-full ml-4 px-2 py-1 bg-gray-900 text-white text-[10px] rounded-md opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none whitespace-nowrap z-50">
                Word Lab
              </span>
            )}
          </button>

          <button
            onClick={() => handleTabChange('dashboard')}
            className={`flex items-center ${isPracticeTab ? 'gap-3 py-2.5' : 'gap-4 py-3.5'} ${isSidebarExpanded ? (isPracticeTab ? 'px-3 justify-start' : 'px-4 justify-start') : 'justify-center'} ${isPracticeTab ? 'rounded-xl' : 'rounded-2xl'} transition-all duration-150 hover:translate-x-1 w-full group relative ${activeTab === 'dashboard' ? 'bg-emerald-100 text-emerald-700 shadow-sm scale-[1.02]' : 'text-gray-600 hover:bg-gray-100 hover:text-gray-900'}`}
          >
            <LayoutDashboard className={`flex-shrink-0 transition-transform ${activeTab === 'dashboard' ? 'scale-110 text-emerald-700' : 'group-hover:scale-110'}`} size={isPracticeTab ? '1.1rem' : '1.4rem'} />
            {isSidebarExpanded && <span className={`${isPracticeTab ? 'text-xs' : 'text-sm'} font-bold tracking-wide animate-fade-in whitespace-nowrap`}>Dashboard</span>}
            {!isSidebarExpanded && (
              <span className="absolute left-full ml-4 px-2 py-1 bg-gray-900 text-white text-[10px] rounded-md opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none whitespace-nowrap z-50">
                Dashboard
              </span>
            )}
          </button>
        </nav>

        {/* Fixed Logout Button at Bottom */}
        <div className={`w-full ${isPracticeTab ? 'px-2.5 pt-3' : 'px-3 pt-4'} mt-auto border-t border-gray-200`}>
          <button
            onClick={handleLogout}
            className={`flex items-center ${isPracticeTab ? 'gap-3 py-2.5' : 'gap-4 py-3.5'} ${isSidebarExpanded ? (isPracticeTab ? 'px-3 justify-start' : 'px-4 justify-start') : 'justify-center'} ${isPracticeTab ? 'rounded-xl' : 'rounded-2xl'} text-gray-500 hover:bg-red-50 hover:text-red-500 hover:translate-x-1 transition-all duration-150 w-full group relative`}
          >
            <Power className="flex-shrink-0 transition-transform group-hover:scale-110" size={isPracticeTab ? '1.1rem' : '1.4rem'} />
            {isSidebarExpanded && <span className={`${isPracticeTab ? 'text-xs' : 'text-sm'} font-bold tracking-wide animate-fade-in whitespace-nowrap`}>Sign Out</span>}
            {!isSidebarExpanded && (
              <span className="absolute left-full ml-4 px-2 py-1 bg-gray-900 text-white text-[10px] rounded-md opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none whitespace-nowrap z-50">
                Sign Out
              </span>
            )}
          </button>
        </div>
      </aside>

      <main className="flex-1 bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-teal-50/30 via-slate-50 to-white overflow-y-auto relative flex flex-col transition-all duration-300">
        {/* Top Navigation Bar for Profile */}
        <header className={`w-full ${isPracticeTab ? 'h-16 px-5' : 'h-20 px-8'} flex items-center justify-end z-10`}>
          <div className={`flex items-center ${isPracticeTab ? 'gap-3 px-3 py-1.5' : 'gap-4 px-4 py-2'} bg-white/70 backdrop-blur-md rounded-full shadow-sm border border-white/40 hover:shadow-md transition-shadow cursor-default group`}>
            <div className="flex flex-col items-end">
              <span className={`${isPracticeTab ? 'text-xs' : 'text-sm'} font-bold text-gray-800 leading-tight group-hover:text-emerald-600 transition-colors`}>
                {userProfile?.name || userProfile?.preferred_username || userProfile?.nickname || userProfile?.given_name || (userProfile?.email ? userProfile.email.split('@')[0] : "Student")}
              </span>
              <span className={`${isPracticeTab ? 'text-[9px]' : 'text-[10px]'} font-bold text-gray-400 grayscale group-hover:grayscale-0 transition-all`}>
                {userProfile?.email || "qari.ai"}
              </span>
            </div>
            <div className={`${isPracticeTab ? 'w-8 h-8 text-sm' : 'w-10 h-10 text-lg'} bg-gradient-to-tr from-emerald-500 to-teal-400 rounded-full flex items-center justify-center shadow-inner border-2 border-white text-white font-black`}>
              {(userProfile?.name || userProfile?.preferred_username || userProfile?.nickname || userProfile?.given_name || userProfile?.email || "S").charAt(0).toUpperCase()}
            </div>
          </div>
        </header>

        {/* Main Content Area */}
        <div className={`flex-1 ${isPracticeTab ? 'p-1.5' : 'p-2'}`}>
          {activeTab === 'practice' ? <PracticePage /> : activeTab === 'wordlab' ? <WordLabPage /> : <DashboardPage userProfile={userProfile} />}
        </div>
      </main>
    </div>
  );
}
