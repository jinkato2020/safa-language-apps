// ポスター音声学習: ポスター画像を表示し、各カードをハイライトしながら
//  母語→日本語 の順で音声を連続再生する。
//  - 画像/音声は現在の母語(useI18n)で自動切替(imageL1 / card.l1)
//  - 下部ドックに「現在カードの拡大(ポスターを切り抜き拡大)」を表示
//  - 横スワイプで前/次のテーマへ移動
import React, { useEffect, useRef, useState } from 'react';
import { View, Text, Image, ScrollView, Pressable, useWindowDimensions, StyleSheet } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { useAudioPlayer } from 'expo-audio';
import Svg, { Path, Rect } from 'react-native-svg';
import { colors, spacing, radius } from '../theme';
import { usePosterLessons } from '../PosterContext';
import { useI18n } from '../i18n';
import { useHorizontalSwipe } from '../useHorizontalSwipe';

const GOLD = '#b08746';
const LANG_LABEL: Record<string, string> = { ja: '日本語', bn: 'বাংলা', en: 'English', ne: 'नेपाली', vi: 'Tiếng Việt', zh: '中文' };

export default function PosterAudioScreen({ route }: any) {
  const { lessonId } = route.params || {};
  const lessons = usePosterLessons();
  const navigation = useNavigation<any>();
  const { lang } = useI18n();
  const { width } = useWindowDimensions();

  const li = Math.max(0, lessons.findIndex(l => l.id === lessonId));
  const lesson = lessons[li] || lessons[0];

  // 母語別の画像/音声を現在の言語で解決(無ければ en→先頭にフォールバック)
  const pickByLang = (m?: Record<string, number>) => (m ? (m[lang] ?? m.en ?? Object.values(m)[0]) : undefined);
  const lessonImage = pickByLang(lesson?.imageL1) ?? lesson?.image;
  const l1AudioOf = (c: any) => pickByLang(c?.l1) ?? c?.ne;
  const l1Label = LANG_LABEL[lang] || lang;

  const player = useAudioPlayer();
  const scrollRef = useRef<ScrollView>(null);
  const [idx, setIdx] = useState(-1);      // -1: 未再生 / 0..n-1: 再生中カード
  const [phase, setPhase] = useState<'ja' | 'l1'>('l1');  // 母語→日本語の順
  const [playing, setPlaying] = useState(false);

  const ref = useRef({ idx, phase, playing });
  ref.current = { idx, phase, playing };
  const genRef = useRef(0);                 // 再生世代(古いコールバックを無視)
  const pendRef = useRef({ gen: 0, started: true });  // ロード完了待ち再生制御
  const wdRef = useRef<any>(null);          // 取りこぼし保険タイマー
  const advanceRef = useRef<(g: number) => void>(() => {});

  const PAD = spacing.lg;
  const dispW = width - PAD * 2;
  const scale = lesson ? dispW / lesson.posterW : 1;
  const dispH = lesson ? lesson.posterH * scale : 0;

  // テーマ移動でリセット
  useEffect(() => {
    setPlaying(false); setIdx(-1); setPhase('l1');
    if (wdRef.current) clearTimeout(wdRef.current);
    try { player.pause(); } catch {}
    scrollRef.current?.scrollTo({ y: 0, animated: false });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [lessonId]);

  // 指定カード・フェーズを再生。replace後「ロード完了で再生」+即時playの二段構えで
  // 「無音になる/カクつく」を回避。
  const playCard = (i: number, ph: 'ja' | 'l1') => {
    if (!lesson) return;
    const card = lesson.cards[i];
    if (!card) return;
    genRef.current += 1;
    const my = genRef.current;
    pendRef.current = { gen: my, started: false };
    setIdx(i); setPhase(ph);
    const src = ph === 'ja' ? card.ja : l1AudioOf(card);
    try { player.replace(src); player.play(); pendRef.current.started = true; } catch {}
    const y = card.box.y * scale;
    scrollRef.current?.scrollTo({ y: Math.max(0, y - dispH * 0.28), animated: true });
    if (wdRef.current) clearTimeout(wdRef.current);
    wdRef.current = setTimeout(() => advanceRef.current(my), 7000);
  };

  // 次へ(l1→ja→次カードのl1)。
  advanceRef.current = (g: number) => {
    if (g !== genRef.current || !ref.current.playing || !lesson) return;
    const { idx: ci, phase: cp } = ref.current;
    if (cp === 'l1') { playCard(ci, 'ja'); }
    else {
      const ni = ci + 1;
      if (ni < lesson.cards.length) playCard(ni, 'l1');
      else { if (wdRef.current) clearTimeout(wdRef.current); setPlaying(false); setIdx(-1); }
    }
  };

  useEffect(() => {
    const sub = player.addListener('playbackStatusUpdate', (st: any) => {
      // ロード完了したのにまだ鳴っていなければ再生(即時playが取りこぼされた場合の保険)
      if (st?.isLoaded && pendRef.current.gen === genRef.current && !pendRef.current.started) {
        pendRef.current.started = true;
        try { player.play(); } catch {}
      }
      if (st?.didJustFinish) advanceRef.current(genRef.current);
    });
    return () => sub.remove();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const start = (from = 0) => { setPlaying(true); playCard(from, 'l1'); };
  const stop = () => { setPlaying(false); player.pause(); if (wdRef.current) clearTimeout(wdRef.current); };
  const toggle = () => { if (playing) stop(); else start(idx >= 0 ? idx : 0); };

  // 横スワイプでテーマ移動(左=次 / 右=前)。端ではループ。
  const goTheme = (d: number) => {
    if (lessons.length < 2) return;
    const ni = (li + d + lessons.length) % lessons.length;
    navigation.setParams({ lessonId: lessons[ni].id });
  };
  const swipe = useHorizontalSwipe(() => goTheme(1), () => goTheme(-1));

  if (!lesson) return <View style={styles.center}><Text>レッスンがありません</Text></View>;
  const hl = idx >= 0 ? lesson.cards[idx] : null;

  // 現在カードの「拡大」: ポスター画像を切り抜いて拡大表示するための寸法計算
  const ZOOM_W = dispW;
  const zScale = hl ? ZOOM_W / hl.box.w : 1;          // セル幅を枠幅にフィット
  const zoomH = hl ? Math.round(hl.box.h * zScale) : 0;

  return (
    <View style={styles.container} {...swipe}>
      <ScrollView ref={scrollRef} contentContainerStyle={{ padding: PAD, paddingBottom: 220 }}>
        <View style={styles.themeRow}>
          <Text style={styles.themeTitle}>{lesson.title}</Text>
          <Text style={styles.themeNav}>{li + 1} / {lessons.length}　← →</Text>
        </View>
        <View style={{ width: dispW, height: dispH }}>
          <Image source={lessonImage} style={{ width: dispW, height: dispH, borderRadius: radius.md }} resizeMode="contain" />
          {hl && (
            <View pointerEvents="none" style={[styles.hl, {
              left: hl.box.x * scale, top: hl.box.y * scale,
              width: hl.box.w * scale, height: hl.box.h * scale,
            }]} />
          )}
          {lesson.cards.map(c => (
            <Pressable key={c.i} onPress={() => start(c.i)}
              style={{ position: 'absolute', left: c.box.x * scale, top: c.box.y * scale, width: c.box.w * scale, height: c.box.h * scale }} />
          ))}
        </View>
      </ScrollView>

      {/* 下部ドック: 拡大(切り抜き) + スマートな操作バー */}
      <View style={styles.dock}>
        {hl ? (
          <View style={[styles.zoomWrap, { width: ZOOM_W, height: zoomH }]}>
            <Image
              source={lessonImage}
              style={{ position: 'absolute', width: lesson.posterW * zScale, height: lesson.posterH * zScale,
                       left: -hl.box.x * zScale, top: -hl.box.y * zScale }}
              resizeMode="contain"
            />
            <View style={[styles.lngtag, styles.lngtagFloat, { backgroundColor: phase === 'ja' ? GOLD : '#2f5d54' }]}>
              <Text style={styles.lngtagText}>{phase === 'ja' ? '日本語' : l1Label}</Text>
            </View>
          </View>
        ) : (
          <View style={styles.zoomEmpty}><Text style={styles.emptyText}>カードをタップ、または ▶ で連続再生</Text></View>
        )}
        <View style={styles.bar}>
          <Pressable onPress={toggle} hitSlop={10} style={({ pressed }) => [styles.playBtn, pressed && styles.playPressed]}>
            {playing ? (
              <Svg width={20} height={20} viewBox="0 0 24 24">
                <Rect x={6} y={5} width={4} height={14} rx={1.5} fill="#fff" />
                <Rect x={14} y={5} width={4} height={14} rx={1.5} fill="#fff" />
              </Svg>
            ) : (
              <Svg width={20} height={20} viewBox="0 0 24 24"><Path d="M8 5v14l11-7z" fill="#fff" /></Svg>
            )}
          </Pressable>
          <View style={styles.progWrap}>
            <Text style={styles.prog}>{idx >= 0 ? `${idx + 1} / ${lesson.cards.length}` : `${lesson.cards.length} 語`}</Text>
          </View>
          <Text style={styles.swipeHint}>← スワイプでテーマ →</Text>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  themeRow: { flexDirection: 'row', alignItems: 'baseline', justifyContent: 'space-between', marginBottom: spacing.sm },
  themeTitle: { fontSize: 20, fontWeight: '700', color: colors.ink },
  themeNav: { fontSize: 12, color: colors.inkFaint, fontFamily: 'Courier' },
  hl: { position: 'absolute', borderWidth: 2, borderColor: GOLD, borderRadius: 16, backgroundColor: 'rgba(176,135,70,0.10)' },
  dock: { position: 'absolute', left: 0, right: 0, bottom: 0, backgroundColor: colors.surface, borderTopWidth: 1, borderTopColor: colors.line, paddingHorizontal: spacing.lg, paddingTop: spacing.sm, paddingBottom: spacing.md },
  zoomWrap: { overflow: 'hidden', borderRadius: radius.md, borderWidth: 1, borderColor: colors.line, backgroundColor: '#fff', alignSelf: 'center' },
  zoomEmpty: { height: 84, alignItems: 'center', justifyContent: 'center' },
  emptyText: { color: colors.inkFaint, fontSize: 13, textAlign: 'center' },
  lngtag: { borderRadius: 6, paddingHorizontal: 8, paddingVertical: 2 },
  lngtagFloat: { position: 'absolute', right: 8, top: 8 },
  lngtagText: { color: '#fff', fontWeight: '700', fontSize: 12 },
  bar: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, marginTop: spacing.sm },
  playBtn: { width: 44, height: 44, borderRadius: 22, backgroundColor: colors.ink, alignItems: 'center', justifyContent: 'center' },
  playPressed: { opacity: 0.7 },
  progWrap: { flex: 1 },
  prog: { fontSize: 14, fontWeight: '700', color: colors.ink },
  swipeHint: { fontSize: 11, color: colors.inkFaint, letterSpacing: 0.5 },
});
