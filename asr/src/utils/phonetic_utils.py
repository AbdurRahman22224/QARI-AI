"""
Phonetic Utilities for Quranic ASR.
Transforms Uthmani text into probable "Phonetic Variants" to allow the ASR 
to correctly align recitations that apply Tajweed rules (skipping/merging).
"""

import re
from src.utils.normalize_arabic import normalize_arabic, remove_tashkeel

# Constants for Tajweed Rules
IDGHAM_LETTERS = set('يرملون')
IQLAB_LETTER = 'ب'
SOLAR_LETTERS = set('تثدذرزسشصضطظلن')

def get_recitation_variants(word: str, next_word: str = None) -> list:
    """
    Generates a list of phonetic variations for a given word.
    Each variant is a dict: {"text": "...", "rule": "...", "is_phonetic": bool}
    """
    if not word: return []
    
    # 0. Base Normalized (Literal)
    literal = normalize_arabic(word)
    variants = [{"text": literal, "rule": None, "is_phonetic": False}]
    
    # Pre-clean for pattern matching
    clean_word = remove_tashkeel(word)
    clean_next = remove_tashkeel(next_word) if next_word else ""
    
    # --- 1. Al-Wassla (Joining Alif) ---
    # Patterns like ٱل... -> often recited as just l... or starting with a vowel
    if word.startswith('ٱ'):
        variants.append({
            "text": literal[1:] if len(literal) > 1 else literal,
            "rule": "wassla",
            "is_phonetic": True
        })

    # --- 2. Solar Lam (Ash-Shamsiyah) ---
    # Pattern: ال... followed by a solar letter
    if clean_word.startswith('ال') and len(clean_word) > 2:
        third_letter = clean_word[2]
        if third_letter in SOLAR_LETTERS:
            # Phonetic: Remove the 'L' (e.g. Al-Shams -> A-Shams)
            # In normalized form "alshms" -> "ashms"
            variants.append({
                "text": literal[0] + literal[2:] if len(literal) > 2 else literal,
                "rule": "solar_lam",
                "is_phonetic": True
            })

    # --- 3. Idgham (Merging Nun/Tanween) ---
    # Rule: Nun Sakinah or Tanween followed by Yarmalun
    if clean_next and clean_next[0] in IDGHAM_LETTERS:
        # Check if word ends with Nun or Tanween (ن, ً, ٍ, ٌ)
        # We check the original word for Tanween marks
        ends_with_nun = clean_word.endswith('ن')
        has_tanween = any(mark in word for mark in ['ً', 'ٍ', 'ٌ'])
        
        if ends_with_nun or has_tanween:
            # Phonetic: Remove the 'n' sound at the end
            # For "man" -> "ma", For "Sami'un" -> "Sami'u"
            phonetic_text = literal[:-1] if len(literal) > 1 else literal
            variants.append({
                "text": phonetic_text,
                "rule": "idgham",
                "is_phonetic": True
            })

    # --- 4. Iqlab (Nun/Tanween to Meem) ---
    if clean_next and clean_next[0] == IQLAB_LETTER:
        ends_with_nun = clean_word.endswith('ن')
        has_tanween = any(mark in word for mark in ['ً', 'ٍ', 'ٌ'])
        
        if ends_with_nun or has_tanween:
            # Phonetic: 'n' -> 'm'
            phonetic_text = (literal[:-1] + 'م') if len(literal) > 0 else 'م'
            variants.append({
                "text": phonetic_text,
                "rule": "iqlab",
                "is_phonetic": True
            })

    # --- 5. Silent Alif (Alif al-Tafriq) ---
    # Pattern: ا with a small round zero \u06DF
    if '\u06DF' in word:
        # Most common is at the end of plural verbs like قَالُوا۟
        # The Alif is written but silent.
        # We create a version where all characters with \u06DF are removed
        # (This is rare but good for completeness)
        parts = []
        for i, char in enumerate(word):
            if i + 1 < len(word) and word[i+1] == '\u06DF':
                continue # Skip the silent letter
            if char != '\u06DF':
                parts.append(char)
        
        variants.append({
            "text": normalize_arabic("".join(parts)),
            "rule": "silent_letter",
            "is_phonetic": True
        })

    # Remove duplicates and return
    seen = set()
    unique_variants = []
    for v in variants:
        if v["text"] not in seen:
            unique_variants.append(v)
            seen.add(v["text"])
            
    return unique_variants
