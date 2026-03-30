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
from src.utils.audio_features import (
    load_audio, extract_word_features,
    silence_based_word_segments, weighted_split_segments,
    get_word_segment, compute_rms_energy
)

# ── Model Loading ──
print("⏳ Loading Whisper model (small)...")
from faster_whisper import WhisperModel
model = WhisperModel("small", device="cpu", compute_type="int8")
print("✅ Whisper model loaded!")


# ═══════════════════════════════════════════════
# FIX #1: WORD ALIGNMENT WITH GREEDY LOCKING
# ═══════════════════════════════════════════════

def levenshtein_similarity(s1: str, s2: str) -> float:
    """Calculate similarity between two strings using Levenshtein distance."""
    try:
        import Levenshtein
        distance = Levenshtein.distance(s1, s2)
        max_len = max(len(s1), len(s2), 1)
        return 1.0 - (distance / max_len)
    except ImportError:
        matches = sum(1 for a, b in zip(s1, s2) if a == b)
        return matches / max(len(s1), len(s2), 1)


def get_thresholds(word: str) -> tuple:
    """
    Tiered confidence calibration:
    Returns (partial_threshold, correct_threshold)
    """
    length = len(word)
    if length <= 3:
        return (0.85, 0.95)
    elif length <= 6:
        return (0.70, 0.90)
    else:
        return (0.60, 0.85)


def compare_words(asr_words: list, expected_words: list):
    """
    Greedy word alignment with index locking.
    Each ASR word can only be matched ONCE — prevents duplicate matches.
    Uses nearest-match to handle missing, merged, and reordered words.
    """
    if not expected_words:
        return {"accuracy": 0, "word_results": [], "correct_count": 0,
                "partial_count": 0, "incorrect_count": 0, "missing_count": 0}

    word_results = []
    used_asr_indices = set()

    # Filter out empty word artifacts that might come from the frontend
    valid_expected = [w for w in expected_words if w and w.strip()]
    
    if not valid_expected:
        return {"accuracy": 0, "word_results": [], "correct_count": 0,
                "partial_count": 0, "incorrect_count": 0, "missing_count": 0}

    for exp_idx, exp_word in enumerate(valid_expected):
        # 🔑 Critical: Normalize exp_word here for clean matching
        norm_exp = normalize_arabic(exp_word)
        
        best_match = None
        best_sim = 0.0
        best_idx = -1

        for i, asr_word in enumerate(asr_words):
            if i in used_asr_indices: continue

            if asr_word == norm_exp:
                best_match, best_sim, best_idx = asr_word, 1.0, i
                break

            sim = levenshtein_similarity(asr_word, norm_exp)
            if sim > best_sim:
                best_sim, best_match, best_idx = sim, asr_word, i

        # Tiered status assignment based on word length
        partial_th, correct_th = get_thresholds(norm_exp)
        
        if best_sim >= correct_th:
            status = "correct"
            sim_display = 100.0 if best_sim >= 0.98 else round(best_sim * 100, 1)
            word_results.append({
                "expected": exp_word, "got": best_match, "status": "correct",
                "similarity": sim_display, "index": exp_idx, "asr_index": best_idx,
            })
            used_asr_indices.add(best_idx)
        elif best_sim >= partial_th:
            word_results.append({
                "expected": exp_word, "got": best_match, "status": "partial",
                "similarity": round(best_sim * 100, 1), "index": exp_idx, "asr_index": best_idx,
            })
            used_asr_indices.add(best_idx)
        else:
            word_results.append({
                "expected": exp_word, "got": best_match if best_match else "",
                "status": "missing" if best_sim < 0.3 else "incorrect",
                "similarity": round(best_sim * 100, 1), "index": exp_idx, "asr_index": -1,
            })
            
        print(f"  └─ Word {exp_idx}: Original='{exp_word}' Normalized='{norm_exp}' vs Got='{best_match or '?'}' -> {word_results[-1]['status'].upper()} ({word_results[-1]['similarity']}%)", flush=True)

    correct = sum(1 for w in word_results if w["status"] == "correct")
    partial = sum(1 for w in word_results if w["status"] == "partial")
    total = len(expected_words)
    accuracy = (correct + partial * 0.7) / total * 100 if total > 0 else 0

    return {
        "accuracy": round(accuracy, 1),
        "word_results": word_results,
        "correct_count": correct,
        "partial_count": partial,
        "incorrect_count": sum(1 for w in word_results if w["status"] == "incorrect"),
        "missing_count": sum(1 for w in word_results if w["status"] == "missing"),
    }


# ═══════════════════════════════════════════════
# FIX #2 & #3: TAJWEED DETECTION (WEIGHTED TIMING + ENERGY VARIATION)
# ═══════════════════════════════════════════════

