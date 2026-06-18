// 言語パックのローダ (App A)。
// ja(日本語)はアプリ同梱(現行 appData)。en は catalog.json 経由で raw からDL:
//   - オーバーレイJSON (英訳+辞書)
//   - 英語音声 zip 1個 (fflateで展開して <文ID>.mp3 を端末に保存)
// ネパール語(コア)文・音声・メタは同梱を共有。composePack で結合して AppData を作る。

import type { AppData } from '@safa/shared';
import * as FileSystem from 'expo-file-system/legacy';
import { unzipSync } from 'fflate';
import appJson from '../app.json';
import { makeNeCore, type NeAudioMaps, type NeCoreJson } from './appData';
import { composePack, type L1Overlay } from './pack/compose';

// ネパール語(ターゲット)コア(本文+音声)パックを置く擬似lang。catalog.core からDL。
const CORE = '_core';

// 本番配信(改番版): GitHub Release (tag: packs-appa-v2 = themeId改番後の新キーパック)。
// 旧 packs-appa は改番前アプリ(1.6.x)用に温存。改番版アプリ(1.7.x新コア)は v2 を参照しキー整合を取る。
const CATALOG_URL =
  'https://github.com/JinKato2020/safa-language-apps/releases/download/packs-appa-v2/catalog.json';

// 母語(ja/en)はすべて DL パック。ネパール語コアのみ同梱。
const BUNDLED: Record<string, AppData> = {};
const REVIEW = { iosAppId: '6771720689', androidPackage: appJson.expo.android.package };

export function bundledPack(lang: string): AppData | null {
  return BUNDLED[lang] ?? null;
}

// 進捗通知 (done, total, label, step, steps)。label は表示用。step/steps は
//  「何個目/全何個のDL」(初回はコア音声+L1音声で2本走る等)。UIで "1/2" を併記する。
export type ProgressFn = (done: number, total: number, label?: string, step?: number, steps?: number) => void;

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

