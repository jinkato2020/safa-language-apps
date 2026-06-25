// 共有「辞書」スクリーン (App B 個人版の辞書タブ)。
// JLPTアプリで構築しシリーズへ同期される共有辞書(ja-vocab / ja-kanji)を引く汎用辞書。
//  - 語彙: 日本語(語/読み)でも英語(意味)でも検索可。レベル(N5〜N1)で絞り込み。
//  - 漢字: 語に含まれる漢字の音訓・意味・画数を展開表示。
// データはアプリ固有(各 expo-app/data/dict)なので props で注入する(shared にバンドルしない)。
// 出典表示義務(EDRDG / 日本語WordNet)を画面下部に明記。
import { useDeferredValue, useMemo, useState } from 'react';
import { FlatList, Pressable, ScrollView, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Text } from '../Text';
import { useI18n } from '../i18n';
import { useTokens } from '../design';

export interface DictVocab {
  word: string;
  reading: string;
  level: string;        // N5..N1
  gloss: string;        // 代表訳(英語)
  senses: string[];     // 語義(英語)
  pos: string[];        // 品詞タグ
  pri?: string[];       // 頻度タグ(news1/ichi1 等)
}
export interface DictKanji {
  char: string;
  on: string[];
  kun: string[];
  meanings: string[];
  grade?: number;
  strokes?: number;
  freq?: number;
}
// 漢字の音/訓 例語(複数読み・頻度順)。reading=その音訓, word=例語, wordReading=例語の読み。
export interface KanjiReadingEx { reading: string; word: string; wordReading: string; }
export interface DictData {
  vocab: DictVocab[];
  kanji: DictKanji[];
  synonyms?: Record<string, string>;
  examples?: Record<string, { ja: string; en: string }>;              // "語|読み" → 例文(まいにちJLPT同期)
  kanjiExamples?: Record<string, { on?: KanjiReadingEx[]; kun?: KanjiReadingEx[] }>; // 漢字 → 音訓の例語
}

// 音/訓 例語を「読み：語（読み）」で連結(語の読みが見出し読みと同じなら省略)。
function fmtKanjiEx(list: KanjiReadingEx[]): string {
  return list.map((e) => (e.wordReading && e.wordReading !== e.reading ? `${e.reading}：${e.word}（${e.wordReading}）` : `${e.reading}：${e.word}`)).join('　');
}

const LEVELS = ['all', 'N5', 'N4', 'N3', 'N2', 'N1'];
const RESULT_LIMIT = 100;
const JP_RE = /[぀-ヿ㐀-鿿々〆ヶ]/; // かな・漢字・々〆ヶ
const KANJI_RE = /[㐀-鿿々]/;                       // 漢字・々

