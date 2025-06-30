import React from 'react';
import { Text, View, StyleSheet } from 'react-native';

export default function TestApp() {
  return (
    <View style={styles.container}>
      <Text style={styles.title}>🔥 MARCUS LIVES! 🔥</Text>
      <Text style={styles.subtitle}>The Fixer is IN!</Text>
      <Text style={styles.info}>If you see this, the app works!</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#111827',
  },
  title: {
    fontSize: 40,
    fontWeight: 'bold',
    color: '#10b981',
    marginBottom: 20,
  },
  subtitle: {
    fontSize: 24,
    color: '#ffffff',
    marginBottom: 10,
  },
  info: {
    fontSize: 16,
    color: '#9ca3af',
  },
});