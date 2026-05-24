import { FlatList, Pressable, StyleSheet, Text, View } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { colors, spacing, radius } from '../theme';
import type { RootStackParamList } from '../types';
import { WORD_CATEGORIES } from '../dataLoader';

type Nav = NativeStackNavigationProp<RootStackParamList, 'VocabCategory'>;

export default function VocabCategoryScreen() {
  const navigation = useNavigation<Nav>();

  return (
    <FlatList
      contentContainerStyle={styles.container}
      ListHeaderComponent={
        <View style={styles.head}>
          <Text style={styles.desc}>テーマを1つ選んで、ネパール語の語彙を増やしましょう。</Text>
        </View>
      }
      data={WORD_CATEGORIES}
      keyExtractor={(item) => String(item.id)}
      renderItem={({ item }) => (
        <Pressable
          style={({ pressed }) => [styles.card, !item.free && styles.cardLocked, pressed && styles.cardPressed]}
          onPress={() => {
            if (!item.free) {
              navigation.navigate('Paywall', { feature: item.name });
              return;
            }
            navigation.navigate('Flashcard', { categoryId: item.id, direction: 'ne2ja' });
          }}
        >
          <Text style={styles.num}>{String(item.id).padStart(2, '0')}</Text>
          <Text style={[styles.name, !item.free && styles.nameLocked]}>{item.name}</Text>
          {item.free ? (
            <Text style={styles.count}>{item.wordCount}語</Text>
          ) : (
            <Text style={styles.lock}>🔒</Text>
          )}
        </Pressable>
      )}
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
  cardLocked: { backgroundColor: colors.bgDisabled, opacity: 0.75 },
  num: { fontFamily: 'Courier', fontSize: 11, color: colors.inkFaint, width: 24 },
  name: { flex: 1, fontSize: 14, fontWeight: '500', color: colors.ink },
  nameLocked: { color: colors.inkFaint },
  count: { fontFamily: 'Courier', fontSize: 11, color: colors.inkFaint, paddingHorizontal: spacing.sm, paddingVertical: 3, borderWidth: 1, borderColor: colors.line, borderRadius: 99 },
  lock: { fontSize: 14 },
});
