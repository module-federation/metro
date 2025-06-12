import { getCommunityCliPlugin } from "../utils/getCommunityPlugin";

const communityCliPlugin = getCommunityCliPlugin();
const options = communityCliPlugin.bundleCommand.options;

export default options;
