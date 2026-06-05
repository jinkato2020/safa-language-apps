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

// 音声ソース: 同梱は require() の数値、DLパックは file:// などの URI 文字列。
export type AudioSrc = number | string;
export type AudioBundle = {
  nepaliAudio: Record<string, AudioSrc>;
  japaneseAudio: Record<string, AudioSrc>;
  nepaliGrammarAudio: Record<string, AudioSrc>;
  japaneseGrammarAudio: Record<string, AudioSrc>;
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

// 日本語文の読み補助 (ネパール語話者向け、Claude API 生成)
// 聞き流しモードで言語=ネパール語のとき、日本語カードに かな+ローマ字 を表示する。
export type JpReadingEntry = {
  kana: string;    // 全文の読み仮名 (文脈に応じ ひらがな/カタカナ)
  romaji: string;  // ヘボン式ローマ字
};
export type JpReading = Record<string, JpReadingEntry>;  // キー = 日本語文そのまま

export type AppData = {
  /** アプリの版数 (各アプリの app.json の expo.version) */
  version: string;
  /** 学習者の母語/第2言語コード (例: 'ne', 'bn')。未指定なら 'ne' 扱い。多言語化の足場。 */
  nativeLang?: string;
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
  /** 文脈依存辞書 (会話モード用、Claude API 生成。sentence_id = テーマ-レベル-例題) */
  CONV_VOCAB?: GrammarVocab;
  /** 日本語文の読み補助 (かな+ローマ字)。聞き流しのネパール語UI時に使用。Claude API 生成 */
  JP_READING?: JpReading;
  /** 単語分解の対象。既定=L1文(ex.ne)を分解し辞書もL1語キー。'jp'=日本語文(ex.jp)を分解し辞書は日本語語キー(App B 英語パック=学習対象の日本語を分解)。 */
  vocabTokenize?: 'jp';
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
