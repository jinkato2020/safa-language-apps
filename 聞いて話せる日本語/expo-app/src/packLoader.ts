// 言語パックのローダ。
// ne(主言語)はアプリ同梱。それ以外(bn等)は端末FSにあれば読み、無ければ
// catalog.json 経由で raw からDL(オーバーレイJSON + 母語音声mp3)→保存→読む。
// 取得物を共通コア(jaCore)と composePack で結合して AppData を作る。

import type { AppData } from '@safa/shared';
import * as FileSystem from 'expo-file-system/legacy';
import appJson from '../app.json';
import { appData, jaCore } from './appData';
import { composePack, type L1Overlay } from './pack/compose';

const CATALOG_URL =
  'https://raw.githubusercontent.com/JinKato2020/safa-language-apps/refs/heads/experiment/bangla/packs/catalog.json';

const BUNDLED: Record<string, AppData> = { ne: appData };

export function bundledPack(lang: string): AppData | null {
  return BUNDLED[lang] ?? null;
}

// DL進捗コールバック (done, total)。total=0 はオーバーレイ取得中。
export type ProgressFn = (done: number, total: number) => void;

const packDir = (lang: string) => `${FileSystem.documentDirectory}packs/${lang}/`;
const audioDir = (lang: string) => `${packDir(lang)}audio/`;
const overlayUri = (lang: string) => `${packDir(lang)}overlay.json`;

function toOverlay(json: any): L1Overlay {
  return {
    nativeLang: json.l1,
    examplesL1: json.examplesL1 ?? {},
    grammarL1: json.grammarL1 ?? {},
    wordsL1: json.wordsL1 ?? {},
    convVocab: json.convVocab,
    grammarVocab: json.grammarVocab,
    vocab: json.vocab,
  };
}

async function fetchJson(url: string): Promise<any> {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`fetch ${url} -> ${res.status}`);
  return res.json();
}

// オーバーレイJSONを取得 (オフライン=キャッシュ / 新版あれば再DL)。
async function getOverlay(lang: string, entry: any): Promise<any> {
  const uri = overlayUri(lang);
  const info = await FileSystem.getInfoAsync(uri);
  if (info.exists) {
    const cached = JSON.parse(await FileSystem.readAsStringAsync(uri));
    if (!entry || (cached.version ?? 0) >= (entry.version ?? 0)) return cached;
  }
  if (!entry?.url) throw new Error(`offline or pack not in catalog: ${lang}`);
  await FileSystem.makeDirectoryAsync(packDir(lang), { intermediates: true });
  await FileSystem.downloadAsync(entry.url, uri);
  return JSON.parse(await FileSystem.readAsStringAsync(uri));
}

// 母語音声を取得。会話(examplesL1)=文ID"テーマ-レベル-番号"、文法(grammarL1)=文ID"テーマ-番号"。
// FSにあれば使い、無ければ audioBase からDL。戻り値: { l1Audio(会話), l1GrammarAudio(文法) }。
async function getAudio(
  lang: string, overlayJson: any, audioBase: string | undefined, onProgress?: ProgressFn,
): Promise<{ l1Audio: Record<string, string>; l1GrammarAudio: Record<string, string> }> {
  const collect = (m: any) => {
    const ids: string[] = [];
    for (const [key, arr] of Object.entries(m || {})) (arr as string[]).forEach((_, i) => ids.push(`${key}-${i + 1}`));
    return ids;
  };
  const convIds = collect(overlayJson.examplesL1);
  const gramIds = collect(overlayJson.grammarL1);
  const l1Audio: Record<string, string> = {};
  const l1GrammarAudio: Record<string, string> = {};
  const total = convIds.length + gramIds.length;
  if (!total) return { l1Audio, l1GrammarAudio };

  await FileSystem.makeDirectoryAsync(audioDir(lang), { intermediates: true });
  let done = 0;
  onProgress?.(0, total);
  const fetchOne = async (id: string, map: Record<string, string>) => {
    const uri = `${audioDir(lang)}${id}.mp3`;
    const info = await FileSystem.getInfoAsync(uri);
    if (!info.exists && audioBase) {
      try { await FileSystem.downloadAsync(`${audioBase}/${id}.mp3`, uri); } catch {}
    }
    const after = await FileSystem.getInfoAsync(uri);
    if (after.exists) map[id] = uri;
    onProgress?.(++done, total);
  };
  for (const id of convIds) await fetchOne(id, l1Audio);
  for (const id of gramIds) await fetchOne(id, l1GrammarAudio);
  return { l1Audio, l1GrammarAudio };
}

/** L1パックを解決。ne=同梱。その他=オーバーレイ+音声をFS/DLし結合。onProgressで進捗通知。 */
export async function loadPack(lang: string, onProgress?: ProgressFn): Promise<AppData> {
  const bundled = BUNDLED[lang];
  if (bundled) return bundled;

  let catalog: any = null;
  try { catalog = await fetchJson(CATALOG_URL); } catch {}
  const entry = catalog?.packs?.find((p: any) => p.l1 === lang);

  const overlayJson = await getOverlay(lang, entry);
  const { l1Audio, l1GrammarAudio } = await getAudio(lang, overlayJson, entry?.audioBase, onProgress);

  const overlay: L1Overlay = { ...toOverlay(overlayJson), l1Audio, l1GrammarAudio };
  return composePack(jaCore, overlay, { version: appJson.expo.version });
}
