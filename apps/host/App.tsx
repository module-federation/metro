import React from 'react';
import {View, Text, StyleSheet} from 'react-native';
import {loadRemote} from '@module-federation/runtime';

// @ts-ignore
const Miniapp = React.lazy(() => loadRemote('mini/math'));

function App(): React.JSX.Element {
  return (
    <View style={styles.backgroundStyle}>
      <View style={styles.headerContainer}>
        <Text style={styles.headerText}>Module Federation in Metro</Text>
        <Text style={styles.subheaderText}>
          Host providing shared dependencies
        </Text>
      </View>
      <View style={styles.mainContainer}>
        <View style={StyleSheet.absoluteFillObject} />
        <View style={styles.miniappSection}>
          <View style={styles.miniappCaption}>
            <Text style={styles.miniappTitle}>Federated Remote</Text>
            <Text style={styles.miniappDescription}>
              Dynamically loaded module
            </Text>
          </View>
          <View style={styles.miniappHighlight}>
            <React.Suspense
              fallback={
                <View style={styles.loadingContainer}>
                  <Text style={styles.loadingText}>Loading Mini App...</Text>
                </View>
              }>
              <Miniapp />
            </React.Suspense>
          </View>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  backgroundStyle: {
    flex: 1,
    backgroundColor: '#000',
  },
  headerContainer: {
    marginTop: 120,
    marginHorizontal: 24,
    paddingVertical: 24,
    paddingHorizontal: 24,
    backgroundColor: '#fff',
    borderRadius: 12,
  },
  headerText: {
    fontSize: 24,
    fontWeight: '700',
    color: '#000',
    marginBottom: 8,
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
    backgroundColor: '#000',
  },
  miniappSection: {
    width: '90%',
    maxWidth: 400,
    marginVertical: 20,
    zIndex: 1,
  },
  miniappCaption: {
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderWidth: 2,
    borderColor: '#222',
    borderRadius: 16,
    borderBottomLeftRadius: 0,
    borderBottomRightRadius: 0,
  },
  miniappHighlight: {
    width: '100%',
    backgroundColor: 'rgba(255, 255, 255, 0.95)',
    borderRadius: 16,
    borderTopLeftRadius: 0,
    borderTopRightRadius: 0,
    borderColor: '#fff',
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
});

export default App;
