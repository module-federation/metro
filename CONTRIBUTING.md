# Contributing

## Getting Started

### Prerequisites

- Node.js version 22 (as specified in `.nvmrc`)
- Corepack

In case Corepack is not available, you can install it manually:

```bash
npm install -g corepack
```

### Setup Steps

1. Clone the repository with submodules:

```bash
git clone git@github.com:module-federation/metro.git mf-metro
```

2. Navigate to the project directory:

```bash
cd mf-metro
```

3. Enable Corepack and install dependencies in the monorepo:

```bash
corepack enable && corepack install && yarn install
```

## Development

Run the development servers for both showcase apps:

```bash
yarn dev
```

> **Note:** You can freely make changes to both the `@module-federation/metro` package (`packages/core`) and the the dev server will automatically restart when changes are detected - there's no need to manually build either package.

## Code Quality

### Linting

The project uses [Biome](https://biomejs.dev/) for linting and formatting. To check and fix code style issues:

```bash
# Check and automatically fix linting issues
pnpm lint

# Check linting issues without fixing (used in CI)
pnpm lint:ci
```

### Type Checking

To run TypeScript type checking across all packages:

```bash
pnpm typecheck
```

### Building

To build all packages:

```bash
pnpm build
```

## Running Examples

This repository includes several example applications to help you get started:

- **[example-host](./apps/example-host)** - Basic host application that consumes remote modules
- **[example-mini](./apps/example-mini)** - Basic mini application that exposes modules
- **[example-nested-mini](./apps/example-nested-mini)** - Mini application with nested module dependencies
- **[showcase-host](./apps/showcase-host)** - Showcase host application with better UI
- **[showcase-mini](./apps/showcase-mini)** - Showcase mini application with better UI

### Start Metro Servers

```shell
# Run the basic example Metro servers
pnpm dev:example

# Run the showcase example Metro servers
pnpm dev
```

### Build and Run on Devices

After starting the Metro servers, you can build and run the host apps on iOS and Android:

**For iOS:**
```shell
# Basic example
pnpm --filter example-host ios

# Showcase example
pnpm --filter showcase-host ios
```

**For Android:**
```shell
# Basic example
pnpm --filter example-host android

# Showcase example
pnpm --filter showcase-host android
```

> **Note**: Make sure you have the appropriate development environment set up for [iOS](https://reactnative.dev/docs/set-up-your-environment?platform=ios) and [Android](https://reactnative.dev/docs/set-up-your-environment?platform=android) development.
