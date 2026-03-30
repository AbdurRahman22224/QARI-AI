# Tajweed Colors & Practice Scoring Pipeline - Complete Reference

## Part 1: Tajweed Colors & Definitions

### 1.1 QURANIC API TAJWEED RULES (From Quran.com API)

These are **direct from the API** with `class` attributes in HTML:

| # | Rule Name | Hex Color | RGB | Category | API Class Names | Description |
|---|-----------|-----------|-----|----------|-----------------|-------------|
| 1 | **Silent Letter** | #9E9E9E | Gray | Silent | `silent`, `ham_wasl`, `slnt` | Hamza wasl, letters not pronounced |
| 2 | **Normal Madd (2 beats)** | #F48FB1 | Light Pink | Madd | `madd_2`, `madd` (default) | Standard elongation on 2 vowel beats |
| 3 | **Separated Madd (2/4/6)** | #FF9800 | Orange | Madd | `madd_munfasil`, `munfasil`, `monfasel` | Madd when hamza not adjacent in same word |
| 4 | **Connected Madd (4/5)** | #F06292 | Dark Pink | Madd | `madd_mottasel`, `muttasil`, `madd_c` | Madd when hamza adjacent in same word |
| 5 | **Necessary Madd (6 beats)** | #D32F2F | Dark Red | Madd | `madd_6`, `madd_lazim`, `madda_obligatory`, `lazim`, `obligatory` | Obligatory 6-beat elongation |
| 6 | **Ghunnah** | #4CAF50 | Green | Nasal | `ghunnah`, `ikhfa`, `idgham`, `iqlab` (partly) | Nasal resonance on noon/meem |
| 7 | **Qalqala (Echo)** | #00BCD4 | Cyan | Echo | `qalqalah`, `qalaqah` | Bouncing/echoing sound on ق ط ب ج د |
| 8 | **Tafkhim (Heavy)** | #5C6BC0 | Indigo | Heavy | `heavy`, `tafkhim` | Heavy/dark pronunciation on emphatic letters |

### 1.2 EXTENDED/CUSTOM TAJWEED RULES (Not in Core API)

These are **manually added** or from extended Quran.com legend:

| # | Rule Name | Hex Color | RGB | Category | Classification | Description |
|---|-----------|-----------|-----|----------|-----------------|-------------|
| 9 | **Idgham** | #388E3C | Medium-Dark Green | Assimilation | API Extended | Merging of similar letters |
| 10 | **Iqlab** | #FDB927 | Yellow | Substitution | API Extended | A becomes M before B (noon→meem) |
| 11 | **Lam Shamsiyah** | #2196F3 | Bright Blue | Article | API Extended | "Al" sun letter (assimilated laam) |
| 12 | **Lam Qamariyah** | #3F51B5 | Purple | Article | API Extended | "Al" moon letter (pronounced laam) |

### 1.3 MANUAL TAFKHIM (Computed, Not API)

These are **calculated in code** based on vowel patterns and letter properties:

| Rule | Letters | Hex Color | Condition |
|------|---------|-----------|-----------|
| **Emphatic Letters (Tafkhim)** | خ ص ض ط ظ غ ق | #5C6BC0 | Always heavy when followed by Fatha/Damma |
| **Ra' (ر) Tafkhim** | ر RI ري | #5C6BC0 | Heavy when after Fatha/Damma OR before Fatha/Damma |
| **Alef Variations** | ء ة ا | #5C6BC0 | Heavy based on context vowels |

---

## Part 2: ruleToStyle Implementation

### 2.1 Complete Color Mapping Object

