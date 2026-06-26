// 聞いて話せる日本語 のエントリ。
// UI / ナビゲーション / 画面は @safa/shared に集約。
// アプリ固有: ne UI を Primary、方向は ne→ja を デフォルトに。

// ── v1.3.39 診断: @safa/shared をimportするだけ(renderしない)で落ちるか確認 ──────
import React, { useEffect } from 'react';
import { Text, View } from 'react-native';
import * as SplashScreen from 'expo-splash-screen';
// @safa/shared をimport (renderはしない)
import { AppShell, I18nProvider, SettingsProvider } from '@safa/shared';

SplashScreen.preventAutoHideAsync().catch(() => {});

export default function App() {
  useEffect(() => {
    SplashScreen.hideAsync().catch(() => {});
  }, []);

  // @safa/shared をimportしているが使わない → import だけでクラッシュするか確認
  void AppShell; void I18nProvider; void SettingsProvider;

  return (
    <View style={{ flex: 1, backgroundColor: '#ff6600', alignItems: 'center', justifyContent: 'center' }}>
      <Text style={{ color: '#fff', fontSize: 28, fontWeight: '700' }}>v1.3.39</Text>
      <Text style={{ color: '#fff', fontSize: 15, marginTop: 8 }}>@safa/shared import済み・render無し</Text>
      <Text style={{ color: '#fff', fontSize: 13, marginTop: 4 }}>橙→importはOK / 白→import時crash</Text>
    </View>
  );
}
