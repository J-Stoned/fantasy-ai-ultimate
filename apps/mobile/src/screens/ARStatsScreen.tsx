import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Alert,
  Dimensions,
  Platform,
} from 'react-native';
import { Camera, CameraType } from 'expo-camera';
import * as tf from '@tensorflow/tfjs';
import '@tensorflow/tfjs-react-native';
import { Canvas } from '@react-three/fiber/native';
import { ARStatsOverlay } from '@/lib/ar/ARStatsOverlay';

const { width: screenWidth, height: screenHeight } = Dimensions.get('window');

export function ARStatsScreen() {
  const [hasPermission, setHasPermission] = useState<boolean | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [detectedPlayers, setDetectedPlayers] = useState<any[]>([]);
  const [selectedPlayer, setSelectedPlayer] = useState<any>(null);
  const [tfReady, setTfReady] = useState(false);
  
  const cameraRef = useRef<Camera>(null);
  const arOverlay = useRef<ARStatsOverlay>(new ARStatsOverlay());
  const frameCount = useRef(0);

  useEffect(() => {
    // Initialize TensorFlow.js
    tf.ready().then(() => {
      setTfReady(true);
      arOverlay.current.initialize();
    });

    // Request camera permission
    (async () => {
      const { status } = await Camera.requestCameraPermissionsAsync();
      setHasPermission(status === 'granted');
    })();

    return () => {
      arOverlay.current.dispose();
    };
  }, []);

  const processFrame = async () => {
    if (!cameraRef.current || !tfReady || isProcessing) return;
    
    setIsProcessing(true);
    frameCount.current++;

    // Process every 10th frame to reduce load
    if (frameCount.current % 10 === 0) {
      try {
        const photo = await cameraRef.current.takePictureAsync({
          quality: 0.5,
          base64: false,
          skipProcessing: true,
        });

        // In production, convert photo to ImageData and process
        // For demo, we'll simulate detection
        simulatePlayerDetection();
      } catch (error) {
        console.error('Frame processing error:', error);
      }
    }

    setIsProcessing(false);
  };

  const simulatePlayerDetection = () => {
    // Simulate detecting players for demo
    const mockPlayers = [
      {
        id: '1',
        name: 'Patrick Mahomes',
        position: 'QB',
        team: 'KC',
        number: '15',
        stats: {
          points: 24.5,
          projection: 26.2,
          trend: 'up',
          gameStats: {
            passYards: 287,
            passTDs: 3,
            completions: 22,
          },
        },
        boundingBox: {
          x: screenWidth * 0.3,
          y: screenHeight * 0.2,
          width: 100,
          height: 150,
        },
      },
      {
        id: '2',
        name: 'Travis Kelce',
        position: 'TE',
        team: 'KC',
        number: '87',
        stats: {
          points: 18.3,
          projection: 16.5,
          trend: 'up',
          gameStats: {
            receptions: 7,
            recYards: 93,
            touchdowns: 1,
          },
        },
        boundingBox: {
          x: screenWidth * 0.6,
          y: screenHeight * 0.3,
          width: 100,
          height: 150,
        },
      },
    ];

    setDetectedPlayers(mockPlayers);
  };

  const renderAROverlay = () => {
    return detectedPlayers.map((player) => (
      <TouchableOpacity
        key={player.id}
        style={[
          styles.playerOverlay,
          {
            left: player.boundingBox.x,
            top: player.boundingBox.y,
            width: player.boundingBox.width,
            height: player.boundingBox.height,
          },
        ]}
        onPress={() => setSelectedPlayer(player)}
      >
        <View style={styles.playerBox}>
          <View style={styles.statsPanel}>
            <Text style={styles.playerName}>
              {player.name} ({player.position})
            </Text>
            <View style={styles.pointsRow}>
              <Text style={styles.livePoints}>{player.stats.points}</Text>
              <Text style={styles.projection}>
                Proj: {player.stats.projection}
              </Text>
              <Text style={styles.trend}>
                {player.stats.trend === 'up' ? '📈' : '📉'}
              </Text>
            </View>
            {Object.entries(player.stats.gameStats).slice(0, 2).map(([key, value]) => (
              <Text key={key} style={styles.statLine}>
                {formatStatName(key)}: {value}
              </Text>
            ))}
          </View>
        </View>
      </TouchableOpacity>
    ));
  };

  const formatStatName = (key: string): string => {
    const names: Record<string, string> = {
      passYards: 'Pass',
      passTDs: 'TD',
      rushYards: 'Rush',
      recYards: 'Rec',
      receptions: 'Rec',
      touchdowns: 'TD',
    };
    return names[key] || key;
  };

  if (hasPermission === null) {
    return <View style={styles.container} />;
  }

  if (hasPermission === false) {
    return (
      <View style={styles.container}>
        <Text style={styles.errorText}>
          Camera permission is required for AR stats
        </Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <Camera
        ref={cameraRef}
        style={styles.camera}
        type={CameraType.back}
        onCameraReady={() => {
          // Start processing frames
          const interval = setInterval(processFrame, 100);
          return () => clearInterval(interval);
        }}
      >
        <View style={styles.overlay}>
          {/* AR Overlays */}
          {renderAROverlay()}

          {/* Controls */}
          <View style={styles.controls}>
            <TouchableOpacity
              style={styles.scanButton}
              onPress={simulatePlayerDetection}
            >
              <Text style={styles.scanButtonText}>
                📸 Scan Players
              </Text>
            </TouchableOpacity>

            <View style={styles.infoPanel}>
              <Text style={styles.infoText}>
                Point camera at TV or field to see live stats
              </Text>
              <Text style={styles.detectionText}>
                {detectedPlayers.length} players detected
              </Text>
            </View>
          </View>

          {/* Selected Player Detail */}
          {selectedPlayer && (
            <View style={styles.detailPanel}>
              <TouchableOpacity
                style={styles.closeButton}
                onPress={() => setSelectedPlayer(null)}
              >
                <Text style={styles.closeButtonText}>✕</Text>
              </TouchableOpacity>

              <Text style={styles.detailTitle}>
                {selectedPlayer.name} #{selectedPlayer.number}
              </Text>
              <Text style={styles.detailTeam}>
                {selectedPlayer.team} • {selectedPlayer.position}
              </Text>

              <View style={styles.detailStats}>
                <View style={styles.statBox}>
                  <Text style={styles.statValue}>
                    {selectedPlayer.stats.points}
                  </Text>
                  <Text style={styles.statLabel}>Points</Text>
                </View>
                <View style={styles.statBox}>
                  <Text style={styles.statValue}>
                    {selectedPlayer.stats.projection}
                  </Text>
                  <Text style={styles.statLabel}>Projected</Text>
                </View>
                <View style={styles.statBox}>
                  <Text style={styles.statValue}>
                    {Math.floor(Math.random() * 50) + 1}
                  </Text>
                  <Text style={styles.statLabel}>Rank</Text>
                </View>
              </View>

              <View style={styles.gameStatsGrid}>
                {Object.entries(selectedPlayer.stats.gameStats).map(([key, value]) => (
                  <View key={key} style={styles.gameStatItem}>
                    <Text style={styles.gameStatValue}>{value}</Text>
                    <Text style={styles.gameStatLabel}>
                      {formatStatName(key)}
                    </Text>
                  </View>
                ))}
              </View>

              <TouchableOpacity style={styles.actionButton}>
                <Text style={styles.actionButtonText}>
                  View Full Stats
                </Text>
              </TouchableOpacity>
            </View>
          )}
        </View>
      </Camera>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#000',
  },
  camera: {
    flex: 1,
  },
  overlay: {
    flex: 1,
    backgroundColor: 'transparent',
  },
  playerOverlay: {
    position: 'absolute',
    borderWidth: 2,
    borderColor: '#00ff00',
    borderRadius: 4,
  },
  playerBox: {
    flex: 1,
  },
  statsPanel: {
    position: 'absolute',
    bottom: '100%',
    left: 0,
    backgroundColor: 'rgba(0, 0, 0, 0.8)',
    padding: 10,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#00ff00',
    minWidth: 200,
  },
  playerName: {
    color: '#fff',
    fontSize: 14,
    fontWeight: 'bold',
    marginBottom: 4,
  },
  pointsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 4,
  },
  livePoints: {
    color: '#00ff00',
    fontSize: 24,
    fontWeight: 'bold',
    marginRight: 10,
  },
  projection: {
    color: '#ccc',
    fontSize: 12,
    flex: 1,
  },
  trend: {
    fontSize: 20,
  },
  statLine: {
    color: '#ccc',
    fontSize: 12,
  },
  controls: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    padding: 20,
  },
  scanButton: {
    backgroundColor: '#007bff',
    paddingVertical: 15,
    paddingHorizontal: 30,
    borderRadius: 25,
    alignSelf: 'center',
    marginBottom: 20,
  },
  scanButtonText: {
    color: '#fff',
    fontSize: 18,
    fontWeight: 'bold',
  },
  infoPanel: {
    backgroundColor: 'rgba(0, 0, 0, 0.6)',
    padding: 15,
    borderRadius: 10,
  },
  infoText: {
    color: '#fff',
    fontSize: 14,
    textAlign: 'center',
    marginBottom: 5,
  },
  detectionText: {
    color: '#00ff00',
    fontSize: 12,
    textAlign: 'center',
  },
  detailPanel: {
    position: 'absolute',
    top: 50,
    left: 20,
    right: 20,
    backgroundColor: 'rgba(0, 0, 0, 0.9)',
    padding: 20,
    borderRadius: 15,
    borderWidth: 1,
    borderColor: '#007bff',
  },
  closeButton: {
    position: 'absolute',
    top: 10,
    right: 10,
    width: 30,
    height: 30,
    justifyContent: 'center',
    alignItems: 'center',
  },
  closeButtonText: {
    color: '#fff',
    fontSize: 20,
  },
  detailTitle: {
    color: '#fff',
    fontSize: 20,
    fontWeight: 'bold',
    marginBottom: 5,
  },
  detailTeam: {
    color: '#ccc',
    fontSize: 14,
    marginBottom: 15,
  },
  detailStats: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    marginBottom: 20,
  },
  statBox: {
    alignItems: 'center',
  },
  statValue: {
    color: '#00ff00',
    fontSize: 28,
    fontWeight: 'bold',
  },
  statLabel: {
    color: '#ccc',
    fontSize: 12,
    marginTop: 2,
  },
  gameStatsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    marginBottom: 20,
  },
  gameStatItem: {
    width: '33.33%',
    alignItems: 'center',
    marginBottom: 10,
  },
  gameStatValue: {
    color: '#fff',
    fontSize: 18,
    fontWeight: 'bold',
  },
  gameStatLabel: {
    color: '#999',
    fontSize: 11,
    marginTop: 2,
  },
  actionButton: {
    backgroundColor: '#007bff',
    paddingVertical: 12,
    borderRadius: 8,
  },
  actionButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: 'bold',
    textAlign: 'center',
  },
  errorText: {
    color: '#fff',
    fontSize: 16,
    textAlign: 'center',
    marginTop: 50,
  },
});