const {
  bundleFederatedRemote,
  bundleFederatedRemoteOptions,
} = require("./commands");

const bundleMFRemoteCommand = {
  name: "bundle-mf-remote",
  description:
    "Bundles a Module Federation remote, including its container entry and all exposed modules for consumption by host applications",
  func: bundleFederatedRemote,
  options: bundleFederatedRemoteOptions,
};

module.exports = { commands: [bundleMFRemoteCommand] };
