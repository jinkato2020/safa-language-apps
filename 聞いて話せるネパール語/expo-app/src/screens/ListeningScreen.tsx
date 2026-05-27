// 聞き流しモード（結合音声方式）
//
// 旧実装は JA/NE を個別ファイルとして JS で切り替える方式だったが、
// Android のバックグラウンド再生で JS スレッドが停止する制約により例題遷移が止まる問題があった。
//
// 新実装: 各 (テーマ × レベル × 方向) を1つの長い MP3 に事前結合
//   conv-{theme}-{level}-{direction}.mp3
//   gram-{theme}-{direction}.mp3
// JS の介入なしでネイティブが連続再生 → 画面オフでも完全動作
//
// 例題ごとの開始時刻は data/listeningMetadata.json に保持
// ◀▶ は現在時刻をもとに「前/次の例題開始位置」へシーク

import { useEffect, useMemo, useRef, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useRoute, type RouteProp } from '@react-navigation/native';
import { useAudioPlayer, useAudioPlayerStatus } from 'expo-audio';
import Svg, { Circle, Path, Polygon, Polyline, Rect } from 'react-native-svg';
import { colors, spacing, radius } from '../theme';
import type { RootStackParamList } from '../types';
import {
  LEVELS, THEMES, GRAMMAR_THEMES,
  getExamples, getGrammarExamples,
  isCombinationFree, isGrammarThemeFree,
} from '../dataLoader';
import { listeningAudio } from '../../data/audioMap';
import listeningMetadata from '../../data/listeningMetadata.json';
import { useSettings, type ListenSpeed } from '../SettingsContext';
import { sentenceToRomaji } from '../transliterate';

type R = RouteProp<RootStackParamList, 'Listening'>;

const SPEEDS: ListenSpeed[] = [0.8, 1.0, 1.2, 1.5];
const BACK_DOUBLE_TAP_MS = 1200;

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

type MetaType = {
  conv: Record<string, number[]>;
  gram: Record<string, number[]>;
};
const META = listeningMetadata as MetaType;

// 次のテーマを探す（テーマ・レベル跨ぎ）
function findNextConversationTheme(themeId: number, levelId: number, loop: boolean) {
  for (let t = themeId + 1; t <= THEMES.length; t++) {
    if (isCombinationFree('listening', t, levelId) && getExamples(t, levelId).length > 0) {
      return { themeId: t, levelId, ended: false };
    }
  }
  if (levelId < LEVELS.length) {
    for (let t = 1; t <= THEMES.length; t++) {
      if (isCombinationFree('listening', t, levelId + 1) && getExamples(t, levelId + 1).length > 0) {
        return { themeId: t, levelId: levelId + 1, ended: false };
      }
    }
  }
  if (loop) {
    return { themeId: THEMES.find(th => th.free)?.id ?? 1, levelId: 1, ended: false };
  }
  return { themeId, levelId, ended: true };
}

function findNextGrammarTheme(themeId: number, loop: boolean) {
  for (let t = themeId + 1; t <= GRAMMAR_THEMES.length; t++) {
    if (isGrammarThemeFree(t) && getGrammarExamples(t).length > 0) {
      return { themeId: t, ended: false };
    }
  }
  if (loop) {
    return { themeId: GRAMMAR_THEMES.find(th => th.free)?.id ?? 1, ended: false };
  }
  return { themeId, ended: true };
}

function findPrevConversationTheme(themeId: number, levelId: number) {
  for (let t = themeId - 1; t >= 1; t--) {
    if (isCombinationFree('listening', t, levelId) && getExamples(t, levelId).length > 0) {
      return { themeId: t, levelId };
    }
  }
  for (let l = levelId - 1; l >= 1; l--) {
    for (let t = THEMES.length; t >= 1; t--) {
      if (isCombinationFree('listening', t, l) && getExamples(t, l).length > 0) {
        return { themeId: t, levelId: l };
      }
    }
  }
  return null;
}

function findPrevGrammarTheme(themeId: number) {
  for (let t = themeId - 1; t >= 1; t--) {
    if (isGrammarThemeFree(t) && getGrammarExamples(t).length > 0) {
      return { themeId: t };
    }
  }
  return null;
}

