# -*- coding: utf-8 -*-
"""
Qari AI — Enhanced Arabic Speech-to-Text Analysis Service v4.0 (Enhanced Analysis)
Improvements: Locked word alignment, weighted tajweed timing,
              qalqalah energy+variation, smart pauses, better pronunciation,
              segment-to-match mapping, debug output.
"""

import os
import sys

# Fix OpenMP threading crash on Windows
os.environ['KMP_DUPLICATE_LIB_OK'] = 'TRUE'
os.environ['OMP_NUM_THREADS'] = '1'

import json
import requests
import tempfile
import subprocess
import numpy as np
import imageio_ffmpeg
from flask import Flask, request, jsonify

# Get absolute path to ffmpeg for reliability on Windows
try:
    ffmpeg_path = imageio_ffmpeg.get_ffmpeg_exe()
except:
    ffmpeg_path = "ffmpeg"
from flask_cors import CORS
import mutagen
from mutagen.mp3 import MP3
from mutagen.mp4 import MP4
from io import BytesIO

from src.utils.normalize_arabic import normalize_arabic
from src.utils.tajweed_pipeline import levenshtein_similarity

app = Flask(__name__)
CORS(app)

# ── Model Loading ──
print("⏳ Loading Whisper model (small)...")
from faster_whisper import WhisperModel
model = WhisperModel("small", device="cpu", compute_type="int8")
print("✅ Whisper model loaded!")

# ========================================================
# ============ Word Lab Logic (Unified with Pipeline) ====
from src.utils.audio_features import load_and_preprocess_audio, extract_frame_features, get_segment_features

import threading

REFERENCE_CACHE = {}
DURATION_CACHE = {}  # 🕒 Cache for verse durations to prevent redundant fetches
FETCH_LOCKS = {}     # 🔒 Track in-progress fetches to prevent redundant parallel downloads
FETCH_LOCKS_LOCK = threading.Lock()

def normalize_url(url: str) -> str:
    """Consistently formats reference URLs for stable cache keys."""
    if not url: return ""
    if not url.startswith('http'):
        return f"https://verses.quran.com/{url}"
    return url

def get_ref_lock(url):
    """Provides a thread-safe lock unique to each URL."""
    norm_url = normalize_url(url)
    with FETCH_LOCKS_LOCK:
        if norm_url not in FETCH_LOCKS:
            FETCH_LOCKS[norm_url] = threading.Lock()
        return FETCH_LOCKS[norm_url]

def get_audio_from_url(url: str):
    url = normalize_url(url)
    if not url: return None, None
    
    # Check Cache with basic failure caching
    if url in REFERENCE_CACHE: 
        return REFERENCE_CACHE[url]

    # Use unique lock to prevent redundant redundant parallel downloads
    with get_ref_lock(url):
        # Double check after acquiring lock
        if url in REFERENCE_CACHE:
            return REFERENCE_CACHE[url]
            
        print(f"📥 [Cache] Fetching reference audio: {url}")
        try:
            r = requests.get(url, headers={'User-Agent': 'Mozilla/5.0'}, timeout=15)
            r.raise_for_status()
            
            with tempfile.NamedTemporaryFile(suffix='.mp3', delete=False) as t1:
                t1.write(r.content)
                tmp_path = t1.name
            
            try:
                # Use our robust preprocessing for reference audio too
                audio, sr, _ = load_and_preprocess_audio(tmp_path)
                REFERENCE_CACHE[url] = (audio, sr)
                return REFERENCE_CACHE[url]
            finally:
                # 🛠️ Fix: Clean up the source temp file after it's been preprocessed into memory
                if os.path.exists(tmp_path):
                    try: os.unlink(tmp_path)
                    except: pass
                    
        except Exception as e:
            print(f"❌ [Cache] Ref audio download failed for {url}: {e}")
            # Cache the failure as None to avoid repeated timeouts on 404s
            REFERENCE_CACHE[url] = (None, None)
            return None, None

@app.route('/api/analyze-reference', methods=['POST'])
def analyze_reference():
    """
    Lightweight endpoint to fetch reference audio duration via Mutagen.
    Used by the frontend to set the 'master' baseline duration.
    """
    try:
        raw_url = request.json.get('reference_audio_url', '')
        ref_url = normalize_url(raw_url)
        if not ref_url:
            return jsonify({"duration": 0, "status": "no_url"}), 200

        # Sync the cache check and fetch to prevent redundant parallel downloads
        with get_ref_lock(ref_url):
            # 🕒 Check Cache First
            if ref_url in DURATION_CACHE:
                return jsonify({
                    "duration": DURATION_CACHE[ref_url],
                    "status": "success",
                    "cached": True
                }), 200

            # Fetch via get_audio_from_url to benefit from centralized fetch logic
            audio_data, sr = get_audio_from_url(ref_url)
            if audio_data is None:
                return jsonify({"duration": 0, "status": "fetch_failed"}), 200
            
            duration = float(len(audio_data)) / sr
            DURATION_CACHE[ref_url] = round(duration, 2)
            print(f"🕒 Cache Updated: {ref_url} → {duration:.2f}s")
        
        return jsonify({
            "duration": round(duration, 2),
            "status": "success",
            "pre_warmed": True
        }), 200

    except Exception as e:
        print(f"⚠️ Mutagen error for {raw_url}: {e}")
        return jsonify({"duration": 0.0, "warning": str(e)}), 200

