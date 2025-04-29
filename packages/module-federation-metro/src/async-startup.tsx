import React from "react";

declare global {
  var __METRO_FEDERATION__: Record<string, any> & {
    __HOST__: {
      __shareInit: Promise<void>;
      __shareLoading: Promise<void>;
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
    await global.__METRO_FEDERATION__.__HOST__.__shareInit;
    await global.__METRO_FEDERATION__.__HOST__.__shareLoading;
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
