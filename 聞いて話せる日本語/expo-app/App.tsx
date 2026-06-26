// 聞いて話せる日本語 のエントリ。
// UI / ナビゲーション / 画面は @safa/shared に集約。
// アプリ固有: ne UI を Primary、方向は ne→ja を デフォルトに。

import { useEffect, useRef, useState, type ReactNode } from 'react';
import { ActivityIndicator, Pressable, Text, View } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import {
  AppShell,
  I18nProvider,
  SettingsProvider,
  AppDataProvider,
  ModalDropdown,
  useI18n,
  type AppData,
} from '@safa/shared';

import ja from './src/i18n/ja.json';
import ne from './src/i18n/ne.json';
import bn from './src/i18n/bn.json';
import en from './src/i18n/en.json';
import vi from './src/i18n/vi.json';
import zh from './src/i18n/zh.json';
import ko from './src/i18n/ko.json';
import { bundledPack, loadPack, getPackDownloadInfo } from './src/packLoader';
import { POSTER_LESSONS } from './src/posterLessons';
import { posterUri, ensurePosterPack } from './src/posterPackLoader';

const splashSource = require('./assets/safa-splash.mp4');
const headerIconSource = require('./assets/icon.png');

// 共有辞書(まいにちJLPTから同期: data/dict)。辞書タブに注入する。
import jaVocab from './data/dict/ja-vocab.json';
import jaKanji from './data/dict/ja-kanji.json';
import jaExamples from './data/dict/ja-examples.json';
import jaKanjiExamples from './data/dict/ja-kanji-examples.json';
const dictData = {
  vocab: jaVocab as any,
  kanji: jaKanji as any,
  examples: jaExamples as any,
  kanjiExamples: jaKanjiExamples as any,
};

// L1(母語=パック)になり得る言語。ja は学習対象=共通コアなのでパックは無い。
// UI言語が ja 等の場合はパックを ne にフォールバック。
const PACK_LANGS = ['bn', 'en', 'vi', 'ne', 'zh', 'ko'];
const toPackLang = (lang: string) => (PACK_LANGS.includes(lang) ? lang : 'en');

// 初回起動の母語選択。各L1の自言語表記で提示する。
// 並び順は全アプリ共通(LANG_ORDER): English→中国語→韓国語→ベトナム語→ネパール語→ベンガル語。
const LANG_OPTIONS = [
  { code: 'en', native: 'English', sub: 'English' },
  { code: 'zh', native: '中文', sub: 'Chinese' },
  { code: 'ko', native: '한국어', sub: 'Korean' },
  { code: 'vi', native: 'Tiếng Việt', sub: 'Vietnamese' },
  { code: 'ne', native: 'नेपाली', sub: 'Nepali' },
  { code: 'bn', native: 'বাংলা', sub: 'Bangla' },
];
// 母語を一度でも選んだかのフラグ (i18n の lang とは別管理)。
const L1_CHOSEN_KEY = '@japanese_app/l1_chosen_v1';

