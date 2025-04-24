import { useRef, lazy, createElement, Suspense } from "react";

declare global {
  var __METRO_FEDERATION_INIT__: Promise<any>;
  var __METRO_FEDERATION_LOADING__: Record<string, Promise<any>>;
}

type LazyComponent = { default: React.ComponentType };

function getFallbackComponent(lazyFallbackFn?: () => LazyComponent) {
  if (!lazyFallbackFn) return undefined;
  const FallbackComponent = lazyFallbackFn();
  return createElement(FallbackComponent.default);
}

function getAppComponent(ref: React.RefObject<React.ComponentType>) {
  const AppComponent = ref.current;
  return createElement(AppComponent);
}

export function withAsyncStartup(
  lazyAppFn: () => LazyComponent,
  lazyFallbackFn?: () => LazyComponent
): () => () => React.JSX.Element {
  return () => () => {
    const AppRef = useRef(
      lazy(async () => {
        await global.__METRO_FEDERATION_INIT__;
        await Promise.all(Object.values(global.__METRO_FEDERATION_LOADING__));
        return lazyAppFn();
      })
    );

    return createElement(
      Suspense,
      { fallback: getFallbackComponent(lazyFallbackFn) },
      getAppComponent(AppRef)
    );
  };
}
