import { getCommunityCliPlugin } from '../utils/get-community-plugin.js';

const communityCliPlugin = getCommunityCliPlugin();
const options = communityCliPlugin.bundleCommand.options;

export default options;
