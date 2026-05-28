import { useLayoutEffect, useState } from 'react';
import { FlatList, Pressable, StyleSheet, Text, View } from 'react-native';
import { useNavigation, useRoute, type RouteProp } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { colors, spacing, radius } from '../theme';
import type { RootStackParamList } from '../types';
import { THEMES, GRAMMAR_THEMES, LEVELS } from '../dataLoader';
import { useI18n } from '../i18n';

type Nav = NativeStackNavigationProp<RootStackParamList, 'Theme'>;
type R = RouteProp<RootStackParamList, 'Theme'>;

export default function ThemeScreen() {
  const navigation = useNavigation<Nav>();
  const { t } = useI18n();
  const { mode, source } = useRoute<R>().params;
  const isGrammarMode = mode === 'grammar';
  const isGrammarListen = mode === 'listening' && source === 'grammar';
  const isConversationListen = mode === 'listening' && !isGrammarListen;
  const useGrammarThemes = isGrammarMode || isGrammarListen;
  const items = useGrammarThemes ? GRAMMAR_THEMES : THEMES;

  // 会話モードおよび聞き流し×会話モードでレベルピルを表示
  const showLevelPills = mode === 'conversation' || isConversationListen;
  const [selectedLevel, setSelectedLevel] = useState(1);

  const titleText = t('themeScreen.title');

  useLayoutEffect(() => {
    navigation.setOptions({ title: titleText });
  }, [navigation, titleText]);

  let headerText: string;
  if (isGrammarMode) {
    headerText = t('themeScreen.headerGrammar');
  } else if (isGrammarListen || mode === 'listening') {
    headerText = t('themeScreen.headerListen');
  } else {
    headerText = t('themeScreen.headerConv');
  }

  const getThemeDisplayName = (id: number): string => {
    return useGrammarThemes ? t(`grammarThemes.${id}`) : t(`themes.${id}`);
  };

  const onPressItem = (id: number, free: boolean) => {
    if (!free) {
      navigation.navigate('Paywall', { feature: mode });
      return;
    }
    if (mode === 'grammar') {
      navigation.navigate('Practice', { themeId: id, mode: 'grammar' });
    } else if (mode === 'listening' && source === 'grammar') {
      navigation.navigate('Listening', { themeId: id, source: 'grammar' });
    } else if (mode === 'conversation') {
      navigation.navigate('Practice', { themeId: id, levelId: selectedLevel });
    } else if (isConversationListen) {
      navigation.navigate('Listening', { themeId: id, levelId: selectedLevel });
    } else {
      navigation.navigate('Level', { mode, themeId: id });
    }
  };

  return (
    <FlatList
      contentContainerStyle={styles.container}
      ListHeaderComponent={
        <View style={styles.head}>
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
                    {t(`levels.${lv.id}`)}
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
          <Text style={[styles.name, !item.free && styles.nameLocked]}>{getThemeDisplayName(item.id)}</Text>
          {!item.free && <Text style={styles.lock}>{t('common.lock')}</Text>}
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
