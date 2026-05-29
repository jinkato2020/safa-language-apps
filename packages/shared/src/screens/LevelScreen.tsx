import { Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { Text } from '../Text';
import { useNavigation, useRoute, type RouteProp } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { colors, spacing, radius } from '../theme';
import type { RootStackParamList } from '../types';
import { useSettings, useScaleStyle, type Direction, type NepaliRepeat } from '../SettingsContext';
import { useI18n } from '../i18n';
import { useAppData } from '../AppDataContext';

type Nav = NativeStackNavigationProp<RootStackParamList, 'Level'>;
type R = RouteProp<RootStackParamList, 'Level'>;

export default function LevelScreen() {
  const { LEVELS, getExamples } = useAppData();
  const navigation = useNavigation<Nav>();
  const { t } = useI18n();
  const { mode, themeId } = useRoute<R>().params;
  const themeName = t(`themes.${themeId}`);
  const isListening = mode === 'listening';

  const { listenDirection, setListenDirection, nepaliRepeat, setNepaliRepeat } = useSettings();
  const ss = useScaleStyle();

  const levelDesc = (id: number): string => t(`levels.desc${id}`);

  return (
    <ScrollView contentContainerStyle={styles.container}>
      <View style={styles.head}>
        <Text style={styles.title}>{t('levelScreen.title')}</Text>
        <Text style={[styles.desc, ss(14, 21)]}>{t('levelScreen.desc', { theme: themeName })}</Text>
      </View>

      {isListening && (
        <View style={styles.settings}>
          <View style={styles.settingRow}>
            <Text style={[styles.settingLabel, ss(13)]}>{t('levelScreen.playOrder')}</Text>
            <View style={styles.pills}>
              {(['ja2ne', 'ne2ja'] as Direction[]).map(d => (
                <Pressable
                  key={d}
                  style={[styles.pill, listenDirection === d && styles.pillOn]}
                  onPress={() => setListenDirection(d)}
                >
                  <Text style={[styles.pillText, listenDirection === d && styles.pillTextOn, ss(12)]}>
                    {t(`directions.${d}`)}
                  </Text>
                </Pressable>
              ))}
            </View>
          </View>
          <View style={styles.settingRow}>
            <Text style={[styles.settingLabel, ss(13)]}>{t('levelScreen.nepaliRepeat')}</Text>
            <View style={styles.pills}>
              {([1, 2, 3] as NepaliRepeat[]).map(n => (
                <Pressable
                  key={n}
                  style={[styles.pill, nepaliRepeat === n && styles.pillOn]}
                  onPress={() => setNepaliRepeat(n)}
                >
                  <Text style={[styles.pillText, nepaliRepeat === n && styles.pillTextOn, ss(12)]}>
                    {t('levelScreen.repeat', { n })}
                  </Text>
                </Pressable>
              ))}
            </View>
          </View>
        </View>
      )}

      <View style={styles.grid}>
        {LEVELS.map(lv => {
          const exs = getExamples(themeId, lv.id);
          const lvName = t(`levels.${lv.id}`);
          const onPress = () => {
            navigation.navigate(mode === 'conversation' ? 'Practice' : 'Listening', {
              themeId,
              levelId: lv.id,
              startIndex: 0,
            });
          };
          return (
            <Pressable
              key={lv.id}
              style={({ pressed }) => [styles.card, pressed && styles.cardPressed]}
              onPress={onPress}
            >
              <Text style={styles.levelKicker}>LEVEL {lv.id}</Text>
              <View style={styles.row}>
                <Text style={[styles.name, ss(24, 32)]}>{lvName}</Text>
              </View>
              <Text style={[styles.cardDesc, ss(13, 20)]}>{levelDesc(lv.id)}</Text>
              <Text style={styles.meta}>
                {t('common.questionsCount', { count: exs.length })}
              </Text>
            </Pressable>
          );
        })}
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { padding: spacing.lg, paddingBottom: spacing.xxl },
  head: { marginBottom: spacing.xl },
  title: { fontSize: 28, fontWeight: '700', color: colors.ink, marginBottom: spacing.xs, letterSpacing: -0.5 },
  desc: { fontSize: 14, color: colors.inkMute, lineHeight: 21 },
  settings: {
    backgroundColor: colors.bgSoft,
    borderWidth: 1,
    borderColor: colors.line,
    borderRadius: radius.md,
    padding: spacing.md,
    marginBottom: spacing.lg,
    gap: spacing.sm,
  },
  settingRow: { flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap', gap: spacing.sm },
  settingLabel: { fontSize: 13, fontWeight: '500', color: colors.inkMute, marginRight: spacing.xs },
  pills: { flexDirection: 'row', gap: spacing.xs },
  pill: {
    paddingHorizontal: spacing.md,
    paddingVertical: 6,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.line,
    borderRadius: 99,
  },
  pillOn: { backgroundColor: colors.ink, borderColor: colors.ink },
  pillText: { fontSize: 12, fontWeight: '500', color: colors.inkMute },
  pillTextOn: { color: '#fff' },
  grid: { gap: spacing.md },
  card: { backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.line, borderRadius: radius.lg, padding: spacing.lg },
  cardPressed: { backgroundColor: colors.bgSoft, borderColor: colors.ink },
  levelKicker: { fontFamily: 'Courier', fontSize: 11, color: colors.inkFaint, letterSpacing: 1.5, marginBottom: spacing.xs },
  row: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, marginBottom: spacing.xs },
  name: { fontSize: 24, fontWeight: '700', color: colors.ink, letterSpacing: -0.3 },
  cardDesc: { fontSize: 13, color: colors.inkMute, lineHeight: 20, marginBottom: spacing.sm },
  meta: { fontFamily: 'Courier', fontSize: 11, color: colors.inkQuiet, letterSpacing: 0.5 },
});
