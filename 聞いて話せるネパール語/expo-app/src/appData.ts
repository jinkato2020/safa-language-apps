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
import { nepaliAudio, nepaliGrammarAudio } from '../data/audioMap';
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

// ── ネパール語=共通コア (全L1パックがこれを共有・アプリ同梱) ──
export const neCore: NeCore = {
  themes: THEMES,
  levels: LEVELS,
  wordCategories: WORD_CATEGORIES,
  grammarThemes: GRAMMAR_THEMES,
  examplesNe: pickNe(EXAMPLES),
  grammarNe: pickNe(GRAMMAR_EXAMPLES),
  wordsNe: pickWordNe(WORDS),
  jpReading: JP_READING,        // 日本語読み(ja overlay時のみ有効, enでは未使用)
  nepaliAudio,
  nepaliGrammarAudio,
};
