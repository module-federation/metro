import type { ConfigT } from 'metro-config';
import {
  MANIFEST_FILENAME,
  VIRTUAL_HOST_ENTRY_NAME,
  VIRTUAL_REMOTE_ENTRY_NAME,
} from './constants';
import { removeExtension } from './helpers';

type CreateRewriteRequestOptions = {
  config: ConfigT;
  originalEntryFilename: string;
  remoteEntryFilename: string;
  manifestPath: string;
};

export function createRewriteRequest({
  config,
  originalEntryFilename,
  remoteEntryFilename,
  manifestPath,
}: CreateRewriteRequestOptions) {
  const hostEntryName = removeExtension(originalEntryFilename);
  const remoteEntryName = removeExtension(remoteEntryFilename);

  const hostEntryPathRegex = new RegExp(
    `^\\/${hostEntryName}(\\.js)?(\\.bundle)$`
  );
  const remoteEntryPathRegex = new RegExp(
    `^\\/${remoteEntryName}(\\.js)?(\\.bundle)$`
  );

  return function rewriteRequest(url: string) {
    const root = config.projectRoot;
    const { pathname } = new URL(url, 'protocol://host');
    // rewrite /index.bundle -> /virtual-host-entry.bundle
    if (pathname.match(hostEntryPathRegex)) {
      return url.replace(hostEntryName, VIRTUAL_HOST_ENTRY_NAME);
    }
    // rewrite /mini.bundle -> /virtual-remote-entry.bundle
    if (pathname.match(remoteEntryPathRegex)) {
      return url.replace(remoteEntryName, VIRTUAL_REMOTE_ENTRY_NAME);
    }
    // rewrite /mf-manifest.json -> /[metro-project]/node_modules/.mf-metro/mf-manifest.json
    if (pathname.startsWith(`/${MANIFEST_FILENAME}`)) {
      const target = manifestPath.replace(root, '[metro-project]');
      return url.replace(MANIFEST_FILENAME, target);
    }
    // pass through to original rewriteRequestUrl
    if (config.server.rewriteRequestUrl) {
      return config.server.rewriteRequestUrl(url);
    }
    return url;
  };
}
