// 聞いて話せる英語 のエントリ。
// 学習対象=英語 / 母語=日本語(単一)。母語が1つなので全同梱(DLパック無し)。
// UI / ナビゲーション / 画面は @safa/shared に集約。UI言語=日本語。

import {
  AppShell,
  I18nProvider,
  SettingsProvider,
  AppDataProvider,
} from '@safa/shared';

import ja from './src/i18n/ja.json';
import { appData } from './src/appData';

const splashSource = require('./assets/safa-splash.mp4');
const headerIconSource = require('./assets/icon.png');

export default function App() {
  return (
    <I18nProvider
      translations={{ ja }}
      fallbackLang="ja"
      selectableLangs={['ja']}
      storageKey="@english_app/lang_v1"
    >
      <SettingsProvider
        defaults={{ practiceDirection: 'ne2ja', listenDirection: 'ne2ja' }}
        storageKey="@english_app/settings_v1"
      >
        <AppDataProvider data={appData}>
          {/* ポスター音声学習は当面非表示(App B同様)。完成したら posterLessons を渡す。 */}
          <AppShell splashSource={splashSource} headerIconSource={headerIconSource} posterLessons={[]} />
        </AppDataProvider>
      </SettingsProvider>
    </I18nProvider>
  );
}
