// ポスター音声学習: ポスター画像を表示し、各カードをハイライトしながら
//  日本語→ネパール語 の順で音声を連続再生する。
import React, { useEffect, useRef, useState } from 'react';
import { View, Text, Image, ScrollView, Pressable, useWindowDimensions, StyleSheet } from 'react-native';
import { useAudioPlayer } from 'expo-audio';
import Svg, { Path, Rect } from 'react-native-svg';
import { colors, spacing, radius } from '../theme';
import { usePosterLessons } from '../PosterContext';

const GOLD = '#b08746';

export default function PosterAudioScreen({ route }: any) {
  const { lessonId } = route.params || {};
  const lessons = usePosterLessons();
  const lesson = lessons.find(l => l.id === lessonId) || lessons[0];
  const { width } = useWindowDimensions();

  const player = useAudioPlayer();
  const scrollRef = useRef<ScrollView>(null);
  const [idx, setIdx] = useState(-1);      // -1: 未再生 / 0..n-1: 再生中カード
  const [phase, setPhase] = useState<'ja' | 'ne'>('ne');  // ネパール語→日本語の順
  const [playing, setPlaying] = useState(false);

  // 最新値を listener/watchdog から参照するための ref
  const ref = useRef({ idx, phase, playing });
  ref.current = { idx, phase, playing };
  const genRef = useRef(0);                 // 再生世代(古いコールバックを無視)
  const wdRef = useRef<any>(null);          // ended取りこぼし保険のタイマー
  const advanceRef = useRef<(g: number) => void>(() => {});

  const PAD = spacing.lg;
  const dispW = width - PAD * 2;
  const scale = lesson ? dispW / lesson.posterW : 1;
  const dispH = lesson ? lesson.posterH * scale : 0;

  // 指定カード・フェーズの音声を再生(状態更新もここで一元化)
  const playCard = (i: number, ph: 'ja' | 'ne') => {
    if (!lesson) return;
    const card = lesson.cards[i];
    if (!card) return;
    genRef.current += 1;
    const my = genRef.current;
    setIdx(i); setPhase(ph);
    try { player.replace(ph === 'ja' ? card.ja : card.ne); player.seekTo(0); player.play(); } catch {}
    const y = card.box.y * scale;
    scrollRef.current?.scrollTo({ y: Math.max(0, y - dispW * 0.5), animated: true });
    // 保険: ended が来なくても約6秒で次へ(音声は通常1〜2秒)
    if (wdRef.current) clearTimeout(wdRef.current);
    wdRef.current = setTimeout(() => advanceRef.current(my), 6000);
  };

  // 次へ(ne→ja→次カードのne)。世代が古ければ無視(二重送り防止)
  advanceRef.current = (g: number) => {
    if (g !== genRef.current || !ref.current.playing || !lesson) return;
    const { idx: ci, phase: cp } = ref.current;
    if (cp === 'ne') { playCard(ci, 'ja'); }
    else {
      const ni = ci + 1;
      if (ni < lesson.cards.length) playCard(ni, 'ne');
      else { if (wdRef.current) clearTimeout(wdRef.current); setPlaying(false); setIdx(-1); }
    }
  };

  // 再生終了イベントで次へ
  useEffect(() => {
    const sub = player.addListener('playbackStatusUpdate', (st: any) => {
      if (st?.didJustFinish) advanceRef.current(genRef.current);
    });
    return () => sub.remove();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const start = (from = 0) => { setPlaying(true); playCard(from, 'ne'); };
  const stop = () => { setPlaying(false); player.pause(); if (wdRef.current) clearTimeout(wdRef.current); };
  const toggle = () => { if (playing) stop(); else start(idx >= 0 ? idx : 0); };

  if (!lesson) return <View style={styles.center}><Text>レッスンがありません</Text></View>;
  const hl = idx >= 0 ? lesson.cards[idx] : null;

  return (
    <View style={styles.container}>
      <ScrollView ref={scrollRef} contentContainerStyle={{ padding: PAD, paddingBottom: 240 }}>
        <View style={{ width: dispW, height: dispH }}>
          <Image source={lesson.image} style={{ width: dispW, height: dispH, borderRadius: radius.md }} resizeMode="contain" />
          {hl && (
            <View pointerEvents="none" style={[styles.hl, {
              left: hl.box.x * scale, top: hl.box.y * scale,
              width: hl.box.w * scale, height: hl.box.h * scale,
            }]} />
          )}
          {/* タップでそのカードから再生 */}
          {lesson.cards.map(c => (
            <Pressable key={c.i} onPress={() => start(c.i)}
              style={{ position: 'absolute', left: c.box.x * scale, top: c.box.y * scale, width: c.box.w * scale, height: c.box.h * scale }} />
          ))}
        </View>
      </ScrollView>

      {/* 下部ドック: 大きいカード + 操作 */}
      <View style={styles.dock}>
        {hl ? (
          <View style={styles.bigcard}>
            <Image source={hl.ill} style={styles.ill} resizeMode="cover" />
            <View style={styles.txt}>
              <Text style={styles.kana}>{hl.kana}</Text>
              <View style={{ flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap' }}>
                <Text style={styles.kanji}>{hl.word}</Text>
                <View style={[styles.lngtag, { backgroundColor: phase === 'ja' ? GOLD : '#2f5d54' }]}>
                  <Text style={styles.lngtagText}>{phase === 'ja' ? '日本語' : 'नेपाली'}</Text>
                </View>
              </View>
              <Text style={styles.rom}>{hl.romaji}</Text>
              <Text style={styles.np}>{hl.np}</Text>
            </View>
          </View>
        ) : (
          <View style={styles.bigcardEmpty}><Text style={styles.emptyText}>▶ 再生すると、ここに今のカードが大きく表示されます</Text></View>
        )}
        <View style={styles.bar}>
          <Pressable onPress={toggle} style={({ pressed }) => [styles.playBtn, pressed && styles.playPressed]}>
            {playing ? (
              <Svg width={22} height={22} viewBox="0 0 24 24">
                <Rect x={6} y={5} width={4} height={14} rx={1} fill="#fff" />
                <Rect x={14} y={5} width={4} height={14} rx={1} fill="#fff" />
              </Svg>
            ) : (
              <Svg width={22} height={22} viewBox="0 0 24 24"><Path d="M8 5v14l11-7z" fill="#fff" /></Svg>
            )}
          </Pressable>
          <Text style={styles.prog}>{idx >= 0 ? `${idx + 1} / ${lesson.cards.length}` : ''}</Text>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  hl: { position: 'absolute', borderWidth: 2, borderColor: GOLD, borderRadius: 16,
    backgroundColor: 'rgba(176,135,70,0.10)' },
  dock: { position: 'absolute', left: 0, right: 0, bottom: 0, backgroundColor: colors.surface,
    borderTopWidth: 1, borderTopColor: colors.line },
  bigcard: { flexDirection: 'row', alignItems: 'center', gap: spacing.lg, paddingHorizontal: spacing.lg, paddingVertical: spacing.md, minHeight: 140 },
  bigcardEmpty: { minHeight: 140, alignItems: 'center', justifyContent: 'center', paddingHorizontal: spacing.lg },
  emptyText: { color: colors.inkFaint, fontSize: 14, textAlign: 'center' },
  ill: { width: 104, height: 104, borderRadius: 52, borderWidth: 3, borderColor: '#fff', backgroundColor: '#f7f3ea' },
  txt: { flex: 1, minWidth: 0 },
  kana: { fontSize: 18, color: GOLD, lineHeight: 20 },
  kanji: { fontSize: 42, fontWeight: '700', color: '#28304a', lineHeight: 46 },
  lngtag: { borderRadius: 6, paddingHorizontal: 8, paddingVertical: 2, marginLeft: 8 },
  lngtagText: { color: '#fff', fontWeight: '700', fontSize: 12 },
  rom: { fontSize: 16, color: colors.inkFaint, fontStyle: 'italic', marginTop: 2 },
  np: { fontSize: 30, fontWeight: '700', color: '#2f5d54', marginTop: 4 },
  bar: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', paddingHorizontal: spacing.lg, paddingVertical: spacing.sm,
    borderTopWidth: 1, borderTopColor: '#f0eee9' },
  playBtn: { width: 52, height: 52, borderRadius: 26, backgroundColor: colors.ink, alignItems: 'center', justifyContent: 'center' },
  playPressed: { opacity: 0.7 },
  prog: { position: 'absolute', right: spacing.lg, fontSize: 13, color: colors.inkFaint },
});
