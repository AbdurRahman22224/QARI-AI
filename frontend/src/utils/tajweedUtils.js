/**
 * tajweedUtils.js
 * A high-integrity utility for Quranic Tajweed rendering.
 * Implements a Char-Style Linear Pipeline for perfect shaping and rule alignment.
 * Strictly API-driven with CSS class-based styling.
 */

const ARABIC_VOWELS = {
  FATHA: '\u064E',
  DAMMA: '\u064F',
  KASRA: '\u0650',
  SUKOON: '\u0652',
  SHADDA: '\u0651',
  DAGGER_ALIF: '\u0670',
};

export const TAJWEED_CLASS_MAP = {
  // Silent / Wasl
  'silent': 'taj-silent',
  'ham_wasl': 'taj-silent',
  'slnt': 'taj-silent',
  'wasl': 'taj-silent',
  'ham_wasla': 'taj-silent',

  // Normal Madd (2)
  'madd_2': 'taj-madd-2',
  'madd': 'taj-madd-2',
  'madda_short': 'taj-madd-2',

  // Separated Madd
  'madd_munfasil': 'taj-madd-munfasil',
  'munfasil': 'taj-madd-munfasil',
  'monfasel': 'taj-madd-munfasil',
  'madda_permissible': 'taj-madd-munfasil',

  // Connected Madd
  'madd_mottasel': 'taj-madd-mottasel',
  'muttasil': 'taj-madd-mottasel',
  'madd_c': 'taj-madd-mottasel',
  'madda_obligatory': 'taj-madd-mottasel',

  // Necessary Madd (6)
  'madd_6': 'taj-madd-lazim',
  'madd_lazim': 'taj-madd-lazim',
  'madda_necessary': 'taj-madd-lazim',
  'madda_longer': 'taj-madd-lazim',
  'lazim': 'taj-madd-lazim',
  'obligatory': 'taj-madd-lazim',

  // Nasal / Ghunnah
  'ghunnah': 'taj-ghunna',
  'ghunna': 'taj-ghunna',
  'ikhfa': 'taj-ghunna',
  'ikhafa': 'taj-ghunna',
  'idgham': 'taj-ghunna',
  'idgham_wo_ghunnah': 'taj-idgham',
  'idgham_no_ghunnah': 'taj-idgham',
  'iqlab': 'taj-iqlab',

  // Qalqala
  'qalqalah': 'taj-qalqalah',
  'qalaqah': 'taj-qalqalah',

  // Heavy / Tafkhim
  'heavy': 'taj-tafkhim',
  'tafkhim': 'taj-tafkhim',

  // Articles (Solar/Lunar) - Exact API Spellings
  'lam_shamsiyyah': 'taj-lam-shamsiyyah',
  'laam_shamsiyah': 'taj-lam-shamsiyyah',
  'lam_qamariyyah': 'taj-lam-qamariyyah',
  'laam_qamariyah': 'taj-lam-qamariyyah',

  // Madd Mapping - Synchronized with index.css
  'madda_normal': 'taj-madd',
  'madda_permissible': 'taj-madd-4',
  'madda_obligatory': 'taj-madd-5',
  'madda_necessary': 'taj-madd-6',
  'custom-alef-maksora': 'taj-madd',
  'custom_alef_maksora': 'taj-madd',
  'alef-maksora': 'taj-madd',
  'alef_maksora': 'taj-madd',
  'custom-alef-high': 'taj-madd',
  
  'ikhfa_shafawi': 'taj-ghunna',
  'idgham_shafawi': 'taj-ghunna',
  'izhar': 'taj-default',
  'izhar_shafawi': 'taj-default',

  // Raw API short codes (Common across reciters)
  'm': 'taj-madd-2',
  'gh': 'taj-ghunna',
  'gs': 'taj-ghunna',
  'ghn': 'taj-ghunna',
  'ik': 'taj-ghunna',
  'id': 'taj-ghunna',
  'iq': 'taj-iqlab',
  'qa': 'taj-qalqalah',
  'tf': 'taj-tafkhim',
  'taf': 'taj-tafkhim',
  'w': 'taj-silent',
  's': 'taj-silent',
  'sl': 'taj-silent',
};

