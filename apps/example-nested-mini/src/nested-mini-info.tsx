import { VERSION } from 'lodash';
import React from 'react';
import { View } from 'react-native';

// @ts-ignore
const Info = React.lazy(() => import('mini/info'));

export default function NestedMiniInfo() {
  return (
    <View testID="nested-mini">
      <React.Suspense>
        <Info
          testID="nested-mini-info"
          sections={[
            {
              name: 'lodash version',
              value: VERSION,
              testID: 'nested-mini-lodash',
            },
          ]}
        />
      </React.Suspense>
    </View>
  );
}
