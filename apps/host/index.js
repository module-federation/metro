// we need to explicitly import the init-host runtime module
// this is because of a metro limitation, where the module
// must be used in the bundle in order to be present in the final bundle
import 'mf:init-host';
import 'mf:async-require';

import App from './App';
import {name as appName} from './app.json';
import {loadShareSync} from '@module-federation/runtime';

const reactNative = loadShareSync('react-native')();
reactNative.AppRegistry.registerComponent(appName, () => App);
