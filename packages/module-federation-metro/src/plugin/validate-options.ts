import type { ModuleFederationConfigNormalized, Shared } from '../types';
import { ConfigError } from '../utils';

function validateFilename(filename: string) {
  if (!filename.endsWith('.bundle')) {
    throw new ConfigError(
      `Invalid filename: ${filename}. ` +
        'Filename must end with .bundle extension.'
    );
  }
}

function validateShared(shared: Shared) {
  if (!shared || typeof shared !== 'object') {
    throw new ConfigError('Shared must be an object.');
  }

  if (Array.isArray(shared)) {
    throw new ConfigError('Array format is not supported for shared.');
  }

  // validate shared module names
  for (const sharedName of Object.keys(shared)) {
    // disallow relative paths
    if (sharedName.startsWith('./') || sharedName.startsWith('../')) {
      throw new ConfigError(
        'Relative paths are not supported as shared module names.'
      );
    }

    // disallow absolute paths
    if (sharedName.startsWith('/')) {
      throw new ConfigError(
        'Absolute paths are not supported as shared module names.'
      );
    }

    // disallow deep import wildcards (containing /)
    if (sharedName.endsWith('/')) {
      throw new ConfigError(
        'Deep import wildcards are not supported as shared module names.'
      );
    }
  }
}

export function validateOptions(options: ModuleFederationConfigNormalized) {
  // validate filename
  validateFilename(options.filename);

  // validate shared
  validateShared(options.shared);
}
