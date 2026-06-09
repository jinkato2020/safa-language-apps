// 単語モードの分岐: シャッフルカード / ポスター音声学習。
import React from 'react';
import { View, Text, Pressable, StyleSheet } from 'react-native';
import { colors, spacing, radius } from '../theme';
import { useI18n } from '../i18n';
import { usePosterLessons } from '../PosterContext';

export default function VocabModeScreen({ navigation }: any) {
  const { t } = useI18n();
  const lessons = usePosterLessons();
  return (
    <View style={styles.container}>
      <Pressable onPress={() => navigation.navigate('VocabCategory')}
        style={({ pressed }) => [styles.card, pressed && styles.pressed]}>
        <Text style={styles.icon}>🔀</Text>
        <Text style={styles.title}>{t('vocab.modeFlashcard') || 'シャッフルカード'}</Text>
        <Text style={styles.sub}>{t('vocab.modeFlashcardDesc') || 'カードをめくって単語を覚える'}</Text>
      </Pressable>
      {lessons.length > 0 && (
        <Pressable onPress={() => navigation.navigate('PosterTheme')}
          style={({ pressed }) => [styles.card, pressed && styles.pressed]}>
          <Text style={styles.icon}>🔊</Text>
          <Text style={styles.title}>{t('vocab.modePoster') || '音声朗読'}</Text>
          <Text style={styles.sub}>{t('vocab.modePosterDesc') || 'ポスターを見ながら音声を聞く'}</Text>
        </Pressable>
      )}
    </View>
  );
}
const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg, padding: spacing.xl, gap: spacing.lg, justifyContent: 'center' },
  card: { backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.line, borderRadius: radius.lg, padding: spacing.xxl, alignItems: 'center', gap: spacing.sm },
  pressed: { backgroundColor: colors.bgSoft },
  icon: { fontSize: 40 },
  title: { fontSize: 20, fontWeight: '700', color: colors.ink },
  sub: { fontSize: 13, color: colors.inkFaint, textAlign: 'center' },
});
