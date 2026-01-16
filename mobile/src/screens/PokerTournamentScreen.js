/**
 * PKO Poker Tournament Screen for Blendlink Mobile
 * Features:
 * - Real-time WebSocket sync with web app
 * - AI Bots with human-like behaviors
 * - Progressive Knockout bounty system
 * - Landscape mode for gameplay
 */

import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  Animated,
  Dimensions,
  Alert,
  RefreshControl,
  TextInput,
  ActivityIndicator,
  Modal,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { useAuth } from '../context/AuthContext';
import { pokerAPI } from '../services/api';

const { width, height } = Dimensions.get('window');

// Card Component
const Card = ({ card, faceDown = false, style }) => {
  const getSuitColor = (suit) => {
    return ['♥', '♦'].includes(suit) ? '#EF4444' : '#1F2937';
  };

  const getSuitSymbol = (suit) => {
    const symbols = { 'hearts': '♥', 'diamonds': '♦', 'clubs': '♣', 'spades': '♠' };
    return symbols[suit] || suit;
  };

  if (faceDown || !card || card.rank === '?') {
    return (
      <View style={[styles.card, styles.cardFaceDown, style]}>
        <Text style={styles.cardBackText}>🂠</Text>
      </View>
    );
  }

  const suitSymbol = getSuitSymbol(card.suit);
  const suitColor = getSuitColor(suitSymbol);

  return (
    <View style={[styles.card, style]}>
      <Text style={[styles.cardRank, { color: suitColor }]}>{card.rank}</Text>
      <Text style={[styles.cardSuit, { color: suitColor }]}>{suitSymbol}</Text>
    </View>
  );
};

// Player Seat Component
const PlayerSeat = ({ player, isCurrentTurn, isDealer, isSB, isBB, isMe, showCards }) => {
  if (!player) {
    return (
      <View style={styles.emptySeat}>
        <Text style={styles.emptySeatText}>Empty</Text>
      </View>
    );
  }

  return (
    <View style={[
      styles.playerSeat,
      isCurrentTurn && styles.currentTurn,
      player.is_folded && styles.foldedPlayer,
    ]}>
      {/* Position badges */}
      <View style={styles.positionBadges}>
        {isDealer && <View style={styles.dealerBadge}><Text style={styles.badgeText}>D</Text></View>}
        {isSB && <View style={styles.sbBadge}><Text style={styles.badgeText}>SB</Text></View>}
        {isBB && <View style={styles.bbBadge}><Text style={styles.badgeText}>BB</Text></View>}
      </View>

      {/* Avatar */}
      <View style={[styles.avatar, player.is_bot && styles.botAvatar]}>
        <Text style={styles.avatarText}>
          {player.username?.charAt(0)?.toUpperCase() || '?'}
        </Text>
        {player.is_bot && <Text style={styles.botIndicator}>🤖</Text>}
      </View>

      {/* Cards */}
      <View style={styles.playerCards}>
        {player.cards?.map((card, i) => (
          <Card 
            key={i} 
            card={card} 
            faceDown={!showCards && !isMe && card.rank === '?'}
            style={styles.playerCard}
          />
        ))}
      </View>

      {/* Player info */}
      <Text style={[styles.playerName, isMe && styles.myName]} numberOfLines={1}>
        {player.username} {isMe && '(You)'} {player.is_bot && '🤖'}
      </Text>
      
      <View style={styles.playerChips}>
        <Text style={styles.chipsText}>💰 {player.chips?.toLocaleString()}</Text>
      </View>
      
      {player.bounty > 0 && (
        <View style={styles.bountyBadge}>
          <Text style={styles.bountyText}>👑 {player.bounty?.toLocaleString()}</Text>
        </View>
      )}

      {player.total_bounty_bl > 0 && (
        <Text style={styles.bountyWonText}>+{player.total_bounty_bl} BL won</Text>
      )}

      {/* Current bet */}
      {player.current_bet > 0 && (
        <View style={styles.currentBet}>
          <Text style={styles.currentBetText}>{player.current_bet}</Text>
        </View>
      )}

      {/* Status indicators */}
      {player.is_folded && <View style={styles.foldedBadge}><Text style={styles.foldedText}>FOLD</Text></View>}
      {player.is_all_in && <View style={styles.allInBadge}><Text style={styles.allInText}>ALL IN</Text></View>}
    </View>
  );
};