@app.route('/analyze', methods=['POST'])
def analyze():
    """
    Main analysis endpoint for standard ayah recordings.
    """
    if 'audio' not in request.files:
        return jsonify({"error": "No audio file provided"}), 400
    
    # Extract data from the form
    expected_text = request.form.get('expected_text', '')
    word_list_str = request.form.get('word_list', '[]')
    tajweed_map_str = request.form.get('tajweed_map', '{}')
    word_durations_str = request.form.get('word_durations', '{}')
    ref_duration = float(request.form.get('reference_duration', 0.0))
    
    try:
        # Priority 1: Use specific word list if provided
        expected_words = json.loads(word_list_str)
        if not expected_words and expected_text:
            # Priority 2: Fall back to splitting expected_text
            expected_words = [w.strip() for w in expected_text.split() if w.strip()]
            
        tajweed_map = json.loads(tajweed_map_str)
        word_durations = json.loads(word_durations_str)
    except Exception as e:
        print(f"⚠️ Error parsing analysis metadata: {e}")
        return jsonify({"error": "Invalid metadata format"}), 400

    audio_file = request.files['audio']
    with tempfile.NamedTemporaryFile(suffix='.webm', delete=False) as tmp:
        audio_file.save(tmp.name)
        audio_path = tmp.name
        
    try:
        print(f"🔬 [FullAyah] Analyzing {len(expected_words)} words...")
        from src.utils.tajweed_pipeline import process_audio_pipeline
        result = process_audio_pipeline(audio_path, expected_words, tajweed_map, ref_duration, word_durations=word_durations, asr_model=model)
        return jsonify(result)
    except Exception as e:
        import traceback
        traceback.print_exc()
        print(f"❌ Analysis error: {e}")
        return jsonify({"error": str(e)}), 500
    finally:
        if 'audio_path' in locals() and os.path.exists(audio_path):
            try: os.unlink(audio_path)
            except: pass

@app.route('/analyze-word-hybrid', methods=['POST'])
def analyze_word_hybrid():
    """
    Hybrid analysis endpoint for the Word Lab Trainer.
    Compares USER audio against MASTER REFERENCE audio using the new pipeline.
    """
    if 'audio' not in request.files:
        return jsonify({"error": "No user audio provided"}), 400
    
    ref_url = request.form.get('reference_audio_url', '')
    word_text = request.form.get('word_text', '')
    tajweed_map_str = request.form.get('tajweed_map', '{}')
    
    if not ref_url:
        return jsonify({"error": "No reference audio URL provided"}), 400
    
    try:
        tajweed_map = json.loads(tajweed_map_str)
    except:
        tajweed_map = {}

    user_file = request.files['audio']
    with tempfile.NamedTemporaryFile(suffix='.webm', delete=False) as tmp:
        user_file.save(tmp.name)
        user_path = tmp.name

    try:
        # Pre-fetch reference duration for the score component
        ref_audio, ref_sr = get_audio_from_url(ref_url)
        ref_dur = len(ref_audio)/ref_sr if ref_audio is not None else 0.0
        
        # Call the unified pipeline orchestrator for this single word
        from src.utils.tajweed_pipeline import process_audio_pipeline
        result = process_audio_pipeline(user_path, [word_text], tajweed_map, ref_dur, asr_model=model, strict_pace=True)
        
        # Format response for Word Lab UI compatibility
        wr = result["word_feedback"][0] if result["word_feedback"] else {}
        madd_status, ghunnah_status, heavy_status, qalqalah_status = None, None, None, None
        madd_msg = ""
        
        for issue in wr.get("tajweed", []):
            st = issue["severity"] # 'ok' or 'warning'
            rule = issue["rule"]
            if "madd" in rule: madd_status, madd_msg = st, issue["message"]
            elif rule == "ghunnah": ghunnah_status = st
            elif rule == "heavy": heavy_status = "Good emphasis" if st == "ok" else "Too soft"
            elif rule == "qalqalah": qalqalah_status = st
            
        return jsonify({
            "score": result["score"],
            "ratio": round(result["timing"] / 100.0 if "timing" in result else 1.0, 2),
            "got_text": result.get("raw_text", ""),
            "text_match": result["accuracy"] >= 65,
            "phonetic_error": wr.get("phonetic_error", False),
            "user_duration": wr.get("word_dur", result.get("duration_seconds", 0.0)),
            "ref_duration": ref_dur,
            "ratio_result": wr.get("pace_alert", "Balanced").capitalize(),
            "madd_status": madd_status,
            "madd_message": madd_msg,
            "madd_match_insight": wr.get("madd_match_insight"),
            "ghunnah_status": ghunnah_status,
            "heavy_status": heavy_status,
            "qalqalah_status": qalqalah_status,
            "confidence": "high" if result["accuracy"] > 50 else "low",
            "word": word_text,
            "rules": tajweed_map.get(normalize_arabic(word_text), []),
            "debug_metrics": {}
        })
    except Exception as e:
        import traceback
        traceback.print_exc()
        print(f"❌ Word Lab error: {e}")
        return jsonify({"error": str(e)}), 500
    finally:
        if 'user_path' in locals() and os.path.exists(user_path):
            try:
                os.unlink(user_path)
            except:
                pass


if __name__ == '__main__':
    print("🎤 Qari AI ASR Service v4.0 (Enhanced Analysis)")
    print("=" * 40)
    port = int(os.environ.get('PORT', 5001))
    print(f"Starting on http://localhost:{port}")
    app.run(host='0.0.0.0', port=port, debug=False)
