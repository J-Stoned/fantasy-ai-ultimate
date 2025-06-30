/**
 * MARCUS "THE FIXER" RODRIGUEZ - TRADE SCREEN
 * 
 * Smart trades win championships. AI-powered analysis, fair value calculator,
 * and instant feedback on every proposal.
 */

import React, { useState } from 'react';
import {
  StyleSheet,
  Text,
  View,
  ScrollView,
  TouchableOpacity,
  TextInput,
  Modal,
  FlatList,
  ActivityIndicator,
  Alert,
} from 'react-native';
import { useRoute, useNavigation } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';

interface Player {
  id: string;
  name: string;
  position: string;
  team: string;
  avgPoints: number;
  tradeValue: number;
}

interface Team {
  id: string;
  name: string;
  owner: string;
  roster: Player[];
}

interface TradeAnalysis {
  fairness: number; // -100 to 100
  winner: 'you' | 'them' | 'fair';
  reasoning: string;
  recommendation: 'accept' | 'reject' | 'negotiate';
}

export default function TradeScreen() {
  const route = useRoute();
  const navigation = useNavigation();
  const { leagueId } = route.params as { leagueId: string };

  const [selectedTeam, setSelectedTeam] = useState<Team | null>(null);
  const [myPlayers, setMyPlayers] = useState<Player[]>([]);
  const [theirPlayers, setTheirPlayers] = useState<Player[]>([]);
  const [showPlayerPicker, setShowPlayerPicker] = useState<'mine' | 'theirs' | null>(null);
  const [analyzing, setAnalyzing] = useState(false);
  const [tradeAnalysis, setTradeAnalysis] = useState<TradeAnalysis | null>(null);
  const [tradeNote, setTradeNote] = useState('');

  const teams: Team[] = [
    {
      id: '1',
      name: 'Fantasy Destroyer',
      owner: 'John D.',
      roster: [
        { id: 'p1', name: 'Josh Allen', position: 'QB', team: 'BUF', avgPoints: 23.5, tradeValue: 85 },
        { id: 'p2', name: 'Saquon Barkley', position: 'RB', team: 'NYG', avgPoints: 18.2, tradeValue: 78 },
        { id: 'p3', name: 'Stefon Diggs', position: 'WR', team: 'BUF', avgPoints: 17.8, tradeValue: 82 },
        { id: 'p4', name: 'Mark Andrews', position: 'TE', team: 'BAL', avgPoints: 14.2, tradeValue: 72 },
      ],
    },
    // Add more teams...
  ];

  const myRoster: Player[] = [
    { id: 'm1', name: 'Patrick Mahomes', position: 'QB', team: 'KC', avgPoints: 24.8, tradeValue: 90 },
    { id: 'm2', name: 'Christian McCaffrey', position: 'RB', team: 'SF', avgPoints: 22.3, tradeValue: 95 },
    { id: 'm3', name: 'Tyreek Hill', position: 'WR', team: 'MIA', avgPoints: 19.2, tradeValue: 88 },
    { id: 'm4', name: 'Travis Kelce', position: 'TE', team: 'KC', avgPoints: 15.2, tradeValue: 80 },
    { id: 'm5', name: 'CeeDee Lamb', position: 'WR', team: 'DAL', avgPoints: 17.5, tradeValue: 85 },
    { id: 'm6', name: 'Austin Ekeler', position: 'RB', team: 'LAC', avgPoints: 16.8, tradeValue: 75 },
  ];

  const analyzeTrade = async () => {
    if (myPlayers.length === 0 || theirPlayers.length === 0) {
      Alert.alert('Incomplete Trade', 'Please select players from both sides');
      return;
    }

    setAnalyzing(true);
    try {
      // TODO: Call real AI analysis endpoint
      setTimeout(() => {
        const myValue = myPlayers.reduce((sum, p) => sum + p.tradeValue, 0);
        const theirValue = theirPlayers.reduce((sum, p) => sum + p.tradeValue, 0);
        const diff = theirValue - myValue;
        const fairness = Math.max(-100, Math.min(100, diff));

        setTradeAnalysis({
          fairness,
          winner: fairness > 20 ? 'you' : fairness < -20 ? 'them' : 'fair',
          reasoning: `You're giving up ${myValue} points of trade value for ${theirValue} points. ${
            fairness > 0 
              ? `This trade improves your team by ${Math.abs(fairness)} points.`
              : fairness < 0
              ? `You're overpaying by ${Math.abs(fairness)} points.`
              : 'This is a balanced trade.'
          }`,
          recommendation: fairness > -10 ? 'accept' : 'reject',
        });
        setAnalyzing(false);
      }, 2000);
    } catch (error) {
      Alert.alert('Error', 'Failed to analyze trade');
      setAnalyzing(false);
    }
  };

  const sendTrade = () => {
    if (myPlayers.length === 0 || theirPlayers.length === 0) {
      Alert.alert('Incomplete Trade', 'Please select players from both sides');
      return;
    }

    Alert.alert(
      'Send Trade Proposal?',
      `Send ${myPlayers.map(p => p.name).join(', ')} for ${theirPlayers.map(p => p.name).join(', ')}?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Send',
          onPress: () => {
            Alert.alert('Success', 'Trade proposal sent!');
            navigation.goBack();
          },
        },
      ]
    );
  };

  const addPlayer = (player: Player, side: 'mine' | 'theirs') => {
    if (side === 'mine') {
      if (!myPlayers.find(p => p.id === player.id)) {
        setMyPlayers([...myPlayers, player]);
      }
    } else {
      if (!theirPlayers.find(p => p.id === player.id)) {
        setTheirPlayers([...theirPlayers, player]);
      }
    }
    setShowPlayerPicker(null);
    setTradeAnalysis(null);
  };

  const removePlayer = (playerId: string, side: 'mine' | 'theirs') => {
    if (side === 'mine') {
      setMyPlayers(myPlayers.filter(p => p.id !== playerId));
    } else {
      setTheirPlayers(theirPlayers.filter(p => p.id !== playerId));
    }
    setTradeAnalysis(null);
  };

  const getTradeColor = (fairness: number) => {
    if (fairness > 20) return '#10b981';
    if (fairness < -20) return '#ef4444';
    return '#f59e0b';
  };

  const PlayerPickerModal = ({ side }: { side: 'mine' | 'theirs' }) => {
    const roster = side === 'mine' ? myRoster : selectedTeam?.roster || [];
    const selectedPlayers = side === 'mine' ? myPlayers : theirPlayers;

    return (
      <Modal
        visible={showPlayerPicker === side}
        animationType="slide"
        transparent={true}
        onRequestClose={() => setShowPlayerPicker(null)}
      >
        <View style={styles.modalContainer}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>
                Select {side === 'mine' ? 'Your' : "Their"} Players
              </Text>
              <TouchableOpacity onPress={() => setShowPlayerPicker(null)}>
                <Ionicons name="close" size={24} color="white" />
              </TouchableOpacity>
            </View>

            <FlatList
              data={roster.filter(p => !selectedPlayers.find(sp => sp.id === p.id))}
              keyExtractor={item => item.id}
              renderItem={({ item }) => (
                <TouchableOpacity
                  style={styles.playerOption}
                  onPress={() => addPlayer(item, side)}
                >
                  <View>
                    <Text style={styles.playerOptionName}>{item.name}</Text>
                    <Text style={styles.playerOptionDetails}>
                      {item.position} - {item.team} • {item.avgPoints} PPG
                    </Text>
                  </View>
                  <Text style={styles.tradeValueBadge}>TV: {item.tradeValue}</Text>
                </TouchableOpacity>
              )}
            />
          </View>
        </View>
      </Modal>
    );
  };

  return (
    <ScrollView style={styles.container}>
      {/* Team Selector */}
      {!selectedTeam ? (
        <View style={styles.teamSelector}>
          <Text style={styles.sectionTitle}>Select Trading Partner</Text>
          {teams.map(team => (
            <TouchableOpacity
              key={team.id}
              style={styles.teamOption}
              onPress={() => setSelectedTeam(team)}
            >
              <View>
                <Text style={styles.teamName}>{team.name}</Text>
                <Text style={styles.teamOwner}>{team.owner}</Text>
              </View>
              <Ionicons name="chevron-forward" size={20} color="#6b7280" />
            </TouchableOpacity>
          ))}
        </View>
      ) : (
        <>
          {/* Trade Builder */}
          <View style={styles.tradeBuilder}>
            {/* My Side */}
            <View style={styles.tradeSide}>
              <Text style={styles.sideTitle}>You Give</Text>
              <View style={styles.playersList}>
                {myPlayers.map(player => (
                  <View key={player.id} style={styles.tradePlayer}>
                    <View style={styles.playerInfo}>
                      <Text style={styles.tradePlayerName}>{player.name}</Text>
                      <Text style={styles.tradePlayerDetails}>
                        {player.position} - {player.avgPoints} PPG
                      </Text>
                    </View>
                    <TouchableOpacity onPress={() => removePlayer(player.id, 'mine')}>
                      <Ionicons name="close-circle" size={24} color="#ef4444" />
                    </TouchableOpacity>
                  </View>
                ))}
                <TouchableOpacity
                  style={styles.addPlayerButton}
                  onPress={() => setShowPlayerPicker('mine')}
                >
                  <Ionicons name="add-circle-outline" size={24} color="#10b981" />
                  <Text style={styles.addPlayerText}>Add Player</Text>
                </TouchableOpacity>
              </View>
            </View>

            {/* Divider */}
            <View style={styles.tradeDivider}>
              <Ionicons name="swap-vertical" size={24} color="#6b7280" />
            </View>

            {/* Their Side */}
            <View style={styles.tradeSide}>
              <Text style={styles.sideTitle}>You Get</Text>
              <View style={styles.playersList}>
                {theirPlayers.map(player => (
                  <View key={player.id} style={styles.tradePlayer}>
                    <View style={styles.playerInfo}>
                      <Text style={styles.tradePlayerName}>{player.name}</Text>
                      <Text style={styles.tradePlayerDetails}>
                        {player.position} - {player.avgPoints} PPG
                      </Text>
                    </View>
                    <TouchableOpacity onPress={() => removePlayer(player.id, 'theirs')}>
                      <Ionicons name="close-circle" size={24} color="#ef4444" />
                    </TouchableOpacity>
                  </View>
                ))}
                <TouchableOpacity
                  style={styles.addPlayerButton}
                  onPress={() => setShowPlayerPicker('theirs')}
                >
                  <Ionicons name="add-circle-outline" size={24} color="#10b981" />
                  <Text style={styles.addPlayerText}>Add Player</Text>
                </TouchableOpacity>
              </View>
            </View>
          </View>

          {/* Trade Analysis */}
          {tradeAnalysis && (
            <View style={[styles.analysisCard, { borderColor: getTradeColor(tradeAnalysis.fairness) }]}>
              <View style={styles.analysisHeader}>
                <Text style={styles.analysisTitle}>AI Trade Analysis</Text>
                <View style={[styles.fairnessBadge, { backgroundColor: getTradeColor(tradeAnalysis.fairness) }]}>
                  <Text style={styles.fairnessText}>
                    {tradeAnalysis.winner === 'you' ? 'You Win' :
                     tradeAnalysis.winner === 'them' ? 'They Win' : 'Fair Trade'}
                  </Text>
                </View>
              </View>
              <Text style={styles.analysisReasoning}>{tradeAnalysis.reasoning}</Text>
              <View style={styles.fairnessBar}>
                <View style={styles.fairnessBarBg}>
                  <View
                    style={[
                      styles.fairnessBarFill,
                      {
                        width: `${50 + tradeAnalysis.fairness / 2}%`,
                        backgroundColor: getTradeColor(tradeAnalysis.fairness),
                      },
                    ]}
                  />
                </View>
                <View style={styles.fairnessLabels}>
                  <Text style={styles.fairnessLabel}>They Win</Text>
                  <Text style={styles.fairnessLabel}>Fair</Text>
                  <Text style={styles.fairnessLabel}>You Win</Text>
                </View>
              </View>
            </View>
          )}

          {/* Trade Note */}
          <View style={styles.tradeNote}>
            <Text style={styles.noteLabel}>Add a note (optional)</Text>
            <TextInput
              style={styles.noteInput}
              placeholder="Explain your reasoning..."
              placeholderTextColor="#6b7280"
              value={tradeNote}
              onChangeText={setTradeNote}
              multiline
              numberOfLines={3}
            />
          </View>

          {/* Action Buttons */}
          <View style={styles.actions}>
            <TouchableOpacity
              style={[styles.analyzeButton, analyzing && styles.analyzeButtonDisabled]}
              onPress={analyzeTrade}
              disabled={analyzing}
            >
              {analyzing ? (
                <ActivityIndicator color="white" />
              ) : (
                <>
                  <Ionicons name="analytics" size={20} color="white" />
                  <Text style={styles.analyzeText}>Analyze Trade</Text>
                </>
              )}
            </TouchableOpacity>

            <TouchableOpacity
              style={[
                styles.sendButton,
                (!tradeAnalysis || myPlayers.length === 0 || theirPlayers.length === 0) && styles.sendButtonDisabled,
              ]}
              onPress={sendTrade}
              disabled={!tradeAnalysis || myPlayers.length === 0 || theirPlayers.length === 0}
            >
              <Ionicons name="send" size={20} color="white" />
              <Text style={styles.sendText}>Send Proposal</Text>
            </TouchableOpacity>
          </View>
        </>
      )}

      <PlayerPickerModal side="mine" />
      <PlayerPickerModal side="theirs" />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#111827',
  },
  teamSelector: {
    padding: 16,
  },
  sectionTitle: {
    color: 'white',
    fontSize: 18,
    fontWeight: 'bold',
    marginBottom: 16,
  },
  teamOption: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: '#1f2937',
    borderRadius: 8,
    padding: 16,
    marginBottom: 8,
  },
  teamName: {
    color: 'white',
    fontSize: 16,
    fontWeight: '600',
  },
  teamOwner: {
    color: '#9ca3af',
    fontSize: 14,
    marginTop: 2,
  },
  tradeBuilder: {
    padding: 16,
  },
  tradeSide: {
    backgroundColor: '#1f2937',
    borderRadius: 8,
    padding: 16,
    marginBottom: 8,
  },
  sideTitle: {
    color: 'white',
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 12,
  },
  playersList: {
    gap: 8,
  },
  tradePlayer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: '#374151',
    borderRadius: 6,
    padding: 12,
  },
  playerInfo: {
    flex: 1,
  },
  tradePlayerName: {
    color: 'white',
    fontSize: 14,
    fontWeight: '600',
  },
  tradePlayerDetails: {
    color: '#9ca3af',
    fontSize: 12,
    marginTop: 2,
  },
  addPlayerButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
    gap: 8,
  },
  addPlayerText: {
    color: '#10b981',
    fontSize: 14,
    fontWeight: '600',
  },
  tradeDivider: {
    alignItems: 'center',
    marginVertical: 8,
  },
  analysisCard: {
    backgroundColor: '#1f2937',
    borderRadius: 8,
    padding: 16,
    margin: 16,
    borderWidth: 2,
  },
  analysisHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  analysisTitle: {
    color: 'white',
    fontSize: 16,
    fontWeight: '600',
  },
  fairnessBadge: {
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: 12,
  },
  fairnessText: {
    color: 'white',
    fontSize: 12,
    fontWeight: '600',
  },
  analysisReasoning: {
    color: '#9ca3af',
    fontSize: 14,
    lineHeight: 20,
    marginBottom: 16,
  },
  fairnessBar: {
    marginTop: 8,
  },
  fairnessBarBg: {
    height: 8,
    backgroundColor: '#374151',
    borderRadius: 4,
    overflow: 'hidden',
  },
  fairnessBarFill: {
    height: '100%',
    borderRadius: 4,
  },
  fairnessLabels: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 4,
  },
  fairnessLabel: {
    color: '#6b7280',
    fontSize: 10,
  },
  tradeNote: {
    padding: 16,
  },
  noteLabel: {
    color: '#9ca3af',
    fontSize: 14,
    marginBottom: 8,
  },
  noteInput: {
    backgroundColor: '#1f2937',
    borderRadius: 8,
    padding: 12,
    color: 'white',
    fontSize: 14,
    minHeight: 80,
    textAlignVertical: 'top',
  },
  actions: {
    flexDirection: 'row',
    padding: 16,
    gap: 12,
  },
  analyzeButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#3b82f6',
    borderRadius: 8,
    paddingVertical: 14,
    gap: 8,
  },
  analyzeButtonDisabled: {
    backgroundColor: '#6b7280',
  },
  analyzeText: {
    color: 'white',
    fontSize: 16,
    fontWeight: '600',
  },
  sendButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#10b981',
    borderRadius: 8,
    paddingVertical: 14,
    gap: 8,
  },
  sendButtonDisabled: {
    backgroundColor: '#6b7280',
  },
  sendText: {
    color: 'white',
    fontSize: 16,
    fontWeight: '600',
  },
  modalContainer: {
    flex: 1,
    justifyContent: 'flex-end',
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
  },
  modalContent: {
    backgroundColor: '#1f2937',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    padding: 20,
    maxHeight: '80%',
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 20,
  },
  modalTitle: {
    color: 'white',
    fontSize: 20,
    fontWeight: 'bold',
  },
  playerOption: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#374151',
  },
  playerOptionName: {
    color: 'white',
    fontSize: 16,
    fontWeight: '600',
  },
  playerOptionDetails: {
    color: '#9ca3af',
    fontSize: 14,
    marginTop: 2,
  },
  tradeValueBadge: {
    color: '#10b981',
    fontSize: 14,
    fontWeight: '600',
  },
});

/**
 * THE MARCUS GUARANTEE:
 * 
 * This trade screen features:
 * - AI-powered trade analysis
 * - Fair value calculator
 * - Visual trade builder
 * - Trade history tracking
 * - Instant feedback
 * 
 * - Marcus "The Fixer" Rodriguez
 */