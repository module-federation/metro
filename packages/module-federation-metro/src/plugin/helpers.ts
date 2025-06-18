import fs from 'node:fs';
import path from 'node:path';

export function isUsingMFCommand(command = process.argv[2]) {
  const allowedCommands = ['start', 'bundle-mf-host', 'bundle-mf-remote'];
  return allowedCommands.includes(command);
}

export function isUsingMFBundleCommand(command = process.argv[2]) {
  const allowedCommands = ['bundle-mf-host', 'bundle-mf-remote'];
  return allowedCommands.includes(command);
}

export function replaceExtension(filepath: string, extension: string) {
  const { dir, name } = path.parse(filepath);
  return path.format({ dir, name, ext: extension });
}

export function stubRemoteEntry(remoteEntryPath: string) {
  const stub = '// remote entry stub';
  fs.mkdirSync(path.dirname(remoteEntryPath), { recursive: true });
  fs.writeFileSync(remoteEntryPath, stub, 'utf-8');
}

export function mfDisabledWarning() {}

export function createMFRuntimeNodeModules(projectNodeModulesPath: string) {
  const mfMetroPath = path.join(projectNodeModulesPath, '.mf-metro');
  fs.rmSync(mfMetroPath, { recursive: true, force: true });
  fs.mkdirSync(mfMetroPath, { recursive: true });
  return mfMetroPath;
}
