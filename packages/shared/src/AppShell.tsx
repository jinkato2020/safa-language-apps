// シリーズ共通のアプリシェル (ボトムタブ + 各スタックナビ)。
// 各アプリの App.tsx は、これを Provider 群で包んでマウントするだけ。
//
// VideoSplash の動画は アプリ側の assets を使うため props で渡してもらう (各アプリで保持)。

import { useEffect, useRef, useState, type ReactNode, type ReactElement } from 'react';
import { NavigationContainer, useNavigation } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaProvider, useSafeAreaInsets } from 'react-native-safe-area-context';
import { Animated, Dimensions, Pressable, StyleSheet, Text, View } from 'react-native';
import Svg, { Circle, Line, Path, Rect } from 'react-native-svg';
import * as ScreenOrientation from 'expo-screen-orientation';
import { setAudioModeAsync } from 'expo-audio';
import { useVideoPlayer, VideoView } from 'expo-video';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';

import ThemeScreen from './screens/ThemeScreen';
import LevelScreen from './screens/LevelScreen';
import PracticeScreen from './screens/PracticeScreen';
import ListeningScreen from './screens/ListeningScreen';
import VocabCategoryScreen from './screens/VocabCategoryScreen';
import VocabDirectionScreen from './screens/VocabDirectionScreen';
import FlashcardScreen from './screens/FlashcardScreen';
import SettingsScreen from './screens/SettingsScreen';
import { colors } from './theme';
import { useGlobalScaleStyle } from './SettingsContext';
import { useI18n } from './i18n';
import { ListeningAudioProvider } from './ListeningAudioContext';
import type { RootStackParamList } from './types';

const Tab = createBottomTabNavigator();
const ConvStack = createNativeStackNavigator();
const GramStack = createNativeStackNavigator();
const ListenStack = createNativeStackNavigator();
const VocabStack = createNativeStackNavigator();

// ─── タブアイコン ────────────────────────────
function TabIcon({ children, color, focused }: { children: ReactNode; color: string; focused: boolean }) {
  return (
    <Svg width={24} height={24} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={focused ? 2 : 1.6} strokeLinecap="round" strokeLinejoin="round">
      {children}
    </Svg>
  );
}
function ChatIcon({ color, focused }: { color: string; focused: boolean }) {
  return <TabIcon color={color} focused={focused}><Path d="M21 11.5a8.38 8.38 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.38 8.38 0 0 1-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.38 8.38 0 0 1 3.8-.9h.5a8.48 8.48 0 0 1 8 8v.5z" /></TabIcon>;
}
function GrammarIcon({ color, focused }: { color: string; focused: boolean }) {
  return <TabIcon color={color} focused={focused}><Path d="M4 4.5A2.5 2.5 0 0 1 6.5 2H20v15H6.5A2.5 2.5 0 0 0 4 19.5v-15z" /><Path d="M4 19.5A2.5 2.5 0 0 0 6.5 22H20" /><Line x1={8} y1={7} x2={16} y2={7} /><Line x1={8} y1={11} x2={14} y2={11} /></TabIcon>;
}
function HeadphonesIcon({ color, focused }: { color: string; focused: boolean }) {
  return <TabIcon color={color} focused={focused}><Path d="M3 18v-6a9 9 0 0 1 18 0v6" /><Path d="M21 19a2 2 0 0 1-2 2h-1a2 2 0 0 1-2-2v-3a2 2 0 0 1 2-2h3zM3 19a2 2 0 0 0 2 2h1a2 2 0 0 0 2-2v-3a2 2 0 0 0-2-2H3z" /></TabIcon>;
}
function CardsIcon({ color, focused }: { color: string; focused: boolean }) {
  return <TabIcon color={color} focused={focused}><Rect x={3} y={3} width={14} height={14} rx={2} /><Rect x={7} y={7} width={14} height={14} rx={2} /></TabIcon>;
}

// ─── ヘッダー右の歯車ボタン ─────────────────────
function HeaderGearButton() {
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  return (
    <Pressable
      onPress={() => navigation.navigate('SettingsMain')}
      style={({ pressed }) => [headerStyles.gearBtn, pressed && headerStyles.gearBtnPressed]}
      hitSlop={8}
    >
      <Svg width={22} height={22} viewBox="0 0 24 24" fill="none" stroke={colors.ink} strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round">
        <Circle cx={12} cy={12} r={3} />
        <Path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z" />
      </Svg>
    </Pressable>
  );
}

