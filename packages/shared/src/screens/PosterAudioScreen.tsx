// ポスター音声学習: ポスター画像を表示し、各カードをハイライトしながら
//  日本語→ネパール語 の順で音声を連続再生する。
import React, { useEffect, useRef, useState } from 'react';
import { View, Text, Image, ScrollView, Pressable, useWindowDimensions, StyleSheet } from 'react-native';
import { useAudioPlayer } from 'expo-audio';
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

  // 最新値を listener から参照するための ref
  const ref = useRef({ idx, phase, playing });
  ref.current = { idx, phase, playing };

  const PAD = spacing.lg;
  const dispW = width - PAD * 2;
  const scale = lesson ? dispW / lesson.posterW : 1;
  const dispH = lesson ? lesson.posterH * scale : 0;

  // 指定カード・フェーズの音声を再生
  const playCard = (i: number, ph: 'ja' | 'ne') => {
    if (!lesson) return;
    const card = lesson.cards[i];
    if (!card) return;
    player.replace(ph === 'ja' ? card.ja : card.ne);
    player.seekTo(0);
    player.play();
    // ハイライトを画面内へスクロール
    const y = card.box.y * scale;
    scrollRef.current?.scrollTo({ y: Math.max(0, y - dispW * 0.5), animated: true });
  };

  // 再生終了で次へ(ja→ne→次カードのja)
  useEffect(() => {
    const sub = player.addListener('playbackStatusUpdate', (st: any) => {
      if (!st?.didJustFinish || !lesson) return;
      const { idx: ci, phase: cp, playing: pl } = ref.current;
      if (!pl) return;
      if (cp === 'ne') { setPhase('ja'); playCard(ci, 'ja'); }  // ネパール語の次に日本語
      else {
        const ni = ci + 1;
        if (ni < lesson.cards.length) { setIdx(ni); setPhase('ne'); playCard(ni, 'ne'); }  // 次カードはネパール語から
        else { setPlaying(false); setIdx(-1); }   // 全終了
      }
    });
    return () => sub.remove();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [lesson, scale]);

  const start = (from = 0) => { setPlaying(true); setIdx(from); setPhase('ne'); playCard(from, 'ne'); };
  const stop = () => { setPlaying(false); player.pause(); };
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
            <Text style={styles.playText}>{playing ? '■ 停止' : (idx >= 0 ? '▶ 続きから' : '▶ 再生')}</Text>
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
  hl: { position: 'absolute', borderWidth: 4, borderColor: GOLD, borderRadius: 18,
    backgroundColor: 'rgba(176,135,70,0.12)' },
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
  bar: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, paddingHorizontal: spacing.lg, paddingVertical: spacing.sm,
    borderTopWidth: 1, borderTopColor: '#f0eee9' },
  playBtn: { paddingHorizontal: spacing.lg, paddingVertical: spacing.sm, backgroundColor: colors.ink, borderRadius: radius.md },
  playPressed: { opacity: 0.7 },
  playText: { color: '#fff', fontWeight: '700', fontSize: 15 },
  prog: { flex: 1, textAlign: 'right', fontSize: 13, color: colors.inkFaint },
});
