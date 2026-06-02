// 案2: 日本語=共通コア + 母語オーバーレイ を結合して AppData を作る。
// 共通コア(jp/メタ) は全L1で共通・アプリ同梱。母語オーバーレイ(訳) は L1ごと(将来DL)。
// 画面側は従来の {jp, ne} 結合済み AppData を受け取るので、画面コードは変更不要。

import type {
  AppData, ThemeMeta, LevelMeta, WordCategoryMeta, GrammarThemeMeta, Example, Word,
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
}

// 母語オーバーレイ (学習者の母語側)。core と同じキー・同じ位置で対応する訳。
export interface L1Overlay {
  nativeLang: string;
  examplesL1: Record<string, string[]>;
  grammarL1: Record<string, string[]>;
  wordsL1: Record<string, string[]>;
}

// 共通コア + 母語オーバーレイ を位置で結合し、従来形の AppData を構築する。
// 対応する母語訳が無い位置は空文字 (jp のみ表示)。
export function composePack(core: JaCore, overlay: L1Overlay, version: string): AppData {
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
    version,
    nativeLang: overlay.nativeLang,
    THEMES: core.themes,
    LEVELS: core.levels,
    EXAMPLES,
    WORD_CATEGORIES: core.wordCategories,
    WORDS,
    GRAMMAR_THEMES: core.grammarThemes,
    GRAMMAR_EXAMPLES,
    VOCAB: {},
    // 音声は Phase3 で外部化。サンプルでは無し。
    review: { iosAppId: null, androidPackage: null },
    audio: {
      nepaliAudio: EMPTY, japaneseAudio: EMPTY,
      nepaliGrammarAudio: EMPTY, japaneseGrammarAudio: EMPTY,
    },
    getExamples: (themeId, levelId) => EXAMPLES[`${themeId}-${levelId}`] ?? [],
    getWords: (categoryId) => WORDS[String(categoryId)] ?? [],
    getGrammarExamples: (themeId) => GRAMMAR_EXAMPLES[String(themeId)] ?? [],
  };
}