const headerStyles = StyleSheet.create({
  gearBtn: { width: 36, height: 36, alignItems: 'center', justifyContent: 'center', borderRadius: 18 },
  gearBtnPressed: { backgroundColor: colors.bgSoft },
  headerTitle: { fontSize: 16, fontWeight: '700', color: colors.ink, letterSpacing: 0.2 },
});

// ─── ヘッダータイトル (アプリ名・設定言語に連動) ────────────────
// safa ロゴ画像をやめ、設定言語に応じたアプリ名テキストを表示する。
//   ja: 聞いて話せるネパール語 / ne: सुनेर बोल्ने जापानी (聞いて話せる日本語)
function HeaderTitle() {
  const { t } = useI18n();
  return <Text style={headerStyles.headerTitle} numberOfLines={1}>{t('app.headerTitle')}</Text>;
}

// ─── 各タブのスタック ─────────────────────────
function makeDefaultStackOptions(HeaderTitle: () => ReactElement) {
  return {
    headerStyle: { backgroundColor: colors.bg },
    headerTitleStyle: { fontWeight: '600' as const },
    headerTitleAlign: 'center' as const,
    headerTintColor: colors.ink,
    headerShadowVisible: false,
    // 戻るボタンは全言語で「＜」のみ (前画面タイトル文字を出さない)
    headerBackButtonDisplayMode: 'minimal' as const,
    contentStyle: { backgroundColor: colors.bg },
    headerTitle: () => <HeaderTitle />,
    headerRight: () => <HeaderGearButton />,
  };
}

function ConversationStackNav({ defaultStackOptions }: { defaultStackOptions: any }) {
  return (
    <ConvStack.Navigator screenOptions={defaultStackOptions}>
      <ConvStack.Screen name="Theme" component={ThemeScreen} initialParams={{ mode: 'conversation' }} />
      <ConvStack.Screen name="Level" component={LevelScreen} initialParams={{ mode: 'conversation' }} />
      <ConvStack.Screen name="Practice" component={PracticeScreen} />
      <ConvStack.Screen name="SettingsMain" component={SettingsScreen} />
    </ConvStack.Navigator>
  );
}

function GrammarStackNav({ defaultStackOptions }: { defaultStackOptions: any }) {
  return (
    <GramStack.Navigator screenOptions={defaultStackOptions}>
      <GramStack.Screen name="Theme" component={ThemeScreen} initialParams={{ mode: 'grammar' }} />
      <GramStack.Screen name="Practice" component={PracticeScreen} initialParams={{ mode: 'grammar' }} />
      <GramStack.Screen name="SettingsMain" component={SettingsScreen} />
    </GramStack.Navigator>
  );
}

function ListeningStackNav({ defaultStackOptions }: { defaultStackOptions: any }) {
  return (
    <ListenStack.Navigator screenOptions={defaultStackOptions}>
      <ListenStack.Screen name="Theme" component={ThemeScreen} initialParams={{ mode: 'listening' }} />
      <ListenStack.Screen name="Listening" component={ListeningScreen} />
      <ListenStack.Screen name="SettingsMain" component={SettingsScreen} />
    </ListenStack.Navigator>
  );
}

function VocabularyStackNav({ defaultStackOptions }: { defaultStackOptions: any }) {
  return (
    <VocabStack.Navigator screenOptions={defaultStackOptions}>
      <VocabStack.Screen name="VocabCategory" component={VocabCategoryScreen} />
      <VocabStack.Screen name="VocabDirection" component={VocabDirectionScreen} />
      <VocabStack.Screen name="Flashcard" component={FlashcardScreen} />
      <VocabStack.Screen name="SettingsMain" component={SettingsScreen} />
    </VocabStack.Navigator>
  );
}