const getTajweedClass = (classString) => {
  if (!classString) return 'taj-default'; // Safe fallback: if tagged but no class, use standard color
  
  const lower = classString.toLowerCase();
  const normalize = (s) => s.toLowerCase().replace(/[_-]/g, '');
  const classes = lower.split(/\s+/);
  
  for (const c of classes) {
    const normC = normalize(c);
    
    // 1. Direct match
    if (TAJWEED_CLASS_MAP[c]) return TAJWEED_CLASS_MAP[c];
    if (TAJWEED_CLASS_MAP[normC]) return TAJWEED_CLASS_MAP[normC];

    // 2. Fuzzy match in map keys
    for (const key in TAJWEED_CLASS_MAP) {
      if (normalize(key) === normC) return TAJWEED_CLASS_MAP[key];
    }
    
    // 3. Heuristic Keyword fallbacks
    if (normC.includes('madd') || normC.includes('alef') || normC.includes('maksora')) {
      if (normC.includes('necessary') || normC.includes('lazim') || (normC.includes('6') && !normC.includes('16'))) return 'taj-madd-6';
      if (normC.includes('obligatory') || normC.includes('mottasel') || normC.includes('muttasil')) return 'taj-madd-5';
      if (normC.includes('permissible') || normC.includes('munfasil') || normC.includes('monfasel')) return 'taj-madd-4';
      return 'taj-madd';
    }
    if (normC.includes('ghunnah') || normC.includes('idgham') || normC.includes('ikhfa') || normC.includes('ikhafa')) return 'taj-ghunna';
    if (normC.includes('qalqalah') || normC.includes('qalaqah')) return 'taj-qalqalah';
    if (normC.includes('heavy') || normC.includes('tafkhim')) return 'taj-tafkhim';
    if (normC.includes('wasl') || normC.includes('silent') || normC.includes('slnt')) return 'taj-silent';
  }
  
  // Final safeguard: if it looks like a madda class from any source
  if (lower.includes('madda')) return 'taj-madd';

  console.error("🚨 Tajweed Mapping Failed for:", classString);
  return 'taj-default'; // Default to standard color for unknown tags to avoid confusing the user with false Madds
};


export const normalizeAr = (text) => (text ? text.normalize("NFC") : "");

const isBase = (char) => {
  return (char >= '\u0621' && char <= '\u064A') || // Standard Arabic
         (char >= '\u0671' && char <= '\u06D5') || // Extended Arabic letters
         char === '\u0640' || // Tatweel
         char === ' ' || 
         char === '\u06DD' || 
         (char >= '\u06D6' && char <= '\u06ED');
};

/**
 * Clusters characters within a single segment (Base + Diacritics)
 */
const clusterSegmentText = (text, tajClass) => {
  const clusters = [];
  const chars = Array.from(text);
  
  for (let i = 0; i < chars.length; i++) {
    const char = chars[i];
    
    if (isBase(char)) {
      let clusterText = char;
      // Attach following non-base characters (vowels, marks, etc.)
      while (i + 1 < chars.length && !isBase(chars[i + 1])) {
        clusterText += chars[++i];
      }
      clusters.push({ text: clusterText, tajClass });
    } else {
      // Standalone diacritic or other character
      clusters.push({ text: char, tajClass });
    }
  }
  return clusters;
};

/** خ ص ض غ ط ق ظ — API tajweed wins; ر omitted until Tarqiq/Ra rules. */
const HEAVY_LETTERS = new Set([
  '\u062E', '\u0635', '\u0636', '\u063A', '\u0637', '\u0642', '\u0638',
]);

