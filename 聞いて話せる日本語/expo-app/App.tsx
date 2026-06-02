// 聞いて話せる日本語 のエントリ。
// UI / ナビゲーション / 画面は @safa/shared に集約。
// アプリ固有: ne UI を Primary、方向は ne→ja を デフォルトに。

import { useEffect, useState, type ReactNode } from 'react';
import { ActivityIndicator, Text, View } from 'react-native';
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

// DLローディング画面 (進捗バー付き)。
function DownloadView({ done, total, label }: { done: number; total: number; label?: string }) {
  const pct = total > 0 ? Math.round((done / total) * 100) : 0;
  return (
    <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', padding: 32 }}>
      <ActivityIndicator />
      <Text style={{ marginTop: 16, fontSize: 13, color: '#52525b' }}>
        {`${label === '展開中' ? 'প্রস্তুত হচ্ছে' : 'ডাউনলোড হচ্ছে'}… ${pct}%`}
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
  useEffect(() => {
    let alive = true;
    const bundled = bundledPack(lang);
    setData(bundled); // 同梱なら即時 / DL言語は null (進捗表示)
    if (!bundled) {
      setProgress({ done: 0, total: 0 });
      loadPack(lang, (done, total, label) => { if (alive) setProgress({ done, total, label }); })
        .then(d => { if (alive) setData(d); })
        .catch(() => { if (alive) setData(bundledPack('ne') ?? null); }); // DL失敗時は主言語へ
    }
    return () => { alive = false; };
  }, [lang]);
  if (!data) return <DownloadView done={progress.done} total={progress.total} label={progress.label} />;
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
