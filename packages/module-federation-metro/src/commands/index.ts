import type { Command } from "@react-native-community/cli-types";

import bundleContainer from "./command";
import options from "./options";

const bundleContainerCommand: Command = {
  name: "bundle-container",
  description: "Build the MF container",
  // @ts-ignore
  func: bundleContainer,
  options,
};

export default [bundleContainerCommand];
