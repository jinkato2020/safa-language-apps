import { useLayoutEffect, useMemo, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useNavigation, useRoute, type RouteProp } from '@react-navigation/native';
import { useAudioPlayer } from 'expo-audio';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import Svg, { Line, Path, Polyline } from 'react-native-svg';
import { colors, spacing, radius } from '../theme';
import type { RootStackParamList } from '../types';
import { LEVELS, THEMES, GRAMMAR_THEMES, getExamples, getGrammarExamples } from '../dataLoader';
import { nepaliAudio, japaneseAudio, nepaliGrammarAudio, japaneseGrammarAudio } from '../../data/audioMap';
import { useSettings, type Direction } from '../SettingsContext';
import { sentenceToRomaji } from '../transliterate';
import vocabData from '../../data/vocab.json';

const VOCAB = vocabData as Record<string, { ja: string; rom: string }>;

function tokenize(text: string): string[] {
  return text
    .replace(/([।॥?!,;:"'"'（）()「」『』])/g, ' $1 ')
    .split(/\s+/)
    .map(w => w.trim())
    .filter(w => w.length > 0);
}
function isPunct(w: string): boolean {
  return /^[।॥?!,;:"'"'（）()「」『』]+$/.test(w);
}

type Nav = NativeStackNavigationProp<RootStackParamList, 'Practice'>;
type R = RouteProp<RootStackParamList, 'Practice'>;

// モノクロ SVG アイコン
function SpeakerIcon({ size = 18 }: { size?: number }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={colors.inkMute} strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round">
      <Polyline points="11 5 6 9 2 9 2 15 6 15 11 19 11 5" />
      <Path d="M15.54 8.46a5 5 0 0 1 0 7.07" />
    </Svg>
  );
}

function FlipIcon({ size = 18 }: { size?: number }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={colors.inkMute} strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round">
      <Path d="M1 4v6h6" />
      <Path d="M23 20v-6h-6" />
      <Path d="M20.49 9A9 9 0 0 0 5.64 5.64L1 10m22 4-4.64 4.36A9 9 0 0 1 3.51 15" />
    </Svg>
  );
}

export default function PracticeScreen() {
  const navigation = useNavigation<Nav>();
  const { themeId, levelId, startIndex, mode } = useRoute<R>().params;
  const isGrammar = mode === 'grammar';
  const examples = useMemo(
    () => (isGrammar ? getGrammarExamples(themeId) : getExamples(themeId, levelId ?? 1)),
    [isGrammar, themeId, levelId],
  );
  const themeName = isGrammar
    ? GRAMMAR_THEMES.find(t => t.id === themeId)?.name ?? ''
    : THEMES.find(t => t.id === themeId)?.name ?? '';
  const levelName = isGrammar ? '文法' : LEVELS.find(l => l.id === levelId)?.name ?? '';

  const { practiceDirection, setPracticeDirection, romaji } = useSettings();
  const [index, setIndex] = useState(startIndex ?? 0);
  const [revealed, setRevealed] = useState(false);

  useLayoutEffect(() => {
    navigation.setOptions({ title: isGrammar ? '文法練習' : '会話練習' });
  }, [navigation, isGrammar]);

  const ex = examples[index];
  const isJa2Ne = practiceDirection === 'ja2ne';
  const audioKey = isGrammar
    ? `${themeId}-${index + 1}`
    : `${themeId}-${levelId}-${index + 1}`;

  // 問題側音声プレイヤー / 答え側音声プレイヤー
  const neSrc = isGrammar ? nepaliGrammarAudio[audioKey] : nepaliAudio[audioKey];
  const jaSrc = isGrammar ? japaneseGrammarAudio[audioKey] : japaneseAudio[audioKey];
  const questionAudioSrc = isJa2Ne ? jaSrc : neSrc;
  const answerAudioSrc = isJa2Ne ? neSrc : jaSrc;
  const questionPlayer = useAudioPlayer(questionAudioSrc);
  const answerPlayer = useAudioPlayer(answerAudioSrc);

  const playOnce = (player: ReturnType<typeof useAudioPlayer>) => {
    try {
      player.seekTo(0);
      player.play();
    } catch {}
  };

  const go = (delta: number) => {
    const next = index + delta;
    if (next < 0 || next >= examples.length) return;
    setIndex(next);
    setRevealed(false);
  };

  const toggleDirection = () => {
    const next: Direction = practiceDirection === 'ja2ne' ? 'ne2ja' : 'ja2ne';
    setPracticeDirection(next);
    setRevealed(false);
  };

  if (!ex) return null;

  const questionText = isJa2Ne ? ex.jp : ex.ne;
  const answerText = isJa2Ne ? ex.ne : ex.jp;

  // 現在表示するテキスト（未反転: 問題側、反転: 答え側）
  const displayText = revealed ? answerText : questionText;
  const displayIsNe = revealed ? isJa2Ne : !isJa2Ne;
  const currentPlayer = revealed ? answerPlayer : questionPlayer;

  return (
    <ScrollView contentContainerStyle={styles.container}>
      <View style={styles.metaRow}>
        <Text style={styles.metaText}>
          {themeName} · {levelName} · 例題 <Text style={styles.metaCur}>{index + 1}</Text> / {examples.length}
        </Text>
      </View>

      {/* センテンスカード（タップで言語切り替え） */}
      <Pressable
        style={({ pressed }) => [styles.sentenceCard, pressed && styles.sentenceCardPressed]}
        onPress={() => setRevealed(r => !r)}
      >
        <Text style={styles.cardHint}>{revealed ? '答え' : '問題'} · タップで切り替え</Text>
        <Text style={displayIsNe ? styles.neText : styles.jaText}>{displayText}</Text>
        {displayIsNe && romaji && (
          <Text style={styles.romaji}>{sentenceToRomaji(ex.ne)}</Text>
        )}
      </Pressable>

      {/* 音声＋言語反転ボタン（横並び・中央） */}
      <View style={styles.actionRow}>
        <Pressable
          style={({ pressed }) => [styles.actionBtn, pressed && styles.actionBtnPressed]}
          onPress={() => playOnce(currentPlayer)}
        >
          <SpeakerIcon size={17} />
          <Text style={styles.actionBtnText}>音声を再生</Text>
        </Pressable>
        <Pressable
          style={({ pressed }) => [styles.actionBtn, pressed && styles.actionBtnPressed]}
          onPress={toggleDirection}
        >
          <FlipIcon size={17} />
          <Text style={styles.actionBtnText}>言語反転</Text>
        </Pressable>
      </View>

      {/* 前へ / 番号 / 次へ */}
      <View style={styles.navRow}>
        <Pressable
          style={({ pressed }) => [styles.navBtn, index === 0 && styles.navDisabled, pressed && styles.navPressed]}
          disabled={index === 0}
          onPress={() => go(-1)}
        >
          <Text style={[styles.navText, index === 0 && styles.navTextDisabled]}>← 前へ</Text>
        </Pressable>
        <Text style={styles.navCount}>{index + 1} / {examples.length}</Text>
        <Pressable
          style={({ pressed }) => [styles.navBtn, index >= examples.length - 1 && styles.navDisabled, pressed && styles.navPressed]}
          disabled={index >= examples.length - 1}
          onPress={() => go(1)}
        >
          <Text style={[styles.navText, index >= examples.length - 1 && styles.navTextDisabled]}>次へ →</Text>
        </Pressable>
      </View>

      {/* 単語と意味 */}
      {(() => {
        const tokens = tokenize(ex.ne).filter(w => !isPunct(w));
        return (
          <View style={styles.wordsSection}>
            <View style={styles.wordHeader}>
              <Text style={styles.wordHeaderNum}>#</Text>
              <Text style={styles.wordHeaderLabel}>単語</Text>
              <Text style={styles.wordHeaderLabel}>意味</Text>
            </View>
            {tokens.map((word, i) => {
              const info = VOCAB[word] ?? {};
              const meaning = info.ja ?? '';
              const wordRom = info.rom ?? '';
              const unknown = !meaning;
              return (
                <View key={i} style={[styles.wordRow, unknown && styles.wordRowUnknown]}>
                  <Text style={styles.wordNum}>{String(i + 1).padStart(2, '0')}</Text>
                  <View style={styles.wordContent}>
                    <Text style={styles.wordDeva}>{word}</Text>
                    {romaji && wordRom ? <Text style={styles.wordRom}>{wordRom}</Text> : null}
                  </View>
                  <Text style={[styles.wordMeaning, unknown && styles.wordMeaningDim]}>
                    {meaning || '(辞書未登録)'}
                  </Text>
                </View>
              );
            })}
          </View>
        );
      })()}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { padding: spacing.lg, paddingBottom: spacing.xxl },
  metaRow: { paddingBottom: spacing.md, borderBottomWidth: 1, borderBottomColor: colors.line, marginBottom: spacing.lg },
  metaText: { fontFamily: 'Courier', fontSize: 12, color: colors.inkMute },
  metaCur: { color: colors.ink, fontWeight: '700' },

  // センテンスカード
  sentenceCard: {
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.line,
    borderRadius: radius.lg,
    padding: spacing.lg,
    minHeight: 180,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.lg,
  },
  sentenceCardPressed: { backgroundColor: colors.bgSoft },
  cardHint: { fontFamily: 'Courier', fontSize: 10, color: colors.inkFaint, letterSpacing: 1.5, marginBottom: spacing.md },
  jaText: { fontSize: 26, lineHeight: 40, color: colors.ink, textAlign: 'center', fontWeight: '400' },
  neText: { fontSize: 30, lineHeight: 44, color: colors.ink, textAlign: 'center', fontWeight: '600' },
  romaji: { fontFamily: 'Courier', fontSize: 14, color: colors.inkQuiet, fontStyle: 'italic', textAlign: 'center', marginTop: spacing.sm, lineHeight: 22 },

  // 音声＋言語反転ボタン行
  actionRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: spacing.md,
    marginBottom: spacing.lg,
  },
  actionBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.line,
    paddingHorizontal: spacing.md,
    paddingVertical: 10,
    borderRadius: radius.sm,
  },
  actionBtnPressed: { backgroundColor: colors.bgSoft, borderColor: colors.ink },
  actionBtnText: { fontSize: 13, color: colors.inkMute, fontWeight: '500' },

  // 前へ/番号/次へ
  navRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
    paddingTop: spacing.md,
    borderTopWidth: 1,
    borderTopColor: colors.line,
  },
  navBtn: {
    flex: 1,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.line,
    paddingVertical: spacing.md,
    borderRadius: radius.md,
    alignItems: 'center',
  },
  navPressed: { backgroundColor: colors.ink, borderColor: colors.ink },
  navDisabled: { opacity: 0.35 },
  navText: { fontSize: 14, fontWeight: '500', color: colors.ink },
  navTextDisabled: { color: colors.inkFaint },
  navCount: { fontFamily: 'Courier', fontSize: 13, color: colors.inkMute, fontWeight: '700', minWidth: 56, textAlign: 'center' },

  // 単語リスト
  wordsSection: { marginTop: spacing.xl },
  wordHeader: {
    flexDirection: 'row',
    paddingBottom: spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: colors.line,
  },
  wordHeaderNum: { fontFamily: 'Courier', fontSize: 10, color: colors.inkFaint, width: 32, letterSpacing: 1 },
  wordHeaderLabel: { flex: 1, fontFamily: 'Courier', fontSize: 10, color: colors.inkFaint, letterSpacing: 1 },
  wordRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: colors.line,
  },
  wordRowUnknown: { opacity: 0.45 },
  wordNum: { fontFamily: 'Courier', fontSize: 12, color: colors.inkQuiet, width: 32 },
  wordContent: { flex: 1, gap: 3 },
  wordDeva: { fontSize: 20, fontWeight: '500', color: colors.ink },
  wordRom: { fontFamily: 'Courier', fontSize: 11, color: colors.inkFaint, fontStyle: 'italic' },
  wordMeaning: { flex: 1, fontSize: 13, color: colors.ink },
  wordMeaningDim: { color: colors.inkFaint, fontStyle: 'italic' },
});
