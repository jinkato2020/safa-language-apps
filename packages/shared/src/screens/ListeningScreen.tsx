import { useEffect, useRef } from 'react';
import { Animated, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { Text } from '../Text';
import { useRoute, type RouteProp } from '@react-navigation/native';
import Svg, { Circle, Path, Polygon, Polyline, Rect } from 'react-native-svg';
import { colors, spacing, radius } from '../theme';
import type { RootStackParamList } from '../types';
import { useSettings, useScaleStyle, type ListenSpeed } from '../SettingsContext';
import { useI18n } from '../i18n';
import { useAppData } from '../AppDataContext';
import { getL1 } from '../l1';
import { useListeningAudio } from '../ListeningAudioContext';

type R = RouteProp<RootStackParamList, 'Listening'>;

const SPEEDS: ListenSpeed[] = [0.8, 1.0, 1.2, 1.5];

// ── デジタル音量波 (2言語カードの真下に表示するオーディオ波形) ──
const WAVE_BARS = 26;
const WAVE_MAX_H = 30; // バー最大高さ(px)
// 静止時の波形: 端が低く中央が高い自然な形 (0.18〜1.0)
const WAVE_BASE = Array.from({ length: WAVE_BARS }, (_, i) => {
  const tt = i / (WAVE_BARS - 1);
  const envelope = Math.sin(tt * Math.PI);                 // 端0 → 中央1
  const ripple = 0.55 + 0.45 * Math.abs(Math.sin(tt * Math.PI * 5));
  return Math.max(0.18, envelope * ripple);
});

function WaveBars({ playing }: { playing: boolean }) {
  const anims = useRef(WAVE_BASE.map((b) => new Animated.Value(b))).current;
  useEffect(() => {
    if (!playing) {
      anims.forEach((a, i) => { a.stopAnimation(); a.setValue(WAVE_BASE[i]); });
      return;
    }
    const loops = anims.map((a, i) => {
      const lo = Math.max(0.15, WAVE_BASE[i] * 0.35);
      const hi = Math.min(1, WAVE_BASE[i] * 0.9 + 0.25);
      const dur = 360 + (i % 6) * 90;
      return Animated.loop(Animated.sequence([
        Animated.timing(a, { toValue: hi, duration: dur, useNativeDriver: true }),
        Animated.timing(a, { toValue: lo, duration: dur, useNativeDriver: true }),
      ]));
    });
    loops.forEach((l) => l.start());
    return () => loops.forEach((l) => l.stop());
  }, [playing]);

  return (
    <View style={styles.wave} pointerEvents="none">
      {anims.map((a, i) => (
        <Animated.View key={i} style={[styles.waveBar, { opacity: playing ? 1 : 0.45, transform: [{ scaleY: a }] }]} />
      ))}
    </View>
  );
}

// ── アイコン ──
function PrevIcon({ size = 22 }: { size?: number }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill={colors.ink}>
      <Rect x={5} y={5} width={2.5} height={14} rx={1.25} />
      <Polygon points="20,5 9,12 20,19" />
    </Svg>
  );
}
function NextIcon({ size = 22 }: { size?: number }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill={colors.ink}>
      <Polygon points="4,5 15,12 4,19" />
      <Rect x={16.5} y={5} width={2.5} height={14} rx={1.25} />
    </Svg>
  );
}
function PlayIcon({ size = 30 }: { size?: number }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="#fff">
      <Path d="M8 5.5v13c0 .8.9 1.3 1.6.9l10.5-6.5c.6-.4.6-1.3 0-1.7L9.6 4.6C8.9 4.2 8 4.7 8 5.5z" />
    </Svg>
  );
}
function PauseIcon({ size = 30 }: { size?: number }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="#fff">
      <Rect x={6.5} y={5} width={4} height={14} rx={1.5} />
      <Rect x={13.5} y={5} width={4} height={14} rx={1.5} />
    </Svg>
  );
}

