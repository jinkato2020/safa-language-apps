import { useLayoutEffect, useMemo, useState } from 'react';
import { Animated, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { Text } from '../Text';
import { useNavigation, useRoute, type RouteProp } from '@react-navigation/native';
import { useAudioPlayer } from 'expo-audio';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import Svg, { Line, Path, Polyline } from 'react-native-svg';
import { colors, spacing, radius } from '../theme';
import type { RootStackParamList } from '../types';
import { useSettings, useScaleStyle } from '../SettingsContext';
import { useI18n } from '../i18n';
import { useAppData } from '../AppDataContext';
import { getL1 } from '../l1';
import { useCardFlip } from '../useCardFlip';

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

export default function PracticeScreen() {
  const { LEVELS, THEMES, GRAMMAR_THEMES, getExamples, getGrammarExamples, audio, VOCAB, GRAMMAR_VOCAB, CONV_VOCAB, JP_READING, nativeLang, vocabTokenize } = useAppData();
  const { nepaliAudio, japaneseAudio, nepaliGrammarAudio, japaneseGrammarAudio } = audio;
  const l1 = getL1(nativeLang);
  const navigation = useNavigation<Nav>();
  const { t, lang } = useI18n();
  const isJaUI = lang === 'ja';
  // 母語(訳)側UIか＝学習対象(ネパール語)を「単語」列に出す。ja/en=母語UI(App A)。
  // ne/bn UI(App B 等)は逆向き(対象語を単語列・母語を意味列)。
  const glossUI = lang === 'ja' || lang === 'en';
  const { themeId: initialThemeId, levelId: initialLevelId, startIndex, mode } = useRoute<R>().params;
  const isGrammar = mode === 'grammar';

  // テーマを跨いだナビゲーションのため、themeId/levelId/index を state にする
  const [themeId, setThemeId] = useState(initialThemeId);
  const [levelId, setLevelId] = useState<number>(initialLevelId ?? 1);
  const [index, setIndex] = useState(startIndex ?? 0);
  const [revealed, setRevealed] = useState(false);

  const examples = useMemo(
    () => (isGrammar ? getGrammarExamples(themeId) : getExamples(themeId, levelId)),
    // nativeLang(=パック) が変わったら再計算 (言語切替を既存画面にも反映)
    [isGrammar, themeId, levelId, nativeLang],
  );
  const themeName = isGrammar
    ? t(`grammarThemes.${themeId}`)
    : t(`themes.${themeId}`);
  const levelName = isGrammar ? t('practice.grammarLabel') : t(`levels.${levelId}`);

  const { practiceDirection, romaji } = useSettings();
  const ss = useScaleStyle();
  const { flip, animatedStyle } = useCardFlip();

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

  if (!ex) return null;

  const questionText = isJa2Ne ? ex.jp : ex.ne;
  const answerText = isJa2Ne ? ex.ne : ex.jp;

  // 現在表示するテキスト（未反転: 問題側、反転: 答え側）
  const displayText = revealed ? answerText : questionText;
  const displayIsNe = revealed ? isJa2Ne : !isJa2Ne;
  const currentPlayer = revealed ? answerPlayer : questionPlayer;

  // 日本語文の読み補助 (かな+ローマ字)。言語=ネパール語で日本語カード表示時に使用。
  const jpReading = JP_READING?.[ex.jp];

  return (
    <ScrollView contentContainerStyle={styles.container}>
      <View style={styles.metaRow}>
        <Text style={[styles.metaText, ss(12)]}>
          <Text style={styles.metaCur}>{themeId}.</Text> {themeName} · {levelName} · {t('practice.exampleCounter')} <Text style={styles.metaCur}>{index + 1}</Text> / {examples.length}
        </Text>
      </View>

      {/* センテンスカード（タップで言語切り替え・フリップアニメ付き） */}
      <Pressable onPress={() => flip(() => setRevealed(r => !r))}>
        {({ pressed }) => (
          <Animated.View style={[styles.sentenceCard, pressed && styles.sentenceCardPressed, animatedStyle]}>
            <Text style={[styles.cardHint, ss(10)]}>{t('practice.cardHint', { state: revealed ? t('practice.answer') : t('practice.question') })}</Text>
            <Text style={[
              displayIsNe ? styles.neText : styles.jaText,
              ss(displayIsNe ? 30 : 26, displayIsNe ? 44 : 40),
            ]}>{displayText}</Text>
            {/* 学習対象(ネパール語)テキストのローマ字: 母語UI(ja/en)で表示。romanizer を持つ L1 のみ */}
            {displayIsNe && romaji && glossUI && l1.romanizeSentence && (
              <Text style={[styles.romaji, ss(14, 22)]}>
                {isGrammar && l1.romanizeSentenceWithDict
                  ? l1.romanizeSentenceWithDict(ex.ne, (w) => GRAMMAR_VOCAB?.[w]?.rom ?? VOCAB[w]?.rom)
                  : l1.romanizeSentence(ex.ne)}
              </Text>
            )}
            {/* 日本語表示時 & 言語=ネパール語: かな(常時) + ローマ字(ローマ字設定ON) */}
            {!displayIsNe && !isJaUI && jpReading?.kana ? (
              <Text style={[styles.jaKana, ss(15, 23)]}>{jpReading.kana}</Text>
            ) : null}
            {!displayIsNe && !isJaUI && romaji && jpReading?.romaji ? (
              <Text style={[styles.romaji, ss(14, 22)]}>{jpReading.romaji}</Text>
            ) : null}
          </Animated.View>
        )}
      </Pressable>

      {/* 音声ボタン（言語の方向は設定で変更） */}
      <View style={styles.actionRow}>
        <Pressable
          style={({ pressed }) => [styles.actionBtn, pressed && styles.actionBtnPressed]}
          onPress={() => playOnce(currentPlayer)}
        >
          <SpeakerIcon size={17} />
          <Text style={[styles.actionBtnText, ss(13)]}>{t('practice.playAudio')}</Text>
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

      {/* 単語と意味 (全単語を表示)
            日本語 UI: ネパール語 (デーヴァナーガリー) + ローマ字 / 意味=日本語
            ネパール語 UI: 日本語 (各 ne 単語の ja 訳) / 意味=ネパール語  */}
      {(() => {
        // 文法: sentence_id = テーマ-例題 / 会話: テーマ-レベル-例題
        const sentenceId = isGrammar
          ? `${themeId}-${index + 1}`
          : `${themeId}-${levelId}-${index + 1}`;
        const ctxDict = isGrammar ? GRAMMAR_VOCAB : CONV_VOCAB;
        type Item = { word: string; jaTrans: string; rom: string; pos?: string | null; note?: string | null };
        let items: Item[];
        if (vocabTokenize === 'jp') {
          // 日本語(分かち書きなし): 空白分割は使えないため、辞書から この文ID を含む語を集め、
          // 日本語文中の出現位置順に並べる (App B 英語パック=学習対象の日本語を分解)。
          const arr: (Item & { at: number })[] = [];
          for (const [w, e] of Object.entries(ctxDict ?? {})) {
            const c = e.contexts?.find(cc => cc.sentence_id === sentenceId);
            if (!c) continue;
            arr.push({ word: w, jaTrans: c.ja || '', rom: e.rom || '', pos: c.pos, note: c.note, at: ex.jp.indexOf(w) });
          }
          arr.sort((a, b) => (a.at < 0 ? 1e9 : a.at) - (b.at < 0 ? 1e9 : b.at));
          items = arr;
        } else {
          // 既定: L1文(ex.ne)を空白分割。文脈依存辞書 → なければ既存 VOCAB へフォールバック。
          items = tokenize(ex.ne).filter(w => !isPunct(w)).map(word => {
            const gctxEntry = ctxDict?.[word];
            const matchedCtx = gctxEntry?.contexts?.find(c => c.sentence_id === sentenceId) ?? gctxEntry?.contexts?.[0];
            const fallback = VOCAB[word] ?? {};
            return { word, jaTrans: matchedCtx?.ja || fallback.ja || '', rom: gctxEntry?.rom || fallback.rom || '', pos: matchedCtx?.pos, note: matchedCtx?.note };
          });
        }
        return (
          <View style={styles.wordsSection}>
            <View style={styles.wordHeader}>
              <Text style={styles.wordHeaderNum}>#</Text>
              <Text style={styles.wordHeaderLabel}>{t('practice.wordsHeader')}</Text>
              <Text style={styles.wordHeaderLabel}>{t('practice.meaningHeader')}</Text>
            </View>
            {items.map((it, i) => {
              const unknown = !it.jaTrans;
              // 単語列に学習対象、意味列に訳を出す。
              //  App A(target=ネパール語): 母語UI(ja/en)で単語列=ne。
              //  App B(vocabTokenize='jp', target=日本語): 全母語UI(bn/vi/ne/en)で単語列=日本語(it.word)、意味列=母語訳。
              const wordIsTarget = vocabTokenize === 'jp' || glossUI;
              // 単語列が日本語になるのは App B(jp) または App A の ne UI(母語=訳=日本語)。
              const wordIsJa = vocabTokenize === 'jp' || !glossUI;
              const primary = wordIsTarget ? it.word : (it.jaTrans || it.word);
              const primaryRom = wordIsTarget ? it.rom : '';
              const meaning = wordIsTarget ? it.jaTrans : it.word;
              return (
                <View key={i} style={[styles.wordRow, unknown && styles.wordRowUnknown]}>
                  <Text style={styles.wordNum}>{String(i + 1).padStart(2, '0')}</Text>
                  <View style={styles.wordContent}>
                    <Text style={[wordIsJa ? styles.wordJa : styles.wordDeva, ss(16)]}>{primary}</Text>
                    {romaji && primaryRom ? <Text style={[styles.wordRom, ss(11)]}>{primaryRom}</Text> : null}
                  </View>
                  <View style={styles.wordMeaningCol}>
                    <Text style={[styles.wordMeaning, unknown && styles.wordMeaningDim, ss(16)]}>
                      {meaning || t('practice.noDictionary')}
                    </Text>
                    {it.pos ? <Text style={[styles.wordCtxPos, ss(10)]}>{it.pos}</Text> : null}
                    {it.note ? <Text style={[styles.wordCtxNote, ss(10)]}>{it.note}</Text> : null}
                  </View>
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
  container: { padding: spacing.lg, paddingBottom: spacing.xxl, maxWidth: 760, width: '100%', alignSelf: 'center' },
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
  jaKana: { fontSize: 15, lineHeight: 23, color: colors.inkMute, textAlign: 'center', marginTop: spacing.sm },
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
  wordMeaningCol: { flex: 1, gap: 2 },
  wordCtxPos: { fontFamily: 'Courier', fontSize: 10, color: colors.inkQuiet },
  wordCtxNote: { fontSize: 10, color: colors.inkFaint, fontStyle: 'italic' },
  wordRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
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
