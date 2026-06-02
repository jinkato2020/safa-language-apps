// 言語パックのローダ。
// ne(主言語)はアプリ同梱。それ以外(bn等)は端末FSにあれば読み、無ければ
// catalog.json 経由で raw から DL する:
//   - オーバーレイJSON (訳+辞書)
//   - 母語音声 zip 1個 (fflateで展開して <文ID>.mp3 を端末に保存)
// 取得物を共通コア(jaCore)と composePack で結合して AppData を作る。

import type { AppData } from '@safa/shared';
import * as FileSystem from 'expo-file-system/legacy';
import { unzipSync } from 'fflate';
import appJson from '../app.json';
import { appData, jaCore } from './appData';
import { composePack, type L1Overlay } from './pack/compose';

const CATALOG_URL =
  'https://raw.githubusercontent.com/JinKato2020/safa-language-apps/refs/heads/experiment/bangla/packs/catalog.json';

const BUNDLED: Record<string, AppData> = { ne: appData };

export function bundledPack(lang: string): AppData | null {
  return BUNDLED[lang] ?? null;
}

// 進捗通知 (done, total, label)。label は表示用 ("ダウンロード中"/"展開中")。
export type ProgressFn = (done: number, total: number, label?: string) => void;

const packDir = (lang: string) => `${FileSystem.documentDirectory}packs/${lang}/`;
const audioDir = (lang: string) => `${packDir(lang)}audio/`;
const overlayUri = (lang: string) => `${packDir(lang)}overlay.json`;
const audioMarkerUri = (lang: string) => `${packDir(lang)}audio.version`;

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

// base64 <-> Uint8Array (RN グローバルの atob/btoa を使用)
function b64ToU8(b64: string): Uint8Array {
  const bin = (global as any).atob(b64);
  const u8 = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) u8[i] = bin.charCodeAt(i);
  return u8;
}
function u8ToB64(u8: Uint8Array): string {
  let bin = '';
  const chunk = 0x8000;
  for (let i = 0; i < u8.length; i += chunk) {
    bin += String.fromCharCode.apply(null, Array.from(u8.subarray(i, i + chunk)));
  }
  return (global as any).btoa(bin);
}

// オーバーレイJSON取得 (オフライン=キャッシュ / 新版あれば再DL)。
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

// 母語音声zipをDL→展開 (版が新しい/未取得のときだけ)。各 <文ID>.mp3 を端末に保存。
async function ensureAudio(lang: string, entry: any, onProgress?: ProgressFn): Promise<void> {
  if (!entry?.audioZip) return;
  const marker = audioMarkerUri(lang);
  const m = await FileSystem.getInfoAsync(marker);
  if (m.exists) {
    const v = await FileSystem.readAsStringAsync(marker);
    if (v === String(entry.audioVersion ?? '')) return; // 最新キャッシュ済み
  }
  await FileSystem.makeDirectoryAsync(audioDir(lang), { intermediates: true });

  // 1) zip を1ファイルDL (進捗: バイト)
  const zipUri = `${packDir(lang)}audio.zip`;
  const total = entry.audioZipBytes || 0;
  const dl = FileSystem.createDownloadResumable(entry.audioZip, zipUri, {}, (p: any) => {
    onProgress?.(p.totalBytesWritten, p.totalBytesExpectedToWrite || total, 'ダウンロード中');
  });
  await dl.downloadAsync();

  // 2) 展開して各mp3を保存 (進捗: ファイル数)
  const bytes = b64ToU8(await FileSystem.readAsStringAsync(zipUri, { encoding: 'base64' as any }));
  const files = unzipSync(bytes);
  const names = Object.keys(files);
  let i = 0;
  onProgress?.(0, names.length, '展開中');
  for (const name of names) {
    await FileSystem.writeAsStringAsync(`${audioDir(lang)}${name}`, u8ToB64(files[name]), { encoding: 'base64' as any });
    onProgress?.(++i, names.length, '展開中');
  }
  await FileSystem.writeAsStringAsync(marker, String(entry.audioVersion ?? ''));
  await FileSystem.deleteAsync(zipUri, { idempotent: true });
}

// FSの音声から文ID→file:// マップを構築 (会話=examplesL1 / 文法=grammarL1)。
async function buildAudioMaps(lang: string, overlayJson: any) {
  const collect = (m: any) => {
    const ids: string[] = [];
    for (const [key, arr] of Object.entries(m || {})) (arr as string[]).forEach((_, i) => ids.push(`${key}-${i + 1}`));
    return ids;
  };
  const l1Audio: Record<string, string> = {};
  const l1GrammarAudio: Record<string, string> = {};
  for (const id of collect(overlayJson.examplesL1)) {
    const u = `${audioDir(lang)}${id}.mp3`;
    if ((await FileSystem.getInfoAsync(u)).exists) l1Audio[id] = u;
  }
  for (const id of collect(overlayJson.grammarL1)) {
    const u = `${audioDir(lang)}${id}.mp3`;
    if ((await FileSystem.getInfoAsync(u)).exists) l1GrammarAudio[id] = u;
  }
  return { l1Audio, l1GrammarAudio };
}

/** L1パックを解決。ne=同梱。その他=オーバーレイ+音声zipをFS/DLし結合。onProgressで進捗通知。 */
export async function loadPack(lang: string, onProgress?: ProgressFn): Promise<AppData> {
  const bundled = BUNDLED[lang];
  if (bundled) return bundled;

  let catalog: any = null;
  try { catalog = await fetchJson(CATALOG_URL); } catch {}
  const entry = catalog?.packs?.find((p: any) => p.l1 === lang);

  const overlayJson = await getOverlay(lang, entry);
  try { await ensureAudio(lang, entry, onProgress); } catch {} // 音声DL失敗でもテキストは表示
  const { l1Audio, l1GrammarAudio } = await buildAudioMaps(lang, overlayJson);

  const overlay: L1Overlay = { ...toOverlay(overlayJson), l1Audio, l1GrammarAudio };
  return composePack(jaCore, overlay, { version: appJson.expo.version });
}