def get_tajweed_weight(word: str, tajweed_map: dict) -> float:
    """
    Get expected duration weight for a word based on its tajweed rules.
    Sync'd with Section 3.3 multipliers.
    """
    rules = tajweed_map.get(word, [])
    if not rules:
        return 1.0

    # Precise Multipliers based on User's New (Midpoint) Ranges
    if "madd_6" in rules: return 2.75
    if "madd_c" in rules: return 2.15
    if "madd_s" in rules: return 2.1
    if any(r in rules for r in ["madd_2", "madd"]): return 1.25
    if "qalqalah" in rules: return 1.15
    if "ghunnah" in rules: return 1.1
    if "heavy" in rules: return 1.05
    
    return 1.0


def check_tajweed_rules(word: str, features: dict, tajweed_map: dict,
                        base_speed: float, confidence: float, all_stats: dict) -> list:
    """
    Check tajweed rules using granular madd types and adaptive thresholds.
    Includes confidence gating and debug metrics.
    """
    issues = []
    norm_word = normalize_arabic(word)
    word_rules = tajweed_map.get(norm_word, [])
    
    # 1. Debug Metrics Container
    debug = {
        "word": word,
        "confidence": round(confidence, 3),
        "duration": features.get("duration", 0.0),
        "ratio": round(features.get("duration", 0.0) / max(base_speed, 0.01), 2),
        "rms": features.get("rms_energy", 0.0),
        "var_score": features.get("variation_score", 0.0),
        "low_freq_ratio": features.get("low_freq_ratio", 0.0),
        "nasal_ratio": features.get("nasal_ratio", 0.0),
        "rule_applied": "none"
    }

    if not word_rules:
        return issues

    # 2. Confidence Gating (Safety Gate)
    # Combine low confidence with duration sanity check
    is_stopword = len(norm_word) <= 2
    if confidence < 0.75 and (not is_stopword and features.get("duration", 0) < 0.15):
        # We don't return issues, just a "low confidence" marker if needed
        # But per requirements: Return "Low confidence — cannot evaluate Tajweed reliably"
        return [{
            "rule": "all", "status": "low_confidence",
            "message": "Low confidence — cannot evaluate Tajweed reliably",
            "severity": "info",
            "debug": debug
        }]

    actual_duration = features.get("duration", 0.5)
    rms_energy = features.get("rms_energy", 0.0)
    var_score = features.get("variation_score", 0.0)
    low_freq_ratio = features.get("low_freq_ratio", 0.0)
    nasal_ratio = features.get("nasal_ratio", 0.0)
    
    avg_rms = all_stats.get("avg_rms", 0.02)
    avg_var = all_stats.get("avg_var", 0.3)
    avg_low_freq = all_stats.get("avg_low_freq", 0.3)

    for rule in word_rules:
        debug["rule_applied"] = rule
        
        if rule.startswith("madd"):
            ratio = actual_duration / max(base_speed, 0.01)
            
            # Strict Non-Overlapping Ranges (UPDATED)
            # madd_2  : 1.1 <= ratio < 1.35
            # madd_4_5: 1.35 <= ratio < 1.75
            # madd_6  : 2.5 <= ratio <= 3.0
            
            if rule == "madd_6":
                min_r, max_r, label = 2.5, 3.0, "Necessary (6 cts)"
                # Soft zone fallback for Madd 6 (1.75 - 2.5)
                if 1.75 <= ratio < 2.5:
                    issues.append({
                        "rule": rule, "status": "close",
                        "message": f"Close — try slightly longer for {label}",
                        "severity": "warning",
                        "detail": f"ratio={ratio:.2f}",
                        "debug": {**debug, "pass": True}
                    })
                    continue
            elif rule == "madd_s":
                # Madd as-Sukun can be 2, 4, or 6 counts (High flexibility)
                min_r, max_r, label = 1.0, 3.2, "Madd as-Sukun (2-6 cts)"
            elif rule in ["madd_c", "madd"]:
                # User requested relaxation by 0.2: 1.35 -> 1.15
                min_r, max_r, label = 1.25, 1.75, "Extended (4-5 cts)"
            else: # madd_2
                # Adjusted to 1.15 to avoid overlap with relaxed madd_c
                min_r, max_r, label = 1.0, 1.25, "Normal (2 cts)"
            
            if ratio < min_r:
                issues.append({
                    "rule": rule, "status": "short",
                    "message": f"Stretch \"{word}\" longer — {label} expected",
                    "severity": "warning",
                    "detail": f"ratio={ratio:.2f} (need ≥ {min_r})",
                    "debug": {**debug, "pass": False}
                })
            elif ratio > max_r:
                issues.append({
                    "rule": rule, "status": "long",
                    "message": f"Shorten \"{word}\" slightly — {label} elongation is too long",
                    "severity": "warning",
                    "detail": f"ratio={ratio:.2f} (max {max_r})",
                    "debug": {**debug, "pass": False}
                })
            else:
                issues.append({
                    "rule": rule, "status": "ok",
                    "message": f"Good {label} elongation on \"{word}\"",
                    "severity": "ok",
                    "debug": {**debug, "pass": True}
                })

        elif rule == "ghunnah":
            ratio = actual_duration / max(base_speed, 0.01)
            # Relaxed thresholds to avoid false negatives in words with other features (like Qalqalah)
            duration_ok = ratio >= 0.95
            stability_ok = var_score < 0.4
            nasal_ok = nasal_ratio >= 0.18
            
            if duration_ok and stability_ok and nasal_ok:
                issues.append({
                    "rule": "ghunnah", "status": "ok",
                    "message": f"Good nasal sound on \"{word}\"",
                    "severity": "ok",
                    "debug": {**debug, "pass": True}
                })
            else:
                msg = "Hold the nasal sound longer" if not duration_ok else "Nasal sound unclear"
                issues.append({
                    "rule": "ghunnah", "status": "short",
                    "message": f"{msg} in \"{word}\"",
                    "severity": "warning",
                    "detail": f"ratio={ratio:.2f}, nasal={nasal_ratio:.2f}",
                    "debug": {**debug, "pass": False}
                })

        elif rule == "qalqalah":
            # Normalized variation check
            normalized_var = var_score / max(avg_var, 0.1)
            # Threshold 1.3 - 1.5
            if normalized_var >= 1.3:
                issues.append({
                    "rule": "qalqalah", "status": "ok",
                    "message": f"Good qalqalah bounce on \"{word}\"",
                    "severity": "ok",
                    "debug": {**debug, "pass": True}
                })
            else:
                issues.append({
                    "rule": "qalqalah", "status": "weak",
                    "message": "Add more bounce — qalqalah needs a clear pulse",
                    "severity": "warning",
                    "detail": f"norm_var={normalized_var:.2f}",
                    "debug": {**debug, "pass": False}
                })

        elif rule == "heavy":
            # Energy ratio + Low-freq energy ratio
            energy_ratio = rms_energy / max(avg_rms, 0.001)
            tafkhim_pass = (energy_ratio >= 0.5) and (low_freq_ratio > max(0.25, avg_low_freq))
            
            if tafkhim_pass:
                issues.append({
                    "rule": "heavy", "status": "ok",
                    "message": f"Good pronunciation of \"{word}\"",
                    "severity": "ok",
                    "debug": {**debug, "pass": True}
                })
            else:
                issues.append({
                    "rule": "heavy", "status": "weak",
                    "message": f"Pronounce \"{word}\" more clearly — heavy letter (tafkheem)",
                    "severity": "warning",
                    "detail": f"energy_ratio={energy_ratio:.2f}, low_freq={low_freq_ratio:.2f}",
                    "debug": {**debug, "pass": False}
                })

    return issues


