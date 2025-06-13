// we need to explicitly import the init-host runtime module
// this is because of a metro limitation, where the module
// must be used in the bundle in order to be present in the final bundle
import 'mf:init-host';
import 'mf:async-require';

import { withAsyncStartup } from 'module-federation-metro/bootstrap';
import { AppRegistry } from 'react-native';
import { name as appName } from './app.json';

// create async boundry through withAsyncStartup helper
// and pass the getter function for the app component
// optionally a getter function for the fallback component
AppRegistry.registerComponent(
  appName,
  withAsyncStartup(
    () => require('./src/App'),
    () => require('./src/Fallback')
  )
);
