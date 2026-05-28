// グローバルなフォントスケールを適用する Text ラッパー。
// 使用法: import { Text } from '../Text';
//
// 設定の fontMode (大/中/小) に応じて、style の fontSize/lineHeight を
// curve-based scaledFontSize に渡してスケールする。
// 既に大きい文字 (>=30px) はほぼスケールしない (元の比率を維持)
// 小さい文字 (<=14px) は最大限スケールする (UI 要素の可読性向上)

import { Text as RNText, StyleSheet, type TextProps, type TextStyle } from 'react-native';
import { useGlobalScaleStyle } from './SettingsContext';

export function Text(props: TextProps) {
  const ss = useGlobalScaleStyle();
  const flat = StyleSheet.flatten(props.style) as TextStyle | undefined;
  let style: TextProps['style'] = props.style;

  if (flat && typeof flat === 'object' && typeof flat.fontSize === 'number') {
    const oldFs = flat.fontSize;
    const lh = typeof flat.lineHeight === 'number' ? flat.lineHeight : undefined;
    const scaled = ss(oldFs, lh);
    style = { ...flat, ...scaled };
  }
  return <RNText {...props} style={style} />;
}

export default Text;
