# Metro Module Federation

## Table of Contents

- [About](#about)
- [Getting Started](#getting-started)
  - [Installation](#installation)
  - [Configuration](#configuration)
- [Usage](#usage)
- [Examples](#examples)
- [API Reference](#api-reference)
- [Contributing](#contributing)
- [License](#license)
- [Support](#support)

## About

This monorepo contains all the tools you'll need to adapt your React Native apps and start using Module Federation with Metro bundler.

### Packages in this repo:
- `@module-federation/metro` - Core integration with Metro to enable Module Federation
- `@module-federation/metro-plugin-rnc-cli` - React Native CLI integration
- `@module-federation/metro-plugin-rnef` - React Native Enterprise Framework integration

> **Note**: Module Federation support for Metro bundler is still experimental and may lack some functionality or certain integrations.
> Projects or libraries that rely on custom Metro configurations such as `Expo` or `NativeWind` aren't supported yet and might not work.

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

## Usage

The configuration follows the standard [Module Federation configuration format](https://module-federation.io/configure/). For detailed information about Module Federation concepts, configuration options, and usage patterns, please refer to the official [Module Federation documentation](https://module-federation.io/).

### React Native Enterprise Framework (RNEF) Integration

This package also provides integration with [React Native Enterprise Framework (RNEF)](https://github.com/callstack/react-native-enterprise-framework). RNEF offers additional tooling and development workflows for React Native applications.

To use Module Federation with RNEF, add the plugin to your `rnef.config.mjs`:

```javascript
import { pluginMetroModuleFederation } from '@module-federation/metro-plugin-rnef';
import { platformAndroid } from '@rnef/platform-android';
import { platformIOS } from '@rnef/platform-ios';
import { pluginMetro } from '@rnef/plugin-metro';

/** @type {import('@rnef/config').Config} */
export default {
  bundler: pluginMetro(),
  platforms: {
    ios: platformIOS(),
    android: platformAndroid(),
  },
  plugins: [pluginMetroModuleFederation()],
};
```

See the examples in this repository which demonstrate RNEF integration with Module Federation.

## Examples

This repository includes several example applications to help you get started:

- **[example-host](./apps/example-host)** - Basic host application that consumes remote modules
- **[example-mini](./apps/example-mini)** - Basic mini application that exposes modules
- **[example-nested-mini](./apps/example-nested-mini)** - Mini application with nested module dependencies
- **[showcase-host](./apps/showcase-host)** - Showcase host application
- **[showcase-mini](./apps/showcase-mini)** - Showcase mini application

For instructions on how to run these examples, see [Running Examples](./CONTRIBUTING.md#running-examples) in our Contributing Guide.

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

### CLI Commands

#### `react-native bundle-mf-remote`

Bundles a mini application into static files that can be served from any web server.

**Usage:**
```shell
react-native bundle-mf-remote [options]
```

Supports all the same options as the standard `react-native bundle` command.

**Example:**
```shell
# Bundle for production
react-native bundle-mf-remote --platform ios --dev false --minify true
```

#### `react-native bundle-mf-host`

Bundles a host application. Host applications typically need to be built and run on devices rather than served as static files.

**Usage:**
```shell
react-native bundle-mf-host [options]
```

Supports all the same options as the standard `react-native bundle` command.

> **Note**: These commands are provided by the `@module-federation/metro-plugin-rnc-cli` package.

## Contributing

We welcome contributions! Please see our [Contributing Guide](./CONTRIBUTING.md) for details on how to set up the development environment and run examples.

## License

This project is licensed under the MIT License - see the [LICENSE](./LICENSE) file for details.

## Support

- 💬 [Discord Community](https://discord.gg/n69NnT3ACV)
- 🐛 [GitHub Issues](https://github.com/module-federation/metro/issues)

---

Built with ❤️ by [Callstack](https://callstack.com) and [Zephyr Cloud](https://zephyr-cloud.io/).
