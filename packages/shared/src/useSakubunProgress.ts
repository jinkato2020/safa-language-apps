// 作文(自己採点リコール)の進捗。「できた」と判定した例題IDを端末ローカルに保持。
// 短文タブの作文と、ホームの3リング(短文)で共有。App B のみ使用。
import { useCallback, useEffect, useState } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';

export const SAKUBUN_KEY = '@safa_shared/sakubun_v1';

export function useSakubunProgress(storageKey: string = SAKUBUN_KEY) {
  const [done, setDone] = useState<Set<string>>(new Set());
  const [ready, setReady] = useState(false);
  useEffect(() => {
    let alive = true;
    AsyncStorage.getItem(storageKey)
      .then((v) => {
        if (!alive) return;
        try { if (v) setDone(new Set(JSON.parse(v) as string[])); } catch {}
        setReady(true);
      })
      .catch(() => { if (alive) setReady(true); });
    return () => { alive = false; };
  }, [storageKey]);

  const mark = useCallback((id: string, ok: boolean) => {
    setDone((prev) => {
      const next = new Set(prev);
      if (ok) next.add(id); else next.delete(id);
      AsyncStorage.setItem(storageKey, JSON.stringify([...next])).catch(() => {});
      return next;
    });
  }, [storageKey]);

  return { done, mark, ready, count: done.size };
}
