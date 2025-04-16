import React from 'react';
import {View, Text} from 'react-native';

export function add(a: number, b: number): number {
  return a + b;
}

export function Add() {
  return (
    <View>
      <Text>Add</Text>
    </View>
  );
}
