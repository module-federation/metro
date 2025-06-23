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
}

export function validateOptions(options: ModuleFederationConfigNormalized) {
  // validate filename
  validateFilename(options.filename);

  // validate shared
  validateShared(options.shared);
}