```javascript
const ruleToStyle = {
  // SILENT/WASL
  'silent': 'color: #9E9E9E; font-weight: 600;',
  'ham_wasl': 'color: #9E9E9E; font-weight: 600;',
  'slnt': 'color: #9E9E9E; font-weight: 600;',
  
  // MADD VARIANTS
  'madd_2': 'color: #F48FB1; font-weight: 600;',              // Light Pink - Normal
  'madd_s': 'color: #FF9800; font-weight: 600;',              // Orange - Separated
  'madd_c': 'color: #F06292; font-weight: 600;',              // Dark Pink - Connected
  'madd_6': 'color: #D32F2F; font-weight: 600;',              // Red - Necessary (6 beats)
  'madda_lazim': 'color: #D32F2F; font-weight: 600;',         // Red - Obligatory variant
  'madd_lazim': 'color: #D32F2F; font-weight: 600;',          // Red - Lazim variant
  'madda_obligatory': 'color: #D32F2F; font-weight: 600;',    // Red - Obligatory variant
  'madda_obligatory_mottasel': 'color: #D32F2F; font-weight: 600;',    // Red - Connected obligatory
  'madda_obligatory_monfasel': 'color: #FF9800; font-weight: 600;',    // Orange - Separated obligatory
  'madd_mottasel': 'color: #D32F2F; font-weight: 600;',       // Red - Connected variant
  'madd_munfasil': 'color: #FF9800; font-weight: 600;',       // Orange - Separated variant
  
  // GHUNNAH & ASSIMILATION
  'ghunnah': 'color: #4CAF50; font-weight: 600;',             // Green
  'idgham_ghunnah': 'color: #4CAF50; font-weight: 600;',      // Green - Idgham with ghunnah
  'idgham_bila_ghunnah': 'color: #4CAF50; font-weight: 600;', // Green - Idgham without ghunnah
  'iqlab': 'color: #FDB927; font-weight: 600;',               // Yellow - Substitution
  
  // ECHO
  'qalqalah': 'color: #00BCD4; font-weight: 600;',            // Cyan
  
  // HEAVY/TAFKHIM
  'heavy': 'color: #5C6BC0; font-weight: 600;',               // Indigo
  
  // ARTICLE LAM
  'laam_shamsiyah': 'color: #2196F3; font-weight: 600;',      // Bright Blue - Sun
  'laam_qamariyah': 'color: #3F51B5; font-weight: 600;',      // Purple - Moon
};
```

### 2.2 Style Resolution Logic (getStyleFromClasses)

```javascript
const getStyleFromClasses = (classString) => {
  if (!classString) return null;
  const classes = classString.toLowerCase().split(/\s+/);
  
  // STEP 1: Direct matching (exact class name match)
  for (const cls of classes) {
    if (ruleToStyle[cls]) return ruleToStyle[cls];
  }
  
  // STEP 2: Madd variants fallback (handles variations without madd_ prefix)
  if (classes.some(c => 
    c.includes('madd') || c.includes('lazim') || c.includes('obligatory') || 
    c.includes('munfasil') || c.includes('monfasel') || 
    c.includes('mottasel') || c.includes('muttasil')
  )) {
    if (classes.some(c => c.includes('lazim') || c.includes('6') || c.includes('obligatory'))) 
      return ruleToStyle['madd_6'];    // Red for necessary
    if (classes.some(c => c.includes('mottasel') || c.includes('muttasil'))) 
      return ruleToStyle['madd_c'];    // Dark Pink for connected
    if (classes.some(c => c.includes('monfasel') || c.includes('munfasil'))) 
      return ruleToStyle['madd_s'];    // Orange for separated
    return ruleToStyle['madd_2'];      // Light Pink default
  }
  
  // STEP 3: Other rules fallback
  if (classes.some(c => c.includes('ghunnah') || c.includes('ikhfa') || c.includes('idgham'))) 
    return ruleToStyle['ghunnah'];     // Green
  if (classes.some(c => c.includes('qalqala'))) 
    return ruleToStyle['qalqalah'];    // Cyan
  if (classes.some(c => c.includes('heavy') || c.includes('tafkhim'))) 
    return ruleToStyle['heavy'];       // Indigo
  if (classes.some(c => c.includes('slnt') || c.includes('silent') || c.includes('wasl'))) 
    return ruleToStyle['silent'];      // Gray
  
  return null;
};
```

---

## Part 3: Practice Scoring Pipeline

### 3.1 Audio Analysis Flow Architecture

```
User Records Audio
         ↓
[Frontend] Encode as WAV Blob
         ↓
Send to Backend /api/analyze
         ↓
[Backend] Forward to ASR Service with:
  - audio blob
  - expected_text (the ayah from Quran.com)
  - word_list (array of words)
  - tajweed_map (map of word → tajweed rules)
         ↓
[ASR Service - Python/Flask]
  ├─ STEP 1: Transcribe with Whisper
  │   └─ Returns: raw_text, word timestamps
  │
  ├─ STEP 2: Load Audio Features
  │   └─ Computes: RMS energy, duration, silence detection
  │
  ├─ STEP 3: Word Comparison (Greedy Alignment)
  │   └─ Compares ASR words vs expected words
  │   └─ Returns: word_feedback array with status
  │
  ├─ STEP 4: Feature Extraction
  │   └─ Energy per word, duration ratios, tajweed timing
  │
  ├─ STEP 5: Scoring (3 components)
  │   ├─ accuracy_score (50% weight)
  │   ├─ timing_score (30% weight)
  │   └─ pronunciation_score (20% weight)
  │
  └─ STEP 6: Generate Result JSON
         ↓
[Frontend] Receive & Display Results
```

