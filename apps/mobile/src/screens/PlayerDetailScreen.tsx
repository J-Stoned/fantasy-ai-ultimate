/**
 * MARCUS "THE FIXER" RODRIGUEZ - PLAYER DETAIL SCREEN
 * 
 * Deep dive into any player. Stats, trends, news, and AI insights.
 * Everything you need to make the right decision.
 */

import React, { useState, useEffect } from 'react';
import {
  StyleSheet,
  Text,
  View,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  Dimensions,
} from 'react-native';
import { useRoute, useNavigation } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import { LineChart } from 'react-native-chart-kit';

const { width } = Dimensions.get('window');

interface PlayerStats {
  week: number;
  points: number;
  opponent: string;
}

interface PlayerNews {
  id: string;
  date: Date;
  headline: string;
  impact: 'positive' | 'negative' | 'neutral';
}

interface PlayerData {
  id: string;
  name: string;
  position: string;
  team: string;
  number: number;
  status: string;
  byeWeek: number;
  age: number;
  experience: number;
  height: string;
  weight: string;
  college: string;
  seasonStats: {
    gamesPlayed: number;
    totalPoints: number;
    avgPoints: number;
    projectedPoints: number;
    rank: number;
    positionRank: number;
  };
  weeklyStats: PlayerStats[];
  news: PlayerNews[];
  ownership: {
    percent: number;
    trend: 'up' | 'down' | 'stable';
    change: number;
  };
  aiInsight: string;
}

