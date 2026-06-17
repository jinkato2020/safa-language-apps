// ポスター音声学習: ポスター画像を表示し、各カードをハイライトしながら
//  母語→日本語 の順で音声を連続再生する。
//  - 画像/音声は現在の母語(useI18n)で自動切替(imageL1 / card.l1)
//  - 下部ドックに「現在カードの拡大(ポスターを余白付きで切り抜き拡大)」を表示
//  - 拡大カードをタップで再生/停止。横スワイプで前/次テーマへ移動
import React, { useEffect, useRef, useState } from 'react';
import { View, Text, Image, ScrollView, Pressable, useWindowDimensions, StyleSheet } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { useAudioPlayer } from 'expo-audio';
import Svg, { Path } from 'react-native-svg';
import { colors, spacing, radius } from '../theme';
import { usePosterLessons } from '../PosterContext';
import { useI18n } from '../i18n';
import { useHorizontalSwipe } from '../useHorizontalSwipe';

const GOLD = '#b08746';
const LANG_LABEL: Record<string, string> = { ja: '日本語', bn: 'বাংলা', en: 'English', ne: 'नेपाली', vi: 'Tiếng Việt', zh: '中文' };

export default function PosterAudioScreen({ route }: any) {
  const { lessonId } = route.params || {};
  const lessons = usePosterLessons();
  const navigation = useNavigation<any>();
  const { lang } = useI18n();
  const { width } = useWindowDimensions();

  const li = Math.max(0, lessons.findIndex(l => l.id === lessonId));
  const lesson = lessons[li] || lessons[0];

  const pickByLang = (m?: Record<string, number>) => (m ? (m[lang] ?? m.en ?? Object.values(m)[0]) : undefined);
  const lessonImage = pickByLang(lesson?.imageL1) ?? lesson?.image;
  const l1AudioOf = (c: any) => pickByLang(c?.l1) ?? c?.ne;
  const l1Label = LANG_LABEL[lang] || lang;

  const player = useAudioPlayer();
  const scrollRef = useRef<ScrollView>(null);
  const [idx, setIdx] = useState(0);       // 表示中カード(初期=最初のカード)
  const [phase, setPhase] = useState<'ja' | 'l1'>('l1');  // 母語→日本語の順
  const [playing, setPlaying] = useState(false);

  const ref = useRef({ idx, phase, playing });
  ref.current = { idx, phase, playing };
  const genRef = useRef(0);
  const pendRef = useRef({ gen: 0, started: true });
  const wdRef = useRef<any>(null);
  const advanceRef = useRef<(g: number) => void>(() => {});

  const PAD = spacing.lg;
  const dispW = width - PAD * 2;
  const scale = lesson ? dispW / lesson.posterW : 1;
  const dispH = lesson ? lesson.posterH * scale : 0;

  // テーマ移動でリセット(最初のカードを表示・停止)
  useEffect(() => {
    setPlaying(false); setIdx(0); setPhase('l1');
    if (wdRef.current) clearTimeout(wdRef.current);
    try { player.pause(); } catch {}
    scrollRef.current?.scrollTo({ y: 0, animated: false });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [lessonId]);

  const playCard = (i: number, ph: 'ja' | 'l1') => {
    if (!lesson) return;
    const card = lesson.cards[i];
    if (!card) return;
    genRef.current += 1;
    const my = genRef.current;
    pendRef.current = { gen: my, started: false };
    setIdx(i); setPhase(ph);
    const src = ph === 'ja' ? card.ja : l1AudioOf(card);
    try { player.replace(src); player.play(); } catch {}   // 楽観再生。実際に鳴ったかは listener で確認
    if (wdRef.current) clearTimeout(wdRef.current);
    wdRef.current = setTimeout(() => advanceRef.current(my), 9000);
  };

  // タイトル朗読(idx=-1)。母語→日本語の順に再生し、その後カード0へ。
  const playTitle = (ph: 'ja' | 'l1') => {
    if (!lesson?.titleAudio) { playCard(0, ph); return; }
    genRef.current += 1;
    const my = genRef.current;
    pendRef.current = { gen: my, started: false };
    setIdx(-1); setPhase(ph);
    const src = ph === 'ja' ? lesson.titleAudio.ja : (pickByLang(lesson.titleAudio.l1) ?? lesson.titleAudio.ja);
    try { player.replace(src); player.play(); } catch {}
    if (wdRef.current) clearTimeout(wdRef.current);
    wdRef.current = setTimeout(() => advanceRef.current(my), 9000);
  };

  advanceRef.current = (g: number) => {
    if (g !== genRef.current || !ref.current.playing || !lesson) return;
    const { idx: ci, phase: cp } = ref.current;
    if (ci === -1) { if (cp === 'l1') playTitle('ja'); else playCard(0, 'l1'); return; }  // タイトル中
    if (cp === 'l1') { playCard(ci, 'ja'); }
    else {
      const ni = ci + 1;
      if (ni < lesson.cards.length) playCard(ni, 'l1');
      else { if (wdRef.current) clearTimeout(wdRef.current); setPlaying(false); }  // 終端: 停止
    }
  };

  useEffect(() => {
    const sub = player.addListener('playbackStatusUpdate', (st: any) => {
      if (st?.isLoaded && pendRef.current.gen === genRef.current) {
        if (st.playing) pendRef.current.started = true;                 // 実際に鳴ったと確認
        else if (!pendRef.current.started && ref.current.playing) {     // ロード済なのに無音→再試行
          try { player.play(); } catch {}
        }
      }
      // 再生位置で終端を正確に検知(末尾0.25s padの手前)→ 9s待ちやpad間延びを排除。
      // didJustFinish も保険に。いずれも「実際に鳴った(started)」クリップにのみ適用。
      const nearEnd = st?.isLoaded && st?.duration > 0.3 && st?.currentTime >= st.duration - 0.18;
      if ((st?.didJustFinish || nearEnd) && pendRef.current.started) advanceRef.current(genRef.current);
    });
    return () => sub.remove();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const start = (from = 0) => { setPlaying(true); if (from === 0 && lesson?.titleAudio) playTitle('l1'); else playCard(from, 'l1'); };
  const stop = () => { setPlaying(false); player.pause(); if (wdRef.current) clearTimeout(wdRef.current); };
  const toggle = () => { if (playing) stop(); else start(idx >= 0 ? idx : 0); };

  const goTheme = (d: number) => {
    if (lessons.length < 2) return;
    const ni = (li + d + lessons.length) % lessons.length;
    navigation.setParams({ lessonId: lessons[ni].id });
  };
  const swipe = useHorizontalSwipe(() => goTheme(1), () => goTheme(-1));

  if (!lesson) return <View style={styles.center}><Text>レッスンがありません</Text></View>;
  const hl = lesson.cards[idx >= 0 ? idx : 0] || lesson.cards[0];

  // 拡大: ポスターのセル枠ぴったりに切り抜き(余白ゼロ=「枠の中に枠」を回避)、ほぼ全幅へ拡大
  const cx = hl.box.x, cy = hl.box.y;
  const ZOOM_W = width - spacing.md * 2;
  const zScale = ZOOM_W / hl.box.w;
  const zoomH = Math.round(hl.box.h * zScale);

  return (
    <View style={styles.container} {...swipe}>
      <ScrollView ref={scrollRef} contentContainerStyle={{ padding: PAD, paddingBottom: 230 }}>
        <View style={styles.themeRow}>
          <Text style={styles.themeTitle}>{lesson.title}</Text>
          <Text style={styles.themeNav}>{li + 1} / {lessons.length}　← →</Text>
        </View>
        <View style={{ width: dispW, height: dispH }}>
          <Image source={lessonImage} style={{ width: dispW, height: dispH, borderRadius: radius.md }} resizeMode="contain" />
          {hl && (
            <View pointerEvents="none" style={[styles.hl, {
              left: hl.box.x * scale, top: hl.box.y * scale,
              width: hl.box.w * scale, height: hl.box.h * scale,
            }]} />
          )}
          {lesson.cards.map(c => (
            <Pressable key={c.i} onPress={() => start(c.i)}
              style={{ position: 'absolute', left: c.box.x * scale, top: c.box.y * scale, width: c.box.w * scale, height: c.box.h * scale }} />
          ))}
        </View>
      </ScrollView>

      {/* 下部ドック: 拡大カード(タップで再生/停止) + 進捗 */}
      <View style={styles.dock}>
        <Pressable onPress={toggle} style={[styles.zoomWrap, { width: ZOOM_W, height: zoomH }]}>
          <Image
            source={lessonImage}
            style={{ position: 'absolute', width: lesson.posterW * zScale, height: lesson.posterH * zScale,
                     left: -cx * zScale, top: -cy * zScale }}
            resizeMode="contain"
          />
          {!playing && (
            <View style={styles.playHint}>
              <Svg width={26} height={26} viewBox="0 0 24 24"><Path d="M8 5v14l11-7z" fill="#fff" /></Svg>
            </View>
          )}
        </Pressable>
        <View style={styles.bar}>
          <Text style={styles.hint}>タップで再生/停止　・　← スワイプでテーマ →</Text>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  themeRow: { flexDirection: 'row', alignItems: 'baseline', justifyContent: 'space-between', marginBottom: spacing.sm },
  themeTitle: { fontSize: 20, fontWeight: '700', color: colors.ink },
  themeNav: { fontSize: 12, color: colors.inkFaint, fontFamily: 'Courier' },
  hl: { position: 'absolute', borderWidth: 1.5, borderColor: colors.accentJa, borderRadius: 12, backgroundColor: 'transparent' },
  dock: { position: 'absolute', left: 0, right: 0, bottom: 0, backgroundColor: colors.surface, borderTopWidth: 1, borderTopColor: colors.line, paddingHorizontal: spacing.md, paddingTop: spacing.sm, paddingBottom: spacing.md },
  zoomWrap: { overflow: 'hidden', backgroundColor: '#fff', alignSelf: 'center' },
  lngtag: { borderRadius: 6, paddingHorizontal: 8, paddingVertical: 2 },
  lngtagFloat: { position: 'absolute', right: 8, top: 8 },
  lngtagText: { color: '#fff', fontWeight: '700', fontSize: 12 },
  playHint: { position: 'absolute', top: '50%', left: '50%', marginLeft: -24, marginTop: -24, width: 48, height: 48, borderRadius: 24, backgroundColor: 'rgba(40,48,74,0.78)', alignItems: 'center', justifyContent: 'center' },
  bar: { alignItems: 'center', justifyContent: 'center', marginTop: spacing.sm },
  hint: { fontSize: 12, color: colors.inkFaint, letterSpacing: 0.3, textAlign: 'center' },
});