### 3.2 Accuracy Scoring (Component 1)

**Formula:**
```
accuracy = (correct_words + partial_words * 0.7) / total_words * 100
```

**Word Status Values:**
- `"correct"` → ASR word matches exactly (1.0 similarity) → +100%
- `"partial"` → ASR word similar but not exact (≥70% Levenshtein similarity) → +70%
- `"incorrect"` → ASR word low similarity (30-70% similarity) → +0% (counted as error)
- `"missing"` → Expected word not detected in ASR output (<30% similarity) → +0%

**Example:**
```
Expected: ["الحمد", "لله", "رب", "العالمين"]  (4 words)
ASR Got:  ["الحمد", "لله", "رب"]              (3 words)

Results:
- "الحمد" → exact match → correct
- "لله" → exact match → correct
- "رب" → exact match → correct
- "العالمين" → missing

accuracy = (3 + 0 * 0.7) / 4 * 100 = 75%
```

### 3.3 Timing Scoring (Component 2 - Tajweed Weighted)

**Process:**
1. Expected duration = reference audio for the ayah
2. For each word, apply tajweed weight multiplier:
   - **Silent/Wasl** → 1.0x (normal)
   - **Normal Madd** → 1.2x (needs extra time)
   - **Separated Madd** → 1.3-1.5x (longer pause)
   - **Connected Madd** → 1.4-1.6x (extra connected duration)
   - **Necessary Madd (6 beats)** → 2.0x (full 6 beats)
   - **Ghunnah** → 1.1x (slight nasal extend)
   - **Qalqala** → 1.15x (bounce adds time)
   - **Tafkhim** → 1.05x (slight heavy pronunciation time)

**Scoring:**
```
timing_score = 100 - abs(actual_duration - expected_weighted_duration) / expected_duration * 100
```

**Penalties:**
- Too fast → penalize (user not giving proper tajweed time)
- Too slow → smaller penalty (better to be slow than rush)
- Speech gaps/pauses → penalize if excessive

### 3.4 Pronunciation Scoring (Component 3)

**Factors:**
1. **Energy Levels (RMS):** Is audio loud enough?
   - Very quiet (<20% RMS) → -20 points
   - Quiet (20-65% RMS) → -10 points
   - Normal (65-80% RMS) → 0 points
   - Loud (>80% RMS) → 0 points (acceptable)

2. **Word Status Influence:**
   - For `"partial"` + quiet → -20 points (hard to hear partial words when quiet)
   - For `"missing"` + low energy → -15 points

3. **Tajweed Compliance:**
   - Ghunnah present in word but energy dips → -5 points
   - Heavy letters should have sustained energy → -10 if drops too quickly
   - Qalqala words need energy spike → -8 if flat energy

**Final pronunciation_score:**
```
Base = 100
Subtract energy penalties
Subtract word status penalties
Subtract tajweed compliance penalties
Result ∈ [0, 100]
```

### 3.5 Final Combined Score

**Weighting:**
```
final_score = (accuracy_score × 0.5) + (timing_score × 0.3) + (pronunciation_score × 0.2)
```

**Grade Mapping:**
- 90-100: **Excellent** (Green) 🟢
- 80-89: **Good** (Green) 🟢
- 70-79: **Decent** (Blue) 🔵
- 60-69: **Fair** (Amber) 🟡
- 50-59: **Weak** (Amber) 🟡
- 0-49: **Retry** (Red) 🔴

**Hallucination Detection:**
```
if (accuracy > 95 AND pronunciation < 40) {
  // Whisper detected silence but high confidence
  // Penalize to indicate unreliable
  final_score = min(final_score, 55)
  grade = "Weak"
  message = "Audio unclear or too quiet"
}
```

---

## Part 4: Word Lab Feature (Advanced)

### 4.1 Word-Level Analysis

**Endpoint:** `POST /api/analyze-word-hybrid`

**Input:**
```json
{
  "audio": "blob (recorded word)",
  "reference_audio_url": "CDN URL for word",
  "word_text": "الحمد",
  "tajweed_map": { "الحمد": ["ghunnah", "heavy"] }
}
```

