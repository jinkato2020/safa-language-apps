import { useEffect, useMemo, useState } from 'react';
import { Animated, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { Text } from '../Text';
import { useRoute, type RouteProp } from '@react-navigation/native';
import Svg, { Path, Rect } from 'react-native-svg';
import { colors, spacing, radius } from '../theme';
import type { RootStackParamList } from '../types';
import { useSettings, useScaleStyle } from '../SettingsContext';
import { useI18n } from '../i18n';
import { useAppData } from '../AppDataContext';
import { getL1 } from '../l1';
import { useCardFlip } from '../useCardFlip';

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
  const { WORD_CATEGORIES, getWords, nativeLang } = useAppData();
  const l1 = getL1(nativeLang);
  const { t } = useI18n();
  const { categoryId: initialCategoryId, direction } = useRoute<R>().params;
  const { romaji, autoFlip, shuffle: shuffleOn, setShuffle } = useSettings();
  const ss = useScaleStyle();
  const { flip, animatedStyle } = useCardFlip();
  const [currentCategoryId, setCurrentCategoryId] = useState(initialCategoryId);
  const cat = WORD_CATEGORIES.find(c => c.id === currentCategoryId);
  const catName = t(`vocabCategories.${currentCategoryId}`);
  const allWords = useMemo(() => getWords(currentCategoryId), [currentCategoryId, nativeLang]);
  const [order, setOrder] = useState<number[]>(() => allWords.map((_, i) => i));
  const [cursor, setCursor] = useState(0);
  const [flipped, setFlipped] = useState(false);

  // カテゴリ変更・シャッフル設定変更で順序を再構築（シャッフルは設定値に一本化）
  useEffect(() => {
    const base = allWords.map((_, i) => i);
    setOrder(shuffleOn ? shuffle(base) : base);
    setCursor(0);
    setFlipped(false);
  }, [currentCategoryId, allWords, shuffleOn]);

  // autoFlip: カード変化時に自動で裏返す（フリップアニメ付き）
  useEffect(() => {
    if (autoFlip) {
      const timer = setTimeout(() => flip(() => setFlipped(true)), 1200);
      return () => clearTimeout(timer);
    }
  }, [cursor, autoFlip]);

  const word = allWords[order[cursor]];
  if (!word) return null;

  const frontIsNe = direction === 'ne2ja';
  const frontText = frontIsNe ? word.ne : word.ja;
  const backText = frontIsNe ? word.ja : word.ne;
  const frontTag = frontIsNe ? t('flashcard.tagNe') : t('flashcard.tagJa');
  const backTag = frontIsNe ? t('flashcard.tagJa') : t('flashcard.tagNe');

  // シャッフルのON/OFFは設定値を切り替える（順序の再構築は上の useEffect が担当）
  const toggleShuffle = () => setShuffle(!shuffleOn);

  const go = (delta: number) => {
    if (delta > 0) {
      if (cursor + 1 < order.length) {
        setCursor(cursor + 1);
        setFlipped(false);
      } else {
        // 次のカテゴリ
        for (let c = currentCategoryId + 1; c <= WORD_CATEGORIES.length; c++) {
          const w = getWords(c);
          if (w.length > 0) {
            setCurrentCategoryId(c);
            return;
          }
        }
      }
    } else {
      if (cursor > 0) {
        setCursor(cursor - 1);
        setFlipped(false);
      } else {
        // 前のカテゴリの最後の単語
        for (let c = currentCategoryId - 1; c >= 1; c--) {
          const w = getWords(c);
          if (w.length > 0) {
            setCurrentCategoryId(c);
            // useEffect で order がリセットされた後、最後の要素に移動するのは難しいので
            // とりあえず先頭から始める（ユーザー要望に応じて調整）
            return;
          }
        }
      }
    }
  };

  const atFirst = cursor === 0 && currentCategoryId === 1;
  const atLast = cursor >= order.length - 1 && currentCategoryId >= WORD_CATEGORIES.length;

  return (
    <ScrollView contentContainerStyle={styles.container}>
      <View style={styles.metaRow}>
        <Text style={styles.metaText}>
          <Text style={styles.metaCur}>{currentCategoryId}.</Text> {catName} · {direction === 'ne2ja' ? t('directions.neToJa') : t('directions.jaToNe')} · <Text style={styles.metaCur}>{cursor + 1}</Text> / {order.length}
        </Text>
      </View>

      <Pressable onPress={() => flip(() => setFlipped(f => !f))}>
        {({ pressed }) => (
          <Animated.View style={[styles.card, pressed && styles.cardPressed, animatedStyle]}>
            <Text style={styles.label}>{flipped ? backTag : frontTag}</Text>
            <Text style={[
              frontIsNe && !flipped ? styles.textNe : (frontIsNe && flipped ? styles.textJa : (!frontIsNe && flipped ? styles.textNe : styles.textJa)),
              (() => {
                const isNeShown = (frontIsNe && !flipped) || (!frontIsNe && flipped);
                return ss(isNeShown ? 40 : 32, isNeShown ? 56 : 44);
              })(),
            ]}>
              {flipped ? backText : frontText}
            </Text>
            {romaji && l1.romanizeWord && ((frontIsNe && !flipped) || (!frontIsNe && flipped)) && (
              <Text style={[styles.cardRom, ss(15)]}>{l1.romanizeWord(word.ne)}</Text>
            )}
            <Text style={styles.hint}>{t('flashcard.tapToFlip', { action: flipped ? t('flashcard.unflip') : t('flashcard.flip') })}</Text>
          </Animated.View>
        )}
      </Pressable>

      {/* 前へ / 次へ（位置固定、カテゴリ跨ぎ可能） */}
      <View style={styles.navRow}>
        <Pressable style={({ pressed }) => [styles.navBtn, atFirst && styles.navDisabled, pressed && styles.navPressed]} disabled={atFirst} onPress={() => go(-1)}>
          <Text style={[styles.navText, atFirst && styles.navTextDisabled]}>{t('common.prev')}</Text>
        </Pressable>
        <Pressable style={({ pressed }) => [styles.navBtn, atLast && styles.navDisabled, pressed && styles.navPressed]} disabled={atLast} onPress={() => go(1)}>
          <Text style={[styles.navText, atLast && styles.navTextDisabled]}>{t('common.next')}</Text>
        </Pressable>
      </View>

      {/* シャッフルボタンのみ（反転ボタンは削除） */}
      <Pressable style={({ pressed }) => [styles.pill, shuffleOn && styles.pillOn, pressed && styles.pillPressed]} onPress={toggleShuffle}>
        <View style={styles.pillInner}>
          <ShuffleIcon active={shuffleOn} />
          <Text style={[styles.pillText, shuffleOn && styles.pillTextOn]}>{shuffleOn ? t('flashcard.shuffleOn') : t('flashcard.shuffleOff')}</Text>
        </View>
      </Pressable>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { padding: spacing.lg, paddingBottom: spacing.xxl, maxWidth: 760, width: '100%', alignSelf: 'center' },
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
