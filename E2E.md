# End-to-End (E2E) Testing Guide

This project uses [**Maestro**](https://maestro.mobile.dev/) for automated end-to-end testing across multiple example applications located in the `apps/` directory.

## 📦 Overview

- Each app in the `apps/` directory serves as both:
  - An example use-case for the monorepo.
  - A target for E2E tests using Maestro.
- E2E tests are integrated into the CI pipeline for **both Android and iOS**.

## 🚀 Getting Started

### 1. Prerequisites

- [Maestro CLI](https://maestro.mobile.dev/docs/getting-started/installation)

### 2. Start Required Mini Apps

Before running E2E tests, ensure the Metro bundler for the host app is running as well as all the dependent mini apps.

```bash
pnpm --filter <app-name> <platform>
pnpm --filter <app-name> start
pnpm --filter <mini-app-name> start
```

or alternatively you can run:

```bash
pnpm --filter <app-name> <platform>
pnpm --filter <app-name> start
pnpm --filter <app-name> e2e:prepare:<platform>
```

## 🧪 Running E2E Tests

You can run E2E test by executing the following command:

```bash
pnpm --filter <app-name> e2e:run
```

## 🛠 CI Integration

- All E2E tests are run **automatically in CI**.
- The CI handles environment setup, builds, and Maestro execution for:
  - `iOS`
  - `Android`

You can review CI logs and Maestro test output for each platform as part of the build pipeline.
