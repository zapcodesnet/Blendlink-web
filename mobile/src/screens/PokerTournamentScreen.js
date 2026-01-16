/**
 * PKO Poker Tournament Screen for Blendlink Mobile
 * Features:
 * - Real-time WebSocket sync with web app
 * - AI Bots with human-like behaviors
 * - Progressive Knockout bounty system
 * - Responsive layout for all screen sizes
 */

import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  Dimensions,
  Alert,
  RefreshControl,
  TextInput,
  ActivityIndicator,
  Platform,
  StatusBar,
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import * as ScreenOrientation from 'expo-screen-orientation';
import { useAuth } from '../context/AuthContext';
import { pokerAPI } from '../services/api';

// Get dynamic dimensions
const getScreenDimensions = () => {
  const { width, height } = Dimensions.get('window');
  return { width, height, isLandscape: width > height };
};

// Card Component
const Card = ({ card, faceDown = false, style }) => {
  const getSuitColor = (suit) => {
    return ['hearts', 'diamonds', '♥', '♦'].includes(suit) ? '#EF4444' : '#1F2937';
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
  const suitColor = getSuitColor(card.suit);

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

      {/* Player cards */}
      <View style={styles.playerCards}>
        {player.cards?.map((card, i) => (
          <Card
            key={i}
            card={card}
            faceDown={!isMe && !showCards && card.rank !== '?'}
            style={styles.playerCard}
          />
        ))}
      </View>

      {/* Name */}
      <Text style={[styles.playerName, isMe && styles.myName]} numberOfLines={1}>
        {player.username} {isMe && '(You)'}
      </Text>

      {/* Chips */}
      <View style={styles.playerChips}>
        <Text style={styles.chipsText}>💰 {player.chips?.toLocaleString()}</Text>
      </View>

      {/* Bounty */}
      {player.bounty > 0 && (
        <View style={styles.bountyBadge}>
          <Text style={styles.bountyText}>👑 {player.bounty?.toLocaleString()}</Text>
        </View>
      )}

      {/* Current bet */}
      {player.current_bet > 0 && (
        <View style={styles.currentBet}>
          <Text style={styles.currentBetText}>{player.current_bet}</Text>
        </View>
      )}

      {/* Status badges */}
      {player.is_folded && <View style={styles.foldedBadge}><Text style={styles.foldedText}>FOLD</Text></View>}
      {player.is_all_in && <View style={styles.allInBadge}><Text style={styles.allInText}>ALL IN</Text></View>}
    </View>
  );
};

