import { useEffect, useRef, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useNavigation, useRoute, type RouteProp } from '@react-navigation/native';
import { useAudioPlayer, useAudioPlayerStatus, setAudioModeAsync } from 'expo-audio';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import Svg, { Circle, Path, Polygon, Polyline, Rect } from 'react-native-svg';
import { colors, spacing, radius } from '../theme';
import type { RootStackParamList } from '../types';
import {
  LEVELS, THEMES, GRAMMAR_THEMES,
  getExamples, getGrammarExamples,
  isCombinationFree, isGrammarThemeFree,
} from '../dataLoader';
import {
  nepaliAudio, japaneseAudio,
  nepaliGrammarAudio, japaneseGrammarAudio,
} from '../../data/audioMap';
import { useSettings, type ListenSpeed } from '../SettingsContext';
import { sentenceToRomaji } from '../transliterate';

type Nav = NativeStackNavigationProp<RootStackParamList, 'Listening'>;
type R = RouteProp<RootStackParamList, 'Listening'>;

const GAP_AFTER_FIRST = 400;
const GAP_AFTER_SECOND = 1200;
const SPEEDS: ListenSpeed[] = [0.8, 1.0, 1.2, 1.5];

// ── アイコン ──
function PrevIcon({ size = 22 }: { size?: number }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill={colors.ink}>
      <Rect x={5} y={5} width={2.5} height={14} rx={1.25} />
      <Polygon points="20,5 9,12 20,19" />
    </Svg>
  );
}
function NextIcon({ size = 22 }: { size?: number }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill={colors.ink}>
      <Polygon points="4,5 15,12 4,19" />
      <Rect x={16.5} y={5} width={2.5} height={14} rx={1.25} />
    </Svg>
  );
}
function PlayIcon({ size = 30 }: { size?: number }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="#fff">
      <Path d="M8 5.5v13c0 .8.9 1.3 1.6.9l10.5-6.5c.6-.4.6-1.3 0-1.7L9.6 4.6C8.9 4.2 8 4.7 8 5.5z" />
    </Svg>
  );
}
function PauseIcon({ size = 30 }: { size?: number }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="#fff">
      <Rect x={6.5} y={5} width={4} height={14} rx={1.5} />
      <Rect x={13.5} y={5} width={4} height={14} rx={1.5} />
    </Svg>
  );
}

// 会話の次の (theme, level, idx) を計算
//   テーマ優先: 同じレベルで全テーマを横断 → 次のレベル
//   例: 分野1の初級 → 分野2の初級 → … → 分野30の初級 → 分野1の中級 …
function findNextConversation(themeId: number, levelId: number, index: number, loop: boolean) {
  let t = themeId, l = levelId, i = index + 1;
  const exs = getExamples(t, l);
  if (i < exs.length) return { themeId: t, levelId: l, index: i, ended: false };

  // 同じレベルで次のテーマを探す
  i = 0;
  t = t + 1;
  while (t <= THEMES.length) {
    if (isCombinationFree('listening', t, l) && getExamples(t, l).length > 0) {
      return { themeId: t, levelId: l, index: i, ended: false };
    }
    t++;
  }

  // 同レベルの全テーマ終わり → 次のレベルでテーマ1から
  l = l + 1;
  if (l <= LEVELS.length) {
    t = 1;
    while (t <= THEMES.length) {
      if (isCombinationFree('listening', t, l) && getExamples(t, l).length > 0) {
        return { themeId: t, levelId: l, index: i, ended: false };
      }
      t++;
    }
  }

  // 全部終わった → loop なら最初に戻る
  if (loop) {
    return { themeId: THEMES.find(th => th.free)?.id ?? 1, levelId: 1, index: 0, ended: false };
  }
  return { themeId, levelId, index, ended: true };
}

// 文法の次の (theme, idx) を計算（分野順送り、ループ）
function findNextGrammar(themeId: number, index: number, loop: boolean) {
  let t = themeId, i = index + 1;
  const exs = getGrammarExamples(t);
  if (i < exs.length) return { themeId: t, index: i, ended: false };
  i = 0;
  t = t + 1;
  while (t <= GRAMMAR_THEMES.length) {
    if (isGrammarThemeFree(t) && getGrammarExamples(t).length > 0) {
      return { themeId: t, index: i, ended: false };
    }
    t++;
  }
  if (loop) {
    return { themeId: GRAMMAR_THEMES.find(th => th.free)?.id ?? 1, index: 0, ended: false };
  }
  return { themeId, index, ended: true };
}

