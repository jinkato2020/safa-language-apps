// 作文(自己採点リコール)。母語(ex.ne)を読んで日本語を頭で作る → 「答えを見る」で
// 日本語(ex.jp)+ふりがな+音声を提示 → 「できた / もう一度」で自己採点(進捗記録)→ 次へ。
// 既存の会話データ(getExamples)・日本語音声・JP_READING を流用。回答方式A(将来Dあり)。
import { useLayoutEffect, useMemo, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { Text } from '../Text';
import { useNavigation, useRoute, type RouteProp } from '@react-navigation/native';
import { useAudioPlayer } from 'expo-audio';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { colors, spacing, radius } from '../theme';
import type { RootStackParamList } from '../types';
import { useScaleStyle } from '../SettingsContext';
import { useI18n } from '../i18n';
import { useAppData } from '../AppDataContext';
import { useSakubunProgress } from '../useSakubunProgress';

type Nav = NativeStackNavigationProp<RootStackParamList, 'Sakubun'>;
type R = RouteProp<RootStackParamList, 'Sakubun'>;

export default function SakubunScreen() {
  const { LEVELS, THEMES, getExamples, audio, JP_READING } = useAppData();
  const { japaneseAudio } = audio;
  const navigation = useNavigation<Nav>();
  const { t, lang } = useI18n();
  const isJaUI = lang === 'ja';
  const { themeId: initialThemeId, levelId: initialLevelId, startIndex } = useRoute<R>().params;
  const [themeId, setThemeId] = useState(initialThemeId);
  const [levelId, setLevelId] = useState<number>(initialLevelId ?? 1);
  const [index, setIndex] = useState(startIndex ?? 0);
  const [revealed, setRevealed] = useState(false);
  const ss = useScaleStyle();
  const { mark } = useSakubunProgress();

  const examples = useMemo(() => getExamples(themeId, levelId), [themeId, levelId]);
  const themeName = t(`themes.${themeId}`);
  const themeNo = (THEMES.findIndex((x) => x.id === themeId) + 1) || themeId;
  const levelName = t(`levels.${levelId}`);

  useLayoutEffect(() => {
    navigation.setOptions({ title: t('sakubun.title') });
  }, [navigation, t]);

  const ex = examples[index];
  const audioKey = `${themeId}-${levelId}-${index + 1}`;
  const player = useAudioPlayer(japaneseAudio[audioKey]);
  const jpReading = ex ? JP_READING?.[ex.jp] : undefined;

  const playOnce = () => { try { player.seekTo(0); player.play(); } catch {} };

  // 次へ(同レベルで次テーマ→次レベル先頭)。リコール採点後に前進。
  const advance = () => {
    setRevealed(false);
    if (index + 1 < examples.length) { setIndex(index + 1); return; }
    for (let tt = themeId + 1; tt <= THEMES.length; tt++) {
      if (getExamples(tt, levelId).length > 0) { setThemeId(tt); setIndex(0); return; }
    }
    if (levelId < LEVELS.length) {
      for (let tt = 1; tt <= THEMES.length; tt++) {
        if (getExamples(tt, levelId + 1).length > 0) { setThemeId(tt); setLevelId(levelId + 1); setIndex(0); return; }
      }
    }
    // 末尾: 先頭へ戻す(周回)
    setThemeId(THEMES[0]?.id ?? 1); setLevelId(1); setIndex(0);
  };

  const rate = (ok: boolean) => { mark(`${themeId}-${levelId}-${index + 1}`, ok); advance(); };

  const reveal = () => { setRevealed(true); playOnce(); };

  if (!ex) return null;

  return (
    <ScrollView style={styles.flex} contentContainerStyle={styles.container}>
      <View style={styles.metaRow}>
        <Text style={[styles.metaText, ss(12)]}>
          <Text style={styles.metaCur}>{themeNo}.</Text> {themeName} · {levelName} · <Text style={styles.metaCur}>{index + 1}</Text> / {examples.length}
        </Text>
      </View>

      {/* 出題=母語。頭で日本語を作る。 */}
      <View style={styles.card}>
        <Text style={[styles.cardHint, ss(10)]}>{t('sakubun.promptHint')}</Text>
        <Text style={[styles.neText, ss(28, 42)]}>{ex.ne}</Text>
      </View>

      {!revealed ? (
        <Pressable style={({ pressed }) => [styles.revealBtn, pressed && styles.revealBtnPressed]} onPress={reveal}>
          <Text style={[styles.revealBtnText, ss(15)]}>{t('sakubun.showAnswer')}</Text>
        </Pressable>
      ) : (
        <>
          {/* 答え=日本語+ふりがな+音声 */}
          <View style={[styles.card, styles.answerCard]}>
            <Text style={[styles.cardHint, ss(10)]}>{t('sakubun.answerHint')}</Text>
            <Text style={[styles.jaText, ss(26, 40)]}>{ex.jp}</Text>
            {!isJaUI && jpReading?.kana ? <Text style={[styles.jaKana, ss(15, 23)]}>{jpReading.kana}</Text> : null}
            <Pressable style={({ pressed }) => [styles.audioBtn, pressed && styles.revealBtnPressed]} onPress={playOnce}>
              <Text style={[styles.audioBtnText, ss(13)]}>🔊 {t('practice.playAudio')}</Text>
            </Pressable>
          </View>

          {/* 自己採点 */}
          <View style={styles.rateRow}>
            <Pressable style={({ pressed }) => [styles.rateBtn, styles.rateAgain, pressed && styles.rateBtnPressed]} onPress={() => rate(false)}>
              <Text style={[styles.rateText, ss(15)]}>{t('sakubun.again')}</Text>
            </Pressable>
            <Pressable style={({ pressed }) => [styles.rateBtn, styles.rateOk, pressed && styles.rateBtnPressed]} onPress={() => rate(true)}>
              <Text style={[styles.rateTextOk, ss(15)]}>{t('sakubun.gotIt')}</Text>
            </Pressable>
          </View>
        </>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  container: { padding: spacing.lg, paddingBottom: spacing.xxl, maxWidth: 760, width: '100%', alignSelf: 'center' },
  metaRow: { paddingBottom: spacing.md, borderBottomWidth: 1, borderBottomColor: colors.line, marginBottom: spacing.lg },
  metaText: { fontFamily: 'Courier', fontSize: 12, color: colors.inkMute },
  metaCur: { color: colors.ink, fontWeight: '700' },
  card: { backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.line, borderRadius: radius.lg, padding: spacing.lg, minHeight: 140, alignItems: 'center', justifyContent: 'center', marginBottom: spacing.lg },
  answerCard: { borderColor: colors.accentJa },
  cardHint: { fontFamily: 'Courier', fontSize: 10, color: colors.inkFaint, letterSpacing: 1.5, marginBottom: spacing.md },
  neText: { fontSize: 28, lineHeight: 42, color: colors.ink, textAlign: 'center', fontWeight: '600' },
  jaText: { fontSize: 26, lineHeight: 40, color: colors.ink, textAlign: 'center', fontWeight: '400' },
  jaKana: { fontSize: 15, lineHeight: 23, color: colors.inkMute, textAlign: 'center', marginTop: spacing.sm },
  revealBtn: { backgroundColor: colors.ink, borderRadius: radius.md, paddingVertical: spacing.md, alignItems: 'center', marginBottom: spacing.lg },
  revealBtnPressed: { opacity: 0.85 },
  revealBtnText: { fontSize: 15, fontWeight: '700', color: '#fff' },
  audioBtn: { marginTop: spacing.md, paddingVertical: 8, paddingHorizontal: spacing.md, borderWidth: 1, borderColor: colors.line, borderRadius: radius.sm },
  audioBtnText: { fontSize: 13, color: colors.inkMute, fontWeight: '500' },
  rateRow: { flexDirection: 'row', gap: spacing.md },
  rateBtn: { flex: 1, paddingVertical: spacing.md, borderRadius: radius.md, alignItems: 'center', borderWidth: 1 },
  rateBtnPressed: { opacity: 0.85 },
  rateAgain: { backgroundColor: colors.surface, borderColor: colors.line },
  rateOk: { backgroundColor: colors.accentJa, borderColor: colors.accentJa },
  rateText: { fontSize: 15, fontWeight: '600', color: colors.inkMute },
  rateTextOk: { fontSize: 15, fontWeight: '700', color: '#fff' },
});
