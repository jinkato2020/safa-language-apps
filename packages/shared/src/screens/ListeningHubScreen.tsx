// 聞き流しタブのハブ (App B 専用)。2つの導線:
//  ① 会話の聞き流し  → Theme(mode='listening') → Listening (連続再生)
//  ② 単語音声(ポスター) → VocabCategory(posterOnly) → PosterAudio
// App B は「単語」タブを廃し、ポスター単語音声を聞き流しタブに統合するためのハブ。
import { Pressable, StyleSheet, View } from 'react-native';
import { Text } from '../Text';
import { useNavigation } from '@react-navigation/native';
import { colors, spacing, radius } from '../theme';
import { useI18n } from '../i18n';
import { usePosterLessons } from '../PosterContext';

export default function ListeningHubScreen() {
  const nav = useNavigation<any>();
  const { t } = useI18n();
  const hasPoster = usePosterLessons().length > 0;
  return (
    <View style={styles.container}>
      <Pressable style={({ pressed }) => [styles.card, pressed && styles.cardPressed]} onPress={() => nav.navigate('Theme', { mode: 'listening' })}>
        <Text style={styles.cardTitle}>{t('listeningHub.nagashi')}</Text>
        <Text style={styles.cardDesc}>{t('listeningHub.nagashiDesc')}</Text>
      </Pressable>
      {hasPoster && (
        <Pressable style={({ pressed }) => [styles.card, pressed && styles.cardPressed]} onPress={() => nav.navigate('VocabCategory', { posterOnly: true })}>
          <Text style={styles.cardTitle}>{t('listeningHub.poster')}</Text>
          <Text style={styles.cardDesc}>{t('listeningHub.posterDesc')}</Text>
        </Pressable>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: spacing.lg, gap: spacing.md, maxWidth: 760, width: '100%', alignSelf: 'center' },
  card: { backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.line, borderRadius: radius.md, padding: spacing.lg, gap: 6 },
  cardPressed: { backgroundColor: colors.bgSoft, borderColor: colors.ink },
  cardTitle: { fontSize: 17, fontWeight: '700', color: colors.ink },
  cardDesc: { fontSize: 13, color: colors.inkMute, lineHeight: 20 },
});