# ═══════════════════════════════════════════════
# FIX #2: TIMING SCORE (Wall Clock vs Reference)
# ═══════════════════════════════════════════════

def compute_timing_score(total_duration: float, reference_duration: float) -> float:
    """
    Timing score based on User's Total Duration vs Master Reciter's Duration.
    Rewards a consistent, deliberate pace and penalizes rushing.
    Asymmetric: Steeper penalty for rushing (speeding), gentler for slow recitation.
    """
    # Fix: If duration is missing, estimate logic handled in frontend.
    # If it still reaches here as <= 0, we can't score timing accurately.
    if not reference_duration or reference_duration <= 0:
        return 50.0 # Neutral fallback if no ref available

    ratio = total_duration / max(reference_duration, 0.01)
    
    # 🎯 Mastery Window (±12% - slightly more generous for learners)
    if 0.88 <= ratio <= 1.12:
        return 100.0
    
    # Asymmetric Penalty
    if ratio < 0.88:
        # Rushing: Steep penalty
        # ratio 0.5 -> 100 - (0.38 * 200) = 24
        deviation = 0.88 - ratio
        score = 100 - (deviation * 180)
    else:
        # Slow Recitation: Very gentle penalty (pedagogically preferred over rushing)
        # ratio 2.0 -> 100 - (0.88 * 40) = 64
        # ratio 3.0 -> 100 - (1.88 * 40) = 24
        deviation = ratio - 1.12
        score = 100 - (deviation * 40)
    
    # Floor at 10% to prevent total demotivation 
    return round(max(10, min(100, score)), 1)


# ═══════════════════════════════════════════════
# FIX #5: IMPROVED PRONUNCIATION SCORING
# ═══════════════════════════════════════════════

