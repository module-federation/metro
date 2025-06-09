import { getCommunityCliPlugin } from "../utils/getCommunityPlugin";

const communityCliPlugin = getCommunityCliPlugin();
const options = communityCliPlugin.startCommand.options;

export default options;
