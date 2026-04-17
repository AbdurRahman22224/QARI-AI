"""
Tajweed Analysis Pipeline Orchestrator.
Handles: Preprocessing → Parallel ASR + Feature Extraction → Alignment → Scoring → Response.
"""
import os
import concurrent.futures
import json
import random
import numpy as np

# Load our local modules
from src.utils.normalize_arabic import normalize_arabic
from src.utils.audio_features import load_and_preprocess_audio, extract_frame_features, get_segment_features
from src.utils.tajweed_evaluator import compute_madd_score, compute_ghunnah_score, compute_qalqalah_score, compute_tafkhim_score


def levenshtein_similarity(s1: str, s2: str) -> float:
    try:
        import Levenshtein
        distance = Levenshtein.distance(s1, s2)
        max_len = max(len(s1), len(s2), 1)
        return 1.0 - (distance / max_len)
    except ImportError:
        matches = sum(1 for a, b in zip(s1, s2) if a == b)
        return matches / max(len(s1), len(s2), 1)


def compare_words(asr_words: list, asr_word_timings: list, expected_words: list):
    """
    Greedy word alignment with index locking. Maps ASR words back to EXPECTED words.
    Returns list of mapped info including the raw audio timing segment for that word.
    """
    if not expected_words:
        return {"accuracy": 0, "word_results": []}

    word_results = []
    used_asr_indices = set()
    valid_expected = [w for w in expected_words if w and w.strip()]
    
    for exp_idx, exp_word in enumerate(valid_expected):
        norm_exp = normalize_arabic(exp_word)
        best_match, best_sim, best_idx = None, 0.0, -1

        for i, asr_word in enumerate(asr_words):
            if i in used_asr_indices: continue
            sim = levenshtein_similarity(asr_word, norm_exp)
            if sim > best_sim:
                best_sim, best_match, best_idx = sim, asr_word, i

        # Link to Whisper Timestamp segment
        word_timing = {"start": 0.0, "end": 0.0, "tokens": [], "prob": 0.0}
        if best_idx != -1 and best_idx < len(asr_word_timings):
            word_timing = asr_word_timings[best_idx]
            used_asr_indices.add(best_idx)
            
        prob = word_timing.get("prob", 1.0)
        print(f"      [Alignment] '{exp_word}' match: sim={best_sim*100:.1f}%, prob={prob:.3f}", flush=True)

        # Strict thresholds for Ayahs, highly forgiving thresholds for isolated Word Lab words
        if len(valid_expected) == 1:
            # 🚨 Autocorrect Detection (Option 3)
            if prob < 0.12 and best_sim > 0:
                print(f"      [Phonetic Reject] Autocorrect detected! Whisper forced '{best_match}' but confidence is {prob:.3f}", flush=True)
                status = "missing"
                is_phonetic_error = True
            else:
                status = "correct" if best_sim >= 0.75 else ("partial" if best_sim >= 0.40 else "missing")
                is_phonetic_error = False
        else:
            # 🕋 Stricter Ayah Evaluation (The Qari Standard)
            status = "correct" if best_sim >= 0.90 else ("partial" if best_sim >= 0.60 else "missing")
            is_phonetic_error = False

        word_results.append({
            "expected": exp_word,
            "got": best_match if best_match else "",
            "status": status,
            "similarity": round(best_sim * 100, 1),
            "timing": word_timing,
            "phonetic_error": is_phonetic_error
        })
        
        print(f"  └─ Word {exp_idx}: '{exp_word}' → '{best_match or '?'}' = {status.upper()} ({round(best_sim*100,1)}%)", flush=True)

    correct = sum(1 for w in word_results if w["status"] == "correct")
    partial = sum(1 for w in word_results if w["status"] == "partial")
    
    # ⚖️ Punishment for non-perfection: Partial words only give 35% accuracy credit
    accuracy = (correct + partial * 0.35) / max(len(valid_expected), 1) * 100

    return {"accuracy": round(accuracy, 1), "word_results": word_results}


