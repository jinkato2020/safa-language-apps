// 聞いて話せる英語 のパックローダ。
// 【全学習データ パック化】本文/辞書/単語/メタも全てDL: core.json(英語コア) + overlay-ja.json
//   (日本語訳+辞書) + 音声(en/ja zip)。本体は UI+i18n のみ。初回フルzip/更新は差分zip。
//   DL後に composeAppC(core, overlay, 音声file://) で AppData を作る。

import type { AppData } from '@safa/shared';
import * as FileSystem from 'expo-file-system/legacy';
import appJson from '../app.json';
import { composeAppC, type AudioMaps, type EnCoreJson, type JaOverlayJson } from './appData';

// 本番配信: GitHub Release (tag: packs-appc)。
const CATALOG_URL =
  'https://github.com/JinKato2020/safa-language-apps/releases/download/packs-appc/catalog.json';

const REVIEW = { iosAppId: null as string | null, androidPackage: appJson.expo.android.package };
// 進捗通知 (done, total, label, step, steps)。step/steps は「何個目/全何個のDL」
//  (en音声+ja音声で最大2本)。UIで "1/2" を併記する。
export type ProgressFn = (done: number, total: number, label?: string, step?: number, steps?: number) => void;

const packDir = (kind: string) => `${FileSystem.documentDirectory}packs-c/${kind}/`;
const audioDir = (kind: string) => `${packDir(kind)}audio/`;
const audioMarkerUri = (kind: string) => `${packDir(kind)}audio.version`;

const sleep = (ms: number) => new Promise(r => setTimeout(r, ms));
async function withRetry<T>(fn: () => Promise<T>, tries = 3): Promise<T> {
  let last: any;
  for (let i = 0; i < tries; i++) {
    try { return await fn(); } catch (e) { last = e; if (i < tries - 1) await sleep(700 * (i + 1)); }
  }
  throw last;
}
async function fetchJson(url: string, timeoutMs = 8000): Promise<any> {
  const busted = `${url}${url.includes('?') ? '&' : '?'}t=${Date.now()}`;
  const res = await fetch(busted, { cache: 'no-store' as any, headers: { 'Cache-Control': 'no-cache' } });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return res.json();
}
function b64ToU8(b64: string): Uint8Array {
  const bin = (global as any).atob(b64);
  const u8 = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) u8[i] = bin.charCodeAt(i);
  return u8;
}

// 音声zipをDL→ストリーミング展開 (OOM安全)。差分DL対応 (App A/B と同方式)。
async function ensureAudio(kind: string, entry: any, onProgress?: ProgressFn, span?: { base: number; frac: number }, skipUpdate?: boolean, step?: number, steps?: number): Promise<void> {
  if (!entry?.audioZip) return;
  const marker = audioMarkerUri(kind);
  let localVer: string | null = null;
  const m = await FileSystem.getInfoAsync(marker);
  if (m.exists) {
    localVer = await FileSystem.readAsStringAsync(marker);
    if (localVer === String(entry.audioVersion ?? '')) return;
  }
  // 更新を見送り(「後で」)= 既存音声があるならDLせず現状のまま起動。
  if (skipUpdate && localVer != null) return;
  await FileSystem.makeDirectoryAsync(audioDir(kind), { intermediates: true });

  const useDelta = !!(entry.deltaZip && localVer != null && String(entry.deltaBaseVersion ?? '') === localVer);
  const srcZip: string = useDelta ? entry.deltaZip : entry.audioZip;
  const srcBytes: number = (useDelta ? entry.deltaZipBytes : entry.audioZipBytes) || 0;

  const SCALE = 1000;
  const base = span?.base ?? 0, frac = span?.frac ?? 1; // 進捗をen/ja2分割で配分
  const DL_FRAC = 0.8;
  const report = (f01: number, label: string) => onProgress?.(Math.round((base + Math.min(1, f01) * frac) * SCALE), SCALE, label, step, steps);

  const zipUri = `${packDir(kind)}audio.zip`;
  const total = srcBytes;
  const dl = FileSystem.createDownloadResumable(srcZip, zipUri, {}, (p: any) => {
    const exp = p.totalBytesExpectedToWrite || total || 1;
    report((p.totalBytesWritten / exp) * DL_FRAC, useDelta ? '更新ダウンロード中' : 'ダウンロード中');
  });
  await dl.downloadAsync();

  // ストリーミング展開 (STORED zip前提・1ファイルずつ範囲読みで低メモリ)。
  const zinfo: any = await FileSystem.getInfoAsync(zipUri);
  const zipSize: number = zinfo?.size ?? 0;
  const HDR = 30;
  let off = 0, fcount = 0;
  report(DL_FRAC, '展開中');
  while (off + 4 <= zipSize) {
    const head = b64ToU8(await FileSystem.readAsStringAsync(zipUri, { encoding: 'base64' as any, position: off, length: Math.min(HDR + 256, zipSize - off) }));
    if (!(head[0] === 0x50 && head[1] === 0x4b && head[2] === 0x03 && head[3] === 0x04)) break;
    const u16 = (i: number) => head[i] | (head[i + 1] << 8);
    const u32 = (i: number) => head[i] + head[i + 1] * 256 + head[i + 2] * 65536 + head[i + 3] * 16777216;
    const comp = u32(18);
    const nameLen = u16(26);
    const extraLen = u16(28);
    let name = '';
    if (HDR + nameLen <= head.length) {
      for (let k = 0; k < nameLen; k++) name += String.fromCharCode(head[HDR + k]);
    } else {
      const nb = b64ToU8(await FileSystem.readAsStringAsync(zipUri, { encoding: 'base64' as any, position: off + HDR, length: nameLen }));
      for (let k = 0; k < nameLen; k++) name += String.fromCharCode(nb[k]);
    }
    const dataPos = off + HDR + nameLen + extraLen;
    const base2 = name.split('/').pop() || name;
    if (comp > 0 && base2 && !name.endsWith('/')) {
      const b64 = await FileSystem.readAsStringAsync(zipUri, { encoding: 'base64' as any, position: dataPos, length: comp });
      await FileSystem.writeAsStringAsync(`${audioDir(kind)}${base2}`, b64, { encoding: 'base64' as any });
      fcount++;
    }
    off = dataPos + comp;
    report(DL_FRAC + Math.min(1, off / (zipSize || 1)) * (1 - DL_FRAC), '展開中');
  }
  if (fcount === 0) throw new Error('zip展開で0ファイル(破損/形式不一致)');
  await FileSystem.writeAsStringAsync(marker, String(entry.audioVersion ?? ''));
  await FileSystem.deleteAsync(zipUri, { idempotent: true });
}

