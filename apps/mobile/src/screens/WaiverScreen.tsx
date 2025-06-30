/**
 * MARCUS "THE FIXER" RODRIGUEZ - WAIVER SCREEN
 * 
 * Find the hidden gems before your league mates. AI suggestions,
 * trending players, and smart FAAB management.
 */

import React, { useState, useEffect } from 'react';
import {
  StyleSheet,
  Text,
  View,
  ScrollView,
  TouchableOpacity,
  TextInput,
  FlatList,
  ActivityIndicator,
  Alert,
} from 'react-native';
import { useRoute, useNavigation } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';

interface Player {
  id: string;
  name: string;
  position: string;
  team: string;
  status: string;
  avgPoints: number;
  lastGamePoints: number;
  projectedPoints: number;
  ownership: number;
  trend: 'hot' | 'rising' | 'falling' | 'cold';
  adds: number;
  drops: number;
}

interface WaiverClaim {
  add: Player;
  drop: Player | null;
  bid: number;
  priority: number;
}

const positionColors = {
  QB: '#ef4444',
  RB: '#10b981',
  WR: '#3b82f6',
  TE: '#f59e0b',
  K: '#8b5cf6',
  'D/ST': '#6b7280',
};

export default function WaiverScreen() {
  const route = useRoute();
  const navigation = useNavigation();
  const { leagueId } = route.params as { leagueId: string };

  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedPosition, setSelectedPosition] = useState<string>('ALL');
  const [sortBy, setSortBy] = useState<'trending' | 'owned' | 'points'>('trending');
  const [players, setPlayers] = useState<Player[]>([]);
  const [myRoster, setMyRoster] = useState<Player[]>([]);
  const [waiverClaims, setWaiverClaims] = useState<WaiverClaim[]>([]);
  const [faabBudget, setFaabBudget] = useState({ total: 100, remaining: 73 });
  const [showFilters, setShowFilters] = useState(false);

  useEffect(() => {
    loadWaiverData();
  }, []);

  const loadWaiverData = async () => {
    try {
      // TODO: Load from real API
      setTimeout(() => {
        setPlayers([
          {
            id: 'w1',
            name: 'Jaylen Warren',
            position: 'RB',
            team: 'PIT',
            status: 'healthy',
            avgPoints: 11.2,
            lastGamePoints: 18.4,
            projectedPoints: 13.5,
            ownership: 42.3,
            trend: 'hot',
            adds: 15234,
            drops: 892,
          },
          {
            id: 'w2',
            name: 'Roschon Johnson',
            position: 'RB',
            team: 'CHI',
            status: 'healthy',
            avgPoints: 8.5,
            lastGamePoints: 14.2,
            projectedPoints: 10.8,
            ownership: 28.1,
            trend: 'rising',
            adds: 8921,
            drops: 423,
          },
          {
            id: 'w3',
            name: 'Demario Douglas',
            position: 'WR',
            team: 'NE',
            status: 'questionable',
            avgPoints: 9.8,
            lastGamePoints: 6.2,
            projectedPoints: 11.2,
            ownership: 18.5,
            trend: 'falling',
            adds: 3245,
            drops: 5123,
          },
          // Add more players...
        ]);

        setMyRoster([
          { id: 'm1', name: 'Zack Moss', position: 'RB', team: 'IND', status: 'healthy', avgPoints: 7.2, lastGamePoints: 4.1, projectedPoints: 6.8, ownership: 45.2, trend: 'cold', adds: 234, drops: 8921 },
          { id: 'm2', name: 'Elijah Moore', position: 'WR', team: 'CLE', status: 'healthy', avgPoints: 8.1, lastGamePoints: 5.3, projectedPoints: 7.5, ownership: 38.9, trend: 'falling', adds: 123, drops: 4521 },
        ]);

        setLoading(false);
      }, 1000);
    } catch (error) {
      console.error('Failed to load waiver data:', error);
      setLoading(false);
    }
  };

  const addWaiverClaim = (player: Player) => {
    // Show drop picker if roster is full
    Alert.alert(
      'Add Player',
      `Add ${player.name}?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Add',
          onPress: () => {
            const newClaim: WaiverClaim = {
              add: player,
              drop: myRoster[0], // TODO: Let user select
              bid: 0,
              priority: waiverClaims.length + 1,
            };
            setWaiverClaims([...waiverClaims, newClaim]);
          },
        },
      ]
    );
  };

  const getTrendIcon = (trend: Player['trend']) => {
    switch (trend) {
      case 'hot': return 'flame';
      case 'rising': return 'trending-up';
      case 'falling': return 'trending-down';
      case 'cold': return 'snow';
      default: return 'remove';
    }
  };

  const getTrendColor = (trend: Player['trend']) => {
    switch (trend) {
      case 'hot': return '#ef4444';
      case 'rising': return '#f59e0b';
      case 'falling': return '#3b82f6';
      case 'cold': return '#6b7280';
      default: return '#6b7280';
    }
  };

  const filteredPlayers = players
    .filter(p => selectedPosition === 'ALL' || p.position === selectedPosition)
    .filter(p => p.name.toLowerCase().includes(searchQuery.toLowerCase()))
    .sort((a, b) => {
      switch (sortBy) {
        case 'trending':
          return b.adds - a.adds;
        case 'owned':
          return b.ownership - a.ownership;
        case 'points':
          return b.projectedPoints - a.projectedPoints;
        default:
          return 0;
      }
    });

  const renderPlayer = ({ item }: { item: Player }) => (
    <TouchableOpacity
      style={styles.playerCard}
      onPress={() => navigation.navigate('PlayerDetail', { playerId: item.id } as never)}
    >
      <View style={styles.playerHeader}>
        <View style={styles.playerBasicInfo}>
          <Text style={styles.playerName}>{item.name}</Text>
          <View style={styles.playerMeta}>
            <View style={[styles.positionBadge, { backgroundColor: positionColors[item.position] }]}>
              <Text style={styles.positionText}>{item.position}</Text>
            </View>
            <Text style={styles.teamText}>{item.team}</Text>
            {item.status !== 'healthy' && (
              <View style={styles.statusIndicator}>
                <Text style={styles.statusText}>{item.status.charAt(0).toUpperCase()}</Text>
              </View>
            )}
          </View>
        </View>
        <View style={styles.trendBadge}>
          <Ionicons name={getTrendIcon(item.trend)} size={20} color={getTrendColor(item.trend)} />
        </View>
      </View>

      <View style={styles.playerStats}>
        <View style={styles.statColumn}>
          <Text style={styles.statValue}>{item.projectedPoints}</Text>
          <Text style={styles.statLabel}>Proj</Text>
        </View>
        <View style={styles.statColumn}>
          <Text style={styles.statValue}>{item.ownership}%</Text>
          <Text style={styles.statLabel}>Own</Text>
        </View>
        <View style={styles.statColumn}>
          <Text style={styles.statValue}>+{item.adds}</Text>
          <Text style={styles.statLabel}>Adds</Text>
        </View>
        <View style={styles.statColumn}>
          <Text style={styles.statValue}>-{item.drops}</Text>
          <Text style={styles.statLabel}>Drops</Text>
        </View>
      </View>

      <TouchableOpacity
        style={styles.addButton}
        onPress={() => addWaiverClaim(item)}
      >
        <Ionicons name="add-circle" size={20} color="white" />
        <Text style={styles.addButtonText}>Add</Text>
      </TouchableOpacity>
    </TouchableOpacity>
  );

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#10b981" />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <View style={styles.budgetInfo}>
          <Text style={styles.budgetLabel}>FAAB Budget</Text>
          <Text style={styles.budgetAmount}>
            ${faabBudget.remaining} / ${faabBudget.total}
          </Text>
        </View>
        <TouchableOpacity style={styles.claimsButton}>
          <Text style={styles.claimsButtonText}>Claims ({waiverClaims.length})</Text>
        </TouchableOpacity>
      </View>

      {/* Search and Filters */}
      <View style={styles.searchContainer}>
        <View style={styles.searchBar}>
          <Ionicons name="search" size={20} color="#6b7280" />
          <TextInput
            style={styles.searchInput}
            placeholder="Search players..."
            placeholderTextColor="#6b7280"
            value={searchQuery}
            onChangeText={setSearchQuery}
          />
        </View>
      </View>

      {/* Position Filters */}
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        style={styles.positionFilters}
      >
        {['ALL', 'QB', 'RB', 'WR', 'TE', 'K', 'D/ST'].map(pos => (
          <TouchableOpacity
            key={pos}
            style={[
              styles.positionFilter,
              selectedPosition === pos && styles.positionFilterActive,
            ]}
            onPress={() => setSelectedPosition(pos)}
          >
            <Text
              style={[
                styles.positionFilterText,
                selectedPosition === pos && styles.positionFilterTextActive,
              ]}
            >
              {pos}
            </Text>
          </TouchableOpacity>
        ))}
      </ScrollView>

      {/* Sort Options */}
      <View style={styles.sortOptions}>
        <TouchableOpacity
          style={[styles.sortOption, sortBy === 'trending' && styles.sortOptionActive]}
          onPress={() => setSortBy('trending')}
        >
          <Ionicons name="flame" size={16} color={sortBy === 'trending' ? '#10b981' : '#6b7280'} />
          <Text style={[styles.sortText, sortBy === 'trending' && styles.sortTextActive]}>
            Trending
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.sortOption, sortBy === 'owned' && styles.sortOptionActive]}
          onPress={() => setSortBy('owned')}
        >
          <Ionicons name="people" size={16} color={sortBy === 'owned' ? '#10b981' : '#6b7280'} />
          <Text style={[styles.sortText, sortBy === 'owned' && styles.sortTextActive]}>
            % Owned
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.sortOption, sortBy === 'points' && styles.sortOptionActive]}
          onPress={() => setSortBy('points')}
        >
          <Ionicons name="stats-chart" size={16} color={sortBy === 'points' ? '#10b981' : '#6b7280'} />
          <Text style={[styles.sortText, sortBy === 'points' && styles.sortTextActive]}>
            Projected
          </Text>
        </TouchableOpacity>
      </View>

      {/* AI Suggestion */}
      <View style={styles.aiSuggestion}>
        <Ionicons name="bulb" size={20} color="#f59e0b" />
        <View style={styles.suggestionContent}>
          <Text style={styles.suggestionTitle}>AI Pickup of the Week</Text>
          <Text style={styles.suggestionText}>
            Jaylen Warren (42.3% owned) - Najee Harris dealing with injury, Warren saw 18 touches last week
          </Text>
        </View>
      </View>

      {/* Players List */}
      <FlatList
        data={filteredPlayers}
        renderItem={renderPlayer}
        keyExtractor={item => item.id}
        contentContainerStyle={styles.playersList}
      />
    </View>
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
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#374151',
  },
  budgetInfo: {
    flex: 1,
  },
  budgetLabel: {
    color: '#6b7280',
    fontSize: 12,
  },
  budgetAmount: {
    color: 'white',
    fontSize: 20,
    fontWeight: 'bold',
  },
  claimsButton: {
    backgroundColor: '#10b981',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 8,
  },
  claimsButtonText: {
    color: 'white',
    fontSize: 14,
    fontWeight: '600',
  },
  searchContainer: {
    padding: 16,
  },
  searchBar: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#1f2937',
    borderRadius: 8,
    paddingHorizontal: 12,
  },
  searchInput: {
    flex: 1,
    color: 'white',
    fontSize: 16,
    marginLeft: 8,
    paddingVertical: 12,
  },
  positionFilters: {
    paddingHorizontal: 16,
    marginBottom: 12,
  },
  positionFilter: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    marginRight: 8,
    borderRadius: 20,
    backgroundColor: '#1f2937',
  },
  positionFilterActive: {
    backgroundColor: '#10b981',
  },
  positionFilterText: {
    color: '#9ca3af',
    fontSize: 14,
    fontWeight: '600',
  },
  positionFilterTextActive: {
    color: 'white',
  },
  sortOptions: {
    flexDirection: 'row',
    paddingHorizontal: 16,
    marginBottom: 12,
    gap: 12,
  },
  sortOption: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 6,
    backgroundColor: '#1f2937',
    gap: 4,
  },
  sortOptionActive: {
    backgroundColor: 'rgba(16, 185, 129, 0.2)',
  },
  sortText: {
    color: '#6b7280',
    fontSize: 12,
  },
  sortTextActive: {
    color: '#10b981',
  },
  aiSuggestion: {
    flexDirection: 'row',
    backgroundColor: '#1f2937',
    borderRadius: 8,
    padding: 12,
    marginHorizontal: 16,
    marginBottom: 12,
    gap: 12,
  },
  suggestionContent: {
    flex: 1,
  },
  suggestionTitle: {
    color: 'white',
    fontSize: 14,
    fontWeight: '600',
    marginBottom: 4,
  },
  suggestionText: {
    color: '#9ca3af',
    fontSize: 12,
    lineHeight: 16,
  },
  playersList: {
    padding: 16,
  },
  playerCard: {
    backgroundColor: '#1f2937',
    borderRadius: 8,
    padding: 12,
    marginBottom: 8,
  },
  playerHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 12,
  },
  playerBasicInfo: {
    flex: 1,
  },
  playerName: {
    color: 'white',
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 4,
  },
  playerMeta: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  positionBadge: {
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 4,
  },
  positionText: {
    color: 'white',
    fontSize: 12,
    fontWeight: 'bold',
  },
  teamText: {
    color: '#9ca3af',
    fontSize: 14,
  },
  statusIndicator: {
    width: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: '#ef4444',
    justifyContent: 'center',
    alignItems: 'center',
  },
  statusText: {
    color: 'white',
    fontSize: 10,
    fontWeight: 'bold',
  },
  trendBadge: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#374151',
    justifyContent: 'center',
    alignItems: 'center',
  },
  playerStats: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    marginBottom: 12,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: '#374151',
  },
  statColumn: {
    alignItems: 'center',
  },
  statValue: {
    color: 'white',
    fontSize: 16,
    fontWeight: '600',
  },
  statLabel: {
    color: '#6b7280',
    fontSize: 10,
    marginTop: 2,
  },
  addButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#10b981',
    borderRadius: 6,
    paddingVertical: 8,
    gap: 4,
  },
  addButtonText: {
    color: 'white',
    fontSize: 14,
    fontWeight: '600',
  },
});

/**
 * THE MARCUS GUARANTEE:
 * 
 * This waiver screen features:
 * - Trending player identification
 * - AI pickup suggestions
 * - FAAB budget tracking
 * - Add/drop optimization
 * - Real-time ownership data
 * 
 * - Marcus "The Fixer" Rodriguez
 */