const HEAVY_VOWEL_MARKS = new Set([
  '\u064E', // Fatha
  '\u064F', // Damma
  '\u064B', // Fathatan
  '\u064C', // Dammatan
  '\u0670', // Dagger Alif 1
  '\u0672', // Dagger Alif 2 (API variant)
]);

const QALQALAH_LETTERS = new Set([
  '\u0642', // Qaf
  '\u0637', // Ta
  '\u0628', // Ba
  '\u062C', // Jeem
  '\u062F', // Dal
]);

/**
 * Unified logic to determine if an Arabic cluster should be styled as Heavy (Tafkhim).
 * Now supports "Forward Peeking" across segment boundaries.
 */
const isClusterHeavy = (clusterText, prevText, nextText = "", precedingVowel = null) => {
  if (!clusterText) return false;
  const baseChar = Array.from(clusterText)[0];
  const combinedText = clusterText + nextText;

  // 1. Fixed Heavy Letters (Always heavy)
  if (HEAVY_LETTERS.has(baseChar)) return true;

  // 2. Contextual Ra (ر) rules
  if (baseChar === '\u0631') {
    // Case A: Ra with Heavy Vowel (either in this cluster or sitting in the next span)
    for (const mark of HEAVY_VOWEL_MARKS) {
      if (combinedText.includes(mark)) return true;
    }
    // Case B: Ra with Sukoon (ْ) -> Color based on previous cluster
    if (clusterText.includes('\u0652') && prevText) {
      if (prevText.includes('\u064E') || prevText.includes('\u064F')) {
        return true;
      }
    }
    // Case C: Ra with Shaddah (ّ) and a Heavy Vowel (Fatha/Damma)
    if (clusterText.includes('\u0651')) {
       for (const mark of HEAVY_VOWEL_MARKS) {
          if (combinedText.includes(mark)) return true;
       }
    }
  }

  // 3. Allah Rule (للّه) 
  // Identify the Lams of Allah (usually Shaddah+Fatha in the cluster)
  const isAllahLam = (clusterText.includes('\u0644') && clusterText.includes('\u0651')) || 
                    (clusterText === '\u0644' && nextText.includes('\u0651'));
  
  if (isAllahLam) {
    const vowel = precedingVowel || (prevText ? getLastVowel(prevText) : null);
    if (vowel === 'fatha' || vowel === 'damma') return true;
  }

  return false;
};

/** 
 * Wraps heavy-letter clusters in plain (non-API) segments only.
 * Implements context-aware rules for Ra (ر) and Alif (ا) and Allah (للّه).
 */
const applyManualTafkhimToPlainText = (text, precedingVowel = null) => {
  if (!text) return '';
  
  // 1. Group text into logical Arabic clusters
  const clusters = clusterSegmentText(text, null);
  
  return clusters.map((cluster, i) => {
    const clusterText = cluster.text;
    const prevText = clusters[i - 1]?.text;
    const nextText = clusters[i + 1]?.text || "";
    const crossWordVowel = (i === 0) ? precedingVowel : null;
    
    if (isClusterHeavy(clusterText, prevText, nextText, crossWordVowel)) {
      return `<span class="taj-tafkhim">${clusterText}</span>`;
    }
    return clusterText;
  }).join('');
};

/**
 * Extracts backend-style rule codes from Tajweed HTML spans.
 * Maps UI CSS classes to ASR service rule identifiers.
 * Updated to support fine-grained Madd types (6, Connected, Separated).
 */
