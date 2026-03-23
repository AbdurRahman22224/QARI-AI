"""
Qari AI — Arabic Speech-to-Text Analysis Service
Uses faster-whisper for transcription and provides Quran recitation scoring.
"""

import os
import sys

# Fix OpenMP threading crash on Windows
os.environ['KMP_DUPLICATE_LIB_OK'] = 'TRUE'
os.environ['OMP_NUM_THREADS'] = '1'
import json
import tempfile
from flask import Flask, request, jsonify
from flask_cors import CORS

from normalize_arabic import normalize_arabic

# ── Model Loading ──
print("⏳ Loading Whisper model (medium)... This may take a moment on first run.")
from faster_whisper import WhisperModel
# Using 'small' — switch to 'medium' for better accuracy when network allows download
model = WhisperModel("small", device="cpu", compute_type="int8")
print("✅ Whisper medium model loaded successfully!")


# ── Text Comparison Engine ──

def levenshtein_similarity(s1: str, s2: str) -> float:
    """Calculate similarity ratio between two strings using Levenshtein distance."""
    try:
        import Levenshtein
        distance = Levenshtein.distance(s1, s2)
        max_len = max(len(s1), len(s2), 1)
        return 1.0 - (distance / max_len)
    except ImportError:
        # Fallback: simple character-level comparison
        matches = sum(1 for a, b in zip(s1, s2) if a == b)
        return matches / max(len(s1), len(s2), 1)


def compare_texts(asr_text: str, expected_text: str, partial_threshold: float = 0.70):
    """
    Compare ASR output with expected Quran text.
    
    Steps:
    - Normalize both texts
    - Split into words
    - Match words (exact + partial via Levenshtein)
    - Calculate accuracy
    
    Returns dict with accuracy, matched/missing/incorrect words.
    """
    norm_asr = normalize_arabic(asr_text)
    norm_expected = normalize_arabic(expected_text)
    
    asr_words = norm_asr.split()
    expected_words = norm_expected.split()
    
    if not expected_words:
        return {
            "accuracy": 0,
            "matched_words": [],
            "missing_words": [],
            "incorrect_words": [],
            "partial_matches": [],
            "normalized_asr": norm_asr,
            "normalized_expected": norm_expected,
        }
    
    matched = []
    partial_matches = []
    incorrect = []
    used_asr_indices = set()
    
    for exp_word in expected_words:
        best_match = None
        best_sim = 0.0
        best_idx = -1
        
        for i, asr_word in enumerate(asr_words):
            if i in used_asr_indices:
                continue
            
            # Exact match
            if asr_word == exp_word:
                best_match = asr_word
                best_sim = 1.0
                best_idx = i
                break
            
            # Partial match
            sim = levenshtein_similarity(asr_word, exp_word)
            if sim > best_sim:
                best_sim = sim
                best_match = asr_word
                best_idx = i
        
        if best_sim >= 1.0:
            matched.append(exp_word)
            used_asr_indices.add(best_idx)
        elif best_sim >= partial_threshold:
            partial_matches.append({
                "expected": exp_word,
                "got": best_match,
                "similarity": round(best_sim * 100, 1)
            })
            used_asr_indices.add(best_idx)
        else:
            incorrect.append({
                "expected": exp_word,
                "got": best_match if best_match else "(missing)",
                "similarity": round(best_sim * 100, 1)
            })
    
    # Words in ASR output not matched to any expected word
    missing_from_expected = [
        expected_words[i] for i in range(len(expected_words)) 
        if expected_words[i] not in matched and 
           not any(p["expected"] == expected_words[i] for p in partial_matches) and
           not any(inc["expected"] == expected_words[i] for inc in incorrect)
    ]
    
    # Score: exact matches count 1.0, partial matches count 0.7
    total = len(expected_words)
    score = (len(matched) + len(partial_matches) * 0.7) / total * 100
    
    return {
        "accuracy": round(score, 1),
        "matched_words": matched,
        "partial_matches": partial_matches,
        "incorrect_words": incorrect,
        "missing_words": missing_from_expected,
        "normalized_asr": norm_asr,
        "normalized_expected": norm_expected,
        "word_count_asr": len(asr_words),
        "word_count_expected": len(expected_words),
    }


