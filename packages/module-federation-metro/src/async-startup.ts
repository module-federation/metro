import { useRef, lazy, createElement, Suspense } from "react";

declare global {
  var __METRO_FEDERATION_INIT__: Promise<any>;
  var __METRO_FEDERATION_LOADING__: Record<string, Promise<any>>;
}

export function withAsyncStartup(
  lazyAppFn: () => { default: React.ComponentType }
): () => () => React.JSX.Element {
  return () => () => {
    const AppRef = useRef(
      lazy(async () => {
        await global.__METRO_FEDERATION_INIT__;
        await Promise.all(Object.values(global.__METRO_FEDERATION_LOADING__));
        return lazyAppFn();
      })
    );
    const AppComponent = AppRef.current;
    return createElement(Suspense, null, createElement(AppComponent));
  };
}
