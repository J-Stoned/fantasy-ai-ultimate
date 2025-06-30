/**
 * MARCUS "THE FIXER" RODRIGUEZ - SIMPLIFIED APP
 * 
 * Basic app without auth/services for testing
 */

import React from 'react';
import { StatusBar } from 'react-native';
import { NavigationContainer } from '@react-navigation/native';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { Ionicons } from '@expo/vector-icons';

// Import screens directly
import HomeScreen from '../screens/HomeScreen';
import LineupScreen from '../screens/LineupScreen';
import PlayersScreen from '../screens/PlayersScreen';

const Tab = createBottomTabNavigator();

export const AppSimple = () => {
  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <StatusBar barStyle="light-content" backgroundColor="#111827" />
      <NavigationContainer>
        <Tab.Navigator
          screenOptions={({ route }) => ({
            tabBarIcon: ({ focused, color, size }) => {
              let iconName: keyof typeof Ionicons.glyphMap;
              
              if (route.name === 'Home') {
                iconName = focused ? 'home' : 'home-outline';
              } else if (route.name === 'Lineup') {
                iconName = focused ? 'people' : 'people-outline';
              } else {
                iconName = focused ? 'person' : 'person-outline';
              }
              
              return <Ionicons name={iconName} size={size} color={color} />;
            },
            tabBarActiveTintColor: '#10b981',
            tabBarInactiveTintColor: '#6b7280',
            tabBarStyle: {
              backgroundColor: '#1f2937',
              borderTopColor: '#374151',
            },
            headerStyle: {
              backgroundColor: '#1f2937',
            },
            headerTintColor: '#fff',
          })}
        >
          <Tab.Screen name="Home" component={HomeScreen} />
          <Tab.Screen name="Lineup" component={LineupScreen} />
          <Tab.Screen name="Players" component={PlayersScreen} />
        </Tab.Navigator>
      </NavigationContainer>
    </GestureHandlerRootView>
  );
};

export default AppSimple;