// 言語パックのローダ。
// ne(主言語)はアプリ同梱。それ以外(bn等)の母語オーバーレイは
// 端末FSにあれば読み、無ければ catalog.json 経由で raw からDL→保存→読む。
// 取得したオーバーレイを共通コア(jaCore)と composePack で結合して AppData を作る。

import type { AppData } from '@safa/shared';
import * as FileSystem from 'expo-file-system/legacy';
import appJson from '../app.json';
import { appData, jaCore } from './appData';
import { composePack, type L1Overlay } from './pack/compose';

// パックカタログ (raw配信)。本番化時は main の packs/ を指すURLに差し替える。
const CATALOG_URL =
  'https://raw.githubusercontent.com/JinKato2020/safa-language-apps/refs/heads/experiment/bangla/packs/catalog.json';

// アプリ同梱パック (主言語のみ)。
const BUNDLED: Record<string, AppData> = { ne: appData };

/** 同期的に解決できる同梱パック。DLが必要な言語は null (PackGateがローディング表示)。 */
export function bundledPack(lang: string): AppData | null {
  return BUNDLED[lang] ?? null;
}

const packDir = (lang: string) => `${FileSystem.documentDirectory}packs/${lang}/`;
const overlayUri = (lang: string) => `${packDir(lang)}overlay.json`;

function toOverlay(json: any): L1Overlay {
  return {
    nativeLang: json.l1,
    examplesL1: json.examplesL1 ?? {},
    grammarL1: json.grammarL1 ?? {},
    wordsL1: json.wordsL1 ?? {},
  };
}

async function fetchJson(url: string): Promise<any> {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`fetch ${url} -> ${res.status}`);
  return res.json();
}

// 母語オーバーレイを取得。
// オフライン: キャッシュがあれば使う。オンライン: カタログ版がキャッシュ版より新しければ再DL。
async function getOverlay(lang: string): Promise<L1Overlay> {
  const uri = overlayUri(lang);
  const info = await FileSystem.getInfoAsync(uri);

  // カタログ取得 (失敗=オフライン扱い)
  let catalog: any = null;
  try { catalog = await fetchJson(CATALOG_URL); } catch {}
  const entry = catalog?.packs?.find((p: any) => p.l1 === lang);

  if (info.exists) {
    const cached = JSON.parse(await FileSystem.readAsStringAsync(uri));
    // オフライン、またはキャッシュが最新 → キャッシュを使う
    if (!entry || (cached.version ?? 0) >= (entry.version ?? 0)) return toOverlay(cached);
  }

  // 新規 or 旧版 → DL (オフラインかつ未キャッシュは失敗)
  if (!entry?.url) throw new Error(`offline or pack not in catalog: ${lang}`);
  await FileSystem.makeDirectoryAsync(packDir(lang), { intermediates: true });
  await FileSystem.downloadAsync(entry.url, uri);
  return toOverlay(JSON.parse(await FileSystem.readAsStringAsync(uri)));
}

/** L1コードに対応するパックを解決する。ne=同梱、その他=FS/DLの母語オーバーレイを結合。 */
export async function loadPack(lang: string): Promise<AppData> {
  const bundled = BUNDLED[lang];
  if (bundled) return bundled;
  const overlay = await getOverlay(lang);
  return composePack(jaCore, overlay, { version: appJson.expo.version });
}
