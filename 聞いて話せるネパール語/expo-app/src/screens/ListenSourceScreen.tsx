import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import Svg, { Line, Path } from 'react-native-svg';
import { colors, spacing, radius } from '../theme';
import type { RootStackParamList } from '../types';
import { THEMES, GRAMMAR_THEMES } from '../dataLoader';

type Nav = NativeStackNavigationProp<RootStackParamList, 'ListenSource'>;

function ChatIcon() {
  return (
    <Svg width={36} height={36} viewBox="0 0 24 24" fill="none" stroke={colors.ink} strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round">
      <Path d="M21 11.5a8.38 8.38 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.38 8.38 0 0 1-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.38 8.38 0 0 1 3.8-.9h.5a8.48 8.48 0 0 1 8 8v.5z" />
    </Svg>
  );
}

function GrammarIcon() {
  return (
    <Svg width={36} height={36} viewBox="0 0 24 24" fill="none" stroke={colors.ink} strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round">
      <Path d="M4 4.5A2.5 2.5 0 0 1 6.5 2H20v15H6.5A2.5 2.5 0 0 0 4 19.5v-15z" />
      <Path d="M4 19.5A2.5 2.5 0 0 0 6.5 22H20" />
      <Line x1="8" y1="7" x2="16" y2="7" />
      <Line x1="8" y1="11" x2="14" y2="11" />
    </Svg>
  );
}

export default function ListenSourceScreen() {
  const navigation = useNavigation<Nav>();

  const totalConvEx = THEMES.length * 3 * 20; // 表示用の概数 (1800)
  const totalGrammarEx = GRAMMAR_THEMES.reduce((s, t) => s + t.exampleCount, 0);

  return (
    <ScrollView contentContainerStyle={styles.container}>
      <View style={styles.grid}>
        <Pressable
          style={({ pressed }) => [styles.card, pressed && styles.cardPressed]}
          onPress={() => navigation.navigate('Theme', { mode: 'listening' })}
        >
          <ChatIcon />
          <View style={styles.cardBody}>
            <Text style={styles.name}>会話</Text>
            <Text style={styles.cardDesc}>
              {THEMES.length}テーマ × 3レベル = {totalConvEx}例題
            </Text>
            <Text style={styles.meta}>{totalConvEx}例題</Text>
          </View>
        </Pressable>

        <Pressable
          style={({ pressed }) => [styles.card, pressed && styles.cardPressed]}
          onPress={() => navigation.navigate('Theme', { mode: 'listening', source: 'grammar' })}
        >
          <GrammarIcon />
          <View style={styles.cardBody}>
            <Text style={styles.name}>文法</Text>
            <Text style={styles.cardDesc}>
              {GRAMMAR_THEMES.length}分野 × 20例題 = {totalGrammarEx}例題
            </Text>
            <Text style={styles.meta}>{totalGrammarEx}例題</Text>
          </View>
        </Pressable>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { padding: spacing.lg, paddingBottom: spacing.xxl },
  head: { marginBottom: spacing.lg },
  title: { fontSize: 26, fontWeight: '700', color: colors.ink, marginBottom: spacing.xs, letterSpacing: -0.5 },
  desc: { fontSize: 14, color: colors.inkMute, lineHeight: 21 },
  grid: { gap: spacing.sm },
  card: {
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.line,
    borderRadius: radius.md,
    padding: spacing.md,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
  },
  cardPressed: { backgroundColor: colors.bgSoft, borderColor: colors.ink },
  cardBody: { flex: 1 },
  name: { fontSize: 16, fontWeight: '700', color: colors.ink, marginBottom: 2, letterSpacing: -0.2 },
  cardDesc: { fontSize: 12, color: colors.inkMute, lineHeight: 18, marginBottom: 2 },
  meta: { fontSize: 11, color: colors.inkFaint, letterSpacing: 0.5 },
});