def estimate_vowel_duration(word: str, rule: str, timing_info: dict) -> float:
    """
    Hybrid Madd Logic: estimate vowel segment duration from tokens or character ratios.
    """
    tokens = timing_info.get("tokens", [])
    if not tokens:
        vowels = ['ا', 'و', 'ي', 'ى', 'ā', 'ī', 'ū']
        vowel_count = sum(1 for char in word if char in vowels)
        char_duration = (timing_info.get("end", 0.0) - timing_info.get("start", 0.0)) / max(len(word), 1)
        return max(char_duration * (vowel_count if vowel_count > 0 else 1.5), 0.01)

    vowel_duration = 0.0
    for tok in tokens:
        tok_text = tok.get("text", "")
        if any(v in tok_text for v in ['ا', 'و', 'ي', 'ى']):
            vowel_duration += (tok.get("end", 0.0) - tok.get("start", 0.0))
            
    if vowel_duration <= 0.01:
        vowel_duration = (timing_info.get("end", 0.0) - timing_info.get("start", 0.0)) / max(len(tokens), 1.5)
        
    return vowel_duration
def process_audio_pipeline(wav_path, expected_word_list, tajweed_map, ref_duration, word_durations=None, asr_model=None, strict_pace: bool = False):
    """
    Executes the Parallel Architecture Pipeline for hybrid Tajweed analysis.
    """
    if word_durations is None: word_durations = {}

    print(f"\n{'='*60}", flush=True)
    print(f"🔬 PIPELINE START", flush=True)
    print(f"   Expected words: {expected_word_list}", flush=True)
    print(f"   Tajweed map: {tajweed_map}", flush=True)
    print(f"   Ref duration: {ref_duration}s", flush=True)
    print    # 1. Preprocessing (for feature extraction only)
    print("\n   [Step 1] Preprocessing audio...", flush=True)
    audio, sr, trim_offset = load_and_preprocess_audio(wav_path)
    
    total_trimmed_duration = len(audio) / sr
    if total_trimmed_duration <= 0.0:
        raise ValueError("Audio is empty or too short after silence trimming.")
    print(f"   ✅ Preprocessing done: {total_trimmed_duration:.2f}s audio", flush=True)
        
    # 2. Parallel Module Execution
    print("   [Step 2] Parallel ASR + Features...", flush=True)
    with concurrent.futures.ThreadPoolExecutor(max_workers=2) as executor:
        # Thread A: Feature extraction frames (uses preprocessed numpy)
        future_features = executor.submit(extract_frame_features, audio, sr)
        
        # Thread B: ASR Transcription
        def run_asr():
            if asr_model is None:
                raise RuntimeError("ASR model not loaded — cannot transcribe.")
            
            prompt_text = expected_word_list[0] if len(expected_word_list) == 1 else "آيات القرآن الكريم"
            print(f"      - ASR: Transcribing with prompt '{prompt_text[:30]}...'", flush=True)
            
            segments_gen, info = asr_model.transcribe(
                wav_path, language="ar", word_timestamps=True, 
                beam_size=5, vad_filter=True, temperature=0.0,
                initial_prompt= prompt_text
            )
            
            w_words = []
            for segment in segments_gen:
                if segment.words:
                    for w in segment.words:
                        w_words.append({
                            "word": w.word.strip(),
                            "start": w.start,
                            "end": w.end,
                            "prob": w.probability
                        })
            print(f"      - ASR: Internal transcribe complete ({len(w_words)} words)", flush=True)
            return w_words
            
        future_asr = executor.submit(run_asr)
        
        global_frames = future_features.result()
        print("      - Features: Extraction complete", flush=True)
        asr_result_words = future_asr.result()
        print("      - ASR: Result ready", flush=True)

    print(f"   ✅ Parallel execution done", flush=True)

    # Flatten faster_whisper segments into a word list with timings
    asr_words = []
    asr_timings = []
    for w in asr_result_words:
        asr_words.append(normalize_arabic(w.get("word", "")))
        asr_timings.append({
            "start": w.get("start", 0.0),
            "end": w.get("end", 0.0),
            "prob": w.get("prob", 0.0),
            "tokens": []
        })

    # 3. Alignment Layer
    print("   [Step 3] Word alignment...", flush=True)
    comparison = compare_words(asr_words, asr_timings, expected_word_list)
    accuracy_score = comparison["accuracy"]
    print(f"   ✅ Alignment done (Accuracy: {accuracy_score}%)", flush=True)
    
    # 4 & 5 & 6. Validation and Scoring
    print("   [Step 4] Tajweed rule evaluation...", flush=True)
    print("📊 Step 4: Tajweed rule evaluation...", flush=True)
    
    # Compute REAL reference baseline from the user's own recording (global average)
    # This ensures relative comparison works regardless of mic/environment
    all_rms = global_frames.get("rms", [])
    all_centroid = global_frames.get("centroid", [])
    all_low = global_frames.get("low_ratio", [])
    all_nasal = global_frames.get("nasal_ratio", [])
    
    ref_global = {
        "rms_mean": float(np.mean(all_rms)) if all_rms else 0.02,
        "centroid_mean": float(np.mean(all_centroid)) if all_centroid else 1200,
        "low_ratio_mean": float(np.mean(all_low)) if all_low else 0.4,
        "nasal_ratio_mean": float(np.mean(all_nasal)) if all_nasal else 0.25
    }
    print(f"   Reference baseline: rms={ref_global['rms_mean']:.4f}, centroid={ref_global['centroid_mean']:.0f}, low={ref_global['low_ratio_mean']:.3f}, nasal={ref_global['nasal_ratio_mean']:.3f}", flush=True)
    
    # Rule display names for proper pedagogical feedback
    RULE_NAMES = {
        "heavy": "Tafkheem (تفخيم — Heavy Letter)",
        "qalqalah": "Qalqalah (قلقلة — Bouncing Sound)",
        "ghunnah": "Ghunnah (غنّة — Nasal Sound)",
        "madd_2": "Madd Tabee'ee (مدّ طبيعي — Natural Elongation, 2 counts)",
        "madd_s": "Madd as-Sukun (مدّ السكون — Elongation, 4-5 counts)",
        "madd_c": "Madd al-Muttasil (مدّ متصل — Connected Elongation, 4-5 counts)",
        "madd_6": "Madd Laazim (مدّ لازم — Required Elongation, 6 counts)",
        "madd": "Madd (مدّ — Elongation)"
    }
    
    # Simplified descriptions for user-facing feedback (no Arabic names)
    RULE_DESCRIPTIONS = {
        "heavy": "Heavy Letter",
        "qalqalah": "Bouncing Sound",
        "ghunnah": "Nasal Sound",
        "madd_2": "Elongation, 2 counts",
        "madd_s": "Elongation, 4-5 counts",
        "madd_c": "Elongation, 4-5 counts",
        "madd_6": "Elongation, 6 counts",
        "madd": "Elongation"
    }
    
    word_feedbacks = []
    total_tajweed_score = 0.0
    rules_evaluated_count = 0
    
    # Pre-calculate reference word duration for pace-aware Madd rules
    avg_ref_word_dur = ref_duration / max(len(expected_word_list), 1) if ref_duration > 0 else 0
    ratio = total_trimmed_duration / max(ref_duration, 0.01)
    
    for wr in comparison["word_results"]:
        exp_word = wr["expected"]
        norm_exp = normalize_arabic(exp_word)
        # Try both original and normalized keys for tajweed map lookup
        rules = tajweed_map.get(norm_exp, tajweed_map.get(exp_word, []))
        wr["tajweed"] = []
        wr["tajweed_scores"] = {}
        
        if wr["status"] == "missing" or not rules:
            word_feedbacks.append(wr)
            continue
            
        timing = wr["timing"]
        start_t = timing.get("start", 0.0)
        end_t = timing.get("end", 0.0)
        if strict_pace:
            # 🚨 [Word Lab Isolation Exception]
            # Whisper often truncates extremely long vowels (like 6-count Madds) because conversational 
            # speech never elongates that much. Since Word Lab only tests one word, we know the 
            # entire pure trimmed audio IS the word. We bypass Whisper's timestamps entirely.
            dur = total_trimmed_duration
            feat_start = 0.0
            feat_end = total_trimmed_duration
        else:
            dur = end_t - start_t
            # Adjust ASR timestamps to feature frame space (features are from trimmed audio)
            feat_start = max(0.0, start_t - trim_offset)
            feat_end = max(feat_start + 0.01, end_t - trim_offset)
            
            # 🔥 [Smart Tail Recovery]
            # If this is the last word and it has a Madd rule, Whisper often cuts off the 
            # final long vowel early because it assumes conversation has ended. 
            # We check the "gap" after Whisper's end for significant vocal energy (~Madd).
            is_last_word = (wr == comparison["word_results"][-1])
            madd_rules = [r for r in rules if "madd" in r]
            
            if is_last_word and madd_rules and dur > 0:
                tail_start = feat_end
                tail_end = total_trimmed_duration
                tail_dur = tail_end - tail_start
                
                if tail_dur > 0.15: # Minimum gap worth recovering
                    tail_feats = get_segment_features(global_frames, tail_start, tail_end)
                    # Recovery Threshold: If the tail has at least 25% of global avg energy
                    # it is almost certainly a continued vowel, not background silence.
                    if tail_feats.get("rms_mean", 0) > (ref_global["rms_mean"] * 0.25):
                        print(f"      [Tail Recovery] Final Madd detected! Extending '{exp_word}' by {tail_dur:.3f}s", flush=True)
                        dur += tail_dur
                        feat_end = tail_end
        
        if dur <= 0:
            word_feedbacks.append(wr)
            continue
            
        # Get frame-mapped audio characteristics for this specific word
        word_feats = get_segment_features(global_frames, feat_start, feat_end)
        wr["word_dur"] = round(dur, 3)
        print(f"   📝 '{exp_word}': rules={rules}, dur={dur:.3f}s, rms={word_feats.get('rms_mean',0):.4f}, centroid={word_feats.get('centroid_mean',0):.0f}", flush=True)
        
        # 🕒 Word Anchor Logic: Determine the specific reference duration for this word
        # Quran API segments are often word-position based (1-indexed)
        # We try to find the anchor duration for this word's position
        word_pos = str(comparison["word_results"].index(wr) + 1)
        anchor_dur = word_durations.get(word_pos, word_durations.get(int(word_pos), avg_ref_word_dur))
        
        # 🔧 MULTIPLE MADD RESOLUTION: Only use the strongest (highest count) Madd rule
        # When a word has multiple madd rules (e.g., ['madd_2', 'madd_s']), 
        # In Tajweed, the stronger madd supersedes the weaker one.
        # We score only against the highest count to avoid impossible duration stacking.
        madd_rules = [r for r in rules if "madd" in r]
        detected_madd_rules = madd_rules.copy()  # 🔧 OPTION 2: Store for comparison
        
        if len(madd_rules) > 1:
            # Map rule to count: madd_2→2, madd_s→4, madd_c→4, madd_6→6, madd→2
            madd_counts = {}
            for mr in madd_rules:
                if "6" in mr:
                    madd_counts[mr] = 6
                elif mr in ["madd_s", "madd_c"]:
                    madd_counts[mr] = 4
                else:
                    madd_counts[mr] = 2
            
            # Keep only the highest count madd, drop others
            max_count = max(madd_counts.values())
            strongest_madd = [r for r in madd_rules if madd_counts[r] == max_count][0]
            rules = [r for r in rules if r not in madd_rules] + [strongest_madd]
            print(f"      [Madd Resolution] Multiple madds detected: {madd_rules} → Using strongest: {strongest_madd} ({max_count} counts)", flush=True)
        
        # In Word Lab (strict_pace), the global 'ratio' includes room silence.
        # Instead, we use the pure word's boundaries to calculate the true localized pace.
        word_pace = dur / max(anchor_dur, 0.01) if strict_pace else ratio

        for rule in rules:
            score = 1.0
            rule_name = RULE_NAMES.get(rule, rule.capitalize())
            
            if "madd" in rule:
                # Pass both the user's word duration AND the master's word duration (anchor)
                exp_counts = 6 if "6" in rule else (4 if rule in ["madd_s", "madd_c"] else 2)
                
                score = compute_madd_score(dur, anchor_dur, expected_harakah=exp_counts, user_pace=word_pace, master_harakah=exp_counts, strict_pace=strict_pace)
                print(f"         madd: actual={dur:.3f}s (AnchorDur={anchor_dur:.3f}s, counts={exp_counts}, pace={word_pace:.2f})", flush=True)

                if strict_pace and word_pace < 0.75:
                    print(f"         [Pace Alert] Rushing detected (pace={word_pace:.2f} < 0.75)", flush=True)
                    wr["pace_alert"] = "rushing"
                elif strict_pace and word_pace > 1.35:
                    print(f"         [Pace Alert] Dragging detected (pace={word_pace:.2f} > 1.35)", flush=True)
                    wr["pace_alert"] = "dragging"
                
                # 🔧 OPTION 2: If multiple madds were detected, show which one matches better
                if len(detected_madd_rules) > 1:
                    print(f"         [Option 2] Scoring against all detected madds:", flush=True)
                    madd_comparison = {}
                    for alt_rule in detected_madd_rules:
                        alt_counts = 6 if "6" in alt_rule else (4 if alt_rule in ["madd_s", "madd_c"] else 2)
                        alt_score = compute_madd_score(dur, anchor_dur, expected_harakah=alt_counts, user_pace=word_pace, master_harakah=exp_counts)
                        madd_comparison[alt_rule] = alt_score
                        print(f"            {alt_rule} ({alt_counts}-count): score={alt_score:.2f}", flush=True)
                    
                    # Find which madd this user's performance best matches
                    best_match_rule = max(madd_comparison, key=madd_comparison.get)
                    best_match_score = madd_comparison[best_match_rule]
                    
                    if best_match_rule != rule:
                        print(f"         [Insight] User's performance matches {best_match_rule} better than {rule}", flush=True)
                        # Store this insight for later feedback
                        wr["madd_match_insight"] = best_match_rule
                
            elif rule == "heavy":
                score = compute_tafkhim_score(word_feats, ref_global)
                u_c = word_feats.get("centroid_mean", 0)
                r_c = ref_global.get("centroid_mean", 0)
                u_l = word_feats.get("low_ratio_mean", 0)
                r_l = ref_global.get("low_ratio_mean", 0)
                print(f"         heavy: Centroid={u_c:.0f} (UserAvg={r_c:.0f}), LowRatio={u_l:.3f} (UserAvg={r_l:.3f})", flush=True)
                
            elif rule == "qalqalah":
                score = compute_qalqalah_score(word_feats, ref_global)
                u_p = max(word_feats.get("rms_frames", [0]))
                u_m = word_feats.get("rms_mean", 0)
                print(f"         qalqalah: PeakEnergy={u_p:.4f}, MeanEnergy={u_m:.4f}", flush=True)
                
            elif rule == "ghunnah":
                score = compute_ghunnah_score(word_feats, ref_global)
                u_n = word_feats.get("nasal_ratio_mean", 0)
                r_n = ref_global.get("nasal_ratio_mean", 0)
                print(f"         ghunnah: NasalRatio={u_n:.3f} (UserAvg={r_n:.3f})", flush=True)
                
            print(f"      → {rule}: score={score:.2f}", flush=True)
            
            wr["tajweed_scores"][rule] = score
            
            # Generate user-friendly feedback with simple format: "Word" (Description): Action
            rule_desc = RULE_DESCRIPTIONS.get(rule, rule.capitalize())
            
            if score >= 0.8:
                wr["tajweed"].append({
                    "rule": rule, "score": score, "severity": "ok",
                    "message": f"✅ \"{exp_word}\" ({rule_desc}): Good!"
                })
            elif score >= 0.6:
                # Simple action messages - just focus on the action, not the rule
                insight = ""
                if "madd" in rule:
                    best_match = wr.get("madd_match_insight")
                    if best_match and best_match != rule:
                        counts_map = {"madd_2": "2-count", "madd": "2-count", "madd_s": "4-count", "madd_c": "4-count", "madd_6": "6-count"}
                        got_counts = counts_map.get(best_match, "different")
                        exp_counts = counts_map.get(rule, "required")
                        insight = f" (Matches a {got_counts} Madd better)"
                    
                    # Dynamically check if over-elongated or under-elongated
                    expected_dur = anchor_dur * ratio
                    if dur > expected_dur * 1.25:
                        action = f"Too long (hold it shorter){insight}"
                    else:
                        action = f"Too short (hold it longer){insight}"
                elif rule == "heavy":
                    action = "Pronounce with more fullness from the throat"
                elif rule == "qalqalah":
                    action = "Add a small bounce when stopping"
                elif rule == "ghunnah":
                    action = "Hold the nasal hum longer"
                else:
                    action = "Slight adjustment needed"
                
                msg = f"\"{exp_word}\" ({rule_desc}): {action}"
                wr["tajweed"].append({"rule": rule, "score": score, "severity": "warning", "message": msg})
            else:
                # Needs work messages
                insight = ""
                if "madd" in rule:
                    best_match = wr.get("madd_match_insight")
                    is_too_long = dur > (anchor_dur * ratio * 1.25)
                    
                    if best_match and best_match != rule:
                        # Map rule name to human readable count for the message
                        counts_map = {"madd_2": "2-count", "madd": "2-count", "madd_s": "4-count", "madd_c": "4-count", "madd_6": "6-count"}
                        got_counts = counts_map.get(best_match, "different")
                        exp_counts = counts_map.get(rule, "required")
                        
                        if is_too_long:
                            insight = f" (Matched a {got_counts} Madd better; try shortening it to {exp_counts})"
                            action = "Significantly over-elongated (Too long)"
                        else:
                            insight = f" (Matched a {got_counts} Madd better; try holding it longer for {exp_counts})"
                            action = "Needs more elongation (Too short)"
                    else:
                        action = "Significantly over-elongated (Too long)" if is_too_long else "Needs more elongation (Too short)"
                elif rule == "heavy":
                    action = "Should be thick and full"
                elif rule == "qalqalah":
                    action = "Needs a clear bouncing stop"
                elif rule == "ghunnah":
                    action = "Missing the nasal hum"
                else:
                    action = "Needs more practice"
                
                msg = f"❌ \"{exp_word}\" ({rule_desc}): {action}{insight}"
                wr["tajweed"].append({"rule": rule, "score": score, "severity": "warning", "message": msg})
                
                
            total_tajweed_score += score
            rules_evaluated_count += 1
            
        word_feedbacks.append(wr)
    
    # ── Final Scoring ──
    print("🏆 Step 5: Final scoring...", flush=True)
        
    # [DEBUG] Time Audit Logic
    sum_word_durs = sum(w.get("word_dur", 0) for w in word_feedbacks)
    pause_time = max(0, total_trimmed_duration - sum_word_durs)
    print(f"      [Time Audit] Total Recorded (Trimmed): {total_trimmed_duration:.3f}s", flush=True)
    print(f"      [Time Audit] Sum of Word Durations:    {sum_word_durs:.3f}s", flush=True)
    print(f"      [Time Audit] Pauses / Non-word audio:  {pause_time:.3f}s", flush=True)

    
    # Timing score based on duration ratio (already calculated above)

    if ref_duration > 0.0:
        timing_score = max(0, 100 - abs(1.0 - ratio) * 100)
    else:
        timing_score = min(max(accuracy_score, 50), 100)
    
    # Tajweed percentage
    if rules_evaluated_count > 0:
        tajweed_percentage = (total_tajweed_score / rules_evaluated_count) * 100
    else:
        tajweed_percentage = accuracy_score

    # Blended final score: Accuracy 40%, Timing 20%, Tajweed 40%
    def compute_final_score(a, t, j):
    # weighted base
        base = 0.4*a + 0.2*t + 0.4*j

        # soft penalty (only if below 80)
        penalty = sum(max(0, 80 - x) * 0.4 for x in [a, t, j])

        final = base - penalty
        return round(max(0, min(100, final)), 1)
    
    final_score = compute_final_score(accuracy_score, timing_score, tajweed_percentage)
    
    # 🚨 Pace Enforcement Cap (Word Lab Strict Mode)
    # If the student rushes or drags beyond the speed limit, cap their max score to 79.0 ('Decent').
    # This prevents an 'Excellent' or 'Good' score for speed-reading or excessive dragging.
    if strict_pace:
        if ratio < 0.75 or ratio > 1.35:
            final_score = min(final_score, 79.0)

    print(f"   Accuracy: {accuracy_score}", flush=True)
    print(f"   Timing: {timing_score:.1f} (ratio: {ratio:.2f})", flush=True)
    print(f"   Tajweed: {tajweed_percentage:.1f} ({rules_evaluated_count} rules)", flush=True)
    print(f"   FINAL: {final_score}", flush=True)
        
    # Grade mappings
    if final_score >= 90:
        grade, color = "Excellent", "green"
        summary = "Excellent recitation! MashaAllah! 🌟"
    elif final_score >= 80:
        grade, color = "Good", "green"
        summary = "Good recitation. Minor improvements possible."
    elif final_score >= 70:
        grade, color = "Decent", "blue"
        summary = "Decent attempt. Focus on the highlighted rules."
    elif final_score >= 60:
        grade, color = "Fair", "amber"
        summary = "Fair recitation. Practice the highlighted words."
    elif final_score >= 50:
        grade, color = "Weak", "amber"
        summary = "Needs improvement. Listen carefully and try again."
    else:
        grade, color = "Retry", "red"
        summary = "Audio unclear or too many errors. Please recite more clearly."
        
    # Generate legacy feedback list
    feedback = []
    for wr in word_feedbacks:
        if wr["status"] == "missing" or wr["status"] == "incorrect":
            feedback.append({"type": "error", "icon": "❌", "message": f"\"{wr['expected']}\" is incorrect.", "word": wr["expected"]})
        elif wr["status"] == "partial":
            COACHING_TEMPLATES = [
                f"Almost! Check the pronunciation of \"{wr['expected']}\".",
                f"Close! \"{wr['expected']}\" needs a bit more clarity.",
                f"Getting there! Just polish your \"{wr['expected']}\" sounds.",
                f"Good try! Minor pronunciation slip on \"{wr['expected']}\".",
                f"Keep at it! Focus on the articulation of \"{wr['expected']}\"."
            ]
            msg = random.choice(COACHING_TEMPLATES)
            feedback.append({"type": "info", "icon": "💡", "message": msg, "word": wr["expected"]})
        
        for issue in wr.get("tajweed", []):
            if issue.get("severity") == "warning":
                feedback.append({"type": "warning", "icon": "⚠️", "message": issue["message"], "rule": issue["rule"]})

    suggestions = []
    if accuracy_score < 70: suggestions.append("Listen to the reference recitation carefully, then try reciting word by word.")
    if timing_score < 70: suggestions.append("Try reciting slower — focus on matching the master's deliberate pace.")
    
    result = {
        "score": round(final_score, 1),
        "grade": grade,
        "color": color,
        "summary": summary,
        "accuracy": round(accuracy_score, 1),
        "timing": round(timing_score, 1),
        "integrity": round(tajweed_percentage, 1),
        "pronunciation": round(tajweed_percentage, 1),
        "tajweed": round(tajweed_percentage, 1),
        "word_feedback": word_feedbacks,
        "word_segments": [{"start": wr.get("timing", {}).get("start",0), "end": wr.get("timing", {}).get("end",0)} for wr in word_feedbacks],
        "pauses": [],
        "raw_text": " ".join([w for w in asr_words]),
        "feedback": feedback,
        "suggestions": suggestions,
        "duration_seconds": round(total_trimmed_duration, 3) if 'total_trimmed_duration' in locals() else 0.0
    }
    
    print(f"✅ PIPELINE COMPLETE → score={final_score}, grade={grade}", flush=True)
    print(f"{'='*60}\n", flush=True)
    
    return result
