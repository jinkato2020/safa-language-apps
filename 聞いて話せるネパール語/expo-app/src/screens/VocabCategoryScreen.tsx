import { FlatList, Pressable, StyleSheet, View } from 'react-native';
import { Text } from '../Text';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { colors, spacing, radius } from '../theme';
import type { RootStackParamList } from '../types';
import { WORD_CATEGORIES } from '../dataLoader';
import { useI18n } from '../i18n';

type Nav = NativeStackNavigationProp<RootStackParamList, 'VocabCategory'>;

export default function VocabCategoryScreen() {
  const navigation = useNavigation<Nav>();
  const { t } = useI18n();

  return (
    <FlatList
      contentContainerStyle={styles.container}
      ListHeaderComponent={
        <View style={styles.head}>
          <Text style={styles.desc}>{t('vocab.themeSelectDesc')}</Text>
        </View>
      }
      data={WORD_CATEGORIES}
      keyExtractor={(item) => String(item.id)}
      renderItem={({ item }) => {
        const catName = t(`vocabCategories.${item.id}`);
        return (
          <Pressable
            style={({ pressed }) => [styles.card, pressed && styles.cardPressed]}
            onPress={() => {
              navigation.navigate('Flashcard', { categoryId: item.id, direction: 'ne2ja' });
            }}
          >
            <Text style={styles.num}>{String(item.id).padStart(2, '0')}</Text>
            <Text style={styles.name}>{catName}</Text>
            <Text style={styles.count}>{t('common.wordsCount', { count: item.wordCount })}</Text>
          </Pressable>
        );
      }}
    />
  );
}

const styles = StyleSheet.create({
  container: { padding: spacing.lg, paddingBottom: spacing.xxl },
  head: { marginBottom: spacing.xl },
  title: { fontSize: 28, fontWeight: '700', color: colors.ink, marginBottom: spacing.xs, letterSpacing: -0.5 },
  desc: { fontSize: 14, color: colors.inkMute, lineHeight: 21 },
  card: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.line, borderRadius: radius.md, paddingVertical: spacing.md, paddingHorizontal: spacing.md, marginBottom: spacing.sm },
  cardPressed: { backgroundColor: colors.bgSoft, borderColor: colors.ink },
  num: { fontFamily: 'Courier', fontSize: 11, color: colors.inkFaint, width: 24 },
  name: { flex: 1, fontSize: 14, fontWeight: '500', color: colors.ink },
  count: { fontFamily: 'Courier', fontSize: 11, color: colors.inkFaint, paddingHorizontal: spacing.sm, paddingVertical: 3, borderWidth: 1, borderColor: colors.line, borderRadius: 99 },
});
