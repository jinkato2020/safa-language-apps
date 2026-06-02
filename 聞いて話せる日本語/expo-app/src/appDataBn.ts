// 聞いて話せる日本語: バングラ語(bn) サンプルパック (Phase0-2 実証用・最小)。
// 案2: 日本語=共通コア(jaCore) + 母語オーバーレイ(bnOverlay) を composePack で結合。
// テーマ/レベル等のメタは既存JSONを流用。音声は無し(Phase3で外部化)。

import themesJson from '../data/themes.json';
import levelsJson from '../data/levels.json';
import wordCategoriesJson from '../data/wordCategories.json';
import grammarThemesJson from '../data/grammarThemes.json';
import appJson from '../app.json';
import type { ThemeMeta, LevelMeta, WordCategoryMeta, GrammarThemeMeta } from '@safa/shared';
import { composePack, type JaCore, type L1Overlay } from './pack/compose';

// ── 日本語=共通コア (サンプル: テーマ1のみ。本来は全テーマで App B 全L1共通) ──
const jaCore: JaCore = {
  themes: themesJson as ThemeMeta[],
  levels: levelsJson as LevelMeta[],
  wordCategories: wordCategoriesJson as WordCategoryMeta[],
  grammarThemes: grammarThemesJson as GrammarThemeMeta[],
  examplesJp: {
    '1-1': ['私の名前は田中です。', '私は日本人です。', 'はじめまして。'],
  },
  grammarJp: {
    '1': ['私は学生です。', '彼は医者です。'],
  },
  wordsJa: {
    '1': ['上', '下', '右', '左'],
  },
};

// ── バングラ語オーバーレイ (jaCore と同じキー・同じ位置で対応) ──
const bnOverlay: L1Overlay = {
  nativeLang: 'bn',
  examplesL1: {
    '1-1': ['আমার নাম তানাকা।', 'আমি জাপানি।', 'আপনার সাথে পরিচিত হয়ে ভালো লাগলো।'],
  },
  grammarL1: {
    '1': ['আমি ছাত্র।', 'সে ডাক্তার।'],
  },
  wordsL1: {
    '1': ['উপরে', 'নিচে', 'ডান', 'বাম'],
  },
};

export const appDataBn = composePack(jaCore, bnOverlay, appJson.expo.version);