export default function DictScreen({ data }: { data?: DictData }) {
  const { t } = useI18n();
  const { colors, spacing, radius, fontSize } = useTokens();
  const [query, setQuery] = useState('');
  const [level, setLevel] = useState('all');
  const [open, setOpen] = useState<Record<string, boolean>>({});
  const q = useDeferredValue(query); // 入力中の重い再計算をデファー

  const vocab = data?.vocab ?? [];
  const examples = data?.examples;
  const kanjiExamples = data?.kanjiExamples;
  const kanjiMap = useMemo(() => {
    const m: Record<string, DictKanji> = {};
    for (const k of data?.kanji ?? []) m[k.char] = k;
    return m;
  }, [data]);

  const { rows, total } = useMemo(() => {
    const term = q.trim();
    const byLevel = level === 'all' ? vocab : vocab.filter((e) => e.level === level);
    // 空クエリ: レベル選択時はそのレベルを一覧(ブラウズ)、全件のときはヒント表示(返さない)。
    if (!term) {
      if (level === 'all') return { rows: [] as DictVocab[], total: 0 };
      return { rows: byLevel.slice(0, RESULT_LIMIT), total: byLevel.length };
    }
    const isJp = JP_RE.test(term);
    const lc = term.toLowerCase();
    const wordRe = isJp ? null : new RegExp(`\\b${lc.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b`);
    const scored: { e: DictVocab; s: number }[] = [];
    for (const e of byLevel) {
      let s = -1;
      if (isJp) {
        if (e.word === term) s = 0;
        else if (e.reading === term) s = 1;
        else if (e.word.startsWith(term)) s = 2;
        else if (e.reading.startsWith(term)) s = 3;
        else if (e.word.includes(term)) s = 4;
        else if (e.reading.includes(term)) s = 5;
      } else {
        const g = e.gloss.toLowerCase();
        if (g === lc) s = 0;
        else if (g.startsWith(lc)) s = 1;
        else if (wordRe!.test(g)) s = 2;
        else if (g.includes(lc)) s = 3;
        else if (e.senses.some((x) => x.toLowerCase().includes(lc))) s = 4;
      }
      if (s >= 0) scored.push({ e, s });
    }
    scored.sort((a, b) => (a.s - b.s) || (a.e.word.length - b.e.word.length));
    return { rows: scored.slice(0, RESULT_LIMIT).map((x) => x.e), total: scored.length };
  }, [q, level, vocab]);

  const keyOf = (e: DictVocab) => `${e.word}${e.reading}`;

  const renderItem = ({ item }: { item: DictVocab }) => {
    const k = keyOf(item);
    const isOpen = !!open[k];
    const kanjiChars = isOpen
      ? Array.from(new Set(item.word.split('').filter((c) => KANJI_RE.test(c) && kanjiMap[c])))
      : [];
    return (
      <Pressable
        onPress={() => setOpen((o) => ({ ...o, [k]: !o[k] }))}
        style={{ backgroundColor: colors.surface, borderColor: colors.line, borderWidth: 1, borderRadius: radius.md, padding: spacing.md, marginBottom: spacing.sm }}
      >
        <View style={{ flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between' }}>
          <View style={{ flex: 1, paddingRight: spacing.sm }}>
            <View style={{ flexDirection: 'row', alignItems: 'baseline', flexWrap: 'wrap' }}>
              <Text style={{ fontSize: fontSize.h1, fontWeight: '700', color: colors.ink }}>{item.word}</Text>
              {item.reading && item.reading !== item.word ? (
                <Text style={{ fontSize: fontSize.body, color: colors.mute, marginLeft: spacing.sm }}>{item.reading}</Text>
              ) : null}
            </View>
            <Text style={{ fontSize: fontSize.body, color: colors.ink2, marginTop: 2 }} numberOfLines={isOpen ? undefined : 1}>
              {item.gloss}
            </Text>
          </View>
          <View style={{ paddingHorizontal: spacing.sm, paddingVertical: 2, borderRadius: radius.pill, backgroundColor: colors.primaryLight }}>
            <Text style={{ fontSize: fontSize.tiny, fontWeight: '800', color: colors.primaryDark }}>{item.level}</Text>
          </View>
        </View>

        {isOpen && (
          <View style={{ marginTop: spacing.sm }}>
            {item.pos?.length ? (
              <View style={{ flexDirection: 'row', flexWrap: 'wrap', marginBottom: spacing.xs }}>
                {item.pos.map((p) => (
                  <Text key={p} style={{ fontSize: fontSize.tiny, color: colors.mute, backgroundColor: colors.bgSoft, borderRadius: radius.sm, paddingHorizontal: 6, paddingVertical: 1, marginRight: 6, marginBottom: 4 }}>{p}</Text>
                ))}
              </View>
            ) : null}
            {item.senses?.length > 1 && (
              <View style={{ marginBottom: spacing.xs }}>
                {item.senses.map((s, i) => (
                  <Text key={i} style={{ fontSize: fontSize.small, color: colors.ink2, lineHeight: 20 }}>{`${i + 1}. ${s}`}</Text>
                ))}
              </View>
            )}
            {(() => {
              const ex = examples?.[`${item.word}|${item.reading}`];
              if (!ex) return null;
              const parts = ex.ja.split(item.word);
              return (
                <View style={{ marginBottom: spacing.xs }}>
                  <Text style={{ fontSize: fontSize.body, color: colors.ink, lineHeight: 22 }}>
                    {parts.map((p, i) => (
                      <Text key={i}>
                        {p}
                        {i < parts.length - 1 ? <Text style={{ textDecorationLine: 'underline', fontWeight: '700' }}>{item.word}</Text> : null}
                      </Text>
                    ))}
                  </Text>
                  {ex.en ? <Text style={{ fontSize: fontSize.tiny, color: colors.faint, fontStyle: 'italic', marginTop: 1 }}>{ex.en}</Text> : null}
                </View>
              );
            })()}
            {kanjiChars.length > 0 && (
              <View style={{ marginTop: spacing.xs, borderTopWidth: 1, borderTopColor: colors.line, paddingTop: spacing.sm }}>
                <Text style={{ fontSize: fontSize.tiny, fontWeight: '800', color: colors.mute, marginBottom: spacing.xs }}>{t('dict.kanji')}</Text>
                {kanjiChars.map((c) => {
                  const kj = kanjiMap[c];
                  const kex = kanjiExamples?.[c];
                  return (
                    <View key={c} style={{ flexDirection: 'row', marginBottom: spacing.xs }}>
                      <Text style={{ fontSize: fontSize.h2, fontWeight: '700', color: colors.ink, width: 30 }}>{c}</Text>
                      <View style={{ flex: 1 }}>
                        <Text style={{ fontSize: fontSize.small, color: colors.ink2 }}>
                          {[kj.meanings.slice(0, 5).join(', '), kj.strokes ? `${kj.strokes}画` : ''].filter(Boolean).join('　')}
                        </Text>
                        {kex?.on?.length || kex?.kun?.length ? (
                          <>
                            {kex.on?.length ? <Text style={{ fontSize: fontSize.tiny, color: colors.mute, marginTop: 1 }}>音 {fmtKanjiEx(kex.on)}</Text> : null}
                            {kex.kun?.length ? <Text style={{ fontSize: fontSize.tiny, color: colors.mute, marginTop: 1 }}>訓 {fmtKanjiEx(kex.kun)}</Text> : null}
                          </>
                        ) : (
                          <Text style={{ fontSize: fontSize.tiny, color: colors.mute, marginTop: 1 }}>
                            {[kj.on?.length ? `音 ${kj.on.join('・')}` : '', kj.kun?.length ? `訓 ${kj.kun.join('・')}` : ''].filter(Boolean).join('　')}
                          </Text>
                        )}
                      </View>
                    </View>
                  );
                })}
              </View>
            )}
          </View>
        )}
      </Pressable>
    );
  };

  const showHint = !q.trim() && level === 'all';
  const showNoResults = !showHint && rows.length === 0;

  return (
    <SafeAreaView edges={['top']} style={{ flex: 1, backgroundColor: colors.bg }}>
      <View style={{ paddingHorizontal: spacing.lg, paddingTop: spacing.md }}>
        <Text style={{ fontSize: fontSize.h1, fontWeight: '800', color: colors.ink, marginBottom: spacing.sm }}>{t('nav.dict')}</Text>
        <TextInput
          value={query}
          onChangeText={setQuery}
          placeholder={t('dict.searchPlaceholder')}
          placeholderTextColor={colors.faint}
          autoCorrect={false}
          autoCapitalize="none"
          clearButtonMode="while-editing"
          style={{ backgroundColor: colors.surface, borderColor: colors.line, borderWidth: 1, borderRadius: radius.md, paddingHorizontal: spacing.md, paddingVertical: 10, fontSize: fontSize.body, color: colors.ink }}
        />
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginTop: spacing.sm }} contentContainerStyle={{ paddingVertical: spacing.xs }}>
          {LEVELS.map((lv) => {
            const active = lv === level;
            return (
              <Pressable
                key={lv}
                onPress={() => setLevel(lv)}
                style={{ paddingHorizontal: spacing.md, paddingVertical: 6, borderRadius: radius.pill, marginRight: spacing.sm, backgroundColor: active ? colors.primary : colors.bgSoft, borderWidth: 1, borderColor: active ? colors.primary : colors.line }}
              >
                <Text style={{ fontSize: fontSize.small, fontWeight: '700', color: active ? colors.onPrimary : colors.ink2 }}>{lv === 'all' ? t('dict.all') : lv}</Text>
              </Pressable>
            );
          })}
        </ScrollView>
        {!showHint && total > rows.length ? (
          <Text style={{ fontSize: fontSize.tiny, color: colors.mute, marginTop: spacing.xs }}>{t('dict.tooMany').replace('{n}', String(rows.length))}</Text>
        ) : null}
      </View>

      {showHint ? (
        <ScrollView contentContainerStyle={{ padding: spacing.lg, flexGrow: 1, justifyContent: 'center' }}>
          <Text style={{ fontSize: fontSize.body, color: colors.mute, textAlign: 'center', lineHeight: 22 }}>{t('dict.hint')}</Text>
          <Text style={{ fontSize: fontSize.tiny, color: colors.faint, textAlign: 'center', marginTop: spacing.md }}>{t('dict.count').replace('{n}', vocab.length.toLocaleString())}</Text>
        </ScrollView>
      ) : showNoResults ? (
        <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', padding: spacing.lg }}>
          <Text style={{ fontSize: fontSize.body, color: colors.mute, textAlign: 'center' }}>{t('dict.noResults')}</Text>
        </View>
      ) : (
        <FlatList
          data={rows}
          keyExtractor={keyOf}
          renderItem={renderItem}
          contentContainerStyle={{ paddingHorizontal: spacing.lg, paddingTop: spacing.sm, paddingBottom: spacing.xl }}
          keyboardShouldPersistTaps="handled"
          keyboardDismissMode="on-drag"
          initialNumToRender={12}
          windowSize={8}
          removeClippedSubviews
        />
      )}

      <View style={{ paddingHorizontal: spacing.lg, paddingVertical: spacing.xs, borderTopWidth: 1, borderTopColor: colors.line }}>
        <Text style={{ fontSize: fontSize.tiny, color: colors.faint, textAlign: 'center' }} numberOfLines={2}>{t('dict.attribution')}</Text>
      </View>
    </SafeAreaView>
  );
}
