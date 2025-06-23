import fs from 'node:fs';
import path from 'node:path';
import type { ModuleFederationConfigNormalized } from '../types';

interface CreateBabelTransformerOptions {
  blacklistedPaths: string[];
  federationConfig: ModuleFederationConfigNormalized;
  originalBabelTransformerPath: string;
  tmpDirPath: string;
}

export function createBabelTransformer({
  blacklistedPaths,
  federationConfig,
  originalBabelTransformerPath,
  tmpDirPath,
}: CreateBabelTransformerOptions) {
  const outputPath = path.join(tmpDirPath, 'babel-transformer.js');
  const templatePath = require.resolve('../babel/transformer.js');
  const transformerTemplate = fs.readFileSync(templatePath, 'utf-8');

  const babelTransformer = transformerTemplate
    .replaceAll('__BABEL_TRANSFORMER_PATH__', originalBabelTransformerPath)
    .replaceAll('__REMOTES__', JSON.stringify(federationConfig.remotes))
    .replaceAll('__SHARED__', JSON.stringify(federationConfig.shared))
    .replaceAll('__BLACKLISTED_PATHS__', JSON.stringify(blacklistedPaths));

  fs.writeFileSync(outputPath, babelTransformer, 'utf-8');

  return outputPath;
}
