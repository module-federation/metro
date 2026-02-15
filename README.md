# Metro Module Federation (Archived)

> [!WARNING]
> This repository is a legacy codebase and has been archived.
> Active Metro Module Federation development has moved to [`module-federation/core`](https://github.com/module-federation/core).

## About

This monorepo is a historical reference for the original Metro Module Federation implementation.
It is no longer the primary development repository.

## Migration

Metro Module Federation was moved into [`module-federation/core`](https://github.com/module-federation/core).

- New features and fixes: https://github.com/module-federation/core
- New issues and support requests: https://github.com/module-federation/core/issues

### Packages in this repo:
- `@module-federation/metro` - Core integration with Metro to enable Module Federation
- `@module-federation/metro-plugin-rnc-cli` - React Native CLI integration
- `@module-federation/metro-plugin-rnef` - React Native Enterprise Framework integration

> **Note**: Module Federation support for Metro bundler is still experimental and may lack some functionality or certain integrations.

## Getting Started

For detailed setup instructions and configuration options, see the [Metro Module Federation Core Package README](./packages/core/README.md).

## Usage

The configuration follows the standard [Module Federation configuration format](https://module-federation.io/configure/). For detailed information about Module Federation concepts, configuration options, and usage patterns, please refer to the official [Module Federation documentation](https://module-federation.io/).

## Examples

This repository includes several example applications to help you get started:

- **[example-host](./apps/example-host)** - Basic host application that consumes remote modules
- **[example-mini](./apps/example-mini)** - Basic mini application that exposes modules
- **[example-nested-mini](./apps/example-nested-mini)** - Mini application with nested module dependencies
- **[showcase-host](./apps/showcase-host)** - Showcase host application
- **[showcase-mini](./apps/showcase-mini)** - Showcase mini application

For instructions on how to run these examples, see [Running Examples](./CONTRIBUTING.md#running-examples) in our Contributing Guide.

### CLI Commands

For detailed information about available CLI commands see the [React Native CLI Plugin README](./packages/plugin-rnc-cli/README.md).

### React Native Enterprise Framework (RNEF) Integration

For detailed information about RNEF integration and configuration, see the [RNEF Plugin README](./packages/plugin-rnef/README.md).


## Contributing

We welcome contributions! Please see our [Contributing Guide](./CONTRIBUTING.md) for details on how to set up the development environment and run examples.

## License

This project is licensed under the MIT License - see the [LICENSE](./LICENSE) file for details.

## Support

- 💬 [Discord Community](https://discord.gg/n69NnT3ACV)
- 🐛 For active Metro Module Federation support, use [module-federation/core issues](https://github.com/module-federation/core/issues)

---

Built with ❤️ by [Callstack](https://callstack.com) and [Zephyr Cloud](https://zephyr-cloud.io/).
