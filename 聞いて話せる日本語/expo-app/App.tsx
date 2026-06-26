// 聞いて話せる日本語 のエントリ。
// UI / ナビゲーション / 画面は @safa/shared に集約。
// アプリ固有: ne UI を Primary、方向は ne→ja を デフォルトに。

// ── v1.3.38 診断: 全importを最小化してネイティブクラッシュか否かを確定 ──────────
import React, { useEffect } from 'react';
import { Text, View } from 'react-native';
import * as SplashScreen from 'expo-splash-screen';

// ネイティブスプラッシュを確実に保持してuseEffectで制御
SplashScreen.preventAutoHideAsync().catch(() => {});

export default function App() {
  useEffect(() => {
    // コンポーネントがマウントされた確実な後に非表示
    SplashScreen.hideAsync().catch(() => {});
  }, []);

  return (
    <View style={{ flex: 1, backgroundColor: '#ff0000', alignItems: 'center', justifyContent: 'center' }}>
      <Text style={{ color: '#fff', fontSize: 28, fontWeight: '700' }}>v1.3.38</Text>
      <Text style={{ color: '#fff', fontSize: 15, marginTop: 8 }}>最小診断: @safa/shared なし</Text>
      <Text style={{ color: '#fff', fontSize: 13, marginTop: 4 }}>赤→JS動作OK / 白→native crash</Text>
    </View>
  );
}

// ── 本来のApp実装(診断中は無効化) ──────────────────────────────────────────────
// import AsyncStorage from '@react-native-async-storage/async-storage';
// import { AppShell, I18nProvider, SettingsProvider, ... } from '@safa/shared';
// ... (全実装はgit履歴に保存)
