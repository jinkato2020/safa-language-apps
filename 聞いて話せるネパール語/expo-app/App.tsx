// 聞いて話せるネパール語 のエントリ。
// UI / ナビゲーション / 画面は @safa/shared に集約。
// ここではアプリ固有の設定 (翻訳・データ・デフォルト) だけを渡す。

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
      fallbackLang="ja"
      storageKey="@nepali_app/lang_v1"
    >
      <SettingsProvider
        defaults={{ practiceDirection: 'ja2ne', listenDirection: 'ja2ne' }}
        storageKey="@nepali_app/settings_v2"
      >
        <AppDataProvider data={appData}>
          <AppShell splashSource={splashSource} headerIconSource={headerIconSource} />
        </AppDataProvider>
      </SettingsProvider>
    </I18nProvider>
  );
}
