// App A(target=ne / 母語=ja[,en])のポスター資源ローダ。音声mp3・ポスターpngは同梱せず
//  GitHub Release(packs-poster-appa)からDLパックとして取得する。App B(packs-poster)と同方式・別タグ。
//  - poster-catalog.json = { version, langs:{ ne:{url,bytes,version}, ja:.., en:.. } }
//    ne=ターゲット音声(母語横断で共有) / ja・en=母語の音声+ポスター画像。
//  - poster-<L>.zip は STORED(無圧縮)。エントリ名は "<theme>/audio/<NN>_<L>.mp3" / "title_<L>.mp3" /
//    "<theme>/poster_<L>.png"、数字は "numbers/page1/audio/.." の多階層。ne は音声のみ(画像なし)。
//  zip は範囲読み(STORED)で ${documentDirectory}poster/<entryname> へストリーミング展開(OOM安全)。
import * as FileSystem from 'expo-file-system/legacy';

export const POSTER_CATALOG_URL =
  'https://github.com/JinKato2020/safa-language-apps/releases/download/packs-poster-appa/poster-catalog.json';

const TARGET = 'ne';  // App A の学習対象=ネパール語(母語横断で共有する音声パック)

const posterRoot = () => `${FileSystem.documentDirectory}poster/`;
const markerUri = (lang: string) => `${posterRoot()}${lang}.version`;

async function fetchJson(url: string, timeoutMs = 8000): Promise<any> {
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

function b64ToU8(b64: string): Uint8Array {
  const bin = (global as any).atob(b64);
  const u8 = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) u8[i] = bin.charCodeAt(i);
  return u8;
}

async function ensureLangZip(lang: string, entry: any, onProgress?: (done: number, total: number) => void): Promise<void> {
  if (!entry?.url) return;
  const marker = markerUri(lang);
  const m = await FileSystem.getInfoAsync(marker);
  if (m.exists) {
    try {
      const v = await FileSystem.readAsStringAsync(marker);
      if (v === String(entry.version ?? '')) return;
    } catch {}
  }
  await FileSystem.makeDirectoryAsync(posterRoot(), { intermediates: true });

  const zipUri = `${posterRoot()}${lang}.zip`;
  const total: number = entry.bytes || 0;
  const dl = FileSystem.createDownloadResumable(entry.url, zipUri, {}, (p: any) => {
    const exp = p.totalBytesExpectedToWrite || total || 1;
    onProgress?.(Math.min(1, p.totalBytesWritten / exp), 1);
  });
  await dl.downloadAsync();

  const zinfo: any = await FileSystem.getInfoAsync(zipUri);
  const zipSize: number = zinfo?.size ?? 0;
  const HDR = 30;
  let off = 0, fcount = 0;
  while (off + 4 <= zipSize) {
    const head = b64ToU8(await FileSystem.readAsStringAsync(zipUri, { encoding: 'base64' as any, position: off, length: Math.min(HDR + 512, zipSize - off) }));
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
    if (comp > 0 && name && !name.endsWith('/')) {
      const slash = name.lastIndexOf('/');
      if (slash > 0) await FileSystem.makeDirectoryAsync(`${posterRoot()}${name.slice(0, slash)}`, { intermediates: true });
      const b64 = await FileSystem.readAsStringAsync(zipUri, { encoding: 'base64' as any, position: dataPos, length: comp });
      await FileSystem.writeAsStringAsync(`${posterRoot()}${name}`, b64, { encoding: 'base64' as any });
      fcount++;
    }
    off = dataPos + comp;
  }
  if (fcount === 0) throw new Error('poster zip展開で0ファイル(破損/形式不一致)');
  await FileSystem.writeAsStringAsync(marker, String(entry.version ?? ''));
  await FileSystem.deleteAsync(zipUri, { idempotent: true });
}

/** 指定母語のポスターパック(ne[ターゲット] + lang[母語])をDL/展開する。最新ならスキップ。失敗は握りつぶす。 */
export async function ensurePosterPack(lang: string, onProgress?: (done: number, total: number) => void): Promise<void> {
  const needed = lang === TARGET ? [TARGET] : [TARGET, lang];
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

/** zip内エントリのキー → 端末上の file:// uri。 */
export function posterUri(key?: string): string | undefined {
  return key ? `${posterRoot()}${key}` : undefined;
}

/** ne(ターゲット) と lang(母語) が両方DL済みなら true。 */
export async function isPosterReady(lang: string): Promise<boolean> {
  const needed = lang === TARGET ? [TARGET] : [TARGET, lang];
  for (const L of needed) {
    const info = await FileSystem.getInfoAsync(markerUri(L));
    if (!info.exists) return false;
  }
  return true;
}
