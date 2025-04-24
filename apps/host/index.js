// we need to explicitly import the init-host runtime module
// this is because of a metro limitation, where the module
// must be used in the bundle in order to be present in the final bundle
import 'mf:init-host';
import 'mf:async-require';

import {name as appName} from './app.json';
import {AppRegistry, View} from 'react-native';
import {withAsyncStartup} from 'module-federation-metro/bootstrap';

// create async bounday through withAsyncStartup helper
// and pass the getter function for the app component
// and optionally a getter function for the fallback component
AppRegistry.registerComponent(
  appName,
  withAsyncStartup(
    () => require('./src/App'),
    () => require('./src/Fallback'),
  ),
);
