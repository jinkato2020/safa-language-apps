// ポスター音声学習レッスンを各アプリ(App A等)から供給するためのContext。
import React, { createContext, useContext } from 'react';

// ja=日本語音声(必須)。母語音声は l1{言語コード:asset}(App B 多言語) か ne(App A 単一)で供給。
// 画像は imageL1{言語コード:asset}(母語別) か image(単一)。ill/word/kana/romaji/np は任意(ポスター画像に描かれている場合は省略可)。
export type PosterCard = {
  i: number; box: { x: number; y: number; w: number; h: number };
  ja: number; l1?: Record<string, number>; ne?: number;
  ill?: number; word?: string; kana?: string; romaji?: string; np?: string;
};
export type PosterLesson = {
  id: string; title: string; titleNp?: string;
  image?: number; imageL1?: Record<string, number>;
  titleAudio?: { ja: number; l1: Record<string, number> };   // タイトル朗読(母語→日本語)
  posterW: number; posterH: number; cards: PosterCard[];
};

const Ctx = createContext<PosterLesson[]>([]);
export { Ctx as PosterCtx };
export const PosterProvider = ({ lessons, children }: { lessons: PosterLesson[]; children: React.ReactNode }) =>
  <Ctx.Provider value={lessons || []}>{children}</Ctx.Provider>;
export const usePosterLessons = () => useContext(Ctx);
