const {bundleFederatedRemote} = require('module-federation-metro/commands');

async function zephyrWrapper() {
  // before build
  console.log('before');
  await bundleFederatedRemote();
  console.log('after build');
}

const zephyrCommand = {
  name: 'bundle',
  description:
    'Bundles a Module Federation remote, including its container entry and all exposed modules for consumption by host applications',
  // @ts-ignore
  func: zephyrWrapper,
  options,
};

module.exports = {
  commands: [zephyrCommand],
};
