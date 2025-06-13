import type LottieView from 'lottie-react-native';
import React, { useRef, useState } from 'react';
import {
  ActivityIndicator,
  Image,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';

import Card from './Card';
// @ts-ignore
import gradientBg from './aura.png';

// @ts-ignore
const Button = React.lazy(() => import('mini/button'));

// @ts-ignore
const Confetti = React.lazy(() => import('mini/confetti'));

function App(): React.JSX.Element {
  const animationRef = useRef<LottieView>(null);
  const [shouldLoadRemote, setShouldLoadRemote] = useState(false);

  return (
    <View style={styles.backgroundStyle}>
      {shouldLoadRemote ? (
        <React.Suspense>
          <Confetti ref={animationRef} />
        </React.Suspense>
      ) : undefined}
      <Image
        source={gradientBg}
        style={styles.backgroundImage}
        resizeMode="cover"
      />
      <View style={styles.darkOverlay} />
      <View style={styles.contentContainer}>
        <View style={styles.headerContainer}>
          <Text style={styles.headerText}>Module Federation in Metro</Text>
          <Text style={styles.subheaderText}>
            Host providing shared dependencies
          </Text>
        </View>
        <Card title="Federated Remote" description="Dynamically loaded module">
          {!shouldLoadRemote ? (
            <Pressable
              style={styles.defaultButton}
              onPress={() => setShouldLoadRemote(true)}
            >
              <Text
                testID="load-remote-button"
                style={styles.defaultButtonText}
              >
                Load Remote Component
              </Text>
            </Pressable>
          ) : (
            <React.Suspense
              fallback={
                <View style={styles.loadingContainer}>
                  <ActivityIndicator size="large" color="#8b5cf6" />
                </View>
              }
            >
              <Button
                onPress={() =>
                  setTimeout(() => animationRef.current?.play(), 1000)
                }
              />
            </React.Suspense>
          )}
        </Card>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  backgroundStyle: {
    flex: 1,
  },
  backgroundImage: {
    ...StyleSheet.absoluteFillObject,
    width: '100%',
    height: '100%',
  },
  darkOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0, 0, 0, 0.65)',
  },
  contentContainer: {
    flex: 1,
    paddingHorizontal: 24,
  },
  headerContainer: {
    marginTop: 120,
    paddingVertical: 24,
    paddingHorizontal: 24,
    backgroundColor: 'rgba(255, 255, 255, 1)',
    borderRadius: 12,
    marginBottom: 24,
  },
  headerText: {
    fontSize: 24,
    fontWeight: '700',
    color: '#000',
    marginBottom: 4,
  },
  subheaderText: {
    fontSize: 14,
    color: '#a1a1aa',
    fontWeight: '500',
  },
  mainContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  miniappSection: {
    width: '100%',
    maxWidth: 400,
    marginVertical: 20,
    zIndex: 1,
  },
  miniappCaption: {
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderWidth: 2,
    borderColor: 'rgba(255, 255, 255, 0.1)',
    borderRadius: 16,
    borderBottomLeftRadius: 0,
    borderBottomRightRadius: 0,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
  },
  miniappHighlight: {
    justifyContent: 'center',
    alignItems: 'center',
    width: '100%',
    backgroundColor: 'rgba(255, 255, 255, 0.95)',
    borderRadius: 16,
    borderTopLeftRadius: 0,
    borderTopRightRadius: 0,
    borderColor: 'rgba(255, 255, 255, 0.1)',
    borderWidth: 2,
    shadowColor: '#8b5cf6',
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.25,
    shadowRadius: 8,
    elevation: 5,
    padding: 20,
    minHeight: 150,
  },
  miniappTitle: {
    fontSize: 20,
    fontWeight: '600',
    color: '#fff',
    marginBottom: 4,
  },
  miniappDescription: {
    fontSize: 14,
    color: '#a1a1aa',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    minHeight: 100,
  },
  loadingText: {
    fontSize: 16,
    color: '#71717a',
    textAlign: 'center',
  },
  defaultButton: {
    backgroundColor: '#000',
    padding: 16,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
    alignSelf: 'center',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.1)',
  },
  defaultButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
    letterSpacing: 0.5,
  },
});

export default App;