async function getOverlay(lang: string, entry: any, diag?: { catalog: any; catalogErr: string }, skipUpdate?: boolean): Promise<any> {
  const uri = overlayUri(lang);
  const info = await FileSystem.getInfoAsync(uri);
  if (info.exists) {
    const cached = JSON.parse(await FileSystem.readAsStringAsync(uri));
    if (skipUpdate || !entry || (cached.version ?? 0) >= (entry.version ?? 0)) return cached;
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

// この音声zipが今回DLされるか(ensureAudioの早期returnと同条件)。DLステップ数を数えるのに使う。
async function audioWillDownload(markerUri: string, version: any, hasZip: boolean, skipUpdate?: boolean): Promise<boolean> {
  if (!hasZip) return false;
  const m = await FileSystem.getInfoAsync(markerUri);
  if (m.exists) {
    try {
      const v = await FileSystem.readAsStringAsync(markerUri);
      if (v === String(version ?? '')) return false;   // 最新キャッシュ済み
      if (skipUpdate) return false;                     // 「後で」=更新見送り
    } catch {}
  }
  return true;
}

// 差分DL: ローカルが entry.deltaBaseVersion と一致し entry.deltaZip があれば、変わった
//   ファイルだけの差分zipを既存の上に上書き展開(フル→数百KB)。無ければ従来どおりフルzip(後方互換)。
async function ensureAudio(lang: string, entry: any, onProgress?: ProgressFn, skipUpdate?: boolean): Promise<void> {
  if (!entry?.audioZip) return;
  const marker = audioMarkerUri(lang);
  let localVer: string | null = null;
  const m = await FileSystem.getInfoAsync(marker);
  if (m.exists) {
    localVer = await FileSystem.readAsStringAsync(marker);
    if (localVer === String(entry.audioVersion ?? '')) return;
  }
  // 更新を見送り(ユーザーが「いいえ」)= 既存音声があるならDLせず現状のまま起動。
  if (skipUpdate && localVer != null) return;
  await FileSystem.makeDirectoryAsync(audioDir(lang), { intermediates: true });

  const useDelta = !!(entry.deltaZip && localVer != null && String(entry.deltaBaseVersion ?? '') === localVer);
  const srcZip: string = useDelta ? entry.deltaZip : entry.audioZip;
  const srcBytes: number = (useDelta ? entry.deltaZipBytes : entry.audioZipBytes) || 0;

  const SCALE = 1000, DL_FRAC = 0.8;
  const zipUri = `${packDir(lang)}audio.zip`;
  const total = srcBytes;
  const dl = FileSystem.createDownloadResumable(srcZip, zipUri, {}, (p: any) => {
    const exp = p.totalBytesExpectedToWrite || total || 1;
    const f = Math.min(1, p.totalBytesWritten / exp) * DL_FRAC;
    onProgress?.(Math.round(f * SCALE), SCALE, useDelta ? '更新ダウンロード中' : 'ダウンロード中');
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

/** ダウンロード要否と必要バイト数を返す(DL前の確認ダイアログ用)。
 *  同梱/キャッシュ済み(版が最新)なら needsDownload=false。Apple GL4.2.3対応: 事前にサイズ開示+同意を取るため。 */
export async function getPackDownloadInfo(lang: string): Promise<{ needsDownload: boolean; bytes: number; canSkip: boolean }> {
  if (BUNDLED[lang]) return { needsDownload: false, bytes: 0, canSkip: false };
  let catalog: any = null;
  try { catalog = await withRetry(() => fetchJson(CATALOG_URL)); } catch {}
  const entry = catalog?.packs?.find((p: any) => p.l1 === lang);
  // overlay 要DL?
  let overlayNeed = !!entry;
  const oInfo = await FileSystem.getInfoAsync(overlayUri(lang));
  if (oInfo.exists) {
    if (!entry) overlayNeed = false; // キャッシュ有り&catalog取れず → 既存で動く
    else { try { const c = JSON.parse(await FileSystem.readAsStringAsync(overlayUri(lang))); if ((c.version ?? 0) >= (entry.version ?? 0)) overlayNeed = false; } catch {} }
  }
  // audio 要DL? + 差分判定用にローカル版を保持
  let audioNeed = !!entry?.audioZip;
  let audioLocalVer: string | null = null;
  const mInfo = await FileSystem.getInfoAsync(audioMarkerUri(lang));
  if (mInfo.exists && entry) { try { audioLocalVer = await FileSystem.readAsStringAsync(audioMarkerUri(lang)); if (audioLocalVer === String(entry.audioVersion ?? '')) audioNeed = false; } catch {} }
  // core(ネ語音声)要DL? 全L1共通・初回のみ。
  let coreNeed = !!catalog?.core?.audioZip;
  let coreLocalVer: string | null = null;
  const cm = await FileSystem.getInfoAsync(audioMarkerUri(CORE));
  if (cm.exists && catalog?.core) { try { coreLocalVer = await FileSystem.readAsStringAsync(audioMarkerUri(CORE)); if (coreLocalVer === String(catalog.core.audioVersion ?? '')) coreNeed = false; } catch {} }
  let bytes = 0;
  if (overlayNeed) bytes += entry?.sizeBytes ?? 0;
  // 差分DLが適用される場合は差分サイズで見積もる(ensureAudioと同条件)。フル表示の誤りを防ぐ。
  if (audioNeed) {
    const useDelta = !!(entry?.deltaZip && audioLocalVer != null && String(entry.deltaBaseVersion ?? '') === audioLocalVer);
    bytes += (useDelta ? entry?.deltaZipBytes : entry?.audioZipBytes) ?? 0;
  }
  if (coreNeed) {
    const c = catalog.core;
    const useDelta = !!(c?.deltaZip && coreLocalVer != null && String(c.deltaBaseVersion ?? '') === coreLocalVer);
    bytes += (useDelta ? c?.deltaZipBytes : c?.audioZipBytes) ?? 0;
  }
  // 更新スキップ可否: 既にこの言語で「動かせるだけのデータ」が端末にある(overlay+L1音声+コア音声)。
  //  初回(どれか欠落)はスキップ不可=DL必須。更新のみなら「いいえ」で現状のまま起動できる。
  const canSkip = oInfo.exists && mInfo.exists && cm.exists;
  return { needsDownload: overlayNeed || audioNeed || coreNeed, bytes, canSkip };
}

/** L1パックを解決。ja=同梱。en=オーバーレイ+英語音声zipをFS/DLし neCore と結合。 */
export async function loadPack(lang: string, onProgress?: ProgressFn, skipUpdate?: boolean): Promise<AppData> {
  const bundled = BUNDLED[lang];
  if (bundled) return bundled;

  let catalog: any = null, catalogErr = '';
  try { catalog = await withRetry(() => fetchJson(CATALOG_URL)); }
  catch (e: any) { catalogErr = String(e?.message ?? e); }
  const entry = catalog?.packs?.find((p: any) => p.l1 === lang);

  const overlayJson = await getOverlay(lang, entry, { catalog, catalogErr }, skipUpdate);
  // ターゲット(ネパール語)コア本文 core.json + 音声 をDL (全L1共通・キャッシュ済みなら即時)。
  const coreJson = await getCoreJson(catalog?.core, skipUpdate);
  // この起動で実際にDLされる音声zip数を数え、各DLに「何個目/全何個」を付けて通知する(UIで 1/2 表示)。
  const coreWillDl = await audioWillDownload(audioMarkerUri(CORE), catalog?.core?.audioVersion, !!catalog?.core?.audioZip, skipUpdate);
  const l1WillDl = await audioWillDownload(audioMarkerUri(lang), entry?.audioVersion, !!entry?.audioZip, skipUpdate);
  const steps = (coreWillDl ? 1 : 0) + (l1WillDl ? 1 : 0);
  let stepN = 0;
  const stepProg = (): ProgressFn => { const s = ++stepN; return (d, t, l) => onProgress?.(d, t, l, s, steps); };
  try { if (catalog?.core) await ensureAudio(CORE, catalog.core, coreWillDl ? stepProg() : onProgress, skipUpdate); } catch {}
  const neAudio = await buildCoreAudioMaps();
  try { await ensureAudio(lang, entry, l1WillDl ? stepProg() : onProgress, skipUpdate); } catch {} // L1音声DL失敗でもテキストは表示
  const { l1Audio, l1GrammarAudio } = await buildAudioMaps(lang, overlayJson);

  const overlay: L1Overlay = { ...toOverlay(overlayJson), l1Audio, l1GrammarAudio };
  return composePack(makeNeCore(coreJson, neAudio), overlay, { version: appJson.expo.version, review: REVIEW });
}

// ターゲット(ネ語)本文 core.json をDL/キャッシュ。catalog.core.version で版管理。
async function getCoreJson(coreEntry: any, skipUpdate?: boolean): Promise<NeCoreJson | undefined> {
  const uri = `${packDir(CORE)}core.json`;
  const mk = `${packDir(CORE)}core.version`;
  const info = await FileSystem.getInfoAsync(uri);
  if (info.exists) {
    let v: string | null = null;
    try { if ((await FileSystem.getInfoAsync(mk)).exists) v = await FileSystem.readAsStringAsync(mk); } catch {}
    if (skipUpdate || !coreEntry?.url || v === String(coreEntry.version ?? '')) {
      try { return JSON.parse(await FileSystem.readAsStringAsync(uri)); } catch {}
    }
  }
  if (!coreEntry?.url) return undefined;
  await FileSystem.makeDirectoryAsync(packDir(CORE), { intermediates: true });
  await withRetry(async () => { const r = await FileSystem.downloadAsync(coreEntry.url, uri); if (r.status && r.status >= 400) throw new Error(`core HTTP ${r.status}`); });
  await FileSystem.writeAsStringAsync(mk, String(coreEntry.version ?? ''));
  return JSON.parse(await FileSystem.readAsStringAsync(uri));
}

// コア(ネ語)音声dirから conv(T-L-i)/gram(T-i) を分類して file:// マップを作る。
async function buildCoreAudioMaps(): Promise<NeAudioMaps> {
  const dir = audioDir(CORE);
  let files: string[];
  try { files = await FileSystem.readDirectoryAsync(dir); } catch { files = []; }
  const conv: Record<string, string> = {};
  const gram: Record<string, string> = {};
  for (const f of files) {
    if (!f.endsWith('.mp3')) continue;
    const id = f.slice(0, -4);
    const n = id.split('-').length;
    if (n === 3) conv[id] = `${dir}${f}`;
    else if (n === 2) gram[id] = `${dir}${f}`;
  }
  return { conv, gram };
}
