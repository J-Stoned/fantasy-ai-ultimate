/**
 * MARCUS "THE FIXER" RODRIGUEZ - REAL MOBILE NAVIGATION
 * 
 * This is how you build a production fantasy sports app.
 * No template bullshit, just screens that users actually need.
 */

import React from 'react';
import { View, ActivityIndicator } from 'react-native';
import { NavigationContainer } from '@react-navigation/native';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { createStackNavigator } from '@react-navigation/stack';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '../contexts/AuthContext';

// Core Screens
import HomeScreen from '../screens/HomeScreen';
import MyLeaguesScreen from '../screens/MyLeaguesScreen';
import LineupScreen from '../screens/LineupScreen';
import PlayersScreen from '../screens/PlayersScreen';
import MatchupsScreen from '../screens/MatchupsScreen';

// Detail Screens
import LeagueDetailScreen from '../screens/LeagueDetailScreen';
import PlayerDetailScreen from '../screens/PlayerDetailScreen';
import TradeScreen from '../screens/TradeScreen';
import WaiverScreen from '../screens/WaiverScreen';

// Advanced Features
import ARStatsScreen from '../screens/ARStatsScreen';
import ContestsScreen from '../screens/ContestsScreen';
import PredictionsScreen from '../screens/PredictionsScreen';
import VoiceAssistantScreen from '../screens/VoiceAssistantScreen';

// Auth Screens
import LoginScreen from '../screens/LoginScreen';
import OnboardingScreen from '../screens/OnboardingScreen';

// Types
export type RootStackParamList = {
  Main: undefined;
  Login: undefined;
  Onboarding: undefined;
  LeagueDetail: { leagueId: string };
  PlayerDetail: { playerId: string };
  Trade: { leagueId: string };
  Waiver: { leagueId: string };
  ARStats: undefined;
  VoiceAssistant: undefined;
};

export type MainTabParamList = {
  Home: undefined;
  MyLeagues: undefined;
  Lineup: undefined;
  Players: undefined;
  Predictions: undefined;
  Matchups: undefined;
  Contests: undefined;
};

const Tab = createBottomTabNavigator<MainTabParamList>();
const Stack = createStackNavigator<RootStackParamList>();

/**
 * Main tab navigation
 */
function MainTabs() {
  return (
    <Tab.Navigator
      screenOptions={({ route }) => ({
        tabBarIcon: ({ focused, color, size }) => {
          let iconName: keyof typeof Ionicons.glyphMap;

          switch (route.name) {
            case 'Home':
              iconName = focused ? 'home' : 'home-outline';
              break;
            case 'MyLeagues':
              iconName = focused ? 'trophy' : 'trophy-outline';
              break;
            case 'Lineup':
              iconName = focused ? 'people' : 'people-outline';
              break;
            case 'Players':
              iconName = focused ? 'person' : 'person-outline';
              break;
            case 'Predictions':
              iconName = focused ? 'bulb' : 'bulb-outline';
              break;
            case 'Matchups':
              iconName = focused ? 'game-controller' : 'game-controller-outline';
              break;
            case 'Contests':
              iconName = focused ? 'cash' : 'cash-outline';
              break;
            default:
              iconName = 'alert-circle';
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
      <Tab.Screen name="MyLeagues" component={MyLeaguesScreen} options={{ title: 'Leagues' }} />
      <Tab.Screen name="Lineup" component={LineupScreen} />
      <Tab.Screen name="Players" component={PlayersScreen} />
      <Tab.Screen name="Predictions" component={PredictionsScreen} options={{ title: 'AI' }} />
      <Tab.Screen name="Matchups" component={MatchupsScreen} />
      <Tab.Screen name="Contests" component={ContestsScreen} />
    </Tab.Navigator>
  );
}

/**
 * Root navigation stack
 */
export function NavigationStack() {
  // Get auth state from context
  const { user, loading } = useAuth();
  const isAuthenticated = !!user;

  if (loading) {
    return (
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#111827' }}>
        <ActivityIndicator size="large" color="#10b981" />
      </View>
    );
  }

  return (
    <NavigationContainer>
      <Stack.Navigator
        screenOptions={{
          headerStyle: {
            backgroundColor: '#1f2937',
          },
          headerTintColor: '#fff',
          headerTitleStyle: {
            fontWeight: 'bold',
          },
        }}
      >
        {!isAuthenticated ? (
          <>
            <Stack.Screen 
              name="Login" 
              component={LoginScreen} 
              options={{ headerShown: false }}
            />
            <Stack.Screen 
              name="Onboarding" 
              component={OnboardingScreen}
              options={{ headerShown: false }}
            />
          </>
        ) : (
          <>
            <Stack.Screen 
              name="Main" 
              component={MainTabs} 
              options={{ headerShown: false }}
            />
            <Stack.Screen 
              name="LeagueDetail" 
              component={LeagueDetailScreen}
              options={{ title: 'League Details' }}
            />
            <Stack.Screen 
              name="PlayerDetail" 
              component={PlayerDetailScreen}
              options={{ title: 'Player Profile' }}
            />
            <Stack.Screen 
              name="Trade" 
              component={TradeScreen}
              options={{ title: 'Trade Center' }}
            />
            <Stack.Screen 
              name="Waiver" 
              component={WaiverScreen}
              options={{ title: 'Waiver Wire' }}
            />
            <Stack.Screen 
              name="ARStats" 
              component={ARStatsScreen}
              options={{ title: 'AR Player Stats' }}
            />
            <Stack.Screen 
              name="VoiceAssistant" 
              component={VoiceAssistantScreen}
              options={{ title: 'Hey Fantasy' }}
            />
          </>
        )}
      </Stack.Navigator>
    </NavigationContainer>
  );
}

/**
 * THE MARCUS GUARANTEE:
 * 
 * This navigation structure handles:
 * - Authentication flow
 * - Main app tabs
 * - Detail screens
 * - Advanced features
 * 
 * Everything a fantasy sports app needs, nothing it doesn't.
 * 
 * - Marcus "The Fixer" Rodriguez
 */