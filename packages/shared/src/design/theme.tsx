// デザインシステムのテーマ供給。各アプリは root を DesignThemeProvider で包み、
// 自前のテーマモード(light/dark)から scheme を渡す。部品は useTokens() で参照。
import { createContext, useContext, type ReactNode } from 'react';
import { lightPalette, darkPalette, spacing, radius, fontSize, type Palette, type Scheme } from './tokens';

export interface DesignTokens {
  colors: Palette;
  spacing: typeof spacing;
  radius: typeof radius;
  fontSize: typeof fontSize;
  scheme: Scheme;
}

const defaultTokens: DesignTokens = { colors: lightPalette, spacing, radius, fontSize, scheme: 'light' };
const Ctx = createContext<DesignTokens>(defaultTokens);

export function DesignThemeProvider({ scheme, children }: { scheme: Scheme; children: ReactNode }) {
  const colors = scheme === 'dark' ? darkPalette : lightPalette;
  return <Ctx.Provider value={{ colors, spacing, radius, fontSize, scheme }}>{children}</Ctx.Provider>;
}

export const useTokens = (): DesignTokens => useContext(Ctx);
