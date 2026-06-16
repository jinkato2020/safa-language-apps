// 聞いて話せる英語 のデータ束ね。
// en=学習対象(コア) / ja=母語(L1)。母語は1つ(ja)。
// 【パック化 2026-06-16】テキスト(例題/訳/辞書/単語)は同梱、音声(en+ja)はDLパック(packs-appc)。
//   音声はDL後に file:// マップとして compose に渡す(差分DL対応 → packLoader.ts)。
//   composePack の audio マップは number(require)でも string(file://)でも可。

import themesJson from '../data/themes.json';
import levelsJson from '../data/levels.json';
import examplesJson from '../data/examples.json';
import grammarThemesJson from '../data/grammarThemes.json';
import grammarExamplesJson from '../data/grammarExamples.json';
import dictJson from '../data/dict.json';
import wordCategoriesJson from '../data/wordCategories.json';
import wordsJson from '../data/words.json';
import appJson from '../app.json';
import type { ThemeMeta, LevelMeta, GrammarThemeMeta, WordCategoryMeta, Word, AppData } from '@safa/shared';
import { composePack, type JaCore, type L1Overlay } from './pack/compose';

type Pair = { en: string; ja: string };
const THEMES = themesJson as ThemeMeta[];
const LEVELS = levelsJson as LevelMeta[];
const GRAMMAR_THEMES = grammarThemesJson as GrammarThemeMeta[];
const EXAMPLES = examplesJson as Record<string, Pair[]>;
const GRAMMAR = grammarExamplesJson as Record<string, Pair[]>;
const WORD_CATEGORIES = wordCategoriesJson as WordCategoryMeta[];
const WORDS = wordsJson as Record<string, Word[]>;

const pick = (m: Record<string, Pair[]>, key: 'en' | 'ja'): Record<string, string[]> =>
  Object.fromEntries(Object.entries(m).map(([k, arr]) => [k, arr.map(e => e[key] ?? '')]));
const pickWordJa = (m: Record<string, Word[]>): Record<string, string[]> =>
  Object.fromEntries(Object.entries(m).map(([k, arr]) => [k, arr.map(w => w.ja)]));
const pickWordNe = (m: Record<string, Word[]>): Record<string, string[]> =>
  Object.fromEntries(Object.entries(m).map(([k, arr]) => [k, arr.map(w => w.ne)]));

// 音声マップ(DLで file:// が入る。未DL時は空)。
export type AudioMaps = {
  enConv: Record<string, string | number>;
  enGram: Record<string, string | number>;
  jaConv: Record<string, string | number>;
  jaGram: Record<string, string | number>;
};
const EMPTY_AUDIO: AudioMaps = { enConv: {}, enGram: {}, jaConv: {}, jaGram: {} };

// ── 英語=共通コア(学習対象。compose上は「Jp」スロット) テキストのみ ──
function makeEnCore(audio: AudioMaps): JaCore {
  return {
    themes: THEMES,
    levels: LEVELS,
    wordCategories: WORD_CATEGORIES,
    grammarThemes: GRAMMAR_THEMES,
    examplesJp: pick(EXAMPLES, 'en'),
    grammarJp: pick(GRAMMAR, 'en'),
    wordsJa: pickWordJa(WORDS),
    jpReading: undefined,
    wordsReading: undefined,
    japaneseAudio: audio.enConv,            // 英語(学習対象)音声 (DL: file://)
    japaneseGrammarAudio: audio.enGram,
  };
}
// ── 日本語=母語オーバーレイ テキストのみ ──
function makeJaOverlay(audio: AudioMaps): L1Overlay {
  return {
    nativeLang: 'ja',
    examplesL1: pick(EXAMPLES, 'ja'),
    grammarL1: pick(GRAMMAR, 'ja'),
    wordsL1: pickWordNe(WORDS),
    vocab: {},
    convVocab: (dictJson as any).convVocab,
    grammarVocab: (dictJson as any).grammarVocab,
    l1Audio: audio.jaConv,                  // 日本語(母語)音声 (DL: file://)
    l1GrammarAudio: audio.jaGram,
    vocabTokenize: 'jp',
  };
}

// 音声マップを与えて AppData を合成 (packLoader が DL後に呼ぶ)。
export function composeAppC(audio: AudioMaps = EMPTY_AUDIO): AppData {
  return composePack(makeEnCore(audio), makeJaOverlay(audio), {
    version: appJson.expo.version,
    review: { iosAppId: null, androidPackage: appJson.expo.android.package },
  });
}

// 音声未DL時の暫定 AppData(テキストのみ)。後方互換のため appData も残す。
export const appData: AppData = composeAppC();
