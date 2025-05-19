const path = require('path');
const commands = require('module-federation-metro/commands');

async function zephyrWrapper(...args) {
  console.log(args[1].project);
  const bundleFederatedRemote = commands[0]['func'];
  // before build
  console.log('before');
  const res = await bundleFederatedRemote(...args);
  console.log('after build');
  return res;
}

const zephyrCommand = {
  name: 'bundle-mf-remote',
  description:
    'Bundles a Module Federation remote, including its container entry and all exposed modules for consumption by host applications',
  // @ts-ignore
  func: zephyrWrapper,
  options: [
    {
      name: '--platform <string>',
      description: 'Either "ios" or "android"',
      default: 'ios',
    },
    {
      name: '--dev [boolean]',
      description: 'If false, warnings are disabled and the bundle is minified',
      parse: val => val !== 'false',
      default: true,
    },
    {
      name: '--minify [boolean]',
      description:
        'Allows overriding whether bundle is minified. This defaults to ' +
        'false if dev is true, and true if dev is false. Disabling minification ' +
        'can be useful for speeding up production builds for testing purposes.',
      parse: val => val !== 'false',
    },
    {
      name: '--bundle-encoding <string>',
      description:
        'Encoding the bundle should be written in (https://nodejs.org/api/buffer.html#buffer_buffer).',
      default: 'utf8',
    },
    {
      name: '--max-workers <number>',
      description:
        'Specifies the maximum number of workers the worker-pool ' +
        'will spawn for transforming files. This defaults to the number of the ' +
        'cores available on your machine.',
      parse: workers => Number(workers),
    },
    {
      name: '--sourcemap-output <string>',
      description:
        'File name where to store the sourcemap file for resulting bundle, ex. /tmp/groups.map',
    },
    {
      name: '--sourcemap-sources-root <string>',
      description:
        "Path to make sourcemap's sources entries relative to, ex. /root/dir",
    },
    {
      name: '--sourcemap-use-absolute-path',
      description: 'Report SourceMapURL using its full path',
      default: false,
    },
    {
      name: '--assets-dest <string>',
      description:
        'Directory name where to store assets referenced in the bundle',
    },
    {
      name: '--asset-catalog-dest [string]',
      description: 'Path where to create an iOS Asset Catalog for images',
    },
    {
      name: '--reset-cache',
      description: 'Removes cached files',
      default: false,
    },
    {
      name: '--config <string>',
      description: 'Path to the CLI configuration file',
      parse: val => path.resolve(val),
    },
  ],
};

module.exports = {
  commands: [zephyrCommand],
};