export default function ListeningScreen() {
  const route = useRoute<R>();
  const initial = route.params;
  const isGrammarSrc = initial.source === 'grammar';
  const {
    listenDirection,
    listenLoop, setListenLoop,
    listenSpeed, setListenSpeed,
    romaji,
  } = useSettings();
  const isJa2Ne = listenDirection === 'ja2ne';

  const [themeId, setThemeId] = useState(initial.themeId);
  const [levelId, setLevelId] = useState<number>(initial.levelId ?? 1);
  const [playing, setPlaying] = useState(true);
  const [currentExampleIdx, setCurrentExampleIdx] = useState(initial.startIndex ?? 0);

  // 結合音声のキーを構築
  const audioKey = isGrammarSrc
    ? `gram-${themeId}-${listenDirection}`
    : `conv-${themeId}-${levelId}-${listenDirection}`;

  // メタデータ（各例題の開始時刻）
  const examplePositions: number[] = useMemo(() => {
    const bucket = isGrammarSrc ? META.gram : META.conv;
    return bucket[audioKey] ?? [];
  }, [audioKey, isGrammarSrc]);

  const examples = isGrammarSrc ? getGrammarExamples(themeId) : getExamples(themeId, levelId);
  const audioSrc: number | undefined = (listeningAudio as Record<string, number>)[audioKey];

  // ★ 単一プレイヤー: 結合音声 1ファイルを再生 ★
  const initialSrcRef = useRef<number | undefined>(audioSrc);
  const player = useAudioPlayer(initialSrcRef.current ?? null, { keepAudioSessionActive: true });
  const status = useAudioPlayerStatus(player);
  const loadedKeyRef = useRef<string>(audioKey);

  // refs
  const listenSpeedRef = useRef(listenSpeed);
  const playingRef = useRef(true);
  const examplePositionsRef = useRef(examplePositions);
  listenSpeedRef.current = listenSpeed;
  playingRef.current = playing;
  examplePositionsRef.current = examplePositions;

  // 次テーマへ遷移
  const advanceTheme = () => {
    if (isGrammarSrc) {
      const nxt = findNextGrammarTheme(themeId, listenLoop);
      if (nxt.ended) {
        setPlaying(false);
        return;
      }
      setThemeId(nxt.themeId);
    } else {
      const nxt = findNextConversationTheme(themeId, levelId, listenLoop);
      if (nxt.ended) {
        setPlaying(false);
        return;
      }
      setThemeId(nxt.themeId);
      setLevelId(nxt.levelId);
    }
    setCurrentExampleIdx(0);
  };

  const advanceThemeRef = useRef(advanceTheme);
  advanceThemeRef.current = advanceTheme;

  // ロックスクリーン用メタデータ
  const themeName = isGrammarSrc
    ? GRAMMAR_THEMES.find(t => t.id === themeId)?.name ?? ''
    : THEMES.find(t => t.id === themeId)?.name ?? '';
  const levelName = isGrammarSrc ? '文法' : LEVELS.find(l => l.id === levelId)?.name ?? '';

  // 音声ソース切り替え（テーマ/レベル/方向変更時）
  useEffect(() => {
    if (!audioSrc) return;
    if (loadedKeyRef.current === audioKey) return;
    try {
      player.replace(audioSrc);
      loadedKeyRef.current = audioKey;
      player.seekTo(0);
      try { (player as any).playbackRate = listenSpeedRef.current; } catch {}
      try { (player as any).setPlaybackRate?.(listenSpeedRef.current); } catch {}
      if (playingRef.current) {
        player.play();
      }
    } catch {}
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [audioKey, audioSrc]);

  // 再生速度反映
  useEffect(() => {
    try { (player as any).playbackRate = listenSpeed; } catch {}
    try { (player as any).setPlaybackRate?.(listenSpeed); } catch {}
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [listenSpeed]);

  // 初回再生開始
  useEffect(() => {
    try {
      try { (player as any).playbackRate = listenSpeedRef.current; } catch {}
      try { (player as any).setPlaybackRate?.(listenSpeedRef.current); } catch {}
      player.play();
    } catch {}
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [player]);

  // ロックスクリーン制御（フォアグラウンドサービス起動）
  useEffect(() => {
    try {
      (player as any).setActiveForLockScreen?.(true, {
        title: `${themeName} · ${levelName}`,
        artist: '聞いて話せるネパール語',
        albumTitle: isJa2Ne ? '日本語 → ネパール語' : 'ネパール語 → 日本語',
      });
    } catch {}
    return () => {
      try { (player as any).setActiveForLockScreen?.(false); } catch {}
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [player]);

  // ロックスクリーン メタデータ更新
  useEffect(() => {
    try {
      (player as any).updateLockScreenMetadata?.({
        title: `${themeName} · ${levelName}`,
        artist: '聞いて話せるネパール語',
        albumTitle: isJa2Ne ? '日本語 → ネパール語' : 'ネパール語 → 日本語',
      });
    } catch {}
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [themeName, levelName, isJa2Ne]);

  // 現在の再生位置から「現在の例題インデックス」を計算
  useEffect(() => {
    const cur = status.currentTime ?? 0;
    let idx = 0;
    for (let i = 0; i < examplePositions.length; i++) {
      if (cur >= examplePositions[i]) idx = i;
      else break;
    }
    if (idx !== currentExampleIdx) setCurrentExampleIdx(idx);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [status.currentTime, examplePositions]);

  // 再生終了 → 次テーマへ
  useEffect(() => {
    if (!status.didJustFinish) return;
    advanceThemeRef.current();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [status.didJustFinish]);

  // 検出方法2: ネイティブイベント直接購読（バックグラウンド対応）
  useEffect(() => {
    const sub = (player as any).addListener?.(
      'playbackStatusUpdate',
      (s: any) => {
        if (s?.didJustFinish) {
          advanceThemeRef.current();
        }
      }
    );
    return () => {
      try { sub?.remove?.(); } catch {}
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [player]);

  const togglePlay = () => {
    if (playing) {
      try { player.pause(); } catch {}
      setPlaying(false);
      playingRef.current = false;
    } else {
      try { player.play(); } catch {}
      setPlaying(true);
      playingRef.current = true;
    }
  };

  // ◀ ボタン: 1回 = 現在の例題の先頭にシーク / 2回連続 = 前の例題へ
  const lastBackTapRef = useRef(0);
  const goPrev = () => {
    const now = Date.now();
    const isDouble = now - lastBackTapRef.current < BACK_DOUBLE_TAP_MS;
    lastBackTapRef.current = now;

    if (examplePositions.length === 0) return;

    if (isDouble) {
      // 前の例題へ
      const cur = currentExampleIdx;
      if (cur > 0) {
        try { player.seekTo(examplePositions[cur - 1]); } catch {}
        setCurrentExampleIdx(cur - 1);
      } else {
        // 前のテーマの最後の例題
        if (isGrammarSrc) {
          const prv = findPrevGrammarTheme(themeId);
          if (prv) setThemeId(prv.themeId);
        } else {
          const prv = findPrevConversationTheme(themeId, levelId);
          if (prv) {
            setThemeId(prv.themeId);
            setLevelId(prv.levelId);
          }
        }
      }
    } else {
      // 現在の例題の先頭へ
      try { player.seekTo(examplePositions[currentExampleIdx] ?? 0); } catch {}
    }
    if (!playingRef.current) {
      try { player.play(); } catch {}
      setPlaying(true);
      playingRef.current = true;
    }
  };

  // ▶ ボタン: 次の例題へ（最後ならテーマ移動）
  const goNext = () => {
    lastBackTapRef.current = 0;
    if (examplePositions.length === 0) return;
    const cur = currentExampleIdx;
    if (cur + 1 < examplePositions.length) {
      try { player.seekTo(examplePositions[cur + 1]); } catch {}
      setCurrentExampleIdx(cur + 1);
    } else {
      advanceTheme();
    }
    if (!playingRef.current) {
      try { player.play(); } catch {}
      setPlaying(true);
      playingRef.current = true;
    }
  };

  const cycleSpeed = () => {
    const cur = SPEEDS.indexOf(listenSpeed);
    setListenSpeed(SPEEDS[(cur + 1) % SPEEDS.length]);
  };

  const ex = examples[currentExampleIdx];
  const totalExamples = examples.length;

  if (!audioSrc) {
    return (
      <View style={styles.fallback}>
        <Text style={styles.fallbackText}>音声データを準備中です</Text>
        <Text style={styles.fallbackSub}>{audioKey} が見つかりません</Text>
      </View>
    );
  }
  if (!ex) return null;

  return (
    <ScrollView contentContainerStyle={styles.container}>
      <View style={styles.metaRow}>
        <Text style={styles.metaText}>
          <Text style={styles.metaCur}>{themeId}.</Text> {themeName} · {levelName} · 例題 <Text style={styles.metaCur}>{currentExampleIdx + 1}</Text> / {totalExamples}
        </Text>
      </View>

      <View style={styles.card}>
        <Text style={styles.tag}>JA · 日本語</Text>
        <Text style={styles.textJa}>{ex.jp}</Text>
      </View>
      <View style={styles.card}>
        <Text style={styles.tag}>NE · ネパール語</Text>
        <Text style={styles.textNe}>{ex.ne}</Text>
        {romaji && <Text style={styles.romaji}>{sentenceToRomaji(ex.ne)}</Text>}
      </View>

      <View style={styles.controls}>
        <Pressable style={({ pressed }) => [styles.ctrlBtn, pressed && styles.ctrlPressed]} onPress={goPrev} hitSlop={8}>
          <PrevIcon />
        </Pressable>
        <Pressable style={({ pressed }) => [styles.ctrlBtn, styles.ctrlPlay, pressed && styles.ctrlPlayPressed]} onPress={togglePlay} hitSlop={8}>
          {playing ? <PauseIcon /> : <PlayIcon />}
        </Pressable>
        <Pressable style={({ pressed }) => [styles.ctrlBtn, pressed && styles.ctrlPressed]} onPress={goNext} hitSlop={8}>
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
  container: { padding: spacing.lg, paddingBottom: spacing.xxl },
  metaRow: { paddingBottom: spacing.md, borderBottomWidth: 1, borderBottomColor: colors.line, marginBottom: spacing.xl },
  metaText: { fontFamily: 'Courier', fontSize: 12, color: colors.inkMute },
  metaCur: { color: colors.ink, fontWeight: '700' },
  card: { backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.line, borderRadius: radius.lg, padding: spacing.lg, marginBottom: spacing.md },
  tag: { fontFamily: 'Courier', fontSize: 11, color: colors.inkQuiet, letterSpacing: 1.5, marginBottom: spacing.sm },
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
  fallback: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: spacing.xl, gap: spacing.md },
  fallbackText: { fontSize: 16, color: colors.ink },
  fallbackSub: { fontSize: 12, color: colors.inkMute, fontFamily: 'Courier' },
});