def compute_pronunciation_score(word_results: list, word_features: list, tajweed_map: dict) -> float:
    """
    Pronunciation score using Section 3.4 Penalty-Based System.
    Considers RMS energy, status match, and tajweed-specific characteristics.
    """
    score = 100.0
    if not word_results or not word_features:
        return 50.0

    avg_energy = np.mean([f["rms_energy"] for f in word_features])
    
    # 1. Macro Energy Penalties (Section 3.4 #1)
    if avg_energy < 0.002: # Very Quiet
        score -= 20
    elif avg_energy < 0.01: # Quiet
        score -= 10

    # 2. Word-Level Penalties (Section 3.4 #2)
    total_words = len(word_results)
    for i, wr in enumerate(word_results):
        feat = word_features[i] if i < len(word_features) else None
        energy = feat["rms_energy"] if feat else 0.0
        
        # Partial/Missing + Quiet triggers higher penalties
        is_quiet = energy < (avg_energy * 0.5) # relatively quiet word
        
        if wr["status"] == "partial":
            score -= (20 / total_words) if is_quiet else (10 / total_words)
        elif wr["status"] == "missing":
            score -= (25 / total_words) if is_quiet else (15 / total_words)
        elif wr["status"] == "incorrect":
            score -= (30 / total_words)

        # 3. Tajweed Emphasis (Section 3.4 #3) 
        rules = tajweed_map.get(wr["expected"], [])
        if "ghunnah" in rules and energy < avg_energy * 0.4: score -= 5 
        if "heavy" in rules and energy < avg_energy * 0.8: score -= 10
        if "qalqalah" in rules:
            variation = feat.get("energy_variation", 0.0) if feat else 0.0
            if variation < (max(energy, 0.001) * 0.3): score -= 8

    return round(max(0, min(100, score)), 1)


# ═══════════════════════════════════════════════
# FIX #6: TAJWEED INTEGRITY (DEDUCTION-BASED)
# ═══════════════════════════════════════════════

def compute_tajweed_score(word_feedback: list, accuracy_score: float) -> float:
    """
    Calculates Tajweed Integrity based on rule checks (Madd, Ghunnah, etc.)
    Point deduction system ensuring the score isn't 100% if rules are missed.
    """
    if not word_feedback:
        return round(float(accuracy_score), 1)

    total_deductions = 0
    rule_count = 0
    
    for word in word_feedback:
        for check in word.get("tajweed", []): # linked to 'tajweed' key in word_results
            rule_count += 1
            status = check.get("status")
            if status == "short":
                total_deductions += 15 # Severe penalty for missing Harakah count
            elif status == "long" or status == "stretched":
                total_deductions += 5  # Minor penalty for over-extension
            elif status == "missed" or status == "weak":
                total_deductions += 20 # Full rule ignored
    
    # Base score is the word accuracy, minus tajweed penalties
    score = accuracy_score - total_deductions
    
    # If no rules were present, just match accuracy
    if rule_count == 0:
        return round(float(accuracy_score), 1)

    return round(max(0, min(100, score)), 1)


def compute_final_score(accuracy: float, timing: float, integrity: float, pronunciation: float) -> dict:
    """
    Final combined score (Updated Section 3.5).
    Weights: Accuracy (40%), Timing (20%), Integrity (20%), Pronunciation (20%).
    """
    final = 0.4 * accuracy + 0.2 * timing + 0.2 * integrity + 0.2 * pronunciation
    final = round(final, 1)

    # Hallucination/Low-Confidence Detection
    if accuracy > 95 and (pronunciation < 45 or integrity < 45):
        final = min(final, 55.0)
        grade, color = "Weak", "amber"
        summary = "Audio unclear or too quiet — the transcription may be unreliable."
    elif final >= 90:
        grade, color = "Excellent", "green"
        summary = "Excellent recitation! MashaAllah! 🌟"
    elif final >= 80:
        grade, color = "Good", "green"
        summary = "Good recitation. Minor improvements possible."
    elif final >= 70:
        grade, color = "Decent", "blue"
        summary = "Decent attempt. Focus on the highlighted words."
    elif final >= 60:
        grade, color = "Fair", "amber"
        summary = "Fair recitation. Practice the words marked in yellow and red."
    elif final >= 50:
        grade, color = "Weak", "amber"
        summary = "Needs improvement. Listen carefully and try again."
    else:
        grade, color = "Retry", "red"
        summary = "Audio unclear or too many errors. Please recite more clearly."

    return {"score": final, "grade": grade, "color": color, "summary": summary}


# ═══════════════════════════════════════════════
# FEEDBACK & SUGGESTIONS
# ═══════════════════════════════════════════════

def generate_feedback(word_results: list, tajweed_issues: list) -> list:
    feedback = []
    for w in word_results:
        if w["status"] == "missing":
            feedback.append({"type": "error", "icon": "❌", "message": f"You missed the word \"{w['expected']}\"", "word": w["expected"]})
    for issue in tajweed_issues:
        if issue["severity"] == "warning":
            feedback.append({"type": "warning", "icon": "⚠️", "message": issue["message"], "rule": issue["rule"]})
    for w in word_results:
        if w["status"] == "incorrect":
            feedback.append({"type": "warning", "icon": "🔊", "message": f"Pronounce \"{w['expected']}\" more clearly", "word": w['expected']})
    return feedback


