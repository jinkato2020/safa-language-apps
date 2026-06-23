// 共有デザインシステムのトークン(単一ソース)。ライト/ダーク両対応。
// 既存 theme.ts(ライト・アクセント2色のみ)を内包しつつ、ステータス色/ダークを補完。
// 各アプリは DesignThemeProvider に scheme を渡して使用。中身(データ)は各アプリ固有。
export interface Palette {
  bg: string;        // 画面背景
  bgSoft: string;    // 一段沈めた面(空セル等)
  surface: string;   // カード面
  ink: string;       // 主要テキスト
  ink2: string;      // 副テキスト
  mute: string;      // 抑えめテキスト
  faint: string;     // さらに薄い
  trace: string;     // 最薄(未測定/プレースホルダ)
  line: string;      // 罫線/枠
  primary: string;       // 主要アクション(青)
  primaryLight: string;  // 主要の淡色背景
  primaryDark: string;   // 主要の濃色テキスト
  onPrimary: string;     // primary上の文字
  success: string;   // 良好(緑)
  warn: string;      // 注意(琥珀)
  danger: string;    // 危険(赤)
  streak: string;    // 継続(橙)
}

export const lightPalette: Palette = {
  bg: '#ffffff',
  bgSoft: '#f1f5f9',
  surface: '#ffffff',
  ink: '#0f172a',
  ink2: '#334155',
  mute: '#64748b',
  faint: '#94a3b8',
  trace: '#cbd5e1',
  line: '#e4e4e7',
  primary: '#2563eb',
  primaryLight: '#dbeafe',
  primaryDark: '#1e40af',
  onPrimary: '#ffffff',
  success: '#16a34a',
  warn: '#f59e0b',
  danger: '#dc2626',
  streak: '#f97316',
};

export const darkPalette: Palette = {
  bg: '#0b1220',
  bgSoft: '#111a2e',
  surface: '#16213a',
  ink: '#f1f5f9',
  ink2: '#cbd5e1',
  mute: '#94a3b8',
  faint: '#64748b',
  trace: '#475569',
  line: '#2a3650',
  primary: '#3b82f6',
  primaryLight: '#1e3a5f',
  primaryDark: '#93c5fd',
  onPrimary: '#ffffff',
  success: '#22c55e',
  warn: '#fbbf24',
  danger: '#f87171',
  streak: '#fb923c',
};

export const spacing = { xs: 4, sm: 8, md: 16, lg: 24, xl: 32, xxl: 48 } as const;
export const radius = { sm: 6, md: 10, lg: 16, xl: 20, pill: 999 } as const;
export const fontSize = { tiny: 11, small: 13, body: 15, h2: 18, h1: 24 } as const;

export type Scheme = 'light' | 'dark';