// Lobby Screen
const PokerLobbyScreen = ({ navigation }) => {
  const { user, token } = useAuth();
  const [tournaments, setTournaments] = useState([]);
  const [myTournament, setMyTournament] = useState(null);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [refreshing, setRefreshing] = useState(false);

  const loadData = async () => {
    try {
      const [tournamentsRes, myTournamentRes] = await Promise.all([
        pokerAPI.getTournaments(),
        pokerAPI.getMyTournament(),
      ]);
      setTournaments(tournamentsRes.tournaments || []);
      if (myTournamentRes.in_tournament) {
        setMyTournament(myTournamentRes.tournament);
      }
    } catch (error) {
      console.error('Failed to load poker data:', error);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const handleCreateTournament = async () => {
    // Check if already in tournament
    if (myTournament) {
      Alert.alert(
        'Already in Tournament',
        'You\'re already in a tournament. Leave it first or continue playing.',
        [
          { text: 'Continue Playing', onPress: () => navigation.navigate('PokerTable', { tournamentId: myTournament.tournament_id }) },
          { text: 'Leave & Create New', onPress: handleForceLeaveAndCreate },
        ]
      );
      return;
    }

    setCreating(true);
    try {
      // Create tournament
      const result = await pokerAPI.createTournament('PKO Tournament');
      
      if (result.tournament_id) {
        // Register for the tournament we just created
        await pokerAPI.registerForTournament(result.tournament_id);
        
        // Navigate to table
        navigation.navigate('PokerTable', { tournamentId: result.tournament_id });
      }
    } catch (error) {
      const errorMessage = error.response?.data?.detail || error.message || 'Failed to create tournament';
      
      if (errorMessage.includes('Already in a tournament')) {
        Alert.alert(
          'Already in Tournament',
          'You\'re already in a tournament. Would you like to leave and create a new one?',
          [
            { text: 'Cancel', style: 'cancel' },
            { text: 'Leave & Create', onPress: handleForceLeaveAndCreate },
          ]
        );
      } else {
        Alert.alert('Error', errorMessage);
      }
    } finally {
      setCreating(false);
    }
  };

  const handleForceLeaveAndCreate = async () => {
    try {
      await pokerAPI.forceLeaveTournament();
      setMyTournament(null);
      // Retry creating
      handleCreateTournament();
    } catch (error) {
      Alert.alert('Error', 'Failed to leave tournament');
    }
  };

  const handleJoinTournament = async (tournamentId) => {
    try {
      await pokerAPI.registerForTournament(tournamentId);
      navigation.navigate('PokerTable', { tournamentId });
    } catch (error) {
      Alert.alert('Error', error.response?.data?.detail || 'Failed to join tournament');
    }
  };

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#8B5CF6" />
        <Text style={styles.loadingText}>Loading poker lobby...</Text>
      </View>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <LinearGradient colors={['#0F172A', '#1E293B']} style={styles.gradient}>
        <ScrollView
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); loadData(); }} />
          }
        >
          {/* Header */}
          <View style={styles.header}>
            <Text style={styles.headerTitle}>🃏 PKO Poker</Text>
            <Text style={styles.headerSubtitle}>Texas Hold'em Progressive Knockout</Text>
          </View>

          {/* Tournament Info Card */}
          <View style={styles.infoCard}>
            <Text style={styles.infoTitle}>Tournament Format</Text>
            <View style={styles.infoRow}>
              <Text style={styles.infoLabel}>Buy-in:</Text>
              <Text style={styles.infoValue}>2,000 BL</Text>
            </View>
            <View style={styles.infoRow}>
              <Text style={styles.infoLabel}>Starting Bounty:</Text>
              <Text style={styles.infoValue}>1,000 BL (Platform bonus)</Text>
            </View>
            <View style={styles.infoRow}>
              <Text style={styles.infoLabel}>Players:</Text>
              <Text style={styles.infoValue}>10 per table</Text>
            </View>
            <View style={styles.infoRow}>
              <Text style={styles.infoLabel}>1st Place:</Text>
              <Text style={styles.infoValue}>65% + Bounties</Text>
            </View>
            <View style={styles.infoRow}>
              <Text style={styles.infoLabel}>2nd Place:</Text>
              <Text style={styles.infoValue}>35% + Bounties</Text>
            </View>
          </View>

          {/* My Active Tournament */}
          {myTournament && (
            <TouchableOpacity
              style={styles.myTournamentCard}
              onPress={() => navigation.navigate('PokerTable', { tournamentId: myTournament.tournament_id })}
            >
              <Text style={styles.myTournamentTitle}>🎮 Your Active Tournament</Text>
              <Text style={styles.myTournamentName}>{myTournament.name}</Text>
              <Text style={styles.myTournamentStatus}>
                {myTournament.player_count}/10 players • {myTournament.status}
              </Text>
              <Text style={styles.continueText}>Tap to continue playing →</Text>
            </TouchableOpacity>
          )}

          {/* Create Tournament Button */}
          {!myTournament && (
            <TouchableOpacity
              style={styles.createButton}
              onPress={handleCreateTournament}
              disabled={creating}
            >
              <LinearGradient
                colors={['#8B5CF6', '#6366F1']}
                style={styles.createButtonGradient}
              >
                {creating ? (
                  <ActivityIndicator color="#fff" />
                ) : (
                  <>
                    <Text style={styles.createButtonText}>Create Table</Text>
                    <Text style={styles.createButtonCost}>2,000 BL Buy-in</Text>
                  </>
                )}
              </LinearGradient>
            </TouchableOpacity>
          )}

          {/* Open Tournaments */}
          <Text style={styles.sectionTitle}>Open Tables</Text>
          {tournaments.length === 0 ? (
            <View style={styles.emptyState}>
              <Text style={styles.emptyStateText}>No open tables</Text>
              <Text style={styles.emptyStateSubtext}>Create one to start playing!</Text>
            </View>
          ) : (
            tournaments.map((t) => (
              <TouchableOpacity
                key={t.tournament_id}
                style={styles.tournamentCard}
                onPress={() => handleJoinTournament(t.tournament_id)}
              >
                <View style={styles.tournamentInfo}>
                  <Text style={styles.tournamentName}>{t.name}</Text>
                  <Text style={styles.tournamentPlayers}>
                    {t.player_count}/10 players
                    {t.bot_count > 0 && ` (${t.bot_count} bots)`}
                  </Text>
                </View>
                <TouchableOpacity style={styles.joinButton}>
                  <Text style={styles.joinButtonText}>Join</Text>
                </TouchableOpacity>
              </TouchableOpacity>
            ))
          )}

          {/* PKO Rules */}
          <View style={styles.rulesCard}>
            <Text style={styles.rulesTitle}>📜 PKO Rules</Text>
            <Text style={styles.ruleText}>• Eliminate a player = Win their bounty</Text>
            <Text style={styles.ruleText}>• 50% of bounty goes to your wallet</Text>
            <Text style={styles.ruleText}>• 50% adds to YOUR bounty (progressive)</Text>
            <Text style={styles.ruleText}>• Rebuys available for 60 min or until Level 5</Text>
          </View>
        </ScrollView>
      </LinearGradient>
    </SafeAreaView>
  );
};

