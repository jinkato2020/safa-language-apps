import { useLayoutEffect, useMemo, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { Text } from '../Text';
import { useNavigation, useRoute, type RouteProp } from '@react-navigation/native';
import { useAudioPlayer } from 'expo-audio';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import Svg, { Line, Path, Polyline } from 'react-native-svg';
import { colors, spacing, radius } from '../theme';
import type { RootStackParamList } from '../types';
import { LEVELS, THEMES, GRAMMAR_THEMES, getExamples, getGrammarExamples } from '../dataLoader';
import { nepaliAudio, japaneseAudio, nepaliGrammarAudio, japaneseGrammarAudio } from '../../data/audioMap';
import { useSettings, useScaleStyle, type Direction } from '../SettingsContext';
import { useI18n } from '../i18n';
import { sentenceToRomaji } from '../transliterate';
import vocabData from '../../data/vocab.json';

const VOCAB = vocabData as Record<string, { ja: string; rom: string }>;

// 中級・上級で除外する助詞 (postposition) と代名詞 (pronoun)
// 文法構造をすでに知っている学習者向けに、内容語のみを単語リストに残す
const NE_PARTICLES_AND_PRONOUNS = new Set<string>([
  // 助詞・後置詞
  'मा', 'बाट', 'लाई', 'को', 'का', 'की', 'ले', 'सँग', 'सित', 'देखि', 'सम्म',
  'पनि', 'मात्र', 'मात्रै', 'त', 'र', 'अनि', 'तर', 'वा', 'कि', 'भने', 'नै', 'कै',
  // 人称代名詞
  'म', 'तँ', 'तिमी', 'तपाईं', 'ऊ', 'उनी', 'उहाँ',
  'हामी', 'हामीहरू', 'तिमीहरू', 'तपाईंहरू', 'उनीहरू',
  // 指示・疑問代名詞
  'यो', 'त्यो', 'यी', 'ती', 'के', 'कुन', 'कस्तो', 'कहाँ', 'कहिले', 'किन', 'कसरी', 'कति',
  // 所有・反射
  'आफ्नो', 'आफू', 'मेरो', 'मेरा', 'तिम्रो', 'तिम्रा', 'उसको', 'उहाँको',
  'हाम्रो', 'हाम्रा', 'तपाईंको', 'उनको', 'उनीहरूको',
  // 与格代名詞
  'मलाई', 'तिमीलाई', 'तपाईंलाई', 'उसलाई', 'उनलाई', 'हामीलाई', 'उनीहरूलाई',
]);

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
  const { t, lang } = useI18n();
  const isJaUI = lang === 'ja';
  const { themeId: initialThemeId, levelId: initialLevelId, startIndex, mode } = useRoute<R>().params;
  const isGrammar = mode === 'grammar';

  // テーマを跨いだナビゲーションのため、themeId/levelId/index を state にする
  const [themeId, setThemeId] = useState(initialThemeId);
  const [levelId, setLevelId] = useState<number>(initialLevelId ?? 1);
  const [index, setIndex] = useState(startIndex ?? 0);
  const [revealed, setRevealed] = useState(false);

  const examples = useMemo(
    () => (isGrammar ? getGrammarExamples(themeId) : getExamples(themeId, levelId)),
    [isGrammar, themeId, levelId],
  );
  const themeName = isGrammar
    ? t(`grammarThemes.${themeId}`)
    : t(`themes.${themeId}`);
  const levelName = isGrammar ? t('practice.grammarLabel') : t(`levels.${levelId}`);

  const { practiceDirection, setPracticeDirection, romaji } = useSettings();
  const ss = useScaleStyle();

  useLayoutEffect(() => {
    navigation.setOptions({ title: isGrammar ? t('practice.titleGrammar') : t('practice.titleConv') });
  }, [navigation, isGrammar, t]);

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

  // テーマを跨いで次/前へ進む
  const go = (delta: number) => {
    if (delta > 0) {
      // 次へ
      if (index + 1 < examples.length) {
        setIndex(index + 1);
      } else {
        // 次のテーマ（文法は同一系列、会話は同レベル → 次レベル）
        if (isGrammar) {
          for (let t = themeId + 1; t <= GRAMMAR_THEMES.length; t++) {
            if (getGrammarExamples(t).length > 0) {
              setThemeId(t);
              setIndex(0);
              setRevealed(false);
              return;
            }
          }
        } else {
          // 同レベルで次のテーマ
          for (let t = themeId + 1; t <= THEMES.length; t++) {
            if (getExamples(t, levelId).length > 0) {
              setThemeId(t);
              setIndex(0);
              setRevealed(false);
              return;
            }
          }
          // 全テーマ終わり → 次のレベルの先頭テーマへ
          if (levelId < LEVELS.length) {
            for (let t = 1; t <= THEMES.length; t++) {
              if (getExamples(t, levelId + 1).length > 0) {
                setThemeId(t);
                setLevelId(levelId + 1);
                setIndex(0);
                setRevealed(false);
                return;
              }
            }
          }
        }
      }
    } else {
      // 前へ
      if (index > 0) {
        setIndex(index - 1);
      } else {
        // 前のテーマの最終例題
        if (isGrammar) {
          for (let t = themeId - 1; t >= 1; t--) {
            const exs = getGrammarExamples(t);
            if (exs.length > 0) {
              setThemeId(t);
              setIndex(exs.length - 1);
              setRevealed(false);
              return;
            }
          }
        } else {
          for (let t = themeId - 1; t >= 1; t--) {
            const exs = getExamples(t, levelId);
            if (exs.length > 0) {
              setThemeId(t);
              setIndex(exs.length - 1);
              setRevealed(false);
              return;
            }
          }
          // 前のレベルの末尾テーマへ
          if (levelId > 1) {
            for (let t = THEMES.length; t >= 1; t--) {
              const exs = getExamples(t, levelId - 1);
              if (exs.length > 0) {
                setThemeId(t);
                setLevelId(levelId - 1);
                setIndex(exs.length - 1);
                setRevealed(false);
                return;
              }
            }
          }
        }
      }
    }
    setRevealed(false);
  };

  // 端判定（無効化用）
  const atFirst = index === 0 && themeId === 1 && (isGrammar || levelId === 1);
  const atLast = (() => {
    if (index < examples.length - 1) return false;
    if (isGrammar) return themeId >= GRAMMAR_THEMES.length;
    if (themeId < THEMES.length) return false;
    return levelId >= LEVELS.length;
  })();

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
        <Text style={[styles.metaText, ss(12)]}>
          <Text style={styles.metaCur}>{themeId}.</Text> {themeName} · {levelName} · {t('practice.exampleCounter')} <Text style={styles.metaCur}>{index + 1}</Text> / {examples.length}
        </Text>
      </View>

      {/* センテンスカード（タップで言語切り替え） */}
      <Pressable
        style={({ pressed }) => [styles.sentenceCard, pressed && styles.sentenceCardPressed]}
        onPress={() => setRevealed(r => !r)}
      >
        <Text style={[styles.cardHint, ss(10)]}>{t('practice.cardHint', { state: revealed ? t('practice.answer') : t('practice.question') })}</Text>
        <Text style={[
          displayIsNe ? styles.neText : styles.jaText,
          ss(displayIsNe ? 30 : 26, displayIsNe ? 44 : 40),
        ]}>{displayText}</Text>
        {displayIsNe && romaji && (
          <Text style={[styles.romaji, ss(14, 22)]}>{sentenceToRomaji(ex.ne)}</Text>
        )}
      </Pressable>

      {/* 音声＋言語反転ボタン（横並び・中央） */}
      <View style={styles.actionRow}>
        <Pressable
          style={({ pressed }) => [styles.actionBtn, pressed && styles.actionBtnPressed]}
          onPress={() => playOnce(currentPlayer)}
        >
          <SpeakerIcon size={17} />
          <Text style={[styles.actionBtnText, ss(13)]}>{t('practice.playAudio')}</Text>
        </Pressable>
        <Pressable
          style={({ pressed }) => [styles.actionBtn, pressed && styles.actionBtnPressed]}
          onPress={toggleDirection}
        >
          <FlipIcon size={17} />
          <Text style={[styles.actionBtnText, ss(13)]}>{t('practice.flipLang')}</Text>
        </Pressable>
      </View>

      {/* 前へ / 次へ（位置固定、テーマ跨ぎ可能） */}
      <View style={styles.navRow}>
        <Pressable
          style={({ pressed }) => [styles.navBtn, atFirst && styles.navDisabled, pressed && styles.navPressed]}
          disabled={atFirst}
          onPress={() => go(-1)}
        >
          <Text style={[styles.navText, atFirst && styles.navTextDisabled]}>{t('common.prev')}</Text>
        </Pressable>
        <Pressable
          style={({ pressed }) => [styles.navBtn, atLast && styles.navDisabled, pressed && styles.navPressed]}
          disabled={atLast}
          onPress={() => go(1)}
        >
          <Text style={[styles.navText, atLast && styles.navTextDisabled]}>{t('common.next')}</Text>
        </Pressable>
      </View>

      {/* 単語と意味
            会話モード: 中級・上級では助詞・代名詞を除外
            文法モード: フィルタなし (全単語を表示)
            日本語 UI: ネパール語 (デーヴァナーガリー) + ローマ字 / 意味=日本語
            ネパール語 UI: 日本語 (各 ne 単語の ja 訳) / 意味=ネパール語  */}
      {(() => {
        // 会話の中級・上級だけ助詞・代名詞を除外
        const filterParticles = !isGrammar && levelId >= 2;
        const all = tokenize(ex.ne).filter(w => !isPunct(w));
        const tokens = filterParticles ? all.filter(w => !NE_PARTICLES_AND_PRONOUNS.has(w)) : all;
        return (
          <View style={styles.wordsSection}>
            <View style={styles.wordHeader}>
              <Text style={styles.wordHeaderNum}>#</Text>
              <Text style={styles.wordHeaderLabel}>{t('practice.wordsHeader')}</Text>
              <Text style={styles.wordHeaderLabel}>{t('practice.meaningHeader')}</Text>
            </View>
            {tokens.map((word, i) => {
              const info = VOCAB[word] ?? {};
              const jaTrans = info.ja ?? '';
              const neRom = info.rom ?? '';
              const unknown = !jaTrans;
              // UI 言語で主表示／意味を反転（ローマ字は ne→roman のみ持っている）
              const primary = isJaUI ? word : (jaTrans || word);
              const primaryRom = isJaUI ? neRom : '';
              const meaning = isJaUI ? jaTrans : word;
              return (
                <View key={i} style={[styles.wordRow, unknown && styles.wordRowUnknown]}>
                  <Text style={styles.wordNum}>{String(i + 1).padStart(2, '0')}</Text>
                  <View style={styles.wordContent}>
                    {/* 単語と意味のフォントサイズを統一 (16px) */}
                    <Text style={[isJaUI ? styles.wordDeva : styles.wordJa, ss(16)]}>{primary}</Text>
                    {romaji && primaryRom ? <Text style={[styles.wordRom, ss(11)]}>{primaryRom}</Text> : null}
                  </View>
                  <Text style={[styles.wordMeaning, unknown && styles.wordMeaningDim, ss(16)]}>
                    {meaning || t('practice.noDictionary')}
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
  wordJa: { fontSize: 20, fontWeight: '500', color: colors.ink },
  wordRom: { fontFamily: 'Courier', fontSize: 11, color: colors.inkFaint, fontStyle: 'italic' },
  wordMeaning: { flex: 1, fontSize: 13, color: colors.ink },
  wordMeaningDim: { color: colors.inkFaint, fontStyle: 'italic' },
});
