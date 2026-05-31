import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useI18n } from './i18n';

export type Direction = 'ja2ne' | 'ne2ja';
export type NepaliRepeat = 1 | 2 | 3;
export type ListenSpeed = 0.8 | 1.0 | 1.2 | 1.5;
export type GapMode = 'short' | 'normal' | 'long';
export type ThemeMode = 'light' | 'dark' | 'system';
export type FontMode = 'small' | 'medium' | 'large';

// FontMode → 「強さ」係数
// この値 delta が大きいほど、小さい文字に対してより強くスケールが効く。
// 大きい文字 (>= 30px) には効果が薄く、すでに大きい文字はほぼそのまま。
export const FONT_DELTA: Record<FontMode, number> = {
  small: -0.15, // 「小」: 小さい文字をさらに -15% 縮める (バランス維持)
  medium: 0,    // 「中」: 変化なし
  large: 0.25,  // 「大」: 小さい文字を +25% 拡大する
};

// ベースサイズが小さいほど fontMode の影響を強く受け、
// 大きいほど影響が弱くなる「カーブ」スケーリング。
//
//   baseSize <= 14: factor = 1.0    (全効果適用)
//   baseSize 14-20: factor 1.0 → 0.3 (徐々に弱まる)
//   baseSize 20-30: factor 0.3 → 0  (ほぼ無効化)
//   baseSize >= 30: factor = 0       (変化なし)
//
// 例 (fontMode = 'large', delta = +0.25):
//   12px UI → 12 * (1 + 0.25 * 1.0)  = 15px    (約 25% 拡大)
//   14px ラベル → 14 * (1 + 0.25 * 1.0) = 17.5px (約 25% 拡大)
//   20px 例文 → 20 * (1 + 0.25 * 0.3) = 21.5px (約 7% 拡大)
//   30px ネ文 → 30 * (1 + 0.25 * 0)   = 30px   (変化なし)
function scaledFontSize(baseSize: number, delta: number): number {
  if (delta === 0) return baseSize;
  let factor: number;
  if (baseSize <= 14) factor = 1.0;
  else if (baseSize <= 20) factor = 1.0 - ((baseSize - 14) / 6) * 0.7;
  else if (baseSize <= 30) factor = 0.3 - ((baseSize - 20) / 10) * 0.3;
  else factor = 0;
  return Math.round(baseSize * (1 + delta * factor) * 10) / 10; // 0.1px 単位で丸め
}

// アプリ全体のフォントスケールは Text ラッパー (src/Text.tsx) が一括で行うため、
// useScaleFont / useScaleStyle はパススルー（noop）にしている。二重スケール防止。
// 既存の ss(14, 21) のような呼び出しはそのまま動くが、実質は raw 値を返すだけ。
// Text ラッパーが受け取った fontSize/lineHeight に対して curve-based スケールを適用する。
export function useScaleFont(): (baseSize: number) => number {
  return (baseSize: number) => baseSize;
}

export function useScaleStyle(): (fontSize: number, lineHeight?: number) => { fontSize: number; lineHeight?: number } {
  return (fontSize: number, lineHeight?: number) => {
    if (lineHeight === undefined) return { fontSize };
    return { fontSize, lineHeight };
  };
}

// Text ラッパーが内部で使う実スケーラー
export function useGlobalScaleStyle(): (fontSize: number, lineHeight?: number) => { fontSize: number; lineHeight?: number } {
  const { fontMode } = useSettings();
  const delta = FONT_DELTA[fontMode];
  return (fontSize: number, lineHeight?: number) => {
    const newFs = scaledFontSize(fontSize, delta);
    if (lineHeight === undefined) return { fontSize: newFs };
    const ratio = newFs / fontSize;
    return { fontSize: newFs, lineHeight: lineHeight * ratio };
  };
}

// 後方互換: 旧 API
export function useFontScale(): number {
  const { fontMode } = useSettings();
  return 1 + FONT_DELTA[fontMode];
}

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
const DEFAULT_STORAGE_KEY = '@safa/settings_v1';

export type SettingsDefaults = {
  practiceDirection?: Direction;
  listenDirection?: Direction;
  nepaliRepeat?: NepaliRepeat;
  listenLoop?: boolean;
  listenSpeed?: ListenSpeed;
  gap?: GapMode;
  romaji?: boolean;
  themeMode?: ThemeMode;
  fontMode?: FontMode;
  autoFlip?: boolean;
  shuffle?: boolean;
};