// Poker Lobby Screen
const PokerLobbyScreen = ({ navigation }) => {
  const { user } = useAuth();
  const [tournaments, setTournaments] = useState([]);
  const [myTournament, setMyTournament] = useState(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [creating, setCreating] = useState(false);

  const loadData = async () => {
    try {
      const [tournamentsData, myTournamentData] = await Promise.all([
        pokerAPI.getTournaments(),
        pokerAPI.getMyTournament(),
      ]);
      setTournaments(tournamentsData.tournaments || []);
      if (myTournamentData.in_tournament) {
        setMyTournament(myTournamentData.tournament);
      } else {
        setMyTournament(null);
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

  const handleRefresh = () => {
    setRefreshing(true);
    loadData();
  };

  const handleCreateTournament = async () => {
    if (myTournament) {
      Alert.alert('Already in Tournament', 'Leave your current tournament first.');
      return;
    }

    setCreating(true);
    try {
      // Create tournament
      const createResult = await pokerAPI.createTournament('Mobile PKO Tournament');
      
      if (!createResult.tournament_id) {
        throw new Error('Failed to create tournament');
      }

      // Register for it
      await pokerAPI.registerForTournament(createResult.tournament_id);
      
      Alert.alert('Success', 'Tournament created! Waiting for players...');
      navigation.navigate('PokerTable', { tournamentId: createResult.tournament_id });
    } catch (error) {
      const msg = error.response?.data?.detail || error.message || 'Failed to create tournament';
      Alert.alert('Error', msg);
    } finally {
      setCreating(false);
    }
  };

  const handleJoinTournament = async (tournamentId) => {
    if (myTournament) {
      Alert.alert('Already in Tournament', 'Leave your current tournament first.');
      return;
    }

    try {
      await pokerAPI.registerForTournament(tournamentId);
      navigation.navigate('PokerTable', { tournamentId });
    } catch (error) {
      Alert.alert('Error', error.response?.data?.detail || 'Failed to join tournament');
    }
  };

  const handleLeaveTournament = async () => {
    try {
      await pokerAPI.leaveTournament(myTournament.tournament_id);
      Alert.alert('Success', 'Left tournament. Buy-in refunded!');
      setMyTournament(null);
      loadData();
    } catch (error) {
      // Try force leave
      try {
        await pokerAPI.forceLeave();
        Alert.alert('Success', 'Force left tournament.');
        setMyTournament(null);
        loadData();
      } catch (forceError) {
        Alert.alert('Error', forceError.response?.data?.detail || 'Failed to leave');
      }
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
            <RefreshControl refreshing={refreshing} onRefresh={handleRefresh} tintColor="#8B5CF6" />
          }
          contentContainerStyle={styles.lobbyContent}
        >
          {/* Header */}
          <View style={styles.header}>
            <Text style={styles.headerTitle}>🃏 PKO Poker</Text>
            <Text style={styles.headerSubtitle}>Texas Hold'em Progressive Knockout</Text>
          </View>

          {/* Tournament Info */}
          <View style={styles.infoCard}>
            <Text style={styles.infoTitle}>Tournament Format</Text>
            <View style={styles.infoRow}>
              <Text style={styles.infoLabel}>Buy-in:</Text>
              <Text style={styles.infoValue}>2,000 BL</Text>
            </View>
            <View style={styles.infoRow}>
              <Text style={styles.infoLabel}>Starting Bounty:</Text>
              <Text style={styles.infoValue}>1,000 BL</Text>
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
                Status: {myTournament.status} | Players: {myTournament.player_count}/10
              </Text>
              <Text style={styles.continueText}>Tap to continue playing →</Text>
              
              {/* Leave button */}
              <TouchableOpacity 
                style={styles.leaveTournamentBtn}
                onPress={(e) => {
                  e.stopPropagation();
                  Alert.alert(
                    'Leave Tournament?',
                    'Your buy-in will be refunded.',
                    [
                      { text: 'Cancel', style: 'cancel' },
                      { text: 'Leave', style: 'destructive', onPress: handleLeaveTournament }
                    ]
                  );
                }}
              >
                <Text style={styles.leaveTournamentText}>Leave & Refund</Text>
              </TouchableOpacity>
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
                colors={['#F59E0B', '#D97706']}
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

          {/* Open Tables */}
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
                    Players: {t.player_count}/{t.max_players} | Prize: {t.prize_pool} BL
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
  const [betAmount, setBetAmount] = useState(100);
  const [actionLoading, setActionLoading] = useState(false);
  const [chatMessage, setChatMessage] = useState('');
  const [showChat, setShowChat] = useState(false);
  const [screenDimensions, setScreenDimensions] = useState(getScreenDimensions());
  const wsRef = useRef(null);
  const insets = useSafeAreaInsets();

  // Handle screen dimension changes (rotation)
  useEffect(() => {
    const subscription = Dimensions.addEventListener('change', ({ window }) => {
      setScreenDimensions({
        width: window.width,
        height: window.height,
        isLandscape: window.width > window.height
      });
    });

    return () => subscription?.remove();
  }, []);

  // Load tournament data
  const loadTournament = async () => {
    try {
      const data = await pokerAPI.getTournament(tournamentId);
      setTournament(data);
      if (data.big_blind) {
        setBetAmount(data.big_blind * 2);
      }
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

    // Get the WebSocket URL from environment or construct it
    const apiUrl = process.env.EXPO_PUBLIC_API_URL || '';
    const wsUrl = apiUrl.replace('https://', 'wss://').replace('http://', 'ws://') + `/api/poker/ws/${tournamentId}?token=${token}`;
    
    console.log('Connecting to WebSocket:', wsUrl);

    try {
      wsRef.current = new WebSocket(wsUrl);

      wsRef.current.onopen = () => {
        console.log('WebSocket connected');
      };

      wsRef.current.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data);
          console.log('WebSocket message:', data.type);
          
          if (data.type === 'connected' || data.type === 'game_state' || data.type === 'state_update') {
            setTournament(data.data);
          } else if (data.type === 'tournament_started') {
            setTournament(data.data);
            Alert.alert('Tournament Started!', 'Good luck!');
          } else if (data.type === 'player_eliminated') {
            Alert.alert(
              'Player Eliminated!',
              `${data.data.eliminator_username || 'Someone'} knocked out ${data.data.eliminated_username}\nBounty: ${data.data.bounty_awarded} BL`
            );
          } else if (data.type === 'tournament_ended') {
            Alert.alert('Tournament Ended!', `Winner: ${data.data.winner?.username || 'Unknown'}`);
          } else if (data.type === 'pot_awarded') {
            if (data.data.user_id === user?.user_id) {
              Alert.alert('You Won!', `${data.data.amount} BL (${data.data.hand_name})`);
            }
          }
        } catch (e) {
          console.error('WebSocket message parse error:', e);
        }
      };

      wsRef.current.onerror = (error) => {
        console.error('WebSocket error:', error);
      };

      wsRef.current.onclose = () => {
        console.log('WebSocket disconnected');
      };
    } catch (e) {
      console.error('WebSocket connection error:', e);
    }

    // Polling fallback for game state
    const pollInterval = setInterval(() => {
      if (!wsRef.current || wsRef.current.readyState !== WebSocket.OPEN) {
        loadTournament();
      }
    }, 5000);

    return () => {
      clearInterval(pollInterval);
      if (wsRef.current) {
        wsRef.current.close();
      }
    };
  }, [tournamentId, token]);

  // Handle player action
  const handleAction = async (action, amount = 0) => {
    if (actionLoading) return;
    
    setActionLoading(true);
    try {
      console.log(`Sending action: ${action} with amount: ${amount}`);
      await pokerAPI.playerAction(tournamentId, action, amount);
      
      // Refresh tournament state
      setTimeout(loadTournament, 500);
    } catch (error) {
      const errorMsg = error.response?.data?.detail || 'Action failed';
      console.error('Action error:', errorMsg);
      Alert.alert('Error', errorMsg);
    } finally {
      setActionLoading(false);
    }
  };

  // Handle add bots
  const handleAddBots = async (count) => {
    if (!tournament) return;
    
    const currentPlayers = Object.keys(tournament.players || {}).length;
    const availableSeats = 10 - currentPlayers;
    
    if (availableSeats <= 0) {
      Alert.alert('Table Full', 'The table is already full with 10 players.');
      return;
    }
    
    const botsToAdd = Math.min(count, availableSeats);
    
    try {
      const result = await pokerAPI.addBots(tournamentId, botsToAdd);
      const added = result.bots_added || 0;
      
      if (added > 0) {
        Alert.alert('Bots Added', `Successfully added ${added} AI bot${added > 1 ? 's' : ''}!`);
        loadTournament();
      } else {
        Alert.alert('No Bots Added', 'Could not add bots. The table may be full.');
      }
    } catch (error) {
      Alert.alert('Error', error.response?.data?.detail || 'Failed to add bots');
    }
  };

  // Handle force start
  const handleForceStart = async () => {
    try {
      await pokerAPI.forceStart(tournamentId);
      Alert.alert('Tournament Started!', 'Let the games begin!');
      loadTournament();
    } catch (error) {
      Alert.alert('Error', error.response?.data?.detail || 'Failed to start tournament');
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

  // Handle chat
  const handleSendChat = async () => {
    if (!chatMessage.trim()) return;
    
    try {
      await pokerAPI.sendChat(tournamentId, chatMessage);
      setChatMessage('');
      loadTournament();
    } catch (e) {
      console.error('Chat error:', e);
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
  const canAct = isMyTurn && !myPlayer?.is_folded && myPlayer?.is_active && !myPlayer?.is_all_in;
  const isCreator = tournament?.creator_id === user?.user_id;
  const isRegistering = tournament?.status === 'registering';
  const currentBet = tournament?.current_bet || 0;
  const myCurrentBet = myPlayer?.current_bet || 0;
  const toCall = currentBet - myCurrentBet;
  const minRaise = tournament?.min_raise || tournament?.big_blind || 50;

  // Waiting room view
  if (isRegistering) {
    return (
      <SafeAreaView style={styles.container} edges={['top', 'left', 'right']}>
        <StatusBar barStyle="light-content" />
        <LinearGradient colors={['#0F172A', '#1E293B']} style={styles.gradient}>
          <ScrollView contentContainerStyle={styles.waitingContent}>
            <Text style={styles.waitingTitle}>⏳ Waiting for Players</Text>
            <Text style={styles.waitingCount}>{tournament?.player_count || 0}/10</Text>

            {/* Players list */}
            <View style={styles.playersList}>
              {players.map((p) => (
                <View key={p.user_id} style={[styles.waitingPlayer, p.is_bot && styles.botPlayer]}>
                  <Text style={styles.waitingPlayerName}>
                    {p.username} {p.is_bot && '🤖'} {p.user_id === user?.user_id && '(You)'}
                  </Text>
                  {p.is_bot && <Text style={styles.botSkill}>{p.bot_personality}</Text>}
                </View>
              ))}
              {/* Empty seats */}
              {Array(10 - (tournament?.player_count || 0)).fill(null).map((_, i) => (
                <View key={`empty-${i}`} style={styles.emptySeatWaiting}>
                  <Text style={styles.emptySeatText}>Empty Seat</Text>
                </View>
              ))}
            </View>

            {/* Add bots (creator only) */}
            {isCreator && tournament.player_count < 10 && (
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
                
                {/* Force start button */}
                {tournament.player_count >= 2 && (
                  <TouchableOpacity style={styles.forceStartBtn} onPress={handleForceStart}>
                    <Text style={styles.forceStartBtnText}>Force Start Tournament</Text>
                  </TouchableOpacity>
                )}
              </View>
            )}

            <TouchableOpacity style={styles.backButton} onPress={() => navigation.goBack()}>
              <Text style={styles.backButtonText}>← Leave Lobby</Text>
            </TouchableOpacity>
          </ScrollView>
        </LinearGradient>
      </SafeAreaView>
    );
  }

  // Game view
  return (
    <View style={[styles.tableContainer, { paddingTop: insets.top }]}>
      <StatusBar barStyle="light-content" />
      <LinearGradient colors={['#0F172A', '#064E3B', '#0F172A']} style={styles.tableGradient}>
        <ScrollView 
          contentContainerStyle={[styles.tableScrollContent, { paddingBottom: 100 }]} 
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
        >
          {/* Header Info */}
          <View style={styles.tableHeader}>
            <View>
              <Text style={styles.blindsText}>Blinds: {tournament?.small_blind}/{tournament?.big_blind}</Text>
              <Text style={styles.levelText}>Level {(tournament?.blind_level || 0) + 1}</Text>
            </View>
            <View style={styles.potContainer}>
              <Text style={styles.potLabel}>POT</Text>
              <Text style={styles.potValue}>{tournament?.pot?.toLocaleString() || 0}</Text>
            </View>
            <View>
              <Text style={styles.handText}>Hand #{tournament?.hand_number || 0}</Text>
              <Text style={styles.phaseText}>{tournament?.phase?.toUpperCase() || 'WAITING'}</Text>
            </View>
          </View>

          {/* Community Cards */}
          <View style={styles.communityCards}>
            {tournament?.community_cards?.map((card, i) => (
              <Card key={i} card={card} style={styles.communityCard} />
            ))}
            {Array(5 - (tournament?.community_cards?.length || 0)).fill(null).map((_, i) => (
              <View key={`empty-${i}`} style={styles.emptyCard} />
            ))}
          </View>

          {/* Players around table */}
          <View style={styles.playersContainer}>
            {players.map((player) => (
              <PlayerSeat
                key={player.user_id}
                player={player}
                isCurrentTurn={tournament?.current_player_seat === player.seat}
                isDealer={tournament?.dealer_seat === player.seat}
                isSB={tournament?.small_blind_seat === player.seat}
                isBB={tournament?.big_blind_seat === player.seat}
                isMe={player.user_id === user?.user_id}
                showCards={tournament?.phase === 'showdown' || tournament?.phase === 'hand_complete'}
              />
            ))}
          </View>

          {/* My Cards & Actions */}
          {myPlayer && (
            <View style={styles.mySection}>
              {/* Turn indicator */}
              {isMyTurn && !myPlayer.is_folded && (
                <View style={styles.turnIndicator}>
                  <Text style={styles.turnIndicatorText}>🎯 YOUR TURN!</Text>
                </View>
              )}

              {/* My hole cards (larger) */}
              <View style={styles.myCards}>
                <Text style={styles.myCardsLabel}>Your Cards:</Text>
                <View style={styles.myCardsRow}>
                  {myPlayer.cards?.map((card, i) => (
                    <Card key={i} card={card} style={styles.myCard} />
                  ))}
                </View>
              </View>

              {/* Action buttons - Always show when it's my turn */}
              {canAct && (
                <View style={styles.actionsContainer}>
                  <View style={styles.actionButtonsRow}>
                    <TouchableOpacity
                      style={[styles.actionButton, styles.foldButton]}
                      onPress={() => handleAction('fold')}
                      disabled={actionLoading}
                      activeOpacity={0.7}
                    >
                      <Text style={styles.actionButtonText}>FOLD</Text>
                    </TouchableOpacity>

                    {toCall <= 0 ? (
                      <TouchableOpacity
                        style={[styles.actionButton, styles.checkButton]}
                        onPress={() => handleAction('check')}
                        disabled={actionLoading}
                        activeOpacity={0.7}
                      >
                        <Text style={styles.actionButtonText}>CHECK</Text>
                      </TouchableOpacity>
                    ) : (
                      <TouchableOpacity
                        style={[styles.actionButton, styles.callButton]}
                        onPress={() => handleAction('call')}
                        disabled={actionLoading}
                        activeOpacity={0.7}
                      >
                        <Text style={styles.actionButtonText}>CALL {toCall}</Text>
                      </TouchableOpacity>
                    )}
                  </View>

                  {/* Raise section */}
                  <View style={styles.raiseSection}>
                    <TextInput
                      style={styles.betInput}
                      value={String(betAmount)}
                      onChangeText={(t) => setBetAmount(parseInt(t) || minRaise)}
                      keyboardType="number-pad"
                      placeholder="Amount"
                      placeholderTextColor="#666"
                    />
                    <TouchableOpacity
                      style={[styles.actionButton, styles.raiseButton]}
                      onPress={() => handleAction('raise', betAmount)}
                      disabled={actionLoading || betAmount < currentBet + minRaise}
                      activeOpacity={0.7}
                    >
                      <Text style={styles.actionButtonText}>RAISE</Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                      style={[styles.actionButton, styles.allInButton]}
                      onPress={() => handleAction('all_in')}
                      disabled={actionLoading}
                      activeOpacity={0.7}
                    >
                      <Text style={styles.actionButtonText}>ALL IN</Text>
                    </TouchableOpacity>
                  </View>
                </View>
              )}

              {/* Show waiting message when not your turn */}
              {!canAct && myPlayer && !myPlayer.is_folded && (
                <View style={styles.waitingMessage}>
                  <Text style={styles.waitingMessageText}>
                    {myPlayer.is_all_in ? '🔥 You are ALL IN!' : '⏳ Waiting for your turn...'}
                  </Text>
                </View>
              )}

              {/* Folded message */}
              {myPlayer && myPlayer.is_folded && (
                <View style={styles.foldedMessage}>
                  <Text style={styles.foldedMessageText}>You folded this hand</Text>
                </View>
              )}

              {/* Rebuy option */}
              {tournament?.rebuy_available && myPlayer && myPlayer.chips === 0 && !myPlayer.is_active && (
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
              activeOpacity={0.7}
            >
              <Text style={styles.chatToggleText}>
                💬 Chat {showChat ? '▼' : '▲'}
              </Text>
            </TouchableOpacity>
            
            {showChat && (
              <View style={styles.chatContainer}>
                <ScrollView style={styles.chatMessages}>
                  {tournament?.chat_messages?.length === 0 && (
                    <Text style={styles.noChatText}>No messages yet. Say hello!</Text>
                  )}
                  {tournament?.chat_messages?.map((msg, idx) => (
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
                  <TouchableOpacity style={styles.chatSendBtn} onPress={handleSendChat}>
                    <Text style={styles.chatSendText}>Send</Text>
                  </TouchableOpacity>
                </View>
              </View>
            )}
          </View>
        </ScrollView>

        {/* Exit button - Fixed position */}
        <TouchableOpacity 
          style={[styles.exitButton, { top: insets.top + 10 }]} 
          onPress={() => navigation.goBack()}
          activeOpacity={0.7}
        >
          <Text style={styles.exitButtonText}>← EXIT</Text>
        </TouchableOpacity>

        {/* Loading overlay */}
        {actionLoading && (
          <View style={styles.loadingOverlay}>
            <ActivityIndicator size="large" color="#fff" />
          </View>
        )}
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
  lobbyContent: {
    paddingBottom: 40,
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
  leaveTournamentBtn: {
    marginTop: 12,
    padding: 10,
    backgroundColor: 'rgba(239, 68, 68, 0.2)',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#EF4444',
    alignItems: 'center',
  },
  leaveTournamentText: {
    color: '#EF4444',
    fontWeight: '600',
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
  waitingContent: {
    flexGrow: 1,
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
  forceStartBtn: {
    marginTop: 16,
    padding: 14,
    backgroundColor: '#22C55E',
    borderRadius: 8,
    alignItems: 'center',
  },
  forceStartBtnText: {
    color: '#fff',
    fontWeight: 'bold',
    fontSize: 16,
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
    backgroundColor: '#0F172A',
  },
  tableGradient: {
    flex: 1,
  },
  tableScrollContent: {
    flexGrow: 1,
    padding: 16,
    paddingTop: 50,
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
    paddingHorizontal: 16,
  },
  turnIndicator: {
    backgroundColor: '#22C55E',
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 20,
    marginBottom: 10,
  },
  turnIndicatorText: {
    color: '#fff',
    fontWeight: 'bold',
    fontSize: 16,
  },
  myCards: {
    alignItems: 'center',
    marginBottom: 16,
  },
  myCardsLabel: {
    color: '#94A3B8',
    fontSize: 12,
    marginBottom: 8,
  },
  myCardsRow: {
    flexDirection: 'row',
    gap: 8,
  },
  myCard: {
    width: 60,
    height: 84,
  },
  actionsContainer: {
    width: '100%',
    backgroundColor: 'rgba(0,0,0,0.3)',
    borderRadius: 16,
    padding: 16,
  },
  actionButtonsRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 12,
    marginBottom: 12,
  },
  actionButton: {
    paddingHorizontal: 20,
    paddingVertical: 14,
    borderRadius: 10,
    minWidth: 80,
    alignItems: 'center',
    justifyContent: 'center',
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
    fontSize: 14,
  },
  raiseSection: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  betInput: {
    width: 80,
    height: 46,
    backgroundColor: '#fff',
    borderRadius: 10,
    paddingHorizontal: 12,
    textAlign: 'center',
    fontSize: 16,
    fontWeight: 'bold',
  },
  waitingMessage: {
    backgroundColor: 'rgba(59, 130, 246, 0.2)',
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderRadius: 10,
  },
  waitingMessageText: {
    color: '#3B82F6',
    fontSize: 14,
    fontWeight: '500',
  },
  foldedMessage: {
    backgroundColor: 'rgba(239, 68, 68, 0.2)',
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderRadius: 10,
  },
  foldedMessageText: {
    color: '#EF4444',
    fontSize: 14,
    fontWeight: '500',
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
    left: 16,
    padding: 10,
    backgroundColor: 'rgba(0,0,0,0.5)',
    borderRadius: 8,
    zIndex: 100,
  },
  exitButtonText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '600',
  },
  loadingOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 1000,
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
    paddingVertical: 8,
    borderRadius: 8,
    justifyContent: 'center',
  },
  chatSendText: {
    color: '#fff',
    fontWeight: '600',
    fontSize: 13,
  },
});
