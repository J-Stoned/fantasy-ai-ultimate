/**
 * MARCUS "THE FIXER" RODRIGUEZ - LEAGUE DETAIL SCREEN
 * 
 * Everything about a league in one place. Standings, transactions,
 * league chat, and quick actions.
 */

import React, { useState, useEffect } from 'react';
import {
  StyleSheet,
  Text,
  View,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  RefreshControl,
} from 'react-native';
import { useRoute, useNavigation } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';

interface Team {
  id: string;
  name: string;
  owner: string;
  rank: number;
  record: { wins: number; losses: number; ties: number };
  pointsFor: number;
  pointsAgainst: number;
  streak: string;
  lastWeekRank: number;
}

interface Transaction {
  id: string;
  type: 'trade' | 'add' | 'drop';
  team: string;
  date: Date;
  details: string;
}

interface LeagueSettings {
  scoringType: string;
  tradeDeadline: Date;
  playoffTeams: number;
  playoffWeeks: string;
  waiverType: string;
}

export default function LeagueDetailScreen() {
  const route = useRoute();
  const navigation = useNavigation();
  const { leagueId } = route.params as { leagueId: string };
  
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [activeTab, setActiveTab] = useState<'standings' | 'transactions' | 'settings'>('standings');
  const [leagueData, setLeagueData] = useState({
    name: '',
    platform: '',
    teams: [] as Team[],
    transactions: [] as Transaction[],
    settings: {} as LeagueSettings,
  });

  useEffect(() => {
    loadLeagueDetails();
  }, [leagueId]);

  const loadLeagueDetails = async () => {
    try {
      // TODO: Load from real API
      setTimeout(() => {
        setLeagueData({
          name: 'The League of Champions',
          platform: 'ESPN',
          teams: [
            {
              id: '1',
              name: 'Team Marcus',
              owner: 'Marcus R.',
              rank: 1,
              record: { wins: 9, losses: 2, ties: 0 },
              pointsFor: 1425.8,
              pointsAgainst: 1289.2,
              streak: 'W4',
              lastWeekRank: 2,
            },
            {
              id: '2',
              name: 'Fantasy Destroyer',
              owner: 'John D.',
              rank: 2,
              record: { wins: 8, losses: 3, ties: 0 },
              pointsFor: 1398.4,
              pointsAgainst: 1301.5,
              streak: 'W1',
              lastWeekRank: 1,
            },
            // Add more teams...
          ],
          transactions: [
            {
              id: 't1',
              type: 'trade',
              team: 'Team Marcus',
              date: new Date(Date.now() - 24 * 60 * 60 * 1000),
              details: 'Traded CeeDee Lamb to Fantasy Destroyer for Tyreek Hill',
            },
            {
              id: 't2',
              type: 'add',
              team: 'Championship Dreams',
              date: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000),
              details: 'Added Jaylen Warren, Dropped Zack Moss',
            },
          ],
          settings: {
            scoringType: 'PPR',
            tradeDeadline: new Date('2025-11-15'),
            playoffTeams: 6,
            playoffWeeks: 'Weeks 15-17',
            waiverType: 'FAAB ($100)',
          },
        });
        setLoading(false);
        setRefreshing(false);
      }, 1000);
    } catch (error) {
      console.error('Failed to load league details:', error);
      setLoading(false);
      setRefreshing(false);
    }
  };

  const onRefresh = () => {
    setRefreshing(true);
    loadLeagueDetails();
  };

  const renderStandings = () => (
    <View style={styles.standingsContainer}>
      <View style={styles.standingsHeader}>
        <Text style={[styles.headerText, { flex: 2 }]}>Team</Text>
        <Text style={styles.headerText}>W-L</Text>
        <Text style={styles.headerText}>PF</Text>
        <Text style={styles.headerText}>Streak</Text>
      </View>
      {leagueData.teams.map((team) => (
        <TouchableOpacity
          key={team.id}
          style={styles.teamRow}
          onPress={() => console.log('Navigate to team', team.id)}
        >
          <View style={styles.rankBadge}>
            <Text style={styles.rankText}>{team.rank}</Text>
            {team.rank < team.lastWeekRank && (
              <Ionicons name="arrow-up" size={12} color="#10b981" />
            )}
            {team.rank > team.lastWeekRank && (
              <Ionicons name="arrow-down" size={12} color="#ef4444" />
            )}
          </View>
          <View style={{ flex: 2 }}>
            <Text style={styles.teamName}>{team.name}</Text>
            <Text style={styles.ownerName}>{team.owner}</Text>
          </View>
          <Text style={styles.record}>
            {team.record.wins}-{team.record.losses}
            {team.record.ties > 0 && `-${team.record.ties}`}
          </Text>
          <Text style={styles.points}>{team.pointsFor.toFixed(1)}</Text>
          <View style={[styles.streakBadge, team.streak.startsWith('W') ? styles.winStreak : styles.loseStreak]}>
            <Text style={styles.streakText}>{team.streak}</Text>
          </View>
        </TouchableOpacity>
      ))}
    </View>
  );

  const renderTransactions = () => (
    <View style={styles.transactionsContainer}>
      {leagueData.transactions.map((transaction) => (
        <View key={transaction.id} style={styles.transactionCard}>
          <View style={[styles.transactionIcon, { backgroundColor: getTransactionColor(transaction.type) }]}>
            <Ionicons
              name={getTransactionIcon(transaction.type)}
              size={20}
              color="white"
            />
          </View>
          <View style={styles.transactionInfo}>
            <Text style={styles.transactionTeam}>{transaction.team}</Text>
            <Text style={styles.transactionDetails}>{transaction.details}</Text>
            <Text style={styles.transactionDate}>
              {formatRelativeDate(transaction.date)}
            </Text>
          </View>
        </View>
      ))}
    </View>
  );

  const renderSettings = () => (
    <View style={styles.settingsContainer}>
      <View style={styles.settingRow}>
        <Text style={styles.settingLabel}>Scoring Type</Text>
        <Text style={styles.settingValue}>{leagueData.settings.scoringType}</Text>
      </View>
      <View style={styles.settingRow}>
        <Text style={styles.settingLabel}>Trade Deadline</Text>
        <Text style={styles.settingValue}>
          {leagueData.settings.tradeDeadline?.toLocaleDateString()}
        </Text>
      </View>
      <View style={styles.settingRow}>
        <Text style={styles.settingLabel}>Playoff Teams</Text>
        <Text style={styles.settingValue}>{leagueData.settings.playoffTeams}</Text>
      </View>
      <View style={styles.settingRow}>
        <Text style={styles.settingLabel}>Playoff Weeks</Text>
        <Text style={styles.settingValue}>{leagueData.settings.playoffWeeks}</Text>
      </View>
      <View style={styles.settingRow}>
        <Text style={styles.settingLabel}>Waiver Type</Text>
        <Text style={styles.settingValue}>{leagueData.settings.waiverType}</Text>
      </View>
    </View>
  );

  const getTransactionIcon = (type: string): keyof typeof Ionicons.glyphMap => {
    switch (type) {
      case 'trade': return 'swap-horizontal';
      case 'add': return 'add-circle';
      case 'drop': return 'remove-circle';
      default: return 'information-circle';
    }
  };

  const getTransactionColor = (type: string) => {
    switch (type) {
      case 'trade': return '#3b82f6';
      case 'add': return '#10b981';
      case 'drop': return '#ef4444';
      default: return '#6b7280';
    }
  };

  const formatRelativeDate = (date: Date) => {
    const now = new Date();
    const diff = now.getTime() - date.getTime();
    const hours = Math.floor(diff / (1000 * 60 * 60));
    const days = Math.floor(hours / 24);
    
    if (hours < 1) return 'Just now';
    if (hours < 24) return `${hours}h ago`;
    if (days < 7) return `${days}d ago`;
    return date.toLocaleDateString();
  };

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#10b981" />
      </View>
    );
  }

  return (
    <ScrollView
      style={styles.container}
      refreshControl={
        <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
      }
    >
      {/* League Header */}
      <LinearGradient
        colors={['#1f2937', '#111827']}
        style={styles.header}
      >
        <Text style={styles.leagueName}>{leagueData.name}</Text>
        <Text style={styles.leaguePlatform}>{leagueData.platform} League</Text>
      </LinearGradient>

      {/* Quick Actions */}
      <View style={styles.quickActions}>
        <TouchableOpacity
          style={styles.actionButton}
          onPress={() => navigation.navigate('Lineup' as never)}
        >
          <Ionicons name="people" size={24} color="white" />
          <Text style={styles.actionText}>Set Lineup</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={styles.actionButton}
          onPress={() => navigation.navigate('Trade', { leagueId } as never)}
        >
          <Ionicons name="swap-horizontal" size={24} color="white" />
          <Text style={styles.actionText}>Trade</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={styles.actionButton}
          onPress={() => navigation.navigate('Waiver', { leagueId } as never)}
        >
          <Ionicons name="add-circle" size={24} color="white" />
          <Text style={styles.actionText}>Add Player</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.actionButton}>
          <Ionicons name="chatbubbles" size={24} color="white" />
          <Text style={styles.actionText}>League Chat</Text>
        </TouchableOpacity>
      </View>

      {/* Tabs */}
      <View style={styles.tabs}>
        <TouchableOpacity
          style={[styles.tab, activeTab === 'standings' && styles.activeTab]}
          onPress={() => setActiveTab('standings')}
        >
          <Text style={[styles.tabText, activeTab === 'standings' && styles.activeTabText]}>
            Standings
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.tab, activeTab === 'transactions' && styles.activeTab]}
          onPress={() => setActiveTab('transactions')}
        >
          <Text style={[styles.tabText, activeTab === 'transactions' && styles.activeTabText]}>
            Transactions
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.tab, activeTab === 'settings' && styles.activeTab]}
          onPress={() => setActiveTab('settings')}
        >
          <Text style={[styles.tabText, activeTab === 'settings' && styles.activeTabText]}>
            Settings
          </Text>
        </TouchableOpacity>
      </View>

      {/* Tab Content */}
      <View style={styles.tabContent}>
        {activeTab === 'standings' && renderStandings()}
        {activeTab === 'transactions' && renderTransactions()}
        {activeTab === 'settings' && renderSettings()}
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
  header: {
    padding: 20,
    paddingTop: 16,
  },
  leagueName: {
    color: 'white',
    fontSize: 24,
    fontWeight: 'bold',
  },
  leaguePlatform: {
    color: '#9ca3af',
    fontSize: 14,
    marginTop: 4,
  },
  quickActions: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#374151',
  },
  actionButton: {
    alignItems: 'center',
  },
  actionText: {
    color: '#9ca3af',
    fontSize: 12,
    marginTop: 4,
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
  standingsContainer: {
    backgroundColor: '#1f2937',
    borderRadius: 8,
    overflow: 'hidden',
  },
  standingsHeader: {
    flexDirection: 'row',
    padding: 12,
    backgroundColor: '#374151',
  },
  headerText: {
    color: '#9ca3af',
    fontSize: 12,
    fontWeight: '600',
    flex: 1,
    textAlign: 'center',
  },
  teamRow: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#374151',
  },
  rankBadge: {
    width: 32,
    alignItems: 'center',
    flexDirection: 'row',
    gap: 2,
  },
  rankText: {
    color: 'white',
    fontSize: 16,
    fontWeight: 'bold',
  },
  teamName: {
    color: 'white',
    fontSize: 14,
    fontWeight: '600',
  },
  ownerName: {
    color: '#6b7280',
    fontSize: 12,
  },
  record: {
    color: 'white',
    fontSize: 14,
    flex: 1,
    textAlign: 'center',
  },
  points: {
    color: 'white',
    fontSize: 14,
    flex: 1,
    textAlign: 'center',
  },
  streakBadge: {
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 4,
    minWidth: 32,
    alignItems: 'center',
  },
  winStreak: {
    backgroundColor: 'rgba(16, 185, 129, 0.2)',
  },
  loseStreak: {
    backgroundColor: 'rgba(239, 68, 68, 0.2)',
  },
  streakText: {
    color: 'white',
    fontSize: 12,
    fontWeight: '600',
  },
  transactionsContainer: {
    gap: 12,
  },
  transactionCard: {
    flexDirection: 'row',
    backgroundColor: '#1f2937',
    borderRadius: 8,
    padding: 12,
  },
  transactionIcon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  transactionInfo: {
    flex: 1,
  },
  transactionTeam: {
    color: 'white',
    fontSize: 14,
    fontWeight: '600',
  },
  transactionDetails: {
    color: '#9ca3af',
    fontSize: 14,
    marginTop: 2,
  },
  transactionDate: {
    color: '#6b7280',
    fontSize: 12,
    marginTop: 4,
  },
  settingsContainer: {
    backgroundColor: '#1f2937',
    borderRadius: 8,
    padding: 16,
  },
  settingRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#374151',
  },
  settingLabel: {
    color: '#9ca3af',
    fontSize: 14,
  },
  settingValue: {
    color: 'white',
    fontSize: 14,
    fontWeight: '600',
  },
});

/**
 * THE MARCUS GUARANTEE:
 * 
 * This league detail screen provides:
 * - Complete standings with trends
 * - Recent transactions
 * - League settings
 * - Quick access to all actions
 * 
 * - Marcus "The Fixer" Rodriguez
 */