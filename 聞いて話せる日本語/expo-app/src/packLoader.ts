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
import { jaCore } from './appData';
import { composePack, type L1Overlay } from './pack/compose';

// 本番配信: GitHub Release (tag: packs-appb)。publish-packs-appb.yml が experiment/bangla から自動公開。
const CATALOG_URL =
  'https://github.com/JinKato2020/safa-language-apps/releases/download/packs-appb/catalog.json';

// 母語(ne/bn)はすべて DL パック。アプリ同梱の母語データは無し。
const BUNDLED: Record<string, AppData> = {};

// アプリ評価リンク (composePack に渡す)。iosAppId は App Store の数値ID。
const REVIEW = { iosAppId: '6774461088', androidPackage: appJson.expo.android.package };

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
    vocabTokenize: json.vocabTokenize,
  };
}

async function fetchJson(url: string): Promise<any> {
  // キャッシュ無効化 (古い catalog を掴まないよう毎回最新を取得)。
  const busted = `${url}${url.includes('?') ? '&' : '?'}t=${Date.now()}`;
  const res = await fetch(busted, { cache: 'no-store' as any, headers: { 'Cache-Control': 'no-cache' } });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return res.json();
}

const sleep = (ms: number) => new Promise(r => setTimeout(r, ms));
// 一時的な失敗(初回起動時のネット未準備/瞬断)に備え指数バックオフで再試行。
async function withRetry<T>(fn: () => Promise<T>, tries = 3): Promise<T> {
  let last: any;
  for (let i = 0; i < tries; i++) {
    try { return await fn(); } catch (e) { last = e; if (i < tries - 1) await sleep(700 * (i + 1)); }
  }
  throw last;
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
async function getOverlay(lang: string, entry: any, diag?: { catalog: any; catalogErr: string }): Promise<any> {
  const uri = overlayUri(lang);
  const info = await FileSystem.getInfoAsync(uri);
  if (info.exists) {
    const cached = JSON.parse(await FileSystem.readAsStringAsync(uri));
    if (!entry || (cached.version ?? 0) >= (entry.version ?? 0)) return cached;
  }
  if (!entry?.url) {
    // catalog取得失敗 と「neが載っていない(古いcatalog等)」を区別して原因を明示。
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

  // DLと展開を「1本の連続バー」に統合する (0〜DL_FRAC=DL, DL_FRAC〜1=展開)。
  // 別々に 0→100 を2回出すとバーが2回満ちて見えるため。
  const SCALE = 1000, DL_FRAC = 0.8;

  // 1) zip を1ファイルDL (全体の 0〜80%)
  const zipUri = `${packDir(lang)}audio.zip`;
  const total = entry.audioZipBytes || 0;
  const dl = FileSystem.createDownloadResumable(entry.audioZip, zipUri, {}, (p: any) => {
    const exp = p.totalBytesExpectedToWrite || total || 1;
    const f = Math.min(1, p.totalBytesWritten / exp) * DL_FRAC;
    onProgress?.(Math.round(f * SCALE), SCALE, 'ダウンロード中');
  });
  await dl.downloadAsync();

  // 2) 展開して各mp3を保存 (進捗: ファイル数)
  const bytes = b64ToU8(await FileSystem.readAsStringAsync(zipUri, { encoding: 'base64' as any }));
  const files = unzipSync(bytes);
  const names = Object.keys(files);
  let i = 0;
  onProgress?.(Math.round(DL_FRAC * SCALE), SCALE, '展開中'); // 80%から継続
  for (const name of names) {
    await FileSystem.writeAsStringAsync(`${audioDir(lang)}${name}`, u8ToB64(files[name]), { encoding: 'base64' as any });
    i++;
    const f = DL_FRAC + (i / names.length) * (1 - DL_FRAC);
    onProgress?.(Math.round(f * SCALE), SCALE, '展開中'); // 80〜100%
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

  let catalog: any = null, catalogErr = '';
  try { catalog = await withRetry(() => fetchJson(CATALOG_URL)); }
  catch (e: any) { catalogErr = String(e?.message ?? e); }
  const entry = catalog?.packs?.find((p: any) => p.l1 === lang);

  const overlayJson = await getOverlay(lang, entry, { catalog, catalogErr });
  try { await ensureAudio(lang, entry, onProgress); } catch {} // 音声DL失敗でもテキストは表示
  const { l1Audio, l1GrammarAudio } = await buildAudioMaps(lang, overlayJson);

  const overlay: L1Overlay = { ...toOverlay(overlayJson), l1Audio, l1GrammarAudio };
  return composePack(jaCore, overlay, { version: appJson.expo.version, review: REVIEW });
}
