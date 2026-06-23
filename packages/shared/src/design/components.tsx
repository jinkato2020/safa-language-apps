// 共有「やる気/継続」UI部品(props駆動・純表示)。データ・文言は各アプリが渡す。
// 中身(到達度ゲージ等のアプリ固有部品)はここに置かない。
import { View, Text, type StyleProp, type ViewStyle } from 'react-native';
import type { ReactNode } from 'react';
import { useTokens } from './theme';

/** カード面(枠/角丸/余白)。 */
export function Card({ children, style }: { children: ReactNode; style?: StyleProp<ViewStyle> }) {
  const { colors, radius, spacing } = useTokens();
  return (
    <View
      style={[
        { backgroundColor: colors.surface, borderRadius: radius.lg, borderWidth: 1, borderColor: colors.line, padding: spacing.md },
        style,
      ]}
    >
      {children}
    </View>
  );
}

export interface Stat { value: string; label: string }
/** 数値統計の横並び(例: 連続 / 今日 / 累計)。区切り線つき。 */
export function StatRow({ stats, style }: { stats: Stat[]; style?: StyleProp<ViewStyle> }) {
  const { colors } = useTokens();
  return (
    <View style={[{ flexDirection: 'row', alignSelf: 'stretch' }, style]}>
      {stats.map((st, i) => (
        <View
          key={i}
          style={{ flex: 1, alignItems: 'center', gap: 3, borderLeftWidth: i > 0 ? 1 : 0, borderLeftColor: colors.line }}
        >
          <Text style={{ fontSize: 18, fontWeight: '800', color: colors.ink }}>{st.value}</Text>
          <Text style={{ fontSize: 11, color: colors.mute, letterSpacing: 0.5 }}>{st.label}</Text>
        </View>
      ))}
    </View>
  );
}

export interface WeekDay { key: string; label: string; on: boolean; today?: boolean }
/** 週の継続ドット(7日)。学習日に✓(streak色)、今日は枠強調。 */
export function StreakWeek({ days }: { days: WeekDay[] }) {
  const { colors, radius } = useTokens();
  return (
    <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
      {days.map((d) => (
        <View key={d.key} style={{ alignItems: 'center', gap: 4 }}>
          <View
            style={{
              width: 30, height: 30, borderRadius: radius.pill, alignItems: 'center', justifyContent: 'center',
              backgroundColor: d.on ? colors.streak : colors.bgSoft,
              borderWidth: d.today ? 2 : 1,
              borderColor: d.today ? colors.primary : d.on ? colors.streak : colors.line,
            }}
          >
            <Text style={{ fontSize: 13, fontWeight: '800', color: d.on ? colors.onPrimary : colors.faint }}>{d.on ? '✓' : ''}</Text>
          </View>
          <Text style={{ fontSize: 11, color: colors.faint }}>{d.label}</Text>
        </View>
      ))}
    </View>
  );
}

export interface CalDay { key: string; on: boolean; today?: boolean }
/** カレンダー(直近N日の格子)。学習日を streak色で塗る。 */
export function StreakCalendar({ days }: { days: CalDay[] }) {
  const { colors } = useTokens();
  return (
    <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 4 }}>
      {days.map((d) => (
        <View
          key={d.key}
          style={{
            width: 14, height: 14, borderRadius: 3,
            backgroundColor: d.on ? colors.streak : colors.bgSoft,
            borderWidth: d.today ? 1.5 : 0, borderColor: colors.primary,
          }}
        />
      ))}
    </View>
  );
}

/** 成長バー(値配列を棒グラフ化・右肩上がりの可視化)。色は success。 */
export function GrowthBars({ values, height = 64 }: { values: number[]; height?: number }) {
  const { colors } = useTokens();
  const max = Math.max(1, ...values);
  return (
    <View style={{ flexDirection: 'row', alignItems: 'flex-end', gap: 4, height }}>
      {values.map((v, i) => (
        <View key={i} style={{ flex: 1, justifyContent: 'flex-end' }}>
          <View style={{ backgroundColor: colors.success, borderRadius: 2, width: '100%', height: 6 + ((height - 10) * v) / max }} />
        </View>
      ))}
    </View>
  );
}

export interface BadgeItem { id: string; emoji: string; label: string; hint: string; unlocked: boolean }
/** バッジグリッド(3列)。未獲得は🔒+淡色。achievedLabel=獲得時の表示文言(各アプリのi18n)。 */
export function BadgeGrid({ badges, achievedLabel }: { badges: BadgeItem[]; achievedLabel: string }) {
  const { colors, radius, spacing } = useTokens();
  return (
    <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm }}>
      {badges.map((b) => (
        <View
          key={b.id}
          style={{
            width: '31%', backgroundColor: b.unlocked ? colors.surface : colors.bgSoft, borderRadius: radius.md,
            borderWidth: 1, borderColor: colors.line, padding: spacing.sm, alignItems: 'center', gap: 2,
          }}
        >
          <Text style={{ fontSize: 26, opacity: b.unlocked ? 1 : 0.5 }}>{b.unlocked ? b.emoji : '🔒'}</Text>
          <Text style={{ fontSize: 11, fontWeight: '800', color: colors.ink2, textAlign: 'center' }}>{b.label}</Text>
          <Text style={{ fontSize: 9, color: colors.faint, textAlign: 'center' }}>{b.unlocked ? achievedLabel : b.hint}</Text>
        </View>
      ))}
    </View>
  );
}
