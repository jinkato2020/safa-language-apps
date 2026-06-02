// 聞き流しモードの音声エンジン（プレイヤー + 状態機械）をナビゲーションから切り離して保持する Provider。
//
// 経緯: 以前は useAudioPlayer + 状態機械が ListeningScreen 内に置かれていたため、
//   ① テーマ選択画面へ「戻る」（native stack の pop で画面が unmount）
//   ② 設定後にボトムタブで聞き流しタブを再タップ（スタックが初期画面まで pop され unmount）
// のいずれでも useAudioPlayer の自動 release が走り、音声が止まってしまっていた。
//
// この Provider を AppShell 直下（タブナビゲーターの上）にマウントすることで、
// プレイヤーはアプリのライフタイム中ずっと生存する。結果として音声が止まるのは
// 「一時停止」ボタンを押したとき、またはアプリを強制終了したときのみになる。
// ListeningScreen は本 Provider の状態を表示し、操作を委譲するだけの薄い consumer になる。

import { createContext, useContext, useEffect, useRef, useState, type ReactNode } from 'react';
import { useAudioPlayer, useAudioPlayerStatus } from 'expo-audio';
import { useSettings } from './SettingsContext';
import { useI18n } from './i18n';
import { useAppData } from './AppDataContext';
import type { RootStackParamList } from './types';

type Phase = 'idle' | 'first' | 'second';
type SessionParams = RootStackParamList['Listening'];

// gap モードごとの間隔 (ms): JA→NE の間、NE→次例題の間
const GAP_TABLE: Record<'short' | 'normal' | 'long', { first: number; second: number }> = {
  short: { first: 200, second: 600 },
  normal: { first: 400, second: 1200 },
  long: { first: 800, second: 2400 },
};

// ◀ ダブルタップ検出のための時間ウィンドウ（ms）
const BACK_DOUBLE_TAP_MS = 1200;

// データ参照を引数で受け取るヘルパー (useAppData の戻り値を渡してもらう)
type ConvDataDeps = {
  THEMES: { id: number }[];
  LEVELS: { id: number }[];
  getExamples: (themeId: number, levelId: number) => unknown[];
};
type GramDataDeps = {
  GRAMMAR_THEMES: { id: number }[];
  getGrammarExamples: (themeId: number) => unknown[];
};

function findNextConversation(d: ConvDataDeps, themeId: number, levelId: number, index: number, loop: boolean) {
  let t = themeId, l = levelId, i = index + 1;
  const exs = d.getExamples(t, l);
  if (i < exs.length) return { themeId: t, levelId: l, index: i, ended: false };
  i = 0;
  t = t + 1;
  while (t <= d.THEMES.length) {
    if (d.getExamples(t, l).length > 0) {
      return { themeId: t, levelId: l, index: i, ended: false };
    }
    t++;
  }
  l = l + 1;
  if (l <= d.LEVELS.length) {
    t = 1;
    while (t <= d.THEMES.length) {
      if (d.getExamples(t, l).length > 0) {
        return { themeId: t, levelId: l, index: i, ended: false };
      }
      t++;
    }
  }
  if (loop) {
    return { themeId: 1, levelId: 1, index: 0, ended: false };
  }
  return { themeId, levelId, index, ended: true };
}

function findNextGrammar(d: GramDataDeps, themeId: number, index: number, loop: boolean) {
  let t = themeId, i = index + 1;
  const exs = d.getGrammarExamples(t);
  if (i < exs.length) return { themeId: t, index: i, ended: false };
  i = 0;
  t = t + 1;
  while (t <= d.GRAMMAR_THEMES.length) {
    if (d.getGrammarExamples(t).length > 0) {
      return { themeId: t, index: i, ended: false };
    }
    t++;
  }
  if (loop) {
    return { themeId: 1, index: 0, ended: false };
  }
  return { themeId, index, ended: true };
}

function findPrevConversation(d: ConvDataDeps, themeId: number, levelId: number, index: number) {
  if (index - 1 >= 0) {
    return { themeId, levelId, index: index - 1 };
  }
  for (let t = themeId - 1; t >= 1; t--) {
    const exs = d.getExamples(t, levelId);
    if (exs.length > 0) return { themeId: t, levelId, index: exs.length - 1 };
  }
  for (let l = levelId - 1; l >= 1; l--) {
    for (let t = d.THEMES.length; t >= 1; t--) {
      const exs = d.getExamples(t, l);
      if (exs.length > 0) return { themeId: t, levelId: l, index: exs.length - 1 };
    }
  }
  return null;
}

