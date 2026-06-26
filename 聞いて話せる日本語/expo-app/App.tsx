// 聞いて話せる日本語 のエントリ。
// UI / ナビゲーション / 画面は @safa/shared に集約。
// アプリ固有: ne UI を Primary、方向は ne→ja を デフォルトに。

// ── v1.3.41 診断: AppShell を除いた @safa/shared (I18n/Settings のみ) でクラッシュするか ──
import React, { useEffect } from 'react';
import { Text, View } from 'react-native';
import * as SplashScreen from 'expo-splash-screen';
// AppShell を除外 → expo-video/expo-audio/expo-screen-orientation 等の native import をスキップ
import { I18nProvider, SettingsProvider } from '@safa/shared';

SplashScreen.preventAutoHideAsync().catch(() => {});

export default function App() {
  useEffect(() => {
    SplashScreen.hideAsync().catch(() => {});
  }, []);

  void I18nProvider; void SettingsProvider;

  return (
    <View style={{ flex: 1, backgroundColor: '#0055cc', alignItems: 'center', justifyContent: 'center' }}>
      <Text style={{ color: '#fff', fontSize: 28, fontWeight: '700' }}>v1.3.41</Text>
      <Text style={{ color: '#fff', fontSize: 15, marginTop: 8 }}>AppShell除外・I18n+Settings のみ</Text>
      <Text style={{ color: '#fff', fontSize: 13, marginTop: 4 }}>青→AppShellが原因 / 白→他が原因</Text>
    </View>
  );
}
