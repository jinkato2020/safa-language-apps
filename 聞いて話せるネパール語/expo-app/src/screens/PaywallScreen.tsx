import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useNavigation, useRoute, type RouteProp } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { colors, spacing, radius } from '../theme';
import type { RootStackParamList } from '../types';
import { useI18n } from '../i18n';

type Nav = NativeStackNavigationProp<RootStackParamList, 'Paywall'>;
type R = RouteProp<RootStackParamList, 'Paywall'>;

export default function PaywallScreen() {
  const navigation = useNavigation<Nav>();
  const { t } = useI18n();
  const { feature } = useRoute<R>().params;

  return (
    <ScrollView contentContainerStyle={styles.container}>
      <View style={styles.head}>
        <Text style={styles.icon}>🔒</Text>
        <Text style={styles.title}>{t('paywall.title')}</Text>
        <Text style={styles.desc}>{t('paywall.desc', { feature })}</Text>
      </View>

      <View style={styles.card}>
        <Text style={styles.cardTitle}>{t('paywall.cardTitle')}</Text>
        <Text style={styles.feature}>{t('paywall.feature1')}</Text>
        <Text style={styles.feature}>{t('paywall.feature2')}</Text>
        <Text style={styles.feature}>{t('paywall.feature3')}</Text>
        <Text style={styles.feature}>{t('paywall.feature4')}</Text>
        <Text style={styles.feature}>{t('paywall.feature5')}</Text>
        <Text style={styles.feature}>{t('paywall.feature6')}</Text>
      </View>

      <View style={styles.priceCard}>
        <Text style={styles.priceLabel}>{t('paywall.priceLabel')}</Text>
        <Text style={styles.price}>¥500/月</Text>
        <Text style={styles.priceNote}>{t('paywall.priceNote')}</Text>
      </View>

      <Pressable style={({ pressed }) => [styles.closeBtn, pressed && styles.closeBtnPressed]} onPress={() => navigation.goBack()}>
        <Text style={styles.closeText}>{t('common.back')}</Text>
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