function findPrevGrammar(d: GramDataDeps, themeId: number, index: number) {
  if (index - 1 >= 0) return { themeId, index: index - 1 };
  for (let t = themeId - 1; t >= 1; t--) {
    const exs = d.getGrammarExamples(t);
    if (exs.length > 0) return { themeId: t, index: exs.length - 1 };
  }
  return null;
}

export type ListeningAudioValue = {
  /** セッションが開始済みか（聞き流しを一度でも開始したら true） */
  active: boolean;
  isGrammarSrc: boolean;
  themeId: number;
  levelId: number;
  index: number;
  phase: Phase;
  playing: boolean;
  /** 現在ハイライトすべき言語（カード強調用） */
  activeLang: 'ja' | 'ne' | null;
  /** 画面に入ったときに呼ぶ。同一パラメータなら再生中セッションへ「再接続」して継続。 */
  startSession: (params: SessionParams) => void;
  togglePlay: () => void;
  go: (delta: number) => void;
};

const ListeningAudioContext = createContext<ListeningAudioValue | null>(null);

export function useListeningAudio(): ListeningAudioValue {
  const ctx = useContext(ListeningAudioContext);
  if (!ctx) throw new Error('useListeningAudio must be used within ListeningAudioProvider');
  return ctx;
}

export function ListeningAudioProvider({ children }: { children: ReactNode }) {
  const { LEVELS, THEMES, GRAMMAR_THEMES, getExamples, getGrammarExamples, audio } = useAppData();
  const { nepaliAudio, japaneseAudio, nepaliGrammarAudio, japaneseGrammarAudio } = audio;
  const convDeps: ConvDataDeps = { THEMES, LEVELS, getExamples };
  const gramDeps: GramDataDeps = { GRAMMAR_THEMES, getGrammarExamples };
  const { t, lang } = useI18n();
  const isJaUI = lang === 'ja';
  const {
    listenDirection, nepaliRepeat,
    listenLoop,
    listenSpeed,
    gap,
  } = useSettings();
  const isJa2Ne = listenDirection === 'ja2ne';
  // 繰り返し対象 = UI 言語の反対側 (ja UI → ne を繰り返し、ne UI → ja を繰り返し)
  const repeatLang: 'ja' | 'ne' = isJaUI ? 'ne' : 'ja';
  const firstLang: 'ja' | 'ne' = isJa2Ne ? 'ja' : 'ne';
  const secondLang: 'ja' | 'ne' = isJa2Ne ? 'ne' : 'ja';
  const firstRepeats = firstLang === repeatLang;
  const secondRepeats = secondLang === repeatLang;

  // ── セッション状態 ──
  const [active, setActive] = useState(false);
  const [isGrammarSrc, setIsGrammarSrc] = useState(false);
  const [themeId, setThemeId] = useState(0);
  const [levelId, setLevelId] = useState<number>(1);
  const [index, setIndex] = useState(0);
  const [phase, setPhase] = useState<Phase>('idle');
  const [started, setStarted] = useState(false);
  const [playing, setPlaying] = useState(false);
  const nePlayCountRef = useRef(0);
  const gapTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // startSession が最後に渡されたパラメータ（再接続判定用。auto-advance で themeId/index は変わるため別管理）
  const sessionParamsRef = useRef<SessionParams | null>(null);

  const examples = active
    ? (isGrammarSrc ? getGrammarExamples(themeId) : getExamples(themeId, levelId))
    : [];
  const ex = examples[index] as { jp: string; ne: string } | undefined;
  const audioKey = isGrammarSrc
    ? `${themeId}-${index + 1}`
    : `${themeId}-${levelId}-${index + 1}`;

  const jaSrc = isGrammarSrc ? japaneseGrammarAudio[audioKey] : japaneseAudio[audioKey];
  const neSrc = isGrammarSrc ? nepaliGrammarAudio[audioKey] : nepaliAudio[audioKey];

  // ★★★ 単一プレイヤー方式 ★★★
  // 初期 source なし（null）で生成し、セッション開始時に player.replace() でソースを差し替える。
  // プレイヤー自体は Provider のライフタイム中ずっと安定して存在する。
  const player = useAudioPlayer(undefined, { keepAudioSessionActive: true });
  const status = useAudioPlayerStatus(player);
  // 現在 player に loaded されているソースを追跡
  const loadedSrcRef = useRef<number | string | null>(null);

  // Ref: stale closure 回避用
  const phaseRef = useRef<Phase>('idle');
  const playingRef = useRef(false);
  const isJa2NeRef = useRef(isJa2Ne);
  const nepaliRepeatRef = useRef(nepaliRepeat);
  const listenSpeedRef = useRef(listenSpeed);
  const gapRef = useRef(gap);
  const jaSrcRef = useRef(jaSrc);
  const neSrcRef = useRef(neSrc);
  const firstRepeatsRef = useRef(firstRepeats);
  const secondRepeatsRef = useRef(secondRepeats);
  phaseRef.current = phase;
  playingRef.current = playing;
  isJa2NeRef.current = isJa2Ne;
  nepaliRepeatRef.current = nepaliRepeat;
  listenSpeedRef.current = listenSpeed;
  gapRef.current = gap;
  jaSrcRef.current = jaSrc;
  neSrcRef.current = neSrc;
  firstRepeatsRef.current = firstRepeats;
  secondRepeatsRef.current = secondRepeats;

  // didJustFinish の二重処理を防ぐフラグ
  const finishHandledRef = useRef(false);
  // 最後に play() を呼んだ時刻（直後の遅延イベントを無視するガード）
  const lastPlayStartRef = useRef(0);

  // 単一プレイヤー: 指定ソースをロード（必要なら）→ 先頭から再生
  const playSrc = (src: number | string) => {
    try {
      if (loadedSrcRef.current !== src) {
        player.replace(src);
        loadedSrcRef.current = src;
      }
      player.seekTo(0);
      try {
        (player as any).playbackRate = listenSpeedRef.current;
      } catch {}
      try {
        (player as any).setPlaybackRate?.(listenSpeedRef.current);
      } catch {}
      player.play();
      lastPlayStartRef.current = Date.now();
    } catch {}
  };

  const advanceRef = useRef<() => void>(() => {});

  const themeName = isGrammarSrc
    ? t(`grammarThemes.${themeId}`)
    : t(`themes.${themeId}`);
  const levelName = isGrammarSrc ? t('practice.grammarLabel') : t(`levels.${levelId}`);

  const activeLang: 'ja' | 'ne' | null = (() => {
    if (phase === 'idle') return null;
    if (isJa2Ne) return phase === 'first' ? 'ja' : 'ne';
    return phase === 'first' ? 'ne' : 'ja';
  })();

  const advance = () => {
    if (isGrammarSrc) {
      const nxt = findNextGrammar(gramDeps, themeId, index, listenLoop);
      if (nxt.ended) {
        setPlaying(false); setPhase('idle'); phaseRef.current = 'idle'; return;
      }
      setThemeId(nxt.themeId);
      setIndex(nxt.index);
    } else {
      const nxt = findNextConversation(convDeps, themeId, levelId, index, listenLoop);
      if (nxt.ended) {
        setPlaying(false); setPhase('idle'); phaseRef.current = 'idle'; return;
      }
      setThemeId(nxt.themeId);
      setLevelId(nxt.levelId);
      setIndex(nxt.index);
    }
    setPhase('idle');
    phaseRef.current = 'idle';
    nePlayCountRef.current = 0;
    finishHandledRef.current = false;
  };
  advanceRef.current = advance;

  // ── Android バックグラウンド再生: AudioControlsService の停止だけ unmount(=アプリ終了) で行う ──
  useEffect(() => {
    return () => {
      try {
        (player as any).setActiveForLockScreen?.(false);
      } catch {}
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [player]);

  // ── メタデータ更新: 例題変更時にロックスクリーン情報を更新 ──
  useEffect(() => {
    if (!active) return;
    try {
      (player as any).updateLockScreenMetadata?.({
        title: `例題 ${index + 1} / ${examples.length}`,
        artist: `${themeName} · ${levelName}`,
        albumTitle: '聞いて話せるネパール語',
      });
    } catch {}
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [active, themeId, levelId, index, examples.length, themeName, levelName]);

  // ── advance 後の自動継続: phase='idle' で playing=true なら新しい first を再生 ──
  useEffect(() => {
    if (!active || !started || !playing || !ex) return;
    if (phase !== 'idle') return;
    const firstSrc = isJa2Ne ? jaSrc : neSrc;
    playSrc(firstSrc);
    nePlayCountRef.current = 0;
    finishHandledRef.current = false;
    setPhase('first');
    phaseRef.current = 'first';
    return () => {
      if (gapTimerRef.current) clearTimeout(gapTimerRef.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [active, started, playing, audioKey, isJa2Ne, phase]);

  // ── 再生終了時の処理を関数化（status useEffect と addListener で共有）──
  const handleAudioFinished = () => {
    if (!playingRef.current) return;
    if (finishHandledRef.current) return;
    if (Date.now() - lastPlayStartRef.current < 200) return;
    finishHandledRef.current = true;

    const p = phaseRef.current;
    const ja2ne = isJa2NeRef.current;
    const rep = nepaliRepeatRef.current;
    const gaps = GAP_TABLE[gapRef.current];
    const firstRep = firstRepeatsRef.current;
    const secondRep = secondRepeatsRef.current;
    const firstSrc = ja2ne ? jaSrcRef.current : neSrcRef.current;
    const secondSrc = ja2ne ? neSrcRef.current : jaSrcRef.current;

    if (p === 'first') {
      if (firstRep) {
        nePlayCountRef.current++;
        if (nePlayCountRef.current < rep) {
          playSrc(firstSrc);
          finishHandledRef.current = false;
        } else {
          gapTimerRef.current = setTimeout(() => {
            phaseRef.current = 'second';
            setPhase('second');
            playSrc(secondSrc);
            finishHandledRef.current = false;
          }, gaps.first);
        }
      } else {
        gapTimerRef.current = setTimeout(() => {
          phaseRef.current = 'second';
          setPhase('second');
          nePlayCountRef.current = 0;
          playSrc(secondSrc);
          finishHandledRef.current = false;
        }, gaps.first);
      }
    } else if (p === 'second') {
      if (secondRep) {
        nePlayCountRef.current++;
        if (nePlayCountRef.current < rep) {
          playSrc(secondSrc);
          finishHandledRef.current = false;
        } else {
          gapTimerRef.current = setTimeout(() => {
            phaseRef.current = 'idle';
            finishHandledRef.current = false;
            advanceRef.current();
          }, gaps.second);
        }
      } else {
        gapTimerRef.current = setTimeout(() => {
          phaseRef.current = 'idle';
          finishHandledRef.current = false;
          advanceRef.current();
        }, gaps.second);
      }
    }
  };

  const handleFinishRef = useRef(handleAudioFinished);
  handleFinishRef.current = handleAudioFinished;

  // ── 検出方法1: useAudioPlayerStatus 経由（React 状態更新） ──
  useEffect(() => {
    if (!status.didJustFinish) return;
    handleFinishRef.current();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [status.didJustFinish]);

  // ── 検出方法2: ネイティブイベント直接購読（バックグラウンド対応） ──
  useEffect(() => {
    const sub = (player as any).addListener?.(
      'playbackStatusUpdate',
      (s: any) => {
        if (s?.didJustFinish) {
          handleFinishRef.current();
        }
      }
    );
    return () => {
      try { sub?.remove?.(); } catch {}
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [player]);

  // ── 再生速度を player にリアルタイム反映 ──
  useEffect(() => {
    try {
      (player as any).playbackRate = listenSpeed;
    } catch {}
    try {
      (player as any).setPlaybackRate?.(listenSpeed);
    } catch {}
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [listenSpeed]);

  // ── 再生開始の検証＆リトライ ──
  const retriedRef = useRef(false);
  useEffect(() => {
    retriedRef.current = false;
    if (phase === 'idle' || !playing) return;
    const verifyTimer = setTimeout(() => {
      if (retriedRef.current) return;
      if (!playingRef.current || phaseRef.current === 'idle') return;
      if (player.playing) return;
      retriedRef.current = true;
      try {
        player.seekTo(0);
        player.play();
        lastPlayStartRef.current = Date.now();
      } catch {}
    }, 500);
    return () => clearTimeout(verifyTimer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [phase, audioKey]);

  const togglePlay = () => {
    if (playing) {
      // 一時停止: 音声と gap タイマーを止めるが、phase は維持
      try { player.pause(); } catch {}
      if (gapTimerRef.current) {
        clearTimeout(gapTimerRef.current);
        gapTimerRef.current = null;
      }
      setPlaying(false);
      playingRef.current = false;
    } else {
      // 再開
      if (phase !== 'idle') {
        const dur = player.duration;
        const cur = player.currentTime;
        const isAtEnd = dur > 0 && cur >= dur - 0.1;
        if (isAtEnd) {
          playingRef.current = true;
          setPlaying(true);
          finishHandledRef.current = false;
          handleFinishRef.current();
          return;
        }
        try { player.play(); } catch {}
      }
      setPlaying(true);
      playingRef.current = true;
    }
  };

  // ◀ ダブルタップ検出用: 最後に ◀ を押した時刻
  const lastBackTapRef = useRef(0);

  const go = (delta: number) => {
    try { player.pause(); } catch {}
    if (gapTimerRef.current) clearTimeout(gapTimerRef.current);
    if (delta > 0) {
      lastBackTapRef.current = 0;
      if (isGrammarSrc) {
        const nxt = findNextGrammar(gramDeps, themeId, index, listenLoop);
        if (!nxt.ended) {
          setThemeId(nxt.themeId);
          setIndex(nxt.index);
        }
      } else {
        const nxt = findNextConversation(convDeps, themeId, levelId, index, listenLoop);
        if (!nxt.ended) {
          setThemeId(nxt.themeId);
          setLevelId(nxt.levelId);
          setIndex(nxt.index);
        }
      }
    } else {
      const now = Date.now();
      const isQuickSecondTap = now - lastBackTapRef.current < BACK_DOUBLE_TAP_MS;
      lastBackTapRef.current = now;

      if (isQuickSecondTap) {
        if (isGrammarSrc) {
          const prv = findPrevGrammar(gramDeps, themeId, index);
          if (prv) {
            setThemeId(prv.themeId);
            setIndex(prv.index);
          }
        } else {
          const prv = findPrevConversation(convDeps, themeId, levelId, index);
          if (prv) {
            setThemeId(prv.themeId);
            setLevelId(prv.levelId);
            setIndex(prv.index);
          }
        }
      }
    }
    setPhase('idle');
    nePlayCountRef.current = 0;
    finishHandledRef.current = false;
    if (!playing) {
      setPlaying(true);
      playingRef.current = true;
    }
  };

  const sameParams = (a: SessionParams | null, b: SessionParams) =>
    a != null &&
    a.themeId === b.themeId &&
    (a.levelId ?? undefined) === (b.levelId ?? undefined) &&
    (a.startIndex ?? undefined) === (b.startIndex ?? undefined) &&
    a.source === b.source;

  const startSession = (params: SessionParams) => {
    // 同一パラメータで既に再生中なら「再接続」＝現在のセッションをそのまま継続
    if (active && sameParams(sessionParamsRef.current, params)) return;
    sessionParamsRef.current = params;
    if (gapTimerRef.current) {
      clearTimeout(gapTimerRef.current);
      gapTimerRef.current = null;
    }
    const grammar = params.source === 'grammar';
    setIsGrammarSrc(grammar);
    setThemeId(params.themeId);
    setLevelId(params.levelId ?? 1);
    setIndex(params.startIndex ?? 0);
    setPhase('idle');
    phaseRef.current = 'idle';
    nePlayCountRef.current = 0;
    finishHandledRef.current = false;
    setActive(true);
    setStarted(true);
    setPlaying(true);
    playingRef.current = true;
    try {
      (player as any).setActiveForLockScreen?.(true, {
        title: '聞いて話せる',
        artist: '',
        albumTitle: '聞いて話せるネパール語',
      });
    } catch {}
  };

  const value: ListeningAudioValue = {
    active,
    isGrammarSrc,
    themeId,
    levelId,
    index,
    phase,
    playing,
    activeLang,
    startSession,
    togglePlay,
    go,
  };

  return (
    <ListeningAudioContext.Provider value={value}>
      {children}
    </ListeningAudioContext.Provider>
  );
}
