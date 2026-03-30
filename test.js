const html = 'لَم<tajweed class=madda_permissible>ِي</tajweed>نَ';
const ruleToStyle = { 'madda_permissible': 'color: #FF9800;' };
const getStyleFromClasses = (c) => ruleToStyle[c] || null;

const ARABIC_VOWELS = { FATHA: '\u064E', KASRA: '\u0650' };
const isVowel = (char) => Object.values(ARABIC_VOWELS).includes(char);
const isLetter = (char) => (char >= '\u0621' && char <= '\u064A') || char === '\u0671' || char === '\u06CC' || char === '\u0649';
const clusterArabic = (word) => {
  const clusters = [];
  const normalized = word.normalize('NFC');
  for (let i = 0; i < normalized.length; i++) {
    const char = normalized[i];
    const startIndex = i;
    if (isLetter(char) || char === ' ') {
      let clusterText = char;
      while (i + 1 < normalized.length && (isVowel(normalized[i + 1]) || /[\u064B-\u065F\u0670\u06D6-\u06ED\u0640]/.test(normalized[i + 1]))) {
        clusterText += normalized[++i];
      }
      clusters.push({ text: clusterText, base: char, startIndex, endIndex: i });
    } else {
      clusters.push({ text: char, base: char, startIndex, endIndex: i });
    }
  }
  return clusters;
};

const parseTajweedHtml = (input) => {
  let cleanText = '';
  const indexToRule = new Map();
  const stack = [];
  const parts = input.split(/(<[^>]+>)/g);
  for (const part of parts) {
    if (part.startsWith('<')) {
      if (part.startsWith('</')) stack.pop();
      else {
        const match = part.match(/class=["']?([^"'>\s]+)["']?/i);
        const style = getStyleFromClasses(match ? match[1] : null);
        stack.push(style);
      }
    } else {
      for (let i = 0; i < part.length; i++) {
        cleanText += part[i];
        const activeStyle = stack.length > 0 ? stack[stack.length - 1] : null;
        if (activeStyle) indexToRule.set(cleanText.length - 1, activeStyle);
      }
    }
  }
  return { cleanText, indexToRule };
};

const { cleanText, indexToRule } = parseTajweedHtml(html);
const clusters = clusterArabic(cleanText);

const renderedClusters = clusters.map((cluster) => {
  let clusterHtml = '';
  let currentStyle = null;
  let currentSegment = '';
  for (let i = cluster.startIndex; i <= cluster.endIndex; i++) {
    const char = cleanText[i];
    const finalStyle = indexToRule.get(i) || null;
    if (finalStyle !== currentStyle) {
      if (currentSegment) {
        clusterHtml += currentStyle ? `<span style="${currentStyle}">${currentSegment}</span>` : currentSegment;
      }
      currentStyle = finalStyle;
      currentSegment = char;
    } else {
      currentSegment += char;
    }
  }
  if (currentSegment) {
    clusterHtml += currentStyle ? `<span style="${currentStyle}">${currentSegment}</span>` : currentSegment;
  }
  return clusterHtml;
});
console.log(renderedClusters.join(''));