export const extractTajweedRules = (html) => {
  if (!html) return [];
  const rules = new Set();
  
  // Mapping of CANONICAL classes to backend rule codes
  const canonicalToRule = {
    'taj-madd': 'madd_2',
    'taj-madd-2': 'madd_2',
    'taj-madd-4': 'madd_s',
    'taj-madd-munfasil': 'madd_s',
    'taj-madd-5': 'madd_c',
    'taj-madd-mottasel': 'madd_c',
    'taj-madd-6': 'madd_6',
    'taj-madd-lazim': 'madd_6',
    'taj-ghunna': 'ghunnah',
    'taj-iqlab': 'ghunnah',
    'taj-qalqalah': 'qalqalah',
    'taj-tafkhim': 'heavy'
  };

  // Extract all class names from the HTML tags
  // Uses a robust regex that handles both quoted ("m", 'm') and unquoted (class=m) attributes
  const classRegex = /class\s*=\s*(?:["']([^"']+)["']|([^>\s]+))/g;
  let match;
  while ((match = classRegex.exec(html)) !== null) {
    // match[1] is the quoted value, match[2] is the unquoted value
    const rawClassValue = match[1] || match[2];
    if (!rawClassValue) continue;

    const classWords = rawClassValue.split(/\s+/);
    classWords.forEach(cls => {
      // 1. Convert any raw code or class to its canonical 'taj-' form using the existing engine
      const canonical = getTajweedClass(cls);
      // 2. Map canonical class to rule
      if (canonicalToRule[canonical]) {
        rules.add(canonicalToRule[canonical]);
      }
    });
  }
  
  if (rules.size > 0) {
    console.log(`[JS Map Extract] Rules found for snippet: ${html.slice(0, 15)}... -> ${Array.from(rules)}`);
  }
  return Array.from(rules);
};

/**
 * Normalizes Arabic text for backend key matching.
 * Synchronized with asr/src/utils/normalize_arabic.py
 */
export const getBaseText = (text) => {
  if (!text) return "";
  
  // 1. Initial Unicode Normalization (Sync with Python NFKC)
  let normalized = text.normalize("NFKC");
  
  // 2. Remove Waqf / Tatweel symbols
  normalized = normalized.replace(/[ۖۗۘۙۚۛۜ۞\u0640]/g, "");

  // 3. Remove Tashkeel (Sync range with normalize_arabic.py)
  normalized = normalized.replace(/[\u0610-\u061A\u064B-\u065F\u06D6-\u06DC\u06DF-\u06E8\u06EA-\u06ED\u0670]/g, "");
  
  // 4. Normalize Variants (Alef, Taa Marbuta, Alef Maqsura)
  const variants = {
    '\u0623': '\u0627', '\u0625': '\u0627', '\u0622': '\u0627', '\u0671': '\u0627', // Alef variants to plain ا
    '\u0629': '\u0647', // Taa Marbuta ة to ه
    '\u0649': '\u064A', // Alef Maqsura ى to ي
  };
  
  let finalResult = "";
  for (const char of normalized) {
    finalResult += variants[char] || char;
  }

  return finalResult.replace(/\s+/g, ' ').trim();
};

/**
 * Generates a full 'tajweed_map' for the backend analysis service.
 * Map: { "normalized_word": ["rule1", "rule2"] }
 */
export const generateTajweedMap = (words) => {
  const tajweedMap = {};
  
  let lastWordVowel = null;

  words.forEach(w => {
    // Priority: verse_tajweed > text_uthmani_tajweed
    const html = w.verse_tajweed || w.text_uthmani_tajweed || '';
    const rules = new Set(extractTajweedRules(html)); // Use Set to avoid duplicates
    
    // 🆕 Manual Scanner for Missing Rules (Tafkhim/Heavy) 🆕
    // If the API missed a Heavy letter (like Ra or Allah), we manually inject it.
    const text = w.text_uthmani || "";
    const clusters = clusterSegmentText(text, null);
    clusters.forEach((cluster, i) => {
      const prevText = clusters[i-1]?.text;
      // Cross-word context: if it's the first cluster, use lastWordVowel
      const crossWordVowel = (i === 0) ? lastWordVowel : null;

      if (isClusterHeavy(cluster.text, prevText, "", crossWordVowel)) {
        rules.add('heavy');
      }
    });

    // Track last word's ending vowel for cross-word rules (Allah Rule)
    lastWordVowel = getLastVowel(text);

    if (rules.size > 0) {
      // Helper to strip tajweed tags (sync'd with PracticePage)
      const stripTajweed = (h) => h ? h.replace(/<[^>]+>/g, "").trim() : "";
      const text_to_norm = w.text_uthmani || stripTajweed(w.text_uthmani_tajweed) || "";
      
      // Backend expects the key to be normalized Arabic
      const key = getBaseText(text_to_norm);
      if (key) {
        tajweedMap[key] = Array.from(rules);
      }
    }
  });
  
  if (Object.keys(tajweedMap).length > 0) {
    console.log("[JS Map Final] Prepared tajweed_map:", tajweedMap);
  }
  return tajweedMap;
};

