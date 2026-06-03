// 聞いて話せる日本語 のエントリ。
// UI / ナビゲーション / 画面は @safa/shared に集約。
// アプリ固有: ne UI を Primary、方向は ne→ja を デフォルトに。

import { useEffect, useState, type ReactNode } from 'react';
import { ActivityIndicator, Pressable, Text, View } from 'react-native';
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
import { bundledPack, loadPack } from './src/packLoader';

const splashSource = require('./assets/safa-splash.mp4');
const headerIconSource = require('./assets/icon.png');

// DL画面の文言 (UI言語=L1ごと)。
const DL_TEXT: Record<string, { dl: string; prep: string; fail: string; retry: string }> = {
  ne: { dl: 'डाउनलोड हुँदैछ', prep: 'तयार पारिँदैछ', fail: 'डाउनलोड असफल भयो', retry: 'पुनः प्रयास गर्नुहोस्' },
  bn: { dl: 'ডাউনলোড হচ্ছে', prep: 'প্রস্তুত হচ্ছে', fail: 'ডাউনলোড ব্যর্থ হয়েছে', retry: 'আবার চেষ্টা করুন' },
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
        {`${label === '展開中' ? t.prep : t.dl}… ${pct}%`}
      </Text>
      <View style={{ marginTop: 12, width: 220, height: 6, borderRadius: 3, backgroundColor: '#e4e4e7', overflow: 'hidden' }}>
        <View style={{ width: `${pct}%`, height: '100%', backgroundColor: '#2563eb' }} />
      </View>
    </View>
  );
}

// 現在のUI言語(=L1)に応じてデータパックを解決して供給する。
// 同梱言語(ne)は即時。DL言語(bn等)は null→進捗バー表示→DL完了で差し替え。
function PackGate({ children }: { children: ReactNode }) {
  const { lang } = useI18n();
  const [data, setData] = useState<AppData | null>(() => bundledPack(lang));
  const [progress, setProgress] = useState<{ done: number; total: number; label?: string }>({ done: 0, total: 0 });
  const [error, setError] = useState(false);
  const [errMsg, setErrMsg] = useState<string>('');
  const [attempt, setAttempt] = useState(0);
  useEffect(() => {
    let alive = true;
    const bundled = bundledPack(lang);
    if (bundled) { setData(bundled); return; } // 同梱(現状なし)なら即時
    // 母語はすべてDL。null→進捗バー、失敗→再試行画面(エラー内容も表示)。
    setData(null); setError(false); setErrMsg(''); setProgress({ done: 0, total: 0 });
    loadPack(lang, (done, total, label) => { if (alive) setProgress({ done, total, label }); })
      .then(d => { if (alive) setData(d); })
      .catch((e: any) => { if (alive) { setErrMsg(String(e?.message ?? e)); setError(true); } });
    return () => { alive = false; };
  }, [lang, attempt]);
  if (error) return <DownloadView done={0} total={0} lang={lang} error errMsg={errMsg} onRetry={() => setAttempt(a => a + 1)} />;
  if (!data) return <DownloadView done={progress.done} total={progress.total} label={progress.label} lang={lang} />;
  return <AppDataProvider data={data}>{children}</AppDataProvider>;
}

export default function App() {
  return (
    <I18nProvider
      translations={{ ja, ne, bn }}
      fallbackLang="ne"
      storageKey="@japanese_app/lang_v1"
    >
      <SettingsProvider
        defaults={{ practiceDirection: 'ne2ja', listenDirection: 'ne2ja' }}
        storageKey="@japanese_app/settings_v2"
      >
        <PackGate>
          <AppShell splashSource={splashSource} headerIconSource={headerIconSource} />
        </PackGate>
      </SettingsProvider>
    </I18nProvider>
  );
}
