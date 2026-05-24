import { useEffect, useRef, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useNavigation, useRoute, type RouteProp } from '@react-navigation/native';
import { useAudioPlayer, useAudioPlayerStatus } from 'expo-audio';
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

function findNextConversation(themeId: number, levelId: number, index: number, loop: boolean) {
  let t = themeId, l = levelId, i = index + 1;
  const exs = getExamples(t, l);
  if (i < exs.length) return { themeId: t, levelId: l, index: i, ended: false };
  i = 0;
  t = t + 1;
  while (t <= THEMES.length) {
    if (isCombinationFree('listening', t, l) && getExamples(t, l).length > 0) {
      return { themeId: t, levelId: l, index: i, ended: false };
    }
    t++;
  }
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
  if (loop) {
    return { themeId: THEMES.find(th => th.free)?.id ?? 1, levelId: 1, index: 0, ended: false };
  }
  return { themeId, levelId, index, ended: true };
}

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

  const [themeId, setThemeId] = useState(initial.themeId);
  const [levelId, setLevelId] = useState<number>(initial.levelId ?? 1);
  const [index, setIndex] = useState(initial.startIndex ?? 0);
  const [phase, setPhase] = useState<'idle' | 'first' | 'second'>('idle');
  // 自動再生: 単一プレイヤー方式なら iOS の自動再生制約を回避できる
  // useEffect が mount 後に発火して自動再生開始する
  const [started, setStarted] = useState(true);
  const [playing, setPlaying] = useState(true);
  const nePlayCountRef = useRef(0);
  const gapTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const examples = isGrammarSrc ? getGrammarExamples(themeId) : getExamples(themeId, levelId);
  const ex = examples[index];
  const audioKey = isGrammarSrc
    ? `${themeId}-${index + 1}`
    : `${themeId}-${levelId}-${index + 1}`;

  const jaSrc = isGrammarSrc ? japaneseGrammarAudio[audioKey] : japaneseAudio[audioKey];
  const neSrc = isGrammarSrc ? nepaliGrammarAudio[audioKey] : nepaliAudio[audioKey];

  // ★★★ 単一プレイヤー方式 ★★★
  // 「2つの AudioPlayer インスタンスで JA/NE 切替時に iOS 音声システムが詰まる」問題を回避するため、
  // 1つのプレイヤーで player.replace(newSrc) でソースを切り替える方式に変更。
  // 初期 source は mount 時に固定（useRef で1回だけ捕捉）して、player 自体を安定化させる。
  const initialSrcRef = useRef<number>(isJa2Ne ? jaSrc : neSrc);
  const player = useAudioPlayer(initialSrcRef.current, { keepAudioSessionActive: true });
  const status = useAudioPlayerStatus(player);
  // 現在 player に loaded されているソースを追跡
  const loadedSrcRef = useRef<number>(initialSrcRef.current);

  // Ref: stale closure 回避用
  const phaseRef = useRef<'idle' | 'first' | 'second'>('idle');
  const playingRef = useRef(true);
  const isJa2NeRef = useRef(isJa2Ne);
  const nepaliRepeatRef = useRef(nepaliRepeat);
  const listenSpeedRef = useRef(listenSpeed);
  const jaSrcRef = useRef(jaSrc);
  const neSrcRef = useRef(neSrc);
  phaseRef.current = phase;
  playingRef.current = playing;
  isJa2NeRef.current = isJa2Ne;
  nepaliRepeatRef.current = nepaliRepeat;
  listenSpeedRef.current = listenSpeed;
  jaSrcRef.current = jaSrc;
  neSrcRef.current = neSrc;

  // didJustFinish の二重処理を防ぐフラグ
  const finishHandledRef = useRef(false);
  // 最後に play() を呼んだ時刻（直後の遅延イベントを無視するガード）
  const lastPlayStartRef = useRef(0);

  // 単一プレイヤー: 指定ソースをロード（必要なら）→ 先頭から再生
  const playSrc = (src: number) => {
    try {
      if (loadedSrcRef.current !== src) {
        player.replace(src);
        loadedSrcRef.current = src;
      }
      player.seekTo(0);
      player.play();
      lastPlayStartRef.current = Date.now();
    } catch {}
  };

  const advanceRef = useRef<() => void>(() => {});

  const themeName = isGrammarSrc
    ? GRAMMAR_THEMES.find(t => t.id === themeId)?.name ?? ''
    : THEMES.find(t => t.id === themeId)?.name ?? '';
  const levelName = isGrammarSrc ? '文法' : LEVELS.find(l => l.id === levelId)?.name ?? '';

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
    finishHandledRef.current = false;
  };
  advanceRef.current = advance;

  // ── advance 後の自動継続: phase='idle' で playing=true なら新しい first を再生 ──
  useEffect(() => {
    if (!started || !playing || !ex) return;
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
  }, [started, playing, audioKey, isJa2Ne, phase]);

  // ── 再生終了時の処理を関数化（status useEffect と addListener で共有）──
  const handleAudioFinished = () => {
    if (!playingRef.current) return;
    if (finishHandledRef.current) return;
    // 再生開始から1秒以内の終了イベントは「前の音声の遅延イベント」とみなし無視
    // player.replace() の直後に古いソースの didJustFinish が発火することがあるため
    if (Date.now() - lastPlayStartRef.current < 1000) return;
    finishHandledRef.current = true;

    const p = phaseRef.current;
    const ja2ne = isJa2NeRef.current;
    const rep = nepaliRepeatRef.current;

    // パターン: 順序が重要
    // 1) phaseRef を新フェーズに先に更新 → 遅延イベントが旧フェーズで誤動作しない
    // 2) playSrc() → lastPlayStartRef が今に更新
    // 3) finishHandledRef = false → 1秒ガードが効くので安全に再開可能
    if (p === 'first') {
      if (ja2ne) {
        gapTimerRef.current = setTimeout(() => {
          phaseRef.current = 'second';
          setPhase('second');
          nePlayCountRef.current = 0;
          playSrc(neSrcRef.current);
          finishHandledRef.current = false;
        }, GAP_AFTER_FIRST);
      } else {
        nePlayCountRef.current++;
        if (nePlayCountRef.current < rep) {
          playSrc(neSrcRef.current);
          finishHandledRef.current = false;
        } else {
          gapTimerRef.current = setTimeout(() => {
            phaseRef.current = 'second';
            setPhase('second');
            playSrc(jaSrcRef.current);
            finishHandledRef.current = false;
          }, GAP_AFTER_SECOND);
        }
      }
    } else if (p === 'second') {
      if (!ja2ne) {
        gapTimerRef.current = setTimeout(() => {
          phaseRef.current = 'idle';
          finishHandledRef.current = false;
          advanceRef.current();
        }, GAP_AFTER_SECOND);
      } else {
        nePlayCountRef.current++;
        if (nePlayCountRef.current < rep) {
          playSrc(neSrcRef.current);
          finishHandledRef.current = false;
        } else {
          gapTimerRef.current = setTimeout(() => {
            phaseRef.current = 'idle';
            finishHandledRef.current = false;
            advanceRef.current();
          }, GAP_AFTER_SECOND);
        }
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

  // ── 検出方法2: addListener 経由（ネイティブイベント、React バッチングを回避） ──
  // status.didJustFinish が React 状態として届かない場合のバックアップ
  useEffect(() => {
    const sub = player.addListener('playbackStatusUpdate', (s: any) => {
      if (!s.didJustFinish) return;
      handleFinishRef.current();
    });
    return () => sub.remove();
  }, [player]);

  // ── 検出方法3: セーフティタイマー（duration + バッファ後に強制進行） ──
  // 上記2つでも検出できない場合の最終手段。再生開始から duration*1.5+2秒で強制 advance
  useEffect(() => {
    if (phase === 'idle' || !playing) return;
    if (status.duration <= 0) return;
    const ms = Math.ceil(status.duration / listenSpeedRef.current * 1000 * 1.5) + 2000;
    const safetyTimer = setTimeout(() => {
      if (!playingRef.current) return;
      // まだ同じ phase で止まっていれば、handleAudioFinished を強制実行
      handleFinishRef.current();
    }, ms);
    return () => clearTimeout(safetyTimer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [phase, playing, status.duration, audioKey]);

  const togglePlay = () => {
    if (playing) {
      try { player.pause(); } catch {}
      if (gapTimerRef.current) clearTimeout(gapTimerRef.current);
      setPlaying(false);
      playingRef.current = false;
    } else {
      setPhase('idle');
      setPlaying(true);
      playingRef.current = true;
    }
  };

  const go = (delta: number) => {
    try { player.pause(); } catch {}
    if (gapTimerRef.current) clearTimeout(gapTimerRef.current);
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
    finishHandledRef.current = false;
  };

  const cycleSpeed = () => {
    const cur = SPEEDS.indexOf(listenSpeed);
    setListenSpeed(SPEEDS[(cur + 1) % SPEEDS.length]);
  };

  if (!ex) return null;

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
  cardNeActive: { borderColor: colors.accentJa, shadowColor: colors.accentJa, shadowOpacity: 0.15, shadowRadius: 12, elevation: 4 },
  tag: { fontFamily: 'Courier', fontSize: 11, color: colors.inkQuiet, letterSpacing: 1.5, marginBottom: spacing.sm },
  tagJaActive: { color: colors.accentJa, fontWeight: '700' },
  tagNeActive: { color: colors.accentJa, fontWeight: '700' },
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
