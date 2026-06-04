// 言語パックのローダ (App A)。
// ja(日本語)はアプリ同梱(現行 appData)。en は catalog.json 経由で raw からDL:
//   - オーバーレイJSON (英訳+辞書)
//   - 英語音声 zip 1個 (fflateで展開して <文ID>.mp3 を端末に保存)
// ネパール語(コア)文・音声・メタは同梱を共有。composePack で結合して AppData を作る。

import type { AppData } from '@safa/shared';
import * as FileSystem from 'expo-file-system/legacy';
import { unzipSync } from 'fflate';
import appJson from '../app.json';
import { neCore } from './appData';
import { composePack, type L1Overlay } from './pack/compose';

const CATALOG_URL =
  'https://raw.githubusercontent.com/JinKato2020/safa-language-apps/refs/heads/experiment/bangla/packs-nepali/catalog.json';

// 母語(ja/en)はすべて DL パック。ネパール語コアのみ同梱。
const BUNDLED: Record<string, AppData> = {};
const REVIEW = { iosAppId: '6771720689', androidPackage: appJson.expo.android.package };

export function bundledPack(lang: string): AppData | null {
  return BUNDLED[lang] ?? null;
}

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
  const busted = `${url}${url.includes('?') ? '&' : '?'}t=${Date.now()}`;
  const res = await fetch(busted, { cache: 'no-store' as any, headers: { 'Cache-Control': 'no-cache' } });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return res.json();
}

const sleep = (ms: number) => new Promise(r => setTimeout(r, ms));
async function withRetry<T>(fn: () => Promise<T>, tries = 3): Promise<T> {
  let last: any;
  for (let i = 0; i < tries; i++) {
    try { return await fn(); } catch (e) { last = e; if (i < tries - 1) await sleep(700 * (i + 1)); }
  }
  throw last;
}

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

async function getOverlay(lang: string, entry: any, diag?: { catalog: any; catalogErr: string }): Promise<any> {
  const uri = overlayUri(lang);
  const info = await FileSystem.getInfoAsync(uri);
  if (info.exists) {
    const cached = JSON.parse(await FileSystem.readAsStringAsync(uri));
    if (!entry || (cached.version ?? 0) >= (entry.version ?? 0)) return cached;
  }
  if (!entry?.url) {
    const langs = diag?.catalog?.packs?.map((p: any) => p.l1).join(',') || 'なし';
    throw new Error(diag?.catalog ? `catalogに${lang}無し(掲載:${langs})` : `catalog取得失敗:${diag?.catalogErr || '不明'}`);
  }
  await FileSystem.makeDirectoryAsync(packDir(lang), { intermediates: true });
  await withRetry(async () => {
    const r = await FileSystem.downloadAsync(entry.url, uri);
    if (r.status && r.status >= 400) throw new Error(`overlay HTTP ${r.status}`);
  });
  const raw = await FileSystem.readAsStringAsync(uri);
  try {
    return JSON.parse(raw);
  } catch {
    throw new Error(`overlay JSON parse失敗 (先頭: ${raw.slice(0, 40)})`);
  }
}

async function ensureAudio(lang: string, entry: any, onProgress?: ProgressFn): Promise<void> {
  if (!entry?.audioZip) return;
  const marker = audioMarkerUri(lang);
  const m = await FileSystem.getInfoAsync(marker);
  if (m.exists) {
    const v = await FileSystem.readAsStringAsync(marker);
    if (v === String(entry.audioVersion ?? '')) return;
  }
  await FileSystem.makeDirectoryAsync(audioDir(lang), { intermediates: true });

  const SCALE = 1000, DL_FRAC = 0.8;
  const zipUri = `${packDir(lang)}audio.zip`;
  const total = entry.audioZipBytes || 0;
  const dl = FileSystem.createDownloadResumable(entry.audioZip, zipUri, {}, (p: any) => {
    const exp = p.totalBytesExpectedToWrite || total || 1;
    const f = Math.min(1, p.totalBytesWritten / exp) * DL_FRAC;
    onProgress?.(Math.round(f * SCALE), SCALE, 'ダウンロード中');
  });
  await dl.downloadAsync();

  const bytes = b64ToU8(await FileSystem.readAsStringAsync(zipUri, { encoding: 'base64' as any }));
  const files = unzipSync(bytes);
  const names = Object.keys(files);
  let i = 0;
  onProgress?.(Math.round(DL_FRAC * SCALE), SCALE, '展開中');
  for (const name of names) {
    await FileSystem.writeAsStringAsync(`${audioDir(lang)}${name}`, u8ToB64(files[name]), { encoding: 'base64' as any });
    i++;
    const f = DL_FRAC + (i / names.length) * (1 - DL_FRAC);
    onProgress?.(Math.round(f * SCALE), SCALE, '展開中');
  }
  await FileSystem.writeAsStringAsync(marker, String(entry.audioVersion ?? ''));
  await FileSystem.deleteAsync(zipUri, { idempotent: true });
}

// FSの英語音声から文ID→file:// マップを構築 (会話=examplesL1 / 文法=grammarL1)。
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

/** L1パックを解決。ja=同梱。en=オーバーレイ+英語音声zipをFS/DLし neCore と結合。 */
export async function loadPack(lang: string, onProgress?: ProgressFn): Promise<AppData> {
  const bundled = BUNDLED[lang];
  if (bundled) return bundled;

  let catalog: any = null, catalogErr = '';
  try { catalog = await withRetry(() => fetchJson(CATALOG_URL)); }
  catch (e: any) { catalogErr = String(e?.message ?? e); }
  const entry = catalog?.packs?.find((p: any) => p.l1 === lang);

  const overlayJson = await getOverlay(lang, entry, { catalog, catalogErr });
  try { await ensureAudio(lang, entry, onProgress); } catch {} // 音声DL失敗でもテキストは表示
  const { l1Audio, l1GrammarAudio } = await buildAudioMaps(lang, overlayJson);

  const overlay: L1Overlay = { ...toOverlay(overlayJson), l1Audio, l1GrammarAudio };
  return composePack(neCore, overlay, { version: appJson.expo.version, review: REVIEW });
}
