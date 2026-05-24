import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useNavigation, useRoute, type RouteProp } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { colors, spacing, radius } from '../theme';
import type { RootStackParamList } from '../types';

type Nav = NativeStackNavigationProp<RootStackParamList, 'Paywall'>;
type R = RouteProp<RootStackParamList, 'Paywall'>;

export default function PaywallScreen() {
  const navigation = useNavigation<Nav>();
  const { feature } = useRoute<R>().params;

  return (
    <ScrollView contentContainerStyle={styles.container}>
      <View style={styles.head}>
        <Text style={styles.icon}>🔒</Text>
        <Text style={styles.title}>プレミアム機能</Text>
        <Text style={styles.desc}>
          「{feature}」を含む全コンテンツはプレミアム版で開放されます。
        </Text>
      </View>

      <View style={styles.card}>
        <Text style={styles.cardTitle}>プレミアムで使えるもの</Text>
        <Text style={styles.feature}>✓ 全30テーマ × 3レベル = 1,800例題</Text>
        <Text style={styles.feature}>✓ 文法 全30分野 × 20例題 = 600例題</Text>
        <Text style={styles.feature}>✓ 全例題の日本語・ネパール語音声</Text>
        <Text style={styles.feature}>✓ 全30分野 × 1,000単語のフラッシュカード</Text>
        <Text style={styles.feature}>✓ 聞き流しモード：全テーマ横断ノンストップ再生</Text>
        <Text style={styles.feature}>✓ 広告なし</Text>
      </View>

      <View style={styles.priceCard}>
        <Text style={styles.priceLabel}>月額プレミアム（予定）</Text>
        <Text style={styles.price}>¥500/月</Text>
        <Text style={styles.priceNote}>正式リリース後にApp内課金で提供予定</Text>
      </View>

      <Pressable style={({ pressed }) => [styles.closeBtn, pressed && styles.closeBtnPressed]} onPress={() => navigation.goBack()}>
        <Text style={styles.closeText}>戻る</Text>
      </Pressable>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { padding: spacing.lg, paddingBottom: spacing.xxl },
  head: { alignItems: 'center', marginBottom: spacing.xl, marginTop: spacing.md },
  icon: { fontSize: 48, marginBottom: spacing.md },
  title: { fontSize: 26, fontWeight: '700', color: colors.ink, marginBottom: spacing.sm },
  desc: { fontSize: 14, color: colors.inkMute, lineHeight: 22, textAlign: 'center', paddingHorizontal: spacing.md },
  card: { backgroundColor: colors.bgSoft, borderWidth: 1, borderColor: colors.line, borderRadius: radius.lg, padding: spacing.lg, marginBottom: spacing.md },
  cardTitle: { fontSize: 15, fontWeight: '700', color: colors.ink, marginBottom: spacing.md },
  feature: { fontSize: 14, color: colors.inkSoft, lineHeight: 24, marginBottom: spacing.xs },
  priceCard: { backgroundColor: colors.ink, borderRadius: radius.lg, padding: spacing.lg, alignItems: 'center', marginBottom: spacing.xl },
  priceLabel: { color: '#fff', fontSize: 12, opacity: 0.7, marginBottom: spacing.xs },
  price: { color: '#fff', fontSize: 32, fontWeight: '700', marginBottom: spacing.xs },
  priceNote: { color: '#fff', fontSize: 11, opacity: 0.6, textAlign: 'center' },
  closeBtn: { borderWidth: 1, borderColor: colors.line, borderRadius: radius.md, paddingVertical: spacing.md, alignItems: 'center' },
  closeBtnPressed: { backgroundColor: colors.bgSoft },
  closeText: { fontSize: 15, fontWeight: '500', color: colors.ink },
});
