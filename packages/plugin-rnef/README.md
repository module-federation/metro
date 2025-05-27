# @metro-mf/plugin-rnef

Module Federation for React Native Enterprise Framework (RNEF) using Metro bundler. This plugin integrates the `@module-federation/metro` package with RNEF, providing commands to bundle Module Federation remotes in a React Native environment.

## Installation

1. First, ensure you have RNEF set up in your project.

2. Install the plugin:

```bash
npm install --save-dev @metro-mf/plugin-rnef
# or
yarn add --dev @metro-mf/plugin-rnef
```

3. Add the plugin to your RNEF configuration (typically in `rnef.config.ts` or `rnef.config.js`):

```typescript
import { defineConfig } from '@rnef/config';
import moduleFederation from '@metro-mf/plugin-rnef';

export default defineConfig({
  plugins: [
    // ... other plugins
    moduleFederation({
      moduleFederation: {
        // Optional: Set default platform if not specified in the command
        defaultPlatform: 'ios',
      },
    }),
  ],
});
```

## Usage

### Bundle a Module Federation Remote

```bash
# Bundle for iOS
rnef bundle-mf-remote --entry-file ./src/remoteEntry.js --platform ios --bundle-output ./dist/ios/remote.bundle

# Bundle for Android
rnef bundle-mf-remote --entry-file ./src/remoteEntry.js --platform android --bundle-output ./dist/android/remote.bundle

# With source maps
rnef bundle-mf-remote \
  --entry-file ./src/remoteEntry.js \
  --platform ios \
  --bundle-output ./dist/ios/remote.bundle \
  --sourcemap-output ./dist/ios/remote.map

# Production build with minification
rnef bundle-mf-remote --entry-file ./src/remoteEntry.js --platform ios --dev false --bundle-output ./dist/ios/remote.bundle
```

### Available Options

All standard `@module-federation/metro` options are supported. Common ones include:

- `--entry-file <path>`: (Required) Path to the entry file
- `--platform <string>`: Target platform (ios, android, etc.)
- `--dev [boolean]`: Whether to build in development mode (default: true)
- `--minify [boolean]`: Whether to minify the bundle
- `--bundle-output <string>`: File path where to store the resulting bundle
- `--sourcemap-output <string>`: File path where to store the source map
- `--assets-dest <string>`: Directory to copy assets to
- `--reset-cache`: Whether to reset the Metro cache

## Development

1. Clone the repository
2. Install dependencies: `yarn`
3. Build the package: `yarn build`
4. Link the package for local development: `yarn link`

## License

MIT
