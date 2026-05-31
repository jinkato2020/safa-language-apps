import { Alert, Linking, Platform, Pressable, ScrollView, Share, StyleSheet, Switch, View } from 'react-native';
import Svg, { Circle, Ellipse, Line, Path, Polygon } from 'react-native-svg';
import { Text } from '../Text';
import { colors, spacing, radius } from '../theme';
import {
  useSettings, useScaleStyle,
  type Direction, type NepaliRepeat, type ListenSpeed,
  type GapMode, type ThemeMode, type FontMode,
} from '../SettingsContext';
import { useI18n, type Lang } from '../i18n';
import { useAppData } from '../AppDataContext';
import * as Application from 'expo-application';

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
function LangIcon() { return <Icon><Circle cx={12} cy={12} r={10} /><Line x1={2} y1={12} x2={22} y2={12} /><Path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z" /></Icon>; }

// Pill (ピル選択)
function PillGroup<T extends string | number>({ items, value, onChange, ss }: {
  items: { value: T; label: string }[];
  value: T;
  onChange: (v: T) => void;
  ss: (fs: number, lh?: number) => { fontSize: number; lineHeight?: number };
}) {
  return (
    <View style={styles.pillGroup}>
      {items.map(it => (
        <Pressable
          key={String(it.value)}
          style={[styles.pill, value === it.value && styles.pillOn]}
          onPress={() => onChange(it.value)}
        >
          <Text style={[styles.pillText, value === it.value && styles.pillTextOn, ss(12)]}>{it.label}</Text>
        </Pressable>
      ))}
    </View>
  );
}

function Row({ label, desc, children, ss }: { label: string; desc?: string; children: React.ReactNode; ss: (fs: number, lh?: number) => { fontSize: number; lineHeight?: number } }) {
  return (
    <View style={styles.item}>
      <View style={styles.itemLabelCol}>
        <Text style={[styles.itemLabel, ss(14)]}>{label}</Text>
        {desc ? <Text style={[styles.itemDesc, ss(12)]}>{desc}</Text> : null}
      </View>
      <View style={styles.itemControl}>{children}</View>
    </View>
  );
}

function Section({ title, icon, children, ss }: { title: string; icon: React.ReactNode; children: React.ReactNode; ss: (fs: number, lh?: number) => { fontSize: number; lineHeight?: number } }) {
  return (
    <View style={styles.section}>
      <View style={styles.sectionHeader}>
        {icon}
        <Text style={[styles.sectionTitle, ss(13)]}>{title}</Text>
      </View>
      {children}
    </View>
  );
}

export default function SettingsScreen() {
  const s = useSettings();
  const { t, lang, setLang } = useI18n();
  const ss = useScaleStyle();
  const { version: APP_VERSION, review } = useAppData();
  const buildNumber = Application.nativeBuildVersion;
  const versionDisplay = buildNumber ? `${APP_VERSION} (${buildNumber})` : APP_VERSION;
  const isJaUI = lang === 'ja';

  // UI 言語に応じたピル順序: ネパール語 UI の時はネパール語側を先頭に
  const langItems: { value: Lang; label: string }[] = isJaUI
    ? [{ value: 'ja', label: '日本語' }, { value: 'ne', label: 'नेपाली' }]
    : [{ value: 'ne', label: 'नेपाली' }, { value: 'ja', label: '日本語' }];

  const directionItems: { value: Direction; label: string }[] = isJaUI
    ? [{ value: 'ja2ne', label: t('directions.ja2ne') }, { value: 'ne2ja', label: t('directions.ne2ja') }]
    : [{ value: 'ne2ja', label: t('directions.ne2ja') }, { value: 'ja2ne', label: t('directions.ja2ne') }];

  const onShare = async () => {
    try {
      await Share.share({
        message: t('app.shareMessage') || t('app.name'),
      });
    } catch {}
  };

  const onReset = () => {
    Alert.alert(t('settings.resetConfirmTitle'), t('settings.resetConfirmDesc'), [
      { text: t('common.cancel'), style: 'cancel' },
      { text: t('common.reset'), style: 'destructive', onPress: () => s.resetSettings() },
    ]);
  };

  const onPrivacy = () => {
    Linking.openURL('https://www.safa-lang.com/nepali/privacy/').catch(() => {
      Alert.alert(t('common.error'), t('settings.privacyError'));
    });
  };

  const onContact = () => {
    Linking.openURL(`mailto:contact@safa-lang.com?subject=${encodeURIComponent(t('settings.mailSubject'))}`).catch(() => {
      Alert.alert(t('common.error'), t('settings.mailError'));
    });
  };

  // 評価リンク: iOS は App Store の数値ID、Android はパッケージ名から生成。
  // 手動ボタンは Apple 推奨どおりストアのレビュー画面を直接開く。
  const iosAppId = review?.iosAppId;
  const androidPackage = review?.androidPackage;
  const canRate = Platform.OS === 'ios' ? !!iosAppId : !!androidPackage;

  const onRate = () => {
    if (Platform.OS === 'ios') {
      Linking.openURL(`https://apps.apple.com/app/id${iosAppId}?action=write-review`).catch(() => {
        Alert.alert(t('common.error'), t('settings.rateError'));
      });
    } else {
      Linking.openURL(`market://details?id=${androidPackage}`).catch(() => {
        Linking.openURL(`https://play.google.com/store/apps/details?id=${androidPackage}`).catch(() => {
          Alert.alert(t('common.error'), t('settings.rateError'));
        });
      });
    }
  };

  return (
    <ScrollView contentContainerStyle={styles.container}>
      <View style={styles.head}>
        <Text style={styles.title}>{t('settings.title')}</Text>
        <Text style={styles.desc}>{t('settings.desc')}</Text>
      </View>

      <Section title={t('settings.sectionLang')} icon={<LangIcon />} ss={ss}>
        <Row label={t('settings.language')} desc={t('settings.languageDesc')} ss={ss}>
          <PillGroup<Lang>
            items={langItems}
            value={lang}
            onChange={setLang}
            ss={ss}
          />
        </Row>
      </Section>

      <Section title={t('settings.sectionAudio')} icon={<SoundIcon />} ss={ss}>
        <Row label={t('settings.playbackSpeed')} desc={t('settings.playbackSpeedDesc')} ss={ss}>
          <PillGroup<ListenSpeed>
            items={[{ value: 0.8, label: '×0.8' }, { value: 1.0, label: '×1.0' }, { value: 1.2, label: '×1.2' }, { value: 1.5, label: '×1.5' }]}
            value={s.listenSpeed}
            onChange={s.setListenSpeed}
            ss={ss}
          />
        </Row>
        <Row label={t('settings.nepaliRepeat')} desc={t('settings.nepaliRepeatDesc')} ss={ss}>
          <PillGroup<NepaliRepeat>
            items={[
              { value: 1, label: t('levelScreen.repeat', { n: 1 }) },
              { value: 2, label: t('levelScreen.repeat', { n: 2 }) },
              { value: 3, label: t('levelScreen.repeat', { n: 3 }) },
            ]}
            value={s.nepaliRepeat}
            onChange={s.setNepaliRepeat}
            ss={ss}
          />
        </Row>
        <Row label={t('settings.convDirection')} desc={t('settings.convDirectionDesc')} ss={ss}>
          <PillGroup<Direction>
            items={directionItems}
            value={s.practiceDirection}
            onChange={s.setPracticeDirection}
            ss={ss}
          />
        </Row>
        <Row label={t('settings.listenOrder')} desc={t('settings.listenOrderDesc')} ss={ss}>
          <PillGroup<Direction>
            items={directionItems}
            value={s.listenDirection}
            onChange={s.setListenDirection}
            ss={ss}
          />
        </Row>
        <Row label={t('settings.listenLoop')} desc={t('settings.listenLoopDesc')} ss={ss}>
          <Switch value={s.listenLoop} onValueChange={s.setListenLoop} trackColor={{ false: colors.line, true: colors.ink }} />
        </Row>
        <Row label={t('settings.gap')} desc={t('settings.gapDesc')} ss={ss}>
          <PillGroup<GapMode>
            items={[
              { value: 'short', label: t('settings.gapShort') },
              { value: 'normal', label: t('settings.gapNormal') },
              { value: 'long', label: t('settings.gapLong') },
            ]}
            value={s.gap}
            onChange={s.setGap}
            ss={ss}
          />
        </Row>
      </Section>

      <Section title={t('settings.sectionDisplay')} icon={<EyeIcon />} ss={ss}>
        <Row label={t('settings.romaji')} desc={t('settings.romajiDesc')} ss={ss}>
          <Switch value={s.romaji} onValueChange={s.setRomaji} trackColor={{ false: colors.line, true: colors.ink }} />
        </Row>
        <Row label={t('settings.darkMode')} desc={t('settings.darkModeDesc')} ss={ss}>
          <PillGroup<ThemeMode>
            items={[
              { value: 'light', label: t('settings.themeLight') },
              { value: 'dark', label: t('settings.themeDark') },
              { value: 'system', label: t('settings.themeSystem') },
            ]}
            value={s.themeMode}
            onChange={s.setThemeMode}
            ss={ss}
          />
        </Row>
        <Row label={t('settings.fontSize')} desc={t('settings.fontSizeDesc')} ss={ss}>
          <PillGroup<FontMode>
            items={[
              { value: 'small', label: t('settings.fontSmall') },
              { value: 'medium', label: t('settings.fontMedium') },
              { value: 'large', label: t('settings.fontLarge') },
            ]}
            value={s.fontMode}
            onChange={s.setFontMode}
            ss={ss}
          />
        </Row>
      </Section>

      <Section title={t('settings.sectionLearn')} icon={<CapIcon />} ss={ss}>
        <Row label={t('settings.autoFlip')} desc={t('settings.autoFlipDesc')} ss={ss}>
          <Switch value={s.autoFlip} onValueChange={s.setAutoFlip} trackColor={{ false: colors.line, true: colors.ink }} />
        </Row>
        <Row label={t('settings.shuffle')} desc={t('settings.shuffleDesc')} ss={ss}>
          <Switch value={s.shuffle} onValueChange={s.setShuffle} trackColor={{ false: colors.line, true: colors.ink }} />
        </Row>
      </Section>

      <Section title={t('settings.sectionData')} icon={<DataIcon />} ss={ss}>
        <Row label={t('settings.resetSettings')} desc={t('settings.resetSettingsDesc')} ss={ss}>
          <Pressable style={[styles.btn, styles.btnDanger]} onPress={onReset}>
            <Text style={styles.btnTextDanger}>{t('common.reset')}</Text>
          </Pressable>
        </Row>
      </Section>

      <Section title={t('settings.sectionAbout')} icon={<InfoIcon />} ss={ss}>
        <Row label={t('settings.version')} ss={ss}><Text style={styles.valueText}>{versionDisplay}</Text></Row>
        {canRate && (
          <Row label={t('settings.rateApp')} ss={ss}>
            <Pressable onPress={onRate}><Text style={styles.linkText}>{t('common.open')}</Text></Pressable>
          </Row>
        )}
        <Row label={t('settings.shareApp')} ss={ss}>
          <Pressable style={styles.btn} onPress={onShare}>
            <Text style={styles.btnText}>{t('common.share')}</Text>
          </Pressable>
        </Row>
        <Row label={t('settings.privacy')} ss={ss}>
          <Pressable onPress={onPrivacy}><Text style={styles.linkText}>{t('common.open')}</Text></Pressable>
        </Row>
        <Row label={t('settings.contact')} ss={ss}>
          <Pressable onPress={onContact}><Text style={styles.linkText}>{t('common.mail')}</Text></Pressable>
        </Row>
      </Section>

      <Text style={styles.versionFooter}>{t('app.name')} v{versionDisplay}</Text>
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
