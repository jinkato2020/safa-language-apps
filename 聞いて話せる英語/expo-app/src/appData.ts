// 聞いて話せる英語 の同梱データ。
// en=学習対象(コア) / ja=母語(L1)。母語が1つだけなので全同梱(DLパック無し)。
// compose の JaCore(コアスロット)に英語を、L1Overlay に日本語を入れて結合する。

import themesJson from '../data/themes.json';
import levelsJson from '../data/levels.json';
import examplesJson from '../data/examples.json';
import grammarThemesJson from '../data/grammarThemes.json';
import grammarExamplesJson from '../data/grammarExamples.json';
import dictJson from '../data/dict.json';
import { englishAudio, englishGrammarAudio, japaneseNativeAudio, japaneseNativeGrammarAudio } from '../data/audioMap';
import appJson from '../app.json';
import type { ThemeMeta, LevelMeta, GrammarThemeMeta, AppData } from '@safa/shared';
import { composePack, type JaCore, type L1Overlay } from './pack/compose';

type Pair = { en: string; ja: string };
const THEMES = themesJson as ThemeMeta[];
const LEVELS = levelsJson as LevelMeta[];
const GRAMMAR_THEMES = grammarThemesJson as GrammarThemeMeta[];
const EXAMPLES = examplesJson as Record<string, Pair[]>;
const GRAMMAR = grammarExamplesJson as Record<string, Pair[]>;

const pick = (m: Record<string, Pair[]>, key: 'en' | 'ja'): Record<string, string[]> =>
  Object.fromEntries(Object.entries(m).map(([k, arr]) => [k, arr.map(e => e[key] ?? '')]));

// ── 英語=共通コア(学習対象。compose上は「Jp」スロットだが中身は英語) ──
const enCore: JaCore = {
  themes: THEMES,
  levels: LEVELS,
  wordCategories: [],
  grammarThemes: GRAMMAR_THEMES,
  examplesJp: pick(EXAMPLES, 'en'),
  grammarJp: pick(GRAMMAR, 'en'),
  wordsJa: {},
  jpReading: undefined,        // 英語コアはふりがな不要
  wordsReading: undefined,
  japaneseAudio: englishAudio,            // 英語(学習対象)音声
  japaneseGrammarAudio: englishGrammarAudio,
};

// ── 日本語=母語オーバーレイ(同梱) ──
const jaOverlay: L1Overlay = {
  nativeLang: 'ja',
  examplesL1: pick(EXAMPLES, 'ja'),
  grammarL1: pick(GRAMMAR, 'ja'),
  wordsL1: {},
  vocab: {},
  convVocab: (dictJson as any).convVocab,   // 英単語→日本語語釈(GPT-4o)
  grammarVocab: (dictJson as any).grammarVocab,
  l1Audio: japaneseNativeAudio,           // 日本語(母語)音声
  l1GrammarAudio: japaneseNativeGrammarAudio,
  vocabTokenize: 'jp',         // Path A: 辞書語を対象文(英語ex.jp)内の出現順に表示(英語でも機能)
};

// 全同梱の AppData (PackGate/DL不要)。
export const appData: AppData = composePack(enCore, jaOverlay, {
  version: appJson.expo.version,
  review: { iosAppId: null, androidPackage: appJson.expo.android.package },
});
