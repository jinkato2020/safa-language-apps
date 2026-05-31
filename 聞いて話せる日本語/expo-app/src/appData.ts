// 聞いて話せる日本語 のアプリ固有データを集約し、@safa/shared の AppData として提供する。

import themesJson from '../data/themes.json';
import levelsJson from '../data/levels.json';
import examplesJson from '../data/examples.json';
import wordCategoriesJson from '../data/wordCategories.json';
import wordsJson from '../data/words.json';
import grammarThemesJson from '../data/grammarThemes.json';
import grammarExamplesJson from '../data/grammarExamples.json';
import vocabJson from '../data/vocab.json';
import grammarVocabJson from '../data/grammar-vocab-context.json';
import {
  nepaliAudio, japaneseAudio, nepaliGrammarAudio, japaneseGrammarAudio,
} from '../data/audioMap';
import appJson from '../app.json';
import type {
  AppData, ThemeMeta, LevelMeta, Example, WordCategoryMeta, Word, GrammarThemeMeta,
  GrammarVocab,
} from '@safa/shared';

const THEMES = themesJson as ThemeMeta[];
const LEVELS = levelsJson as LevelMeta[];
const EXAMPLES = examplesJson as Record<string, Example[]>;
const WORD_CATEGORIES = wordCategoriesJson as WordCategoryMeta[];
const WORDS = wordsJson as Record<string, Word[]>;
const GRAMMAR_THEMES = grammarThemesJson as GrammarThemeMeta[];
const GRAMMAR_EXAMPLES = grammarExamplesJson as Record<string, Example[]>;
const VOCAB = vocabJson as Record<string, { ja: string; rom: string }>;
const GRAMMAR_VOCAB = grammarVocabJson as GrammarVocab;

export const appData: AppData = {
  version: appJson.expo.version,
  THEMES, LEVELS, EXAMPLES, WORD_CATEGORIES, WORDS,
  GRAMMAR_THEMES, GRAMMAR_EXAMPLES, VOCAB, GRAMMAR_VOCAB,
  // アプリ評価リンク。iosAppId は App Store の数値ID (公開後に判明)。
  // 空のままだと iOS では評価行は非表示 (Android は機能する)。
  review: { iosAppId: '6774461088', androidPackage: appJson.expo.android.package },
  audio: { nepaliAudio, japaneseAudio, nepaliGrammarAudio, japaneseGrammarAudio },
  getExamples: (themeId, levelId) => EXAMPLES[`${themeId}-${levelId}`] ?? [],
  getWords: (categoryId) => WORDS[String(categoryId)] ?? [],
  getGrammarExamples: (themeId) => GRAMMAR_EXAMPLES[String(themeId)] ?? [],
};
