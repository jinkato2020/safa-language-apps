// 最小の「継続/成長」データ層(AsyncStorage)。各アプリ共通で利用。
// 定義が曖昧な「覚えた語/テーマ完了」には踏み込まず、まず『学習した日』を確実に記録する。
// markStudied(n) を学習イベントで呼ぶ(n=その日の活動量加算)。ホーム表示=その日を記録。
// App固有のリッチな定義(覚えた語等)は各アプリセッションが後から markStudied(n) の呼び出し箇所を足せばよい。
import { useCallback, useEffect, useState } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';

const pad = (n: number) => String(n).padStart(2, '0');

export function todayStr(): string {
  const d = new Date();
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}
export function addDays(day: string, delta: number): string {
  const [y, m, d] = day.split('-').map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d + delta));
  return `${dt.getUTCFullYear()}-${pad(dt.getUTCMonth() + 1)}-${pad(dt.getUTCDate())}`;
}
export function lastNDays(today: string, n: number): string[] {
  return Array.from({ length: n }, (_, i) => addDays(today, -(n - 1 - i)));
}

interface Stored { days: string[]; perDay: Record<string, number> }

export interface DailyProgress {
  ready: boolean;
  today: string;
  studied: Set<string>;
  perDay: Record<string, number>;
  streak: number;     // 今日(未学習なら昨日)までの連続学習日数
  longest: number;    // 最長連続
  totalDays: number;  // 学習した延べ日数
  todayCount: number; // 今日の活動量
  markStudied: (n?: number) => void;
}

function computeStreak(studied: Set<string>, today: string): number {
  let n = 0;
  let d = studied.has(today) ? today : addDays(today, -1);
  while (studied.has(d)) { n++; d = addDays(d, -1); }
  return n;
}
function computeLongest(days: string[]): number {
  const set = new Set(days);
  let best = 0;
  for (const day of days) {
    if (set.has(addDays(day, -1))) continue; // 連の先頭のみ起点に
    let n = 1;
    let d = addDays(day, 1);
    while (set.has(d)) { n++; d = addDays(d, 1); }
    if (n > best) best = n;
  }
  return best;
}

export function useDailyProgress(storageKey: string): DailyProgress {
  const [stored, setStored] = useState<Stored>({ days: [], perDay: {} });
  const [ready, setReady] = useState(false);
  const today = todayStr();

  useEffect(() => {
    let alive = true;
    AsyncStorage.getItem(storageKey)
      .then((v) => { if (alive) { if (v) { try { setStored(JSON.parse(v)); } catch { /* noop */ } } setReady(true); } })
      .catch(() => { if (alive) setReady(true); });
    return () => { alive = false; };
  }, [storageKey]);

  const markStudied = useCallback((n = 1) => {
    setStored((prev) => {
      const t = todayStr();
      const days = prev.days.includes(t) ? prev.days : [...prev.days, t];
      const perDay = { ...prev.perDay, [t]: (prev.perDay[t] ?? 0) + n };
      const next: Stored = { days, perDay };
      AsyncStorage.setItem(storageKey, JSON.stringify(next)).catch(() => {});
      return next;
    });
  }, [storageKey]);

  const studied = new Set(stored.days);
  return {
    ready, today, studied, perDay: stored.perDay,
    streak: computeStreak(studied, today),
    longest: computeLongest(stored.days),
    totalDays: stored.days.length,
    todayCount: stored.perDay[today] ?? 0,
    markStudied,
  };
}
