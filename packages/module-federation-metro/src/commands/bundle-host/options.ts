import { getCommunityCliPlugin } from '../utils/getCommunityPlugin.js';

const communityCliPlugin = getCommunityCliPlugin();
const options = communityCliPlugin.bundleCommand.options;

export default options;
