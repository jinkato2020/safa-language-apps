// 短文タブのハブ(App B)。3モード:
//  ① 学習(母語→日本語+音声を見て覚える・自己採点リコール) → Theme(mode='sakubun') → Sakubun
//  ② ヒアリング(会話の聞き流し+単語音声ポスター) → ListeningHub
//  ③ 回答(マイクで日本語を話す→文字起こし→編集→提出→一致率) → Theme(mode='answer') → Answer
//     ※回答はネイティブ音声認識(増分2)。answerReady=false の間は「準備中」。
import { Pressable, StyleSheet, View } from 'react-native';
import { Text } from '../Text';
import { useNavigation } from '@react-navigation/native';
import { colors, spacing, radius } from '../theme';
import { useI18n } from '../i18n';

export default function ShortHubScreen({ answerReady }: { answerReady?: boolean }) {
  const nav = useNavigation<any>();
  const { t } = useI18n();
  return (
    <View style={styles.container}>
      <Pressable style={({ pressed }) => [styles.card, pressed && styles.cardPressed]} onPress={() => nav.navigate('Theme', { mode: 'sakubun' })}>
        <Text style={styles.cardTitle}>{t('shortHub.study')}</Text>
        <Text style={styles.cardDesc}>{t('shortHub.studyDesc')}</Text>
      </Pressable>
      <Pressable style={({ pressed }) => [styles.card, pressed && styles.cardPressed]} onPress={() => nav.navigate('ListeningHub')}>
        <Text style={styles.cardTitle}>{t('shortHub.hearing')}</Text>
        <Text style={styles.cardDesc}>{t('shortHub.hearingDesc')}</Text>
      </Pressable>
      <Pressable
        disabled={!answerReady}
        style={({ pressed }) => [styles.card, !answerReady && styles.cardDisabled, pressed && answerReady && styles.cardPressed]}
        onPress={() => answerReady && nav.navigate('Theme', { mode: 'answer' })}
      >
        <Text style={styles.cardTitle}>{t('shortHub.answer')}{answerReady ? '' : `  ·  ${t('shortHub.comingSoon')}`}</Text>
        <Text style={styles.cardDesc}>{t('shortHub.answerDesc')}</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: spacing.lg, gap: spacing.md, maxWidth: 760, width: '100%', alignSelf: 'center' },
  card: { backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.line, borderRadius: radius.md, padding: spacing.lg, gap: 6 },
  cardPressed: { backgroundColor: colors.bgSoft, borderColor: colors.ink },
  cardDisabled: { opacity: 0.5 },
  cardTitle: { fontSize: 17, fontWeight: '700', color: colors.ink },
  cardDesc: { fontSize: 13, color: colors.inkMute, lineHeight: 20 },
});
