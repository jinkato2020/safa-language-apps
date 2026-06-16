// 案2: 日本語=共通コア + 母語オーバーレイ を結合して AppData を作る。
// 共通コア(jp/メタ/日本語音声/読み) は全L1で共通・アプリ同梱。
// 母語オーバーレイ(訳/母語音声/辞書) は L1ごと(将来DL)。
// 画面側は従来の {jp, ne} 結合済み AppData を受け取るので、画面コードは変更不要。

import type {
  AppData, ThemeMeta, LevelMeta, WordCategoryMeta, GrammarThemeMeta, Example, Word,
  VocabEntry, GrammarVocab, JpReading,
} from '@safa/shared';

// 日本語=共通コア (学ぶ対象側)。文は位置順の配列で持ち、母語側と index で対応させる。
export interface JaCore {
  themes: ThemeMeta[];
  levels: LevelMeta[];
  wordCategories: WordCategoryMeta[];
  grammarThemes: GrammarThemeMeta[];
  examplesJp: Record<string, string[]>;  // "theme-level" → 日本語文(位置順)
  grammarJp: Record<string, string[]>;   // "theme" → 日本語文(位置順)
  wordsJa: Record<string, string[]>;     // "category" → 日本語語(位置順)
  jpReading?: JpReading;                 // 日本語文 → かな/ローマ字 (jp依存・共通)
  wordsReading?: JpReading;              // 日本語語 → かな/ローマ字 (単語モードのふりがな用)
  japaneseAudio: Record<string, number | string>;        // DL版は file:// URI(string)
  japaneseGrammarAudio: Record<string, number | string>;
}

// 母語オーバーレイ (学習者の母語側)。core と同じキー・同じ位置で対応する訳。
export interface L1Overlay {
  nativeLang: string;
  examplesL1: Record<string, string[]>;
  grammarL1: Record<string, string[]>;
  wordsL1: Record<string, string[]>;
  vocab?: Record<string, VocabEntry>;
  grammarVocab?: GrammarVocab;
  convVocab?: GrammarVocab;
  l1Audio?: Record<string, number | string>;         // → AudioBundle.nepaliAudio (L1音声。DL版はfile:// URI)
  l1GrammarAudio?: Record<string, number | string>;  // → AudioBundle.nepaliGrammarAudio
  vocabTokenize?: 'jp';                               // 'jp'=日本語文を分解(辞書も日本語語キー)。英語パック用
}

export interface ComposeOptions {
  version: string;
  review?: { iosAppId?: string | null; androidPackage?: string | null };
}

// 共通コア + 母語オーバーレイ を位置で結合し、従来形の AppData を構築する。
// 対応する母語訳が無い位置は空文字 (jp のみ表示)。
export function composePack(core: JaCore, overlay: L1Overlay, opts: ComposeOptions): AppData {
  const join = (
    jpMap: Record<string, string[]>,
    l1Map: Record<string, string[]>,
  ): Record<string, Example[]> => {
    const out: Record<string, Example[]> = {};
    for (const key of Object.keys(jpMap)) {
      const jps = jpMap[key];
      const l1s = l1Map[key] ?? [];
      out[key] = jps.map((jp, i) => ({ jp, ne: l1s[i] ?? '' }));
    }
    return out;
  };

  const EXAMPLES = join(core.examplesJp, overlay.examplesL1);
  const GRAMMAR_EXAMPLES = join(core.grammarJp, overlay.grammarL1);

  const WORDS: Record<string, Word[]> = {};
  for (const key of Object.keys(core.wordsJa)) {
    const jas = core.wordsJa[key];
    const l1s = overlay.wordsL1[key] ?? [];
    WORDS[key] = jas.map((ja, i) => ({ ja, ne: l1s[i] ?? '' }));
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
    WORDS_READING: core.wordsReading,
    vocabTokenize: overlay.vocabTokenize,
    review: opts.review,
    audio: {
      nepaliAudio: overlay.l1Audio ?? EMPTY,
      japaneseAudio: core.japaneseAudio,
      nepaliGrammarAudio: overlay.l1GrammarAudio ?? EMPTY,
      japaneseGrammarAudio: core.japaneseGrammarAudio,
    },
    getExamples: (themeId, levelId) => EXAMPLES[`${themeId}-${levelId}`] ?? [],
    getWords: (categoryId) => WORDS[String(categoryId)] ?? [],
    getGrammarExamples: (themeId) => GRAMMAR_EXAMPLES[String(themeId)] ?? [],
  };
}
