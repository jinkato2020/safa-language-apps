// 共有ホーム(モチベ・ダッシュボード)。継続/成長/バッジを共有デザイン部品で構成。
// 3アプリ共通。データは useDailyProgress(学習した日ベースの最小実装)。
// 文言は i18n(home.*)。各アプリの i18n JSON にキーを持つ。テーマは DesignThemeProvider 配下。
import { useEffect } from 'react';
import { ScrollView, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useI18n } from '../i18n';
import {
  useTokens, Card, StatRow, StreakWeek, StreakCalendar, GrowthBars, BadgeGrid, type BadgeItem,
} from '../design';
import { useDailyProgress, lastNDays } from '../design/useDailyProgress';

const WEEKDAY = ['home.wd_sun', 'home.wd_mon', 'home.wd_tue', 'home.wd_wed', 'home.wd_thu', 'home.wd_fri', 'home.wd_sat'];

export default function HomeScreen({ storageKey }: { storageKey: string }) {
  const { t } = useI18n();
  const { colors, spacing, fontSize } = useTokens();
  const p = useDailyProgress(storageKey);

  // ホームを開いた日=学習した日として記録(最小実装。後でApp側が実学習イベントで markStudied(n) を追加可)。
  useEffect(() => { if (p.ready) p.markStudied(0); }, [p.ready]); // eslint-disable-line react-hooks/exhaustive-deps

  const today = p.today;
  const week = lastNDays(today, 7).map((d) => ({
    key: d, label: t(WEEKDAY[new Date(`${d}T00:00:00Z`).getUTCDay()]), on: p.studied.has(d), today: d === today,
  }));
  const cal = lastNDays(today, 35).map((d) => ({ key: d, on: p.studied.has(d), today: d === today }));
  const growth = lastNDays(today, 14).map((d) => p.perDay[d] ?? 0);
  const badges: BadgeItem[] = [
    { id: 'first', emoji: '🌱', label: t('home.badge_first'), hint: t('home.badge_first_hint'), unlocked: p.totalDays >= 1 },
    { id: 'd3', emoji: '🔥', label: t('home.badge_3'), hint: t('home.badge_3_hint'), unlocked: p.longest >= 3 },
    { id: 'd7', emoji: '🔥', label: t('home.badge_7'), hint: t('home.badge_7_hint'), unlocked: p.longest >= 7 },
    { id: 'd30', emoji: '🏆', label: t('home.badge_30'), hint: t('home.badge_30_hint'), unlocked: p.longest >= 30 },
  ];

  const sectionStyle = { fontSize: fontSize.small, fontWeight: '800' as const, color: colors.ink2, marginTop: spacing.xs };

  return (
    <SafeAreaView edges={['top']} style={{ flex: 1, backgroundColor: colors.bg }}>
      <ScrollView contentContainerStyle={{ padding: spacing.lg, gap: spacing.md }}>
        <Text style={{ fontSize: fontSize.h1, fontWeight: '800', color: colors.ink }}>{t('home.title')}</Text>

        <Card>
          <StatRow
            stats={[
              { value: `🔥 ${p.streak}`, label: t('home.streak_days') },
              { value: `${p.totalDays}`, label: t('home.total_days') },
              { value: `${p.longest}`, label: t('home.longest') },
            ]}
          />
        </Card>

        <Text style={sectionStyle}>{t('home.section_streak')}</Text>
        <Card>
          <StreakWeek days={week} />
          <Text style={{ fontSize: fontSize.tiny, color: colors.faint, marginTop: spacing.md, marginBottom: spacing.xs }}>{t('home.cal_caption')}</Text>
          <StreakCalendar days={cal} />
        </Card>

        <Text style={sectionStyle}>{t('home.section_growth')}</Text>
        <Card>
          <Text style={{ fontSize: fontSize.tiny, fontWeight: '700', color: colors.mute, marginBottom: spacing.xs }}>{t('home.growth_title')}</Text>
          <GrowthBars values={growth} />
        </Card>

        <Text style={sectionStyle}>{t('home.section_badges')}</Text>
        <BadgeGrid badges={badges} achievedLabel={t('home.badge_achieved')} />

        <View style={{ height: spacing.xl }} />
      </ScrollView>
    </SafeAreaView>
  );
}
