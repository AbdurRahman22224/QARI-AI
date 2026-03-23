"""
Arabic Text Normalization for Quran Recitation Comparison.
Handles tashkeel removal, letter normalization, and text cleaning.
"""

import re
import unicodedata

# Arabic diacritics (tashkeel) Unicode ranges
TASHKEEL = re.compile(r'[\u0617-\u061A\u064B-\u0652\u0656-\u065F\u0670]')

# Tatweel (kashida) - decorative elongation
TATWEEL = '\u0640'

# Normalization maps
ALEF_VARIANTS = {
    '\u0623': '\u0627',  # أ → ا
    '\u0625': '\u0627',  # إ → ا
    '\u0622': '\u0627',  # آ → ا
    '\u0671': '\u0627',  # ٱ → ا (alef wasla)
}

TAA_MARBUTA = '\u0629'   # ة
HAA = '\u0647'            # ه

ALEF_MAQSURA = '\u0649'  # ى
YAA = '\u064A'            # ي


def remove_tashkeel(text: str) -> str:
    """Remove all Arabic diacritical marks (tashkeel)."""
    return TASHKEEL.sub('', text)


def remove_tatweel(text: str) -> str:
    """Remove tatweel (kashida) elongation character."""
    return text.replace(TATWEEL, '')


def normalize_alef(text: str) -> str:
    """Normalize all alef variants to plain alef (ا)."""
    for variant, replacement in ALEF_VARIANTS.items():
        text = text.replace(variant, replacement)
    return text


def normalize_taa_marbuta(text: str) -> str:
    """Normalize taa marbuta (ة) to haa (ه)."""
    return text.replace(TAA_MARBUTA, HAA)


def normalize_alef_maqsura(text: str) -> str:
    """Normalize alef maqsura (ى) to yaa (ي)."""
    return text.replace(ALEF_MAQSURA, YAA)


def clean_whitespace(text: str) -> str:
    """Collapse multiple spaces and strip."""
    return re.sub(r'\s+', ' ', text).strip()


def normalize_arabic(text: str) -> str:
    """
    Full Arabic text normalization pipeline.
    
    Steps:
    1. Remove tashkeel (diacritics)
    2. Remove tatweel (kashida)
    3. Normalize alef variants
    4. Normalize taa marbuta
    5. Normalize alef maqsura
    6. Clean whitespace
    
    Example:
        بِسْمِ ٱللَّهِ ٱلرَّحْمَـٰنِ ٱلرَّحِيمِ → بسم الله الرحمن الرحيم
    """
    text = remove_tashkeel(text)
    text = remove_tatweel(text)
    text = normalize_alef(text)
    text = normalize_taa_marbuta(text)
    text = normalize_alef_maqsura(text)
    text = clean_whitespace(text)
    return text


if __name__ == '__main__':
    # Quick self-test
    samples = [
        "بِسْمِ ٱللَّهِ ٱلرَّحْمَـٰنِ ٱلرَّحِيمِ",
        "ٱلْحَمْدُ لِلَّهِ رَبِّ ٱلْعَـٰلَمِينَ",
        "ٱلرَّحْمَـٰنِ ٱلرَّحِيمِ",
        "الضَّالِّينَ",
    ]
    for s in samples:
        print(f"Original:   {s}")
        print(f"Normalized: {normalize_arabic(s)}")
        print()
