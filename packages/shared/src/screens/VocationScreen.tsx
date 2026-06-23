// 職業モード (App B 専用・新設)。特定技能の職種別フレーズ (介護先行)。
// コンテンツ(介護パック 約590項目)は未生成のため、まずは「準備中」スキャフォルド。
import { ScrollView, StyleSheet, View } from 'react-native';
import { Text } from '../Text';
import { colors, spacing, radius } from '../theme';
import { useI18n } from '../i18n';

export default function VocationScreen() {
  const { t } = useI18n();
  return (
    <ScrollView contentContainerStyle={styles.container}>
      <Text style={styles.title}>{t('vocation.title')}</Text>
      <Text style={styles.body}>{t('vocation.body')}</Text>
      <View style={styles.card}>
        <Text style={styles.cardTitle}>{t('vocation.kaigoTitle')}</Text>
        <Text style={styles.soon}>{t('vocation.comingSoon')}</Text>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { padding: spacing.lg, paddingBottom: spacing.xxl, maxWidth: 760, width: '100%', alignSelf: 'center' },
  title: { fontSize: 22, fontWeight: '700', color: colors.ink, marginTop: spacing.lg, marginBottom: spacing.sm },
  body: { fontSize: 14, color: colors.inkMute, lineHeight: 21, marginBottom: spacing.lg },
  card: { backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.line, borderRadius: radius.md, padding: spacing.lg, alignItems: 'center', gap: spacing.sm },
  cardTitle: { fontSize: 16, fontWeight: '600', color: colors.ink },
  soon: { fontSize: 13, fontWeight: '700', color: colors.accentJa, letterSpacing: 0.3 },
});
