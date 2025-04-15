import 'mf:init-host';

import App from './App';
import {name as appName} from './app.json';
import {loadShareSync} from '@module-federation/runtime';

const reactNative = loadShareSync('react-native')();
reactNative.AppRegistry.registerComponent(appName, () => App);
