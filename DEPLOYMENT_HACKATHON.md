# Qari AI - Hackathon Deployment Guide

## 🎯 Quick Decision Matrix

| Option | Setup Time | Cost | Reliability | Recommended? |
|--------|-----------|------|-------------|--------------|
| **Local Machine** | 5 min | $0 | Low (WiFi dependent) | ✅ **For demo/testing** |
| **Vercel + Railway** | 15 min | $0 (free tier) | High | ✅ **BEST FOR HACKATHON** |
| **Docker + Render** | 30 min | $0 (free tier) | Medium | ✅ **Good alternative** |
| **AWS/GCP/Azure** | 60+ min | $$ | Very High | ❌ Overkill for hackathon |
| **Manual VPS** | 45+ min | $ | Medium | ❌ Too complex |

---

## ✅ RECOMMENDED: Vercel + Railway (15 minutes)

**Why?**
- ✅ Free tier sufficient for hackathon
- ✅ Auto-deploy from GitHub (push = live)
- ✅ No Docker needed
- ✅ Scales automatically
- ✅ Both frontend and backend supported
- ✅ Minimal configuration

### Step 1: Prepare Codebase (5 minutes)

#### Update Backend `server.js` for Vercel
```javascript
// At the end of server.js, change:

// OLD:
const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
  console.log(`🚀 Server running on http://localhost:${PORT}`);
});

// NEW:
const PORT = process.env.PORT || 5000;
if (process.env.NODE_ENV !== 'production') {
  app.listen(PORT, () => {
    console.log(`🚀 Server running on http://localhost:${PORT}`);
  });
}

module.exports = app; // For Vercel
```

#### Create `backend/vercel.json`
```json
{
  "version": 2,
  "builds": [
    {
      "src": "server.js",
      "use": "@vercel/node"
    }
  ],
  "routes": [
    {
      "src": "/(.*)",
      "dest": "server.js"
    }
  ],
  "env": {
    "NODE_ENV": "production"
  }
}
```

#### Create `backend/.env.production`
```
QF_CLIENT_ID=your_quran_api_id
QF_CLIENT_SECRET=your_quran_api_secret
QF_ENV=prelive
ASR_URL=https://your-asr-service.railway.app
```

#### Create `frontend/.env.production`
```
VITE_API_BASE_URL=https://your-backend.vercel.app/api
```

#### Update `frontend/vite.config.js`
```javascript
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  define: {
    'process.env.VITE_API_BASE_URL': JSON.stringify(process.env.VITE_API_BASE_URL || 'http://localhost:5000/api')
  }
})
```

#### Update `frontend/src/App.jsx`
```javascript
// Change hardcoded URLs to use env variable (everywhere you fetch)

// OLD:
const res = await fetch(`http://localhost:5000/api/auth/login-url?...`)