**Output:**
```json
{
  "score": 85,
  "grade": "Good",
  "text_match": true,
  "user_duration": "0.8s",
  "ref_duration": "0.9s",
  "ratio_result": "Good",
  "madd_status": "ok",
  "ghunnah_status": "ok",
  "heavy_status": "warning",
  "qalqalah_status": null,
  "suggestion": "Heavy letter needs more emphasis"
}
```

### 4.2 Metrics Checked per Word

| Metric | What's Checked | Scoring |
|--------|-----------------|---------|
| **Text Match** | Does pronunciation match the word? | 0-100% |
| **Duration Ratio** | Is duration close to reference? | Good/Warning/Bad |
| **Madd Check** | If word has madd, is it extended? | ok/warning/fail |
| **Ghunnah Presence** | If word needs nasal sound, present? | ok/warning/fail |
| **Tafkhim (Heavy)** | If word needs heavy sound, present? | ok/warning/fail |
| **Qalqala Bounce** | If word has qalqala, bounce sound? | ok/warning/fail (if applicable) |

---

## Part 5: Waveform Display Integration

### 5.1 Audio Visualization

**Uses:** WaveSurfer.js library

**Components:**
```
┌─────────────────────────────────────┐
│     Ayah Audio Waveform             │
├─────────────────────────────────────┤
│  [⏮] [▶/⏸] [⏭] ───●──────── 2:15  │  ← Reference audio
├─────────────────────────────────────┤
│     Your Recording Waveform         │
├─────────────────────────────────────┤
│  [⏮] [▶/⏸] [⏭] ───●────  1:98  │  ← User's audio
├─────────────────────────────────────┤
│  Word Markers: [الحمد] [لله] [رب]   │
└─────────────────────────────────────┘
```

**Features:**
- Displays both reference and user recording
- Shows word boundaries from ASR word_timestamps
- Highlights mismatched words in red
- Displays tajweed color-coded word labels

### 5.2 Word Feedback Display

**After analysis completes:**

```
Word-by-Word Breakdown:
┌────────────────────────────────┐
│ الحمد  ✓ Correct (96%)          │  Green
│ لله   ⚠ Partial (84%)           │  Yellow
│ رب   ✓ Correct (100%)           │  Green
│ العالمين ✗ Missing             │  Red
└────────────────────────────────┘

Feedback per word:
- Energy level
- Tajweed compliance
- Duration vs expected
```

---

## Part 6: Re-Implementation Checklist

### Priority 1: Core Tajweed Colors
- [ ] Update `ruleToStyle` object with all 22 rules
- [ ] Ensure hex colors exactly match legend
- [ ] Test each color on actual Quranic text

### Priority 2: Style Resolution
- [ ] Implement `getStyleFromClasses` with correct fallback order
- [ ] Test with API class variations (munfasil vs madd_munfasil)
- [ ] Verify orange madd appears correctly

### Priority 3: Scoring Pipeline
- [ ] Verify accuracy calculation (correct/partial/missing logic)
- [ ] Verify timing score with tajweed weights
- [ ] Verify pronunciation score energy penalties

### Priority 4: Frontend Display
- [ ] Ensure colors render correctly on Arabic text
- [ ] Display word feedback with correct colors
- [ ] Integrate WaveSurfer for waveform visualization

### Priority 5: Word Lab
- [ ] Test word-level analysis endpoint
- [ ] Verify metric calculations (madd, ghunnah, heavy, qalqala)
- [ ] Display results correctly in modal

---

## Part 7: Quick Reference - Color Chart

```
MAIN RULES (From Quran API):
┌─────────────────────────────────────┐
│ ● Silent          #9E9E9E (Gray)    │
│ ● Normal Madd     #F48FB1 (Pink)    │
│ ● Sep. Madd       #FF9800 (Orange)  │
│ ● Con. Madd       #F06292 (DarkPink)│
│ ● Nec. Madd       #D32F2F (Red)     │
│ ● Ghunnah         #4CAF50 (Green)   │
│ ● Qalqala         #00BCD4 (Cyan)    │
│ ● Tafkhim         #5C6BC0 (Indigo)  │
└─────────────────────────────────────┘

EXTENDED RULES:
┌─────────────────────────────────────┐
│ ● Idgham          #0e1d4e (DkGreen) │
│ ● Iqlab           #FDB927 (Yellow)  │
│ ● Lam Shamsiyah   #2196F3 (LtBlue)  │
│ ● Lam Qamariyah   #3F51B5 (Purple)  │
└─────────────────────────────────────┘
```

