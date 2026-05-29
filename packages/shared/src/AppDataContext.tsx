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

export type AppData = {
  THEMES: ThemeMeta[];
  LEVELS: LevelMeta[];
  EXAMPLES: Record<string, Example[]>;
  WORD_CATEGORIES: WordCategoryMeta[];
  WORDS: Record<string, Word[]>;
  GRAMMAR_THEMES: GrammarThemeMeta[];
  GRAMMAR_EXAMPLES: Record<string, Example[]>;
  VOCAB: Record<string, VocabEntry>;
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