def generate_suggestions(accuracy: float, timing: float, pronunciation: float, tajweed_issues: list = None) -> list:
    suggestions = []
    scores = {"accuracy": accuracy, "timing": timing, "pronunciation": pronunciation}
    weakest = min(scores, key=scores.get)
    if weakest == "accuracy" or accuracy < 70:
        suggestions.append("Listen to the reference recitation carefully, then try reciting word by word.")
    if weakest == "timing" or timing < 70:
        suggestions.append("Try reciting slower — focus on matching the master's deliberate pace.")
    if weakest == "pronunciation" or pronunciation < 70:
        suggestions.append("Speak more clearly and closer to the microphone for better results.")
    return suggestions[:3]


# ═══════════════════════════════════════════════
# FLASK APP
# ═══════════════════════════════════════════════

app = Flask(__name__)
CORS(app)


@app.route('/health', methods=['GET'])
def health():
    return jsonify({"status": "ok", "service": "Qari AI ASR v4.1", "model": "whisper-small"})


@app.route('/analyze', methods=['POST'])
def analyze_recitation():
    try:
        # ── 1. Audio Loading ──
        if 'audio' not in request.files:
            return jsonify({"error": "No audio file provided"}), 400
        
        file = request.files['audio']
        word_list = json.loads(request.form.get('word_list', '[]'))
        tajweed_map = json.loads(request.form.get('tajweed_map', '{}'))
        ref_duration = float(request.form.get('reference_duration', '0'))
        
        # 🛡️ Full Form Data Log
        print(f"DEBUG: 📨 RECEIVED FORM DATA: {request.form.to_dict()}")
        print(f"DEBUG: Received reference duration: {ref_duration}s")
        print(f"DEBUG: Received word list: {word_list}")
        print(f"DEBUG: Received tajweed map: {tajweed_map}")
        
        with tempfile.NamedTemporaryFile(suffix='.webm', delete=False) as tmp:
            file.save(tmp.name)
            tmp_path = tmp.name

        # OPTIMIZATION: Convert to WAV once and reuse
        wav_path = tmp_path + ".wav"
        try:
            subprocess.run([ffmpeg_path, '-y', '-i', tmp_path, '-ar', '16000', '-ac', '1', wav_path], 
                           capture_output=True, check=True, timeout=30)
        except Exception as e:
            print(f"❌ FFMPEG Pre-conversion error: {e}")
            wav_path = tmp_path # Fallback to raw path

        # ── 2. Transcription (Using optimized WAV) ──
        segments_gen, info = model.transcribe(
                wav_path,
                beam_size=5, 
                language="ar",
                initial_prompt= "آية قرآنية ",
                best_of=2,
                vad_filter=True,
                word_timestamps=True,
                temperature=0.0,
            )
        raw_text = ""
        whisper_word_ts = []
        for segment in segments_gen:
            raw_text += segment.text + " "
            if segment.words:
                for w in segment.words:
                    whisper_word_ts.append({
                        "word": w.word.strip(), "norm_word": normalize_arabic(w.word.strip()),
                        "start": round(w.start, 2), "end": round(w.end, 2),
                        "prob": round(float(w.probability), 3)
                    })
        raw_text = raw_text.strip()
        asr_words = normalize_arabic(raw_text).split()
        expected_words = [normalize_arabic(w) for w in word_list]

        # ── 3. Alignment & Features ──
        audio_data, sr = load_audio(wav_path)
        total_duration = len(audio_data) / sr
        comparison = compare_words(asr_words, word_list) # word_list has original Arabic

        # Build segments
        word_segments = []
        for wr in comparison["word_results"]:
            asr_idx = wr.get("asr_index", -1)
            if asr_idx >= 0 and asr_idx < len(whisper_word_ts):
                ts = whisper_word_ts[asr_idx]
                word_segments.append({"start": ts["start"], "end": ts["end"]})
            else:
                word_segments.append({"start": 0, "end": 0.5})

        word_features = extract_word_features(audio_data, sr, word_segments)
        
        # ── 4. Global Stats for Normalization ──
        if word_features:
            avg_rms = np.mean([f["rms_energy"] for f in word_features])
            avg_var = np.mean([f["variation_score"] for f in word_features])
            avg_low_freq = np.mean([f["low_freq_ratio"] for f in word_features])
        else:
            avg_rms, avg_var, avg_low_freq = 0.02, 0.3, 0.3
            
        all_stats = {
            "avg_rms": float(avg_rms),
            "avg_var": float(avg_var),
            "avg_low_freq": float(avg_low_freq)
        }

        # ── 5. Rule Checking ──
        # Fix base speed calculation to use weighted durations
        total_word_duration = sum(f["duration"] for f in word_features)
        total_weights = max(sum(get_tajweed_weight(w, tajweed_map) for w in word_list), 1)
        base_speed = total_word_duration / total_weights
        
        all_tajweed_issues = []
        for i, wr in enumerate(comparison["word_results"]):
            if wr["status"] in ("correct", "partial"):
                feat = word_features[i] if i < len(word_features) else {
                    "duration": 0.5, "rms_energy": 0.01, "variation_score": 0.3, 
                    "low_freq_ratio": 0.3, "nasal_ratio": 0.2
                }
                
                # Get Whisper confidence for this word
                asr_idx = wr.get("asr_index", -1)
                confidence = whisper_word_ts[asr_idx]["prob"] if 0 <= asr_idx < len(whisper_word_ts) else 0.8
                
                # Pre-calculate debug metrics for EVERY word (tuning-friendly)
                wr["debug_metrics"] = {
                    "ratio": round(feat.get("duration", 0.0) / max(base_speed, 0.01), 2),
                    "rms": feat.get("rms_energy", 0.0),
                    "var_score": feat.get("variation_score", 0.0),
                    "low_freq_ratio": feat.get("low_freq_ratio", 0.0),
                    "nasal_ratio": feat.get("nasal_ratio", 0.0),
                    "confidence": confidence
                }

                issues = check_tajweed_rules(wr["expected"], feat, tajweed_map, base_speed, confidence, all_stats)
                all_tajweed_issues.extend(issues)
                wr["tajweed"] = issues
            else:
                wr["tajweed"] = []
                wr["debug_metrics"] = {}

        # Pauses
        pauses = []
        for i in range(len(word_segments) - 1):
            gap = word_segments[i+1]["start"] - word_segments[i]["end"]
            if gap > 0.3:
                pauses.append({"start": round(float(word_segments[i]["end"]), 2), "end": round(float(word_segments[i+1]["start"]), 2), "duration": round(float(gap), 2)})

        # ── 5. Scoring ──
        accuracy_score = comparison["accuracy"]
        
        # Stricter Accuracy: Lower score if Whisper is unconfident
        # Average probability of matched words
        matched_probs = [w["prob"] for w in whisper_word_ts if any(wr["asr_index"] == whisper_word_ts.index(w) for wr in comparison["word_results"] if wr["status"] in ("correct", "partial"))]
        avg_prob = np.mean(matched_probs) if matched_probs else 0.8
        
        # If Whisper is < 85% sure, we apply a sliding penalty to the accuracy
        if avg_prob < 0.85:
            penalty = (0.85 - avg_prob) * 50
            accuracy_score = max(0, accuracy_score - penalty)
            print(f"DEBUG: Applied Whisper low-confidence penalty: -{penalty:.1f} (Avg Prob: {avg_prob:.3f})")

        timing_score = compute_timing_score(total_duration, ref_duration)
        integrity_score = round(float(compute_tajweed_score(comparison["word_results"], accuracy_score)), 1)
        pronunciation_score = compute_pronunciation_score(comparison["word_results"], word_features, tajweed_map)

        final = compute_final_score(accuracy_score, timing_score, integrity_score, pronunciation_score)
        feedback = generate_feedback(comparison["word_results"], all_tajweed_issues)
        suggestions = generate_suggestions(accuracy_score, timing_score, pronunciation_score, all_tajweed_issues)

        return jsonify({
            "score": final["score"], "grade": final["grade"], "color": final["color"], "summary": final["summary"],
            "accuracy": round(float(accuracy_score), 1), 
            "timing": timing_score, 
            "integrity": integrity_score, 
            "pronunciation": pronunciation_score, 
            "tajweed": integrity_score, # For backward compat
            "word_feedback": comparison["word_results"], "word_segments": word_segments, "pauses": pauses,
            "raw_text": raw_text, "feedback": feedback, "suggestions": suggestions
        })
    except Exception as e:
        print(f"❌ Analysis error: {str(e)}", flush=True)
        return jsonify({"error": str(e)}), 500
    finally:
        if os.path.exists(tmp_path): os.unlink(tmp_path)
        if 'wav_path' in locals() and wav_path != tmp_path and os.path.exists(wav_path):
            os.unlink(wav_path)


