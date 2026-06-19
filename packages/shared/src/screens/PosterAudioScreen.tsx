// ポスター音声学習: ポスター画像を表示し、各カードをハイライトしながら
//  母語→日本語 の順で音声を連続再生する。
//  - 画像/音声は現在の母語(useI18n)で自動切替(imageL1 / card.l1)
//  - 下部ドックに「現在カードの拡大(ポスターを余白付きで切り抜き拡大)」を表示
//  - 拡大カードをタップで再生/停止。横スワイプで前/次テーマへ移動
import React, { useEffect, useMemo, useRef, useState } from 'react';
import { View, Text, Image, ScrollView, Pressable, useWindowDimensions, StyleSheet, ActivityIndicator } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { useAudioPlayer } from 'expo-audio';
import Svg, { Path } from 'react-native-svg';
import { colors, spacing, radius } from '../theme';
import { usePosterLessons, usePosterResolver } from '../PosterContext';
import { useI18n } from '../i18n';
import { useHorizontalSwipe } from '../useHorizontalSwipe';

const GOLD = '#b08746';
const LANG_LABEL: Record<string, string> = { ja: '日本語', bn: 'বাংলা', en: 'English', ne: 'नेपाली', vi: 'Tiếng Việt', zh: '中文', ko: '한국어' };

