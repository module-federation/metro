import { initializeScope } from 'mf:instance-helpers';
import {
  loadRemoteToRegistry,
  loadSharedToRegistry,
} from 'mf:remote-module-registry';
import { init } from '@module-federation/runtime';

__PLUGINS__;

const usedRemotes = __REMOTES__;
const usedShared = __SHARED__;

const name = __NAME__;
const shareScopeName = 'default';
const shareStrategy = __SHARE_STRATEGY__;

const initRes = init({
  name,
  remotes: usedRemotes,
  plugins,
  shared: usedShared,
  shareStrategy,
});

const scope = initializeScope(name);

scope.init = Promise.all([
  initRes.initializeSharing(shareScopeName, {
    strategy: shareStrategy,
    from: 'build',
    initScope: [],
  }),
]).then(() =>
  Promise.all([
    ...Object.keys(usedShared).map(loadSharedToRegistry),
    ...__EARLY_REMOTES__.map(loadRemoteToRegistry),
  ])
);

__EARLY_SHARED__.forEach(loadSharedToRegistry);
