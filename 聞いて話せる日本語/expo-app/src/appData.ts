// 聞いて話せる日本語 の共通コア。
// 案2: 「日本語=共通コア(jaCore)」をここで定義し、母語(ne/bn)はすべて DL パックとして
// packLoader が composePack で結合する。ne も DL 化したため、ここに母語データは持たない。

import themesJson from '../data/themes.json';
import levelsJson from '../data/levels.json';
import examplesJson from '../data/examples.json';
import wordCategoriesJson from '../data/wordCategories.json';
import wordsJson from '../data/words.json';
import grammarThemesJson from '../data/grammarThemes.json';
import grammarExamplesJson from '../data/grammarExamples.json';
import jpReadingJson from '../data/jp-reading.json';
import wordsReadingJson from '../data/words-reading.json';
// 【統一パック化 2026-06-16】日本語(ターゲット)音声はコアパックDL→runtime注入(audioMap不使用)。
import type {
  ThemeMeta, LevelMeta, Example, WordCategoryMeta, Word, GrammarThemeMeta, JpReading,
} from '@safa/shared';
import { type JaCore } from './pack/compose';

const THEMES = themesJson as ThemeMeta[];
const LEVELS = levelsJson as LevelMeta[];
const EXAMPLES = examplesJson as Record<string, Example[]>;
const WORD_CATEGORIES = wordCategoriesJson as WordCategoryMeta[];
const WORDS = wordsJson as Record<string, Word[]>;
const GRAMMAR_THEMES = grammarThemesJson as GrammarThemeMeta[];
const GRAMMAR_EXAMPLES = grammarExamplesJson as Record<string, Example[]>;
const JP_READING = jpReadingJson as JpReading;
const WORDS_READING = wordsReadingJson as JpReading;

// 結合データ {jp, ne} の jp側 / ja語 を取り出すヘルパー (位置順を維持)
const pickJp = (m: Record<string, Example[]>): Record<string, string[]> =>
  Object.fromEntries(Object.entries(m).map(([k, arr]) => [k, arr.map(e => e.jp)]));
const pickWordJa = (m: Record<string, Word[]>): Record<string, string[]> =>
  Object.fromEntries(Object.entries(m).map(([k, arr]) => [k, arr.map(w => w.ja)]));

// ── 日本語=共通コア (全L1パックがこれを共有) ──
// テキスト/メタは同梱。日本語(ターゲット)音声は core パックDL→file://マップを注入。
export type JaAudioMaps = { conv: Record<string, number | string>; gram: Record<string, number | string> };

export function makeJaCore(audio: JaAudioMaps = { conv: {}, gram: {} }): JaCore {
  return {
    themes: THEMES,
    levels: LEVELS,
    wordCategories: WORD_CATEGORIES,
    grammarThemes: GRAMMAR_THEMES,
    examplesJp: pickJp(EXAMPLES),
    grammarJp: pickJp(GRAMMAR_EXAMPLES),
    wordsJa: pickWordJa(WORDS),
    jpReading: JP_READING,
    wordsReading: WORDS_READING,
    japaneseAudio: audio.conv,
    japaneseGrammarAudio: audio.gram,
  };
}

// text のみ(音声空)のコア。DL前のフォールバック。
export const jaCore: JaCore = makeJaCore();
