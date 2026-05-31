// デーヴァナーガリー → IAST 簡易変換
// HTML 版 (scripts/build-app.mjs) と同じロジック

const DEVA_CONS: Record<string, string> = {
  'क':'k','ख':'kh','ग':'g','घ':'gh','ङ':'ṅ',
  'च':'c','छ':'ch','ज':'j','झ':'jh','ञ':'ñ',
  'ट':'ṭ','ठ':'ṭh','ड':'ḍ','ढ':'ḍh','ण':'ṇ',
  'त':'t','थ':'th','द':'d','ध':'dh','न':'n',
  'प':'p','फ':'ph','ब':'b','भ':'bh','म':'m',
  'य':'y','र':'r','ल':'l','व':'v','श':'ś','ष':'ṣ','स':'s','ह':'h',
};
const DEVA_VOWELS: Record<string, string> = {
  'अ':'a','आ':'ā','इ':'i','ई':'ī','उ':'u','ऊ':'ū','ऋ':'ṛ','ए':'e','ऐ':'ai','ओ':'o','औ':'au',
};
const DEVA_VSIGNS: Record<string, string> = {
  'ा':'ā','ि':'i','ी':'ī','ु':'u','ू':'ū','ृ':'ṛ','े':'e','ै':'ai','ो':'o','ौ':'au',
};
const DEVA_VIRAMA = '्';

export function toRomaji(text: string): string {
  if (!text) return '';
  let out = '';
  const s = text;
  let i = 0;
  while (i < s.length) {
    const ch = s[i];
    const ch3 = s.substr(i, 3);
    if (DEVA_CONS[ch3]) {
      out += DEVA_CONS[ch3];
      const after = s[i + 3];
      if (after === DEVA_VIRAMA) { i += 4; continue; }
      if (after && DEVA_VSIGNS[after]) { out += DEVA_VSIGNS[after]; i += 4; continue; }
      out += 'a'; i += 3; continue;
    }
    if (DEVA_CONS[ch]) {
      out += DEVA_CONS[ch];
      const after = s[i + 1];
      if (after === DEVA_VIRAMA) { i += 2; continue; }
      if (after && DEVA_VSIGNS[after]) { out += DEVA_VSIGNS[after]; i += 2; continue; }
      out += 'a'; i += 1; continue;
    }
    if (DEVA_VOWELS[ch]) { out += DEVA_VOWELS[ch]; i += 1; continue; }
    if (ch === 'ं') { out += 'ṃ'; i += 1; continue; }
    if (ch === 'ः') { out += 'ḥ'; i += 1; continue; }
    if (ch === 'ँ') { out += 'm̐'; i += 1; continue; }
    if (ch === '।') { out += '.'; i += 1; continue; }
    if (ch === '॥') { out += '||'; i += 1; continue; }
    out += ch;
    i += 1;
  }
  return out;
}

export function sentenceToRomaji(neText: string): string {
  if (!neText) return '';
  return neText.split(/(\s+)/).map(tok => {
    if (/^\s+$/.test(tok)) return tok;
    return toRomaji(tok);
  }).join('');
}

// 句読点を分離してトークン化 (PracticeScreen の tokenize と同じ規則)
const PUNCT_RE = /^[।॥?!,;:"'""''（）()「」『』]+$/;
function tokenizeNe(text: string): string[] {
  return text
    .replace(/([।॥?!,;:"'""''（）()「」『』])/g, ' $1 ')
    .split(/\s+/)
    .map(w => w.trim())
    .filter(w => w.length > 0);
}

// 辞書連携版: 各単語のローマ字を romOf(word) で引き、無ければ機械変換にフォールバック。
// 文法モードで「単語と意味」リストと同じローマ字を文カードにも使うために利用する。
export function sentenceToRomajiWithDict(
  neText: string,
  romOf: (word: string) => string | null | undefined,
): string {
  if (!neText) return '';
  const out: string[] = [];
  for (const tok of tokenizeNe(neText)) {
    if (PUNCT_RE.test(tok)) {
      const p = (tok === '।' || tok === '॥') ? '.' : tok;
      if (out.length) out[out.length - 1] += p;
      else out.push(p);
    } else {
      const rom = romOf(tok);
      out.push(rom && rom.trim() ? rom.trim() : toRomaji(tok));
    }
  }
  return out.join(' ');
}
