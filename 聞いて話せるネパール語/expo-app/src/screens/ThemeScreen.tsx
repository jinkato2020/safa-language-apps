import { useLayoutEffect, useState } from 'react';
import { FlatList, Pressable, StyleSheet, Text, View } from 'react-native';
import { useNavigation, useRoute, type RouteProp } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { colors, spacing, radius } from '../theme';
import type { RootStackParamList } from '../types';
import { THEMES, GRAMMAR_THEMES, LEVELS } from '../dataLoader';

type Nav = NativeStackNavigationProp<RootStackParamList, 'Theme'>;
type R = RouteProp<RootStackParamList, 'Theme'>;

export default function ThemeScreen() {
  const navigation = useNavigation<Nav>();
  const { mode, source } = useRoute<R>().params;
  const isGrammarMode = mode === 'grammar';
  const isGrammarListen = mode === 'listening' && source === 'grammar';
  const isConversationListen = mode === 'listening' && !isGrammarListen;
  const useGrammarThemes = isGrammarMode || isGrammarListen;
  const modeLabel = mode === 'conversation' ? '会話' : mode === 'grammar' ? '文法'
    : isGrammarListen ? '聞き流し / 文法' : '聞き流し / 会話';
  const items = useGrammarThemes ? GRAMMAR_THEMES : THEMES;

  // 会話モードおよび聞き流し×会話モードでレベルピルを表示
  const showLevelPills = mode === 'conversation' || isConversationListen;
  const [selectedLevel, setSelectedLevel] = useState(1);

  const titleText = 'テーマを選択';

  useLayoutEffect(() => {
    navigation.setOptions({ title: titleText });
  }, [navigation, titleText]);

  let headerText: string;
  if (isGrammarMode) {
    headerText = 'テーマを1つ選んで、文法の構造を学びましょう。';
  } else if (isGrammarListen) {
    headerText = 'テーマを1つ選んで、聞き流しを始めましょう。';
  } else if (mode === 'listening') {
    headerText = 'テーマを1つ選んで、聞き流しを始めましょう。';
  } else {
    headerText = 'テーマを1つ選んで、会話文を表現する練習を始めましょう。';
  }

  const onPressItem = (id: number, free: boolean) => {
    if (!free) {
      navigation.navigate('Paywall', { feature: mode });
      return;
    }
    if (mode === 'grammar') {
      // 文法モード: レベル選択をスキップして Practice へ
      navigation.navigate('Practice', { themeId: id, mode: 'grammar' });
    } else if (mode === 'listening' && source === 'grammar') {
      // 文法聞き流し: レベル選択をスキップして Listening へ
      navigation.navigate('Listening', { themeId: id, source: 'grammar' });
    } else if (mode === 'conversation') {
      // 会話モード: レベルピルで選択したレベルで直接 Practice へ
      navigation.navigate('Practice', { themeId: id, levelId: selectedLevel });
    } else if (isConversationListen) {
      // 聞き流し×会話: レベルピルで選択したレベルで直接 Listening へ
      navigation.navigate('Listening', { themeId: id, levelId: selectedLevel });
    } else {
      navigation.navigate('Level', { mode, themeId: id });
    }
  };

  const levelLabels: Record<number, string> = { 1: '初級', 2: '中級', 3: '上級' };

  return (
    <FlatList
      contentContainerStyle={styles.container}
      ListHeaderComponent={
        <View style={styles.head}>
          <Text style={styles.kicker}>{modeLabel}</Text>
          <Text style={styles.title}>{titleText}</Text>
          <Text style={styles.desc}>{headerText}</Text>
          {showLevelPills && (
            <View style={styles.levelPillRow}>
              {LEVELS.map(lv => (
                <Pressable
                  key={lv.id}
                  style={[styles.levelPill, selectedLevel === lv.id && styles.levelPillOn]}
                  onPress={() => setSelectedLevel(lv.id)}
                >
                  <Text style={[styles.levelPillText, selectedLevel === lv.id && styles.levelPillTextOn]}>
                    {levelLabels[lv.id] ?? lv.name}
                  </Text>
                </Pressable>
              ))}
            </View>
          )}
        </View>
      }
      data={items}
      keyExtractor={(item) => String(item.id)}
      renderItem={({ item }) => (
        <Pressable
          style={({ pressed }) => [
            styles.card,
            !item.free && styles.cardLocked,
            pressed && styles.cardPressed,
          ]}
          onPress={() => onPressItem(item.id, item.free)}
        >
          <Text style={styles.num}>{String(item.id).padStart(2, '0')}</Text>
          <Text style={[styles.name, !item.free && styles.nameLocked]}>{item.name}</Text>
          {!item.free && <Text style={styles.lock}>🔒</Text>}
        </Pressable>
      )}
    />
  );
}

const styles = StyleSheet.create({
  container: { padding: spacing.lg, paddingBottom: spacing.xxl },
  head: { marginBottom: spacing.xl },
  kicker: { fontSize: 11, color: colors.inkQuiet, letterSpacing: 2, textTransform: 'uppercase', marginBottom: spacing.xs },
  title: { fontSize: 28, fontWeight: '700', color: colors.ink, marginBottom: spacing.xs, letterSpacing: -0.5 },
  desc: { fontSize: 14, color: colors.inkMute, lineHeight: 21, marginBottom: spacing.md },
  levelPillRow: { flexDirection: 'row', gap: spacing.xs, flexWrap: 'wrap', marginTop: spacing.xs },
  levelPill: {
    paddingHorizontal: spacing.md,
    paddingVertical: 7,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.line,
    borderRadius: 99,
  },
  levelPillOn: { backgroundColor: colors.ink, borderColor: colors.ink },
  levelPillText: { fontSize: 13, fontWeight: '500', color: colors.inkMute },
  levelPillTextOn: { color: '#fff' },
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.line,
    borderRadius: radius.md,
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.md,
    marginBottom: spacing.sm,
  },
  cardPressed: { backgroundColor: colors.bgSoft, borderColor: colors.ink },
  cardLocked: { backgroundColor: colors.bgDisabled, opacity: 0.75 },
  num: { fontFamily: 'Courier', fontSize: 11, color: colors.inkFaint, width: 24 },
  name: { flex: 1, fontSize: 14, fontWeight: '500', color: colors.ink },
  nameLocked: { color: colors.inkFaint },
  lock: { fontSize: 14 },
});
