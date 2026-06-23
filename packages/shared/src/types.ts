// データモデル

export type Mode = 'conversation' | 'listening' | 'grammar' | 'vocabulary' | 'sakubun' | 'answer';

export interface ThemeMeta {
  id: number;
  name: string;
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
  wordCount: number;
}

export interface Word {
  ja: string;
  ne: string;
}

export interface GrammarThemeMeta {
  id: number;
  name: string;
  exampleCount: number;
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
  ListeningHub: undefined;
  ShortHub: undefined;
  Sakubun: { themeId: number; levelId: number; startIndex?: number };
  VocabCategory: { posterOnly?: boolean } | undefined;
  VocabDirection: { categoryId: number };
  Flashcard: { categoryId: number; direction: 'ne2ja' | 'ja2ne' };
  SettingsMain: undefined;
};
