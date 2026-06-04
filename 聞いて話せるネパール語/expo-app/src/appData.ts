// 聞いて話せるネパール語 のアプリ固有データを集約し、@safa/shared の AppData として提供する。

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
  AppData, ThemeMeta, LevelMeta, Example, WordCategoryMeta, Word, GrammarThemeMeta,
  GrammarVocab, JpReading,
} from '@safa/shared';
import type { NeCore } from './pack/compose';

const THEMES = themesJson as ThemeMeta[];
const LEVELS = levelsJson as LevelMeta[];
const EXAMPLES = examplesJson as Record<string, Example[]>;
const WORD_CATEGORIES = wordCategoriesJson as WordCategoryMeta[];
const WORDS = wordsJson as Record<string, Word[]>;
const GRAMMAR_THEMES = grammarThemesJson as GrammarThemeMeta[];
const GRAMMAR_EXAMPLES = grammarExamplesJson as Record<string, Example[]>;
const VOCAB = vocabJson as Record<string, { ja: string; rom: string }>;
const GRAMMAR_VOCAB = grammarVocabJson as GrammarVocab;
const CONV_VOCAB = convVocabJson as GrammarVocab;
const JP_READING = jpReadingJson as JpReading;

// 日本語ユーザー向けの同梱 AppData (現行のまま=既存ユーザーに影響なし)。
export const appData: AppData = {
  version: appJson.expo.version,
  nativeLang: 'ja',
  THEMES, LEVELS, EXAMPLES, WORD_CATEGORIES, WORDS,
  GRAMMAR_THEMES, GRAMMAR_EXAMPLES, VOCAB, GRAMMAR_VOCAB, CONV_VOCAB, JP_READING,
  // アプリ評価リンク。iosAppId は App Store の数値ID (公開後に判明)。
  // 空のままだと iOS では評価行は非表示 (Android は機能する)。
  review: { iosAppId: '6771720689', androidPackage: appJson.expo.android.package },
  audio: { nepaliAudio, japaneseAudio, nepaliGrammarAudio, japaneseGrammarAudio },
  getExamples: (themeId, levelId) => EXAMPLES[`${themeId}-${levelId}`] ?? [],
  getWords: (categoryId) => WORDS[String(categoryId)] ?? [],
  getGrammarExamples: (themeId) => GRAMMAR_EXAMPLES[String(themeId)] ?? [],
};

// ── ネパール語=共通コア (en パックの composePack 用。jp体験には未使用) ──
const pickNe = (m: Record<string, Example[]>): Record<string, string[]> =>
  Object.fromEntries(Object.entries(m).map(([k, arr]) => [k, arr.map(e => e.ne)]));
const pickWordNe = (m: Record<string, Word[]>): Record<string, string[]> =>
  Object.fromEntries(Object.entries(m).map(([k, arr]) => [k, arr.map(w => w.ne)]));

export const neCore: NeCore = {
  themes: THEMES,
  levels: LEVELS,
  wordCategories: WORD_CATEGORIES,
  grammarThemes: GRAMMAR_THEMES,
  examplesNe: pickNe(EXAMPLES),
  grammarNe: pickNe(GRAMMAR_EXAMPLES),
  wordsNe: pickWordNe(WORDS),
  jpReading: JP_READING,
  nepaliAudio,
  nepaliGrammarAudio,
};