export const renderTajweed = (html, precedingVowel = null) => {
  if (!html) return "";

  const normalizedHtml = html
    .normalize("NFC")
    .replace(/\u0672/g, '\u0670'); // Map Alef with High Hamza to Dagger Alif for font compatibility
  const parser = new DOMParser();
  const doc = parser.parseFromString(`<span>${normalizedHtml}</span>`, 'text/html');
  const span = doc.body.firstChild;
  
  // 1. Build the segments through DOM traversal as before
  const segments = [];
  const traverse = (node, activeClass) => {
    if (node.nodeType === Node.TEXT_NODE) {
      if (node.textContent) {
        segments.push({ text: node.textContent, tajClass: activeClass });
      }
    } else if (node.nodeType === Node.ELEMENT_NODE) {
      const apiClass = node.getAttribute('class');
      const tajClass = getTajweedClass(apiClass) || activeClass;
      node.childNodes.forEach(child => traverse(child, tajClass));
    }
  };

  if (span) {
    span.childNodes.forEach(child => traverse(child, null));
  }

  // 2. Pre-processing Phase: Cluster-Stitching
  // If a Tajweed segment starts with a diacritic, pull the anchor from the previous segment.
  for (let i = 1; i < segments.length; i++) {
    const seg = segments[i];
    const prev = segments[i - 1];
    
    // Only stitch if current is styled and previous is plain text
    if (seg.tajClass && prev.tajClass === null && seg.text.length > 0) {
      const firstChar = Array.from(seg.text)[0];
      if (!isBase(firstChar) && prev.text.length > 0) {
        // "Recursive" steal: Keep grabbing from 'prev' until we've swallowed one base letter
        let stolen = '';
        let foundBase = false;
        
        while (prev.text.length > 0 && !foundBase) {
          const char = prev.text.slice(-1);
          stolen = char + stolen;
          prev.text = prev.text.slice(0, -1);
          if (isBase(char)) foundBase = true;
        }

        // Wrap only the base letter in taj-base, leaving the stolen diacritics in the rule span
        // Note: 'stolen' might contain several chars like [Base, Mark1, Mark2]
        // If the stolen char is heavy (looking at it + the current styled segment), use taj-tafkhim instead of taj-base
        const clusterChars = Array.from(stolen);
        let wrappedStolen = '';
        if (clusterChars.length > 0) {
          // Peek back into current prev.text for sukoon context
          // Peek forward into current seg.text for vowel context
          const anchorCluster = stolen; 
          const prevOfPrev = prev.text.length > 0 ? prev.text : null;
          const lookAheadForVowel = seg.text;
          
          const anchorClass = isClusterHeavy(anchorCluster, prevOfPrev, lookAheadForVowel) ? "taj-tafkhim" : "taj-base";
          wrappedStolen = `<span class="${anchorClass}">${clusterChars[0]}</span>` + clusterChars.slice(1).join('');
        }
        
        seg.text = wrappedStolen + seg.text;
      }
    }
  }

  // 3. Forward-Stitching Phase: Swallow Trailing Marks
  // If a styled segment is followed by an unstyled one starting with diacritics, swallow them.
  for (let i = 0; i < segments.length - 1; i++) {
    const seg = segments[i];
    const next = segments[i + 1];

    if (seg.tajClass && next.tajClass === null && next.text.length > 0) {
      const nextChars = Array.from(next.text);
      let swallowedCount = 0;
      
      while (swallowedCount < nextChars.length && !isBase(nextChars[swallowedCount])) {
        swallowedCount++;
      }

      if (swallowedCount > 0) {
        const swallowedStr = nextChars.slice(0, swallowedCount).join('');
        seg.text = seg.text + swallowedStr;
        next.text = next.text.slice(swallowedStr.length);
      }
    }
  }

  // 4. Rendering Phase: Linearization and Merging
  let finalHtml = "";
  for (let i = 0; i < segments.length; i++) {
    const seg = segments[i];
    if (!seg.text) continue; // Skip empty segments (like a fully stolen anchor)
    
    let mergedText = seg.text;
    let j = i + 1;
    
    // Merge consecutive segments with the EXACT same class
    while (j < segments.length && segments[j].tajClass === seg.tajClass) {
       mergedText += segments[j].text;
       i = j; // Advance outer loop
       j++;
    }

    if (seg.tajClass) {
      finalHtml += `<span class="${seg.tajClass}">${mergedText}</span>`;
    } else {
      // Apply internal manual logic (like Tafkhim) only on plain (non-API) segments.
      // Pass the precedingVowel only for the VERY FIRST segment of the word
      const passVowel = (i === 0) ? precedingVowel : null;
      finalHtml += applyManualTafkhimToPlainText(mergedText, passVowel);
    }
  }

  return finalHtml;
};

