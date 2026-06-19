// ポスター音声学習レッスンを各アプリ(App A等)から供給するためのContext。
import React, { createContext, useContext } from 'react';

// ja=日本語音声(必須)。母語音声は l1{言語コード:キー}(App B 多言語) か ne(App A 単一)で供給。
// 画像は imageL1{言語コード:キー}(母語別) か image(単一)。ill/word/kana/romaji/np は任意(ポスター画像に描かれている場合は省略可)。
// ※ ja/l1/ne/ill/image/imageL1/titleAudio の値は packs-poster zip 内エントリのキー文字列。
//   file:// への解決とDLは下記 resolveUri/ensure(App B が posterPackLoader を注入)で行う。
export type PosterCard = {
  i: number; box: { x: number; y: number; w: number; h: number };
  ja: string; l1?: Record<string, string>; ne?: string;
  ill?: string; word?: string; kana?: string; romaji?: string; np?: string;
};
export type PosterLesson = {
  id: string; title: string; titleNp?: string;
  image?: string; imageL1?: Record<string, string>;
  titleAudio?: { ja: string; l1: Record<string, string> };   // タイトル朗読(母語→日本語)
  posterW: number; posterH: number; cards: PosterCard[];
};

// アプリ固有ローダの注入用。資源(音声/画像)はDLパックなので、
//  - resolveUri: zip内エントリのキー → 端末上の file:// uri へ解決
//  - ensure: 指定言語のポスターパック(ja + その言語)をDL/展開する
// shared(PosterAudioScreen)はアプリ固有ローダを直接importできないため、ここで注入する。
//  App A/C はポスター未使用(lessons空)なので未注入で可。
export type PosterResolver = {
  resolveUri?: (key?: string) => string | undefined;
  ensure?: (lang: string) => Promise<void>;
};

const Ctx = createContext<PosterLesson[]>([]);
const ResolverCtx = createContext<PosterResolver>({});
export { Ctx as PosterCtx };
export const PosterProvider = (
  { lessons, resolveUri, ensure, children }:
  { lessons: PosterLesson[]; resolveUri?: PosterResolver['resolveUri']; ensure?: PosterResolver['ensure']; children: React.ReactNode },
) => (
  <Ctx.Provider value={lessons || []}>
    <ResolverCtx.Provider value={{ resolveUri, ensure }}>{children}</ResolverCtx.Provider>
  </Ctx.Provider>
);
export const usePosterLessons = () => useContext(Ctx);
export const usePosterResolver = () => useContext(ResolverCtx);