// DL画面の文言 (UI言語=L1ごと)。confirmTitle/confirmBody({size}) はDL前の同意ダイアログ用 (Apple GL4.2.3)。
type DlText = { dl: string; prep: string; fail: string; retry: string; confirmTitle: string; confirmBody: string; download: string; back: string; later: string };
const DL_TEXT: Record<string, DlText> = {
  ne: { dl: 'डाउनलोड हुँदैछ', prep: 'तयार पारिँदैछ', fail: 'डाउनलोड असफल भयो', retry: 'पुनः प्रयास गर्नुहोस्', confirmTitle: 'भाषा सामग्री डाउनलोड', confirmBody: 'यो भाषाको लागि अडियो र अनुवाद (लगभग {size}) डाउनलोड गर्न आवश्यक छ।', download: 'डाउनलोड गर्नुहोस् ({size})', back: 'पछाडि', later: 'पछि (अहिलेकै राख्ने)' },
  bn: { dl: 'ডাউনলোড হচ্ছে', prep: 'প্রস্তুত হচ্ছে', fail: 'ডাউনলোড ব্যর্থ হয়েছে', retry: 'আবার চেষ্টা করুন', confirmTitle: 'ভাষা সামগ্রী ডাউনলোড', confirmBody: 'এই ভাষার জন্য অডিও ও অনুবাদ (প্রায় {size}) ডাউনলোড করতে হবে।', download: 'ডাউনলোড করুন ({size})', back: 'ফিরে যান', later: 'পরে (এখনকারটি রাখুন)' },
  en: { dl: 'Downloading', prep: 'Preparing', fail: 'Download failed', retry: 'Retry', confirmTitle: 'Download language content', confirmBody: 'This language needs audio and translations (about {size}) to be downloaded.', download: 'Download ({size})', back: 'Back', later: 'Later (keep current)' },
  vi: { dl: 'Đang tải xuống', prep: 'Đang chuẩn bị', fail: 'Tải xuống thất bại', retry: 'Thử lại', confirmTitle: 'Tải nội dung ngôn ngữ', confirmBody: 'Ngôn ngữ này cần tải âm thanh và bản dịch (khoảng {size}).', download: 'Tải xuống ({size})', back: 'Quay lại', later: 'Để sau (giữ hiện tại)' },
  ja: { dl: 'ダウンロード中', prep: '準備中', fail: 'ダウンロードに失敗しました', retry: '再試行', confirmTitle: '言語データのダウンロード', confirmBody: 'この言語の音声と翻訳（約{size}）をダウンロードします。', download: 'ダウンロード（{size}）', back: '戻る', later: '後で（現在のまま使う）' },
  zh: { dl: '下载中', prep: '准备中', fail: '下载失败', retry: '重试', confirmTitle: '下载语言内容', confirmBody: '该语言需要下载音频和翻译（约{size}）。', download: '下载（{size}）', back: '返回', later: '稍后（保持现状）' },
  ko: { dl: '다운로드 중', prep: '준비 중', fail: '다운로드에 실패했습니다', retry: '다시 시도', confirmTitle: '언어 데이터 다운로드', confirmBody: '이 언어의 음성과 번역(약 {size})을 다운로드합니다.', download: '다운로드 ({size})', back: '뒤로', later: '나중에 (현재 상태로 사용)' },
};
function fmtMB(bytes: number): string { return bytes > 0 ? `${Math.max(1, Math.round(bytes / 1048576))} MB` : '—'; }

// DL前の同意画面 (サイズ開示+ユーザーが選択して開始)。Apple GL4.2.3対応。
function ConfirmDownloadView({ bytes, lang, onConfirm, onCancel, canSkip, onSkipUpdate }: { bytes: number; lang: string; onConfirm: () => void; onCancel?: () => void; canSkip?: boolean; onSkipUpdate?: () => void }) {
  const t = DL_TEXT[lang] ?? DL_TEXT.en;
  const size = fmtMB(bytes);
  return (
    <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', padding: 32, backgroundColor: '#fff' }}>
      <Text style={{ fontSize: 17, fontWeight: '700', color: '#18181b', marginBottom: 12, textAlign: 'center' }}>{t.confirmTitle}</Text>
      <Text style={{ fontSize: 14, color: '#52525b', marginBottom: 28, textAlign: 'center', lineHeight: 21 }}>{t.confirmBody.replace('{size}', size)}</Text>
      <Pressable onPress={onConfirm} style={{ paddingVertical: 14, paddingHorizontal: 32, borderRadius: 10, backgroundColor: '#2563eb' }}>
        <Text style={{ color: '#fff', fontSize: 16, fontWeight: '700' }}>{t.download.replace('{size}', size)}</Text>
      </Pressable>
      {/* 既存データで動かせる(=更新のみ)なら「後で(現在のまま使う)」でDLせず起動。
          そうでなく言語変更などで戻れる場合は「戻る」。初回必須DLはどちらも無し。 */}
      {canSkip && onSkipUpdate ? (
        <Pressable onPress={onSkipUpdate} hitSlop={8} style={{ marginTop: 18, paddingVertical: 8, paddingHorizontal: 20 }}>
          <Text style={{ color: '#52525b', fontSize: 15, fontWeight: '600' }}>{t.later}</Text>
        </Pressable>
      ) : onCancel ? (
        <Pressable onPress={onCancel} hitSlop={8} style={{ marginTop: 18, paddingVertical: 8, paddingHorizontal: 20 }}>
          <Text style={{ color: '#52525b', fontSize: 15, fontWeight: '600' }}>‹ {t.back}</Text>
        </Pressable>
      ) : null}
    </View>
  );
}

