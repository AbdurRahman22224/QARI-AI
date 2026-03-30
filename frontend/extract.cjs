const fs = require('fs');
const lines = fs.readFileSync('src/App.jsx', 'utf8').split('\n');

const imports = `import React, { useState, useEffect, useMemo, useRef } from 'react';
import { Mic, Loader2, AlertCircle, Info, BarChart3, RotateCcw, Volume2, Headphones, RefreshCw, Target, Clock, AudioLines, X, PlayCircle, Check, Zap, BookOpen } from 'lucide-react';
import WaveSurfer from 'wavesurfer.js';
import RegionsPlugin from 'wavesurfer.js/dist/plugins/regions.esm.js';`;

const part1 = lines.slice(5, 9).join('\n'); // Lines 6-9
const part2 = lines.slice(76, 148).join('\n'); // Lines 77-148
const part3 = lines.slice(149, 1488).join('\n'); // Lines 150-1488
const part4 = lines.slice(1489, 1514).join('\n'); // Lines 1490-1514
const part5 = lines.slice(1794, 1809).join('\n'); // Lines 1795-1809

const content = imports + '\n' + part1 + '\n\n' + part2 + '\n\n' + part5 + '\n\n' + part4 + '\n\n' + part3 + '\n';
fs.writeFileSync('src/components/Practice/PracticePage.jsx', content);

// Now rewrite App.jsx
const appImports = `import React, { useState, useEffect } from 'react';
import { BookOpen, LayoutDashboard, Mic, Power, ChevronRight, AlertCircle, Loader2 } from 'lucide-react';
import LoginPage from './components/Auth/LoginPage';
import PracticePage from './components/Practice/PracticePage';
`;

const appPart1 = lines.slice(9, 11).join('\n'); // REDIRECT_URI
const appPart2 = lines.slice(1515, 1793).join('\n'); // getStreak + DashboardPage + parseJwt + App

const finalAppContent = appImports + '\n' + appPart1 + '\n\n' + appPart2 + '\n';
fs.writeFileSync('src/App.jsx', finalAppContent);
console.log('Extraction complete!');
