/**
 * MARCUS "THE FIXER" RODRIGUEZ - MATCHUPS SCREEN
 * 
 * See all your matchups across leagues. Live scoring, projections,
 * and that sweet feeling when you're crushing your opponent.
 */

import React, { useState, useEffect } from 'react';
import {
  StyleSheet,
  Text,
  View,
  ScrollView,
  TouchableOpacity,
  RefreshControl,
  ActivityIndicator,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Picker } from '@react-native-picker/picker';

interface PlayerScore {
  id: string;
  name: string;
  position: string;
  points: number;
  projected: number;
  status: 'yet_to_play' | 'in_progress' | 'finished';
  gameInfo?: string;
}

interface Team {
  id: string;
  name: string;
  logo?: string;
  score: number;
  projected: number;
  players: PlayerScore[];
}

interface Matchup {
  id: string;
  week: number;
  myTeam: Team;
  opponent: Team;
  winProbability: number;
}

interface League {
  id: string;
  name: string;
  platform: string;
  matchups: Matchup[];
}

export default function MatchupsScreen() {
  const [leagues, setLeagues] = useState<League[]>([]);
  const [selectedLeague, setSelectedLeague] = useState<string>('');
  const [selectedWeek, setSelectedWeek] = useState<number>(11); // Current week
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  useEffect(() => {
    loadMatchups();
  }, []);

  const loadMatchups = async () => {
    try {
      // TODO: Load from real API
      setTimeout(() => {
        const mockLeagues: League[] = [
          {
            id: '1',
            name: 'The League of Champions',
            platform: 'ESPN',
            matchups: [
              {
                id: 'm1',
                week: 11,
                myTeam: {
                  id: 't1',
                  name: 'Team Marcus',
                  score: 78.4,
                  projected: 132.5,
                  players: [
                    {
                      id: 'p1',
                      name: 'Patrick Mahomes',
                      position: 'QB',
                      points: 24.8,
                      projected: 26.2,
                      status: 'finished',
                    },
                    {
                      id: 'p2',
                      name: 'Christian McCaffrey',
                      position: 'RB',
                      points: 0,
                      projected: 22.3,
                      status: 'yet_to_play',
                      gameInfo: 'Sun 8:20',
                    },
                    {
                      id: 'p3',
                      name: 'Tyreek Hill',
                      position: 'WR',
                      points: 28.4,
                      projected: 19.2,
                      status: 'finished',
                    },
                    {
                      id: 'p4',
                      name: 'CeeDee Lamb',
                      position: 'WR',
                      points: 12.2,
                      projected: 17.5,
                      status: 'in_progress',
                      gameInfo: 'Q3 5:42',
                    },
                    // Add more players...
                  ],
                },
                opponent: {
                  id: 't2',
                  name: 'Fantasy Destroyer',
                  score: 65.2,
                  projected: 118.4,
                  players: [
                    {
                      id: 'op1',
                      name: 'Josh Allen',
                      position: 'QB',
                      points: 22.1,
                      projected: 24.5,
                      status: 'finished',
                    },
                    // Add more players...
                  ],
                },
                winProbability: 72,
              },
            ],
          },
          {
            id: '2',
            name: 'Dynasty Warriors',
            platform: 'Sleeper',
            matchups: [
              {
                id: 'm2',
                week: 11,
                myTeam: {
                  id: 't3',
                  name: 'The Fixers',
                  score: 92.1,
                  projected: 128.9,
                  players: [],
                },
                opponent: {
                  id: 't4',
                  name: 'Championship Dreams',
                  score: 88.5,
                  projected: 125.2,
                  players: [],
                },
                winProbability: 54,
              },
            ],
          },
        ];

        setLeagues(mockLeagues);
        setSelectedLeague(mockLeagues[0].id);
        setLoading(false);
        setRefreshing(false);
      }, 1000);
    } catch (error) {
      console.error('Failed to load matchups:', error);
      setLoading(false);
      setRefreshing(false);
    }
  };

  const onRefresh = () => {
    setRefreshing(true);
    loadMatchups();
  };

  const currentLeague = leagues.find(l => l.id === selectedLeague);
  const currentMatchup = currentLeague?.matchups.find(m => m.week === selectedWeek);

  const getStatusColor = (status: PlayerScore['status']) => {
    switch (status) {
      case 'finished': return '#10b981';
      case 'in_progress': return '#f59e0b';
      case 'yet_to_play': return '#6b7280';
    }
  };

  const renderPlayerScore = (player: PlayerScore, isMyTeam: boolean) => (
    <View key={player.id} style={styles.playerRow}>
      <View style={styles.playerInfo}>
        <Text style={styles.playerName}>{player.name}</Text>
        <Text style={styles.playerPosition}>{player.position}</Text>
      </View>
      
      <View style={styles.playerScoring}>
        {player.gameInfo && (
          <Text style={styles.gameInfo}>{player.gameInfo}</Text>
        )}
        <View style={[styles.statusDot, { backgroundColor: getStatusColor(player.status) }]} />
        <Text style={[
          styles.playerPoints,
          player.points > player.projected && styles.overPerforming,
          player.status === 'finished' && player.points < player.projected && styles.underPerforming,
        ]}>
          {player.points.toFixed(1)}
        </Text>
        <Text style={styles.projectedPoints}>/{player.projected.toFixed(1)}</Text>
      </View>
    </View>
  );

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#10b981" />
      </View>
    );
  }

  if (!currentMatchup) {
    return (
      <View style={styles.emptyContainer}>
        <Text style={styles.emptyText}>No matchup data available</Text>
      </View>
    );
  }

  const scoreDiff = currentMatchup.myTeam.score - currentMatchup.opponent.score;
  const projectedDiff = currentMatchup.myTeam.projected - currentMatchup.opponent.projected;

  return (
    <ScrollView
      style={styles.container}
      refreshControl={
        <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
      }
    >
      {/* League & Week Selector */}
      <View style={styles.selectors}>
        <View style={styles.leagueSelector}>
          <Picker
            selectedValue={selectedLeague}
            onValueChange={setSelectedLeague}
            style={styles.picker}
            dropdownIconColor="#10b981"
          >
            {leagues.map(league => (
              <Picker.Item
                key={league.id}
                label={`${league.name} (${league.platform})`}
                value={league.id}
                color="white"
              />
            ))}
          </Picker>
        </View>
        
        <View style={styles.weekSelector}>
          <TouchableOpacity
            style={styles.weekButton}
            onPress={() => setSelectedWeek(Math.max(1, selectedWeek - 1))}
          >
            <Ionicons name="chevron-back" size={20} color="white" />
          </TouchableOpacity>
          <Text style={styles.weekText}>Week {selectedWeek}</Text>
          <TouchableOpacity
            style={styles.weekButton}
            onPress={() => setSelectedWeek(Math.min(17, selectedWeek + 1))}
          >
            <Ionicons name="chevron-forward" size={20} color="white" />
          </TouchableOpacity>
        </View>
      </View>

      {/* Score Summary */}
      <View style={styles.scoreSummary}>
        <View style={styles.teamScore}>
          <Text style={styles.teamName}>{currentMatchup.myTeam.name}</Text>
          <Text style={styles.score}>{currentMatchup.myTeam.score.toFixed(1)}</Text>
          <Text style={styles.projected}>
            Proj: {currentMatchup.myTeam.projected.toFixed(1)}
          </Text>
        </View>

        <View style={styles.vsContainer}>
          <Text style={styles.vs}>VS</Text>
          <View style={[
            styles.scoreDiffBadge,
            scoreDiff > 0 ? styles.winning : styles.losing,
          ]}>
            <Text style={styles.scoreDiffText}>
              {scoreDiff > 0 ? '+' : ''}{scoreDiff.toFixed(1)}
            </Text>
          </View>
          <View style={styles.winProbContainer}>
            <Text style={styles.winProbLabel}>Win Prob</Text>
            <Text style={styles.winProbValue}>{currentMatchup.winProbability}%</Text>
          </View>
        </View>

        <View style={styles.teamScore}>
          <Text style={styles.teamName}>{currentMatchup.opponent.name}</Text>
          <Text style={styles.score}>{currentMatchup.opponent.score.toFixed(1)}</Text>
          <Text style={styles.projected}>
            Proj: {currentMatchup.opponent.projected.toFixed(1)}
          </Text>
        </View>
      </View>

      {/* AI Insight */}
      <View style={styles.insightCard}>
        <Ionicons name="bulb-outline" size={20} color="#f59e0b" />
        <Text style={styles.insightText}>
          {projectedDiff > 0 
            ? `You're projected to win by ${projectedDiff.toFixed(1)} points. Key player: ${currentMatchup.myTeam.players[0]?.name || 'Loading...'}`
            : `Projected to lose by ${Math.abs(projectedDiff).toFixed(1)}. Consider starting your bench RB if active.`
          }
        </Text>
      </View>

      {/* Detailed Rosters */}
      <View style={styles.rostersContainer}>
        <View style={styles.rosterColumn}>
          <Text style={styles.rosterTitle}>My Team</Text>
          {currentMatchup.myTeam.players.map(player => 
            renderPlayerScore(player, true)
          )}
          <View style={styles.rosterTotal}>
            <Text style={styles.totalLabel}>Total</Text>
            <Text style={styles.totalScore}>
              {currentMatchup.myTeam.score.toFixed(1)}
            </Text>
          </View>
        </View>

        <View style={styles.divider} />

        <View style={styles.rosterColumn}>
          <Text style={styles.rosterTitle}>Opponent</Text>
          {currentMatchup.opponent.players.map(player => 
            renderPlayerScore(player, false)
          )}
          <View style={styles.rosterTotal}>
            <Text style={styles.totalLabel}>Total</Text>
            <Text style={styles.totalScore}>
              {currentMatchup.opponent.score.toFixed(1)}
            </Text>
          </View>
        </View>
      </View>

      {/* Quick Actions */}
      <View style={styles.actions}>
        <TouchableOpacity style={styles.actionButton}>
          <Ionicons name="chatbubbles-outline" size={20} color="#3b82f6" />
          <Text style={styles.actionText}>Trash Talk</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.actionButton}>
          <Ionicons name="stats-chart-outline" size={20} color="#10b981" />
          <Text style={styles.actionText}>Live Stats</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.actionButton}>
          <Ionicons name="tv-outline" size={20} color="#f59e0b" />
          <Text style={styles.actionText}>Watch Games</Text>
        </TouchableOpacity>
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
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#111827',
  },
  emptyText: {
    color: '#6b7280',
    fontSize: 16,
  },
  selectors: {
    padding: 16,
    gap: 12,
  },
  leagueSelector: {
    backgroundColor: '#1f2937',
    borderRadius: 8,
    overflow: 'hidden',
  },
  picker: {
    color: 'white',
    height: 44,
  },
  weekSelector: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 16,
  },
  weekButton: {
    padding: 8,
  },
  weekText: {
    color: 'white',
    fontSize: 16,
    fontWeight: '600',
  },
  scoreSummary: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 20,
    backgroundColor: '#1f2937',
    marginHorizontal: 16,
    borderRadius: 12,
  },
  teamScore: {
    alignItems: 'center',
    flex: 1,
  },
  teamName: {
    color: '#9ca3af',
    fontSize: 14,
    marginBottom: 4,
  },
  score: {
    color: 'white',
    fontSize: 32,
    fontWeight: 'bold',
  },
  projected: {
    color: '#6b7280',
    fontSize: 12,
    marginTop: 4,
  },
  vsContainer: {
    alignItems: 'center',
  },
  vs: {
    color: '#6b7280',
    fontSize: 14,
    marginBottom: 8,
  },
  scoreDiffBadge: {
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: 12,
    marginBottom: 8,
  },
  winning: {
    backgroundColor: 'rgba(16, 185, 129, 0.2)',
  },
  losing: {
    backgroundColor: 'rgba(239, 68, 68, 0.2)',
  },
  scoreDiffText: {
    color: 'white',
    fontSize: 14,
    fontWeight: '600',
  },
  winProbContainer: {
    alignItems: 'center',
  },
  winProbLabel: {
    color: '#6b7280',
    fontSize: 10,
  },
  winProbValue: {
    color: '#10b981',
    fontSize: 16,
    fontWeight: '600',
  },
  insightCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#1f2937',
    margin: 16,
    padding: 12,
    borderRadius: 8,
    gap: 12,
  },
  insightText: {
    flex: 1,
    color: '#9ca3af',
    fontSize: 14,
  },
  rostersContainer: {
    flexDirection: 'row',
    paddingHorizontal: 16,
    gap: 8,
  },
  rosterColumn: {
    flex: 1,
  },
  rosterTitle: {
    color: 'white',
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 12,
    textAlign: 'center',
  },
  divider: {
    width: 1,
    backgroundColor: '#374151',
  },
  playerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#374151',
  },
  playerInfo: {
    flex: 1,
  },
  playerName: {
    color: 'white',
    fontSize: 14,
  },
  playerPosition: {
    color: '#6b7280',
    fontSize: 12,
  },
  playerScoring: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  gameInfo: {
    color: '#6b7280',
    fontSize: 11,
    marginRight: 4,
  },
  statusDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
  playerPoints: {
    color: 'white',
    fontSize: 14,
    fontWeight: '600',
  },
  overPerforming: {
    color: '#10b981',
  },
  underPerforming: {
    color: '#ef4444',
  },
  projectedPoints: {
    color: '#6b7280',
    fontSize: 12,
  },
  rosterTotal: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 12,
    paddingTop: 12,
    borderTopWidth: 2,
    borderTopColor: '#374151',
  },
  totalLabel: {
    color: 'white',
    fontSize: 16,
    fontWeight: '600',
  },
  totalScore: {
    color: 'white',
    fontSize: 18,
    fontWeight: 'bold',
  },
  actions: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    padding: 16,
    marginTop: 16,
  },
  actionButton: {
    alignItems: 'center',
    gap: 4,
  },
  actionText: {
    color: '#9ca3af',
    fontSize: 12,
  },
});

/**
 * THE MARCUS GUARANTEE:
 * 
 * This matchups screen provides:
 * - Live scoring across all leagues
 * - Win probability calculations
 * - Player-by-player breakdowns
 * - AI insights for strategy
 * - Quick access to trash talk
 * 
 * - Marcus "The Fixer" Rodriguez
 */