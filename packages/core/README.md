# `@module-federation/metro`

## Getting started

### Installation

Use your favorite package manager to install these required packages to your React Native project.

```shell
# Using pnpm
pnpm add @module-federation/metro @module-federation/metro-plugin-rnc-cli
```

### Configuration

Wrap Metro configuration with `withModuleFederation` function that enables module federation in your project.

```javascript
const { withModuleFederation } = require('@module-federation/metro');
const { getDefaultConfig, mergeConfig } = require('@react-native/metro-config');

const config = {};

module.exports = withModuleFederation(
  mergeConfig(getDefaultConfig(__dirname), config),
  {
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
      unstable_patchHMRClient: true,
      unstable_patchInitializeCore: true,
      unstable_patchRuntimeRequire: true,
    },
  }
);
```

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

