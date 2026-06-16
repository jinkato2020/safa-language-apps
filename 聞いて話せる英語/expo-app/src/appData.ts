// 聞いて話せる英語 のコア組み立て。en=学習対象(コア) / ja=母語(L1)。
// 【全学習データ パック化 2026-06-16】本文/文法/単語/辞書/メタは全てDLパック:
//   core.json(英語コア) + overlay-ja.json(日本語訳+辞書) + 音声(en/ja)。本体は UI+i18n のみ。
//   packLoader が core.json / overlay-ja.json / 音声 を取得し composeAppC で結合する。

import type { AppData } from '@safa/shared';
import { composePack, type JaCore, type L1Overlay } from './pack/compose';
import appJson from '../app.json';

export type AudioMaps = {
  enConv: Record<string, number | string>;
  enGram: Record<string, number | string>;
  jaConv: Record<string, number | string>;
  jaGram: Record<string, number | string>;
};
const EMPTY_AUDIO: AudioMaps = { enConv: {}, enGram: {}, jaConv: {}, jaGram: {} };

// core.json (英語コア) の形
export type EnCoreJson = {
  themes: any[]; levels: any[]; wordCategories: any[]; grammarThemes: any[];
  examplesEn: Record<string, string[]>; grammarEn: Record<string, string[]>; wordsEn: Record<string, string[]>;
};
// overlay-ja.json (日本語オーバーレイ) の形
export type JaOverlayJson = {
  examplesL1: Record<string, string[]>; grammarL1: Record<string, string[]>; wordsL1: Record<string, string[]>;
  convVocab?: any; grammarVocab?: any; vocab?: any;
};
const EMPTY_CORE: EnCoreJson = { themes: [], levels: [], wordCategories: [], grammarThemes: [], examplesEn: {}, grammarEn: {}, wordsEn: {} };
const EMPTY_OVERLAY: JaOverlayJson = { examplesL1: {}, grammarL1: {}, wordsL1: {} };

export function composeAppC(core: EnCoreJson = EMPTY_CORE, overlay: JaOverlayJson = EMPTY_OVERLAY, audio: AudioMaps = EMPTY_AUDIO): AppData {
  const enCore: JaCore = {
    themes: core.themes as any,
    levels: core.levels as any,
    wordCategories: core.wordCategories as any,
    grammarThemes: core.grammarThemes as any,
    examplesJp: core.examplesEn,
    grammarJp: core.grammarEn,
    wordsJa: core.wordsEn,
    jpReading: undefined,
    wordsReading: undefined,
    japaneseAudio: audio.enConv,
    japaneseGrammarAudio: audio.enGram,
  };
  const jaOverlay: L1Overlay = {
    nativeLang: 'ja',
    examplesL1: overlay.examplesL1,
    grammarL1: overlay.grammarL1,
    wordsL1: overlay.wordsL1,
    vocab: overlay.vocab ?? {},
    convVocab: overlay.convVocab,
    grammarVocab: overlay.grammarVocab,
    l1Audio: audio.jaConv,
    l1GrammarAudio: audio.jaGram,
    vocabTokenize: 'jp',
  };
  return composePack(enCore, jaOverlay, {
    version: appJson.expo.version,
    review: { iosAppId: null, androidPackage: appJson.expo.android.package },
  });
}

// DL前の空 AppData(フォールバック)。
export const appData: AppData = composeAppC();
