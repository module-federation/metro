import LottieView from 'lottie-react-native';
import React from 'react';
import { Pressable, StyleSheet } from 'react-native';

type Props = {
  onPress: () => void;
};

export default function Button({ onPress }: Props) {
  const animationRef = React.useRef<LottieView>(null);

  function handlePress() {
    animationRef.current?.play();
    onPress();
  }

  return (
    <Pressable testID="gift-button" style={styles.button} onPress={handlePress}>
      <LottieView
        ref={animationRef}
        source={require('./gift-asset.json')}
        style={styles.animation}
        loop={false}
      />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  button: {
    height: 50,
    width: 100,
    padding: 8,
  },
  animation: {
    width: 100,
    height: 100,
    position: 'absolute',
    top: -50,
  },
});