/**
 * Splits a verse-level text_uthmani_tajweed HTML string into per-word chunks.
 * Properly handles tajweed tags that span across word boundaries by closing
 * and reopening them at each space split point.
 * Filters out end-of-ayah marker chunks (<span class=end>...</span>).
 */
export const splitVerseTajweedIntoWords = (html) => {
  if (!html) return [];

  const result = [];
  let current = '';
  let tagStack = []; // Array of full opening tag strings
  let i = 0;

  while (i < html.length) {
    if (html[i] === '<') {
      // Find the end of this tag
      const tagEnd = html.indexOf('>', i);
      if (tagEnd === -1) {
        current += html.slice(i);
        break;
      }

      const fullTag = html.slice(i, tagEnd + 1);
      const tagInner = html.slice(i + 1, tagEnd).trim();

      if (tagInner.startsWith('/')) {
        // Closing tag — pop from stack
        if (tagStack.length > 0) tagStack.pop();
      } else if (!tagInner.endsWith('/')) {
        // Opening tag (not self-closing) — push to stack
        tagStack.push(fullTag);
      }

      current += fullTag;
      i = tagEnd + 1;
    } else if (html[i] === ' ') {
      // Space in text content = word boundary
      // Close all currently open tags
      for (let t = tagStack.length - 1; t >= 0; t--) {
        const match = tagStack[t].match(/<(\w+)/);
        if (match) current += `</${match[1]}>`;
      }

      if (current.trim()) result.push(current);
      current = '';

      // Reopen tags for next word
      for (const tag of tagStack) {
        current += tag;
      }

      i++;
    } else {
      current += html[i];
      i++;
    }
  }

  if (current.trim()) result.push(current);

  // Filter out end-of-ayah marker chunks (e.g. <span class=end>٢</span>)
  return result.filter(chunk => !/<span[^>]*class=["']?end["']?[^>]*>/i.test(chunk));
};

export const getLastVowel = (text) => {
  if (!text) return null;
  const n = normalizeAr(text);
  const match = n.match(/[\u064B-\u0652\u0651\u0670](?!.*[\u064B-\u0652\u0670])/);
  if (!match) return null;
  if (match[0] === ARABIC_VOWELS.KASRA) return 'kasra';
  if (match[0] === ARABIC_VOWELS.FATHA) return 'fatha';
  if (match[0] === ARABIC_VOWELS.DAMMA) return 'damma';
  return 'other';
};