export default function PosterAudioScreen({ route }: any) {
  const { lessonId } = route.params || {};
  const lessons = usePosterLessons();
  const { resolveUri, ensure } = usePosterResolver();
  const navigation = useNavigation<any>();
  const { lang, t } = useI18n();
  const { width, height } = useWindowDimensions();

  const li = Math.max(0, lessons.findIndex(l => l.id === lessonId));
  const lesson = lessons[li] || lessons[0];

  // 多ページ対応: lesson.pages があれば各ページを切替表示(例 App A 数字=1-100の5枚をスワイプ)。
  //  無ければ従来の単一ページ(トップレベル imageL1/posterW/posterH/cards/titleAudio を1ページ扱い)。
  const pages = useMemo<any[]>(() => (
    lesson?.pages?.length
      ? lesson.pages
      : (lesson ? [{ image: lesson.image, imageL1: lesson.imageL1, posterW: lesson.posterW, posterH: lesson.posterH, cards: lesson.cards, titleAudio: lesson.titleAudio }] : [])
  // eslint-disable-next-line react-hooks/exhaustive-deps
  ), [lessonId, lessons]);
  const [pageIdx, setPageIdx] = useState(0);
  const page = pages[Math.min(pageIdx, Math.max(0, pages.length - 1))];
  const targetOnly = !!lesson?.targetOnly;  // 数字等: ターゲット言語の音声のみ再生(母語ヘルパー無し)

  // 資源(音声/画像)はDLパック: 値はzip内エントリのキー文字列。posterUri(resolveUri)で
  //  端末上の file:// uri に解決して使う。resolver 未注入(App A/C 等)なら素通り(=undefined)。
  const toUri = (key?: string): string | undefined => (resolveUri ? resolveUri(key) : key);
  const pickByLang = (m?: Record<string, string>) => (m ? (m[lang] ?? m.en ?? Object.values(m)[0]) : undefined);
  const lessonImageKey = pickByLang(page?.imageL1) ?? page?.image;
  const lessonImageUri = toUri(lessonImageKey);
  const l1AudioOf = (c: any) => pickByLang(c?.l1) ?? c?.ne;
  const l1Label = LANG_LABEL[lang] || lang;

  // ポスターパックのDLゲート。完了するまで ready=false(再生は開始しない)。
  const [ready, setReady] = useState(false);

  // ダブルバッファ: プレイヤーを2つ持ち、再生中に「次クリップ」をもう一方へ読み込み済みにしておく。
  //  終了瞬間に読み込み済みの方を即 play → ロード/デコード遅延が critical path から消え、間が一定・最短に。
  const pA = useAudioPlayer(undefined, { updateInterval: 50 });
  const pB = useAudioPlayer(undefined, { updateInterval: 50 });
  const players = [pA, pB];
  const scrollRef = useRef<ScrollView>(null);
  const [idx, setIdx] = useState(0);       // 表示中カード(初期=最初のカード)
  const [phase, setPhase] = useState<'ja' | 'l1'>('l1');  // 母語→日本語の順
  const [playing, setPlaying] = useState(false);
  // 実測レイアウト: コンテナ(画面本体)とドックの実高さ。推定をやめ onLayout で正確に取得。
  const [lay, setLay] = useState({ cont: 0, dock: 0 });
  const onContLayout = (e: any) => { const h = Math.round(e.nativeEvent.layout.height); setLay(l => Math.abs(l.cont - h) > 1 ? { ...l, cont: h } : l); };
  const onDockLayout = (e: any) => { const h = Math.round(e.nativeEvent.layout.height); setLay(l => Math.abs(l.dock - h) > 1 ? { ...l, dock: h } : l); };

  const activeRef = useRef(0);          // 現在アクティブなプレイヤー番号(0/1)
  const qiRef = useRef(0);              // 再生中のキュー位置
  const tokRef = useRef(0);             // セグメントトークン(stale な watchdog/advance を無効化)
  const startedRef = useRef(false);     // 当該クリップが実際に鳴り始めたか
  const playingRef = useRef(false);     // playing の ref ミラー(コールバック用)
  const wdRef = useRef<any>(null);
  const advanceRef = useRef<() => void>(() => {});

  const PAD = spacing.lg;
  const dispW = width - PAD * 2;   // 横の最大予算(これと「縦に収める」両方を満たす縮尺を採用)

  // テーマが変わったらページを先頭へ戻す。
  useEffect(() => { setPageIdx(0); }, [lessonId]);

  // テーマ/ページ移動でリセット(最初のカードを表示・停止)
  useEffect(() => {
    tokRef.current++; playingRef.current = false;
    setPlaying(false); setIdx(0); setPhase('l1');
    if (wdRef.current) clearTimeout(wdRef.current);
    try { pA.pause(); pB.pause(); } catch {}
    scrollRef.current?.scrollTo({ y: 0, animated: false });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [lessonId, pageIdx]);

  // ポスターパック(ja + 現在の母語)をDL/展開してから再生可能にする。
  //  資源は同梱でなくDLパックなので、端末に音声/画像が無ければ再生・表示できない。
  //  完了で ready=true。失敗(ensure は内部で握りつぶし)時も marker 無し=再生は開始しない。
  //  resolver未注入(App A/C)の場合は ensure も無いので即 ready(従来の同梱挙動)。
  useEffect(() => {
    let alive = true;
    setReady(false);
    if (!ensure) { setReady(true); return; }
    (async () => {
      try { await ensure(lang); } catch {}
      if (alive) setReady(true);
    })();
    return () => { alive = false; };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [lessonId, lang, ensure]);

  // 再生キュー(このテーマ・母語の全クリップを再生順に平坦化): タイトル母語→タイトル日→
  //  カード0母語→カード0日→カード1母語→… 各要素は表示カード idx / phase / 音源 src(file:// uri)。
  //  ready 後に資源が端末に在る→キーを uri へ解決して保持。ready 前は src 未解決(空)で再生不可。
  const queue = useMemo(() => {
    const q: { idx: number; phase: 'ja' | 'l1'; src?: string }[] = [];
    if (!page) return q;
    if (page.titleAudio) {
      if (!targetOnly) q.push({ idx: -1, phase: 'l1', src: toUri(pickByLang(page.titleAudio.l1) ?? page.titleAudio.ja) });
      q.push({ idx: -1, phase: 'ja', src: toUri(page.titleAudio.ja) });
    }
    page.cards.forEach((c: any, i: number) => {
      if (!targetOnly) q.push({ idx: i, phase: 'l1', src: toUri(l1AudioOf(c) ?? c.ja) });
      q.push({ idx: i, phase: 'ja', src: toUri(c.ja) });
    });
    return q;
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [lessonId, lang, ready, pageIdx]);
  const queueRef = useRef(queue); queueRef.current = queue;

  // 指定プレイヤーへ次クリップを「読み込みだけ」しておく(再生はしない=ダブルバッファの先読み)。
  //  src は file:// uri(キーをposterUriで解決済み)。未解決(undefined)なら read のみ解放。
  const preloadInto = (pIdx: number, qi: number) => {
    const item = queueRef.current[qi];
    try { players[pIdx].replace((item?.src ?? undefined) as any); } catch {}
  };

  // セグメント開始: アクティブを activate に切替→そのプレイヤーを play(先読み済みなら即時)→
  //  もう一方へ「次の次」を先読み。トークンで stale を無効化。
  const goSegment = (qi: number, activate: number) => {
    const q = queueRef.current;
    if (qi < 0 || qi >= q.length) { stop(); return; }
    const tok = ++tokRef.current;
    qiRef.current = qi; activeRef.current = activate; startedRef.current = false;
    setIdx(q[qi].idx); setPhase(q[qi].phase);
    try { players[activate].play(); } catch {}
    preloadInto(1 - activate, qi + 1);
    if (wdRef.current) clearTimeout(wdRef.current);
    wdRef.current = setTimeout(() => { if (tok === tokRef.current && playingRef.current) advanceRef.current(); }, 12000);
  };

  const startSeq = (fromQi: number) => {
    const q = queueRef.current;
    if (!q.length) return;
    const qi = Math.max(0, Math.min(fromQi, q.length - 1));
    playingRef.current = true; setPlaying(true);
    try { players[0].replace((q[qi].src ?? undefined) as any); } catch {}   // 最初の1本だけは読み込み発生(以降は先読み済み)
    goSegment(qi, 0);
  };

  advanceRef.current = () => {
    if (!playingRef.current) return;
    const q = queueRef.current;
    const next = qiRef.current + 1;
    if (next >= q.length) { stop(); return; }       // 終端
    goSegment(next, 1 - activeRef.current);          // 先読み済みの逆プレイヤーへ即切替
  };

  // 両プレイヤーの状態監視。アクティブな方だけが進行(advance)を駆動する。
  useEffect(() => {
    const subs = players.map((p, pIdx) => p.addListener('playbackStatusUpdate', (st: any) => {
      if (!st?.isLoaded || pIdx !== activeRef.current || !playingRef.current) return;
      if (st.playing) { startedRef.current = true; return; }
      if (!startedRef.current) { try { players[pIdx].play(); } catch {} return; }  // 念のため(主に最初の1本)
      if (st.didJustFinish || (st.duration > 0 && st.currentTime >= st.duration - 0.05)) advanceRef.current();
    }));
    return () => subs.forEach(s => s.remove());
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // カード index → キュー位置(タイトル分2件を考慮)
  const per = targetOnly ? 1 : 2;  // targetOnly はカード/タイトルとも1クリップ(ターゲットのみ)
  const cardToQi = (cardIdx: number) => (page?.titleAudio ? per : 0) + cardIdx * per;
  // 未ready(パックDL未完)の間は再生開始しない(資源が端末に無いため)。
  const start = (from = 0) => { if (!ready) return; startSeq(from === 0 && page?.titleAudio ? 0 : cardToQi(from)); };
  const stop = () => {
    tokRef.current++; playingRef.current = false; setPlaying(false);
    try { pA.pause(); pB.pause(); } catch {}
    if (wdRef.current) clearTimeout(wdRef.current);
  };
  const toggle = () => { if (playing) stop(); else start(idx >= 0 ? idx : 0); };

  const goTheme = (d: number) => {
    if (lessons.length < 2) return;
    const ni = (li + d + lessons.length) % lessons.length;
    navigation.setParams({ lessonId: lessons[ni].id });
  };
  // 多ページテーマ内はページ送り。端(先頭で戻る/末尾で進む)を越えたら隣のテーマへ。
  const goPageOrTheme = (d: number) => {
    const np = pageIdx + d;
    if (np >= 0 && np < pages.length) setPageIdx(np);
    else goTheme(d);
  };
  const swipe = useHorizontalSwipe(() => goPageOrTheme(1), () => goPageOrTheme(-1));

  if (!lesson) return <View style={styles.center}><Text>レッスンがありません</Text></View>;
  const hl = page.cards[idx >= 0 ? idx : 0] || page.cards[0];

  // 拡大: ポスターのセル枠ぴったりに切り抜き(余白ゼロ=「枠の中に枠」を回避)、ほぼ全幅へ拡大
  const cx = hl.box.x, cy = hl.box.y;
  const ZOOM_W = Math.min(width - spacing.md * 2, 460);  // iPad等で拡大ドックが過大にならないよう上限
  const zScale = ZOOM_W / hl.box.w;
  const zoomH = Math.round(hl.box.h * zScale);

  // ポスター表示縮尺: 「横の予算」と「ドックを除いた縦の余白に収める」の両方を満たす contain。
  //  iPad は縦横比がスマホと違い、幅合わせだと縦が収まらず下端が見切れる。縦に合わせ、横は
  //  左右に余白を振り分け中央寄せ。ドック/コンテナ高さは onLayout の【実測値】を使う(推定しない)。
  //  実測前(初回1フレーム)のみ window 高さからの暫定値で描画し、測定後に正確値で再描画する。
  const measured = lay.cont > 0 && lay.dock > 0;
  const availH = measured
    ? Math.max(120, lay.cont - lay.dock - spacing.sm * 2)
    : Math.max(120, height - (zoomH + 180));   // 暫定(測定までの1フレーム)
  const scale = Math.min(dispW / page.posterW, availH / page.posterH);
  const pw = Math.round(page.posterW * scale);
  const ph = Math.round(page.posterH * scale);

  return (
    <View style={styles.container} {...swipe} onLayout={onContLayout}>
      <ScrollView ref={scrollRef} contentContainerStyle={{ alignItems: 'center', paddingTop: spacing.sm, paddingBottom: (lay.dock || zoomH + 180) + spacing.sm }}>
        <View style={{ width: pw, height: ph }}>
          {/* 画像はDLパック: uri 未解決(ready前)ならプレースホルダ(空の枠)を出す */}
          {lessonImageUri
            ? <Image source={{ uri: lessonImageUri }} style={{ width: pw, height: ph, borderRadius: radius.md }} resizeMode="contain" />
            : <View style={{ width: pw, height: ph, borderRadius: radius.md, backgroundColor: '#fff' }} />}
          {hl && (
            <View pointerEvents="none" style={[styles.hl, {
              left: hl.box.x * scale, top: hl.box.y * scale,
              width: hl.box.w * scale, height: hl.box.h * scale,
            }]} />
          )}
          {page.cards.map((c: any) => (
            <Pressable key={c.i} onPress={() => start(c.i)}
              style={{ position: 'absolute', left: c.box.x * scale, top: c.box.y * scale, width: c.box.w * scale, height: c.box.h * scale }} />
          ))}
        </View>
      </ScrollView>

      {/* 下部ドック: 拡大カード(タップで再生/停止) + 進捗 */}
      <View style={styles.dock} onLayout={onDockLayout}>
        <Pressable onPress={toggle} style={[styles.zoomWrap, { width: ZOOM_W, height: zoomH }]}>
          {lessonImageUri && (
            <Image
              source={{ uri: lessonImageUri }}
              style={{ position: 'absolute', width: page.posterW * zScale, height: page.posterH * zScale,
                       left: -cx * zScale, top: -cy * zScale }}
              resizeMode="contain"
            />
          )}
          {/* パックDL中は「準備中」(再生不可)。完了後はタップで再生/停止。 */}
          {!ready ? (
            <View style={styles.playHint}>
              <ActivityIndicator color="#fff" />
            </View>
          ) : !playing && (
            <View style={styles.playHint}>
              <Svg width={26} height={26} viewBox="0 0 24 24"><Path d="M8 5v14l11-7z" fill="#fff" /></Svg>
            </View>
          )}
        </Pressable>
        <View style={styles.bar}>
          <Text style={styles.count}>{li + 1} / {lessons.length}{pages.length > 1 ? `  ·  ${pageIdx + 1}/${pages.length}` : ''}</Text>
          <Text style={styles.hint}>{ready ? t('poster.hint') : t('poster.preparing')}</Text>
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
  bar: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: spacing.sm, marginTop: spacing.sm },
  count: { fontSize: 14, fontWeight: '700', color: colors.ink },
  hint: { fontSize: 12, color: colors.inkFaint, letterSpacing: 0.3 },
});
