// 聞いて話せる日本語 のコア組み立て。
// 【全学習データ パック化 2026-06-16】ターゲット(日本語)の本文/文法/単語/読み/メタは
//   core.json(packs-appb-v2/core.json)としてDL。音声もコアパック。母語(bn/en/vi/ne/zh)はL1パック。
//   → 本体は UI+i18n のみ同梱。学習データはバンドルしない。packLoader が core.json と音声を
//   取得し makeJaCore で組み、composePack で L1 と結合する。

import type { JaCore } from './pack/compose';

export type JaAudioMaps = { conv: Record<string, number | string>; gram: Record<string, number | string> };

export type JaCoreJson = {
  themes: any[];
  levels: any[];
  wordCategories: any[];
  grammarThemes: any[];
  examplesJp: Record<string, string[]>;
  grammarJp: Record<string, string[]>;
  wordsJa: Record<string, string[]>;
  jpReading?: any;
  wordsReading?: any;
};

const EMPTY_CORE: JaCoreJson = {
  themes: [], levels: [], wordCategories: [], grammarThemes: [],
  examplesJp: {}, grammarJp: {}, wordsJa: {},
};

export function makeJaCore(core: JaCoreJson = EMPTY_CORE, audio: JaAudioMaps = { conv: {}, gram: {} }): JaCore {
  return {
    themes: core.themes as any,
    levels: core.levels as any,
    wordCategories: core.wordCategories as any,
    grammarThemes: core.grammarThemes as any,
    examplesJp: core.examplesJp,
    grammarJp: core.grammarJp,
    wordsJa: core.wordsJa,
    jpReading: core.jpReading,
    wordsReading: core.wordsReading,
    japaneseAudio: audio.conv,
    japaneseGrammarAudio: audio.gram,
  };
}

// DL前の空コア(フォールバック)。
export const jaCore: JaCore = makeJaCore();
