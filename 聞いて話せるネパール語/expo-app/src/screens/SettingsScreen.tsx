import { Alert, Linking, Pressable, ScrollView, Share, StyleSheet, Switch, Text, View } from 'react-native';
import Svg, { Circle, Ellipse, Line, Path, Polygon } from 'react-native-svg';
import { colors, spacing, radius } from '../theme';
import {
  useSettings,
  type Direction, type NepaliRepeat, type ListenSpeed,
  type GapMode, type ThemeMode, type FontMode,
} from '../SettingsContext';

// app.json から動的に取得（ハードコードしないことでバージョン bump 時の修正漏れ防止）
const APP_VERSION: string = (require('../../app.json') as { expo: { version: string } }).expo.version;

function Icon({ children, size = 16 }: { children: React.ReactNode; size?: number }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={colors.inkQuiet} strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round">
      {children}
    </Svg>
  );
}

// セクションアイコン
function SoundIcon() { return <Icon><Polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5" /><Path d="M15.54 8.46a5 5 0 0 1 0 7.07" /><Path d="M19.07 4.93a10 10 0 0 1 0 14.14" /></Icon>; }
function EyeIcon() { return <Icon><Path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" /><Circle cx={12} cy={12} r={3} /></Icon>; }
function CapIcon() { return <Icon><Path d="M22 10 12 5 2 10l10 5 10-5z" /><Path d="M6 12v5c3 3 9 3 12 0v-5" /></Icon>; }
function DataIcon() { return <Icon><Ellipse cx={12} cy={5} rx={9} ry={3} /><Path d="M21 12c0 1.66-4 3-9 3s-9-1.34-9-3" /><Path d="M3 5v14c0 1.66 4 3 9 3s9-1.34 9-3V5" /></Icon>; }
function InfoIcon() { return <Icon><Circle cx={12} cy={12} r={10} /><Line x1={12} y1={16} x2={12} y2={12} /><Line x1={12} y1={8} x2={12.01} y2={8} /></Icon>; }

// Pill (ピル選択)
function PillGroup<T extends string | number>({ items, value, onChange }: {
  items: { value: T; label: string }[];
  value: T;
  onChange: (v: T) => void;
}) {
  return (
    <View style={styles.pillGroup}>
      {items.map(it => (
        <Pressable
          key={String(it.value)}
          style={[styles.pill, value === it.value && styles.pillOn]}
          onPress={() => onChange(it.value)}
        >
          <Text style={[styles.pillText, value === it.value && styles.pillTextOn]}>{it.label}</Text>
        </Pressable>
      ))}
    </View>
  );
}

function Row({ label, desc, children }: { label: string; desc?: string; children: React.ReactNode }) {
  return (
    <View style={styles.item}>
      <View style={styles.itemLabelCol}>
        <Text style={styles.itemLabel}>{label}</Text>
        {desc ? <Text style={styles.itemDesc}>{desc}</Text> : null}
      </View>
      <View style={styles.itemControl}>{children}</View>
    </View>
  );
}

function Section({ title, icon, children }: { title: string; icon: React.ReactNode; children: React.ReactNode }) {
  return (
    <View style={styles.section}>
      <View style={styles.sectionHeader}>
        {icon}
        <Text style={styles.sectionTitle}>{title}</Text>
      </View>
      {children}
    </View>
  );
}

export default function SettingsScreen() {
  const s = useSettings();

  const onShare = async () => {
    try {
      await Share.share({
        message: '聞いて話せるネパール語 — 日本語からネパール語の瞬間作文トレーニングアプリ',
      });
    } catch {}
  };

  const onReset = () => {
    Alert.alert('設定をリセット', '全ての設定を初期値に戻しますか？', [
      { text: 'キャンセル', style: 'cancel' },
      { text: 'リセット', style: 'destructive', onPress: () => s.resetSettings() },
    ]);
  };

  const onPrivacy = () => {
    // プライバシーポリシーのURL (実際のURLに置き換える)
    Linking.openURL('https://example.com/privacy-policy').catch(() => {
      Alert.alert('エラー', 'プライバシーポリシーを開けませんでした。');
    });
  };

  const onContact = () => {
    Linking.openURL('mailto:jw.psalms34.8@gmail.com?subject=聞いて話せるネパール語 お問い合わせ').catch(() => {
      Alert.alert('エラー', 'メールアプリを開けませんでした。');
    });
  };

  return (
    <ScrollView contentContainerStyle={styles.container}>
      <View style={styles.head}>
        <Text style={styles.title}>設定</Text>
        <Text style={styles.desc}>学習体験をカスタマイズできます。設定は自動的に保存されます。</Text>
      </View>

      <Section title="音声" icon={<SoundIcon />}>
        <Row label="音声再生スピード" desc="全モード共通の再生速度">
          <PillGroup<ListenSpeed>
            items={[{ value: 0.8, label: '×0.8' }, { value: 1.0, label: '×1.0' }, { value: 1.2, label: '×1.2' }, { value: 1.5, label: '×1.5' }]}
            value={s.listenSpeed}
            onChange={s.setListenSpeed}
          />
        </Row>
        <Row label="ネパール語の繰り返し回数" desc="聞き流し時にネパール語を何回再生するか">
          <PillGroup<NepaliRepeat>
            items={[{ value: 1, label: '1回' }, { value: 2, label: '2回' }, { value: 3, label: '3回' }]}
            value={s.nepaliRepeat}
            onChange={s.setNepaliRepeat}
          />
        </Row>
        <Row label="会話の出題方向" desc="会話モードのデフォルト翻訳方向">
          <PillGroup<Direction>
            items={[{ value: 'ja2ne', label: '🇯🇵 → 🇳🇵' }, { value: 'ne2ja', label: '🇳🇵 → 🇯🇵' }]}
            value={s.practiceDirection}
            onChange={s.setPracticeDirection}
          />
        </Row>
        <Row label="聞き流しの再生順序" desc="聞き流しモードでどちらを先に再生するか">
          <PillGroup<Direction>
            items={[{ value: 'ja2ne', label: '🇯🇵 → 🇳🇵' }, { value: 'ne2ja', label: '🇳🇵 → 🇯🇵' }]}
            value={s.listenDirection}
            onChange={s.setListenDirection}
          />
        </Row>
        <Row label="聞き流しループ再生" desc="最後まで再生したら最初に戻る">
          <Switch value={s.listenLoop} onValueChange={s.setListenLoop} trackColor={{ false: colors.line, true: colors.ink }} />
        </Row>
        <Row label="音声間の間隔" desc="日本語と次の音声の間の待ち時間">
          <PillGroup<GapMode>
            items={[{ value: 'short', label: '短め' }, { value: 'normal', label: '標準' }, { value: 'long', label: '長め' }]}
            value={s.gap}
            onChange={s.setGap}
          />
        </Row>
      </Section>

      <Section title="表示" icon={<EyeIcon />}>
        <Row label="ローマ字表記の表示" desc="ネパール語の発音をローマ字で表示">
          <Switch value={s.romaji} onValueChange={s.setRomaji} trackColor={{ false: colors.line, true: colors.ink }} />
        </Row>
        <Row label="ダークモード" desc="画面の配色">
          <PillGroup<ThemeMode>
            items={[{ value: 'light', label: 'ライト' }, { value: 'dark', label: 'ダーク' }, { value: 'system', label: 'システム' }]}
            value={s.themeMode}
            onChange={s.setThemeMode}
          />
        </Row>
        <Row label="文字サイズ" desc="全体の文字の大きさ">
          <PillGroup<FontMode>
            items={[{ value: 'small', label: '小' }, { value: 'medium', label: '中' }, { value: 'large', label: '大' }]}
            value={s.fontMode}
            onChange={s.setFontMode}
          />
        </Row>
      </Section>

      <Section title="学習" icon={<CapIcon />}>
        <Row label="単語フラッシュカード自動反転" desc="フラッシュカードを自動で裏返す">
          <Switch value={s.autoFlip} onValueChange={s.setAutoFlip} trackColor={{ false: colors.line, true: colors.ink }} />
        </Row>
        <Row label="単語シャッフル" desc="フラッシュカードを毎回シャッフル">
          <Switch value={s.shuffle} onValueChange={s.setShuffle} trackColor={{ false: colors.line, true: colors.ink }} />
        </Row>
      </Section>

      <Section title="データ管理" icon={<DataIcon />}>
        <Row label="設定をリセット" desc="全設定を初期値に戻す">
          <Pressable style={[styles.btn, styles.btnDanger]} onPress={onReset}>
            <Text style={styles.btnTextDanger}>リセット</Text>
          </Pressable>
        </Row>
      </Section>

      <Section title="アプリについて" icon={<InfoIcon />}>
        <Row label="バージョン"><Text style={styles.valueText}>{APP_VERSION}</Text></Row>
        <Row label="このアプリを共有">
          <Pressable style={styles.btn} onPress={onShare}>
            <Text style={styles.btnText}>共有</Text>
          </Pressable>
        </Row>
        <Row label="プライバシーポリシー">
          <Pressable onPress={onPrivacy}><Text style={styles.linkText}>開く ↗</Text></Pressable>
        </Row>
        <Row label="お問い合わせ">
          <Pressable onPress={onContact}><Text style={styles.linkText}>メール ↗</Text></Pressable>
        </Row>
      </Section>

      <Text style={styles.versionFooter}>聞いて話せるネパール語 v{APP_VERSION}</Text>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { padding: spacing.lg, paddingBottom: spacing.xxl },
  head: { marginBottom: spacing.xl },
  title: { fontSize: 28, fontWeight: '700', color: colors.ink, marginBottom: spacing.xs, letterSpacing: -0.5 },
  desc: { fontSize: 14, color: colors.inkMute, lineHeight: 21 },
  section: { marginBottom: spacing.xl },
  sectionHeader: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, marginBottom: spacing.sm, paddingHorizontal: spacing.xs },
  sectionTitle: { fontSize: 13, fontWeight: '700', color: colors.inkQuiet, letterSpacing: 1.2, textTransform: 'uppercase' },
  item: {
    backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.line,
    borderRadius: radius.md, padding: spacing.md, marginBottom: spacing.xs,
    flexDirection: 'row', alignItems: 'center', gap: spacing.md, flexWrap: 'wrap',
  },
  itemLabelCol: { flex: 1, minWidth: 140 },
  itemLabel: { fontSize: 14, fontWeight: '500', color: colors.ink },
  itemDesc: { fontSize: 12, color: colors.inkMute, marginTop: 2 },
  itemControl: { flexDirection: 'row', alignItems: 'center', gap: spacing.xs, flexWrap: 'wrap', justifyContent: 'flex-end' },
  pillGroup: { flexDirection: 'row', gap: 6, flexWrap: 'wrap', justifyContent: 'flex-end' },
  pill: {
    paddingHorizontal: spacing.md, paddingVertical: 6,
    backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.line, borderRadius: 99,
  },
  pillOn: { backgroundColor: colors.ink, borderColor: colors.ink },
  pillText: { fontSize: 12, fontWeight: '500', color: colors.inkMute },
  pillTextOn: { color: '#fff' },
  btn: {
    paddingHorizontal: spacing.md, paddingVertical: 8,
    backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.line, borderRadius: radius.sm,
  },
  btnText: { fontSize: 13, fontWeight: '500', color: colors.ink },
  btnDanger: { borderColor: '#fecaca' },
  btnTextDanger: { fontSize: 13, fontWeight: '500', color: '#dc2626' },
  valueText: { fontFamily: 'Courier', fontSize: 13, color: colors.inkMute },
  linkText: { fontSize: 13, color: colors.accentJa, paddingHorizontal: 8, paddingVertical: 4 },
  versionFooter: { fontFamily: 'Courier', fontSize: 12, color: colors.inkQuiet, textAlign: 'center', marginTop: spacing.lg },
});