# ── WORD LAB HYBRID (REMAINING ROUTES) ──
REFERENCE_CACHE = {}

def get_audio_from_url(url: str):
    if url in REFERENCE_CACHE: return REFERENCE_CACHE[url]
    try:
        r = requests.get(url, headers={'User-Agent': 'Mozilla/5.0'}, timeout=10)
        with tempfile.NamedTemporaryFile(suffix='.mp3', delete=False) as t1, tempfile.NamedTemporaryFile(suffix='.wav', delete=False) as t2:
            t1.write(r.content)
            subprocess.run([ffmpeg_path, '-y', '-i', t1.name, '-ar', '16000', '-ac', '1', t2.name], capture_output=True, check=True)
            import soundfile as sf
            a, s = sf.read(t2.name)
            REFERENCE_CACHE[url] = (a.astype(np.float32), s)
            return REFERENCE_CACHE[url]
    except: return None, None

@app.route('/api/analyze-reference', methods=['POST'])
def analyze_reference():
    """
    Lightweight endpoint to fetch reference audio duration via Mutagen.
    Does NOT require ffmpeg/decoding. Supports MP3 and MP4/WebM headers.
    """
    try:
        ref_url = request.json.get('reference_audio_url', '')
        if not ref_url:
            return jsonify({"duration": 0, "status": "no_url"}), 200

        if not ref_url.startswith('http'):
            ref_url = f"https://verses.quran.com/{ref_url}"

        # Fetch bytes via Requests (lightweight)
        r = requests.get(ref_url, timeout=10)
        r.raise_for_status()
        
        # Parse duration via Mutagen
        data_stream = BytesIO(r.content)
        try:
            audio = MP3(data_stream)
        except:
            try:
                data_stream.seek(0)
                audio = MP4(data_stream)
            except:
                print(f"⚠️ Mutagen could not identify format for {ref_url}")
                return jsonify({"duration": 0, "status": "unsupported_format"}), 200

        duration = float(audio.info.length)
        print(f"🕒 Mutagen Duration for {ref_url}: {duration:.2f}s")
        return jsonify({
            "duration": round(duration, 2),
            "status": "success"
        }), 200

    except Exception as e:
        print(f"⚠️ Mutagen error for {ref_url}: {e}")
        return jsonify({"duration": 0.0, "warning": str(e)}), 200
        print(f"❌ Error in analyze-reference: {e}")
        return jsonify({"duration": 0, "energy": 0, "error": str(e)}), 200

