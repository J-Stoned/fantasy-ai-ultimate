import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  RefreshControl,
  ScrollView,
  Modal,
} from 'react-native';
import { Picker } from '@react-native-picker/picker';
import { formatDistanceToNow } from 'date-fns';
import { useAuth } from '@/lib/hooks/useAuth';

interface Contest {
  id: string;
  name: string;
  type: string;
  sport: string;
  entryFee: number;
  guaranteedPrizePool: number;
  maxEntries: number;
  currentEntries: number;
  startTime: Date;
  status: string;
}

export function ContestsScreen({ navigation }: any) {
  const { user } = useAuth();
  const [contests, setContests] = useState<Contest[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [selectedSport, setSelectedSport] = useState('all');
  const [selectedType, setSelectedType] = useState('all');
  const [selectedContest, setSelectedContest] = useState<Contest | null>(null);

  useEffect(() => {
    loadContests();
  }, [selectedSport, selectedType]);

  const loadContests = async () => {
    try {
      // Mock contest data
      const mockContests: Contest[] = [
        {
          id: '1',
          name: 'NFL Sunday Million',
          type: 'gpp',
          sport: 'nfl',
          entryFee: 25,
          guaranteedPrizePool: 1000000,
          maxEntries: 100000,
          currentEntries: 67432,
          startTime: new Date(Date.now() + 2 * 24 * 60 * 60 * 1000),
          status: 'upcoming',
        },
        {
          id: '2',
          name: 'NBA Fast Break',
          type: 'gpp',
          sport: 'nba',
          entryFee: 5,
          guaranteedPrizePool: 25000,
          maxEntries: 10000,
          currentEntries: 4521,
          startTime: new Date(Date.now() + 4 * 60 * 60 * 1000),
          status: 'upcoming',
        },
        {
          id: '3',
          name: 'NFL 50/50',
          type: 'cash',
          sport: 'nfl',
          entryFee: 20,
          guaranteedPrizePool: 0,
          maxEntries: 1000,
          currentEntries: 743,
          startTime: new Date(Date.now() + 3 * 24 * 60 * 60 * 1000),
          status: 'upcoming',
        },
      ];

      let filtered = mockContests;
      if (selectedSport !== 'all') {
        filtered = filtered.filter(c => c.sport === selectedSport);
      }
      if (selectedType !== 'all') {
        filtered = filtered.filter(c => c.type === selectedType);
      }

      setContests(filtered);
    } catch (error) {
      console.error('Failed to load contests:', error);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const onRefresh = () => {
    setRefreshing(true);
    loadContests();
  };

  const formatPrize = (amount: number): string => {
    if (amount >= 1000000) {
      return `$${(amount / 1000000).toFixed(1)}M`;
    } else if (amount >= 1000) {
      return `$${(amount / 1000).toFixed(0)}K`;
    }
    return `$${amount}`;
  };

  const getContestTypeLabel = (type: string): string => {
    const labels: Record<string, string> = {
      gpp: 'Tournament',
      cash: 'Cash Game',
      h2h: 'Head-to-Head',
      satellite: 'Satellite',
    };
    return labels[type] || type.toUpperCase();
  };

  const getSportIcon = (sport: string): string => {
    const icons: Record<string, string> = {
      nfl: '🏈',
      nba: '🏀',
      mlb: '⚾',
      nhl: '🏒',
    };
    return icons[sport] || '🏆';
  };

  const renderContest = ({ item }: { item: Contest }) => (
    <TouchableOpacity
      style={styles.contestCard}
      onPress={() => setSelectedContest(item)}
    >
      <View style={styles.contestHeader}>
        <View style={styles.contestInfo}>
          <Text style={styles.sportIcon}>{getSportIcon(item.sport)}</Text>
          <View>
            <Text style={styles.contestName}>{item.name}</Text>
            <Text style={styles.contestMeta}>
              {getContestTypeLabel(item.type)} • {item.sport.toUpperCase()}
            </Text>
          </View>
        </View>
        <View style={styles.prizeInfo}>
          <Text style={styles.prizeAmount}>
            {item.guaranteedPrizePool > 0 
              ? formatPrize(item.guaranteedPrizePool)
              : `$${item.entryFee * 2}`}
          </Text>
          <Text style={styles.prizeLabel}>
            {item.guaranteedPrizePool > 0 ? 'Guaranteed' : 'Prize'}
          </Text>
        </View>
      </View>

      <View style={styles.contestDetails}>
        <View style={styles.detailItem}>
          <Text style={styles.detailLabel}>Entry</Text>
          <Text style={styles.detailValue}>${item.entryFee}</Text>
        </View>
        <View style={styles.detailItem}>
          <Text style={styles.detailLabel}>Entries</Text>
          <Text style={styles.detailValue}>
            {item.currentEntries.toLocaleString()}/{item.maxEntries.toLocaleString()}
          </Text>
        </View>
        <View style={styles.detailItem}>
          <Text style={styles.detailLabel}>Starts</Text>
          <Text style={styles.detailValue}>
            {formatDistanceToNow(item.startTime, { addSuffix: true })}
          </Text>
        </View>
      </View>

      <View style={styles.progressBar}>
        <View
          style={[
            styles.progressFill,
            { width: `${(item.currentEntries / item.maxEntries) * 100}%` },
          ]}
        />
      </View>

      <TouchableOpacity
        style={styles.enterButton}
        onPress={(e) => {
          e.stopPropagation();
          navigation.navigate('LineupBuilder', { contestId: item.id });
        }}
      >
        <Text style={styles.enterButtonText}>Enter Contest</Text>
      </TouchableOpacity>
    </TouchableOpacity>
  );

  return (
    <View style={styles.container}>
      {/* Filters */}
      <View style={styles.filterContainer}>
        <View style={styles.filterItem}>
          <Text style={styles.filterLabel}>Sport</Text>
          <Picker
            selectedValue={selectedSport}
            onValueChange={setSelectedSport}
            style={styles.picker}
          >
            <Picker.Item label="All Sports" value="all" />
            <Picker.Item label="NFL" value="nfl" />
            <Picker.Item label="NBA" value="nba" />
            <Picker.Item label="MLB" value="mlb" />
            <Picker.Item label="NHL" value="nhl" />
          </Picker>
        </View>
        
        <View style={styles.filterItem}>
          <Text style={styles.filterLabel}>Type</Text>
          <Picker
            selectedValue={selectedType}
            onValueChange={setSelectedType}
            style={styles.picker}
          >
            <Picker.Item label="All Types" value="all" />
            <Picker.Item label="Tournament" value="gpp" />
            <Picker.Item label="Cash Game" value="cash" />
            <Picker.Item label="H2H" value="h2h" />
          </Picker>
        </View>
      </View>

      {/* Contest List */}
      <FlatList
        data={contests}
        renderItem={renderContest}
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.listContent}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
        }
        ListEmptyComponent={
          <View style={styles.emptyState}>
            <Text style={styles.emptyText}>No contests available</Text>
          </View>
        }
      />

      {/* Contest Detail Modal */}
      <Modal
        visible={!!selectedContest}
        animationType="slide"
        transparent
        onRequestClose={() => setSelectedContest(null)}
      >
        {selectedContest && (
          <View style={styles.modalContainer}>
            <View style={styles.modalContent}>
              <ScrollView>
                <View style={styles.modalHeader}>
                  <Text style={styles.modalTitle}>{selectedContest.name}</Text>
                  <TouchableOpacity
                    onPress={() => setSelectedContest(null)}
                    style={styles.closeButton}
                  >
                    <Text style={styles.closeButtonText}>✕</Text>
                  </TouchableOpacity>
                </View>

                <View style={styles.modalSection}>
                  <Text style={styles.sectionTitle}>Prize Pool</Text>
                  <Text style={styles.bigNumber}>
                    {formatPrize(selectedContest.guaranteedPrizePool || selectedContest.entryFee * 2)}
                  </Text>
                </View>

                <View style={styles.modalSection}>
                  <Text style={styles.sectionTitle}>Payout Structure</Text>
                  <View style={styles.payoutRow}>
                    <Text style={styles.payoutPlace}>1st Place</Text>
                    <Text style={styles.payoutAmount}>
                      {formatPrize(selectedContest.guaranteedPrizePool * 0.2)}
                    </Text>
                  </View>
                  <View style={styles.payoutRow}>
                    <Text style={styles.payoutPlace}>2nd Place</Text>
                    <Text style={styles.payoutAmount}>
                      {formatPrize(selectedContest.guaranteedPrizePool * 0.12)}
                    </Text>
                  </View>
                  <View style={styles.payoutRow}>
                    <Text style={styles.payoutPlace}>3rd Place</Text>
                    <Text style={styles.payoutAmount}>
                      {formatPrize(selectedContest.guaranteedPrizePool * 0.08)}
                    </Text>
                  </View>
                  <View style={styles.payoutRow}>
                    <Text style={styles.payoutPlace}>Top 20%</Text>
                    <Text style={styles.payoutAmount}>Cash</Text>
                  </View>
                </View>

                <View style={styles.modalSection}>
                  <Text style={styles.sectionTitle}>Contest Rules</Text>
                  <Text style={styles.ruleText}>• Lineups lock at first game start</Text>
                  <Text style={styles.ruleText}>• Late swap available</Text>
                  <Text style={styles.ruleText}>• PPR scoring</Text>
                  <Text style={styles.ruleText}>• $50,000 salary cap</Text>
                </View>

                <TouchableOpacity
                  style={styles.modalEnterButton}
                  onPress={() => {
                    setSelectedContest(null);
                    navigation.navigate('LineupBuilder', { contestId: selectedContest.id });
                  }}
                >
                  <Text style={styles.modalEnterButtonText}>Enter Contest</Text>
                </TouchableOpacity>
              </ScrollView>
            </View>
          </View>
        )}
      </Modal>

      {/* Floating Action Button */}
      <TouchableOpacity
        style={styles.fab}
        onPress={() => navigation.navigate('MyContests')}
      >
        <Text style={styles.fabText}>📋</Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f5f5f5',
  },
  filterContainer: {
    flexDirection: 'row',
    backgroundColor: '#fff',
    paddingHorizontal: 15,
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#e0e0e0',
  },
  filterItem: {
    flex: 1,
    marginHorizontal: 5,
  },
  filterLabel: {
    fontSize: 12,
    color: '#666',
    marginBottom: 5,
  },
  picker: {
    height: 40,
    backgroundColor: '#f8f8f8',
  },
  listContent: {
    padding: 15,
  },
  contestCard: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 15,
    marginBottom: 15,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  contestHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 15,
  },
  contestInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  sportIcon: {
    fontSize: 28,
    marginRight: 10,
  },
  contestName: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#333',
  },
  contestMeta: {
    fontSize: 12,
    color: '#666',
    marginTop: 2,
  },
  prizeInfo: {
    alignItems: 'flex-end',
  },
  prizeAmount: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#22c55e',
  },
  prizeLabel: {
    fontSize: 12,
    color: '#666',
  },
  contestDetails: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 10,
  },
  detailItem: {
    alignItems: 'center',
  },
  detailLabel: {
    fontSize: 12,
    color: '#666',
    marginBottom: 2,
  },
  detailValue: {
    fontSize: 14,
    fontWeight: '600',
    color: '#333',
  },
  progressBar: {
    height: 6,
    backgroundColor: '#e0e0e0',
    borderRadius: 3,
    marginBottom: 10,
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    backgroundColor: '#3b82f6',
    borderRadius: 3,
  },
  enterButton: {
    backgroundColor: '#3b82f6',
    paddingVertical: 12,
    borderRadius: 8,
    alignItems: 'center',
  },
  enterButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: 'bold',
  },
  emptyState: {
    padding: 50,
    alignItems: 'center',
  },
  emptyText: {
    fontSize: 16,
    color: '#666',
  },
  modalContainer: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'flex-end',
  },
  modalContent: {
    backgroundColor: '#fff',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    maxHeight: '80%',
    paddingBottom: 20,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 20,
    borderBottomWidth: 1,
    borderBottomColor: '#e0e0e0',
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#333',
  },
  closeButton: {
    padding: 5,
  },
  closeButtonText: {
    fontSize: 24,
    color: '#666',
  },
  modalSection: {
    padding: 20,
    borderBottomWidth: 1,
    borderBottomColor: '#e0e0e0',
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
    marginBottom: 10,
  },
  bigNumber: {
    fontSize: 32,
    fontWeight: 'bold',
    color: '#22c55e',
  },
  payoutRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 8,
  },
  payoutPlace: {
    fontSize: 14,
    color: '#666',
  },
  payoutAmount: {
    fontSize: 14,
    fontWeight: '600',
    color: '#333',
  },
  ruleText: {
    fontSize: 14,
    color: '#666',
    marginBottom: 5,
  },
  modalEnterButton: {
    margin: 20,
    backgroundColor: '#3b82f6',
    paddingVertical: 15,
    borderRadius: 10,
    alignItems: 'center',
  },
  modalEnterButtonText: {
    color: '#fff',
    fontSize: 18,
    fontWeight: 'bold',
  },
  fab: {
    position: 'absolute',
    bottom: 20,
    right: 20,
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: '#3b82f6',
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 4,
    elevation: 5,
  },
  fabText: {
    fontSize: 24,
  },
});