// DLローディング画面 (進捗バー付き / 失敗時は再試行)。
function DownloadView(
  { done, total, label, lang, error, errMsg, onRetry, step, steps }:
  { done: number; total: number; label?: string; lang: string; error?: boolean; errMsg?: string; onRetry?: () => void; step?: number; steps?: number },
) {
  const t = DL_TEXT[lang] ?? DL_TEXT.ne;
  const pct = total > 0 ? Math.round((done / total) * 100) : 0;
  const counter = steps && steps > 1 && step ? ` (${step}/${steps})` : '';
  if (error) {
    return (
      <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', padding: 32 }}>
        <Text style={{ fontSize: 14, color: '#dc2626', marginBottom: 8, textAlign: 'center' }}>{t.fail}</Text>
        {errMsg ? (
          <Text style={{ fontSize: 11, color: '#a1a1aa', marginBottom: 16, textAlign: 'center' }} selectable>{errMsg}</Text>
        ) : null}
        <Pressable onPress={onRetry} style={{ paddingVertical: 10, paddingHorizontal: 24, borderRadius: 8, backgroundColor: '#2563eb' }}>
          <Text style={{ color: '#fff', fontSize: 14, fontWeight: '600' }}>{t.retry}</Text>
        </Pressable>
      </View>
    );
  }
  return (
    <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', padding: 32 }}>
      <ActivityIndicator />
      <Text style={{ marginTop: 16, fontSize: 13, color: '#52525b' }}>
        {`${label === '展開中' ? t.prep : t.dl}… ${pct}%${counter}`}
      </Text>
      <View style={{ marginTop: 12, width: 220, height: 6, borderRadius: 3, backgroundColor: '#e4e4e7', overflow: 'hidden' }}>
        <View style={{ width: `${pct}%`, height: '100%', backgroundColor: '#2563eb' }} />
      </View>
    </View>
  );
}

// 現在のUI言語(=L1)に応じてデータパックを解決して供給する。
// ★言語切替でも AppShell(=children)を破棄(unmount)しない。
//  従来は data=null にして AppShell を毎回破棄→再マウントしていたが、破棄の途中
//  (音声プレイヤー解放等)で固まる/スプラッシュ再生で白画面になる問題があった。
//  そこで「旧データを保持したまま新パックを読み込み、完了で差し替え」、読み込み中/
//  失敗は AppShell の上にオーバーレイで重ねる方式に変更(再マウントしない)。
// ─── パック設定 ─────────────────────────────────────────────────────────────
// 短文パック(会話例文+日本語音声+母語音声)。
// 長文と切り分けるため一時オフ。再有効化: false → true に変えてビルド。
/* 有効時: 言語選択後に短文パック(short-{lang}.zip)をDL → 短文タブが完全動作 */
const SHORT_PACK_ENABLED = false;

// 長文パック(長文テキスト+音声)。コンテンツ追加時に SHORT_PACK_ENABLED と並列で実装。
// 有効時: 言語選択後に長文パック(long-{lang}.zip)を SHORT パックと同時にDL。
// const LONG_PACK_ENABLED = false;

// セッション中に一度ロードした言語パックをメモリ保持。再切替を即時化(再DL/再チェック/再composeなし)。
//  最新版チェックは初回ロード時とアプリ再起動時に行えば十分。
const sessionPackCache: Record<string, AppData> = {};

