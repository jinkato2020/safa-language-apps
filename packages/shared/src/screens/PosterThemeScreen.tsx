// ポスター音声学習: テーマ一覧。
import React from 'react';
import { View, Text, Pressable, FlatList, StyleSheet } from 'react-native';
import { colors, spacing, radius } from '../theme';
import { usePosterLessons } from '../PosterContext';

export default function PosterThemeScreen({ navigation }: any) {
  const lessons = usePosterLessons();
  return (
    <View style={styles.container}>
      <FlatList
        data={lessons}
        keyExtractor={l => l.id}
        contentContainerStyle={{ padding: spacing.lg, gap: spacing.md }}
        renderItem={({ item }) => (
          <Pressable onPress={() => navigation.navigate('PosterAudio', { lessonId: item.id })}
            style={({ pressed }) => [styles.row, pressed && styles.pressed]}>
            <Text style={styles.jp}>{item.title}</Text>
            <Text style={styles.np}>{item.titleNp}</Text>
            <Text style={styles.count}>{item.cards.length}語</Text>
          </Pressable>
        )}
      />
    </View>
  );
}
const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg },
  row: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.line, borderRadius: radius.lg, padding: spacing.lg },
  pressed: { backgroundColor: colors.bgSoft },
  jp: { fontSize: 20, fontWeight: '700', color: colors.ink },
  np: { fontSize: 18, color: '#2f5d54', flex: 1 },
  count: { fontSize: 12, color: colors.inkFaint },
});
