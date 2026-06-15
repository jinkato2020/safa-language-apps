// 汎用モーダル式ドロップダウン。トリガー(現在値+▾)をタップ → 一覧をモーダルで下から提示。
// react-native の Modal のみ使用(外部ライブラリ不要・全OS同じ見た目)。言語選択など共通利用。
import { useState } from 'react';
import { Modal, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { Text } from './Text';
import { colors, spacing, radius } from './theme';

export type DropdownItem<T extends string> = { value: T; label: string; sub?: string };

export function ModalDropdown<T extends string>({
  items, value, onChange, placeholder, size = 'normal', accent = colors.accentJa,
}: {
  items: DropdownItem<T>[];
  value: T | null;
  onChange: (v: T) => void;
  placeholder?: string;
  size?: 'normal' | 'large';
  accent?: string;
}) {
  const [open, setOpen] = useState(false);
  const current = items.find(i => i.value === value) ?? null;
  const big = size === 'large';
  return (
    <>
      <Pressable
        onPress={() => setOpen(true)}
        style={[styles.trigger, big && styles.triggerLarge]}
        accessibilityRole="button"
      >
        <View style={{ flex: big ? 0 : 1 }}>
          <Text style={[big ? styles.triggerTextLarge : styles.triggerText, !current && styles.placeholder]}>
            {current ? current.label : (placeholder ?? '—')}
          </Text>
          {big && current?.sub ? <Text style={styles.triggerSub}>{current.sub}</Text> : null}
        </View>
        <Text style={[styles.chevron, big && styles.chevronLarge]}>▾</Text>
      </Pressable>

      <Modal visible={open} transparent animationType="fade" onRequestClose={() => setOpen(false)}>
        <Pressable style={styles.backdrop} onPress={() => setOpen(false)}>
          <Pressable style={styles.sheet} onPress={() => {}}>
            <ScrollView bounces={false}>
              {items.map(it => {
                const on = it.value === value;
                return (
                  <Pressable
                    key={it.value}
                    onPress={() => { onChange(it.value); setOpen(false); }}
                    style={[styles.option, on && { backgroundColor: colors.lineSoft }]}
                  >
                    <View style={{ flex: 1 }}>
                      <Text style={[styles.optionText, on && { color: accent, fontWeight: '700' }]}>{it.label}</Text>
                      {it.sub ? <Text style={styles.optionSub}>{it.sub}</Text> : null}
                    </View>
                    {on ? <Text style={[styles.check, { color: accent }]}>✓</Text> : null}
                  </Pressable>
                );
              })}
            </ScrollView>
          </Pressable>
        </Pressable>
      </Modal>
    </>
  );
}

const styles = StyleSheet.create({
  trigger: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    borderWidth: 1, borderColor: colors.line, borderRadius: radius.md,
    paddingHorizontal: spacing.md, paddingVertical: 8, backgroundColor: colors.surface, minWidth: 120,
  },
  triggerLarge: { width: 248, paddingVertical: 16, justifyContent: 'center' },
  triggerText: { fontSize: 14, color: colors.inkSoft },
  triggerTextLarge: { fontSize: 20, fontWeight: '700', color: colors.inkSoft, textAlign: 'center' },
  triggerSub: { fontSize: 12, color: colors.inkQuiet, textAlign: 'center', marginTop: 2 },
  placeholder: { color: colors.inkFaint },
  chevron: { fontSize: 12, color: colors.inkQuiet, marginLeft: spacing.sm },
  chevronLarge: { fontSize: 16, marginLeft: spacing.md },
  backdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.35)', justifyContent: 'center', alignItems: 'center', padding: 32 },
  sheet: { width: '100%', maxWidth: 360, maxHeight: '70%', backgroundColor: colors.surface, borderRadius: radius.lg, overflow: 'hidden', paddingVertical: spacing.xs },
  option: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: spacing.lg, paddingVertical: 14 },
  optionText: { fontSize: 16, color: colors.inkSoft },
  optionSub: { fontSize: 12, color: colors.inkQuiet, marginTop: 2 },
  check: { fontSize: 16, marginLeft: spacing.md },
});
