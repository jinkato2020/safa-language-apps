// アプリ別のデータ (テーマ・例題・単語・音声ファイル) を Context で注入する。
//
// 各アプリの App.tsx で以下のように使う:
//   import { AppDataProvider } from '@safa/shared';
//   import { appData } from './src/appData';
//   <AppDataProvider data={appData}>
//
// 画面側は:
//   import { useAppData } from '@safa/shared';
//   const { THEMES, getExamples, audio } = useAppData();
//
// audioMap.ts はビルド時に require() でバンドルされる必要があるため、
// 「audio object そのもの」をアプリ側で組み立てて渡してもらう。

import { createContext, useContext, type ReactNode } from 'react';
import type {
  ThemeMeta, LevelMeta, Example, WordCategoryMeta, Word, GrammarThemeMeta,
} from './types';

export type AudioBundle = {
  nepaliAudio: Record<string, number>;
  japaneseAudio: Record<string, number>;
  nepaliGrammarAudio: Record<string, number>;
  japaneseGrammarAudio: Record<string, number>;
};

export type VocabEntry = { ja: string; rom: string };

// 文脈依存辞書 (Claude API で生成)
// 同じ単語が文脈ごとに異なる訳・解説を持つ
export type GrammarVocabContext = {
  sentence_id: string;  // 例: "1-3" (themeId-exampleNo)
  ja: string;
  pos?: string | null;   // 品詞・活用情報
  note?: string | null;  // 文法解説
};
export type GrammarVocabEntry = {
  rom: string;
  base_form?: string | null;    // 動詞の不定詞、形容詞の基本形等 (該当なし=null)
  base_meaning?: string | null; // 辞書的な基本意味
  contexts: GrammarVocabContext[];
};
export type GrammarVocab = Record<string, GrammarVocabEntry>;

export type AppData = {
  /** アプリの版数 (各アプリの app.json の expo.version) */
  version: string;
  THEMES: ThemeMeta[];
  LEVELS: LevelMeta[];
  EXAMPLES: Record<string, Example[]>;
  WORD_CATEGORIES: WordCategoryMeta[];
  WORDS: Record<string, Word[]>;
  GRAMMAR_THEMES: GrammarThemeMeta[];
  GRAMMAR_EXAMPLES: Record<string, Example[]>;
  VOCAB: Record<string, VocabEntry>;
  /** 文脈依存辞書 (文法モード用、Claude API 生成。シート単位で部分提供可) */
  GRAMMAR_VOCAB?: GrammarVocab;
  /** アプリ評価リンク用のストア情報 (アプリ側で提供)。iosAppId が無ければ iOS では非表示。 */
  review?: { iosAppId?: string | null; androidPackage?: string | null };
  audio: AudioBundle;
  // ── 派生ヘルパー (アプリ側で実装してもらう) ──
  getExamples: (themeId: number, levelId: number) => Example[];
  getWords: (categoryId: number) => Word[];
  getGrammarExamples: (themeId: number) => Example[];
};

const Ctx = createContext<AppData | null>(null);

export function AppDataProvider({ children, data }: { children: ReactNode; data: AppData }) {
  return <Ctx.Provider value={data}>{children}</Ctx.Provider>;
}

export function useAppData(): AppData {
  const v = useContext(Ctx);
  if (!v) throw new Error('useAppData() must be inside <AppDataProvider>');
  return v;
}
