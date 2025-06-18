import chalk from "chalk";
import path from "path";

export function isUsingMFCommand(command = process.argv[2]) {
  const allowedCommands = ["start", "bundle-mf-host", "bundle-mf-remote"];
  return allowedCommands.includes(command);
}

export function isUsingMFBundleCommand(command = process.argv[2]) {
  const allowedCommands = ["bundle-mf-host", "bundle-mf-remote"];
  return allowedCommands.includes(command);
}

export function replaceExtension(filepath: string, extension: string) {
  const { dir, name } = path.parse(filepath);
  return path.format({ dir, name, ext: extension });
}

export function mfDisabledWarning() {
  console.warn(
    chalk.yellow(
      "Warning: Module Federation build is disabled for this command.\n"
    ) +
      chalk.yellow(
        "To enable Module Federation, please use one of the dedicated bundle commands:\n"
      ) +
      ` ${chalk.dim("•")} bundle-mf-host` +
      chalk.dim(" - for bundling a host application\n") +
      ` ${chalk.dim("•")} bundle-mf-remote` +
      chalk.dim(" - for bundling a remote application\n")
  );
}
