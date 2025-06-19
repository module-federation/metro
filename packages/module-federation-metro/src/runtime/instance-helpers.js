export function initializeScope(name) {
  if (!globalThis.__FEDERATION__) {
    throw new Error(`Federation global '__FEDERATION__' is not initialized.`);
  }

  globalThis.__FEDERATION__.__NATIVE__ ??= {};
  globalThis.__FEDERATION__.__NATIVE__[name] ??= {};
  globalThis.__FEDERATION__.__NATIVE__[name].deps ??= {
    shared: {},
    remotes: {},
  };

  return globalThis.__FEDERATION__.__NATIVE__[name];
}
