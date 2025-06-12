import path from "node:path";
import type { ConfigT, InputConfigT, YargArguments } from "metro-config";
import { loadConfig, mergeConfig, resolveConfig } from "metro-config";
import type { Config } from "../types";
import { CLIError } from "../../utils/errors";

function getOverrideConfig(cfg: Config, config: ConfigT): InputConfigT {
  const resolver: Partial<ConfigT["resolver"]> = {
    platforms: [...Object.keys(cfg.platforms), "native"],
  };

  return {
    resolver,
    serializer: {
      getModulesRunBeforeMainModule: (entryFilePath) => [
        ...(config.serializer?.getModulesRunBeforeMainModule?.(entryFilePath) ||
          []),
        require.resolve(
          path.join(cfg.reactNativePath, "Libraries/Core/InitializeCore"),
          { paths: [cfg.root] }
        ),
      ],
    },
  };
}

export default async function loadMetroConfig(
  cfg: Config,
  options: YargArguments = {}
): Promise<ConfigT> {
  const cwd = cfg.root;
  const projectConfig = await resolveConfig(options.config, cwd);

  if (projectConfig.isEmpty) {
    throw new CLIError(`No Metro config found in ${cwd}`);
  }

  const config = await loadConfig({ cwd, ...options });

  const overrideConfig = getOverrideConfig(cfg, config);

  return mergeConfig(config, overrideConfig);
}
