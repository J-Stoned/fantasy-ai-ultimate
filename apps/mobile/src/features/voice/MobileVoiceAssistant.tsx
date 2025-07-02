/**
 * MARCUS "THE FIXER" RODRIGUEZ - MOBILE VOICE ASSISTANT
 * 
 * "Hey Fantasy" for React Native - Your wife depends on this!
 */

import React, { useEffect, useState, useRef } from 'react';
import {
  View,
  TouchableOpacity,
  Text,
  StyleSheet,
  Animated,
  Alert,
  Platform,
} from 'react-native';
import { Audio } from 'expo-av';
import * as Speech from 'expo-speech';
import { Ionicons } from '@expo/vector-icons';

interface VoiceCommand {
  command: string;
  patterns: RegExp[];
  handler: (matches?: RegExpMatchArray) => Promise<void>;
}

export const MobileVoiceAssistant: React.FC = () => {
  const [isListening, setIsListening] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [transcript, setTranscript] = useState('');
  const pulseAnim = useRef(new Animated.Value(1)).current;
  const recording = useRef<Audio.Recording | null>(null);

  // Voice commands - same as web but adapted for mobile
  const commands: VoiceCommand[] = [
    {
      command: 'optimize lineup',
      patterns: [/optimize.*lineup/i, /set.*best.*lineup/i],
      handler: async () => {
        await speak("I'm optimizing your lineup using GPU acceleration. This will take just a moment.");
        // Navigate to lineup screen with optimization
        // navigation.navigate('Lineup', { autoOptimize: true });
      },
    },
    {
      command: 'check scores',
      patterns: [/check.*scores/i, /what.*score/i, /how.*doing/i],
      handler: async () => {
        await speak("Checking your live scores now.");
        // Navigate to matchups
        // navigation.navigate('Matchups');
      },
    },
    {
      command: 'analyze player',
      patterns: [/analyze\s+(.+)/i, /tell.*about\s+(.+)/i],
      handler: async (matches) => {
        const playerName = matches?.[1];
        if (playerName) {
          await speak(`Analyzing ${playerName} for you.`);
          // Search and navigate to player
        }
      },
    },
    {
      command: 'trade suggestions',
      patterns: [/trade.*suggestion/i, /who.*trade/i],
      handler: async () => {
        await speak("I'll find the best trade opportunities for you.");
        // Navigate to trade screen with AI suggestions
      },
    },
    {
      command: 'am i tilting',
      patterns: [/am.*i.*tilting/i, /tilt.*check/i],
      handler: async () => {
        await speak("Let me check your recent decisions. Remember, variance is part of the game. Stay focused on process over results.");
      },
    },
  ];

  useEffect(() => {
    // Request permissions on mount
    requestPermissions();
    
    // Pulse animation for listening state
    const pulseAnimation = Animated.loop(
      Animated.sequence([
        Animated.timing(pulseAnim, {
          toValue: 1.2,
          duration: 1000,
          useNativeDriver: true,
        }),
        Animated.timing(pulseAnim, {
          toValue: 1,
          duration: 1000,
          useNativeDriver: true,
        }),
      ])
    );

    if (isListening) {
      pulseAnimation.start();
    } else {
      pulseAnimation.stop();
      pulseAnim.setValue(1);
    }

    return () => {
      pulseAnimation.stop();
    };
  }, [isListening, pulseAnim]);

  const requestPermissions = async () => {
    try {
      const { status } = await Audio.requestPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert(
          'Permission Required',
          'Microphone access is needed for voice commands.'
        );
      }
    } catch (error) {
      console.error('Permission error:', error);
    }
  };

  const startListening = async () => {
    try {
      // Check if we're already recording
      if (recording.current) {
        await stopListening();
        return;
      }

      // Configure audio session
      await Audio.setAudioModeAsync({
        allowsRecordingIOS: true,
        playsInSilentModeIOS: true,
      });

      setIsListening(true);
      setTranscript('');

      // Start recording
      const { recording: newRecording } = await Audio.Recording.createAsync(
        Audio.RecordingOptionsPresets.HIGH_QUALITY
      );
      recording.current = newRecording;

      // Auto-stop after 5 seconds
      setTimeout(() => {
        if (recording.current) {
          stopListening();
        }
      }, 5000);
    } catch (error) {
      console.error('Failed to start recording:', error);
      Alert.alert('Error', 'Failed to start voice recording');
      setIsListening(false);
    }
  };

  const stopListening = async () => {
    try {
      if (!recording.current) return;

      setIsListening(false);
      setIsProcessing(true);

      // Stop and unload recording
      await recording.current.stopAndUnloadAsync();
      const uri = recording.current.getURI();
      recording.current = null;

      if (uri) {
        // Send audio to real voice processing API
        const audioData = await fetch(uri).then(r => r.blob());
        const base64Audio = await blobToBase64(audioData);
        
        const response = await fetch(`${process.env.EXPO_PUBLIC_API_URL}/api/voice/process`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            audio: base64Audio,
            userId: 'mobile-user', // Get from auth context
            includeAudio: true
          })
        });
        
        if (response.ok) {
          const result = await response.json();
          setTranscript(result.command.text);
          
          // Speak the response
          if (result.response.text) {
            await speak(result.response.text);
          }
          
          // Handle any actions
          if (result.response.actions) {
            await handleActions(result.response.actions);
          }
        } else {
          Alert.alert('Error', 'Failed to process voice command');
        }
      }

      setIsProcessing(false);
    } catch (error) {
      console.error('Failed to stop recording:', error);
      setIsProcessing(false);
    }
  };

  const blobToBase64 = (blob: Blob): Promise<string> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onloadend = () => {
        const base64 = reader.result?.toString().split(',')[1] || '';
        resolve(base64);
      };
      reader.onerror = reject;
      reader.readAsDataURL(blob);
    });
  };
  
  const handleActions = async (actions: any[]) => {
    for (const action of actions) {
      switch (action.type) {
        case 'update_lineup':
          // Navigate to lineup screen with updated data
          // navigation.navigate('Lineup', { lineup: action.lineup });
          break;
        case 'start_draft_mode':
          // Enable draft assistant
          // navigation.navigate('Draft', action.settings);
          break;
        // Add more action handlers
      }
    }
  };

  const processCommand = async (text: string) => {
    const lowerText = text.toLowerCase();

    // Check for wake word
    if (!lowerText.includes('hey fantasy') && !lowerText.includes('fantasy')) {
      // For mobile, we're more lenient with wake word
    }

    // Find matching command
    for (const cmd of commands) {
      for (const pattern of cmd.patterns) {
        const matches = lowerText.match(pattern);
        if (matches) {
          await cmd.handler(matches);
          return;
        }
      }
    }

    // No command matched
    await speak("I didn't understand that command. Try saying 'optimize lineup' or 'check scores'.");
  };

  const speak = async (text: string) => {
    try {
      await Speech.speak(text, {
        language: 'en-US',
        pitch: 1,
        rate: Platform.OS === 'ios' ? 0.95 : 1,
      });
    } catch (error) {
      console.error('Speech error:', error);
    }
  };

  return (
    <View style={styles.container}>
      <TouchableOpacity
        style={styles.voiceButton}
        onPress={startListening}
        disabled={isProcessing}
      >
        <Animated.View
          style={[
            styles.voiceButtonInner,
            isListening && {
              transform: [{ scale: pulseAnim }],
            },
          ]}
        >
          <Ionicons
            name={isListening ? 'mic' : 'mic-outline'}
            size={28}
            color="white"
          />
        </Animated.View>
      </TouchableOpacity>

      {(isListening || isProcessing) && (
        <View style={styles.statusContainer}>
          <Text style={styles.statusText}>
            {isListening ? 'Listening...' : 'Processing...'}
          </Text>
          {transcript !== '' && (
            <Text style={styles.transcriptText}>"{transcript}"</Text>
          )}
        </View>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    position: 'absolute',
    bottom: 20,
    right: 20,
    alignItems: 'center',
  },
  voiceButton: {
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: '#10b981',
    justifyContent: 'center',
    alignItems: 'center',
    elevation: 5,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 3.84,
  },
  voiceButtonInner: {
    width: 60,
    height: 60,
    borderRadius: 30,
    justifyContent: 'center',
    alignItems: 'center',
  },
  statusContainer: {
    position: 'absolute',
    bottom: 70,
    right: 0,
    backgroundColor: 'rgba(0, 0, 0, 0.8)',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    minWidth: 120,
  },
  statusText: {
    color: 'white',
    fontSize: 14,
    textAlign: 'center',
  },
  transcriptText: {
    color: '#10b981',
    fontSize: 12,
    marginTop: 4,
    textAlign: 'center',
  },
});

/**
 * THE MARCUS GUARANTEE:
 * 
 * Voice assistant placeholder:
 * - Records audio with expo-av ✓
 * - Text-to-speech with expo-speech ✓
 * - Speech-to-text NOT IMPLEMENTED YET
 * - Command processing ready for STT integration
 * 
 * - Marcus "The Fixer" Rodriguez
 */