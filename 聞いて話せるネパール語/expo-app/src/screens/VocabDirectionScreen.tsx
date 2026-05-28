import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useNavigation, useRoute, type RouteProp } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { colors, spacing, radius } from '../theme';
import type { RootStackParamList } from '../types';
import { useI18n } from '../i18n';

type Nav = NativeStackNavigationProp<RootStackParamList, 'VocabDirection'>;
type R = RouteProp<RootStackParamList, 'VocabDirection'>;

export default function VocabDirectionScreen() {
  const navigation = useNavigation<Nav>();
  const { t } = useI18n();
  const { categoryId } = useRoute<R>().params;
  const catName = t(`vocabCategories.${categoryId}`);

  return (
    <ScrollView contentContainerStyle={styles.container}>
      <View style={styles.head}>
        <Text style={styles.title}>{t('vocab.directionTitle')}</Text>
        <Text style={styles.desc}>{t('vocab.directionDesc', { category: catName })}</Text>
      </View>
      <View style={styles.grid}>
        <Pressable
          style={({ pressed }) => [styles.card, pressed && styles.cardPressed]}
          onPress={() => navigation.navigate('Flashcard', { categoryId, direction: 'ne2ja' })}
        >
          <View style={styles.row}>
            <Text style={styles.lang}>{t('vocab.neLang')}</Text>
            <Text style={styles.arrow}>→</Text>
            <Text style={styles.lang}>{t('vocab.jaLang')}</Text>
          </View>
          <Text style={styles.cardDesc}>{t('vocab.neToJaDesc')}</Text>
        </Pressable>
        <Pressable
          style={({ pressed }) => [styles.card, pressed && styles.cardPressed]}
          onPress={() => navigation.navigate('Flashcard', { categoryId, direction: 'ja2ne' })}
        >
          <View style={styles.row}>
            <Text style={styles.lang}>{t('vocab.jaLang')}</Text>
            <Text style={styles.arrow}>→</Text>
            <Text style={styles.lang}>{t('vocab.neLang')}</Text>
          </View>
          <Text style={styles.cardDesc}>{t('vocab.jaToNeDesc')}</Text>
        </Pressable>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { padding: spacing.lg, paddingBottom: spacing.xxl },
  head: { marginBottom: spacing.xl },
  title: { fontSize: 28, fontWeight: '700', color: colors.ink, marginBottom: spacing.xs, letterSpacing: -0.5 },
  desc: { fontSize: 14, color: colors.inkMute, lineHeight: 21 },
  grid: { gap: spacing.md },
  card: { backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.line, borderRadius: radius.lg, padding: spacing.lg },
  cardPressed: { backgroundColor: colors.bgSoft, borderColor: colors.ink },
  row: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, marginBottom: spacing.md },
  lang: { fontSize: 18, fontWeight: '700', color: colors.ink },
  arrow: { fontSize: 18, color: colors.inkFaint },
  cardDesc: { fontSize: 13, color: colors.inkMute, lineHeight: 20 },
});
