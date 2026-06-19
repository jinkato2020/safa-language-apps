// ポスター(音声学習)資源のローダ。音声mp3・ポスターpngはアプリ同梱をやめ、
//  GitHub Release(packs-poster)からDLパックとして取得する。
//  - poster-catalog.json = { version, langs:{ ja:{url,bytes,version}, bn:.., en:.., .. } }
//  - poster-<L>.zip は STORED(無圧縮)zip。エントリ名は "<theme>/audio/01_<L>.mp3" /
//    "<theme>/audio/title_<L>.mp3" / "<theme>/poster_<L>.png"(ja は音声のみ・画像なし)。
//  zip は packLoader.ts の ensureAudio と同方式で、ディスク上から範囲読み(STORED)して
//  各エントリを ${documentDirectory}poster/<entryname> へストリーミング展開する(OOM安全)。
import * as FileSystem from 'expo-file-system/legacy';

export const POSTER_CATALOG_URL =
  'https://github.com/JinKato2020/safa-language-apps/releases/download/packs-poster/poster-catalog.json';

const posterRoot = () => `${FileSystem.documentDirectory}poster/`;
const markerUri = (lang: string) => `${posterRoot()}${lang}.version`;

async function fetchJson(url: string, timeoutMs = 8000): Promise<any> {
  // キャッシュ無効化 + タイムアウト(モバイルで通信ハング時に永久待ちを避ける)。packLoaderと同方式。
  const busted = `${url}${url.includes('?') ? '&' : '?'}t=${Date.now()}`;
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
async function withRetry<T>(fn: () => Promise<T>, tries = 3): Promise<T> {
  let last: any;
  for (let i = 0; i < tries; i++) {
    try { return await fn(); } catch (e) { last = e; if (i < tries - 1) await sleep(700 * (i + 1)); }
  }
  throw last;
}

// base64 -> Uint8Array (RN グローバルの atob を使用)。zipヘッダ解析用。
function b64ToU8(b64: string): Uint8Array {
  const bin = (global as any).atob(b64);
  const u8 = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) u8[i] = bin.charCodeAt(i);
  return u8;
}

// poster-<L>.zip を DL → STORED zip をストリーミング展開して各エントリを
//  ${documentDirectory}poster/<entryname> に書き出す。版が最新ならスキップ。
//  失敗は throw せず握りつぶす(呼び出し側=PosterAudioScreen は未解決を許容)。
async function ensureLangZip(lang: string, entry: any, onProgress?: (done: number, total: number) => void): Promise<void> {
  if (!entry?.url) return;
  const marker = markerUri(lang);
  const m = await FileSystem.getInfoAsync(marker);
  if (m.exists) {
    try {
      const v = await FileSystem.readAsStringAsync(marker);
      if (v === String(entry.version ?? '')) return; // 最新キャッシュ済み
    } catch {}
  }
  await FileSystem.makeDirectoryAsync(posterRoot(), { intermediates: true });

  // 1) zip を1ファイルDL。
  const zipUri = `${posterRoot()}${lang}.zip`;
  const total: number = entry.bytes || 0;
  const dl = FileSystem.createDownloadResumable(entry.url, zipUri, {}, (p: any) => {
    const exp = p.totalBytesExpectedToWrite || total || 1;
    onProgress?.(Math.min(1, p.totalBytesWritten / exp), 1);
  });
  await dl.downloadAsync();

  // 2) ストリーミング展開(packLoader.ts の ensureAudio と同じ範囲読み方式)。
  //   STORED(無圧縮)前提。zip全体をメモリに載せず、各エントリのローカルヘッダ+データを
  //   範囲読みしてそのまま書き出す(ピークメモリは1ファイル分)。
  const zinfo: any = await FileSystem.getInfoAsync(zipUri);
  const zipSize: number = zinfo?.size ?? 0;
  const HDR = 30; // local file header 固定長
  let off = 0, fcount = 0;
  while (off + 4 <= zipSize) {
    const head = b64ToU8(await FileSystem.readAsStringAsync(zipUri, { encoding: 'base64' as any, position: off, length: Math.min(HDR + 256, zipSize - off) }));
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
      // サブディレクトリ("<theme>/audio/..")を書き出し前に作成。
      const slash = name.lastIndexOf('/');
      if (slash > 0) await FileSystem.makeDirectoryAsync(`${posterRoot()}${name.slice(0, slash)}`, { intermediates: true });
      // データをbase64で範囲読み→そのままbase64書き出し(デコード不要・低メモリ)。
      const b64 = await FileSystem.readAsStringAsync(zipUri, { encoding: 'base64' as any, position: dataPos, length: comp });
      await FileSystem.writeAsStringAsync(`${posterRoot()}${name}`, b64, { encoding: 'base64' as any });
      fcount++;
    }
    off = dataPos + comp;
  }
  if (fcount === 0) throw new Error('poster zip展開で0ファイル(破損/形式不一致)');
  // 全エントリ保存完了後にマーカーを書く(途中失敗時は未完=次回再取得)。
  await FileSystem.writeAsStringAsync(marker, String(entry.version ?? ''));
  await FileSystem.deleteAsync(zipUri, { idempotent: true });
}

/** 指定言語のポスターパック(ja + lang)をDL/展開する。
 *  各言語ごとに marker(<L>.version)で版管理し、最新ならスキップ。
 *  失敗は throw せず握りつぶす(画面側がreadyにならず/画像欠落を許容)。 */
export async function ensurePosterPack(lang: string, onProgress?: (done: number, total: number) => void): Promise<void> {
  const needed = lang === 'ja' ? ['ja'] : ['ja', lang];
  let catalog: any = null;
  try { catalog = await withRetry(() => fetchJson(POSTER_CATALOG_URL, 8000)); } catch { return; }
  const langs = catalog?.langs || {};
  for (let i = 0; i < needed.length; i++) {
    const L = needed[i];
    try {
      await ensureLangZip(L, langs[L], onProgress ? (d, t) => onProgress((i + d) / needed.length, t) : undefined);
    } catch {}
  }
}

/** zip内エントリのキー → 端末上の file:// uri。key 未指定なら undefined(ready前など)。 */
export function posterUri(key?: string): string | undefined {
  return key ? `${posterRoot()}${key}` : undefined;
}

/** ja と lang のパックが両方DL済み(marker有り)なら true(簡易)。 */
export async function isPosterReady(lang: string): Promise<boolean> {
  const needed = lang === 'ja' ? ['ja'] : ['ja', lang];
  for (const L of needed) {
    const info = await FileSystem.getInfoAsync(markerUri(L));
    if (!info.exists) return false;
  }
  return true;
}