// ─── ボトムタブ ─────────────────────────────
function MainTabs({ defaultStackOptions }: { defaultStackOptions: any }) {
  const { bottom } = useSafeAreaInsets();
  const { t } = useI18n();
  const ss = useGlobalScaleStyle();
  return (
    <Tab.Navigator
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: colors.ink,
        tabBarInactiveTintColor: colors.inkFaint,
        tabBarStyle: { backgroundColor: colors.bg, borderTopColor: colors.line, height: 64 + bottom, paddingTop: 8, paddingBottom: 8 + bottom },
        tabBarLabelStyle: { ...ss(11), fontWeight: '500' },
      }}
    >
      <Tab.Screen
        name="ConversationTab"
        options={{ title: t('nav.conversation'), tabBarIcon: ChatIcon }}
      >
        {() => <ConversationStackNav defaultStackOptions={defaultStackOptions} />}
      </Tab.Screen>
      <Tab.Screen
        name="GrammarTab"
        options={{ title: t('nav.grammar'), tabBarIcon: GrammarIcon }}
      >
        {() => <GrammarStackNav defaultStackOptions={defaultStackOptions} />}
      </Tab.Screen>
      <Tab.Screen
        name="ListeningTab"
        options={{ title: t('nav.listening'), tabBarIcon: HeadphonesIcon }}
      >
        {() => <ListeningStackNav defaultStackOptions={defaultStackOptions} />}
      </Tab.Screen>
      <Tab.Screen
        name="VocabularyTab"
        options={{ title: t('nav.vocabulary'), tabBarIcon: CardsIcon }}
      >
        {() => <VocabularyStackNav defaultStackOptions={defaultStackOptions} />}
      </Tab.Screen>
    </Tab.Navigator>
  );
}

// ─── safa ロゴスプラッシュ ────────────────────────
function VideoSplash({ source, onDone }: { source: number; onDone: () => void }) {
  const { t } = useI18n();
  const player = useVideoPlayer(source, p => {
    p.loop = false;
    p.audioMixingMode = 'mixWithOthers';
    p.muted = true;
    p.play();
  });

  useEffect(() => {
    let done = false;
    const handleDone = async () => {
      if (done) return;
      done = true;
      try {
        await setAudioModeAsync({
          playsInSilentMode: true,
          shouldPlayInBackground: true,
          interruptionMode: 'doNotMix',
        });
      } catch {}
      onDone();
    };
    const sub = player.addListener('playToEnd', () => { handleDone(); });
    // safety fallback: 動画が再生できない/イベントが発火しない場合でも
    // 10 秒で次の画面へ進む。ユーザーがスプラッシュで詰まらないようにする。
    const timeout = setTimeout(() => { handleDone(); }, 10000);
    return () => {
      sub.remove();
      clearTimeout(timeout);
    };
  }, [player]);

  return (
    <View style={splashStyles.container}>
      <VideoView player={player} style={splashStyles.video} nativeControls={false} contentFit="contain" />
      {/* スプラッシュ下にアプリ名を設定言語で表示 (黒字) */}
      <Text style={splashStyles.appName} numberOfLines={2}>{t('app.headerTitle')}</Text>
    </View>
  );
}

const splashStyles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#ffffff', alignItems: 'center', justifyContent: 'center' },
  video: { width: '50%', height: '50%' },
  // 動画の下の余白を詰めてアプリ名をスプラッシュ直下へ引き上げる (負の marginTop)
  appName: { marginTop: -48, fontSize: 20, fontWeight: '700', color: '#000000', textAlign: 'center', paddingHorizontal: 24, letterSpacing: 0.3 },
});

// ─── AppShell: VideoSplash → MainTabs ──────────────────
export type AppShellProps = {
  /** 各アプリの assets から渡してもらうスプラッシュ動画 (require('./assets/safa-splash.mp4')) */
  splashSource: number;
  /** (旧) ヘッダーアイコン。現在はテキストタイトルに置き換えたため未使用 (互換のため任意で受け取る) */
  headerIconSource?: number;
};

export function AppShell({ splashSource }: AppShellProps) {
  const [splashDone, setSplashDone] = useState(false);
  const defaultStackOptions = useRef(makeDefaultStackOptions(HeaderTitle)).current;

  useEffect(() => {
    setAudioModeAsync({
      playsInSilentMode: true,
      shouldPlayInBackground: true,
      interruptionMode: 'doNotMix',
    }).catch(() => {});
  }, []);

  // 画面回転ポリシー: タブレット(最小辺>=600dp)は縦横自由、スマホは縦固定。
  useEffect(() => {
    const { width, height } = Dimensions.get('window');
    const isTablet = Math.min(width, height) >= 600;
    if (isTablet) {
      ScreenOrientation.unlockAsync().catch(() => {});
    } else {
      ScreenOrientation.lockAsync(ScreenOrientation.OrientationLock.PORTRAIT_UP).catch(() => {});
    }
  }, []);

  if (!splashDone) {
    return <VideoSplash source={splashSource} onDone={() => setSplashDone(true)} />;
  }

  return (
    <SafeAreaProvider>
      <NavigationContainer>
        <StatusBar style="dark" />
        <ListeningAudioProvider>
          <MainTabs defaultStackOptions={defaultStackOptions} />
        </ListeningAudioProvider>
      </NavigationContainer>
    </SafeAreaProvider>
  );
}
