// 聞いて話せるネパール語 の共通コア。
// 案2(全DL化): ネパール語=共通コア(ここで定義・同梱)。母語(ja/en)はすべて
// DLパックとして packLoader が composePack で結合する。母語データはここに持たない。

import themesJson from '../data/themes.json';
import levelsJson from '../data/levels.json';
import examplesJson from '../data/examples.json';
import wordCategoriesJson from '../data/wordCategories.json';
import wordsJson from '../data/words.json';
import grammarThemesJson from '../data/grammarThemes.json';
import grammarExamplesJson from '../data/grammarExamples.json';
import jpReadingJson from '../data/jp-reading.json';
import type {
  ThemeMeta, LevelMeta, Example, WordCategoryMeta, Word, GrammarThemeMeta, JpReading,
} from '@safa/shared';
import type { NeCore } from './pack/compose';

const THEMES = themesJson as ThemeMeta[];
const LEVELS = levelsJson as LevelMeta[];
const EXAMPLES = examplesJson as Record<string, Example[]>;
const WORD_CATEGORIES = wordCategoriesJson as WordCategoryMeta[];
const WORDS = wordsJson as Record<string, Word[]>;
const GRAMMAR_THEMES = grammarThemesJson as GrammarThemeMeta[];
const GRAMMAR_EXAMPLES = grammarExamplesJson as Record<string, Example[]>;
const JP_READING = jpReadingJson as JpReading;

const pickNe = (m: Record<string, Example[]>): Record<string, string[]> =>
  Object.fromEntries(Object.entries(m).map(([k, arr]) => [k, arr.map(e => e.ne)]));
const pickWordNe = (m: Record<string, Word[]>): Record<string, string[]> =>
  Object.fromEntries(Object.entries(m).map(([k, arr]) => [k, arr.map(w => w.ne)]));

// ── ネパール語=共通コア ──
// 【統一パック化 2026-06-16】テキスト/メタは同梱、ネパール語(ターゲット)音声は
//   コアパック(packs-appa の core)としてDL→file://マップを runtime で注入。
//   音声マップが空(未DL)でも text は表示可。
export type NeAudioMaps = { conv: Record<string, number | string>; gram: Record<string, number | string> };

export function makeNeCore(audio: NeAudioMaps = { conv: {}, gram: {} }): NeCore {
  return {
    themes: THEMES,
    levels: LEVELS,
    wordCategories: WORD_CATEGORIES,
    grammarThemes: GRAMMAR_THEMES,
    examplesNe: pickNe(EXAMPLES),
    grammarNe: pickNe(GRAMMAR_EXAMPLES),
    wordsNe: pickWordNe(WORDS),
    jpReading: JP_READING,        // 日本語読み(ja overlay時のみ有効, enでは未使用)
    nepaliAudio: audio.conv,
    nepaliGrammarAudio: audio.gram,
  };
}

// text のみ(音声空)のコア。DL前のフォールバック。
export const neCore: NeCore = makeNeCore();
