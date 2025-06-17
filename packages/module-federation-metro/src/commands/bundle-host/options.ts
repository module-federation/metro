import { getCommunityCliPlugin } from "../utils/getCommunityPlugin";

const communityCliPlugin = getCommunityCliPlugin();
const options = communityCliPlugin.bundleCommand.options;

const extendedOptions = [
  ...options,
  {
    name: "--config-cmd [string]",
    description:
      "[Internal] A hack for Xcode build script pointing to wrong bundle command that recognizes this flag. Do not use.",
  },
];

export default extendedOptions;
