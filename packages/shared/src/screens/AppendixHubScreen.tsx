// 付録タブのハブ(App B)。2セクション:
//  ① JLPT 読解・聴解 → ScaffoldScreen(area='jlpt')
//  ② ポスター朗読    → VocabCategoryScreen(posterOnly=true) → PosterAudioScreen
import { Pressable, StyleSheet, View } from 'react-native';
import { Text } from '../Text';
import { useNavigation } from '@react-navigation/native';
import { colors, spacing, radius } from '../theme';
import { useI18n } from '../i18n';

export default function AppendixHubScreen() {
  const nav = useNavigation<any>();
  const { t } = useI18n();
  return (
    <View style={styles.container}>
      <Pressable style={({ pressed }) => [styles.card, pressed && styles.cardPressed]} onPress={() => nav.navigate('JlptExercise')}>
        <Text style={styles.cardTitle}>{t('appendix.jlpt')}</Text>
        <Text style={styles.cardDesc}>{t('appendix.jlptDesc')}</Text>
      </Pressable>
      <Pressable style={({ pressed }) => [styles.card, pressed && styles.cardPressed]} onPress={() => nav.navigate('VocabCategory', { posterOnly: true })}>
        <Text style={styles.cardTitle}>{t('appendix.poster')}</Text>
        <Text style={styles.cardDesc}>{t('appendix.posterDesc')}</Text>
      </Pressable>
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
