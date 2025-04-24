import React from 'react';
import {Pressable, StyleSheet, Text, View} from 'react-native';
import _ from 'lodash';

type Props = {
  onPress: () => void;
};

export default function Button({onPress}: Props) {
  console.log('lodash version in mini', _.VERSION);

  return (
    <View>
      <Pressable style={styles.button} onPress={onPress}>
        <Text style={styles.text}>Federated Button</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  button: {
    alignItems: 'center',
    backgroundColor: '#8232ff',
    padding: 8,
    borderRadius: 4,
  },
  text: {
    color: '#ffffff',
  },
});