export default function ListeningScreen() {
  const route = useRoute<R>();
  const initial = route.params;
  const isGrammarSrc = initial.source === 'grammar';
  const {
    listenDirection, nepaliRepeat,
    listenLoop, setListenLoop,
    listenSpeed, setListenSpeed,
    romaji,
  } = useSettings();
  const isJa2Ne = listenDirection === 'ja2ne';

  // 進行カーソル
  const [themeId, setThemeId] = useState(initial.themeId);
  const [levelId, setLevelId] = useState<number>(initial.levelId ?? 1);
  const [index, setIndex] = useState(initial.startIndex ?? 0);
  const [phase, setPhase] = useState<'idle' | 'first' | 'second'>('idle');
  // iOS の自動再生制約のため、最初の1タップだけユーザーに要求する
  // タップ後は started=true になり、自動再生ループが開始する
  const [started, setStarted] = useState(false);
  const [playing, setPlaying] = useState(false);
  const nePlayCountRef = useRef(0);
  const gapTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const examples = isGrammarSrc ? getGrammarExamples(themeId) : getExamples(themeId, levelId);
  const ex = examples[index];
  const audioKey = isGrammarSrc
    ? `${themeId}-${index + 1}`
    : `${themeId}-${levelId}-${index + 1}`;

  const jaSrc = isGrammarSrc ? japaneseGrammarAudio[audioKey] : japaneseAudio[audioKey];
  const neSrc = isGrammarSrc ? nepaliGrammarAudio[audioKey] : nepaliAudio[audioKey];
  // 重要: keepAudioSessionActive: true で iOS 音声セッションの活性化/非活性化サイクルを防ぐ
  // これがないと、ja → ne の切り替え時にセッションが落ち、音声が出なくなる
  const jaPlayer = useAudioPlayer(jaSrc, { keepAudioSessionActive: true });
  const nePlayer = useAudioPlayer(neSrc, { keepAudioSessionActive: true });
  const jaStatus = useAudioPlayerStatus(jaPlayer);
  const neStatus = useAudioPlayerStatus(nePlayer);

  // ── Ref（リスナー内でのstale closure回避）──
  // レンダー中に同期更新することで、リスナーが常に最新値を参照できる
  const phaseRef = useRef<'idle' | 'first' | 'second'>('idle');
  const playingRef = useRef(false);
  const isJa2NeRef = useRef(isJa2Ne);
  const nepaliRepeatRef = useRef(nepaliRepeat);
  const listenSpeedRef = useRef(listenSpeed);
  phaseRef.current = phase;
  playingRef.current = playing;
  isJa2NeRef.current = isJa2Ne;
  nepaliRepeatRef.current = nepaliRepeat;
  listenSpeedRef.current = listenSpeed;

  // advance 関数をリスナーから呼べるよう ref 経由で参照
  const advanceRef = useRef<() => void>(() => {});
  // タイマーバックアップ用
  const playbackTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const clearPlaybackTimer = () => {
    if (playbackTimerRef.current) { clearTimeout(playbackTimerRef.current); playbackTimerRef.current = null; }
  };

  // ── useAudioPlayerStatus フォールバック（addListener が発火しない端末対応）──
  // addListener と二重にトリガーされないよう、処理済みフラグで制御
  const jaHandledRef = useRef(false);
  const neHandledRef = useRef(false);

  useEffect(() => {
    if (!jaStatus.didJustFinish || !playingRef.current) return;
    if (jaHandledRef.current) return;
    jaHandledRef.current = true;
    const p = phaseRef.current;
    const ja2ne = isJa2NeRef.current;
    if (p === 'first' && ja2ne) {
      if (gapTimerRef.current) clearTimeout(gapTimerRef.current);
      gapTimerRef.current = setTimeout(() => {
        jaHandledRef.current = false;
        neHandledRef.current = false;
        try {
          nePlayCountRef.current = 0;
          nePlayer.seekTo(0);
          nePlayer.playbackRate = listenSpeedRef.current;
          nePlayer.play();
        } catch {}
        setPhase('second'); phaseRef.current = 'second';
      }, GAP_AFTER_FIRST);
    } else if (p === 'second' && !ja2ne) {
      if (gapTimerRef.current) clearTimeout(gapTimerRef.current);
      gapTimerRef.current = setTimeout(() => {
        jaHandledRef.current = false;
        neHandledRef.current = false;
        advanceRef.current();
      }, GAP_AFTER_SECOND);
    } else {
      jaHandledRef.current = false;
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [jaStatus.didJustFinish]);

  useEffect(() => {
    if (!neStatus.didJustFinish || !playingRef.current) return;
    if (neHandledRef.current) return;
    neHandledRef.current = true;
    const p = phaseRef.current;
    const ja2ne = isJa2NeRef.current;
    const rep = nepaliRepeatRef.current;
    if (p === 'first' && !ja2ne) {
      nePlayCountRef.current++;
      if (nePlayCountRef.current < rep) {
        neHandledRef.current = false;
        try { nePlayer.seekTo(0); nePlayer.play(); } catch {}
      } else {
        if (gapTimerRef.current) clearTimeout(gapTimerRef.current);
        gapTimerRef.current = setTimeout(() => {
          jaHandledRef.current = false;
          neHandledRef.current = false;
          try {
            jaPlayer.seekTo(0);
            jaPlayer.playbackRate = listenSpeedRef.current;
            jaPlayer.play();
          } catch {}
          setPhase('second'); phaseRef.current = 'second';
        }, GAP_AFTER_SECOND);
      }
    } else if (p === 'second' && ja2ne) {
      nePlayCountRef.current++;
      if (nePlayCountRef.current < rep) {
        neHandledRef.current = false;
        try { nePlayer.seekTo(0); nePlayer.play(); } catch {}
      } else {
        if (gapTimerRef.current) clearTimeout(gapTimerRef.current);
        gapTimerRef.current = setTimeout(() => {
          jaHandledRef.current = false;
          neHandledRef.current = false;
          advanceRef.current();
        }, GAP_AFTER_SECOND);
      }
    } else {
      neHandledRef.current = false;
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [neStatus.didJustFinish]);

  // 速度反映
  useEffect(() => {
    try {
      jaPlayer.playbackRate = listenSpeed;
      nePlayer.playbackRate = listenSpeed;
    } catch {}
  }, [listenSpeed, jaPlayer, nePlayer, audioKey]);

  const themeName = isGrammarSrc
    ? GRAMMAR_THEMES.find(t => t.id === themeId)?.name ?? ''
    : THEMES.find(t => t.id === themeId)?.name ?? '';
  const levelName = isGrammarSrc ? '文法' : LEVELS.find(l => l.id === levelId)?.name ?? '';

  // 現在 active な言語（UI ハイライト用）
  const activeLang: 'ja' | 'ne' | null = (() => {
    if (phase === 'idle') return null;
    if (isJa2Ne) return phase === 'first' ? 'ja' : 'ne';
    return phase === 'first' ? 'ne' : 'ja';
  })();

  const advance = () => {
    if (isGrammarSrc) {
      const nxt = findNextGrammar(themeId, index, listenLoop);
      if (nxt.ended) {
        setPlaying(false); setPhase('idle'); phaseRef.current = 'idle'; return;
      }
      setThemeId(nxt.themeId);
      setIndex(nxt.index);
    } else {
      const nxt = findNextConversation(themeId, levelId, index, listenLoop);
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
    jaHandledRef.current = false;
    neHandledRef.current = false;
    clearPlaybackTimer();
  };
  // レンダーごとに最新の advance を ref に保持
  advanceRef.current = advance;

  // ── シーケンス開始（advance() 後の自動継続用）──
  // 初回再生は handleStart で直接 play() するため、これは「2回目以降」用
  // started=true && playing=true && phase='idle' で発火
  useEffect(() => {
    if (!started || !playing || !ex) return;
    if (phase !== 'idle') return;

    const firstPlayer = isJa2Ne ? jaPlayer : nePlayer;
    try {
      firstPlayer.seekTo(0);
      firstPlayer.playbackRate = listenSpeed;
      firstPlayer.volume = 1.0;
      firstPlayer.play();
      if (!isJa2Ne) nePlayCountRef.current = 0;
      jaHandledRef.current = false;
      neHandledRef.current = false;
      clearPlaybackTimer();
      setPhase('first');
      phaseRef.current = 'first';
    } catch {}
    return () => {
      if (gapTimerRef.current) clearTimeout(gapTimerRef.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [started, playing, audioKey, isJa2Ne, phase]);

  // ユーザータップで再生開始（PracticeScreen と同じく同期的に play() 呼ぶ）
  // iOS は「ユーザータップと同じ同期ブロック内の play()」を確実に許可する
  const handleStart = () => {
    if (started) return;

    // 音声セッション設定（await しない: 同期ブロックを維持するため）
    setAudioModeAsync({
      playsInSilentMode: true,
      shouldPlayInBackground: true,
      interruptionMode: 'doNotMix',
    }).catch(() => {});

    // ★ ここで直接 play() 呼ぶ - state 経由しない
    const firstPlayer = isJa2Ne ? jaPlayer : nePlayer;
    try {
      firstPlayer.seekTo(0);
      firstPlayer.playbackRate = listenSpeed;
      firstPlayer.volume = 1.0;
      firstPlayer.play();
    } catch {}

    // 状態を直接更新（再レンダーで通常UIに切り替わる）
    nePlayCountRef.current = 0;
    jaHandledRef.current = false;
    neHandledRef.current = false;
    clearPlaybackTimer();
    setStarted(true);
    setPlaying(true);
    playingRef.current = true;
    setPhase('first');
    phaseRef.current = 'first';
  };

  // ── タイマーバックアップ: duration が分かったらカウントダウンセット ──
  // addListener / useAudioPlayerStatus の didJustFinish が発火しない端末でも確実に進行
  useEffect(() => {
    if (phase === 'idle' || !playing) { clearPlaybackTimer(); return; }
    if (playbackTimerRef.current) return; // 既にタイマーあり
    const dur = phase === 'first'
      ? (isJa2Ne ? jaStatus.duration : neStatus.duration)
      : (isJa2Ne ? neStatus.duration : jaStatus.duration);
    if (dur <= 0) return; // duration 未確定
    const ms = Math.ceil(dur / listenSpeedRef.current * 1000) + 1200;
    playbackTimerRef.current = setTimeout(() => {
      playbackTimerRef.current = null;
      if (!playingRef.current) return;
      const p = phaseRef.current;
      const ja2ne = isJa2NeRef.current;
      const rep = nepaliRepeatRef.current;
      if (p === 'first') {
        if (ja2ne) {
          if (!jaHandledRef.current) {
            jaHandledRef.current = true;
            neHandledRef.current = false;
            gapTimerRef.current = setTimeout(() => {
              try { nePlayCountRef.current = 0; nePlayer.seekTo(0); nePlayer.playbackRate = listenSpeedRef.current; nePlayer.play(); } catch {}
              setPhase('second'); phaseRef.current = 'second';
            }, GAP_AFTER_FIRST);
          }
        } else {
          if (!neHandledRef.current) {
            neHandledRef.current = true;
            nePlayCountRef.current++;
            if (nePlayCountRef.current < rep) {
              neHandledRef.current = false;
              try { nePlayer.seekTo(0); nePlayer.play(); } catch {}
            } else {
              jaHandledRef.current = false;
              gapTimerRef.current = setTimeout(() => {
                try { jaPlayer.seekTo(0); jaPlayer.playbackRate = listenSpeedRef.current; jaPlayer.play(); } catch {}
                setPhase('second'); phaseRef.current = 'second';
              }, GAP_AFTER_SECOND);
            }
          }
        }
      } else if (p === 'second') {
        if (!ja2ne) {
          if (!jaHandledRef.current) {
            jaHandledRef.current = true;
            gapTimerRef.current = setTimeout(() => advanceRef.current(), GAP_AFTER_SECOND);
          }
        } else {
          if (!neHandledRef.current) {
            neHandledRef.current = true;
            nePlayCountRef.current++;
            if (nePlayCountRef.current < rep) {
              neHandledRef.current = false;
              try { nePlayer.seekTo(0); nePlayer.play(); } catch {}
            } else {
              gapTimerRef.current = setTimeout(() => advanceRef.current(), GAP_AFTER_SECOND);
            }
          }
        }
      }
    }, ms);
    return () => clearPlaybackTimer();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [phase, playing, jaStatus.duration, neStatus.duration]);

  // ── 音声終了を addListener で確実に捕捉（React バッチングで didJustFinish を取りこぼさない）──
  useEffect(() => {
    const onJa = (status: any) => {
      if (!status.didJustFinish || !playingRef.current) return;
      if (jaHandledRef.current) return;
      jaHandledRef.current = true;
      const p = phaseRef.current;
      const ja2ne = isJa2NeRef.current;
      if (p === 'first' && ja2ne) {
        if (gapTimerRef.current) clearTimeout(gapTimerRef.current);
        gapTimerRef.current = setTimeout(() => {
          jaHandledRef.current = false;
          neHandledRef.current = false;
          try {
            nePlayCountRef.current = 0;
            nePlayer.seekTo(0);
            nePlayer.playbackRate = listenSpeedRef.current;
            nePlayer.play();
          } catch {}
          setPhase('second'); phaseRef.current = 'second';
        }, GAP_AFTER_FIRST);
      } else if (p === 'second' && !ja2ne) {
        if (gapTimerRef.current) clearTimeout(gapTimerRef.current);
        gapTimerRef.current = setTimeout(() => {
          jaHandledRef.current = false;
          neHandledRef.current = false;
          advanceRef.current();
        }, GAP_AFTER_SECOND);
      } else {
        jaHandledRef.current = false;
      }
    };

    const onNe = (status: any) => {
      if (!status.didJustFinish || !playingRef.current) return;
      if (neHandledRef.current) return;
      neHandledRef.current = true;
      const p = phaseRef.current;
      const ja2ne = isJa2NeRef.current;
      const rep = nepaliRepeatRef.current;
      if (p === 'first' && !ja2ne) {
        nePlayCountRef.current++;
        if (nePlayCountRef.current < rep) {
          neHandledRef.current = false;
          try { nePlayer.seekTo(0); nePlayer.play(); } catch {}
        } else {
          if (gapTimerRef.current) clearTimeout(gapTimerRef.current);
          gapTimerRef.current = setTimeout(() => {
            jaHandledRef.current = false;
            neHandledRef.current = false;
            try {
              jaPlayer.seekTo(0);
              jaPlayer.playbackRate = listenSpeedRef.current;
              jaPlayer.play();
            } catch {}
            setPhase('second'); phaseRef.current = 'second';
          }, GAP_AFTER_SECOND);
        }
      } else if (p === 'second' && ja2ne) {
        nePlayCountRef.current++;
        if (nePlayCountRef.current < rep) {
          neHandledRef.current = false;
          try { nePlayer.seekTo(0); nePlayer.play(); } catch {}
        } else {
          if (gapTimerRef.current) clearTimeout(gapTimerRef.current);
          gapTimerRef.current = setTimeout(() => {
            jaHandledRef.current = false;
            neHandledRef.current = false;
            advanceRef.current();
          }, GAP_AFTER_SECOND);
        }
      } else {
        neHandledRef.current = false;
      }
    };

    const jaSub = jaPlayer.addListener('playbackStatusUpdate', onJa);
    const neSub = nePlayer.addListener('playbackStatusUpdate', onNe);
    return () => { jaSub.remove(); neSub.remove(); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [jaPlayer, nePlayer]);

  const togglePlay = () => {
    if (playing) {
      jaPlayer.pause();
      nePlayer.pause();
      if (gapTimerRef.current) clearTimeout(gapTimerRef.current);
      clearPlaybackTimer();
      setPlaying(false);
    } else {
      setPhase('idle');
      setPlaying(true);
    }
  };

  const go = (delta: number) => {
    jaPlayer.pause();
    nePlayer.pause();
    if (gapTimerRef.current) clearTimeout(gapTimerRef.current);
    clearPlaybackTimer();
    if (delta > 0) {
      if (isGrammarSrc) {
        const nxt = findNextGrammar(themeId, index, listenLoop);
        if (!nxt.ended) {
          setThemeId(nxt.themeId);
          setIndex(nxt.index);
        }
      } else {
        const nxt = findNextConversation(themeId, levelId, index, listenLoop);
        if (!nxt.ended) {
          setThemeId(nxt.themeId);
          setLevelId(nxt.levelId);
          setIndex(nxt.index);
        }
      }
    } else {
      const newIdx = Math.max(0, index - 1);
      setIndex(newIdx);
    }
    setPhase('idle');
    nePlayCountRef.current = 0;
    jaHandledRef.current = false;
    neHandledRef.current = false;
  };

  const cycleSpeed = () => {
    const cur = SPEEDS.indexOf(listenSpeed);
    setListenSpeed(SPEEDS[(cur + 1) % SPEEDS.length]);
  };

  if (!ex) return null;

  // 初回タップ前: 大きな再生開始ボタンのみ表示
  if (!started) {
    return (
      <View style={styles.startContainer}>
        <Text style={styles.startHint}>
          {themeName} · {levelName}
        </Text>
        <Pressable
          style={({ pressed }) => [styles.startBtn, pressed && styles.startBtnPressed]}
          onPress={handleStart}
        >
          <Svg width={48} height={48} viewBox="0 0 24 24" fill="#fff">
            <Path d="M8 5.5v13c0 .8.9 1.3 1.6.9l10.5-6.5c.6-.4.6-1.3 0-1.7L9.6 4.6C8.9 4.2 8 4.7 8 5.5z" />
          </Svg>
          <Text style={styles.startBtnText}>タップして再生開始</Text>
        </Pressable>
        <Text style={styles.startNote}>
          自動再生ループが始まります
        </Text>
      </View>
    );
  }

  return (
    <ScrollView contentContainerStyle={styles.container}>
      <View style={styles.metaRow}>
        <Text style={styles.metaText}>
          {themeName} · {levelName} · 例題 <Text style={styles.metaCur}>{index + 1}</Text> / {examples.length}
        </Text>
      </View>

      <View style={[styles.card, activeLang === 'ja' && styles.cardJaActive]}>
        <Text style={[styles.tag, activeLang === 'ja' && styles.tagJaActive]}>JA · 日本語</Text>
        <Text style={styles.textJa}>{ex.jp}</Text>
      </View>
      <View style={[styles.card, activeLang === 'ne' && styles.cardNeActive]}>
        <Text style={[styles.tag, activeLang === 'ne' && styles.tagNeActive]}>NE · ネパール語</Text>
        <Text style={styles.textNe}>{ex.ne}</Text>
        {romaji && <Text style={styles.romaji}>{sentenceToRomaji(ex.ne)}</Text>}
      </View>

      <View style={styles.controls}>
        <Pressable style={({ pressed }) => [styles.ctrlBtn, pressed && styles.ctrlPressed]} onPress={() => go(-1)} hitSlop={8}>
          <PrevIcon />
        </Pressable>
        <Pressable style={({ pressed }) => [styles.ctrlBtn, styles.ctrlPlay, pressed && styles.ctrlPlayPressed]} onPress={togglePlay} hitSlop={8}>
          {playing ? <PauseIcon /> : <PlayIcon />}
        </Pressable>
        <Pressable style={({ pressed }) => [styles.ctrlBtn, pressed && styles.ctrlPressed]} onPress={() => go(1)} hitSlop={8}>
          <NextIcon />
        </Pressable>
      </View>

      <View style={styles.extras}>
        <Pressable
          style={[styles.pill, listenLoop && styles.pillOn]}
          onPress={() => setListenLoop(!listenLoop)}
        >
          <Svg width={13} height={13} viewBox="0 0 24 24" fill="none" stroke={listenLoop ? '#fff' : colors.inkMute} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
            <Polyline points="17 1 21 5 17 9" />
            <Path d="M3 11V9a4 4 0 0 1 4-4h14" />
            <Polyline points="7 23 3 19 7 15" />
            <Path d="M21 13v2a4 4 0 0 1-4 4H3" />
          </Svg>
          <Text style={[styles.pillText, listenLoop && styles.pillTextOn]}>ノンストップ</Text>
        </Pressable>
        <Pressable style={styles.pill} onPress={cycleSpeed}>
          <Svg width={13} height={13} viewBox="0 0 24 24" fill="none" stroke={colors.inkMute} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
            <Circle cx={12} cy={12} r={10} />
            <Polyline points="12 6 12 12 16 14" />
          </Svg>
          <Text style={styles.pillText}>速度 ×{listenSpeed.toFixed(1)}</Text>
        </Pressable>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  // 初回再生開始画面
  startContainer: {
    flex: 1,
    backgroundColor: colors.bg,
    alignItems: 'center',
    justifyContent: 'center',
    padding: spacing.xl,
    gap: spacing.lg,
  },
  startHint: {
    fontFamily: 'Courier',
    fontSize: 13,
    color: colors.inkMute,
    letterSpacing: 1.5,
  },
  startBtn: {
    backgroundColor: colors.ink,
    borderRadius: 100,
    width: 140,
    height: 140,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    shadowColor: colors.ink,
    shadowOpacity: 0.3,
    shadowRadius: 20,
    shadowOffset: { width: 0, height: 8 },
    elevation: 8,
  },
  startBtnPressed: { backgroundColor: colors.inkSoft, transform: [{ scale: 0.96 }] },
  startBtnText: { fontSize: 11, fontWeight: '600', color: '#fff', letterSpacing: 0.5, position: 'absolute', bottom: -28, width: 200, textAlign: 'center' },
  startNote: { fontSize: 13, color: colors.inkQuiet, marginTop: spacing.xl },

  container: { padding: spacing.lg, paddingBottom: spacing.xxl },
  metaRow: { paddingBottom: spacing.md, borderBottomWidth: 1, borderBottomColor: colors.line, marginBottom: spacing.xl },
  metaText: { fontFamily: 'Courier', fontSize: 12, color: colors.inkMute },
  metaCur: { color: colors.ink, fontWeight: '700' },
  card: { backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.line, borderRadius: radius.lg, padding: spacing.lg, marginBottom: spacing.md },
  cardJaActive: { borderColor: colors.accentJa, shadowColor: colors.accentJa, shadowOpacity: 0.15, shadowRadius: 12, elevation: 4 },
  cardNeActive: { borderColor: colors.accentNe, shadowColor: colors.accentNe, shadowOpacity: 0.15, shadowRadius: 12, elevation: 4 },
  tag: { fontFamily: 'Courier', fontSize: 11, color: colors.inkQuiet, letterSpacing: 1.5, marginBottom: spacing.sm },
  tagJaActive: { color: colors.accentJa, fontWeight: '700' },
  tagNeActive: { color: colors.accentNe, fontWeight: '700' },
  textJa: { fontSize: 20, lineHeight: 30, color: colors.ink },
  textNe: { fontSize: 26, lineHeight: 38, color: colors.ink, fontWeight: '600' },
  romaji: { fontFamily: 'Courier', fontSize: 14, color: colors.inkQuiet, fontStyle: 'italic', marginTop: 6, lineHeight: 22 },
  controls: { flexDirection: 'row', justifyContent: 'center', alignItems: 'center', gap: spacing.md, marginTop: spacing.xl },
  ctrlBtn: { width: 56, height: 56, borderRadius: 28, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.line, alignItems: 'center', justifyContent: 'center' },
  ctrlPressed: { backgroundColor: colors.bgSoft, borderColor: colors.ink },
  ctrlPlay: { width: 78, height: 78, borderRadius: 39, backgroundColor: colors.ink, borderColor: colors.ink },
  ctrlPlayPressed: { backgroundColor: colors.inkSoft },
  extras: { flexDirection: 'row', justifyContent: 'center', gap: spacing.sm, marginTop: spacing.lg, flexWrap: 'wrap' },
  pill: { flexDirection: 'row', alignItems: 'center', gap: 5, paddingHorizontal: spacing.md, paddingVertical: 8, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.line, borderRadius: 99 },
  pillOn: { backgroundColor: colors.ink, borderColor: colors.ink },
  pillText: { fontSize: 12, color: colors.inkMute, fontWeight: '500' },
  pillTextOn: { color: '#fff' },
});
