import React from 'react';
import {Platform, StyleSheet, Text, View} from 'react-native';
import _ from 'lodash';

import Card from './Card';

export default function Info() {
  return (
    <Card title="Host Info">
      <View style={styles.row}>
        <Text style={[styles.text, styles.title]}>Share strategy:</Text>
        <Text style={styles.text}>loaded-first</Text>
      </View>
      <View style={styles.row}>
        <Text style={[styles.text, styles.title]}>Lodash version:</Text>
        <Text testID="host-lodash-version" style={styles.text}>
          {_.VERSION}
        </Text>
      </View>
    </Card>
  );
}

const styles = StyleSheet.create({
  text: {
    fontFamily: Platform.select({
      ios: 'Menlo',
      android: 'monospace',
    }),
  },
  title: {
    marginRight: 4,
  },
  row: {
    flexDirection: 'row',
  },
});
