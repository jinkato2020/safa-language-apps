// 汎用「準備中」スキャフォルド。長文タブ・職業タブで使用(中身は新規コンテンツ生成後)。
// i18n キーを props で受け取る(例 area='chobun' → t('chobun.title') 等)。
import { ScrollView, StyleSheet, View } from 'react-native';
import { Text } from '../Text';
import { colors, spacing, radius } from '../theme';
import { useI18n } from '../i18n';

export default function ScaffoldScreen({ area }: { area: string }) {
  const { t } = useI18n();
  return (
    <ScrollView contentContainerStyle={styles.container}>
      <Text style={styles.title}>{t(`${area}.title`)}</Text>
      <Text style={styles.body}>{t(`${area}.body`)}</Text>
      <View style={styles.card}>
        <Text style={styles.soon}>{t(`${area}.comingSoon`)}</Text>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { padding: spacing.lg, paddingBottom: spacing.xxl, maxWidth: 760, width: '100%', alignSelf: 'center' },
  title: { fontSize: 22, fontWeight: '700', color: colors.ink, marginTop: spacing.lg, marginBottom: spacing.sm },
  body: { fontSize: 14, color: colors.inkMute, lineHeight: 21, marginBottom: spacing.lg },
  card: { backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.line, borderRadius: radius.md, padding: spacing.lg, alignItems: 'center' },
  soon: { fontSize: 13, fontWeight: '700', color: colors.accentJa, letterSpacing: 0.3 },
});
