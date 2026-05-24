// データモデル

export type Mode = 'conversation' | 'listening' | 'grammar' | 'vocabulary';

export interface ThemeMeta {
  id: number;
  name: string;
  free: boolean;
}

export interface LevelMeta {
  id: number;
  name: string;
  desc: string;
}

export interface Example {
  jp: string;
  ne: string;
}

export interface WordCategoryMeta {
  id: number;
  name: string;
  free: boolean;
  wordCount: number;
}

export interface Word {
  ja: string;
  ne: string;
}

export interface GrammarThemeMeta {
  id: number;
  name: string;
  free: boolean;
  exampleCount: number;
}

export interface FreeTier {
  conversationThemes: number[];
  conversationLevels: number[];
  listeningThemes: number[];
  listeningLevels: number[];
  wordCategories: number[];
  grammarThemes: number[];
}

// ナビゲーション

// ボトムタブ
export type RootTabParamList = {
  ConversationTab: undefined;
  GrammarTab: undefined;
  ListeningTab: undefined;
  VocabularyTab: undefined;
};

// 各タブのスタックは旧 RootStackParamList の screen を共有して利用
export type RootStackParamList = {
  ListenSource: undefined;
  Theme: {
    mode: Exclude<Mode, 'vocabulary'>;
    source?: 'grammar';
  };
  Level: { mode: Exclude<Mode, 'vocabulary' | 'grammar'>; themeId: number };
  Practice: {
    themeId: number;
    levelId?: number;
    startIndex?: number;
    mode?: 'grammar';
  };
  Listening: {
    themeId: number;
    levelId?: number;
    startIndex?: number;
    source?: 'grammar';
  };
  VocabCategory: undefined;
  VocabDirection: { categoryId: number };
  Flashcard: { categoryId: number; direction: 'ne2ja' | 'ja2ne' };
  Paywall: { feature: string };
  SettingsMain: undefined;
};
