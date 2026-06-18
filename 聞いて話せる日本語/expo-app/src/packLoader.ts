// 言語パックのローダ。
// ne(主言語)はアプリ同梱。それ以外(bn等)は端末FSにあれば読み、無ければ
// catalog.json 経由で raw から DL する:
//   - オーバーレイJSON (訳+辞書)
//   - 母語音声 zip 1個 (fflateで展開して <文ID>.mp3 を端末に保存)
// 取得物を共通コア(jaCore)と composePack で結合して AppData を作る。

import type { AppData } from '@safa/shared';
import * as FileSystem from 'expo-file-system/legacy';
import appJson from '../app.json';
import { makeJaCore, type JaAudioMaps, type JaCoreJson } from './appData';
import { composePack, type L1Overlay } from './pack/compose';

// 日本語(ターゲット)コア(本文+音声)パックを置く擬似lang。catalog.core からDL。
const CORE = '_core';

// 本番配信(改番版): GitHub Release (tag: packs-appb-v2 = themeId改番後の新キーパック)。
// 旧 packs-appb は改番前アプリ(1.2.x以前)用に温存。改番版アプリ(1.3.x新コア)は v2 を参照しキー整合を取る。
const CATALOG_URL =
  'https://github.com/JinKato2020/safa-language-apps/releases/download/packs-appb-v2/catalog.json';

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

