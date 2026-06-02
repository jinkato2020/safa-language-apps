// 聞いて話せる日本語 のエントリ。
// UI / ナビゲーション / 画面は @safa/shared に集約。
// アプリ固有: ne UI を Primary、方向は ne→ja を デフォルトに。

import { useEffect, useState, type ReactNode } from 'react';
import { ActivityIndicator, View } from 'react-native';
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

// 現在のUI言語(=L1)に応じてデータパックを非同期解決して供給する。
// 今はバンドル即時解決だが、将来 loadPack 内で FS/サーバーDL に差し替えられる継ぎ目。
function PackGate({ children }: { children: ReactNode }) {
  const { lang } = useI18n();
  // 初期はバンドル済みパックを同期解決 (ちらつき防止)
  const [data, setData] = useState<AppData>(() => bundledPack(lang));
  useEffect(() => {
    let alive = true;
    loadPack(lang).then(d => { if (alive) setData(d); });
    return () => { alive = false; };
  }, [lang]);
  if (!data) {
    return (
      <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
        <ActivityIndicator />
      </View>
    );
  }
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
