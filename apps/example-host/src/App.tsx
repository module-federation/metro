import React, {useState} from 'react';
import {
  View,
  Text,
  StyleSheet,
  ActivityIndicator,
  Pressable,
} from 'react-native';
import {loadRemote} from '@module-federation/runtime';

import Card from './Card';

// @ts-ignore
const Button = React.lazy(() => loadRemote('mini/button'));

function App(): React.JSX.Element {
  const [shouldLoadRemote, setShouldLoadRemote] = useState(false);

  return (
    <View style={styles.backgroundStyle}>
      <View style={styles.darkOverlay} />
      <View style={styles.contentContainer}>
        <Card title="Federated Remote" description="Dynamically loaded module">
          {!shouldLoadRemote ? (
            <Pressable
              style={styles.defaultButton}
              onPress={() => setShouldLoadRemote(true)}>
              <Text
                testID="load-remote-button"
                style={styles.defaultButtonText}>
                Load Remote Component
              </Text>
            </Pressable>
          ) : (
            <React.Suspense
              fallback={
                <View style={styles.loadingContainer}>
                  <ActivityIndicator size="large" color="#8b5cf6" />
                </View>
              }>
              <Button onPress={() => {}} />
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
  darkOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0, 0, 0, 0.65)',
  },
  contentContainer: {
    flex: 1,
    paddingHorizontal: 24,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    minHeight: 100,
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
