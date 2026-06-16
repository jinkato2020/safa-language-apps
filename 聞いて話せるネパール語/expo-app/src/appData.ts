// 聞いて話せるネパール語 のコア組み立て。
// 【全学習データ パック化 2026-06-16】ターゲット(ネ語)の本文/文法/単語/読み/メタは
//   core.json(packs-appa-v2/core.json)としてDL。音声もコアパック。母語(ja/en)はL1パック。
//   → アプリ本体は UI+i18n のみ同梱。学習データは一切バンドルしない。packLoader が
//   core.json と音声を取得し makeNeCore で組み、composePack で L1 と結合する。

import type { NeCore } from './pack/compose';

export type NeAudioMaps = { conv: Record<string, number | string>; gram: Record<string, number | string> };

// core.json の形 (packLoader が取得して渡す)。
export type NeCoreJson = {
  themes: any[];
  levels: any[];
  wordCategories: any[];
  grammarThemes: any[];
  examplesNe: Record<string, string[]>;
  grammarNe: Record<string, string[]>;
  wordsNe: Record<string, string[]>;
  jpReading?: any;
};

const EMPTY_CORE: NeCoreJson = {
  themes: [], levels: [], wordCategories: [], grammarThemes: [],
  examplesNe: {}, grammarNe: {}, wordsNe: {},
};

export function makeNeCore(core: NeCoreJson = EMPTY_CORE, audio: NeAudioMaps = { conv: {}, gram: {} }): NeCore {
  return {
    themes: core.themes as any,
    levels: core.levels as any,
    wordCategories: core.wordCategories as any,
    grammarThemes: core.grammarThemes as any,
    examplesNe: core.examplesNe,
    grammarNe: core.grammarNe,
    wordsNe: core.wordsNe,
    jpReading: core.jpReading,
    nepaliAudio: audio.conv,
    nepaliGrammarAudio: audio.gram,
  };
}

// DL前の空コア(フォールバック)。
export const neCore: NeCore = makeNeCore();
