import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useNavigation, useRoute, type RouteProp } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { colors, spacing, radius } from '../theme';
import type { RootStackParamList } from '../types';
import { WORD_CATEGORIES } from '../dataLoader';

type Nav = NativeStackNavigationProp<RootStackParamList, 'VocabDirection'>;
type R = RouteProp<RootStackParamList, 'VocabDirection'>;

export default function VocabDirectionScreen() {
  const navigation = useNavigation<Nav>();
  const { categoryId } = useRoute<R>().params;
  const cat = WORD_CATEGORIES.find(c => c.id === categoryId);

  return (
    <ScrollView contentContainerStyle={styles.container}>
      <View style={styles.head}>
        <Text style={styles.title}>出題方向を選択</Text>
        <Text style={styles.desc}>{cat?.name} のカードをどちら向きで学習しますか？</Text>
      </View>
      <View style={styles.grid}>
        <Pressable
          style={({ pressed }) => [styles.card, pressed && styles.cardPressed]}
          onPress={() => navigation.navigate('Flashcard', { categoryId, direction: 'ne2ja' })}
        >
          <View style={styles.row}>
            <Text style={styles.lang}>🇳🇵 ネパール語</Text>
            <Text style={styles.arrow}>→</Text>
            <Text style={styles.lang}>🇯🇵 日本語</Text>
          </View>
          <Text style={styles.cardDesc}>ネパール語が表示され、タップで日本語訳を確認。読解力を鍛えます。</Text>
        </Pressable>
        <Pressable
          style={({ pressed }) => [styles.card, pressed && styles.cardPressed]}
          onPress={() => navigation.navigate('Flashcard', { categoryId, direction: 'ja2ne' })}
        >
          <View style={styles.row}>
            <Text style={styles.lang}>🇯🇵 日本語</Text>
            <Text style={styles.arrow}>→</Text>
            <Text style={styles.lang}>🇳🇵 ネパール語</Text>
          </View>
          <Text style={styles.cardDesc}>日本語が表示され、タップでネパール語を確認。瞬発力を鍛えます。</Text>
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
