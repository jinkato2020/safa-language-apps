// 聞いて話せる日本語 のエントリ。
// UI / ナビゲーション / 画面は @safa/shared に集約。
// アプリ固有: ne UI を Primary、方向は ne→ja を デフォルトに。

import {
  AppShell,
  I18nProvider,
  SettingsProvider,
  AppDataProvider,
} from '@safa/shared';

import ja from './src/i18n/ja.json';
import ne from './src/i18n/ne.json';
import { appData } from './src/appData';

const splashSource = require('./assets/safa-splash.mp4');
const headerIconSource = require('./assets/icon.png');

export default function App() {
  return (
    <I18nProvider
      translations={{ ja, ne }}
      fallbackLang="ne"
      storageKey="@japanese_app/lang_v1"
    >
      <SettingsProvider
        defaults={{ practiceDirection: 'ne2ja', listenDirection: 'ne2ja' }}
        storageKey="@japanese_app/settings_v2"
      >
        <AppDataProvider data={appData}>
          <AppShell splashSource={splashSource} headerIconSource={headerIconSource} />
        </AppDataProvider>
      </SettingsProvider>
    </I18nProvider>
  );
}