// Table Screen (Game View)
const PokerTableScreen = ({ route, navigation }) => {
  const { tournamentId } = route.params;
  const { user, token } = useAuth();
  const [tournament, setTournament] = useState(null);
  const [loading, setLoading] = useState(true);
  const [betAmount, setBetAmount] = useState(0);
  const [actionLoading, setActionLoading] = useState(false);
  const [chatMessage, setChatMessage] = useState('');
  const [showChat, setShowChat] = useState(false);
  const wsRef = useRef(null);

  // Load tournament data
  const loadTournament = async () => {
    try {
      const data = await pokerAPI.getTournament(tournamentId);
      setTournament(data);
      setBetAmount(data.big_blind || 50);
    } catch (error) {
      console.error('Failed to load tournament:', error);
      Alert.alert('Error', 'Failed to load tournament');
      navigation.goBack();
    } finally {
      setLoading(false);
    }
  };

  // WebSocket connection
  useEffect(() => {
    loadTournament();

    // Connect to WebSocket for real-time updates
    // Use the same backend URL but with wss protocol
    const backendUrl = 'realtime-platform-1.preview.emergentagent.com';
    const wsUrl = `wss://${backendUrl}/api/poker/ws/${tournamentId}?token=${token}`;
    wsRef.current = new WebSocket(wsUrl);

    wsRef.current.onopen = () => {
      console.log('WebSocket connected');
    };

    wsRef.current.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);
        if (data.type === 'game_state' || data.type === 'state_update') {
          setTournament(data.data);
        } else if (data.type === 'player_eliminated') {
          Alert.alert(
            'Player Eliminated!',
            `${data.data.eliminator_username} knocked out ${data.data.eliminated_username}\nBounty won: ${data.data.bounty_awarded} BL`
          );
        } else if (data.type === 'tournament_ended') {
          Alert.alert('Tournament Ended', 'Results are being calculated...');
        }
      } catch (e) {
        console.error('WebSocket message error:', e);
      }
    };

    wsRef.current.onerror = (error) => {
      console.error('WebSocket error:', error);
    };

    wsRef.current.onclose = () => {
      console.log('WebSocket disconnected');
    };

    return () => {
      if (wsRef.current) {
        wsRef.current.close();
      }
    };
  }, [tournamentId, token]);

  // Handle player action
  const handleAction = async (action, amount = 0) => {
    setActionLoading(true);
    try {
      await pokerAPI.playerAction(tournamentId, action, amount);
    } catch (error) {
      Alert.alert('Error', error.response?.data?.detail || 'Action failed');
    } finally {
      setActionLoading(false);
    }
  };

  // Handle add bots
  const handleAddBots = async (count) => {
    if (!tournament) return;
    
    const availableSeats = 10 - Object.keys(tournament.players || {}).length;
    if (availableSeats <= 0) {
      Alert.alert('Table Full', 'The table is already full with 10 players.');
      return;
    }
    
    const botsToAdd = Math.min(count, availableSeats);
    
    try {
      const result = await pokerAPI.addBots(tournamentId, botsToAdd);
      const added = result.bots_added || 0;
      
      if (added > 0) {
        Alert.alert('Bots Added', `Successfully added ${added} AI bot${added > 1 ? 's' : ''} to the table!`);
        // Refresh tournament data
        const updatedTournament = await pokerAPI.getMyTournament();
        if (updatedTournament.in_tournament) {
          setTournament(updatedTournament.tournament);
        }
      } else {
        Alert.alert('No Bots Added', 'Could not add bots. The table may be full or the tournament has already started.');
      }
    } catch (error) {
      const msg = error.response?.data?.detail || 'Failed to add bots';
      Alert.alert('Error', msg);
    }
  };

  // Handle rebuy
  const handleRebuy = async () => {
    try {
      await pokerAPI.rebuy(tournamentId);
      Alert.alert('Success', 'Rebuy successful!');
      loadTournament();
    } catch (error) {
      Alert.alert('Error', error.response?.data?.detail || 'Rebuy failed');
    }
  };

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#8B5CF6" />
        <Text style={styles.loadingText}>Loading table...</Text>
      </View>
    );
  }

  const players = Object.values(tournament?.players || {});
  const myPlayer = players.find(p => p.user_id === user?.user_id);
  const isMyTurn = tournament?.current_player_seat === myPlayer?.seat;
  const canAct = isMyTurn && !myPlayer?.is_folded && myPlayer?.is_active;

  // Waiting room view
  if (tournament?.status === 'registering') {
    return (
      <SafeAreaView style={styles.container}>
        <LinearGradient colors={['#0F172A', '#1E293B']} style={styles.gradient}>
          <View style={styles.waitingRoom}>
            <Text style={styles.waitingTitle}>⏳ Waiting for Players</Text>
            <Text style={styles.waitingCount}>{tournament.player_count}/10</Text>

            {/* Players list */}
            <View style={styles.playersList}>
              {players.map((p) => (
                <View key={p.user_id} style={[styles.waitingPlayer, p.is_bot && styles.botPlayer]}>
                  <Text style={styles.waitingPlayerName}>
                    {p.username} {p.is_bot && '🤖'}
                  </Text>
                  {p.is_bot && <Text style={styles.botSkill}>{p.bot_personality}</Text>}
                </View>
              ))}
              {/* Empty seats */}
              {Array(10 - tournament.player_count).fill(null).map((_, i) => (
                <View key={`empty-${i}`} style={styles.emptySeatWaiting}>
                  <Text style={styles.emptySeatText}>Empty Seat</Text>
                </View>
              ))}
            </View>

            {/* Add bots (creator only) */}
            {tournament.creator_id === user?.user_id && tournament.player_count < 10 && (
              <View style={styles.addBotsSection}>
                <Text style={styles.addBotsTitle}>Add AI Bots</Text>
                <View style={styles.addBotsButtons}>
                  <TouchableOpacity style={styles.addBotBtn} onPress={() => handleAddBots(1)}>
                    <Text style={styles.addBotBtnText}>+1</Text>
                  </TouchableOpacity>
                  <TouchableOpacity style={styles.addBotBtn} onPress={() => handleAddBots(3)}>
                    <Text style={styles.addBotBtnText}>+3</Text>
                  </TouchableOpacity>
                  <TouchableOpacity style={styles.fillBotsBtn} onPress={() => handleAddBots(10 - tournament.player_count)}>
                    <Text style={styles.fillBotsBtnText}>Fill ({10 - tournament.player_count})</Text>
                  </TouchableOpacity>
                </View>
              </View>
            )}

            <TouchableOpacity style={styles.backButton} onPress={() => navigation.goBack()}>
              <Text style={styles.backButtonText}>← Leave Lobby</Text>
            </TouchableOpacity>
          </View>
        </LinearGradient>
      </SafeAreaView>
    );
  }

  // Game view
  return (
    <View style={styles.tableContainer}>
      <LinearGradient colors={['#0F172A', '#064E3B', '#0F172A']} style={styles.tableGradient}>
        <ScrollView contentContainerStyle={styles.tableScrollContent} showsVerticalScrollIndicator={false}>
          {/* Header Info */}
          <View style={styles.tableHeader}>
            <View>
              <Text style={styles.blindsText}>Blinds: {tournament.small_blind}/{tournament.big_blind}</Text>
              <Text style={styles.levelText}>Level {tournament.blind_level + 1}</Text>
            </View>
            <View style={styles.potContainer}>
              <Text style={styles.potLabel}>POT</Text>
              <Text style={styles.potValue}>{tournament.pot?.toLocaleString()}</Text>
            </View>
            <View>
              <Text style={styles.handText}>Hand #{tournament.hand_number}</Text>
              <Text style={styles.phaseText}>{tournament.phase?.toUpperCase()}</Text>
            </View>
          </View>

          {/* Community Cards */}
          <View style={styles.communityCards}>
            {tournament.community_cards?.map((card, i) => (
              <Card key={i} card={card} style={styles.communityCard} />
            ))}
            {Array(5 - (tournament.community_cards?.length || 0)).fill(null).map((_, i) => (
              <View key={`empty-${i}`} style={styles.emptyCard} />
            ))}
          </View>

          {/* Players around table */}
          <View style={styles.playersContainer}>
            {players.map((player) => (
              <PlayerSeat
                key={player.user_id}
                player={player}
                isCurrentTurn={tournament.current_player_seat === player.seat}
                isDealer={tournament.dealer_seat === player.seat}
                isSB={tournament.small_blind_seat === player.seat}
                isBB={tournament.big_blind_seat === player.seat}
                isMe={player.user_id === user?.user_id}
                showCards={tournament.phase === 'showdown' || tournament.phase === 'hand_complete'}
              />
            ))}
          </View>

          {/* My Cards & Actions */}
          {myPlayer && (
            <View style={styles.mySection}>
              {/* My hole cards (larger) */}
              <View style={styles.myCards}>
                {myPlayer.cards?.map((card, i) => (
                  <Card key={i} card={card} style={styles.myCard} />
                ))}
              </View>

              {/* Action buttons */}
              {canAct && (
                <View style={styles.actionsContainer}>
                  <TouchableOpacity
                    style={[styles.actionButton, styles.foldButton]}
                    onPress={() => handleAction('fold')}
                    disabled={actionLoading}
                  >
                    <Text style={styles.actionButtonText}>FOLD</Text>
                  </TouchableOpacity>

                  {tournament.current_bet === myPlayer.current_bet ? (
                    <TouchableOpacity
                      style={[styles.actionButton, styles.checkButton]}
                      onPress={() => handleAction('check')}
                    disabled={actionLoading}
                  >
                    <Text style={styles.actionButtonText}>CHECK</Text>
                  </TouchableOpacity>
                ) : (
                  <TouchableOpacity
                    style={[styles.actionButton, styles.callButton]}
                    onPress={() => handleAction('call')}
                    disabled={actionLoading}
                  >
                    <Text style={styles.actionButtonText}>
                      CALL {tournament.current_bet - myPlayer.current_bet}
                    </Text>
                  </TouchableOpacity>
                )}

                <View style={styles.raiseSection}>
                  <TextInput
                    style={styles.betInput}
                    value={String(betAmount)}
                    onChangeText={(t) => setBetAmount(parseInt(t) || 0)}
                    keyboardType="number-pad"
                  />
                  <TouchableOpacity
                    style={[styles.actionButton, styles.raiseButton]}
                    onPress={() => handleAction('raise', betAmount)}
                    disabled={actionLoading}
                  >
                    <Text style={styles.actionButtonText}>RAISE</Text>
                  </TouchableOpacity>
                </View>

                <TouchableOpacity
                  style={[styles.actionButton, styles.allInButton]}
                  onPress={() => handleAction('all_in')}
                  disabled={actionLoading}
                >
                  <Text style={styles.actionButtonText}>ALL IN</Text>
                </TouchableOpacity>
              </View>
            )}

            {/* Rebuy option */}
            {tournament.rebuy_available && myPlayer && myPlayer.chips === 0 && !myPlayer.is_active && (
              <TouchableOpacity style={styles.rebuyButton} onPress={handleRebuy}>
                <Text style={styles.rebuyButtonText}>REBUY (2,000 BL)</Text>
              </TouchableOpacity>
            )}
          </View>
        )}

        {/* Table Chat Section */}
        <View style={styles.chatSection}>
          <TouchableOpacity 
            style={styles.chatToggle} 
            onPress={() => setShowChat(!showChat)}
          >
            <Text style={styles.chatToggleText}>
              💬 Chat {showChat ? '▼' : '▲'}
            </Text>
          </TouchableOpacity>
          
          {showChat && (
            <View style={styles.chatContainer}>
              <ScrollView style={styles.chatMessages}>
                {tournament.chat_messages?.length === 0 && (
                  <Text style={styles.noChatText}>No messages yet. Say hello!</Text>
                )}
                {tournament.chat_messages?.map((msg, idx) => (
                  <View key={idx} style={styles.chatMessage}>
                    <Text style={styles.chatUsername}>{msg.username}:</Text>
                    <Text style={styles.chatText}>{msg.message}</Text>
                  </View>
                ))}
              </ScrollView>
              <View style={styles.chatInputRow}>
                <TextInput
                  style={styles.chatInput}
                  placeholder="Type a message..."
                  placeholderTextColor="#64748B"
                  value={chatMessage}
                  onChangeText={setChatMessage}
                />
                <TouchableOpacity 
                  style={styles.chatSendBtn}
                  onPress={async () => {
                    if (chatMessage.trim()) {
                      try {
                        await pokerAPI.sendChat(tournamentId, chatMessage);
                        setChatMessage('');
                      } catch (e) {
                        console.error('Chat error:', e);
                      }
                    }
                  }}
                >
                  <Text style={styles.chatSendText}>Send</Text>
                </TouchableOpacity>
              </View>
            </View>
          )}
        </View>
        </ScrollView>

        {/* Back button */}
        <TouchableOpacity style={styles.exitButton} onPress={() => navigation.goBack()}>
          <Text style={styles.exitButtonText}>← EXIT</Text>
        </TouchableOpacity>
      </LinearGradient>
    </View>
  );
};