def make_decision(accuracy: float) -> dict:
    """Decision layer: determine if recitation is acceptable."""
    if accuracy >= 80:
        return {
            "status": "excellent",
            "message": "Excellent recitation! MashaAllah! 🌟",
            "color": "green"
        }
    elif accuracy >= 60:
        return {
            "status": "good",
            "message": "Good attempt! A few words need correction. Keep practicing! 💪",
            "color": "blue"
        }
    elif accuracy >= 40:
        return {
            "status": "needs_work",
            "message": "Some words were unclear. Listen to the reference again and try once more.",
            "color": "amber"
        }
    else:
        return {
            "status": "retry",
            "message": "Audio not clear enough. Please recite more clearly and try again.",
            "color": "red"
        }


# ── Flask App ──

app = Flask(__name__)
CORS(app)


@app.route('/health', methods=['GET'])
def health():
    """Health check endpoint."""
    return jsonify({
        "status": "ok",
        "service": "Qari AI ASR",
        "model": "whisper-small"
    })


@app.route('/analyze', methods=['POST'])
def analyze():
    """
    Main analysis endpoint.
    
    Expects:
    - audio file (multipart form upload)
    - expected_text (form field): The expected Arabic text of the Ayah
    
    Returns:
    - JSON with transcription, comparison, accuracy, and decision
    """
    # Validate inputs
    if 'audio' not in request.files:
        return jsonify({"error": "No audio file provided"}), 400
    
    expected_text = request.form.get('expected_text', '')
    if not expected_text:
        return jsonify({"error": "No expected_text provided"}), 400
    
    audio_file = request.files['audio']
    
    # Save audio to temp file
    with tempfile.NamedTemporaryFile(suffix='.webm', delete=False) as tmp:
        audio_file.save(tmp.name)
        tmp_path = tmp.name
    
    try:
        # Step 1-2: Transcribe with Whisper
        segments, info = model.transcribe(
            tmp_path,
            language="ar",
            beam_size=5,
            best_of=5,
            vad_filter=True,
        )
        
        # Collect transcription
        raw_text = ""
        segment_details = []
        total_confidence = 0.0
        segment_count = 0
        
        for segment in segments:
            raw_text += segment.text + " "
            segment_details.append({
                "start": round(segment.start, 2),
                "end": round(segment.end, 2),
                "text": segment.text.strip(),
                "avg_logprob": round(segment.avg_logprob, 3) if segment.avg_logprob else None,
            })
            if segment.avg_logprob:
                total_confidence += segment.avg_logprob
                segment_count += 1
        
        raw_text = raw_text.strip()
        avg_confidence = round(total_confidence / max(segment_count, 1), 3)
        
        # Step 3: Normalize
        normalized_text = normalize_arabic(raw_text)
        
        # Step 4-6: Compare with expected
        comparison = compare_texts(raw_text, expected_text)
        
        # Step 9: Decision
        decision = make_decision(comparison["accuracy"])
        
        # Step 7: Structured debug output
        result = {
            "raw_text": raw_text,
            "normalized_text": normalized_text,
            "expected_text": expected_text,
            "detected_language": info.language,
            "language_probability": round(info.language_probability, 3),
            "avg_confidence": avg_confidence,
            "accuracy": comparison["accuracy"],
            "matched_words": comparison["matched_words"],
            "partial_matches": comparison["partial_matches"],
            "incorrect_words": comparison["incorrect_words"],
            "missing_words": comparison["missing_words"],
            "word_count_asr": comparison["word_count_asr"],
            "word_count_expected": comparison["word_count_expected"],
            "decision": decision,
            "segments": segment_details,
        }
        
        print(f"\n📊 Analysis Result:")
        print(f"   Raw:      {raw_text}")
        print(f"   Expected: {expected_text}")
        print(f"   Accuracy: {comparison['accuracy']}%")
        print(f"   Decision: {decision['status']}")
        
        return jsonify(result)
        
    except Exception as e:
        print(f"❌ Analysis error: {str(e)}", file=sys.stderr)
        import traceback
        traceback.print_exc()
        return jsonify({"error": f"Analysis failed: {str(e)}"}), 500
    finally:
        # Cleanup temp file
        try:
            os.unlink(tmp_path)
        except:
            pass


if __name__ == '__main__':
    print("🎤 Qari AI ASR Service")
    print("=" * 40)
    print("Model will load on first request...")
    print("Starting on http://localhost:5001")
    app.run(host='0.0.0.0', port=5001, debug=False)