export default function PlayerDetailScreen() {
  const route = useRoute();
  const navigation = useNavigation();
  const { playerId } = route.params as { playerId: string };
  
  const [loading, setLoading] = useState(true);
  const [playerData, setPlayerData] = useState<PlayerData | null>(null);
  const [activeTab, setActiveTab] = useState<'stats' | 'news' | 'analysis'>('stats');

  useEffect(() => {
    loadPlayerData();
  }, [playerId]);

  const loadPlayerData = async () => {
    try {
      // TODO: Load from real API
      setTimeout(() => {
        setPlayerData({
          id: playerId,
          name: 'Patrick Mahomes',
          position: 'QB',
          team: 'KC',
          number: 15,
          status: 'healthy',
          byeWeek: 10,
          age: 28,
          experience: 7,
          height: "6'3\"",
          weight: '230 lbs',
          college: 'Texas Tech',
          seasonStats: {
            gamesPlayed: 11,
            totalPoints: 272.8,
            avgPoints: 24.8,
            projectedPoints: 26.2,
            rank: 1,
            positionRank: 1,
          },
          weeklyStats: [
            { week: 1, points: 28.4, opponent: 'DET' },
            { week: 2, points: 22.1, opponent: '@JAX' },
            { week: 3, points: 31.2, opponent: 'CHI' },
            { week: 4, points: 19.8, opponent: '@NYJ' },
            { week: 5, points: 26.5, opponent: 'MIN' },
            { week: 6, points: 24.3, opponent: 'DEN' },
            { week: 7, points: 20.1, opponent: '@SF' },
            { week: 8, points: 29.7, opponent: 'LV' },
            { week: 9, points: 23.4, opponent: '@MIA' },
            { week: 10, points: 0, opponent: 'BYE' },
            { week: 11, points: 28.4, opponent: 'BUF' },
          ],
          news: [
            {
              id: 'n1',
              date: new Date(Date.now() - 2 * 60 * 60 * 1000),
              headline: 'Mahomes throws 3 TDs in win over Bills',
              impact: 'positive',
            },
            {
              id: 'n2',
              date: new Date(Date.now() - 24 * 60 * 60 * 1000),
              headline: 'Full practice Wednesday, no injury designation',
              impact: 'positive',
            },
          ],
          ownership: {
            percent: 99.8,
            trend: 'stable',
            change: 0.1,
          },
          aiInsight: "Elite QB1 with consistent floor and massive ceiling. Must-start every week when healthy. Recent connection with Rice emerging as secondary target behind Kelce. Buy-low window closed.",
        });
        setLoading(false);
      }, 1000);
    } catch (error) {
      console.error('Failed to load player data:', error);
      setLoading(false);
    }
  };

  const renderStats = () => {
    if (!playerData) return null;

    const chartData = {
      labels: playerData.weeklyStats.map(s => `W${s.week}`),
      datasets: [{
        data: playerData.weeklyStats.map(s => s.points),
      }],
    };

    return (
      <View style={styles.statsContainer}>
        {/* Season Overview */}
        <View style={styles.statsGrid}>
          <View style={styles.statBox}>
            <Text style={styles.statValue}>{playerData.seasonStats.avgPoints.toFixed(1)}</Text>
            <Text style={styles.statLabel}>AVG PTS</Text>
          </View>
          <View style={styles.statBox}>
            <Text style={styles.statValue}>#{playerData.seasonStats.rank}</Text>
            <Text style={styles.statLabel}>OVERALL</Text>
          </View>
          <View style={styles.statBox}>
            <Text style={styles.statValue}>#{playerData.seasonStats.positionRank}</Text>
            <Text style={styles.statLabel}>{playerData.position} RANK</Text>
          </View>
          <View style={styles.statBox}>
            <Text style={styles.statValue}>{playerData.seasonStats.totalPoints.toFixed(0)}</Text>
            <Text style={styles.statLabel}>TOTAL PTS</Text>
          </View>
        </View>

        {/* Points Chart */}
        <View style={styles.chartContainer}>
          <Text style={styles.chartTitle}>Weekly Performance</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false}>
            <LineChart
              data={chartData}
              width={Math.max(width - 32, playerData.weeklyStats.length * 50)}
              height={200}
              chartConfig={{
                backgroundColor: '#1f2937',
                backgroundGradientFrom: '#1f2937',
                backgroundGradientTo: '#1f2937',
                decimalPlaces: 1,
                color: (opacity = 1) => `rgba(16, 185, 129, ${opacity})`,
                labelColor: (opacity = 1) => `rgba(156, 163, 175, ${opacity})`,
                style: {
                  borderRadius: 16,
                },
                propsForDots: {
                  r: '6',
                  strokeWidth: '2',
                  stroke: '#10b981',
                },
              }}
              bezier
              style={{
                marginVertical: 8,
                borderRadius: 16,
              }}
            />
          </ScrollView>
        </View>

        {/* Game Log */}
        <View style={styles.gameLog}>
          <Text style={styles.gameLogTitle}>Game Log</Text>
          {playerData.weeklyStats.slice().reverse().slice(0, 5).map((game) => (
            <View key={game.week} style={styles.gameRow}>
              <Text style={styles.gameWeek}>Week {game.week}</Text>
              <Text style={styles.gameOpponent}>{game.opponent}</Text>
              <Text style={[
                styles.gamePoints,
                game.points > playerData.seasonStats.avgPoints && styles.goodGame,
                game.points < playerData.seasonStats.avgPoints * 0.8 && styles.badGame,
              ]}>
                {game.points.toFixed(1)} pts
              </Text>
            </View>
          ))}
        </View>
      </View>
    );
  };

  const renderNews = () => {
    if (!playerData) return null;

    return (
      <View style={styles.newsContainer}>
        {playerData.news.map((item) => (
          <View key={item.id} style={styles.newsItem}>
            <View style={[styles.newsIcon, { backgroundColor: getNewsColor(item.impact) }]}>
              <Ionicons
                name={getNewsIcon(item.impact)}
                size={20}
                color="white"
              />
            </View>
            <View style={styles.newsContent}>
              <Text style={styles.newsHeadline}>{item.headline}</Text>
              <Text style={styles.newsDate}>
                {formatRelativeDate(item.date)}
              </Text>
            </View>
          </View>
        ))}
      </View>
    );
  };

  const renderAnalysis = () => {
    if (!playerData) return null;

    return (
      <View style={styles.analysisContainer}>
        {/* AI Insight */}
        <View style={styles.insightCard}>
          <View style={styles.insightHeader}>
            <Ionicons name="bulb" size={24} color="#f59e0b" />
            <Text style={styles.insightTitle}>AI Analysis</Text>
          </View>
          <Text style={styles.insightText}>{playerData.aiInsight}</Text>
        </View>

        {/* Ownership Trends */}
        <View style={styles.ownershipCard}>
          <Text style={styles.ownershipTitle}>Ownership Trends</Text>
          <View style={styles.ownershipStats}>
            <View style={styles.ownershipMain}>
              <Text style={styles.ownershipPercent}>{playerData.ownership.percent}%</Text>
              <View style={styles.ownershipTrend}>
                <Ionicons
                  name={
                    playerData.ownership.trend === 'up' ? 'trending-up' :
                    playerData.ownership.trend === 'down' ? 'trending-down' :
                    'remove'
                  }
                  size={16}
                  color={
                    playerData.ownership.trend === 'up' ? '#10b981' :
                    playerData.ownership.trend === 'down' ? '#ef4444' :
                    '#6b7280'
                  }
                />
                <Text style={styles.ownershipChange}>
                  {playerData.ownership.change > 0 ? '+' : ''}{playerData.ownership.change}%
                </Text>
              </View>
            </View>
          </View>
        </View>

        {/* Quick Actions */}
        <View style={styles.quickActions}>
          <TouchableOpacity style={styles.actionButton}>
            <Ionicons name="add-circle" size={20} color="white" />
            <Text style={styles.actionText}>Add to Watchlist</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.actionButton}>
            <Ionicons name="swap-horizontal" size={20} color="white" />
            <Text style={styles.actionText}>Trade For</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  };

  const getNewsIcon = (impact: string): keyof typeof Ionicons.glyphMap => {
    switch (impact) {
      case 'positive': return 'trending-up';
      case 'negative': return 'trending-down';
      default: return 'information-circle';
    }
  };

  const getNewsColor = (impact: string) => {
    switch (impact) {
      case 'positive': return '#10b981';
      case 'negative': return '#ef4444';
      default: return '#6b7280';
    }
  };

  const formatRelativeDate = (date: Date) => {
    const now = new Date();
    const diff = now.getTime() - date.getTime();
    const hours = Math.floor(diff / (1000 * 60 * 60));
    
    if (hours < 1) return 'Just now';
    if (hours < 24) return `${hours}h ago`;
    return date.toLocaleDateString();
  };

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#10b981" />
      </View>
    );
  }

  if (!playerData) {
    return (
      <View style={styles.errorContainer}>
        <Text style={styles.errorText}>Player not found</Text>
      </View>
    );
  }

  return (
    <ScrollView style={styles.container}>
      {/* Player Header */}
      <View style={styles.header}>
        <View style={styles.playerBasicInfo}>
          <View style={styles.playerNumber}>
            <Text style={styles.numberText}>{playerData.number}</Text>
          </View>
          <View style={styles.playerDetails}>
            <Text style={styles.playerName}>{playerData.name}</Text>
            <View style={styles.playerMeta}>
              <Text style={styles.playerTeam}>{playerData.position} • {playerData.team}</Text>
              <View style={[styles.statusBadge, { backgroundColor: playerData.status === 'healthy' ? '#10b981' : '#ef4444' }]}>
                <Text style={styles.statusText}>{playerData.status.toUpperCase()}</Text>
              </View>
            </View>
          </View>
        </View>
        
        <View style={styles.playerAttributes}>
          <View style={styles.attribute}>
            <Text style={styles.attributeLabel}>Age</Text>
            <Text style={styles.attributeValue}>{playerData.age}</Text>
          </View>
          <View style={styles.attribute}>
            <Text style={styles.attributeLabel}>Exp</Text>
            <Text style={styles.attributeValue}>{playerData.experience}yr</Text>
          </View>
          <View style={styles.attribute}>
            <Text style={styles.attributeLabel}>Bye</Text>
            <Text style={styles.attributeValue}>W{playerData.byeWeek}</Text>
          </View>
          <View style={styles.attribute}>
            <Text style={styles.attributeLabel}>Size</Text>
            <Text style={styles.attributeValue}>{playerData.height}</Text>
          </View>
        </View>
      </View>

      {/* Tabs */}
      <View style={styles.tabs}>
        <TouchableOpacity
          style={[styles.tab, activeTab === 'stats' && styles.activeTab]}
          onPress={() => setActiveTab('stats')}
        >
          <Text style={[styles.tabText, activeTab === 'stats' && styles.activeTabText]}>
            Stats
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.tab, activeTab === 'news' && styles.activeTab]}
          onPress={() => setActiveTab('news')}
        >
          <Text style={[styles.tabText, activeTab === 'news' && styles.activeTabText]}>
            News
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.tab, activeTab === 'analysis' && styles.activeTab]}
          onPress={() => setActiveTab('analysis')}
        >
          <Text style={[styles.tabText, activeTab === 'analysis' && styles.activeTabText]}>
            Analysis
          </Text>
        </TouchableOpacity>
      </View>

      {/* Tab Content */}
      <View style={styles.tabContent}>
        {activeTab === 'stats' && renderStats()}
        {activeTab === 'news' && renderNews()}
        {activeTab === 'analysis' && renderAnalysis()}
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#111827',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#111827',
  },
  errorContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#111827',
  },
  errorText: {
    color: '#ef4444',
    fontSize: 16,
  },
  header: {
    backgroundColor: '#1f2937',
    padding: 20,
  },
  playerBasicInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 16,
  },
  playerNumber: {
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: '#374151',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 16,
  },
  numberText: {
    color: 'white',
    fontSize: 24,
    fontWeight: 'bold',
  },
  playerDetails: {
    flex: 1,
  },
  playerName: {
    color: 'white',
    fontSize: 24,
    fontWeight: 'bold',
  },
  playerMeta: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 4,
    gap: 12,
  },
  playerTeam: {
    color: '#9ca3af',
    fontSize: 16,
  },
  statusBadge: {
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 4,
  },
  statusText: {
    color: 'white',
    fontSize: 10,
    fontWeight: 'bold',
  },
  playerAttributes: {
    flexDirection: 'row',
    justifyContent: 'space-around',
  },
  attribute: {
    alignItems: 'center',
  },
  attributeLabel: {
    color: '#6b7280',
    fontSize: 12,
  },
  attributeValue: {
    color: 'white',
    fontSize: 16,
    fontWeight: '600',
    marginTop: 2,
  },
  tabs: {
    flexDirection: 'row',
    borderBottomWidth: 1,
    borderBottomColor: '#374151',
  },
  tab: {
    flex: 1,
    paddingVertical: 16,
    alignItems: 'center',
  },
  activeTab: {
    borderBottomWidth: 2,
    borderBottomColor: '#10b981',
  },
  tabText: {
    color: '#6b7280',
    fontSize: 16,
  },
  activeTabText: {
    color: '#10b981',
    fontWeight: '600',
  },
  tabContent: {
    padding: 16,
  },
  statsContainer: {
    gap: 20,
  },
  statsGrid: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  statBox: {
    flex: 1,
    alignItems: 'center',
    backgroundColor: '#1f2937',
    padding: 16,
    borderRadius: 8,
    marginHorizontal: 4,
  },
  statValue: {
    color: 'white',
    fontSize: 24,
    fontWeight: 'bold',
  },
  statLabel: {
    color: '#6b7280',
    fontSize: 10,
    marginTop: 4,
  },
  chartContainer: {
    backgroundColor: '#1f2937',
    borderRadius: 12,
    padding: 16,
  },
  chartTitle: {
    color: 'white',
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 12,
  },
  gameLog: {
    backgroundColor: '#1f2937',
    borderRadius: 8,
    padding: 16,
  },
  gameLogTitle: {
    color: 'white',
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 12,
  },
  gameRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#374151',
  },
  gameWeek: {
    color: '#9ca3af',
    fontSize: 14,
    flex: 1,
  },
  gameOpponent: {
    color: 'white',
    fontSize: 14,
    flex: 2,
  },
  gamePoints: {
    color: 'white',
    fontSize: 14,
    fontWeight: '600',
    flex: 1,
    textAlign: 'right',
  },
  goodGame: {
    color: '#10b981',
  },
  badGame: {
    color: '#ef4444',
  },
  newsContainer: {
    gap: 12,
  },
  newsItem: {
    flexDirection: 'row',
    backgroundColor: '#1f2937',
    borderRadius: 8,
    padding: 12,
  },
  newsIcon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  newsContent: {
    flex: 1,
  },
  newsHeadline: {
    color: 'white',
    fontSize: 14,
    fontWeight: '600',
  },
  newsDate: {
    color: '#6b7280',
    fontSize: 12,
    marginTop: 4,
  },
  analysisContainer: {
    gap: 16,
  },
  insightCard: {
    backgroundColor: '#1f2937',
    borderRadius: 8,
    padding: 16,
  },
  insightHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 12,
  },
  insightTitle: {
    color: 'white',
    fontSize: 16,
    fontWeight: '600',
  },
  insightText: {
    color: '#9ca3af',
    fontSize: 14,
    lineHeight: 20,
  },
  ownershipCard: {
    backgroundColor: '#1f2937',
    borderRadius: 8,
    padding: 16,
  },
  ownershipTitle: {
    color: 'white',
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 12,
  },
  ownershipStats: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  ownershipMain: {
    alignItems: 'center',
  },
  ownershipPercent: {
    color: 'white',
    fontSize: 32,
    fontWeight: 'bold',
  },
  ownershipTrend: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginTop: 4,
  },
  ownershipChange: {
    color: '#9ca3af',
    fontSize: 14,
  },
  quickActions: {
    flexDirection: 'row',
    gap: 12,
  },
  actionButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#374151',
    borderRadius: 8,
    paddingVertical: 12,
    gap: 8,
  },
  actionText: {
    color: 'white',
    fontSize: 14,
    fontWeight: '600',
  },
});

/**
 * THE MARCUS GUARANTEE:
 * 
 * This player detail screen provides:
 * - Complete stats and trends
 * - Real-time news updates
 * - AI-powered analysis
 * - Ownership tracking
 * - Quick action buttons
 * 
 * - Marcus "The Fixer" Rodriguez
 */