// FSの音声ファイル名から conv(T-L-i)/gram(T-i) を分類して file:// マップを作る。
async function buildMaps(kind: string): Promise<{ conv: Record<string, string>; gram: Record<string, string> }> {
  const dir = audioDir(kind);
  let files: string[];
  try { files = await FileSystem.readDirectoryAsync(dir); } catch { files = []; }
  const conv: Record<string, string> = {};
  const gram: Record<string, string> = {};
  for (const f of files) {
    if (!f.endsWith('.mp3')) continue;
    const id = f.slice(0, -4);
    const parts = id.split('-');
    if (parts.length === 3) conv[id] = `${dir}${f}`;
    else if (parts.length === 2) gram[id] = `${dir}${f}`;
  }
  return { conv, gram };
}

const KINDS = ['en', 'ja'];

/** DL要否と必要バイト数(DL前の同意ダイアログ用 / Apple GL4.2.3)。
 *  canSkip = 「既存データで動かせる」= 両KINDS(en/ja)の音声マーカーが既に存在。
 *  初回(どちらか欠落)はスキップ不可=DL必須。更新のみなら「後で」で現状のまま起動できる。 */
export async function getPackDownloadInfo(): Promise<{ needsDownload: boolean; bytes: number; canSkip: boolean }> {
  let catalog: any = null;
  try { catalog = await withRetry(() => fetchJson(CATALOG_URL)); } catch {}
  let bytes = 0, need = false;
  for (const kind of KINDS) {
    const entry = catalog?.audio?.find((a: any) => a.kind === kind);
    if (!entry) continue;
    let audioNeed = !!entry.audioZip;
    const mInfo = await FileSystem.getInfoAsync(audioMarkerUri(kind));
    if (mInfo.exists) { try { const v = await FileSystem.readAsStringAsync(audioMarkerUri(kind)); if (v === String(entry.audioVersion ?? '')) audioNeed = false; } catch {} }
    if (audioNeed) {
      need = true;
      const useDelta = entry.deltaZip && mInfo.exists && String(entry.deltaBaseVersion ?? '') === (await FileSystem.readAsStringAsync(audioMarkerUri(kind)).catch(() => ''));
      bytes += (useDelta ? entry.deltaZipBytes : entry.audioZipBytes) || 0;
    }
  }
  const canSkip = (await FileSystem.getInfoAsync(audioMarkerUri('en'))).exists && (await FileSystem.getInfoAsync(audioMarkerUri('ja'))).exists;
  return { needsDownload: need, bytes, canSkip };
}

