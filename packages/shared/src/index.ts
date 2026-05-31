// @safa/shared パブリック API
// アプリ側からは `import { ... } from '@safa/shared'` で取得する。

// ── プロバイダー (root で組み合わせる) ──
export { I18nProvider, useI18n, type Lang } from './i18n';
export {
  SettingsProvider, useSettings, useScaleFont, useScaleStyle, useGlobalScaleStyle, useFontScale,
  FONT_DELTA,
  type Direction, type NepaliRepeat, type ListenSpeed, type GapMode, type ThemeMode, type FontMode,
  type SettingsDefaults,
} from './SettingsContext';
export {
  AppDataProvider, useAppData,
  type AppData, type AudioBundle, type VocabEntry,
  type GrammarVocab, type GrammarVocabEntry, type GrammarVocabContext,
  type JpReading, type JpReadingEntry,
} from './AppDataContext';

// ── UI ヘルパー ──
export { Text } from './Text';
export { colors, spacing, radius } from './theme';
export { toRomaji, sentenceToRomaji } from './transliterate';

// ── 型 ──
export type {
  Mode, ThemeMeta, LevelMeta, Example, WordCategoryMeta, Word, GrammarThemeMeta,
  RootStackParamList, RootTabParamList,
} from './types';

// ── AppShell (Provider 群で包んでマウントする) ──
export { AppShell, type AppShellProps } from './AppShell';

// ── 画面 (個別利用する場合のみ。通常は AppShell 経由) ──
export { default as ListenSourceScreen } from './screens/ListenSourceScreen';
export { default as ThemeScreen } from './screens/ThemeScreen';
export { default as LevelScreen } from './screens/LevelScreen';
export { default as PracticeScreen } from './screens/PracticeScreen';
export { default as ListeningScreen } from './screens/ListeningScreen';
export { default as VocabCategoryScreen } from './screens/VocabCategoryScreen';
export { default as VocabDirectionScreen } from './screens/VocabDirectionScreen';
export { default as FlashcardScreen } from './screens/FlashcardScreen';
export { default as SettingsScreen } from './screens/SettingsScreen';
