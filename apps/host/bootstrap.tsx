import React from 'react';

declare global {
  var __METRO_FEDERATION_INIT__: Promise<any>;
  var __METRO_FEDERATION_LOADING__: Record<string, Promise<any>>;
}

export function withAsyncStartup(
  AppRequireFn: () => {default: React.ComponentType<any>},
): () => () => React.JSX.Element {
  return () => () => {
    const AppRef = React.useRef(
      React.lazy(async () => {
        await global.__METRO_FEDERATION_INIT__;
        await Promise.all(Object.values(global.__METRO_FEDERATION_LOADING__));
        return {default: AppRequireFn().default};
      }),
    );

    const AppComponent = AppRef.current;

    return (
      <React.Suspense>
        <AppComponent />
      </React.Suspense>
    );
  };
}
