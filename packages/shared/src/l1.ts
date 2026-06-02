// L1 (学習者の母語 / 第2言語) レジストリ。
// アプリを「ネパール語固定」から「母語を選べる多言語」へ一般化するための足場。
// 言語別の付随ロジック (ローマ字補助・助詞除外など) をここに集約し、
// 画面側は getL1(code) 経由で取得する。ne は従来と完全に同じ挙動を維持する。

import { toRomaji, sentenceToRomaji, sentenceToRomajiWithDict } from './transliterate';

export type L1Code = string;

export interface L1Config {
  code: L1Code;
  /** 母語の自称表示 (例: नेपाली, বাংলা) */
  name: string;
  /** 単語のローマ字化 (無い言語は undefined → ローマ字補助を出さない) */
  romanizeWord?: (word: string) => string;
  /** 文のローマ字化 */
  romanizeSentence?: (sentence: string) => string;
  /** 辞書フォールバック付きの文ローマ字化 */
  romanizeSentenceWithDict?: (sentence: string, romOf: (word: string) => string | undefined) => string;
}

export const L1_REGISTRY: Record<string, L1Config> = {
  ne: {
    code: 'ne',
    name: 'नेपाली',
    romanizeWord: toRomaji,
    romanizeSentence: sentenceToRomaji,
    romanizeSentenceWithDict: sentenceToRomajiWithDict,
  },
  // バングラ語: ローマ字補助なし
  bn: {
    code: 'bn',
    name: 'বাংলা',
  },
};

/** code に対応する L1 設定を返す。未知/未指定なら ne にフォールバック。 */
export function getL1(code: string | undefined): L1Config {
  return (code && L1_REGISTRY[code]) || L1_REGISTRY['ne'];
}
