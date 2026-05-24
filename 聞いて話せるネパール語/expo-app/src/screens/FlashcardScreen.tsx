import { useEffect, useMemo, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useRoute, type RouteProp } from '@react-navigation/native';
import Svg, { Path, Rect } from 'react-native-svg';
import { colors, spacing, radius } from '../theme';
import type { RootStackParamList } from '../types';
import { WORD_CATEGORIES, getWords } from '../dataLoader';
import { useSettings } from '../SettingsContext';
import { toRomaji } from '../transliterate';

type R = RouteProp<RootStackParamList, 'Flashcard'>;

function shuffle<T>(arr: T[]): T[] {
  const a = arr.slice();
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

// モノクロ SVG シャッフルアイコン
function ShuffleIcon({ active }: { active: boolean }) {
  const strokeColor = active ? '#fff' : colors.inkMute;
  return (
    <Svg width={16} height={16} viewBox="0 0 24 24" fill="none" stroke={strokeColor} strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round">
      <Rect x={0} y={0} width={0} height={0} />
      <Path d="M16 3h5v5" />
      <Path d="M4 20L21 3" />
      <Path d="M21 16v5h-5" />
      <Path d="M15 15l5.1 5.1" />
      <Path d="M4 4l5 5" />
    </Svg>
  );
}

export default function FlashcardScreen() {
  const { categoryId, direction } = useRoute<R>().params;
  const cat = WORD_CATEGORIES.find(c => c.id === categoryId);
  const allWords = useMemo(() => getWords(categoryId), [categoryId]);
  const { romaji, autoFlip } = useSettings();
  const [shuffled, setShuffled] = useState(false);
  const [order, setOrder] = useState<number[]>(() => allWords.map((_, i) => i));
  const [cursor, setCursor] = useState(0);
  const [flipped, setFlipped] = useState(false);

  // autoFlip: カード変化時に自動で裏返す
  useEffect(() => {
    if (autoFlip) {
      const timer = setTimeout(() => setFlipped(true), 1200);
      return () => clearTimeout(timer);
    }
  }, [cursor, autoFlip]);

  const word = allWords[order[cursor]];
  if (!word) return null;

  const frontIsNe = direction === 'ne2ja';
  const frontText = frontIsNe ? word.ne : word.ja;
  const backText = frontIsNe ? word.ja : word.ne;
  const frontTag = frontIsNe ? 'NE · ネパール語' : 'JA · 日本語';
  const backTag = frontIsNe ? 'JA · 日本語' : 'NE · ネパール語';

  const toggleShuffle = () => {
    if (shuffled) {
      setOrder(allWords.map((_, i) => i));
      setShuffled(false);
    } else {
      setOrder(shuffle(allWords.map((_, i) => i)));
      setShuffled(true);
    }
    setCursor(0);
    setFlipped(false);
  };

  const go = (delta: number) => {
    const next = cursor + delta;
    if (next < 0 || next >= order.length) return;
    setCursor(next);
    setFlipped(false);
  };

  return (
    <ScrollView contentContainerStyle={styles.container}>
      <View style={styles.metaRow}>
        <Text style={styles.metaText}>
          {cat?.name} · {direction === 'ne2ja' ? 'ネ→日' : '日→ネ'} · <Text style={styles.metaCur}>{cursor + 1}</Text> / {order.length}
        </Text>
      </View>

      <Pressable
        style={({ pressed }) => [styles.card, pressed && styles.cardPressed]}
        onPress={() => setFlipped(f => !f)}
      >
        <Text style={styles.label}>{flipped ? backTag : frontTag}</Text>
        <Text style={frontIsNe && !flipped ? styles.textNe : (frontIsNe && flipped ? styles.textJa : (!frontIsNe && flipped ? styles.textNe : styles.textJa))}>
          {flipped ? backText : frontText}
        </Text>
        {romaji && ((frontIsNe && !flipped) || (!frontIsNe && flipped)) && (
          <Text style={styles.cardRom}>{toRomaji(word.ne)}</Text>
        )}
        <Text style={styles.hint}>タップで{flipped ? '戻す' : '反転'}</Text>
      </Pressable>

      {/* 前へ / 番号 / 次へ（中央配置） */}
      <View style={styles.navRow}>
        <Pressable style={({ pressed }) => [styles.navBtn, cursor === 0 && styles.navDisabled, pressed && styles.navPressed]} disabled={cursor === 0} onPress={() => go(-1)}>
          <Text style={[styles.navText, cursor === 0 && styles.navTextDisabled]}>← 前へ</Text>
        </Pressable>
        <Text style={styles.position}>{cursor + 1} / {order.length}</Text>
        <Pressable style={({ pressed }) => [styles.navBtn, cursor >= order.length - 1 && styles.navDisabled, pressed && styles.navPressed]} disabled={cursor >= order.length - 1} onPress={() => go(1)}>
          <Text style={[styles.navText, cursor >= order.length - 1 && styles.navTextDisabled]}>次へ →</Text>
        </Pressable>
      </View>

      {/* シャッフルボタンのみ（反転ボタンは削除） */}
      <Pressable style={({ pressed }) => [styles.pill, shuffled && styles.pillOn, pressed && styles.pillPressed]} onPress={toggleShuffle}>
        <View style={styles.pillInner}>
          <ShuffleIcon active={shuffled} />
          <Text style={[styles.pillText, shuffled && styles.pillTextOn]}>シャッフル {shuffled ? 'ON' : 'OFF'}</Text>
        </View>
      </Pressable>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { padding: spacing.lg, paddingBottom: spacing.xxl },
  metaRow: { paddingBottom: spacing.md, borderBottomWidth: 1, borderBottomColor: colors.line, marginBottom: spacing.xl },
  metaText: { fontFamily: 'Courier', fontSize: 12, color: colors.inkMute },
  metaCur: { color: colors.ink, fontWeight: '700' },
  card: { backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.line, borderRadius: radius.lg, padding: spacing.xxl, alignItems: 'center', justifyContent: 'center', minHeight: 280, marginBottom: spacing.lg },
  cardPressed: { backgroundColor: colors.bgSoft },
  label: { fontFamily: 'Courier', fontSize: 11, color: colors.inkFaint, letterSpacing: 2, marginBottom: spacing.md },
  textNe: { fontSize: 40, fontWeight: '700', color: colors.ink, textAlign: 'center', lineHeight: 56 },
  textJa: { fontSize: 32, fontWeight: '700', color: colors.ink, textAlign: 'center', lineHeight: 44 },
  hint: { fontFamily: 'Courier', fontSize: 10, color: colors.inkFaint, letterSpacing: 1.5, marginTop: spacing.md },
  cardRom: { fontFamily: 'Courier', fontSize: 15, color: colors.inkQuiet, fontStyle: 'italic', marginTop: spacing.md, textAlign: 'center' },
  navRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: spacing.sm, marginBottom: spacing.lg },
  navBtn: { flex: 1, paddingHorizontal: spacing.md, paddingVertical: spacing.sm, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.line, borderRadius: radius.md, alignItems: 'center' },
  navPressed: { backgroundColor: colors.ink },
  navDisabled: { opacity: 0.35 },
  navText: { fontSize: 14, fontWeight: '500', color: colors.ink },
  navTextDisabled: { color: colors.inkFaint },
  position: { fontFamily: 'Courier', fontSize: 13, color: colors.inkMute, fontWeight: '700', minWidth: 56, textAlign: 'center' },
  pill: { alignSelf: 'center', paddingHorizontal: spacing.md, paddingVertical: spacing.xs, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.line, borderRadius: 99 },
  pillOn: { backgroundColor: colors.ink, borderColor: colors.ink },
  pillPressed: { backgroundColor: colors.bgSoft },
  pillInner: { flexDirection: 'row', alignItems: 'center', gap: spacing.xs },
  pillText: { fontSize: 12, color: colors.inkMute },
  pillTextOn: { color: '#fff' },
});
