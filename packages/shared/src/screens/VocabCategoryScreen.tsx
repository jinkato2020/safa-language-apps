import { useState } from 'react';
import { FlatList, Pressable, StyleSheet, View } from 'react-native';
import { Text } from '../Text';
import { useNavigation, useRoute } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { colors, spacing, radius } from '../theme';
import type { RootStackParamList } from '../types';
import { useI18n } from '../i18n';
import { useScaleStyle } from '../SettingsContext';
import { useAppData } from '../AppDataContext';
import { usePosterLessons } from '../PosterContext';

type Nav = NativeStackNavigationProp<RootStackParamList, 'VocabCategory'>;
const GOLD = '#b08746';

export default function VocabCategoryScreen() {
  const { WORD_CATEGORIES } = useAppData();
  const lessons = usePosterLessons();
  const navigation = useNavigation<Nav>();
  const route = useRoute<any>();
  // App B: 聞き流しタブ経由は posterOnly=true で単語カード(flash)を出さずポスターのみ
  const posterOnly = !!route.params?.posterOnly;
  const { t, lang } = useI18n();
  const titleOf = (l: any) => (l?.titleL1 ? (l.titleL1[lang] ?? l.titleL1.en ?? l.title) : l?.title);
  const ss = useScaleStyle();
  const [mode, setMode] = useState<'flash' | 'poster'>(posterOnly ? 'poster' : 'flash');
  const hasPoster = lessons.length > 0;
  const showPoster = hasPoster && (posterOnly || mode === 'poster');

  const Header = (
    <View style={styles.head}>
      <Text style={[styles.modeTitle, ss(20)]}>{posterOnly ? t('vocab.modePoster') : t('vocab.modeTitle')}</Text>
      {hasPoster && !posterOnly && (
        <View style={styles.seg}>
          <Pressable onPress={() => setMode('flash')} style={[styles.segBtn, mode === 'flash' && styles.segOn]}>
            <Text style={[styles.segTx, mode === 'flash' && styles.segTxOn]}>{t('vocab.modeFlashcard')}</Text>
          </Pressable>
          <Pressable onPress={() => setMode('poster')} style={[styles.segBtn, mode === 'poster' && styles.segOn]}>
            <Text style={[styles.segTx, mode === 'poster' && styles.segTxOn]}>{t('vocab.modePoster')}</Text>
          </Pressable>
        </View>
      )}
      <Text style={styles.desc}>{showPoster ? t('vocab.modePosterDesc') : t('vocab.themeSelectDesc')}</Text>
    </View>
  );

  if (showPoster) {
    return (
      <FlatList
        contentContainerStyle={styles.container}
        ListHeaderComponent={Header}
        data={lessons}
        keyExtractor={(l) => l.id}
        renderItem={({ item }) => (
          <Pressable
            style={({ pressed }) => [styles.card, pressed && styles.cardPressed]}
            onPress={() => (navigation as any).navigate('PosterAudio', { lessonId: item.id })}
          >
            <Text style={[styles.posterJa, { flex: 1 }]}>{titleOf(item)}</Text>
            <Text style={styles.count}>{t('common.wordsCount', { count: item.cards?.length ?? (item.pages?.reduce((s: number, p: any) => s + (p.cards?.length ?? 0), 0) ?? 0) })}</Text>
          </Pressable>
        )}
      />
    );
  }

  return (
    <FlatList
      contentContainerStyle={styles.container}
      ListHeaderComponent={Header}
      data={WORD_CATEGORIES}
      keyExtractor={(item) => String(item.id)}
      renderItem={({ item }) => {
        const catName = t(`vocabCategories.${item.id}`);
        return (
          <Pressable
            style={({ pressed }) => [styles.card, pressed && styles.cardPressed]}
            onPress={() => { navigation.navigate('Flashcard', { categoryId: item.id, direction: 'ne2ja' }); }}
          >
            <Text style={styles.num}>{String(item.id).padStart(2, '0')}</Text>
            <Text style={styles.name}>{catName}</Text>
            <Text style={styles.count}>{t('common.wordsCount', { count: item.wordCount })}</Text>
          </Pressable>
        );
      }}
    />
  );
}

const styles = StyleSheet.create({
  container: { padding: spacing.lg, paddingBottom: spacing.xxl, maxWidth: 760, width: '100%', alignSelf: 'center' },
  head: { marginBottom: spacing.lg },
  modeTitle: { fontSize: 20, fontWeight: '700', color: colors.accentJa, letterSpacing: 0.2, marginBottom: spacing.sm, textAlign: 'center' },
  desc: { fontSize: 14, color: colors.inkMute, lineHeight: 21, textAlign: 'center' },
  seg: { flexDirection: 'row', gap: spacing.sm, marginBottom: spacing.md },
  segBtn: { flex: 1, alignItems: 'center', gap: 2, paddingVertical: spacing.sm, borderWidth: 1.5, borderColor: colors.line, borderRadius: radius.md, backgroundColor: colors.surface },
  segOn: { borderColor: colors.ink, backgroundColor: colors.ink },
  segIc: { fontSize: 22 },
  segTx: { fontSize: 13, fontWeight: '700', color: colors.ink },
  segTxOn: { color: '#fff' },
  card: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.line, borderRadius: radius.md, paddingVertical: spacing.md, paddingHorizontal: spacing.md, marginBottom: spacing.sm },
  cardPressed: { backgroundColor: colors.bgSoft, borderColor: colors.ink },
  num: { fontFamily: 'Courier', fontSize: 11, color: colors.inkFaint, width: 24 },
  name: { flex: 1, fontSize: 14, fontWeight: '500', color: colors.ink },
  count: { fontFamily: 'Courier', fontSize: 11, color: colors.inkFaint, paddingHorizontal: spacing.sm, paddingVertical: 3, borderWidth: 1, borderColor: colors.line, borderRadius: 99 },
  posterJa: { fontSize: 14, fontWeight: '500', color: colors.ink },
  posterNp: { flex: 1, fontSize: 16, color: '#2f5d54', marginLeft: spacing.sm },
  badge: { fontSize: 14, color: GOLD, marginRight: spacing.sm },
});
