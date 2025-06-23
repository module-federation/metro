import type { ModuleFederationConfigNormalized } from '../types';
import { ConfigError } from '../utils';

export function validateOptions(options: ModuleFederationConfigNormalized) {
  // validate filename
  if (!options.filename.endsWith('.bundle')) {
    throw new ConfigError(
      `Invalid filename: ${options.filename}. ` +
        'Filename must end with .bundle extension.'
    );
  }
}
