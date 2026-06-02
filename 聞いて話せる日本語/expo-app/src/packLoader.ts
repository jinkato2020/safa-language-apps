// 言語パックのローダ (継ぎ目)。
// 現在はバンドル済みパックを即時返すだけ。将来ここを
// 「端末FSにあれば読む / 無ければ GitHub Releases からDL→保存→読む」(Phase2) に差し替える。

import type { AppData } from '@safa/shared';
import { appData } from './appData';
import { appDataBn } from './appDataBn';

// バンドル同梱のパック (既定)。
const BUNDLED: Record<string, AppData> = { ne: appData, bn: appDataBn };

/** 同期的に解決できる既定パック (初期表示のちらつき防止用)。未知なら ne。 */
export function bundledPack(lang: string): AppData {
  return BUNDLED[lang] ?? appData;
}

/** L1コードに対応するパックを解決する。今はバンドルを即時返す。将来 FS/DL に対応。 */
export async function loadPack(lang: string): Promise<AppData> {
  return BUNDLED[lang] ?? appData;
}
