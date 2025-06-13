const {
  bundleFederatedHost,
  bundleFederatedHostOptions,
} = require('./commands/index.js');

const {
  bundleFederatedRemote,
  bundleFederatedRemoteOptions,
} = require('./commands/index.js');

const bundleMFHostCommand = {
  name: 'bundle-mf-host',
  description: 'Bundles a Module Federation host',
  func: bundleFederatedHost,
  options: bundleFederatedHostOptions,
};

const bundleMFRemoteCommand = {
  name: 'bundle-mf-remote',
  description:
    'Bundles a Module Federation remote, including its container entry and all exposed modules for consumption by host applications',
  func: bundleFederatedRemote,
  options: bundleFederatedRemoteOptions,
};

module.exports = { commands: [bundleMFHostCommand, bundleMFRemoteCommand] };