// NEW:
const API_BASE = import.meta.env.VITE_API_BASE_URL || 'http://localhost:5000/api';
const res = await fetch(`${API_BASE}/auth/login-url?...`)
```

### Step 2: Deploy Frontend to Vercel (3 minutes)

1. **Push code to GitHub**
   ```bash
   git add .
   git commit -m "Hackathon deployment"
   git push origin main
   ```

2. **Go to [vercel.com](https://vercel.com)**
   - Sign up with GitHub
   - Click "Import Project"
   - Select your repository
   - Set environment variables:
     - `VITE_API_BASE_URL` = (leave blank, will set after backend deployed)
   - Click "Deploy"
   - Wait 2-3 minutes ✅

3. **Get your frontend URL** (e.g., `qari-ai.vercel.app`)

### Step 3: Deploy Backend to Vercel (3 minutes) - ALTERNATIVE: Railway

**Option A: Vercel for Backend**
1. Same as frontend, but Vercel will auto-detect `vercel.json`
2. Set environment variables in Vercel UI
3. Get backend URL (e.g., `qari-api.vercel.app`)

**Option B: Railway for Backend (Recommended)**
Why Railway? Better for Python + Node.js polyglot projects.

1. Go to [railway.app](https://railway.app)
2. Sign up with GitHub
3. Click "New Project" → "Deploy from GitHub repo"
4. Select your "Qari AI" repo
5. Configure environment variables:
   ```
   QF_CLIENT_ID=your_id
   QF_CLIENT_SECRET=your_secret
   ASR_URL=http://localhost:5001 (local for now)
   ```
6. Deploy ✅ (gets URL like `backend-production.up.railway.app`)

### Step 4: Deploy ASR Service to Railway (5 minutes)

Railway also supports Python! Perfect.

1. Create `asr/Procfile`
   ```
   web: python asr_service.py
   ```

2. Create `asr/railway.json`
   ```json
   {
     "buildCommand": "pip install -r requirements.txt",
     "startCommand": "python asr_service.py"
   }
   ```

3. Update `asr/asr_service.py` to use env PORT
   ```python
   # At the bottom:
   
   port = int(os.getenv('PORT', 5001))
   app.run(host='0.0.0.0', port=port, debug=False)
   ```

4. Deploy on Railway same way
5. Get ASR URL (e.g., `asr-production.up.railway.app`)

### Step 5: Connect Everything (2 minutes)

1. **Update Backend Environment on Vercel/Railway:**
   ```
   ASR_URL=https://asr-production.up.railway.app
   ```

2. **Update Frontend Environment on Vercel:**
   ```
   VITE_API_BASE_URL=https://backend-production.up.railway.app/api
   ```

3. **Redeploy** (should be automatic on env change)

### Final URLs:
```
Frontend:  https://qari-ai.vercel.app
Backend:   https://backend-production.up.railway.app
ASR:       https://asr-production.up.railway.app
```

---

## 🏃 FASTER OPTION: Local Machine + ngrok (5 minutes)

If you want to absolutely minimize setup time:

### Steps:

1. **Start all three services locally**
   ```bash
   # Terminal 1 - Backend
   cd backend
   npm install
   node server.js
   
   # Terminal 2 - ASR
   cd asr
   pip install -r requirements.txt
   python asr_service.py
   
   # Terminal 3 - Frontend
   cd frontend
   npm install
   npm run dev
   ```

2. **Install ngrok** (exposes local to internet)
   ```bash
   # Download from https://ngrok.com/download
   # Or: brew install ngrok (Mac) or choco install ngrok (Windows)
   ```

3. **Expose your backend**
   ```bash
   ngrok http 5000
   # Gets URL like: https://abc123.ngrok.io
   ```

4. **Update frontend to use ngrok URL**
   - Change all `http://localhost:5000` to `https://abc123.ngrok.io`

5. **Share ngrok URL with judges** ✅

**Pros:**
- ✅ Zero infrastructure setup
- ✅ Works immediately

**Cons:**
- ❌ Only works while your laptop is running
- ❌ ngrok URL changes each session
- ❌ Not ideal for offline demos

---

## 🐳 ALTERNATIVE: Docker + Render (30 minutes)

If you want container-based deployment:

### Prerequisites:
- Docker Desktop installed

### Steps:

1. **Create `Dockerfile` in root**
   ```dockerfile
   # Frontend build
   FROM node:20-alpine AS frontend-build
   WORKDIR /app/frontend
   COPY frontend/package*.json ./
   RUN npm install
   COPY frontend/ ./
   RUN npm run build

   # Backend + ASR
   FROM python:3.11-slim
   
   # Install Node.js for backend
   RUN apt-get update && apt-get install -y nodejs npm && rm -rf /var/lib/apt/lists/*
   
   WORKDIR /app
   
   # Copy and install Python deps (ASR)
   COPY asr/requirements.txt ./asr/
   RUN pip install -r asr/requirements.txt
   
   # Copy and install Node deps (Backend)
   COPY backend/package*.json ./backend/
   RUN cd backend && npm install
   
   # Copy everything
   COPY . .
   
   # Copy frontend build to backend public folder
   RUN mkdir -p backend/public && cp -r frontend/dist/* backend/public/
   
   EXPOSE 5000 5001
   
   CMD ["sh", "-c", "python asr/asr_service.py & node backend/server.js"]
   ```

2. **Build image**
   ```bash
   docker build -t qari-ai .
   ```

