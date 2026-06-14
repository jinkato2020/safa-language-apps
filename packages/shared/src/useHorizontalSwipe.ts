import { useRef, type MutableRefObject } from 'react';
import { PanResponder } from 'react-native';

// 水平スワイプで前/次へ移動するための PanResponder ハンドラを返す。
// gesture-handler 非依存（react-native 標準の PanResponder）。
//  - onLeft  : 左へスワイプ（指を左へ）= 「次へ」
//  - onRight : 右へスワイプ（指を右へ）= 「前へ」
//
// 重要: このハンドラは ScrollView ではなく、ScrollView を包む親 <View> に付ける。
// ScrollView に直接付けても Android ではタッチを横取りされ発火しないため、
// 親Viewで「横移動だけ」をキャプチャ段階で奪う(縦移動はScrollViewへ通す)。
// blockRef: true の間はスワイプ判定を一切しない（カード上=タップのみにする用）。
export function useHorizontalSwipe(
  onLeft: () => void,
  onRight: () => void,
  blockRef?: MutableRefObject<boolean>,
) {
  // コールバックは毎描画で最新へ更新（responder は初回のみ生成するため stale 回避）。
  const left = useRef(onLeft);
  const right = useRef(onRight);
  left.current = onLeft;
  right.current = onRight;

  // 横移動が縦より大きい時だけ true（縦スクロール・タップは邪魔しない）。
  // 閾値を下げて軽い操作でも横スワイプとして拾う。
  // blockRef が立っている（カードに触れて開始した）ときは横スワイプしない。
  const isHorizontal = (_e: unknown, g: { dx: number; dy: number }) =>
    !(blockRef && blockRef.current) &&
    Math.abs(g.dx) > 10 && Math.abs(g.dx) > Math.abs(g.dy) * 1.2;

  const responder = useRef(
    PanResponder.create({
      // キャプチャ段階で先取り（ScrollView より先に奪う）+ バブル段階も保険で許可
      onMoveShouldSetPanResponderCapture: isHorizontal,
      onMoveShouldSetPanResponder: isHorizontal,
      onPanResponderRelease: (_e, g) => {
        // 距離が十分 or 速い「フリック」でも発火（反応を軽く）
        const DIST = 28;
        const VEL = 0.25;
        if (g.dx <= -DIST || (g.vx <= -VEL && g.dx < 0)) left.current();
        else if (g.dx >= DIST || (g.vx >= VEL && g.dx > 0)) right.current();
      },
      // 一度横スワイプと判定したら ScrollView に責務を渡さない
      onPanResponderTerminationRequest: () => false,
    }),
  ).current;

  return responder.panHandlers;
}
