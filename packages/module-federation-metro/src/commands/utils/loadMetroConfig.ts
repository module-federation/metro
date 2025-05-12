import path from "node:path";
import type { Config } from "@react-native-community/cli-types";
import type { ConfigT, InputConfigT, YargArguments } from "metro-config";
import { loadConfig, mergeConfig, resolveConfig } from "metro-config";
import { CLIError } from "./cliError";

export type { Config };

export interface ConfigLoadingContext {
  root: Config["root"];
  reactNativePath: Config["reactNativePath"];
  platforms: Config["platforms"];
}

function getOverrideConfig(
  ctx: ConfigLoadingContext,
  config: ConfigT
): InputConfigT {
  const resolver: Partial<ConfigT["resolver"]> = {
    platforms: [...Object.keys(ctx.platforms), "native"],
  };

  return {
    resolver,
    serializer: {
      getModulesRunBeforeMainModule: (entryFilePath) => [
        ...(config.serializer?.getModulesRunBeforeMainModule?.(entryFilePath) ||
          []),
        require.resolve(
          path.join(ctx.reactNativePath, "Libraries/Core/InitializeCore"),
          { paths: [ctx.root] }
        ),
      ],
    },
  };
}

export default async function loadMetroConfig(
  ctx: ConfigLoadingContext,
  options: YargArguments = {}
): Promise<ConfigT> {
  const cwd = ctx.root;
  const projectConfig = await resolveConfig(options.config, cwd);

  if (projectConfig.isEmpty) {
    throw new CLIError(`No Metro config found in ${cwd}`);
  }

  const config = await loadConfig({ cwd, ...options });

  const overrideConfig = getOverrideConfig(ctx, config);

  return mergeConfig(config, overrideConfig);
}