3. **Deploy to Render**
   - Go to [render.com](https://render.com)
   - New → Web Service
   - Connect GitHub repo
   - Set build command: `docker build -t qari-ai .`
   - Set start command: `docker run -p 5000:5000 qari-ai`
   - Deploy ✅

---

## 📋 Hackathon Day Deployment Checklist

### Morning (30 min before presentation)

- [ ] Ensure all `.env` files have correct credentials
- [ ] Test API endpoints locally:
  ```bash
  # Test backend health
  curl http://localhost:5000/api/quran/chapters
  
  # Test ASR service
  curl http://localhost:5001/health
  ```
- [ ] Test frontend locally: `npm run dev`
- [ ] Deploy to Vercel/Railway (if using cloud)
- [ ] Test deployed version in browser
- [ ] Verify audio recording works
- [ ] Have credentials ready if needed

### During Presentation

- [ ] Keep terminal open showing logs
- [ ] Have fallback laptop ready
- [ ] Share deployed URL (not localhost!)
- [ ] Test audio recording before showing judges
- [ ] Keep ngrok URL or Vercel link visible

### Backup Plan

If deployment fails:
1. Deploy locally + use ngrok
2. Show on your laptop directly
3. Pre-record demo video as last resort

---

## 🔧 Environment Variables Checklist

### Backend
```env
QF_CLIENT_ID=xxx              # From Quran Foundation
QF_CLIENT_SECRET=xxx          # From Quran Foundation
QF_ENV=prelive               # or production
ASR_URL=https://asr...       # Your ASR service URL
NODE_ENV=production
PORT=5000
```

### ASR Service
```env
WHISPER_MODEL=small          # or medium (trade speed for accuracy)
DEVICE=cpu                   # or cuda if available
COMPUTE_TYPE=int8            # Faster inference
LOG_LEVEL=INFO
PORT=5001
```

### Frontend
```env
VITE_API_BASE_URL=https://your-backend.app/api
```

---

## 🚀 Execution Timeline

| Task | Time | Status |
|------|------|--------|
| Update server.js for Vercel | 2 min | ⏱️ |
| Create vercel.json | 1 min | ⏱️ |
| Push to GitHub | 2 min | ⏱️ |
| Deploy frontend to Vercel | 3 min | ⏱️ |
| Deploy backend to Railway | 3 min | ⏱️ |
| Deploy ASR to Railway | 3 min | ⏱️ |
| Update env variables | 2 min | ⏱️ |
| Test and verify | 3 min | ⏱️ |
| **TOTAL** | **~20 minutes** | ✅ |

---

## 💡 Pro Tips for Hackathon

1. **Use MongoDB Atlas Free Tier** (if you decide to add persistence)
   ```javascript
   // Add to backend later
   const mongoose = require('mongoose');
   mongoose.connect(process.env.MONGODB_URI);
   ```

2. **Cache Results** - Don't re-analyze same audio
   ```javascript
   const cache = new Map();
   // Cache by audio hash
   ```

3. **Optimize Whisper** - Use `tiny` or `small` model (faster)
   ```python
   model = WhisperModel("small", device="cpu", compute_type="int8")
   ```

4. **Pre-load Model** - Avoid cold starts
   - Railway keeps containers warm enough
   - Vercel cold starts are unavoidable but <5 seconds

5. **Monitor Logs**
   - Vercel: Dashboard → Deployments → Runtime logs
   - Railway: Dashboard → Deployments → Logs

6. **Use Status Page**
   - Share health check: `https://your-api/health`
   - Judges can verify it's running

---

## 🎓 My Recommendation

### **Go with: Vercel (Frontend) + Railway (Backend + ASR)**

**Why?**
- ✅ Easiest setup (~15 minutes)
- ✅ Free tier includes everything you need
- ✅ Auto-deploy from GitHub (push and forget)
- ✅ Good uptime for hackathon duration
- ✅ No Docker complexity
- ✅ Both services visible in one dashboard
- ✅ Easy to debug with built-in logs

### **Setup Order:**
1. Create accounts (5 min)
2. Deploy frontend to Vercel (3 min)
3. Deploy backend + ASR to Railway (5 min)
4. Update env variables (2 min)
5. Test (5 min)
6. **Total: ~20 minutes**

### **If something breaks:**
Fallback to **local + ngrok** (5 min recovery)

---

## ⚠️ Potential Issues During Hackathon

| Issue | Cause | Fix |
|-------|-------|-----|
| Audio upload fails | Backend not running | Check Railway logs |
| "Connection refused" | Frontend can't reach backend | Check VITE_API_BASE_URL env var |
| Whisper takes forever | Using large model | Switch to `small` model |
| Quran API returns 401 | Expired token | Check credentials in .env |
| ngrok URL changes | Session timeout | Just regenerate with `ngrok http 5000` |

