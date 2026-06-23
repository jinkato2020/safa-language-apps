import { useLayoutEffect, useState } from 'react';
import { FlatList, Pressable, StyleSheet, View } from 'react-native';
import { Text } from '../Text';
import { useNavigation, useRoute, type RouteProp } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { colors, spacing, radius } from '../theme';
import type { RootStackParamList } from '../types';
import { useScaleStyle } from '../SettingsContext';
import { useI18n } from '../i18n';
import { useAppData } from '../AppDataContext';

type Nav = NativeStackNavigationProp<RootStackParamList, 'Theme'>;
type R = RouteProp<RootStackParamList, 'Theme'>;

export default function ThemeScreen() {
  const { THEMES, GRAMMAR_THEMES, LEVELS } = useAppData();
  const navigation = useNavigation<Nav>();
  const { t } = useI18n();
  const ss = useScaleStyle();
  const { mode, source } = useRoute<R>().params;
  const isListening = mode === 'listening';
  // 聞き流しモードでは画面内トグルで会話/文法を切り替える（route param は初期値として尊重）
  const [listenSource, setListenSource] = useState<'conversation' | 'grammar'>(
    source === 'grammar' ? 'grammar' : 'conversation'
  );
  const effectiveSource = isListening
    ? (listenSource === 'grammar' ? 'grammar' : undefined)
    : source;

  const isGrammarMode = mode === 'grammar';
  const isGrammarListen = isListening && effectiveSource === 'grammar';
  const isConversationListen = isListening && !isGrammarListen;
  const useGrammarThemes = isGrammarMode || isGrammarListen;
  const items = useGrammarThemes ? GRAMMAR_THEMES : THEMES;

  // 会話モードおよび聞き流し×会話モードでレベルピルを表示
  const showLevelPills = mode === 'conversation' || isConversationListen || mode === 'sakubun';
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

  // 聞き流しは会話/文法トグルに依らず常に「聞き流しモード」見出し
  let modeTitle: string;
  if (mode === 'grammar') {
    modeTitle = t('themeScreen.modeTitleGrammar');
  } else if (mode === 'listening') {
    modeTitle = t('themeScreen.modeTitleListen');
  } else if (mode === 'sakubun') {
    modeTitle = t('sakubun.title');
  } else {
    modeTitle = t('themeScreen.modeTitleConv');
  }

  const getThemeDisplayName = (id: number): string => {
    return useGrammarThemes ? t(`grammarThemes.${id}`) : t(`themes.${id}`);
  };

  const onPressItem = (id: number) => {
    if (mode === 'sakubun') {
      navigation.navigate('Sakubun', { themeId: id, levelId: selectedLevel, startIndex: 0 });
    } else if (mode === 'grammar') {
      navigation.navigate('Practice', { themeId: id, mode: 'grammar' });
    } else if (isGrammarListen) {
      navigation.navigate('Listening', { themeId: id, source: 'grammar' });
    } else if (isConversationListen) {
      navigation.navigate('Listening', { themeId: id, levelId: selectedLevel });
    } else if (mode === 'conversation') {
      navigation.navigate('Practice', { themeId: id, levelId: selectedLevel });
    } else {
      navigation.navigate('Level', { mode, themeId: id });
    }
  };

  return (
    <FlatList
      contentContainerStyle={styles.container}
      ListHeaderComponent={
        <View style={styles.head}>
          <Text style={[styles.modeTitle, ss(20)]}>{modeTitle}</Text>
          <Text style={[styles.desc, ss(14, 21)]}>{headerText}</Text>
          {isListening && (
            <View style={styles.sourceToggle}>
              <Pressable
                style={[styles.sourceTab, listenSource === 'conversation' && styles.sourceTabOn]}
                onPress={() => setListenSource('conversation')}
              >
                <Text style={[styles.sourceTabText, listenSource === 'conversation' && styles.sourceTabTextOn, ss(14)]}>
                  {t('listenSource.convName')}
                </Text>
              </Pressable>
              <Pressable
                style={[styles.sourceTab, listenSource === 'grammar' && styles.sourceTabOn]}
                onPress={() => setListenSource('grammar')}
              >
                <Text style={[styles.sourceTabText, listenSource === 'grammar' && styles.sourceTabTextOn, ss(14)]}>
                  {t('listenSource.grammarName')}
                </Text>
              </Pressable>
            </View>
          )}
          {showLevelPills && (
            <View style={styles.levelPillRow}>
              {LEVELS.map(lv => (
                <Pressable
                  key={lv.id}
                  style={[styles.levelPill, selectedLevel === lv.id && styles.levelPillOn]}
                  onPress={() => setSelectedLevel(lv.id)}
                >
                  <Text style={[styles.levelPillText, selectedLevel === lv.id && styles.levelPillTextOn, ss(13)]}>
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
      renderItem={({ item, index }) => (
        <Pressable
          style={({ pressed }) => [
            styles.card,
            pressed && styles.cardPressed,
          ]}
          onPress={() => onPressItem(item.id)}
        >
          {/* 表示番号はリスト上の位置(=テーマ並び順)。データキーは item.id を維持。 */}
          <Text style={styles.num}>{String(index + 1).padStart(2, '0')}</Text>
          <Text style={[styles.name, ss(14)]}>{getThemeDisplayName(item.id)}</Text>
        </Pressable>
      )}
    />
  );
}

const styles = StyleSheet.create({
  container: { padding: spacing.lg, paddingBottom: spacing.xxl, maxWidth: 760, width: '100%', alignSelf: 'center' },
  head: { marginBottom: spacing.xl },
  modeTitle: { fontSize: 20, fontWeight: '700', color: colors.accentJa, letterSpacing: 0.2, marginBottom: spacing.sm, textAlign: 'center' },
  kicker: { fontSize: 11, color: colors.inkQuiet, letterSpacing: 2, textTransform: 'uppercase', marginBottom: spacing.xs },
  title: { fontSize: 28, fontWeight: '700', color: colors.ink, marginBottom: spacing.xs, letterSpacing: -0.5 },
  desc: { fontSize: 14, color: colors.inkMute, lineHeight: 21, marginBottom: spacing.md },
  sourceToggle: { flexDirection: 'row', gap: spacing.xs, marginBottom: spacing.md },
  sourceTab: {
    minWidth: 92,
    paddingHorizontal: spacing.lg,
    paddingVertical: 9,
    alignItems: 'center',
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.line,
    borderRadius: radius.md,
  },
  sourceTabOn: { backgroundColor: colors.ink, borderColor: colors.ink },
  sourceTabText: { fontSize: 14, fontWeight: '600', color: colors.inkMute },
  sourceTabTextOn: { color: '#fff' },
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
  num: { fontFamily: 'Courier', fontSize: 11, color: colors.inkFaint, width: 24 },
  name: { flex: 1, fontSize: 14, fontWeight: '500', color: colors.ink },
});