function PackGate({ children }: { children: ReactNode }) {
  const { lang, setLang } = useI18n();
  const packLang = toPackLang(lang); // ja等→ne。実際にDL/同梱判定するL1。
  const skipPack = !SHORT_PACK_ENABLED;
  const emptyData: AppData = { version: 'dev', THEMES: [], LEVELS: [], EXAMPLES: {}, WORD_CATEGORIES: [], WORDS: {}, GRAMMAR_THEMES: [], GRAMMAR_EXAMPLES: {}, VOCAB: {}, audio: {} as any, getExamples: () => [], getWords: () => [], getGrammarExamples: () => [] };
  const [data, setData] = useState<AppData | null>(() => skipPack ? emptyData : bundledPack(packLang));
  const dataLangRef = useRef<string | null>(data ? packLang : null); // dataがどの言語のものか
  const shownLangRef = useRef<string>(lang); // 現在表示中データのUI言語(DL拒否時の戻り先)
  const [progress, setProgress] = useState<{ done: number; total: number; label?: string; step?: number; steps?: number }>({ done: 0, total: 0 });
  const [error, setError] = useState(false);
  const [errMsg, setErrMsg] = useState<string>('');
  const [attempt, setAttempt] = useState(0);
  const [loading, setLoading] = useState(false);
  const [confirm, setConfirm] = useState<{ bytes: number; canSkip: boolean } | null>(null); // DL同意待ち (Apple GL4.2.3)
  const confirmedLangRef = useRef<string | null>(null); // ユーザーがDL同意した言語
  const skipUpdateLangRef = useRef<string | null>(null); // 「後で」で更新を見送った言語(既存音声で起動)
  useEffect(() => {
    if (skipPack) return; // 短文パックオフ(SHORT_PACK_ENABLED = false)
    let alive = true;
    const bundled = bundledPack(packLang);
    if (bundled) { setData(bundled); dataLangRef.current = packLang; shownLangRef.current = lang; setLoading(false); setError(false); setConfirm(null); return; }
    // 既に表示中のデータが目的言語なら何もしない(無駄な再読込を避ける)
    if (dataLangRef.current === packLang && !error) return;
    // セッション中に一度ロード済みなら即時表示(ネット通信もloadPackも無し)
    const cached = sessionPackCache[packLang];
    if (cached && !error) { setData(cached); dataLangRef.current = packLang; shownLangRef.current = lang; setLoading(false); setConfirm(null); return; }
    setError(false); setErrMsg(''); setConfirm(null);
    (async () => {
      // まずDL要否とサイズを確認。DLが必要で未同意の言語なら、サイズ開示+同意画面を出してから。
      let info: { needsDownload: boolean; bytes: number; canSkip: boolean };
      try { info = await getPackDownloadInfo(packLang); } catch { info = { needsDownload: true, bytes: 0, canSkip: false }; }
      if (!alive) return;
      if (info.needsDownload && confirmedLangRef.current !== packLang) { setConfirm({ bytes: info.bytes, canSkip: info.canSkip }); return; }
      setProgress({ done: 0, total: 0 }); setLoading(true);
      loadPack(packLang, (done, total, label, step, steps) => { if (alive) setProgress({ done, total, label, step, steps }); }, skipUpdateLangRef.current === packLang)
        .then(d => { if (alive) { sessionPackCache[packLang] = d; setData(d); dataLangRef.current = packLang; shownLangRef.current = lang; setLoading(false); } })
        .catch((e: any) => { if (alive) { setErrMsg(String(e?.message ?? e)); setError(true); setLoading(false); } });
    })();
    return () => { alive = false; };
  }, [packLang, attempt]);

  // ユーザーがDLに同意 → 同意済みに記録して再実行(今度はDLへ)。
  const onConfirm = () => { confirmedLangRef.current = packLang; setConfirm(null); setAttempt(a => a + 1); };
  // DLを拒否(戻る) → 直前に表示していた言語へ戻す(強制DLを回避)。
  const onCancel = () => { setConfirm(null); setLang(shownLangRef.current); };
  // 更新を「後で」 → DLせず既存音声のまま起動(skipUpdate=trueで再実行)。
  const onSkipUpdate = () => { confirmedLangRef.current = packLang; skipUpdateLangRef.current = packLang; setConfirm(null); setAttempt(a => a + 1); };

  // 初回(まだ一度もデータが無い)
  if (!data) {
    if (confirm) return <ConfirmDownloadView bytes={confirm.bytes} lang={lang} onConfirm={onConfirm} canSkip={confirm.canSkip} onSkipUpdate={onSkipUpdate} />;
    return <DownloadView done={progress.done} total={progress.total} label={progress.label} step={progress.step} steps={progress.steps} lang={lang} error={error} errMsg={errMsg} onRetry={() => setAttempt(a => a + 1)} />;
  }
  // データあり → AppShell は維持し、確認/読み込み/失敗のみ上にオーバーレイ(再マウントしない)
  return (
    <AppDataProvider data={data}>
      {children}
      {confirm && (
        <View style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: '#fff' }}>
          <ConfirmDownloadView bytes={confirm.bytes} lang={lang} onConfirm={onConfirm} onCancel={onCancel} canSkip={confirm.canSkip} onSkipUpdate={onSkipUpdate} />
        </View>
      )}
      {(loading || error) && !confirm && (
        <View style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: '#fff' }}>
          <DownloadView done={progress.done} total={progress.total} label={progress.label} lang={lang} error={error} errMsg={errMsg} onRetry={() => setAttempt(a => a + 1)} />
        </View>
      )}
    </AppDataProvider>
  );
}

