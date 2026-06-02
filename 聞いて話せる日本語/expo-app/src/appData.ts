// 聞いて話せる日本語 のアプリ固有データ。
// 案2: 既存の結合データから「日本語=共通コア(jaCore)」と「ネパール語オーバーレイ(neOverlay)」を
// 派生し、composePack で結合して AppData を提供する。jaCore は bn など他L1パックと共有する。

import themesJson from '../data/themes.json';
import levelsJson from '../data/levels.json';
import examplesJson from '../data/examples.json';
import wordCategoriesJson from '../data/wordCategories.json';
import wordsJson from '../data/words.json';
import grammarThemesJson from '../data/grammarThemes.json';
import grammarExamplesJson from '../data/grammarExamples.json';
import vocabJson from '../data/vocab.json';
import grammarVocabJson from '../data/grammar-vocab-context.json';
import convVocabJson from '../data/conv-vocab-context.json';
import jpReadingJson from '../data/jp-reading.json';
import {
  nepaliAudio, japaneseAudio, nepaliGrammarAudio, japaneseGrammarAudio,
} from '../data/audioMap';
import appJson from '../app.json';
import type {
  ThemeMeta, LevelMeta, Example, WordCategoryMeta, Word, GrammarThemeMeta,
  VocabEntry, GrammarVocab, JpReading,
} from '@safa/shared';
import { composePack, type JaCore, type L1Overlay } from './pack/compose';

const THEMES = themesJson as ThemeMeta[];
const LEVELS = levelsJson as LevelMeta[];
const EXAMPLES = examplesJson as Record<string, Example[]>;
const WORD_CATEGORIES = wordCategoriesJson as WordCategoryMeta[];
const WORDS = wordsJson as Record<string, Word[]>;
const GRAMMAR_THEMES = grammarThemesJson as GrammarThemeMeta[];
const GRAMMAR_EXAMPLES = grammarExamplesJson as Record<string, Example[]>;
const VOCAB = vocabJson as Record<string, VocabEntry>;
const GRAMMAR_VOCAB = grammarVocabJson as GrammarVocab;
const CONV_VOCAB = convVocabJson as GrammarVocab;
const JP_READING = jpReadingJson as JpReading;

// 結合データ {jp, ne} を jp側 / ne側 に分解するヘルパー (位置順を維持)
const pickJp = (m: Record<string, Example[]>): Record<string, string[]> =>
  Object.fromEntries(Object.entries(m).map(([k, arr]) => [k, arr.map(e => e.jp)]));
const pickNe = (m: Record<string, Example[]>): Record<string, string[]> =>
  Object.fromEntries(Object.entries(m).map(([k, arr]) => [k, arr.map(e => e.ne)]));
const pickWordJa = (m: Record<string, Word[]>): Record<string, string[]> =>
  Object.fromEntries(Object.entries(m).map(([k, arr]) => [k, arr.map(w => w.ja)]));
const pickWordNe = (m: Record<string, Word[]>): Record<string, string[]> =>
  Object.fromEntries(Object.entries(m).map(([k, arr]) => [k, arr.map(w => w.ne)]));

// ── 日本語=共通コア (App B 全L1で共有。bn パック等もこれを使う) ──
export const jaCore: JaCore = {
  themes: THEMES,
  levels: LEVELS,
  wordCategories: WORD_CATEGORIES,
  grammarThemes: GRAMMAR_THEMES,
  examplesJp: pickJp(EXAMPLES),
  grammarJp: pickJp(GRAMMAR_EXAMPLES),
  wordsJa: pickWordJa(WORDS),
  jpReading: JP_READING,
  japaneseAudio,
  japaneseGrammarAudio,
};

// ── ネパール語オーバーレイ (訳/母語音声/辞書) ──
const neOverlay: L1Overlay = {
  nativeLang: 'ne',
  examplesL1: pickNe(EXAMPLES),
  grammarL1: pickNe(GRAMMAR_EXAMPLES),
  wordsL1: pickWordNe(WORDS),
  vocab: VOCAB,
  grammarVocab: GRAMMAR_VOCAB,
  convVocab: CONV_VOCAB,
  l1Audio: nepaliAudio,
  l1GrammarAudio: nepaliGrammarAudio,
};

export const appData = composePack(jaCore, neOverlay, {
  version: appJson.expo.version,
  // アプリ評価リンク。iosAppId は App Store の数値ID。空だと iOS では評価行は非表示。
  review: { iosAppId: '6774461088', androidPackage: appJson.expo.android.package },
});
