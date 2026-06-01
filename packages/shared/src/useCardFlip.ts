import { useRef } from 'react';
import { Animated, Easing } from 'react-native';

// カードを裏返す時の控えめな 3D フリップ。
// 0deg → 90deg (edge で不可視) の時点で中身を入れ替え、-90deg → 0deg で戻す。
// これにより文字が鏡像にならず、自然なめくり感を出す。
export function useCardFlip() {
  const rot = useRef(new Animated.Value(0)).current; // -90..90 (度)
  const animating = useRef(false);

  const rotateY = rot.interpolate({
    inputRange: [-90, 0, 90],
    outputRange: ['-90deg', '0deg', '90deg'],
  });

  // swap: 中身を切り替える state 更新関数 (edge の瞬間に呼ぶ)
  const flip = (swap: () => void) => {
    if (animating.current) {
      swap();
      return;
    }
    animating.current = true;
    Animated.timing(rot, {
      toValue: 90,
      duration: 130,
      easing: Easing.in(Easing.ease),
      useNativeDriver: true,
    }).start(() => {
      swap();
      rot.setValue(-90);
      Animated.timing(rot, {
        toValue: 0,
        duration: 130,
        easing: Easing.out(Easing.ease),
        useNativeDriver: true,
      }).start(() => {
        animating.current = false;
      });
    });
  };

  const animatedStyle = {
    transform: [{ perspective: 800 }, { rotateY }] as const,
  };

  return { flip, animatedStyle };
}
