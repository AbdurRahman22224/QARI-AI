import React, { useState } from 'react';
import { BookOpen, LogIn, Loader2, AlertCircle } from 'lucide-react';

import { API, CALLBACK_URI } from '../../config/api';

export default function LoginPage({ onFallback }) {
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');

  const handleLogin = async () => {
    setIsLoading(true);
    setError('');
    try {
      const res = await fetch(`${API.AUTH_LOGIN}?redirect_uri=${encodeURIComponent(CALLBACK_URI)}`);
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
          Continue as Guest
        </button>

        <p className="mt-4 text-xs text-gray-400 leading-relaxed">
          <span className="text-amber-500 font-semibold">ⓘ</span> Guest sessions are temporary and stored locally.
          Login with <span className="font-semibold text-emerald-600">Quran.com</span> to save your progress across devices.
        </p>
      </div>
    </div>
  );
}