async function fetchJson(url: string, timeoutMs = 8000): Promise<any> {
  // キャッシュ無効化 (古い catalog を掴まないよう毎回最新を取得)。
  const busted = `${url}${url.includes('?') ? '&' : '?'}t=${Date.now()}`;
  // タイムアウト必須: モバイルで通信がハング(失敗ではなく無応答)すると
  // fetch は既定でタイムアウトせず永久に待つ→言語切替画面が固まる。Abortで打ち切る。
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), timeoutMs);
  try {
    const res = await fetch(busted, { cache: 'no-store' as any, headers: { 'Cache-Control': 'no-cache' }, signal: ctrl.signal });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return await res.json();
  } finally {
    clearTimeout(timer);
  }
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
// オーバーレイJSON取得 (オフライン=キャッシュ / 新版あれば再DL)。
async function getOverlay(lang: string, entry: any, diag?: { catalog: any; catalogErr: string }, skipUpdate?: boolean): Promise<any> {
  const uri = overlayUri(lang);
  const info = await FileSystem.getInfoAsync(uri);
  if (info.exists) {
    // キャッシュが壊れている(以前のフリーズ/中断で途中書き込み)場合に備え try で保護。
    // 壊れていたら削除して再DLに回す(=毎回同じ壊れたキャッシュで失敗し続けるのを防ぐ)。
    try {
      const cached = JSON.parse(await FileSystem.readAsStringAsync(uri));
      if (skipUpdate || !entry || (cached.version ?? 0) >= (entry.version ?? 0)) return cached;
    } catch {
      await FileSystem.deleteAsync(uri, { idempotent: true });
    }
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
// 差分DL: ローカルが entry.deltaBaseVersion と一致し entry.deltaZip があれば、変わった
//   ファイルだけの「差分zip」をDLして既存の上に上書き展開する(フル40〜70MB→数百KB)。
//   差分情報が無い/版が飛んでいる場合は従来どおりフルzip。後方互換(旧catalogはフルのみ)。
async function ensureAudio(lang: string, entry: any, onProgress?: ProgressFn, skipUpdate?: boolean): Promise<void> {
  if (!entry?.audioZip) return;
  const marker = audioMarkerUri(lang);
  let localVer: string | null = null;
  const m = await FileSystem.getInfoAsync(marker);
  if (m.exists) {
    localVer = await FileSystem.readAsStringAsync(marker);
    if (localVer === String(entry.audioVersion ?? '')) return; // 最新キャッシュ済み
  }
  // 更新を見送り(ユーザーが「いいえ」)= 既存音声があるならDLせず現状のまま起動。
  if (skipUpdate && localVer != null) return;
  await FileSystem.makeDirectoryAsync(audioDir(lang), { intermediates: true });

  // 差分が使えるか: ローカル音声があり(=localVer非null) かつ それが差分の土台版と一致
  const useDelta = !!(entry.deltaZip && localVer != null && String(entry.deltaBaseVersion ?? '') === localVer);
  const srcZip: string = useDelta ? entry.deltaZip : entry.audioZip;
  const srcBytes: number = (useDelta ? entry.deltaZipBytes : entry.audioZipBytes) || 0;

  // DLと展開を「1本の連続バー」に統合する (0〜DL_FRAC=DL, DL_FRAC〜1=展開)。
  // 別々に 0→100 を2回出すとバーが2回満ちて見えるため。
  const SCALE = 1000, DL_FRAC = 0.8;
  const dlLabel = useDelta ? '更新ダウンロード中' : 'ダウンロード中';

  // 1) zip を1ファイルDL (全体の 0〜80%)。差分zipは変更分のみ＝小さい。
  const zipUri = `${packDir(lang)}audio.zip`;
  const total = srcBytes;
  const dl = FileSystem.createDownloadResumable(srcZip, zipUri, {}, (p: any) => {
    const exp = p.totalBytesExpectedToWrite || total || 1;
    const f = Math.min(1, p.totalBytesWritten / exp) * DL_FRAC;
    onProgress?.(Math.round(f * SCALE), SCALE, dlLabel);
  });
  await dl.downloadAsync();

  // 2) ストリーミング展開して各mp3を保存。
  //   音声zipは無圧縮(STORED, fflate zipSync level:0)なので、zip全体をメモリに
  //   載せず、ディスク上のzipから各エントリのローカルヘッダ+データを範囲読みして
  //   そのまま書き出す。ピークメモリは1ファイル分のみ→Androidの70〜80MBでもOOMしない。
  const zinfo: any = await FileSystem.getInfoAsync(zipUri);
  const zipSize: number = zinfo?.size ?? 0;
  const HDR = 30; // local file header 固定長
  let off = 0, fcount = 0;
  onProgress?.(Math.round(DL_FRAC * SCALE), SCALE, '展開中'); // 80%から継続
  while (off + 4 <= zipSize) {
    // ヘッダ(30) + ファイル名(短い)をまとめて読む
    const head = b64ToU8(await FileSystem.readAsStringAsync(zipUri, { encoding: 'base64' as any, position: off, length: Math.min(HDR + 128, zipSize - off) }));
    // ローカルファイルヘッダ署名 PK\x03\x04 でなければ中央ディレクトリ等＝終了
    if (!(head[0] === 0x50 && head[1] === 0x4b && head[2] === 0x03 && head[3] === 0x04)) break;
    const u16 = (i: number) => head[i] | (head[i + 1] << 8);
    const u32 = (i: number) => head[i] + head[i + 1] * 256 + head[i + 2] * 65536 + head[i + 3] * 16777216;
    const comp = u32(18);            // 圧縮後サイズ(STORED=実サイズ)
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
    if (comp > 0 && name && !name.endsWith('/')) {
      // データをbase64で範囲読み→そのままbase64書き出し(デコード不要・低メモリ)
      const b64 = await FileSystem.readAsStringAsync(zipUri, { encoding: 'base64' as any, position: dataPos, length: comp });
      await FileSystem.writeAsStringAsync(`${audioDir(lang)}${name}`, b64, { encoding: 'base64' as any });
      fcount++;
    }
    off = dataPos + comp;
    const f = DL_FRAC + Math.min(1, off / (zipSize || 1)) * (1 - DL_FRAC);
    onProgress?.(Math.round(f * SCALE), SCALE, '展開中'); // 80〜100%
  }
  if (fcount === 0) throw new Error('zip展開で0ファイル(破損/形式不一致)');
  // 全mp3の保存が完了してからマーカーを書く(途中失敗時は未完=次回再取得)。
  await FileSystem.writeAsStringAsync(marker, String(entry.audioVersion ?? ''));
  await FileSystem.deleteAsync(zipUri, { idempotent: true });
}

// FSの音声から文ID→file:// マップを構築 (会話=examplesL1 / 文法=grammarL1)。
//  ディレクトリ一覧を1回だけ取得しSetで存在判定する(全2400件をgetInfoAsyncで
//  個別確認すると起動・言語切替のたびに数千回のFS呼び出しで重く固まるため)。
async function buildAudioMaps(lang: string, overlayJson: any) {
  const dir = audioDir(lang);
  let present: Set<string>;
  try {
    present = new Set(await FileSystem.readDirectoryAsync(dir));
  } catch {
    present = new Set(); // ディレクトリ未作成等
  }
  const collect = (m: any) => {
    const ids: string[] = [];
    for (const [key, arr] of Object.entries(m || {})) (arr as string[]).forEach((_, i) => ids.push(`${key}-${i + 1}`));
    return ids;
  };
  const l1Audio: Record<string, string> = {};
  const l1GrammarAudio: Record<string, string> = {};
  for (const id of collect(overlayJson.examplesL1)) {
    if (present.has(`${id}.mp3`)) l1Audio[id] = `${dir}${id}.mp3`;
  }
  for (const id of collect(overlayJson.grammarL1)) {
    if (present.has(`${id}.mp3`)) l1GrammarAudio[id] = `${dir}${id}.mp3`;
  }
  return { l1Audio, l1GrammarAudio };
}

/** ダウンロード要否と必要バイト数を返す(DL前の確認ダイアログ用)。
 *  同梱/キャッシュ済み(版が最新)なら needsDownload=false。Apple GL4.2.3対応: 事前にサイズ開示+同意を取るため。 */
export async function getPackDownloadInfo(lang: string): Promise<{ needsDownload: boolean; bytes: number; canSkip: boolean }> {
  if (BUNDLED[lang]) return { needsDownload: false, bytes: 0, canSkip: false };
  let catalog: any = null;
  try { catalog = await withRetry(() => fetchJson(CATALOG_URL, 8000)); } catch {}
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
  // core(日本語音声)要DL? 全L1共通・初回のみ。
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

/** L1パックを解決。ne=同梱。その他=オーバーレイ+音声zipをFS/DLし結合。onProgressで進捗通知。 */
export async function loadPack(lang: string, onProgress?: ProgressFn, skipUpdate?: boolean): Promise<AppData> {
  const bundled = BUNDLED[lang];
  if (bundled) return bundled;

  // 既にオーバーレイがキャッシュ済みなら、catalog取得は「短時間・1回」で諦める。
  //  → 通信ハング時でもキャッシュ済み言語は固まらず即座に開ける(オフラインでも動く)。
  //  未キャッシュ(新規言語)は catalog 必須なので通常リトライ。
  const cachedExists = (await FileSystem.getInfoAsync(overlayUri(lang))).exists;
  let catalog: any = null, catalogErr = '';
  try {
    catalog = cachedExists
      ? await fetchJson(CATALOG_URL, 5000)
      : await withRetry(() => fetchJson(CATALOG_URL, 8000));
  } catch (e: any) { catalogErr = String(e?.message ?? e); }
  const entry = catalog?.packs?.find((p: any) => p.l1 === lang);

  const overlayJson = await getOverlay(lang, entry, { catalog, catalogErr }, skipUpdate);
  // ターゲット(日本語)コア本文 core.json + 音声 をDL (全L1共通・キャッシュ済みなら即時)。
  const coreJson = await getCoreJson(catalog?.core, skipUpdate);
  try { if (catalog?.core) await ensureAudio(CORE, catalog.core, onProgress, skipUpdate); } catch {}
  const jaAudio = await buildCoreAudioMaps();
  try { await ensureAudio(lang, entry, onProgress, skipUpdate); } catch {} // L1音声DL失敗でもテキストは表示
  const { l1Audio, l1GrammarAudio } = await buildAudioMaps(lang, overlayJson);

  const overlay: L1Overlay = { ...toOverlay(overlayJson), l1Audio, l1GrammarAudio };
  return composePack(makeJaCore(coreJson, jaAudio), overlay, { version: appJson.expo.version, review: REVIEW });
}

// ターゲット(日本語)本文 core.json をDL/キャッシュ。catalog.core.version で版管理。
async function getCoreJson(coreEntry: any, skipUpdate?: boolean): Promise<JaCoreJson | undefined> {
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

// コア(日本語)音声dirから conv(T-L-i)/gram(T-i) を分類して file:// マップを作る。
async function buildCoreAudioMaps(): Promise<JaAudioMaps> {
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
