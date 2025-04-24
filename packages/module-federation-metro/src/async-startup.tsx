import React from "react";

declare global {
  var __METRO_FEDERATION__: {
    __HOST__: {
      init: Promise<any>;
      loading: Record<string, Promise<any>>;
    };
  };
}

type LazyComponent = { default: React.ComponentType };

function getFallbackComponent(lazyFallbackFn?: () => LazyComponent) {
  if (!lazyFallbackFn) return () => null;
  const fallback = lazyFallbackFn();
  return fallback.default;
}

export function withAsyncStartup(
  lazyAppFn: () => LazyComponent,
  lazyFallbackFn?: () => LazyComponent
): () => () => React.JSX.Element {
  const AppComponent = React.lazy(async () => {
    await global.__METRO_FEDERATION__.__HOST__.init;
    await Promise.all(
      Object.values(global.__METRO_FEDERATION__.__HOST__.loading)
    );
    return lazyAppFn();
  });

  const FallbackComponent = getFallbackComponent(lazyFallbackFn);

  return () => () => {
    return (
      <React.Suspense fallback={<FallbackComponent />}>
        <AppComponent />
      </React.Suspense>
    );
  };
}