// 母語選択画面 (初回のみ)。選んだ言語が UI言語=L1=DLするパックになる。
function LanguageSelect({ onSelect }: { onSelect: (l: string) => void }) {
  const [sel, setSel] = useState<string | null>(null);
  const items = LANG_OPTIONS.map(o => ({ value: o.code, label: o.native, sub: o.sub }));
  return (
    <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', padding: 32 }}>
      <Text style={{ fontSize: 19, fontWeight: '700', color: '#18181b', marginBottom: 32 }}>Select your language</Text>
      <ModalDropdown
        items={items}
        value={sel}
        onChange={setSel}
        placeholder="Select"
        size="large"
      />
      <Pressable
        onPress={() => { if (sel) onSelect(sel); }}
        disabled={!sel}
        style={{ width: 248, paddingVertical: 16, borderRadius: 12, backgroundColor: sel ? '#2563eb' : '#cbd5e1', marginTop: 20, alignItems: 'center' }}
      >
        <Text style={{ color: '#fff', fontSize: 18, fontWeight: '700' }}>Start</Text>
      </Pressable>
    </View>
  );
}

// 初回のみ母語選択画面を出す。選択済みなら素通り。
function FirstRunGate({ children }: { children: ReactNode }) {
  const { setLang } = useI18n();
  const [checked, setChecked] = useState(false);
  const [needSelect, setNeedSelect] = useState(false);
  useEffect(() => {
    let alive = true;
    const devLang = null;
    if (devLang && PACK_LANGS.concat(['ja']).includes(devLang)) {
      setLang(devLang);
      AsyncStorage.setItem(L1_CHOSEN_KEY, devLang).catch(() => {});
      setChecked(true);
      return;
    }
    AsyncStorage.getItem(L1_CHOSEN_KEY)
      .then(v => { if (alive) { setNeedSelect(!v); setChecked(true); } })
      .catch(() => { if (alive) { setNeedSelect(true); setChecked(true); } });
    return () => { alive = false; };
  }, []);
  if (!checked) return <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}><ActivityIndicator /></View>;
  if (needSelect) {
    return (
      <LanguageSelect onSelect={(l) => {
        setLang(l);
        AsyncStorage.setItem(L1_CHOSEN_KEY, l).catch(() => {});
        setNeedSelect(false);
      }} />
    );
  }
  return <>{children}</>;
}

export default function App() {
  return (
    <I18nProvider
      translations={{ ja, ne, bn, en, vi, zh, ko }}
      fallbackLang="en"
      selectableLangs={['en', 'zh', 'ko', 'vi', 'ne', 'bn']}
      storageKey="@japanese_app/lang_v1"
    >
      <SettingsProvider
        defaults={{ practiceDirection: 'ne2ja', listenDirection: 'ne2ja' }}
        storageKey="@japanese_app/settings_v2"
      >
        <FirstRunGate>
          <PackGate>
            {/* ポスター音声学習: テーマ1〜5(家族/数字/体/色と形/食べ物)を多言語(bn/en/ne/vi)対応で再有効化。実機検証用。
                資源(音声/画像)は packs-poster からDL: posterUri(file://解決)/ensurePosterPack(DL)を注入。 */}
            {/* App B 構造(2026-06-26 改): ホーム/短文(会話文)/長文(準備中)/付録(JLPT読解聴解+ポスター朗読)/辞書 の5タブ。 */}
            <AppShell splashSource={splashSource} headerIconSource={headerIconSource} posterLessons={POSTER_LESSONS} posterResolveUri={posterUri} posterEnsure={ensurePosterPack} progressStorageKey="@japanese_app/progress_v1" tabs={['home', 'short', 'long', 'appendix', 'dict']} dictData={dictData} />
          </PackGate>
        </FirstRunGate>
      </SettingsProvider>
    </I18nProvider>
  );
}
