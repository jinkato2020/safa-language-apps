// 聞いて話せるネパール語 のエントリ。
// UI / ナビゲーション / 画面は @safa/shared に集約。
// ja=同梱(現行), en=DLパック。初回に母語(日本語/English)を選択。

import { useEffect, useState, type ReactNode } from 'react';
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
import en from './src/i18n/en.json';
import { bundledPack, loadPack } from './src/packLoader';

const splashSource = require('./assets/safa-splash.mp4');
const headerIconSource = require('./assets/icon.png');

// DLパックになり得る言語は en のみ。ja/ne は同梱(ja内容)を使う。
const toPackLang = (lang: string) => (lang === 'en' ? 'en' : 'ja');

// 初回の母語選択。
const LANG_OPTIONS = [
  { code: 'ja', native: '日本語', sub: 'Japanese' },
  { code: 'en', native: 'English', sub: 'English' },
];
const L1_CHOSEN_KEY = '@nepali_app/l1_chosen_v1';

const DL_TEXT: Record<string, { dl: string; prep: string; fail: string; retry: string }> = {
  en: { dl: 'Downloading', prep: 'Preparing', fail: 'Download failed', retry: 'Retry' },
  ja: { dl: 'ダウンロード中', prep: '準備中', fail: 'ダウンロードに失敗しました', retry: '再試行' },
  ne: { dl: 'डाउनलोड हुँदैछ', prep: 'तयार पारिँदैछ', fail: 'डाउनलोड असफल भयो', retry: 'पुनः प्रयास गर्नुहोस्' },
};

// DLローディング画面 (進捗バー付き / 失敗時は再試行)。
function DownloadView(
  { done, total, label, lang, error, errMsg, onRetry }:
  { done: number; total: number; label?: string; lang: string; error?: boolean; errMsg?: string; onRetry?: () => void },
) {
  const t = DL_TEXT[lang] ?? DL_TEXT.ja;
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
        {`${label === '展開中' ? t.prep : t.dl}… ${pct}%`}
      </Text>
      <View style={{ marginTop: 12, width: 220, height: 6, borderRadius: 3, backgroundColor: '#e4e4e7', overflow: 'hidden' }}>
        <View style={{ width: `${pct}%`, height: '100%', backgroundColor: '#2563eb' }} />
      </View>
    </View>
  );
}

// 現在のUI言語に応じてデータパックを解決して供給する。
// ja/ne は同梱(即時)。en は null→進捗バー→DL完了で差し替え。
function PackGate({ children }: { children: ReactNode }) {
  const { lang } = useI18n();
  const packLang = toPackLang(lang);
  const [data, setData] = useState<AppData | null>(() => bundledPack(packLang));
  const [progress, setProgress] = useState<{ done: number; total: number; label?: string }>({ done: 0, total: 0 });
  const [error, setError] = useState(false);
  const [errMsg, setErrMsg] = useState<string>('');
  const [attempt, setAttempt] = useState(0);
  useEffect(() => {
    let alive = true;
    const bundled = bundledPack(packLang);
    if (bundled) { setData(bundled); return; }
    setData(null); setError(false); setErrMsg(''); setProgress({ done: 0, total: 0 });
    loadPack(packLang, (done, total, label) => { if (alive) setProgress({ done, total, label }); })
      .then(d => { if (alive) setData(d); })
      .catch((e: any) => { if (alive) { setErrMsg(String(e?.message ?? e)); setError(true); } });
    return () => { alive = false; };
  }, [packLang, attempt]);
  if (error) return <DownloadView done={0} total={0} lang={lang} error errMsg={errMsg} onRetry={() => setAttempt(a => a + 1)} />;
  if (!data) return <DownloadView done={progress.done} total={progress.total} label={progress.label} lang={lang} />;
  return <AppDataProvider data={data}>{children}</AppDataProvider>;
}

// 母語選択画面 (初回のみ)。日本語=同梱 / English=DL。
function LanguageSelect({ onSelect }: { onSelect: (l: string) => void }) {
  return (
    <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', padding: 32 }}>
      <Text style={{ fontSize: 19, fontWeight: '700', color: '#18181b', marginBottom: 6 }}>言語を選択</Text>
      <Text style={{ fontSize: 13, color: '#71717a', marginBottom: 32, textAlign: 'center' }}>Select your language</Text>
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
      translations={{ ja, ne, en }}
      fallbackLang="ja"
      storageKey="@nepali_app/lang_v1"
    >
      <SettingsProvider
        defaults={{ practiceDirection: 'ja2ne', listenDirection: 'ja2ne' }}
        storageKey="@nepali_app/settings_v2"
      >
        <FirstRunGate>
          <PackGate>
            <AppShell splashSource={splashSource} headerIconSource={headerIconSource} />
          </PackGate>
        </FirstRunGate>
      </SettingsProvider>
    </I18nProvider>
  );
}
