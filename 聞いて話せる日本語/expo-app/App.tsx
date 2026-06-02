// 聞いて話せる日本語 のエントリ。
// UI / ナビゲーション / 画面は @safa/shared に集約。
// アプリ固有: ne UI を Primary、方向は ne→ja を デフォルトに。

import type { ReactNode } from 'react';
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
import { appData } from './src/appData';
import { appDataBn } from './src/appDataBn';

const splashSource = require('./assets/safa-splash.mp4');
const headerIconSource = require('./assets/icon.png');

// 母語(L1)パック・レジストリ。UI言語をキーに対応パックを選択する (X案: UI言語=L1)。
// 'ja' UI のときは相手言語パックとして既定 (ne) を使う。
const PACKS: Record<string, AppData> = { ne: appData, bn: appDataBn };

// 現在のUI言語に応じてデータパックを切り替える。
function PackGate({ children }: { children: ReactNode }) {
  const { lang } = useI18n();
  const data = PACKS[lang] ?? appData;
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
