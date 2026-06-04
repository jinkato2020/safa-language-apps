// 案2 (App A版): ネパール語=共通コア + 母語オーバーレイ(jp/en) を結合して AppData を作る。
// 共通コア(ネパール語文/メタ/ネパール語音声) は全L1で共通・アプリ同梱。
// 母語オーバーレイ(訳/母語音声/辞書) は L1ごと。jp=同梱, en=DL。
// 画面側は従来の {jp, ne} 結合済み AppData を受け取る (jp=母語側, ne=ネパール語)。

import type {
  AppData, ThemeMeta, LevelMeta, WordCategoryMeta, GrammarThemeMeta, Example, Word,
  VocabEntry, GrammarVocab, JpReading,
} from '@safa/shared';

// ネパール語=共通コア (学ぶ対象側)。位置順の配列で持ち、母語側と index で対応。
export interface NeCore {
  themes: ThemeMeta[];
  levels: LevelMeta[];
  wordCategories: WordCategoryMeta[];
  grammarThemes: GrammarThemeMeta[];
  examplesNe: Record<string, string[]>;  // "theme-level" → ネパール語文(位置順)
  grammarNe: Record<string, string[]>;   // "theme" → ネパール語文(位置順)
  wordsNe: Record<string, string[]>;     // "category" → ネパール語語(位置順)
  jpReading?: JpReading;                 // 日本語読み(jp overlay時のみ有効, enでは未使用)
  nepaliAudio: Record<string, number>;
  nepaliGrammarAudio: Record<string, number>;
}

// 母語オーバーレイ (学習者の母語側=jp/en)。core と同じキー・同じ位置で対応。
export interface L1Overlay {
  nativeLang: string;
  examplesL1: Record<string, string[]>;
  grammarL1: Record<string, string[]>;
  wordsL1: Record<string, string[]>;
  vocab?: Record<string, VocabEntry>;
  grammarVocab?: GrammarVocab;
  convVocab?: GrammarVocab;
  l1Audio?: Record<string, number | string>;        // → AudioBundle.japaneseAudio (母語側音声)
  l1GrammarAudio?: Record<string, number | string>;
}

export interface ComposeOptions {
  version: string;
  review?: { iosAppId?: string | null; androidPackage?: string | null };
}

// 共通コア(ne) + 母語オーバーレイ(jp/en) を位置で結合し、従来形 AppData を構築。
// Example は {jp:母語側, ne:ネパール語}。対応する母語訳が無い位置は空文字。
export function composePack(core: NeCore, overlay: L1Overlay, opts: ComposeOptions): AppData {
  const joinEx = (
    neMap: Record<string, string[]>,
    l1Map: Record<string, string[]>,
  ): Record<string, Example[]> => {
    const out: Record<string, Example[]> = {};
    for (const key of Object.keys(neMap)) {
      const nes = neMap[key];
      const l1s = l1Map[key] ?? [];
      out[key] = nes.map((ne, i) => ({ jp: l1s[i] ?? '', ne }));
    }
    return out;
  };

  const EXAMPLES = joinEx(core.examplesNe, overlay.examplesL1);
  const GRAMMAR_EXAMPLES = joinEx(core.grammarNe, overlay.grammarL1);

  const WORDS: Record<string, Word[]> = {};
  for (const key of Object.keys(core.wordsNe)) {
    const nes = core.wordsNe[key];
    const l1s = overlay.wordsL1[key] ?? [];
    WORDS[key] = nes.map((ne, i) => ({ ja: l1s[i] ?? '', ne }));
  }

  const EMPTY = {} as Record<string, number>;
  return {
    version: opts.version,
    nativeLang: overlay.nativeLang,
    THEMES: core.themes,
    LEVELS: core.levels,
    EXAMPLES,
    WORD_CATEGORIES: core.wordCategories,
    WORDS,
    GRAMMAR_THEMES: core.grammarThemes,
    GRAMMAR_EXAMPLES,
    VOCAB: overlay.vocab ?? {},
    GRAMMAR_VOCAB: overlay.grammarVocab,
    CONV_VOCAB: overlay.convVocab,
    JP_READING: core.jpReading,
    review: opts.review,
    audio: {
      nepaliAudio: core.nepaliAudio,
      japaneseAudio: overlay.l1Audio ?? EMPTY,
      nepaliGrammarAudio: core.nepaliGrammarAudio,
      japaneseGrammarAudio: overlay.l1GrammarAudio ?? EMPTY,
    },
    getExamples: (themeId, levelId) => EXAMPLES[`${themeId}-${levelId}`] ?? [],
    getWords: (categoryId) => WORDS[String(categoryId)] ?? [],
    getGrammarExamples: (themeId) => GRAMMAR_EXAMPLES[String(themeId)] ?? [],
  };
}
