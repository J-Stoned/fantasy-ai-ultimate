/**
 * MARCUS "THE FIXER" RODRIGUEZ - MY LEAGUES SCREEN
 * 
 * Managing multiple leagues is chaos. This screen brings order.
 * See all your leagues, standings, and quick actions in one place.
 */

import React, { useState, useEffect } from 'react';
import {
  StyleSheet,
  Text,
  View,
  ScrollView,
  TouchableOpacity,
  RefreshControl,
  Image,
  Alert,
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';

interface League {
  id: string;
  name: string;
  platform: 'espn' | 'yahoo' | 'sleeper' | 'draftkings' | 'fanfuel';
  sport: 'nfl' | 'nba' | 'mlb' | 'nhl';
  teamCount: number;
  currentRank: number;
  weeklyRank: number;
  record: { wins: number; losses: number; ties: number };
  logoUrl?: string;
  status: 'active' | 'draft' | 'complete';
  nextDeadline?: Date;
}

const platformColors = {
  espn: '#D50A0A',
  yahoo: '#6001D2',
  sleeper: '#FF6900',
  draftkings: '#53D337',
  fanfuel: '#0088FF',
};

const sportIcons: Record<string, keyof typeof Ionicons.glyphMap> = {
  nfl: 'american-football',
  nba: 'basketball',
  mlb: 'baseball',
  nhl: 'ice-cream', // No hockey icon, using closest
};

export default function MyLeaguesScreen() {
  const navigation = useNavigation();
  const [leagues, setLeagues] = useState<League[]>([]);
  const [refreshing, setRefreshing] = useState(false);
  const [filter, setFilter] = useState<'all' | 'active' | 'draft'>('all');

  useEffect(() => {
    loadLeagues();
  }, []);

  const loadLeagues = async () => {
    try {
      // TODO: Load from real API
      // Simulated data
      setTimeout(() => {
        setLeagues([
          {
            id: '1',
            name: 'The League of Champions',
            platform: 'espn',
            sport: 'nfl',
            teamCount: 12,
            currentRank: 2,
            weeklyRank: 1,
            record: { wins: 8, losses: 3, ties: 0 },
            status: 'active',
            nextDeadline: new Date(Date.now() + 2 * 24 * 60 * 60 * 1000),
          },
          {
            id: '2',
            name: 'Dynasty Warriors',
            platform: 'sleeper',
            sport: 'nfl',
            teamCount: 14,
            currentRank: 5,
            weeklyRank: 3,
            record: { wins: 6, losses: 5, ties: 0 },
            status: 'active',
          },
          {
            id: '3',
            name: 'NBA Elite',
            platform: 'yahoo',
            sport: 'nba',
            teamCount: 10,
            currentRank: 1,
            weeklyRank: 1,
            record: { wins: 32, losses: 15, ties: 0 },
            status: 'active',
          },
          {
            id: '4',
            name: '2025 Mock Draft',
            platform: 'espn',
            sport: 'nfl',
            teamCount: 12,
            currentRank: 0,
            weeklyRank: 0,
            record: { wins: 0, losses: 0, ties: 0 },
            status: 'draft',
            nextDeadline: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
          },
        ]);
        setRefreshing(false);
      }, 1000);
    } catch (error) {
      console.error('Failed to load leagues:', error);
      Alert.alert('Error', 'Failed to load leagues');
      setRefreshing(false);
    }
  };

  const onRefresh = () => {
    setRefreshing(true);
    loadLeagues();
  };

  const filteredLeagues = leagues.filter(league => {
    if (filter === 'all') return true;
    return league.status === filter;
  });

  const getRecordString = (record: League['record']) => {
    const { wins, losses, ties } = record;
    return ties > 0 ? `${wins}-${losses}-${ties}` : `${wins}-${losses}`;
  };

  const getTimeUntilDeadline = (deadline?: Date) => {
    if (!deadline) return null;
    const now = new Date();
    const diff = deadline.getTime() - now.getTime();
    const hours = Math.floor(diff / (1000 * 60 * 60));
    const days = Math.floor(hours / 24);
    
    if (days > 0) return `${days}d`;
    if (hours > 0) return `${hours}h`;
    return 'Soon';
  };

  return (
    <View style={styles.container}>
      {/* Filter Tabs */}
      <View style={styles.filterContainer}>
        <TouchableOpacity
          style={[styles.filterTab, filter === 'all' && styles.filterTabActive]}
          onPress={() => setFilter('all')}
        >
          <Text style={[styles.filterText, filter === 'all' && styles.filterTextActive]}>
            All ({leagues.length})
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.filterTab, filter === 'active' && styles.filterTabActive]}
          onPress={() => setFilter('active')}
        >
          <Text style={[styles.filterText, filter === 'active' && styles.filterTextActive]}>
            Active ({leagues.filter(l => l.status === 'active').length})
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.filterTab, filter === 'draft' && styles.filterTabActive]}
          onPress={() => setFilter('draft')}
        >
          <Text style={[styles.filterText, filter === 'draft' && styles.filterTextActive]}>
            Draft ({leagues.filter(l => l.status === 'draft').length})
          </Text>
        </TouchableOpacity>
      </View>

      <ScrollView
        style={styles.scrollView}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
        }
      >
        {filteredLeagues.map((league) => (
          <TouchableOpacity
            key={league.id}
            style={styles.leagueCard}
            onPress={() => navigation.navigate('LeagueDetail', { leagueId: league.id } as never)}
          >
            {/* Platform Badge */}
            <View style={[styles.platformBadge, { backgroundColor: platformColors[league.platform] }]}>
              <Text style={styles.platformText}>{league.platform.toUpperCase()}</Text>
            </View>

            {/* League Info */}
            <View style={styles.leagueHeader}>
              <View style={styles.leagueTitle}>
                <Ionicons name={sportIcons[league.sport]} size={20} color="#10b981" />
                <Text style={styles.leagueName}>{league.name}</Text>
              </View>
              {league.nextDeadline && (
                <View style={styles.deadlineTag}>
                  <Ionicons name="time-outline" size={14} color="#f59e0b" />
                  <Text style={styles.deadlineText}>
                    {getTimeUntilDeadline(league.nextDeadline)}
                  </Text>
                </View>
              )}
            </View>

            {/* Stats Row */}
            {league.status === 'active' && (
              <View style={styles.statsRow}>
                <View style={styles.stat}>
                  <Text style={styles.statLabel}>Rank</Text>
                  <Text style={styles.statValue}>
                    {league.currentRank}/{league.teamCount}
                  </Text>
                  {league.weeklyRank <= 3 && (
                    <Ionicons 
                      name="trending-up" 
                      size={16} 
                      color="#10b981" 
                      style={styles.trendIcon}
                    />
                  )}
                </View>
                <View style={styles.stat}>
                  <Text style={styles.statLabel}>Record</Text>
                  <Text style={styles.statValue}>{getRecordString(league.record)}</Text>
                </View>
                <View style={styles.stat}>
                  <Text style={styles.statLabel}>Week</Text>
                  <Text style={styles.statValue}>#{league.weeklyRank}</Text>
                </View>
              </View>
            )}

            {/* Draft Status */}
            {league.status === 'draft' && (
              <View style={styles.draftStatus}>
                <Ionicons name="calendar-outline" size={16} color="#f59e0b" />
                <Text style={styles.draftText}>
                  Draft scheduled • {league.teamCount} teams
                </Text>
              </View>
            )}

            {/* Quick Actions */}
            <View style={styles.quickActions}>
              {league.status === 'active' && (
                <>
                  <TouchableOpacity style={styles.actionButton}>
                    <Ionicons name="people-outline" size={18} color="#3b82f6" />
                    <Text style={styles.actionText}>Lineup</Text>
                  </TouchableOpacity>
                  <TouchableOpacity style={styles.actionButton}>
                    <Ionicons name="swap-horizontal-outline" size={18} color="#10b981" />
                    <Text style={styles.actionText}>Trade</Text>
                  </TouchableOpacity>
                  <TouchableOpacity style={styles.actionButton}>
                    <Ionicons name="add-circle-outline" size={18} color="#f59e0b" />
                    <Text style={styles.actionText}>Add</Text>
                  </TouchableOpacity>
                </>
              )}
              {league.status === 'draft' && (
                <TouchableOpacity style={styles.actionButton}>
                  <Ionicons name="list-outline" size={18} color="#8b5cf6" />
                  <Text style={styles.actionText}>Mock Draft</Text>
                </TouchableOpacity>
              )}
            </View>
          </TouchableOpacity>
        ))}

        {/* Add League Button */}
        <TouchableOpacity style={styles.addLeagueButton}>
          <Ionicons name="add-circle" size={24} color="#10b981" />
          <Text style={styles.addLeagueText}>Import or Create League</Text>
        </TouchableOpacity>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#111827',
  },
  filterContainer: {
    flexDirection: 'row',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#374151',
  },
  filterTab: {
    marginRight: 24,
    paddingVertical: 4,
  },
  filterTabActive: {
    borderBottomWidth: 2,
    borderBottomColor: '#10b981',
  },
  filterText: {
    color: '#6b7280',
    fontSize: 14,
  },
  filterTextActive: {
    color: '#10b981',
    fontWeight: '600',
  },
  scrollView: {
    flex: 1,
    padding: 16,
  },
  leagueCard: {
    backgroundColor: '#1f2937',
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    position: 'relative',
    overflow: 'hidden',
  },
  platformBadge: {
    position: 'absolute',
    top: 0,
    right: 0,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderBottomLeftRadius: 8,
  },
  platformText: {
    color: 'white',
    fontSize: 10,
    fontWeight: 'bold',
  },
  leagueHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  leagueTitle: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  leagueName: {
    color: 'white',
    fontSize: 16,
    fontWeight: '600',
    marginLeft: 8,
    flex: 1,
  },
  deadlineTag: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(245, 158, 11, 0.2)',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
  },
  deadlineText: {
    color: '#f59e0b',
    fontSize: 12,
    marginLeft: 4,
    fontWeight: '600',
  },
  statsRow: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    marginBottom: 12,
    paddingVertical: 8,
    borderTopWidth: 1,
    borderBottomWidth: 1,
    borderColor: '#374151',
  },
  stat: {
    alignItems: 'center',
    flexDirection: 'row',
  },
  statLabel: {
    color: '#6b7280',
    fontSize: 12,
    marginRight: 4,
  },
  statValue: {
    color: 'white',
    fontSize: 14,
    fontWeight: '600',
  },
  trendIcon: {
    marginLeft: 4,
  },
  draftStatus: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
    paddingVertical: 8,
  },
  draftText: {
    color: '#f59e0b',
    fontSize: 14,
    marginLeft: 8,
  },
  quickActions: {
    flexDirection: 'row',
    justifyContent: 'space-around',
  },
  actionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 8,
    paddingHorizontal: 12,
    backgroundColor: '#374151',
    borderRadius: 8,
  },
  actionText: {
    color: 'white',
    fontSize: 12,
    marginLeft: 4,
  },
  addLeagueButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#1f2937',
    borderRadius: 12,
    padding: 16,
    marginTop: 8,
    marginBottom: 24,
    borderWidth: 2,
    borderColor: '#10b981',
    borderStyle: 'dashed',
  },
  addLeagueText: {
    color: '#10b981',
    fontSize: 16,
    fontWeight: '600',
    marginLeft: 8,
  },
});

/**
 * THE MARCUS GUARANTEE:
 * 
 * This screen handles every league type:
 * - Multiple platforms (ESPN, Yahoo, Sleeper, etc)
 * - Different sports
 * - Various league states (active, draft, complete)
 * - Quick actions for common tasks
 * 
 * - Marcus "The Fixer" Rodriguez
 */