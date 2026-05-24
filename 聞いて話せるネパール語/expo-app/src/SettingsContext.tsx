import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';

export type Direction = 'ja2ne' | 'ne2ja';
export type NepaliRepeat = 1 | 2 | 3;
export type ListenSpeed = 0.8 | 1.0 | 1.2 | 1.5;
export type GapMode = 'short' | 'normal' | 'long';
export type ThemeMode = 'light' | 'dark' | 'system';
export type FontMode = 'small' | 'medium' | 'large';

type Settings = {
  // 音声
  practiceDirection: Direction;
  setPracticeDirection: (d: Direction) => void;
  listenDirection: Direction;
  setListenDirection: (d: Direction) => void;
  nepaliRepeat: NepaliRepeat;
  setNepaliRepeat: (n: NepaliRepeat) => void;
  listenLoop: boolean;
  setListenLoop: (v: boolean) => void;
  listenSpeed: ListenSpeed;
  setListenSpeed: (s: ListenSpeed) => void;
  gap: GapMode;
  setGap: (g: GapMode) => void;
  // 表示
  romaji: boolean;
  setRomaji: (v: boolean) => void;
  themeMode: ThemeMode;
  setThemeMode: (m: ThemeMode) => void;
  fontMode: FontMode;
  setFontMode: (m: FontMode) => void;
  // 学習
  autoFlip: boolean;
  setAutoFlip: (v: boolean) => void;
  shuffle: boolean;
  setShuffle: (v: boolean) => void;
  // データ管理
  resetSettings: () => void;
};

const SettingsCtx = createContext<Settings | null>(null);
const STORAGE_KEY = '@nepali_app/settings_v2';

const DEFAULTS = {
  practiceDirection: 'ja2ne' as Direction,
  listenDirection: 'ja2ne' as Direction,
  nepaliRepeat: 1 as NepaliRepeat,
  listenLoop: true,
  listenSpeed: 1.0 as ListenSpeed,
  gap: 'normal' as GapMode,
  romaji: true,
  themeMode: 'system' as ThemeMode,
  fontMode: 'medium' as FontMode,
  autoFlip: false,
  shuffle: false,
};

export function SettingsProvider({ children }: { children: ReactNode }) {
  const [practiceDirection, setPracticeDirection] = useState<Direction>(DEFAULTS.practiceDirection);
  const [listenDirection, setListenDirection] = useState<Direction>(DEFAULTS.listenDirection);
  const [nepaliRepeat, setNepaliRepeat] = useState<NepaliRepeat>(DEFAULTS.nepaliRepeat);
  const [listenLoop, setListenLoop] = useState(DEFAULTS.listenLoop);
  const [listenSpeed, setListenSpeed] = useState<ListenSpeed>(DEFAULTS.listenSpeed);
  const [gap, setGap] = useState<GapMode>(DEFAULTS.gap);
  const [romaji, setRomaji] = useState(DEFAULTS.romaji);
  const [themeMode, setThemeMode] = useState<ThemeMode>(DEFAULTS.themeMode);
  const [fontMode, setFontMode] = useState<FontMode>(DEFAULTS.fontMode);
  const [autoFlip, setAutoFlip] = useState(DEFAULTS.autoFlip);
  const [shuffle, setShuffle] = useState(DEFAULTS.shuffle);
  const [loaded, setLoaded] = useState(false);

  // 初回ロード
  useEffect(() => {
    (async () => {
      try {
        const raw = await AsyncStorage.getItem(STORAGE_KEY);
        if (raw) {
          const s = JSON.parse(raw);
          if (s.practiceDirection) setPracticeDirection(s.practiceDirection);
          if (s.listenDirection) setListenDirection(s.listenDirection);
          if (s.nepaliRepeat) setNepaliRepeat(s.nepaliRepeat);
          if (typeof s.listenLoop === 'boolean') setListenLoop(s.listenLoop);
          if (s.listenSpeed) setListenSpeed(s.listenSpeed);
          if (s.gap) setGap(s.gap);
          if (typeof s.romaji === 'boolean') setRomaji(s.romaji);
          if (s.themeMode) setThemeMode(s.themeMode);
          if (s.fontMode) setFontMode(s.fontMode);
          if (typeof s.autoFlip === 'boolean') setAutoFlip(s.autoFlip);
          if (typeof s.shuffle === 'boolean') setShuffle(s.shuffle);
        }
      } catch {}
      setLoaded(true);
    })();
  }, []);

  // 変更ごとに保存
  useEffect(() => {
    if (!loaded) return;
    const s = {
      practiceDirection, listenDirection, nepaliRepeat,
      listenLoop, listenSpeed, gap,
      romaji, themeMode, fontMode,
      autoFlip, shuffle,
    };
    AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(s)).catch(() => {});
  }, [loaded, practiceDirection, listenDirection, nepaliRepeat, listenLoop, listenSpeed, gap, romaji, themeMode, fontMode, autoFlip, shuffle]);

  const resetSettings = () => {
    setPracticeDirection(DEFAULTS.practiceDirection);
    setListenDirection(DEFAULTS.listenDirection);
    setNepaliRepeat(DEFAULTS.nepaliRepeat);
    setListenLoop(DEFAULTS.listenLoop);
    setListenSpeed(DEFAULTS.listenSpeed);
    setGap(DEFAULTS.gap);
    setRomaji(DEFAULTS.romaji);
    setThemeMode(DEFAULTS.themeMode);
    setFontMode(DEFAULTS.fontMode);
    setAutoFlip(DEFAULTS.autoFlip);
    setShuffle(DEFAULTS.shuffle);
  };

  return (
    <SettingsCtx.Provider
      value={{
        practiceDirection, setPracticeDirection,
        listenDirection, setListenDirection,
        nepaliRepeat, setNepaliRepeat,
        listenLoop, setListenLoop,
        listenSpeed, setListenSpeed,
        gap, setGap,
        romaji, setRomaji,
        themeMode, setThemeMode,
        fontMode, setFontMode,
        autoFlip, setAutoFlip,
        shuffle, setShuffle,
        resetSettings,
      }}
    >
      {children}
    </SettingsCtx.Provider>
  );
}

export function useSettings(): Settings {
  const ctx = useContext(SettingsCtx);
  if (!ctx) throw new Error('useSettings must be used inside <SettingsProvider>');
  return ctx;
}
