import type { Command } from "@react-native-community/cli-types";

import bundleFederatedRemote from "./command";
import options from "./options";

const bundleMFRemoteCommand: Command = {
  name: "bundle-mf-remote",
  description:
    "Bundles a Module Federation remote, including its container entry and all exposed modules for consumption by host applications",
  // @ts-ignore
  func: bundleFederatedRemote,
  options,
};

export default [bundleMFRemoteCommand];