// この音声zipが今回DLされるか(ensureAudioの早期returnと同条件)。DLステップ数を数えるのに使う。
async function audioWillDownload(kind: string, entry: any, skipUpdate?: boolean): Promise<boolean> {
  if (!entry?.audioZip) return false;
  const m = await FileSystem.getInfoAsync(audioMarkerUri(kind));
  if (m.exists) {
    try {
      const v = await FileSystem.readAsStringAsync(audioMarkerUri(kind));
      if (v === String(entry.audioVersion ?? '')) return false; // 最新キャッシュ済み
      if (skipUpdate) return false;                              // 「後で」=更新見送り
    } catch {}
  }
  return true;
}

/** 音声(en+ja)をDL(必要分)→ file://マップを作り composeAppC で AppData を返す。 */
export async function loadPack(onProgress?: ProgressFn, skipUpdate?: boolean): Promise<AppData> {
  let catalog: any = null;
  try { catalog = await withRetry(() => fetchJson(CATALOG_URL)); } catch {}
  const entries: Record<string, any> = {};
  for (const kind of KINDS) entries[kind] = catalog?.audio?.find((a: any) => a.kind === kind);

  // この起動で実際にDLされる kind を判定し、進捗バーの配分(span)とステップ番号を動的に決める。
  //  ・steps==2: en=前半50% / ja=後半50% で「1本の連続バー」(従来挙動)。
  //  ・steps==1: そのkindにフルバー({base:0,frac:1}) → 片方更新でも半分で止まらない。
  const willDl: Record<string, boolean> = {};
  for (const kind of KINDS) willDl[kind] = await audioWillDownload(kind, entries[kind], skipUpdate);
  const steps = KINDS.reduce((n, k) => n + (willDl[k] ? 1 : 0), 0);
  const spans: Record<string, { base: number; frac: number }> = {};
  let cursor = 0, stepN = 0;
  const stepNo: Record<string, number> = {};
  for (const kind of KINDS) {
    if (!willDl[kind]) continue;
    const frac = 1 / steps;
    spans[kind] = { base: cursor, frac };
    cursor += frac;
    stepNo[kind] = ++stepN; // 実際にDLされる kind にだけ連番(1,2…)
  }

  for (const kind of KINDS) {
    const entry = entries[kind];
    // DLされない kind は ensureAudio が早期returnするので step は進めない。
    if (entry) { try { await ensureAudio(kind, entry, onProgress, spans[kind], skipUpdate, stepNo[kind], steps); } catch {} } // 失敗してもテキストは表示
  }
  const en = await buildMaps('en');
  const ja = await buildMaps('ja');
  const audio: AudioMaps = { enConv: en.conv, enGram: en.gram, jaConv: ja.conv, jaGram: ja.gram };
  // 本文(英語コア)と日本語訳+辞書を DL/キャッシュ。
  const coreJson = await getJson<EnCoreJson>('core', catalog?.coreUrl, catalog?.coreVersion, skipUpdate);
  const overlayJson = await getJson<JaOverlayJson>('overlay-ja', catalog?.overlayJaUrl, catalog?.overlayJaVersion, skipUpdate);
  const data = composeAppC(coreJson, overlayJson, audio);
  return { ...data, review: REVIEW };
}

// テキストJSON(core.json / overlay-ja.json)をDL/キャッシュ。version で版管理。
async function getJson<T>(name: string, url?: string, version?: number, skipUpdate?: boolean): Promise<T | undefined> {
  const uri = `${packDir(name)}data.json`;
  const mk = `${packDir(name)}data.version`;
  const info = await FileSystem.getInfoAsync(uri);
  if (info.exists) {
    let v: string | null = null;
    try { if ((await FileSystem.getInfoAsync(mk)).exists) v = await FileSystem.readAsStringAsync(mk); } catch {}
    if (skipUpdate || !url || v === String(version ?? '')) { try { return JSON.parse(await FileSystem.readAsStringAsync(uri)); } catch {} }
  }
  if (!url) return undefined;
  await FileSystem.makeDirectoryAsync(packDir(name), { intermediates: true });
  await withRetry(async () => { const r = await FileSystem.downloadAsync(url, uri); if (r.status && r.status >= 400) throw new Error(`${name} HTTP ${r.status}`); });
  await FileSystem.writeAsStringAsync(mk, String(version ?? ''));
  return JSON.parse(await FileSystem.readAsStringAsync(uri));
}