// Main export with navigation
export { PokerLobbyScreen, PokerTableScreen };

// Styles
const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0F172A',
  },
  gradient: {
    flex: 1,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#0F172A',
  },
  loadingText: {
    color: '#94A3B8',
    marginTop: 16,
    fontSize: 16,
  },
  header: {
    padding: 20,
    alignItems: 'center',
  },
  headerTitle: {
    fontSize: 28,
    fontWeight: 'bold',
    color: '#fff',
  },
  headerSubtitle: {
    fontSize: 14,
    color: '#94A3B8',
    marginTop: 4,
  },
  infoCard: {
    margin: 16,
    padding: 16,
    backgroundColor: 'rgba(139, 92, 246, 0.1)',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: 'rgba(139, 92, 246, 0.3)',
  },
  infoTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#8B5CF6',
    marginBottom: 12,
  },
  infoRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255,255,255,0.1)',
  },
  infoLabel: {
    color: '#94A3B8',
    fontSize: 14,
  },
  infoValue: {
    color: '#fff',
    fontWeight: '600',
    fontSize: 14,
  },
  myTournamentCard: {
    margin: 16,
    padding: 20,
    backgroundColor: 'rgba(34, 197, 94, 0.2)',
    borderRadius: 16,
    borderWidth: 2,
    borderColor: '#22C55E',
  },
  myTournamentTitle: {
    fontSize: 14,
    color: '#22C55E',
    fontWeight: '600',
  },
  myTournamentName: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#fff',
    marginTop: 8,
  },
  myTournamentStatus: {
    fontSize: 14,
    color: '#94A3B8',
    marginTop: 4,
  },
  continueText: {
    fontSize: 16,
    color: '#22C55E',
    fontWeight: '600',
    marginTop: 12,
  },
  createButton: {
    margin: 16,
    borderRadius: 16,
    overflow: 'hidden',
  },
  createButtonGradient: {
    padding: 20,
    alignItems: 'center',
  },
  createButtonText: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#fff',
  },
  createButtonCost: {
    fontSize: 14,
    color: 'rgba(255,255,255,0.8)',
    marginTop: 4,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#fff',
    marginHorizontal: 16,
    marginTop: 24,
    marginBottom: 12,
  },
  emptyState: {
    margin: 16,
    padding: 40,
    alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.05)',
    borderRadius: 16,
  },
  emptyStateText: {
    fontSize: 16,
    color: '#94A3B8',
  },
  emptyStateSubtext: {
    fontSize: 14,
    color: '#64748B',
    marginTop: 4,
  },
  tournamentCard: {
    flexDirection: 'row',
    alignItems: 'center',
    margin: 16,
    marginTop: 0,
    padding: 16,
    backgroundColor: 'rgba(255,255,255,0.05)',
    borderRadius: 12,
  },
  tournamentInfo: {
    flex: 1,
  },
  tournamentName: {
    fontSize: 16,
    fontWeight: '600',
    color: '#fff',
  },
  tournamentPlayers: {
    fontSize: 14,
    color: '#94A3B8',
    marginTop: 4,
  },
  joinButton: {
    paddingHorizontal: 20,
    paddingVertical: 10,
    backgroundColor: '#8B5CF6',
    borderRadius: 8,
  },
  joinButtonText: {
    color: '#fff',
    fontWeight: '600',
  },
  rulesCard: {
    margin: 16,
    marginTop: 24,
    padding: 16,
    backgroundColor: 'rgba(251, 191, 36, 0.1)',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: 'rgba(251, 191, 36, 0.3)',
  },
  rulesTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#FBBF24',
    marginBottom: 12,
  },
  ruleText: {
    fontSize: 14,
    color: '#94A3B8',
    marginBottom: 8,
  },
  // Waiting room
  waitingRoom: {
    flex: 1,
    padding: 20,
    alignItems: 'center',
  },
  waitingTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#fff',
    marginBottom: 8,
  },
  waitingCount: {
    fontSize: 48,
    fontWeight: 'bold',
    color: '#8B5CF6',
  },
  playersList: {
    width: '100%',
    marginTop: 20,
  },
  waitingPlayer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 12,
    backgroundColor: 'rgba(59, 130, 246, 0.2)',
    borderRadius: 8,
    marginBottom: 8,
  },
  botPlayer: {
    backgroundColor: 'rgba(139, 92, 246, 0.2)',
  },
  waitingPlayerName: {
    fontSize: 16,
    color: '#fff',
    fontWeight: '500',
  },
  botSkill: {
    fontSize: 12,
    color: '#8B5CF6',
  },
  emptySeatWaiting: {
    padding: 12,
    backgroundColor: 'rgba(255,255,255,0.05)',
    borderRadius: 8,
    marginBottom: 8,
    alignItems: 'center',
  },
  addBotsSection: {
    width: '100%',
    marginTop: 24,
    padding: 16,
    backgroundColor: 'rgba(139, 92, 246, 0.1)',
    borderRadius: 12,
  },
  addBotsTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#8B5CF6',
    marginBottom: 12,
    textAlign: 'center',
  },
  addBotsButtons: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 12,
  },
  addBotBtn: {
    paddingHorizontal: 20,
    paddingVertical: 10,
    backgroundColor: 'rgba(139, 92, 246, 0.3)',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#8B5CF6',
  },
  addBotBtnText: {
    color: '#8B5CF6',
    fontWeight: '600',
  },
  fillBotsBtn: {
    paddingHorizontal: 20,
    paddingVertical: 10,
    backgroundColor: '#8B5CF6',
    borderRadius: 8,
  },
  fillBotsBtnText: {
    color: '#fff',
    fontWeight: '600',
  },
  backButton: {
    marginTop: 24,
    padding: 16,
  },
  backButtonText: {
    color: '#94A3B8',
    fontSize: 16,
  },
  // Table view
  tableContainer: {
    flex: 1,
  },
  tableGradient: {
    flex: 1,
    padding: 16,
  },
  tableScrollContent: {
    flexGrow: 1,
    paddingBottom: 80,
  },
  tableHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingBottom: 16,
  },
  blindsText: {
    fontSize: 14,
    color: '#fff',
    fontWeight: '600',
  },
  levelText: {
    fontSize: 12,
    color: '#94A3B8',
  },
  potContainer: {
    alignItems: 'center',
    backgroundColor: 'rgba(251, 191, 36, 0.2)',
    paddingHorizontal: 24,
    paddingVertical: 8,
    borderRadius: 12,
  },
  potLabel: {
    fontSize: 12,
    color: '#FBBF24',
  },
  potValue: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#FBBF24',
  },
  handText: {
    fontSize: 14,
    color: '#fff',
    textAlign: 'right',
  },
  phaseText: {
    fontSize: 12,
    color: '#22C55E',
    textAlign: 'right',
  },
  communityCards: {
    flexDirection: 'row',
    justifyContent: 'center',
    marginVertical: 20,
    gap: 8,
  },
  communityCard: {
    width: 50,
    height: 70,
  },
  emptyCard: {
    width: 50,
    height: 70,
    backgroundColor: 'rgba(255,255,255,0.1)',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.2)',
    borderStyle: 'dashed',
  },
  playersContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'center',
    gap: 8,
  },
  // Card styles
  card: {
    width: 40,
    height: 56,
    backgroundColor: '#fff',
    borderRadius: 6,
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 4,
    elevation: 4,
  },
  cardFaceDown: {
    backgroundColor: '#3B82F6',
  },
  cardBackText: {
    fontSize: 24,
  },
  cardRank: {
    fontSize: 16,
    fontWeight: 'bold',
  },
  cardSuit: {
    fontSize: 14,
  },
  // Player seat
  playerSeat: {
    width: 80,
    padding: 8,
    backgroundColor: 'rgba(0,0,0,0.3)',
    borderRadius: 12,
    alignItems: 'center',
  },
  currentTurn: {
    borderWidth: 2,
    borderColor: '#22C55E',
    backgroundColor: 'rgba(34, 197, 94, 0.2)',
  },
  foldedPlayer: {
    opacity: 0.5,
  },
  positionBadges: {
    flexDirection: 'row',
    gap: 4,
    marginBottom: 4,
  },
  dealerBadge: {
    width: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: '#FBBF24',
    justifyContent: 'center',
    alignItems: 'center',
  },
  sbBadge: {
    width: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: '#3B82F6',
    justifyContent: 'center',
    alignItems: 'center',
  },
  bbBadge: {
    width: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: '#EF4444',
    justifyContent: 'center',
    alignItems: 'center',
  },
  badgeText: {
    fontSize: 10,
    fontWeight: 'bold',
    color: '#fff',
  },
  avatar: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#6366F1',
    justifyContent: 'center',
    alignItems: 'center',
  },
  botAvatar: {
    backgroundColor: '#8B5CF6',
  },
  avatarText: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#fff',
  },
  botIndicator: {
    position: 'absolute',
    bottom: -4,
    right: -4,
    fontSize: 12,
  },
  playerCards: {
    flexDirection: 'row',
    marginTop: 4,
    gap: 2,
  },
  playerCard: {
    width: 28,
    height: 40,
  },
  playerName: {
    fontSize: 10,
    color: '#fff',
    fontWeight: '500',
    marginTop: 4,
  },
  myName: {
    color: '#FBBF24',
  },
  playerChips: {
    marginTop: 2,
  },
  chipsText: {
    fontSize: 10,
    color: '#FBBF24',
  },
  bountyBadge: {
    marginTop: 2,
  },
  bountyText: {
    fontSize: 9,
    color: '#22C55E',
  },
  bountyWonText: {
    fontSize: 8,
    color: '#A78BFA',
    marginTop: 2,
  },
  currentBet: {
    marginTop: 4,
    backgroundColor: '#EF4444',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
  },
  currentBetText: {
    fontSize: 10,
    color: '#fff',
    fontWeight: 'bold',
  },
  foldedBadge: {
    position: 'absolute',
    top: '50%',
    backgroundColor: 'rgba(0,0,0,0.8)',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 4,
  },
  foldedText: {
    fontSize: 10,
    color: '#EF4444',
    fontWeight: 'bold',
  },
  allInBadge: {
    position: 'absolute',
    top: '50%',
    backgroundColor: '#8B5CF6',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 4,
  },
  allInText: {
    fontSize: 10,
    color: '#fff',
    fontWeight: 'bold',
  },
  emptySeat: {
    width: 80,
    height: 100,
    backgroundColor: 'rgba(255,255,255,0.05)',
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)',
    borderStyle: 'dashed',
  },
  emptySeatText: {
    fontSize: 10,
    color: '#64748B',
  },
  // My section
  mySection: {
    marginTop: 20,
    alignItems: 'center',
  },
  myCards: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 16,
  },
  myCard: {
    width: 60,
    height: 84,
  },
  actionsContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'center',
    gap: 8,
  },
  actionButton: {
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderRadius: 8,
    minWidth: 70,
    alignItems: 'center',
  },
  foldButton: {
    backgroundColor: '#EF4444',
  },
  checkButton: {
    backgroundColor: '#22C55E',
  },
  callButton: {
    backgroundColor: '#3B82F6',
  },
  raiseButton: {
    backgroundColor: '#F59E0B',
  },
  allInButton: {
    backgroundColor: '#8B5CF6',
  },
  actionButtonText: {
    color: '#fff',
    fontWeight: 'bold',
    fontSize: 12,
  },
  raiseSection: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  betInput: {
    width: 60,
    height: 40,
    backgroundColor: '#fff',
    borderRadius: 8,
    paddingHorizontal: 8,
    textAlign: 'center',
    fontSize: 14,
    fontWeight: 'bold',
  },
  rebuyButton: {
    marginTop: 16,
    backgroundColor: '#22C55E',
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 8,
  },
  rebuyButtonText: {
    color: '#fff',
    fontWeight: 'bold',
    fontSize: 14,
  },
  exitButton: {
    position: 'absolute',
    top: 40,
    left: 16,
    padding: 8,
  },
  exitButtonText: {
    color: '#94A3B8',
    fontSize: 14,
  },
  // Chat styles
  chatSection: {
    margin: 16,
    marginTop: 8,
  },
  chatToggle: {
    backgroundColor: 'rgba(59, 130, 246, 0.2)',
    padding: 12,
    borderRadius: 8,
    alignItems: 'center',
  },
  chatToggleText: {
    color: '#3B82F6',
    fontWeight: '600',
    fontSize: 14,
  },
  chatContainer: {
    backgroundColor: 'rgba(0, 0, 0, 0.4)',
    borderRadius: 12,
    marginTop: 8,
    maxHeight: 200,
  },
  chatMessages: {
    padding: 12,
    maxHeight: 120,
  },
  noChatText: {
    color: '#64748B',
    fontSize: 13,
    fontStyle: 'italic',
    textAlign: 'center',
  },
  chatMessage: {
    flexDirection: 'row',
    marginBottom: 8,
    flexWrap: 'wrap',
  },
  chatUsername: {
    color: '#FBBF24',
    fontWeight: '600',
    fontSize: 13,
    marginRight: 6,
  },
  chatText: {
    color: '#E2E8F0',
    fontSize: 13,
    flex: 1,
  },
  chatInputRow: {
    flexDirection: 'row',
    padding: 8,
    borderTopWidth: 1,
    borderTopColor: 'rgba(255, 255, 255, 0.1)',
    gap: 8,
  },
  chatInput: {
    flex: 1,
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 8,
    color: '#fff',
    fontSize: 13,
  },
  chatSendBtn: {
    backgroundColor: '#3B82F6',
    paddingHorizontal: 16,
    borderRadius: 8,
    justifyContent: 'center',
  },
  chatSendText: {
    color: '#fff',
    fontWeight: '600',
    fontSize: 13,
  },
});

export default PokerLobbyScreen;
