// ポスター音声学習レッスンを各アプリ(App A等)から供給するためのContext。
import React, { createContext, useContext } from 'react';

export type PosterCard = { i: number; box: { x: number; y: number; w: number; h: number }; ja: number; ne: number; ill: number; word: string; kana: string; romaji: string; np: string };
export type PosterLesson = { id: string; title: string; titleNp: string; image: number; posterW: number; posterH: number; cards: PosterCard[] };

const Ctx = createContext<PosterLesson[]>([]);
export { Ctx as PosterCtx };
export const PosterProvider = ({ lessons, children }: { lessons: PosterLesson[]; children: React.ReactNode }) =>
  <Ctx.Provider value={lessons || []}>{children}</Ctx.Provider>;
export const usePosterLessons = () => useContext(Ctx);
