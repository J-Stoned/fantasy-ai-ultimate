import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  ScrollView,
  StyleSheet,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
  Vibration,
} from 'react-native';
import { useColorScheme } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';

interface PatternAlert {
  id: string;
  type: 'hot_pick' | 'value_play' | 'fade_alert' | 'injury_update' | 'line_movement';
  pattern: string;
  confidence: number;
  impact: 'high' | 'medium' | 'low';
  data: {
    players?: string[];
    teams?: string[];
    game?: string;
    reason: string;
    timestamp: string;
  };
}

export function PatternScreen() {
  const colorScheme = useColorScheme();
  const isDark = colorScheme === 'dark';
  
  const [patterns, setPatterns] = useState<PatternAlert[]>([]);
  const [connected, setConnected] = useState(false);
  const [loading, setLoading] = useState(true);
  const [wsConnection, setWsConnection] = useState<WebSocket | null>(null);

  useEffect(() => {
    connectToPatternStream();
    loadPatternStats();
    
    return () => {
      if (wsConnection) {
        wsConnection.close();
      }
    };
  }, []);

  const connectToPatternStream = () => {
    try {
      const ws = new WebSocket('ws://localhost:3340');
      
      ws.onopen = () => {
        console.log('Mobile connected to pattern stream');
        setConnected(true);
      };

      ws.onmessage = (event) => {
        const data = JSON.parse(event.data);
        
        if (data.type === 'pattern_alert') {
          handleNewAlert(data.alert);
        }
      };

      ws.onerror = (error) => {
        console.error('WebSocket error:', error);
        setConnected(false);
      };

      ws.onclose = () => {
        setConnected(false);
        // Retry connection
        setTimeout(connectToPatternStream, 5000);
      };

      setWsConnection(ws);
    } catch (error) {
      console.error('Failed to connect:', error);
      setConnected(false);
    }
  };

  const handleNewAlert = (alert: PatternAlert) => {
    // Vibrate on high impact alerts
    if (alert.impact === 'high') {
      Vibration.vibrate([0, 200, 100, 200]);
    }
    
    setPatterns(prev => [alert, ...prev].slice(0, 10));
  };

  const loadPatternStats = async () => {
    try {
      const response = await fetch('http://localhost:3338/api/unified/stats');
      const data = await response.json();
      
      if (data.success) {
        setLoading(false);
      }
    } catch (error) {
      console.error('Failed to load stats:', error);
      setLoading(false);
    }
  };

  const getAlertIcon = (type: string) => {
    const icons: Record<string, string> = {
      hot_pick: 'flame',
      value_play: 'diamond',
      fade_alert: 'warning',
      injury_update: 'medical',
      line_movement: 'trending-up'
    };
    return icons[type] || 'alert-circle';
  };

  const getAlertColors = (type: string) => {
    const colors: Record<string, string[]> = {
      hot_pick: ['#ef4444', '#f97316'],
      value_play: ['#3b82f6', '#8b5cf6'],
      fade_alert: ['#f59e0b', '#ef4444'],
      injury_update: ['#6b7280', '#4b5563'],
      line_movement: ['#10b981', '#14b8a6']
    };
    return colors[type] || ['#6b7280', '#4b5563'];
  };

  const styles = StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: isDark ? '#111827' : '#f9fafb',
    },
    header: {
      padding: 20,
      paddingTop: 60,
      backgroundColor: isDark ? '#1f2937' : '#ffffff',
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 2 },
      shadowOpacity: 0.1,
      shadowRadius: 4,
      elevation: 5,
    },
    headerTitle: {
      fontSize: 28,
      fontWeight: 'bold',
      color: isDark ? '#ffffff' : '#111827',
      marginBottom: 8,
    },
    connectionStatus: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 8,
    },
    connectionDot: {
      width: 8,
      height: 8,
      borderRadius: 4,
      backgroundColor: connected ? '#10b981' : '#ef4444',
    },
    connectionText: {
      fontSize: 14,
      color: isDark ? '#9ca3af' : '#6b7280',
    },
    content: {
      flex: 1,
      padding: 16,
    },
    statsCard: {
      backgroundColor: isDark ? '#1f2937' : '#ffffff',
      borderRadius: 16,
      padding: 20,
      marginBottom: 20,
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 2 },
      shadowOpacity: 0.05,
      shadowRadius: 8,
      elevation: 3,
    },
    statsRow: {
      flexDirection: 'row',
      justifyContent: 'space-around',
      marginTop: 16,
    },
    statItem: {
      alignItems: 'center',
    },
    statValue: {
      fontSize: 24,
      fontWeight: 'bold',
      color: isDark ? '#ffffff' : '#111827',
    },
    statLabel: {
      fontSize: 12,
      color: isDark ? '#9ca3af' : '#6b7280',
      marginTop: 4,
    },
    alertsSection: {
      flex: 1,
    },
    sectionTitle: {
      fontSize: 20,
      fontWeight: '600',
      color: isDark ? '#ffffff' : '#111827',
      marginBottom: 16,
    },
    alertCard: {
      marginBottom: 12,
      borderRadius: 12,
      overflow: 'hidden',
    },
    alertGradient: {
      padding: 2,
    },
    alertContent: {
      backgroundColor: isDark ? '#1f2937' : '#ffffff',
      borderRadius: 10,
      padding: 16,
    },
    alertHeader: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'flex-start',
      marginBottom: 8,
    },
    alertTypeRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 8,
    },
    alertType: {
      fontSize: 16,
      fontWeight: '600',
      color: isDark ? '#ffffff' : '#111827',
      textTransform: 'capitalize',
    },
    alertTime: {
      fontSize: 12,
      color: isDark ? '#9ca3af' : '#6b7280',
      marginTop: 2,
    },
    alertBadges: {
      flexDirection: 'row',
      gap: 8,
      alignItems: 'center',
    },
    confidenceBadge: {
      backgroundColor: isDark ? '#374151' : '#f3f4f6',
      paddingHorizontal: 8,
      paddingVertical: 4,
      borderRadius: 12,
    },
    confidenceText: {
      fontSize: 12,
      fontWeight: '600',
      color: isDark ? '#ffffff' : '#111827',
    },
    impactBadge: {
      paddingHorizontal: 8,
      paddingVertical: 4,
      borderRadius: 12,
    },
    impactText: {
      fontSize: 10,
      fontWeight: '600',
      textTransform: 'uppercase',
    },
    alertReason: {
      fontSize: 14,
      color: isDark ? '#d1d5db' : '#374151',
      marginBottom: 8,
      lineHeight: 20,
    },
    alertTags: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: 6,
    },
    alertTag: {
      backgroundColor: isDark ? '#374151' : '#e5e7eb',
      paddingHorizontal: 10,
      paddingVertical: 4,
      borderRadius: 8,
    },
    alertTagText: {
      fontSize: 12,
      color: isDark ? '#d1d5db' : '#4b5563',
    },
    emptyState: {
      flex: 1,
      justifyContent: 'center',
      alignItems: 'center',
      paddingVertical: 60,
    },
    emptyIcon: {
      marginBottom: 16,
    },
    emptyText: {
      fontSize: 16,
      color: isDark ? '#9ca3af' : '#6b7280',
      textAlign: 'center',
    },
    loadingContainer: {
      flex: 1,
      justifyContent: 'center',
      alignItems: 'center',
    },
  });

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#3b82f6" />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>📊 Pattern Analysis</Text>
        <View style={styles.connectionStatus}>
          <View style={styles.connectionDot} />
          <Text style={styles.connectionText}>
            {connected ? 'Live Streaming' : 'Connecting...'}
          </Text>
        </View>
      </View>

      <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
        {/* Stats Card */}
        <View style={styles.statsCard}>
          <Text style={{ fontSize: 18, fontWeight: '600', color: isDark ? '#ffffff' : '#111827' }}>
            Pattern Engine Stats
          </Text>
          <View style={styles.statsRow}>
            <View style={styles.statItem}>
              <Text style={styles.statValue}>65.2%</Text>
              <Text style={styles.statLabel}>Accuracy</Text>
            </View>
            <View style={styles.statItem}>
              <Text style={styles.statValue}>5,542</Text>
              <Text style={styles.statLabel}>Games</Text>
            </View>
            <View style={styles.statItem}>
              <Text style={styles.statValue}>12.5%</Text>
              <Text style={styles.statLabel}>ROI</Text>
            </View>
          </View>
        </View>

        {/* Live Alerts */}
        <View style={styles.alertsSection}>
          <Text style={styles.sectionTitle}>Live Pattern Alerts</Text>
          
          {patterns.length === 0 ? (
            <View style={styles.emptyState}>
              <Ionicons 
                name="radio-outline" 
                size={48} 
                color={isDark ? '#6b7280' : '#9ca3af'}
                style={styles.emptyIcon}
              />
              <Text style={styles.emptyText}>
                Waiting for pattern alerts...{'\n'}
                Alerts will appear here in real-time
              </Text>
            </View>
          ) : (
            patterns.map((alert) => (
              <TouchableOpacity
                key={alert.id}
                style={styles.alertCard}
                onPress={() => {
                  Alert.alert(
                    alert.type.replace('_', ' ').toUpperCase(),
                    alert.data.reason,
                    [{ text: 'OK' }]
                  );
                }}
              >
                <LinearGradient
                  colors={getAlertColors(alert.type)}
                  style={styles.alertGradient}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 0 }}
                >
                  <View style={styles.alertContent}>
                    <View style={styles.alertHeader}>
                      <View>
                        <View style={styles.alertTypeRow}>
                          <Ionicons 
                            name={getAlertIcon(alert.type) as any} 
                            size={20} 
                            color={getAlertColors(alert.type)[0]}
                          />
                          <Text style={styles.alertType}>
                            {alert.type.replace('_', ' ')}
                          </Text>
                        </View>
                        <Text style={styles.alertTime}>
                          {new Date(alert.data.timestamp).toLocaleTimeString()}
                        </Text>
                      </View>
                      
                      <View style={styles.alertBadges}>
                        <View style={styles.confidenceBadge}>
                          <Text style={styles.confidenceText}>{alert.confidence}%</Text>
                        </View>
                        <View style={[
                          styles.impactBadge,
                          {
                            backgroundColor: alert.impact === 'high' 
                              ? '#fee2e2' 
                              : alert.impact === 'medium'
                              ? '#fef3c7'
                              : '#d1fae5'
                          }
                        ]}>
                          <Text style={[
                            styles.impactText,
                            {
                              color: alert.impact === 'high'
                                ? '#dc2626'
                                : alert.impact === 'medium'
                                ? '#f59e0b'
                                : '#10b981'
                            }
                          ]}>
                            {alert.impact}
                          </Text>
                        </View>
                      </View>
                    </View>
                    
                    <Text style={styles.alertReason}>{alert.data.reason}</Text>
                    
                    {(alert.data.players || alert.data.teams) && (
                      <View style={styles.alertTags}>
                        {alert.data.players?.map((player, idx) => (
                          <View key={idx} style={styles.alertTag}>
                            <Text style={styles.alertTagText}>{player}</Text>
                          </View>
                        ))}
                        {alert.data.teams?.map((team, idx) => (
                          <View key={`team-${idx}`} style={[
                            styles.alertTag,
                            { backgroundColor: isDark ? '#1e40af' : '#dbeafe' }
                          ]}>
                            <Text style={[
                              styles.alertTagText,
                              { color: isDark ? '#93bbfc' : '#1e40af' }
                            ]}>
                              {team}
                            </Text>
                          </View>
                        ))}
                      </View>
                    )}
                  </View>
                </LinearGradient>
              </TouchableOpacity>
            ))
          )}
        </View>
      </ScrollView>
    </View>
  );
}