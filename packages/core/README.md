# `@module-federation/metro`

## Getting started

### Installation

Use your favorite package manager to install these required packages to your React Native project.

```shell
# Using pnpm
pnpm add @module-federation/metro

# If your project is using React Native CLI
pnpm add @module-federation/metro-plugin-rnc-cli

# If your project is using RNEF
pnpm add @module-federation/metro-plugin-rnef
```

### Configuration

Wrap Metro configuration with `withModuleFederation` function that enables module federation in your project.
You should be wrapping all the federated modules' Metro configuration in this hook: host application and mini applications.

```javascript
const { withModuleFederation } = require('@module-federation/metro');
const { getDefaultConfig, mergeConfig } = require('@react-native/metro-config');

const config = {};

module.exports = withModuleFederation(
  mergeConfig(getDefaultConfig(__dirname), config),
  {
    // Module Federation configuration follows the same format as documented at:
    // https://module-federation.io/configure/index.html
    // Note: Some features might not be available in React Native environment
    name: 'YourAppName',
    remotes: {
      // Define remote applications (for host apps)
      // remoteName: 'remoteName@http://localhost:8082/mf-manifest.json',
    },
    exposes: {
      // Expose modules (for remote apps)
      // './Component': './src/Component.tsx',
    },
    shared: {
      // Host applications should set eager: true for all the shared dependencies
      react: {
        singleton: true,
        eager: true,
        requiredVersion: '19.1.0',
        version: '19.1.0',
      },
      'react-native': {
        singleton: true,
        eager: true,
        requiredVersion: '0.80.0',
        version: '0.80.0',
      },
    },
  },
  {
    // These experimental flags have to be enabled in order to patch older packages
    // Can be omitted if your project is using supported React Native and Metro versions
    flags: {
      // Enable patching HMR Client from React Native
      unstable_patchHMRClient: true,
      // Enable patching React Native CLI
      unstable_patchInitializeCore: true,
      // Enable patching runtime require from Metro
      unstable_patchRuntimeRequire: true,
    },
  }
);
```

#### Additional Configuration for RNEF Users

If you're using React Native Enterprise Framework (RNEF), follow the additional configuration instructions in the [RNEF Plugin README](../plugin-rnef/README.md).

### App Async Boundary Setup

Wrap your main App component with `withAsyncStartup` to enable Module Federation runtime. This creates an async boundary that ensures the Module Federation runtime is properly initialized before your app component renders.

```javascript
import { withAsyncStartup } from '@module-federation/runtime';
import { AppRegistry } from 'react-native';

// Create async boundary through withAsyncStartup helper
// Pass the getter function for the app component
// Optionally pass a getter function for the fallback component
const WrappedApp = withAsyncStartup(
  () => require('./App'),
  () => require('./Fallback') // Optional fallback component
);

AppRegistry.registerComponent('YourAppName', WrappedApp);
```

The `withAsyncStartup` function:
- Waits for Module Federation runtime initialization before rendering your app
- Uses React Suspense to handle the async loading
- Accepts an optional fallback component to show during initialization

## API Reference

### `withModuleFederation(metroConfig, federationConfig, options?)`

Wraps your Metro configuration to enable Module Federation.

#### Parameters

- `metroConfig` (MetroConfig) - Your existing Metro configuration
- `federationConfig` (FederationConfig) - Module Federation configuration
- `options` (Options) - Optional configuration for experimental features

#### FederationConfig

```typescript

export interface ModuleFederationConfig {
  name: string;
  filename?: string;
  remotes?: Record<string, string>;
  exposes?: Record<string, string>;
  shared?: Shared;
  shareStrategy?: 'loaded-first' | 'version-first';
  plugins?: string[];
}
```

#### SharedConfig

```typescript
export interface SharedConfig {
  singleton: boolean;
  eager: boolean;
  version: string;
  requiredVersion: string;
  import?: false;
}
```

