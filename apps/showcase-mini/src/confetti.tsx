import LottieView from 'lottie-react-native';
import type { Ref } from 'react';
import { StyleSheet, View, useWindowDimensions } from 'react-native';

type Props = {
  ref: Ref<LottieView>;
};

export default function Confetti({ ref }: Props) {
  const { width, height } = useWindowDimensions();

  return (
    <View pointerEvents="none" style={[styles.container, { width, height }]}>
      <LottieView
        ref={ref}
        source={require('./confetti-asset.json')}
        style={styles.animation}
        loop={false}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    position: 'absolute',
    zIndex: 1000,
    bottom: 0,
    left: 0,
  },
  animation: {
    width: '100%',
    height: '100%',
  },
});
