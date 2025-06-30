import React from 'react';
import { Text, View } from 'react-native';

export default function MinimalApp() {
  return (
    <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#000' }}>
      <Text style={{ color: '#0f0', fontSize: 30 }}>MARCUS WORKS!</Text>
      <Text style={{ color: '#fff', fontSize: 20 }}>Basic React Native</Text>
    </View>
  );
}