// シリーズ全体の標準デフォルト。アプリ側で上書きしたい項目だけ defaults props で渡す。
const BASE_DEFAULTS = {
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

type ProviderProps = {
  children: ReactNode;
  /** アプリ別に上書きしたい初期値（例: ne2ja モードを初期に置きたいアプリ） */
  defaults?: SettingsDefaults;
  /** AsyncStorage のキー（アプリ別。シリーズ内で衝突しないよう推奨） */
  storageKey?: string;
};

export function SettingsProvider({ children, defaults, storageKey = DEFAULT_STORAGE_KEY }: ProviderProps) {
  // BASE_DEFAULTS にアプリ別 defaults を上書きしたものが実効デフォルト
  const D = { ...BASE_DEFAULTS, ...(defaults ?? {}) };

  // 言語設定 (聞き流しの再生順序の既定を言語に連動させるため)
  const { lang } = useI18n();

  const [practiceDirection, setPracticeDirection] = useState<Direction>(D.practiceDirection);
  // 聞き流しの再生順序: ユーザーが明示的に変更したらその値を優先。
  // 未変更なら言語に連動した既定 (ja→ja2ne / ne→ne2ja)。
  const [listenDirectionRaw, setListenDirectionRaw] = useState<Direction>(D.listenDirection);
  const [listenDirectionExplicit, setListenDirectionExplicit] = useState(false);
  const [nepaliRepeat, setNepaliRepeat] = useState<NepaliRepeat>(D.nepaliRepeat);
  const [listenLoop, setListenLoop] = useState(D.listenLoop);
  const [listenSpeed, setListenSpeed] = useState<ListenSpeed>(D.listenSpeed);
  const [gap, setGap] = useState<GapMode>(D.gap);
  const [romaji, setRomaji] = useState(D.romaji);
  const [themeMode, setThemeMode] = useState<ThemeMode>(D.themeMode);
  const [fontMode, setFontMode] = useState<FontMode>(D.fontMode);
  const [autoFlip, setAutoFlip] = useState(D.autoFlip);
  const [shuffle, setShuffle] = useState(D.shuffle);
  const [loaded, setLoaded] = useState(false);

  // 実効的な再生順序: 明示変更済みなら raw 値、未変更なら言語連動の既定。
  const listenDirection: Direction = listenDirectionExplicit
    ? listenDirectionRaw
    : (lang === 'ne' ? 'ne2ja' : 'ja2ne');
  const setListenDirection = (d: Direction) => {
    setListenDirectionRaw(d);
    setListenDirectionExplicit(true);
  };

  // 初回ロード
  useEffect(() => {
    (async () => {
      try {
        const raw = await AsyncStorage.getItem(storageKey);
        if (raw) {
          const s = JSON.parse(raw);
          if (s.practiceDirection) setPracticeDirection(s.practiceDirection);
          if (s.listenDirection) setListenDirectionRaw(s.listenDirection);
          if (typeof s.listenDirectionExplicit === 'boolean') setListenDirectionExplicit(s.listenDirectionExplicit);
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
      practiceDirection, listenDirection: listenDirectionRaw, listenDirectionExplicit, nepaliRepeat,
      listenLoop, listenSpeed, gap,
      romaji, themeMode, fontMode,
      autoFlip, shuffle,
    };
    AsyncStorage.setItem(storageKey, JSON.stringify(s)).catch(() => {});
  }, [storageKey, loaded, practiceDirection, listenDirectionRaw, listenDirectionExplicit, nepaliRepeat, listenLoop, listenSpeed, gap, romaji, themeMode, fontMode, autoFlip, shuffle]);

  const resetSettings = () => {
    setPracticeDirection(D.practiceDirection);
    setListenDirectionRaw(D.listenDirection);
    setListenDirectionExplicit(false);
    setNepaliRepeat(D.nepaliRepeat);
    setListenLoop(D.listenLoop);
    setListenSpeed(D.listenSpeed);
    setGap(D.gap);
    setRomaji(D.romaji);
    setThemeMode(D.themeMode);
    setFontMode(D.fontMode);
    setAutoFlip(D.autoFlip);
    setShuffle(D.shuffle);
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