export default function ListeningScreen() {
  const { getExamples, getGrammarExamples, JP_READING, nativeLang } = useAppData();
  const l1 = getL1(nativeLang);
  const route = useRoute<R>();
  const { t, lang } = useI18n();
  const isJaUI = lang === 'ja';
  const {
    listenLoop, setListenLoop,
    listenSpeed, setListenSpeed,
    romaji,
  } = useSettings();
  const ss = useScaleStyle();

  // 音声エンジンは ListeningAudioProvider が保持。画面はその状態を表示し操作を委譲するだけ。
  const {
    active, isGrammarSrc, themeId, levelId, index, playing, activeLang,
    startSession, togglePlay, go,
  } = useListeningAudio();

  // 画面に入ったらセッション開始（同一パラメータなら Provider 側で再接続＝継続）。
  // 戻る/タブ再タップで画面が unmount されても Provider は生存するため音声は止まらない。
  useEffect(() => {
    startSession(route.params);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [route.params.themeId, route.params.levelId, route.params.startIndex, route.params.source]);

  const examples = active
    ? (isGrammarSrc ? getGrammarExamples(themeId) : getExamples(themeId, levelId))
    : [];
  const ex = examples[index];

  const themeName = isGrammarSrc
    ? t(`grammarThemes.${themeId}`)
    : t(`themes.${themeId}`);
  const levelName = isGrammarSrc ? t('practice.grammarLabel') : t(`levels.${levelId}`);

  const cycleSpeed = () => {
    const cur = SPEEDS.indexOf(listenSpeed);
    setListenSpeed(SPEEDS[(cur + 1) % SPEEDS.length]);
  };

  if (!ex) return null;

  // 日本語の読み補助 (かな+ローマ字)。言語=ネパール語のとき日本語カードに表示。
  const reading = JP_READING?.[ex.jp];

  // 日本語カード: 言語=ネパール語(!isJaUI)のとき、かな(常時)+ローマ字(ローマ字設定ON時)を補助表示。
  const jaCard = (
    <View style={[styles.card, activeLang === 'ja' && styles.cardJaActive]}>
      <Text style={[styles.tag, activeLang === 'ja' && styles.tagJaActive, ss(11)]}>{t('listening.tagJa')}</Text>
      <Text style={[styles.textJa, ss(20, 30)]}>{ex.jp}</Text>
      {!isJaUI && reading?.kana ? <Text style={[styles.jaKana, ss(15, 23)]}>{reading.kana}</Text> : null}
      {!isJaUI && romaji && reading?.romaji ? <Text style={[styles.romaji, ss(14, 22)]}>{reading.romaji}</Text> : null}
    </View>
  );

  // ネパール語カード: ローマ字は 言語=日本語(isJaUI) かつ ローマ字設定ON のときだけ表示
  // (ネパール語話者にはネパール語ローマ字は不要なため)。
  const neCard = (
    <View style={[styles.card, activeLang === 'ne' && styles.cardNeActive]}>
      <Text style={[styles.tag, activeLang === 'ne' && styles.tagNeActive, ss(11)]}>{t('listening.tagNe')}</Text>
      <Text style={[styles.textNe, ss(26, 38)]}>{ex.ne}</Text>
      {isJaUI && romaji && l1.romanizeSentence ? <Text style={[styles.romaji, ss(14, 22)]}>{l1.romanizeSentence(ex.ne)}</Text> : null}
    </View>
  );

  return (
    <ScrollView contentContainerStyle={styles.container}>
      <View style={styles.metaRow}>
        <Text style={[styles.metaText, ss(12)]}>
          <Text style={styles.metaCur}>{themeId}.</Text> {themeName} · {levelName} · {t('listening.exampleCounter')} <Text style={styles.metaCur}>{index + 1}</Text> / {examples.length}
        </Text>
      </View>

      {/* UI 言語に応じて表示順を切替: ja UI は日本語が上、ne UI はネパール語が上 */}
      {isJaUI ? <>{jaCard}{neCard}</> : <>{neCard}{jaCard}</>}

      {/* 2言語カードの真下: デジタル音量波 (再生中アニメ) */}
      <WaveBars playing={playing} />

      <View style={styles.controls}>
        <Pressable style={({ pressed }) => [styles.ctrlBtn, pressed && styles.ctrlPressed]} onPress={() => go(-1)} hitSlop={8}>
          <PrevIcon />
        </Pressable>
        <Pressable style={({ pressed }) => [styles.ctrlBtn, styles.ctrlPlay, pressed && styles.ctrlPlayPressed]} onPress={togglePlay} hitSlop={8}>
          {playing ? <PauseIcon /> : <PlayIcon />}
        </Pressable>
        <Pressable style={({ pressed }) => [styles.ctrlBtn, pressed && styles.ctrlPressed]} onPress={() => go(1)} hitSlop={8}>
          <NextIcon />
        </Pressable>
      </View>

      <View style={styles.extras}>
        <Pressable
          style={[styles.pill, listenLoop && styles.pillOn]}
          onPress={() => setListenLoop(!listenLoop)}
        >
          <Svg width={13} height={13} viewBox="0 0 24 24" fill="none" stroke={listenLoop ? '#fff' : colors.inkMute} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
            <Polyline points="17 1 21 5 17 9" />
            <Path d="M3 11V9a4 4 0 0 1 4-4h14" />
            <Polyline points="7 23 3 19 7 15" />
            <Path d="M21 13v2a4 4 0 0 1-4 4H3" />
          </Svg>
          <Text style={[styles.pillText, listenLoop && styles.pillTextOn, ss(12)]}>{t('listening.nonstop')}</Text>
        </Pressable>
        <Pressable style={styles.pill} onPress={cycleSpeed}>
          <Svg width={13} height={13} viewBox="0 0 24 24" fill="none" stroke={colors.inkMute} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
            <Circle cx={12} cy={12} r={10} />
            <Polyline points="12 6 12 12 16 14" />
          </Svg>
          <Text style={[styles.pillText, ss(12)]}>{t('listening.speed', { speed: listenSpeed.toFixed(1) })}</Text>
        </Pressable>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { padding: spacing.lg, paddingBottom: spacing.xxl, maxWidth: 760, width: '100%', alignSelf: 'center' },
  metaRow: { paddingBottom: spacing.md, borderBottomWidth: 1, borderBottomColor: colors.line, marginBottom: spacing.xl },
  metaText: { fontFamily: 'Courier', fontSize: 12, color: colors.inkMute },
  metaCur: { color: colors.ink, fontWeight: '700' },
  card: { backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.line, borderRadius: radius.lg, padding: spacing.lg, marginBottom: spacing.md },
  wave: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', height: WAVE_MAX_H, gap: 3, marginTop: spacing.xs, marginBottom: spacing.lg },
  waveBar: { width: 2, height: WAVE_MAX_H, borderRadius: 1.5, backgroundColor: colors.accentJa },
  cardJaActive: { borderColor: colors.accentJa, shadowColor: colors.accentJa, shadowOpacity: 0.15, shadowRadius: 12, elevation: 4 },
  cardNeActive: { borderColor: colors.accentJa, shadowColor: colors.accentJa, shadowOpacity: 0.15, shadowRadius: 12, elevation: 4 },
  tag: { fontFamily: 'Courier', fontSize: 11, color: colors.inkQuiet, letterSpacing: 1.5, marginBottom: spacing.sm },
  tagJaActive: { color: colors.accentJa, fontWeight: '700' },
  tagNeActive: { color: colors.accentJa, fontWeight: '700' },
  textJa: { fontSize: 20, lineHeight: 30, color: colors.ink },
  jaKana: { fontSize: 15, lineHeight: 23, color: colors.inkMute, marginTop: 6 },
  textNe: { fontSize: 26, lineHeight: 38, color: colors.ink, fontWeight: '600' },
  romaji: { fontFamily: 'Courier', fontSize: 14, color: colors.inkQuiet, fontStyle: 'italic', marginTop: 6, lineHeight: 22 },
  controls: { flexDirection: 'row', justifyContent: 'center', alignItems: 'center', gap: spacing.md, marginTop: spacing.xl },
  ctrlBtn: { width: 56, height: 56, borderRadius: 28, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.line, alignItems: 'center', justifyContent: 'center' },
  ctrlPressed: { backgroundColor: colors.bgSoft, borderColor: colors.ink },
  ctrlPlay: { width: 78, height: 78, borderRadius: 39, backgroundColor: colors.ink, borderColor: colors.ink },
  ctrlPlayPressed: { backgroundColor: colors.inkSoft },
  extras: { flexDirection: 'row', justifyContent: 'center', gap: spacing.sm, marginTop: spacing.lg, flexWrap: 'wrap' },
  pill: { flexDirection: 'row', alignItems: 'center', gap: 5, paddingHorizontal: spacing.md, paddingVertical: 8, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.line, borderRadius: 99 },
  pillOn: { backgroundColor: colors.ink, borderColor: colors.ink },
  pillText: { fontSize: 12, color: colors.inkMute, fontWeight: '500' },
  pillTextOn: { color: '#fff' },
});
