import { useRef } from 'react';
import { PanResponder } from 'react-native';

// 水平スワイプで前/次へ移動するための PanResponder ハンドラを返す。
// gesture-handler 非依存（react-native 標準の PanResponder）。
//  - onLeft  : 左へスワイプ（指を左へ）= 「次へ」
//  - onRight : 右へスワイプ（指を右へ）= 「前へ」
// 縦スクロールやカードのタップ(フリップ)を邪魔しないよう、
// 横方向に明確に動いたときだけ responder を奪う。
export function useHorizontalSwipe(onLeft: () => void, onRight: () => void) {
  // コールバックは毎描画で最新へ更新（responder は初回のみ生成するため stale 回避）。
  const left = useRef(onLeft);
  const right = useRef(onRight);
  left.current = onLeft;
  right.current = onRight;

  const responder = useRef(
    PanResponder.create({
      // 横移動が縦移動より明確に大きいときだけスワイプとして扱う
      onMoveShouldSetPanResponder: (_e, g) =>
        Math.abs(g.dx) > 24 && Math.abs(g.dx) > Math.abs(g.dy) * 1.4,
      onPanResponderRelease: (_e, g) => {
        if (g.dx <= -45) left.current();
        else if (g.dx >= 45) right.current();
      },
      onPanResponderTerminationRequest: () => true,
    }),
  ).current;

  return responder.panHandlers;
}
