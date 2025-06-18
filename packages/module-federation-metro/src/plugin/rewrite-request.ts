import { ConfigT } from "metro-config";
import { ModuleFederationConfigNormalized } from "../types";
import { MANIFEST_FILENAME } from "./constants";
import { replaceExtension } from "./helpers";

type CreateRewriteRequestOptions = {
  options: ModuleFederationConfigNormalized;
  config: ConfigT;
  manifestPath: string;
};

export function createRewriteRequest({
  options,
  config,
  manifestPath,
}: CreateRewriteRequestOptions) {
  return function rewriteRequest(url: string) {
    const { pathname } = new URL(url, "protocol://host");
    // rewrite /mini.bundle -> /mini.js.bundle
    if (pathname.startsWith(`/${options.filename}`)) {
      const target = replaceExtension(options.filename, ".js.bundle");
      return url.replace(options.filename, target);
    }
    // rewrite /mf-manifest.json -> /[metro-project]/node_modules/.mf-metro/mf-manifest.json
    if (pathname.startsWith(`/${MANIFEST_FILENAME}`)) {
      const root = config.projectRoot;
      const target = manifestPath.replace(root, "[metro-project]");
      return url.replace(MANIFEST_FILENAME, target);
    }
    // pass through to original rewriteRequestUrl
    if (config.server.rewriteRequestUrl) {
      return config.server.rewriteRequestUrl(url);
    }
    return url;
  };
}
