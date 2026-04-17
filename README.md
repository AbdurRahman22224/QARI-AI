---
title: Qari AI ASR
emoji: 🎤
colorFrom: green
colorTo: blue
sdk: docker
pinned: false
---

# 🎤 Qari AI — Your Intelligent Tajweed & Quran Tutor

> **Bridging the gap between ancient tradition and modern AI.** 
> Qari AI provides real-time, high-precision Tajweed analysis to help students master the art of Quranic recitation.

---

## 🌟 The Vision 
Reciting the Quran with proper Tajweed is a spiritual and technical journey. Qari AI democratizes access to quality feedback by using **Whisper-powered Speech-to-Text** and custom **Acoustic Feature Extraction** to provide instant, pedagogical feedback on rules like *Madd, Ghunnah, Qalqalah,* and *Tafkheem*.

## 🚀 Key Features
- **📖 Practice Mode**: Recite full verses and get immediate scores on Accuracy, Timing, and Tajweed integrity.
- **🔬 Word Lab**: A high-speed training ground for individual words, featuring our "Fast Path" low-latency analysis.
- **📊 Analytics Dashboard**: Track your progress, manage your Streaks (integrated with Quran Foundation), and identify specific Tajweed rules that need focus.
- **🔗 QF Ecosystem**: Seamless login and daily streak synchronization with the official Quran Foundation platform.

## 🛠️ The Tech Stack (Hackathon Highlights)
- **ASR Engine**: Custom Flask implementation of `faster-whisper`.
- **Optimization**: We bypassed heavy libraries like `librosa` in favor of a **Pure NumPy & SciPy** feature extraction pipeline. This reduced analysis latency from seconds to milliseconds.
- **Frontend**: A high-performance React SPA with professional aesthetics and real-time audio visualization using `wavesurfer.js`.
- **Backend**: Node.js Proxy layer for secure communication, session management, and Supabase integration.

## ⚖️ Judging / Demo Instructions
1. **Login**: Click "Sign in with Quran Foundation" to link your real-world recitation streaks.
2. **Practice**: Go to the **Practice** tab, select a verse, and press "Record".
3. **Analyze**: Review your Tajweed breakdown. Green indicates mastery; Yellow highlights areas for improvement.
4. **Mastery Center**: Visit the **Dashboard** to see your global Tajweed Radar and Next Suggested Action.

---

## 🌍 Deployment (Hugging Face / Production)

Qari AI is designed for **Hybrid Deployment**: The heavy ASR logic runs on Hugging Face Spaces (GPU/CPU), while the Frontend/Backend run on agile platforms like Railway or Vercel.

### 1. Deploying the ASR Service (Hugging Face)
1.  **Create a Space**: On Hugging Face, create a NEW Space with the **Docker** SDK.
2.  **Push the Code**: Follow the HF instructions to push this repository.
3.  **Automatic Detection**: The `Dockerfile` at the root will automatically build only the `asr/` environment.
4.  **Endpoint**: Once the Space is running, your ASR endpoint will be: `https://<your-username>-<space-name>.hf.space/analyze`

### 2. Configuring the Backend (Railway)
Set the following Environment Variables in your Node.js production container:
- `ASR_URL`: The URL of your Hugging Face Space (e.g., `https://user-qari-asr.hf.space`)
- `SUPABASE_URL` & `SUPABASE_SERVICE_KEY`: Your database credentials.

### 3. Building the Frontend
Build the React app with the production URL of your **Backend**:
```bash
VITE_API_URL=https://your-backend-api.com npm run build
```

---

*Built for the Quran Foundation Hackathon. Dedicated to the preservation of Al-Quran.*
