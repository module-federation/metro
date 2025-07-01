# Module Federation for Metro Bundler

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
git clone --recurse-submodules -j8 git@github.com:module-federation/metro.git mf-metro
```

2. Navigate to the project directory:

```bash
cd mf-metro
```

3. Enable Corepack and install dependencies in the monorepo:

```bash
corepack enable && corepack install && yarn install
```

4. Navigate to the Metro submodule:

```bash
cd external/metro
```

5. Set the correct Yarn version for Metro and install dependencies:

```bash
yarn set version 1.22.22 && yarn install
```

## Development

Run the development servers for both showcase apps:

```bash
yarn dev
```

> **Note:** You can freely make changes to both the `@module-federation/metro` package (`packages/core`) and the the dev server will automatically restart when changes are detected - there's no need to manually build either package.