@app.route('/analyze-word-hybrid', methods=['POST'])
def analyze_word_hybrid():
    """
    Hybrid analysis endpoint for the Word Lab Trainer.
    Compares USER audio against MASTER REFERENCE audio using ratios.
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

    # 🛡️ Normalize Word Lab Lookup Key
    clean_exp_key = normalize_arabic(word_text)
    print(f"\n[WordLab] Word: '{word_text}' (normalized: '{clean_exp_key}')")
    print(f"[WordLab] Rules for word: {tajweed_map.get(clean_exp_key, [])}")

    user_file = request.files['audio']
    with tempfile.NamedTemporaryFile(suffix='.webm', delete=False) as tmp:
        user_file.save(tmp.name)
        user_path = tmp.name

    # OPTIMIZATION: Convert to WAV once and reuse
    user_wav = user_path + ".wav"
    try:
        subprocess.run([ffmpeg_path, '-y', '-i', user_path, '-ar', '16000', '-ac', '1', user_wav], 
                       capture_output=True, check=True, timeout=30)
    except Exception as e:
        print(f"❌ FFMPEG WordLab Pre-conversion error: {e}")
        user_wav = user_path

    try:
        # Load user audio
        user_audio, sr = load_audio(user_wav)
        
        # ── STEP 1: Transcription Validation (Safety Gate) ──
        # Run Whisper on the short clip (Using optimized WAV)
        segments, _ = model.transcribe(
                user_wav,
                beam_size=5, 
                language="ar",
                best_of=2,
                vad_filter=True,
                word_timestamps=True,
                temperature=0.0,
            )
        segments_list = list(segments)
        print(f"[WordLab] Whisper segments: {segments_list}")
        got_text = " ".join([s.text for s in segments_list]).strip()
        print(f"[WordLab] Whisper raw output: '{got_text}'")
        # Normalize and compare
        clean_got = normalize_arabic(got_text)
        clean_exp = normalize_arabic(word_text)
        
        # Use a slightly relaxed similarity for very short isolated words
        text_sim = levenshtein_similarity(clean_got, clean_exp)
        is_match = text_sim >= 0.55 or (clean_exp in clean_got and len(clean_got) < len(clean_exp) * 2)
        
        print(f"[WordLab] Whisper detected: '{got_text}' (similarity: {text_sim:.2f}, matched: {is_match})")
        
        # ── STEP 2: Feature Comparison (Hybrid Ratios) ──
        print(f"[WordLab] Fetching ref audio from: {ref_url}")
        ref_audio, ref_sr = get_audio_from_url(ref_url)
        if user_audio is None or ref_audio is None:
            print(f"❌ [WordLab] Audio loading failed. User={user_audio is not None}, Ref={ref_audio is not None}")
            return jsonify({"error": "Failed to load audio files (check internet connection for reference audio)"}), 500
        
        print(f"[WordLab] Audio loaded. User Audio Size={len(user_audio)}, Ref Audio Size={len(ref_audio)}")
            
        def get_single_word_features(audio, sr):
            segments = [{"start": 0, "end": len(audio)/sr}]
            feats = extract_word_features(audio, sr, segments)
            return feats[0] if feats else {}

        user_feat = get_single_word_features(user_audio, sr)
        ref_feat = get_single_word_features(ref_audio, ref_sr)
        print(f"[WordLab] Features computed. User dur={user_feat.get('duration', 0):.2f}, Ref dur={ref_feat.get('duration', 0):.2f}")
        user_dur, ref_dur = user_feat.get("duration", 0.0), ref_feat.get("duration", 0.0)
        user_var, ref_var = user_feat.get("variation_score", 0.0), ref_feat.get("variation_score", 0.0)

        # ── STEP 3: Unified Tajweed Coaching ──
        word_rules = tajweed_map.get(clean_exp, [])
        ref_weight = get_tajweed_weight(clean_exp, tajweed_map) # Using clean_exp for consistent weight lookup
        base_speed = ref_dur / max(ref_weight, 1.0)
        ref_stats = {
            "avg_rms": ref_feat.get("rms_energy", 0.02),
            "avg_var": ref_feat.get("variation_score", 0.3),
            "avg_low_freq": ref_feat.get("low_freq_ratio", 0.3)
        }
        print(f"[WordLab] Tajweed stats ready. Rules={word_rules}, Base Speed={base_speed:.2f}")
        whisper_confidence = 0.8
        if segments_list and segments_list[0].words:
            whisper_confidence = np.mean([w.probability for w in segments_list[0].words])

        issues = check_tajweed_rules(word_text, user_feat, tajweed_map, base_speed, whisper_confidence, ref_stats)

        # Initialize as None so they don't show in UI if not applicable
        madd_status, ghunnah_status, heavy_status, qalqalah_status = None, None, None, None
        madd_msg = ""
        
        # Determine which rules *should* be present so we can show "Passed" (ok)
        for r in word_rules:
            if r.startswith("madd"): madd_status, madd_msg = "ok", "Good elongation"
            elif r == "ghunnah": ghunnah_status = "ok"
            elif r == "heavy": heavy_status = "Good emphasis"
            elif r == "qalqalah": qalqalah_status = "ok"

        # Override with issues if found
        for issue in issues:
            st = issue["status"]
            if issue["rule"].startswith("madd"):
                madd_status, madd_msg = st, issue["message"]
            elif issue["rule"] == "ghunnah": ghunnah_status = st
            elif issue["rule"] == "heavy": heavy_status = "Good emphasis" if st == "ok" else "Too soft"
            elif issue["rule"] == "qalqalah": qalqalah_status = st

        # Rules already handled by check_tajweed_rules loop above

        # ── STEP 4: Scoring ──
        # Blend: Text match (40%) + Timing (40%) + Pronunciation/Energy (20%)
        text_score = text_sim * 100
        timing_score = compute_timing_score(user_dur, ref_dur)
        # Pronunciation uses variation ratio relative to master
        pron_val = (user_var / max(ref_var, 0.001))
        pron_score = max(0, min(100, 100 - abs(pron_val - 1.0) * 40))
        
        if not is_match:
            final_score = text_score * 0.8
        else:
            final_score = (text_score * 0.4) + (timing_score * 0.4) + (pron_score * 0.2)
        
        # Final Safety Check
        confidence_label = "high"
        if user_feat.get("rms_energy", 0) < 0.001:
            confidence_label = "low"
            madd_msg = "Audio too quiet to analyze accurately."

        print(f"[WordLab] FINAL SCORE: {final_score:.1f} (Match: {is_match})")
        
        return jsonify({
            "score": round(final_score, 1),
            "ratio": round(user_dur / max(ref_dur, 0.01), 2),
            "got_text": got_text,
            "text_match": is_match,
            "user_duration": round(user_dur, 2),
            "ref_duration": round(ref_dur, 2),
            "madd_status": madd_status,
            "madd_message": madd_msg,
            "ghunnah_status": ghunnah_status,
            "heavy_status": heavy_status,
            "qalqalah_status": qalqalah_status,
            "confidence": confidence_label,
            "word": word_text,
            "rules": word_rules,
            "debug_metrics": {
                "user": user_feat,
                "ref": ref_feat
            }
        })
    except Exception as e:
        print(f"❌ Word hybrid error: {e}")
        return jsonify({"error": str(e)}), 500
    finally:
        if os.path.exists(user_path):
            os.unlink(user_path)
        if 'user_wav' in locals() and user_wav != user_path and os.path.exists(user_wav):
            os.unlink(user_wav)


if __name__ == '__main__':
    print("🎤 Qari AI ASR Service v4.0 (Enhanced Analysis)")
    print("=" * 40)
    print("Starting on http://localhost:5001")
    app.run(host='0.0.0.0', port=5001, debug=False)
