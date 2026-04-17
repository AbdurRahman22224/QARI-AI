"""
Tajweed Rule Evaluation Engine.
Uses relative scoring against the user's own global audio baseline.
Each rule checks if specific words have expected acoustic properties
relative to the rest of the recitation.

DESIGN PHILOSOPHY: Be generous. We are detecting Tajweed from compressed
browser audio with estimated timings — false negatives are much worse
than false positives for a learning tool. A student who recites properly
should ALWAYS see green, not red.
"""
import numpy as np


def compute_tafkhim_score(user_features: dict, ref_features: dict) -> float:
    """
    Tafkhim (Heavy Letter / تفخيم) validation.
    Heavy letters should have:
      - LOWER spectral centroid than average (darker sound)
      - HIGHER low-frequency energy ratio than average (fuller bass)
    
    Since we compare word features vs the user's own global average,
    even a small difference in the expected direction is a pass.
    """
    c_user = user_features.get("centroid_mean", 1000)
    c_ref = ref_features.get("centroid_mean", 1000)
    
    l_user = user_features.get("low_ratio_mean", 0.5)
    l_ref = ref_features.get("low_ratio_mean", 0.5)
    
    # Heavy letter centroid should be ≤ global average
    c_ratio = c_user / max(c_ref, 1.0)
    # Heavy letter low-freq should be ≥ global average
    l_ratio = l_user / max(l_ref, 0.01)
    
    # Very generous scoring:
    # If centroid is at or below average → full marks for centroid component
    # If centroid is up to 35% above average → still acceptable (microphone variance)
    if c_ratio <= 1.0:
        centroid_score = 1.0
    elif c_ratio <= 1.35:
        centroid_score = 0.9
    else:
        centroid_score = max(0.6, 1.0 / c_ratio)
    
    # If low-freq ratio is at or above average → full marks
    if l_ratio >= 1.0:
        low_freq_score = 1.0
    elif l_ratio >= 0.7:
        low_freq_score = 0.9
    else:
        low_freq_score = max(0.6, l_ratio)
    
    score = 0.5 * centroid_score + 0.5 * low_freq_score
    return round(float(max(0.0, min(1.0, score))), 2)


def compute_qalqalah_score(user_features: dict, ref_features: dict) -> float:
    """
    Qalqalah (قلقلة) — generous burst detection.
    As long as the word has reasonable energy and some variation, it passes.
    Qalqalah is very subtle in compressed audio; we bias toward passing.
    """
    rms_frames = user_features.get("rms_frames", [])
    duration = user_features.get("duration", 0.5)
    rms_mean = user_features.get("rms_mean", 0.0)
    
    if not rms_frames or len(rms_frames) < 2:
        return 0.7  # Not enough data — benefit of doubt
    
    # If the word has any reasonable energy, it's probably fine
    if rms_mean > 0.01:
        # Word was clearly spoken → start at 0.7 and add bonuses
        score = 0.7
        
        peak = max(rms_frames)
        mean_energy = sum(rms_frames) / len(rms_frames)
        
        # Bonus for having a peak (even a small one)
        if peak > mean_energy * 1.1:
            score += 0.15
        
        # Bonus for any energy variation at all
        if len(set([round(r, 4) for r in rms_frames])) > 1:
            score += 0.15
            
        return round(min(1.0, score), 2)
    else:
        return 0.5  # Very quiet — moderate score


def compute_ghunnah_score(user_features: dict, ref_features: dict) -> float:
    """
    Ghunnah (غنّة) — generous nasal resonance check.
    Since the nasal band (150-600Hz) overlaps heavily with normal speech,
    any word with reasonable energy in that band passes.
    """
    n_user = user_features.get("nasal_ratio_mean", 0.2)
    n_ref = ref_features.get("nasal_ratio_mean", 0.2)
    rms_mean = user_features.get("rms_mean", 0.0)
    
    # If the word has good overall energy, it likely includes ghunnah
    if rms_mean > 0.01:
        n_ratio = n_user / max(n_ref, 0.01)
        
        # Very generous: anything ≥ 70% of global nasal ratio is fine
        if n_ratio >= 0.7:
            return 1.0
        elif n_ratio >= 0.5:
            return 0.85
        else:
            return max(0.6, n_ratio + 0.4)  # Floor at 0.6
    else:
        return 0.6  # Quiet word — moderate score

    
def compute_madd_score(user_word_duration: float, ref_word_duration: float, expected_harakah: int = 2, user_pace: float = 1.0, master_harakah: int = None, strict_pace: bool = False) -> float:
    """
    Madd (مدّ) elongation scoring. 
    
    Instead of hardcoded durations, we compare the user's word duration against the 
    expected word duration (master's word duration scaled by the user's overall pace).
    
    If we are testing against an alternative rule (e.g. testing if the user did a 2-count
    madd on a word where the master did a 4-count), we scale the expected duration by
    assuming the madd takes ~45% of the reference word.
    """
    if user_word_duration <= 0.05:
        return 0.5  # Silent or too short
        
    master_h = master_harakah if master_harakah is not None else expected_harakah

    # If no reference, fall back to safe defaults
    if ref_word_duration <= 0:
        expected_duration = (0.5 if expected_harakah <= 2 else 0.8) * user_pace
    else:
        # We assume the master's duration perfectly embodies the master_harakah.
        # non_madd part = 55%, madd part = 45%
        madd_portion = ref_word_duration * 0.45
        non_madd_portion = ref_word_duration * 0.55
        
        # Scale the madd portion from master_h to expected_harakah
        scaled_madd = madd_portion * (expected_harakah / max(master_h, 1))
        
        # Expected duration is (non-madd + scaled madd) * user's overall pace
        expected_duration = (non_madd_portion + scaled_madd) * user_pace

    # We determine how far off the user is from the expected word duration
    ratio = user_word_duration / expected_duration

    # --- Step: Pace Penalty (Word Lab / Strict Mode) ---
    # Only enforced if strict_pace is True. Prevents perfect scores for speed-reading.
    pace_penalty = 1.0
    if strict_pace:
        if user_pace < 0.75:
            # Linear penalty for rushing: 0.75 -> 1.0, 0.5 -> 0.7
            pace_penalty = max(0.6, 1.0 - (0.75 - user_pace) * 1.5)
        elif user_pace > 1.35:
            # Linear penalty for dragging: 1.35 -> 1.0, 1.6 -> 0.7
            pace_penalty = max(0.6, 1.0 - (user_pace - 1.35) * 1.2)

    # Initial score based on proportion ratio (Revised: more generous)
    if 0.80 <= ratio <= 1.25:
        score = 1.0
    elif 0.65 <= ratio < 0.80:
        score = 0.85 # Slightly short
    elif 1.25 < ratio <= 1.40:
        score = 0.85 # Slightly over-elongated
    elif 0.50 <= ratio < 0.65:
        score = 0.7  # Noticeably rushed
    elif 1.40 < ratio <= 1.60:
        score = 0.7  # Noticeably too long
    elif ratio < 0.50:
        score = 0.6  # Very short
    else:
        score = 0.6  # Very long

    # Final score combines proportion match with pace quality
    return float(round(score * pace_penalty, 2))

