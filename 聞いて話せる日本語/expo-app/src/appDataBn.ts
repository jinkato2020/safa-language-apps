// 聞いて話せる日本語: バングラ語(bn) 手打ちサンプルパック (Phase0 実証用・最小)。
// テキストは少量、音声なし。テーマ/レベル等のメタは ne パックと共有 (表示は i18n)。
// 本文の bn テキストは Example/Word の .ne フィールドに格納する (L1テキストとして流用)。

import themesJson from '../data/themes.json';
import levelsJson from '../data/levels.json';
import wordCategoriesJson from '../data/wordCategories.json';
import grammarThemesJson from '../data/grammarThemes.json';
import appJson from '../app.json';
import type {
  AppData, ThemeMeta, LevelMeta, Example, WordCategoryMeta, Word, GrammarThemeMeta,
} from '@safa/shared';

const THEMES = themesJson as ThemeMeta[];
const LEVELS = levelsJson as LevelMeta[];
const WORD_CATEGORIES = wordCategoriesJson as WordCategoryMeta[];
const GRAMMAR_THEMES = grammarThemesJson as GrammarThemeMeta[];

// 会話例 (テーマ1・初級)
const EXAMPLES: Record<string, Example[]> = {
  '1-1': [
    { jp: '私の名前は田中です。', ne: 'আমার নাম তানাকা।' },
    { jp: '私は日本人です。', ne: 'আমি জাপানি।' },
    { jp: 'はじめまして。', ne: 'আপনার সাথে পরিচিত হয়ে ভালো লাগলো।' },
  ],
};

// 単語 (カテゴリ1)
const WORDS: Record<string, Word[]> = {
  '1': [
    { ja: '上', ne: 'উপরে' },
    { ja: '下', ne: 'নিচে' },
    { ja: '右', ne: 'ডান' },
    { ja: '左', ne: 'বাম' },
  ],
};

// 文法例 (テーマ1)
const GRAMMAR_EXAMPLES: Record<string, Example[]> = {
  '1': [
    { jp: '私は学生です。', ne: 'আমি ছাত্র।' },
    { jp: '彼は医者です。', ne: 'সে ডাক্তার।' },
  ],
};

const EMPTY_AUDIO = {} as Record<string, number>;

export const appDataBn: AppData = {
  version: appJson.expo.version,
  nativeLang: 'bn',
  THEMES, LEVELS, EXAMPLES, WORD_CATEGORIES, WORDS,
  GRAMMAR_THEMES, GRAMMAR_EXAMPLES,
  VOCAB: {},
  // GRAMMAR_VOCAB / CONV_VOCAB / JP_READING はサンプルでは未提供 (任意)
  review: { iosAppId: null, androidPackage: null },
  audio: {
    nepaliAudio: EMPTY_AUDIO,
    japaneseAudio: EMPTY_AUDIO,
    nepaliGrammarAudio: EMPTY_AUDIO,
    japaneseGrammarAudio: EMPTY_AUDIO,
  },
  getExamples: (themeId, levelId) => EXAMPLES[`${themeId}-${levelId}`] ?? [],
  getWords: (categoryId) => WORDS[String(categoryId)] ?? [],
  getGrammarExamples: (themeId) => GRAMMAR_EXAMPLES[String(themeId)] ?? [],
};
