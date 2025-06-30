/**
 * MARCUS "THE FIXER" RODRIGUEZ - ONBOARDING SCREEN
 * 
 * First impressions matter. Get users set up and excited
 * to dominate their leagues.
 */

import React, { useState } from 'react';
import {
  StyleSheet,
  Text,
  View,
  TouchableOpacity,
  Dimensions,
  Image,
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withSpring,
  interpolate,
} from 'react-native-reanimated';

const { width } = Dimensions.get('window');

interface OnboardingStep {
  title: string;
  description: string;
  icon: keyof typeof Ionicons.glyphMap;
  color: string;
}

const steps: OnboardingStep[] = [
  {
    title: 'Import Your Leagues',
    description: 'Connect ESPN, Yahoo, Sleeper, and more. We support them all.',
    icon: 'cloud-download',
    color: '#3b82f6',
  },
  {
    title: 'AI-Powered Insights',
    description: 'Get lineup suggestions, trade analysis, and waiver wire gems.',
    icon: 'bulb',
    color: '#10b981',
  },
  {
    title: 'Real-Time Everything',
    description: 'Live scoring, instant notifications, and AR player stats.',
    icon: 'flash',
    color: '#f59e0b',
  },
  {
    title: 'Win Championships',
    description: 'Join thousands of users dominating their leagues.',
    icon: 'trophy',
    color: '#8b5cf6',
  },
];

export default function OnboardingScreen() {
  const navigation = useNavigation();
  const [currentStep, setCurrentStep] = useState(0);
  const translateX = useSharedValue(0);

  const handleNext = () => {
    if (currentStep < steps.length - 1) {
      translateX.value = withSpring(-(currentStep + 1) * width);
      setCurrentStep(currentStep + 1);
    } else {
      navigation.navigate('Login' as never);
    }
  };

  const handleSkip = () => {
    navigation.navigate('Login' as never);
  };

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: translateX.value }],
  }));

  return (
    <View style={styles.container}>
      {/* Skip Button */}
      <TouchableOpacity style={styles.skipButton} onPress={handleSkip}>
        <Text style={styles.skipText}>Skip</Text>
      </TouchableOpacity>

      {/* Content */}
      <View style={styles.content}>
        <Animated.View style={[styles.stepsContainer, animatedStyle]}>
          {steps.map((step, index) => (
            <View key={index} style={[styles.step, { width }]}>
              <View style={[styles.iconContainer, { backgroundColor: step.color }]}>
                <Ionicons name={step.icon} size={80} color="white" />
              </View>
              <Text style={styles.title}>{step.title}</Text>
              <Text style={styles.description}>{step.description}</Text>
            </View>
          ))}
        </Animated.View>
      </View>

      {/* Bottom Section */}
      <View style={styles.bottom}>
        {/* Dots Indicator */}
        <View style={styles.dots}>
          {steps.map((_, index) => (
            <View
              key={index}
              style={[
                styles.dot,
                index === currentStep && styles.activeDot,
                { backgroundColor: index === currentStep ? steps[currentStep].color : '#374151' },
              ]}
            />
          ))}
        </View>

        {/* Action Button */}
        <TouchableOpacity
          style={[styles.button, { backgroundColor: steps[currentStep].color }]}
          onPress={handleNext}
        >
          <Text style={styles.buttonText}>
            {currentStep === steps.length - 1 ? 'Get Started' : 'Next'}
          </Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#111827',
  },
  skipButton: {
    position: 'absolute',
    top: 60,
    right: 24,
    zIndex: 10,
  },
  skipText: {
    color: '#9ca3af',
    fontSize: 16,
  },
  content: {
    flex: 1,
    overflow: 'hidden',
  },
  stepsContainer: {
    flexDirection: 'row',
    flex: 1,
  },
  step: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 40,
  },
  iconContainer: {
    width: 160,
    height: 160,
    borderRadius: 80,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 48,
  },
  title: {
    color: 'white',
    fontSize: 28,
    fontWeight: 'bold',
    textAlign: 'center',
    marginBottom: 16,
  },
  description: {
    color: '#9ca3af',
    fontSize: 18,
    textAlign: 'center',
    lineHeight: 26,
  },
  bottom: {
    paddingHorizontal: 24,
    paddingBottom: 48,
  },
  dots: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 8,
    marginBottom: 32,
  },
  dot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  activeDot: {
    width: 24,
  },
  button: {
    borderRadius: 8,
    paddingVertical: 16,
    alignItems: 'center',
  },
  buttonText: {
    color: 'white',
    fontSize: 18,
    fontWeight: '600',
  },
});

/**
 * THE MARCUS GUARANTEE:
 * 
 * This onboarding flow:
 * - Shows value immediately
 * - Uses smooth animations
 * - Gets users excited
 * - Respects their time (skip option)
 * 
 * - Marcus "The Fixer" Rodriguez
 */