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
  useI18n,
  type AppData,
} from '@safa/shared';

import ja from './src/i18n/ja.json';
import ne from './src/i18n/ne.json';
import bn from './src/i18n/bn.json';
import en from './src/i18n/en.json';
import vi from './src/i18n/vi.json';
import { bundledPack, loadPack } from './src/packLoader';
import { POSTER_LESSONS } from './src/posterLessons';

const splashSource = require('./assets/safa-splash.mp4');
const headerIconSource = require('./assets/icon.png');

// L1(母語=パック)になり得る言語。ja は学習対象=共通コアなのでパックは無い。
// UI言語が ja 等の場合はパックを ne にフォールバック。
const PACK_LANGS = ['bn', 'en', 'vi', 'ne'];
const toPackLang = (lang: string) => (PACK_LANGS.includes(lang) ? lang : 'en');

// 初回起動の母語選択。各L1の自言語表記で提示する。
const LANG_OPTIONS = [
  { code: 'bn', native: 'বাংলা', sub: 'Bangla' },
  { code: 'en', native: 'English', sub: 'English' },
  { code: 'vi', native: 'Tiếng Việt', sub: 'Vietnamese' },
  { code: 'ne', native: 'नेपाली', sub: 'Nepali' },
];
// 母語を一度でも選んだかのフラグ (i18n の lang とは別管理)。
const L1_CHOSEN_KEY = '@japanese_app/l1_chosen_v1';

// DL画面の文言 (UI言語=L1ごと)。
const DL_TEXT: Record<string, { dl: string; prep: string; fail: string; retry: string }> = {
  ne: { dl: 'डाउनलोड हुँदैछ', prep: 'तयार पारिँदैछ', fail: 'डाउनलोड असफल भयो', retry: 'पुनः प्रयास गर्नुहोस्' },
  bn: { dl: 'ডাউনলোড হচ্ছে', prep: 'প্রস্তুত হচ্ছে', fail: 'ডাউনলোড ব্যর্থ হয়েছে', retry: 'আবার চেষ্টা করুন' },
  en: { dl: 'Downloading', prep: 'Preparing', fail: 'Download failed', retry: 'Retry' },
  vi: { dl: 'Đang tải xuống', prep: 'Đang chuẩn bị', fail: 'Tải xuống thất bại', retry: 'Thử lại' },
  ja: { dl: 'ダウンロード中', prep: '準備中', fail: 'ダウンロードに失敗しました', retry: '再試行' },
};

// DLローディング画面 (進捗バー付き / 失敗時は再試行)。
function DownloadView(
  { done, total, label, lang, error, errMsg, onRetry }:
  { done: number; total: number; label?: string; lang: string; error?: boolean; errMsg?: string; onRetry?: () => void },
) {
  const t = DL_TEXT[lang] ?? DL_TEXT.ne;
  const pct = total > 0 ? Math.round((done / total) * 100) : 0;
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
        {`${label === '展開中' ? t.prep : (label || t.dl)}… ${pct}%`}
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
function PackGate({ children }: { children: ReactNode }) {
  const { lang } = useI18n();
  const packLang = toPackLang(lang); // ja等→ne。実際にDL/同梱判定するL1。
  const [data, setData] = useState<AppData | null>(() => bundledPack(packLang));
  const dataLangRef = useRef<string | null>(data ? packLang : null); // dataがどの言語のものか
  const [progress, setProgress] = useState<{ done: number; total: number; label?: string }>({ done: 0, total: 0 });
  const [error, setError] = useState(false);
  const [errMsg, setErrMsg] = useState<string>('');
  const [attempt, setAttempt] = useState(0);
  const [loading, setLoading] = useState(false);
  useEffect(() => {
    let alive = true;
    const bundled = bundledPack(packLang);
    if (bundled) { setData(bundled); dataLangRef.current = packLang; setLoading(false); setError(false); return; }
    // 既に表示中のデータが目的言語なら何もしない(無駄な再読込を避ける)
    if (dataLangRef.current === packLang && !error) return;
    setError(false); setErrMsg(''); setProgress({ done: 0, total: 0 }); setLoading(true);
    loadPack(packLang, (done, total, label) => { if (alive) setProgress({ done, total, label }); })
      .then(d => { if (alive) { setData(d); dataLangRef.current = packLang; setLoading(false); } })
      .catch((e: any) => { if (alive) { setErrMsg(String(e?.message ?? e)); setError(true); setLoading(false); } });
    return () => { alive = false; };
  }, [packLang, attempt]);

  // 初回(まだ一度もデータが無い) → 全画面の DL/エラー画面
  if (!data) {
    return <DownloadView done={progress.done} total={progress.total} label={progress.label} lang={lang} error={error} errMsg={errMsg} onRetry={() => setAttempt(a => a + 1)} />;
  }
  // データあり → AppShell は維持し、読み込み中/失敗のみ上にオーバーレイ(再マウントしない)
  return (
    <AppDataProvider data={data}>
      {children}
      {(loading || error) && (
        <View style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: '#fff' }}>
          <DownloadView done={progress.done} total={progress.total} label={progress.label} lang={lang} error={error} errMsg={errMsg} onRetry={() => setAttempt(a => a + 1)} />
        </View>
      )}
    </AppDataProvider>
  );
}

// 母語選択画面 (初回のみ)。選んだ言語が UI言語=L1=DLするパックになる。
function LanguageSelect({ onSelect }: { onSelect: (l: string) => void }) {
  return (
    <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', padding: 32 }}>
      <Text style={{ fontSize: 19, fontWeight: '700', color: '#18181b', marginBottom: 6 }}>Select your language</Text>
      <Text style={{ fontSize: 13, color: '#71717a', marginBottom: 32, textAlign: 'center' }}>
        भाषा छान्नुहोस् · ভাষা নির্বাচন করুন
      </Text>
      {LANG_OPTIONS.map(o => (
        <Pressable
          key={o.code}
          onPress={() => onSelect(o.code)}
          style={{ width: 248, paddingVertical: 16, borderRadius: 12, backgroundColor: '#2563eb', marginBottom: 14, alignItems: 'center' }}
        >
          <Text style={{ color: '#fff', fontSize: 20, fontWeight: '700' }}>{o.native}</Text>
          <Text style={{ color: '#dbeafe', fontSize: 12, marginTop: 2 }}>{o.sub}</Text>
        </Pressable>
      ))}
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
      translations={{ ja, ne, bn, en, vi }}
      fallbackLang="en"
      selectableLangs={['bn', 'en', 'vi', 'ne']}
      storageKey="@japanese_app/lang_v1"
    >
      <SettingsProvider
        defaults={{ practiceDirection: 'ne2ja', listenDirection: 'ne2ja' }}
        storageKey="@japanese_app/settings_v2"
      >
        <FirstRunGate>
          <PackGate>
            <AppShell splashSource={splashSource} headerIconSource={headerIconSource} posterLessons={POSTER_LESSONS} />
          </PackGate>
        </FirstRunGate>
      </SettingsProvider>
    </I18nProvider>
  );
}
