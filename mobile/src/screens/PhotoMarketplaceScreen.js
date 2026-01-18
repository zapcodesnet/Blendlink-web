/**
 * Photo Marketplace Screen for Blendlink Mobile
 * Buy, sell, and trade minted photos
 */

import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  FlatList,
  Dimensions,
  ActivityIndicator,
  RefreshControl,
  TextInput,
  Modal,
  Animated,
  Vibration,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import { useAuth } from '../context/AuthContext';
import { useTheme } from '../context/ThemeContext';
import { photoMarketplaceAPI, mintingAPI, walletAPI } from '../services/api';

const { width } = Dimensions.get('window');
const CARD_WIDTH = (width - 48) / 2;

// Scenery config
const SCENERY_CONFIG = {
  natural: { gradient: ['#22C55E', '#10B981'], emoji: '🌿', label: 'Natural' },
  water: { gradient: ['#3B82F6', '#06B6D4'], emoji: '🌊', label: 'Water' },
  manmade: { gradient: ['#F97316', '#EF4444'], emoji: '🏙️', label: 'Man-made' },
};

// Format dollar value
const formatDollarValue = (value) => {
  if (!value) return '$0';
  if (value >= 1_000_000_000) return `$${(value / 1_000_000_000).toFixed(2)}B`;
  if (value >= 1_000_000) return `$${(value / 1_000_000).toFixed(1)}M`;
  return `$${value.toLocaleString()}`;
};

// Format BL coins
const formatBLCoins = (value) => {
  if (!value) return '0';
  if (value >= 1_000_000) return `${(value / 1_000_000).toFixed(1)}M`;
  if (value >= 1_000) return `${(value / 1_000).toFixed(1)}K`;
  return value.toLocaleString();
};

// ============== COMPONENTS ==============

// Listing Card
const ListingCard = ({ listing, onPress, colors }) => {
  const photo = listing.asset_data || {};
  const scenery = SCENERY_CONFIG[photo.scenery_type] || SCENERY_CONFIG.natural;
  const scaleAnim = useRef(new Animated.Value(1)).current;

  const handlePress = () => {
    Animated.sequence([
      Animated.timing(scaleAnim, { toValue: 0.95, duration: 100, useNativeDriver: true }),
      Animated.timing(scaleAnim, { toValue: 1, duration: 100, useNativeDriver: true }),
    ]).start();
    onPress?.(listing);
  };

  return (
    <TouchableOpacity onPress={handlePress} activeOpacity={0.8}>
      <Animated.View
        style={[
          styles.listingCard,
          { backgroundColor: colors.card, borderColor: colors.border, transform: [{ scale: scaleAnim }] },
        ]}
      >
        {/* Image */}
        <View style={[styles.listingCardImage, { backgroundColor: scenery.gradient[0] }]}>
          <Text style={styles.listingCardEmoji}>{scenery.emoji}</Text>
          
          {/* Type Badge */}
          <View style={[styles.listingTypeBadge, { backgroundColor: listing.listing_type === 'auction' ? colors.gold : colors.primary }]}>
            <Text style={styles.listingTypeBadgeText}>
              {listing.listing_type === 'auction' ? '🔨 Auction' : '💰 Buy Now'}
            </Text>
          </View>
          
          {/* Scenery Badge */}
          <View style={[styles.sceneryBadge, { backgroundColor: scenery.gradient[0] }]}>
            <Text style={styles.sceneryBadgeText}>{scenery.label}</Text>
          </View>
        </View>
        
        {/* Info */}
        <View style={styles.listingCardInfo}>
          <Text style={[styles.listingCardName, { color: colors.text }]} numberOfLines={1}>
            {photo.name || 'Photo'}
          </Text>
          
          <View style={styles.listingPriceRow}>
            <Text style={[styles.listingPrice, { color: colors.gold }]}>
              💰 {formatBLCoins(listing.price)} BL
            </Text>
          </View>
          
          <View style={styles.listingStatsRow}>
            <Text style={[styles.listingStatText, { color: colors.textMuted }]}>
              ⚡ {photo.power?.toFixed(0) || 100}
            </Text>
            <Text style={[styles.listingStatText, { color: colors.textMuted }]}>
              📈 {formatDollarValue(photo.dollar_value)}
            </Text>
          </View>
          
          {listing.highest_bid && (
            <View style={[styles.bidBadge, { backgroundColor: colors.success + '20' }]}>
              <Text style={[styles.bidBadgeText, { color: colors.success }]}>
                Bid: {formatBLCoins(listing.highest_bid)} BL
              </Text>
            </View>
          )}
        </View>
      </Animated.View>
    </TouchableOpacity>
  );
};

// Filter Tabs
const FilterTabs = ({ activeFilter, onFilterChange, colors }) => {
  const filters = [
    { id: 'all', label: 'All' },
    { id: 'fixed', label: 'Buy Now' },
    { id: 'auction', label: 'Auctions' },
  ];

  return (
    <View style={styles.filterTabs}>
      {filters.map((filter) => (
        <TouchableOpacity
          key={filter.id}
          style={[
            styles.filterTab,
            { backgroundColor: activeFilter === filter.id ? colors.primary : colors.card },
          ]}
          onPress={() => onFilterChange(filter.id)}
        >
          <Text
            style={[
              styles.filterTabText,
              { color: activeFilter === filter.id ? '#fff' : colors.textMuted },
            ]}
          >
            {filter.label}
          </Text>
        </TouchableOpacity>
      ))}
    </View>
  );
};

// Listing Detail Modal
const ListingDetailModal = ({ visible, listing, onClose, onBuy, onMakeOffer, balance, colors }) => {
  const [offerAmount, setOfferAmount] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [mode, setMode] = useState('view');

  if (!listing) return null;

  const photo = listing.asset_data || {};
  const scenery = SCENERY_CONFIG[photo.scenery_type] || SCENERY_CONFIG.natural;
  const canAfford = balance >= listing.price;

  const handleBuy = async () => {
    setIsSubmitting(true);
    try {
      await onBuy(listing.listing_id);
      Vibration.vibrate([100, 100, 100]);
      onClose();
    } catch (err) {
      alert(err.message || 'Purchase failed');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleMakeOffer = async () => {
    const amount = parseInt(offerAmount);
    if (!amount || amount <= 0) {
      alert('Please enter a valid offer amount');
      return;
    }
    if (amount > balance) {
      alert('Insufficient balance');
      return;
    }
    
    setIsSubmitting(true);
    try {
      await onMakeOffer(listing.listing_id, amount);
      Vibration.vibrate([100, 100]);
      onClose();
    } catch (err) {
      alert(err.message || 'Offer failed');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Modal visible={visible} animationType="slide" transparent>
      <View style={styles.modalOverlay}>
        <View style={[styles.modalContent, { backgroundColor: colors.card }]}>
          <View style={styles.modalHeader}>
            <Text style={[styles.modalTitle, { color: colors.text }]}>📸 {photo.name || 'Photo'}</Text>
            <TouchableOpacity onPress={onClose}>
              <Text style={[styles.modalClose, { color: colors.textMuted }]}>✕</Text>
            </TouchableOpacity>
          </View>

          <ScrollView showsVerticalScrollIndicator={false}>
            {/* Photo Preview */}
            <View style={[styles.modalPhotoPreview, { backgroundColor: scenery.gradient[0] }]}>
              <Text style={styles.modalPhotoEmoji}>{scenery.emoji}</Text>
              <View style={[styles.modalSceneryBadge, { backgroundColor: 'rgba(0,0,0,0.3)' }]}>
                <Text style={styles.modalSceneryBadgeText}>{scenery.label}</Text>
              </View>
            </View>

            {/* Stats Grid */}
            <View style={styles.statsGrid}>
              <View style={[styles.statBox, { backgroundColor: colors.cardSecondary }]}>
                <Text style={styles.statBoxIcon}>⚡</Text>
                <Text style={[styles.statBoxValue, { color: colors.text }]}>{photo.power?.toFixed(0) || 100}</Text>
                <Text style={[styles.statBoxLabel, { color: colors.textMuted }]}>Power</Text>
              </View>
              <View style={[styles.statBox, { backgroundColor: colors.cardSecondary }]}>
                <Text style={styles.statBoxIcon}>📈</Text>
                <Text style={[styles.statBoxValue, { color: colors.gold }]}>{formatDollarValue(photo.dollar_value)}</Text>
                <Text style={[styles.statBoxLabel, { color: colors.textMuted }]}>Value</Text>
              </View>
              <View style={[styles.statBox, { backgroundColor: colors.cardSecondary }]}>
                <Text style={styles.statBoxIcon}>🎖️</Text>
                <Text style={[styles.statBoxValue, { color: colors.text }]}>Lvl {photo.level || 1}</Text>
                <Text style={[styles.statBoxLabel, { color: colors.textMuted }]}>Level</Text>
              </View>
            </View>

            {/* Strength/Weakness */}
            <View style={styles.strengthWeaknessContainer}>
              <View style={[styles.swRow, { backgroundColor: colors.success + '20' }]}>
                <Text style={[styles.swLabel, { color: colors.success }]}>💪 Strong vs:</Text>
                <Text style={[styles.swValue, { color: colors.success }]}>
                  {SCENERY_CONFIG[photo.strength_vs]?.label || 'Water'} (+25%)
                </Text>
              </View>
              <View style={[styles.swRow, { backgroundColor: colors.error + '20' }]}>
                <Text style={[styles.swLabel, { color: colors.error }]}>📉 Weak vs:</Text>
                <Text style={[styles.swValue, { color: colors.error }]}>
                  {SCENERY_CONFIG[photo.weakness_vs]?.label || 'Man-made'} (-25%)
                </Text>
              </View>
            </View>

            {/* Price Info */}
            <View style={[styles.priceContainer, { backgroundColor: colors.cardSecondary }]}>
              <View style={styles.priceRow}>
                <Text style={[styles.priceLabel, { color: colors.textMuted }]}>
                  {listing.listing_type === 'auction' ? 'Starting Price:' : 'Price:'}
                </Text>
                <Text style={[styles.priceValue, { color: colors.gold }]}>
                  💰 {formatBLCoins(listing.price)} BL
                </Text>
              </View>
              {listing.highest_bid && (
                <View style={styles.priceRow}>
                  <Text style={[styles.priceLabel, { color: colors.textMuted }]}>Highest Bid:</Text>
                  <Text style={[styles.priceValue, { color: colors.success }]}>
                    💰 {formatBLCoins(listing.highest_bid)} BL
                  </Text>
                </View>
              )}
              <View style={styles.priceRow}>
                <Text style={[styles.priceLabel, { color: colors.textMuted }]}>Your Balance:</Text>
                <Text style={[styles.priceValue, { color: canAfford ? colors.text : colors.error }]}>
                  💰 {formatBLCoins(balance)} BL
                </Text>
              </View>
            </View>

            {/* Platform Fee Notice */}
            <View style={[styles.feeNotice, { backgroundColor: colors.cardSecondary }]}>
              <Text style={[styles.feeNoticeText, { color: colors.textMuted }]}>
                ℹ️ 8% platform fee applied to all sales
              </Text>
            </View>

            {/* Action Buttons */}
            {mode === 'view' && (
              <View style={styles.actionButtons}>
                {listing.listing_type === 'fixed' ? (
                  <TouchableOpacity
                    style={[
                      styles.buyButton,
                      { opacity: canAfford && !isSubmitting ? 1 : 0.5 },
                    ]}
                    onPress={handleBuy}
                    disabled={!canAfford || isSubmitting}
                  >
                    {isSubmitting ? (
                      <ActivityIndicator color="#fff" />
                    ) : (
                      <Text style={styles.buyButtonText}>💰 Buy Now</Text>
                    )}
                  </TouchableOpacity>
                ) : (
                  <TouchableOpacity
                    style={styles.bidButton}
                    onPress={() => setMode('offer')}
                  >
                    <Text style={styles.bidButtonText}>🔨 Place Bid</Text>
                  </TouchableOpacity>
                )}
                
                <TouchableOpacity
                  style={[styles.offerButton, { borderColor: colors.border }]}
                  onPress={() => setMode('offer')}
                >
                  <Text style={[styles.offerButtonText, { color: colors.text }]}>💬 Make Offer</Text>
                </TouchableOpacity>
              </View>
            )}

            {mode === 'offer' && (
              <View style={styles.offerForm}>
                <Text style={[styles.offerFormTitle, { color: colors.text }]}>Enter Offer Amount</Text>
                <TextInput
                  style={[styles.offerInput, { backgroundColor: colors.cardSecondary, color: colors.text, borderColor: colors.border }]}
                  value={offerAmount}
                  onChangeText={setOfferAmount}
                  keyboardType="numeric"
                  placeholder="Enter BL amount"
                  placeholderTextColor={colors.textMuted}
                />
                <View style={styles.offerFormButtons}>
                  <TouchableOpacity
                    style={[styles.offerCancelButton, { borderColor: colors.border }]}
                    onPress={() => setMode('view')}
                  >
                    <Text style={[styles.offerCancelButtonText, { color: colors.textMuted }]}>Cancel</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={[styles.offerSubmitButton, { opacity: isSubmitting ? 0.5 : 1 }]}
                    onPress={handleMakeOffer}
                    disabled={isSubmitting}
                  >
                    {isSubmitting ? (
                      <ActivityIndicator color="#fff" />
                    ) : (
                      <Text style={styles.offerSubmitButtonText}>Submit Offer</Text>
                    )}
                  </TouchableOpacity>
                </View>
              </View>
            )}
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
};

// Create Listing Modal
const CreateListingModal = ({ visible, onClose, onSubmit, myPhotos, colors }) => {
  const [selectedPhoto, setSelectedPhoto] = useState(null);
  const [price, setPrice] = useState('');
  const [listingType, setListingType] = useState('fixed');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async () => {
    if (!selectedPhoto || !price) {
      alert('Please select a photo and enter a price');
      return;
    }

    setIsSubmitting(true);
    try {
      await onSubmit({
        asset_type: 'photo',
        asset_id: selectedPhoto.mint_id,
        listing_type: listingType,
        price: parseInt(price),
      });
      Vibration.vibrate([100, 100]);
      onClose();
      setSelectedPhoto(null);
      setPrice('');
    } catch (err) {
      alert(err.message || 'Failed to create listing');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Modal visible={visible} animationType="slide" transparent>
      <View style={styles.modalOverlay}>
        <View style={[styles.modalContent, { backgroundColor: colors.card }]}>
          <View style={styles.modalHeader}>
            <Text style={[styles.modalTitle, { color: colors.text }]}>📤 Create Listing</Text>
            <TouchableOpacity onPress={onClose}>
              <Text style={[styles.modalClose, { color: colors.textMuted }]}>✕</Text>
            </TouchableOpacity>
          </View>

          <ScrollView showsVerticalScrollIndicator={false}>
            {/* Select Photo */}
            <Text style={[styles.formLabel, { color: colors.text }]}>Select Photo</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.photoSelector}>
              {myPhotos.map((photo) => {
                const scenery = SCENERY_CONFIG[photo.scenery_type] || SCENERY_CONFIG.natural;
                const isSelected = selectedPhoto?.mint_id === photo.mint_id;
                return (
                  <TouchableOpacity
                    key={photo.mint_id}
                    style={[
                      styles.photoSelectorItem,
                      {
                        backgroundColor: scenery.gradient[0],
                        borderColor: isSelected ? colors.primary : 'transparent',
                        borderWidth: isSelected ? 3 : 0,
                      },
                    ]}
                    onPress={() => setSelectedPhoto(photo)}
                  >
                    <Text style={styles.photoSelectorEmoji}>{scenery.emoji}</Text>
                    <Text style={styles.photoSelectorName} numberOfLines={1}>{photo.name}</Text>
                  </TouchableOpacity>
                );
              })}
            </ScrollView>

            {/* Listing Type */}
            <Text style={[styles.formLabel, { color: colors.text }]}>Listing Type</Text>
            <View style={styles.listingTypeSelector}>
              <TouchableOpacity
                style={[
                  styles.listingTypeOption,
                  { backgroundColor: listingType === 'fixed' ? colors.primary : colors.cardSecondary },
                ]}
                onPress={() => setListingType('fixed')}
              >
                <Text style={[styles.listingTypeText, { color: listingType === 'fixed' ? '#fff' : colors.textMuted }]}>
                  💰 Fixed Price
                </Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[
                  styles.listingTypeOption,
                  { backgroundColor: listingType === 'auction' ? colors.gold : colors.cardSecondary },
                ]}
                onPress={() => setListingType('auction')}
              >
                <Text style={[styles.listingTypeText, { color: listingType === 'auction' ? '#fff' : colors.textMuted }]}>
                  🔨 Auction
                </Text>
              </TouchableOpacity>
            </View>

            {/* Price */}
            <Text style={[styles.formLabel, { color: colors.text }]}>
              {listingType === 'auction' ? 'Starting Price' : 'Price'} (BL Coins)
            </Text>
            <TextInput
              style={[styles.priceInput, { backgroundColor: colors.cardSecondary, color: colors.text, borderColor: colors.border }]}
              value={price}
              onChangeText={setPrice}
              keyboardType="numeric"
              placeholder="Enter amount"
              placeholderTextColor={colors.textMuted}
            />

            {/* Fee Notice */}
            <View style={[styles.feeNotice, { backgroundColor: colors.cardSecondary }]}>
              <Text style={[styles.feeNoticeText, { color: colors.textMuted }]}>
                ℹ️ 8% platform fee will be deducted upon sale
              </Text>
            </View>

            {/* Submit Button */}
            <TouchableOpacity
              style={[
                styles.createListingButton,
                { opacity: selectedPhoto && price && !isSubmitting ? 1 : 0.5 },
              ]}
              onPress={handleSubmit}
              disabled={!selectedPhoto || !price || isSubmitting}
            >
              {isSubmitting ? (
                <ActivityIndicator color="#fff" />
              ) : (
                <Text style={styles.createListingButtonText}>📤 Create Listing</Text>
              )}
            </TouchableOpacity>
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
};

// ============== MAIN SCREEN ==============
export default function PhotoMarketplaceScreen() {
  const navigation = useNavigation();
  const { user } = useAuth();
  const { colors } = useTheme();

  const [listings, setListings] = useState([]);
  const [myPhotos, setMyPhotos] = useState([]);
  const [balance, setBalance] = useState(0);
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [activeFilter, setActiveFilter] = useState('all');
  const [selectedListing, setSelectedListing] = useState(null);
  const [showCreateModal, setShowCreateModal] = useState(false);

  const fetchData = async () => {
    try {
      const [listingsData, photosData, balanceData, statsData] = await Promise.all([
        photoMarketplaceAPI.getListings({
          listing_type: activeFilter !== 'all' ? activeFilter : undefined,
        }),
        mintingAPI.getMyPhotos(),
        walletAPI.getBalance(),
        photoMarketplaceAPI.getStats().catch(() => null),
      ]);
      
      setListings(listingsData.listings || []);
      setMyPhotos(photosData.photos || []);
      setBalance(balanceData.balance || 0);
      setStats(statsData);
    } catch (err) {
      console.error('Failed to fetch marketplace data:', err);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, [activeFilter]);

  const handleRefresh = () => {
    setRefreshing(true);
    fetchData();
  };

  const handleBuy = async (listingId) => {
    await photoMarketplaceAPI.buyListing(listingId);
    fetchData();
  };

  const handleMakeOffer = async (listingId, amount) => {
    await photoMarketplaceAPI.makeOffer(listingId, amount);
    fetchData();
  };

  const handleCreateListing = async (data) => {
    await photoMarketplaceAPI.createListing(data);
    fetchData();
  };

  const renderListing = ({ item }) => (
    <ListingCard
      listing={item}
      onPress={(listing) => setSelectedListing(listing)}
      colors={colors}
    />
  );

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]} edges={['top']}>
      {/* Header */}
      <View style={[styles.header, { backgroundColor: colors.card, borderBottomColor: colors.border }]}>
        <View style={styles.headerLeft}>
          <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton}>
            <Text style={[styles.backButtonText, { color: colors.text }]}>←</Text>
          </TouchableOpacity>
          <View>
            <Text style={[styles.headerTitle, { color: colors.text }]}>🏪 Marketplace</Text>
            <Text style={[styles.headerSubtitle, { color: colors.textMuted }]}>Photo Trading</Text>
          </View>
        </View>
        <View style={[styles.balanceChip, { backgroundColor: colors.gold + '20' }]}>
          <Text style={[styles.balanceText, { color: colors.gold }]}>💰 {formatBLCoins(balance)} BL</Text>
        </View>
      </View>

      {/* Stats */}
      {stats && (
        <View style={[styles.statsContainer, { backgroundColor: colors.card, borderBottomColor: colors.border }]}>
          <View style={[styles.statCard, { backgroundColor: colors.cardSecondary }]}>
            <Text style={[styles.statValue, { color: colors.text }]}>{stats.total_listings || 0}</Text>
            <Text style={[styles.statLabel, { color: colors.textMuted }]}>Listings</Text>
          </View>
          <View style={[styles.statCard, { backgroundColor: colors.cardSecondary }]}>
            <Text style={[styles.statValue, { color: colors.gold }]}>{formatBLCoins(stats.total_volume || 0)}</Text>
            <Text style={[styles.statLabel, { color: colors.textMuted }]}>Volume</Text>
          </View>
          <View style={[styles.statCard, { backgroundColor: colors.cardSecondary }]}>
            <Text style={[styles.statValue, { color: colors.success }]}>{stats.sales_today || 0}</Text>
            <Text style={[styles.statLabel, { color: colors.textMuted }]}>Today</Text>
          </View>
        </View>
      )}

      {/* Filter Tabs */}
      <View style={styles.filterContainer}>
        <FilterTabs activeFilter={activeFilter} onFilterChange={setActiveFilter} colors={colors} />
      </View>

      {/* Listings */}
      {loading ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={colors.primary} />
        </View>
      ) : listings.length === 0 ? (
        <View style={styles.emptyContainer}>
          <Text style={styles.emptyIcon}>🏪</Text>
          <Text style={[styles.emptyTitle, { color: colors.text }]}>No Listings Found</Text>
          <Text style={[styles.emptyText, { color: colors.textMuted }]}>
            Be the first to list your photos!
          </Text>
          <TouchableOpacity
            style={styles.emptyCreateButton}
            onPress={() => setShowCreateModal(true)}
          >
            <Text style={styles.emptyCreateButtonText}>📤 Create Listing</Text>
          </TouchableOpacity>
        </View>
      ) : (
        <FlatList
          data={listings}
          renderItem={renderListing}
          keyExtractor={(item) => item.listing_id}
          numColumns={2}
          columnWrapperStyle={styles.listingsRow}
          contentContainerStyle={styles.listingsContent}
          showsVerticalScrollIndicator={false}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={handleRefresh}
              tintColor={colors.primary}
            />
          }
        />
      )}

      {/* FAB */}
      <TouchableOpacity
        style={styles.fab}
        onPress={() => setShowCreateModal(true)}
        activeOpacity={0.8}
      >
        <Text style={styles.fabIcon}>+</Text>
      </TouchableOpacity>

      {/* Listing Detail Modal */}
      <ListingDetailModal
        visible={!!selectedListing}
        listing={selectedListing}
        onClose={() => setSelectedListing(null)}
        onBuy={handleBuy}
        onMakeOffer={handleMakeOffer}
        balance={balance}
        colors={colors}
      />

      {/* Create Listing Modal */}
      <CreateListingModal
        visible={showCreateModal}
        onClose={() => setShowCreateModal(false)}
        onSubmit={handleCreateListing}
        myPhotos={myPhotos}
        colors={colors}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
  },
  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  backButton: {
    marginRight: 12,
    padding: 4,
  },
  backButtonText: {
    fontSize: 24,
    fontWeight: '600',
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: 'bold',
  },
  headerSubtitle: {
    fontSize: 12,
    marginTop: 2,
  },
  balanceChip: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
  },
  balanceText: {
    fontWeight: '600',
  },
  // Stats
  statsContainer: {
    flexDirection: 'row',
    padding: 12,
    borderBottomWidth: 1,
    gap: 8,
  },
  statCard: {
    flex: 1,
    alignItems: 'center',
    padding: 12,
    borderRadius: 12,
  },
  statValue: {
    fontSize: 18,
    fontWeight: 'bold',
  },
  statLabel: {
    fontSize: 10,
    marginTop: 2,
  },
  // Filter
  filterContainer: {
    padding: 12,
  },
  filterTabs: {
    flexDirection: 'row',
    gap: 8,
  },
  filterTab: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
  },
  filterTabText: {
    fontSize: 13,
    fontWeight: '600',
  },
  // Listings
  listingsContent: {
    padding: 12,
    paddingBottom: 100,
  },
  listingsRow: {
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  // Listing Card
  listingCard: {
    width: CARD_WIDTH,
    borderRadius: 16,
    overflow: 'hidden',
    borderWidth: 1,
  },
  listingCardImage: {
    width: '100%',
    aspectRatio: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  listingCardEmoji: {
    fontSize: 48,
    opacity: 0.5,
  },
  listingTypeBadge: {
    position: 'absolute',
    top: 8,
    left: 8,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
  },
  listingTypeBadgeText: {
    color: '#fff',
    fontSize: 10,
    fontWeight: 'bold',
  },
  sceneryBadge: {
    position: 'absolute',
    top: 8,
    right: 8,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
  },
  sceneryBadgeText: {
    color: '#fff',
    fontSize: 10,
    fontWeight: 'bold',
  },
  listingCardInfo: {
    padding: 12,
  },
  listingCardName: {
    fontSize: 14,
    fontWeight: '600',
    marginBottom: 4,
  },
  listingPriceRow: {
    marginBottom: 4,
  },
  listingPrice: {
    fontSize: 16,
    fontWeight: 'bold',
  },
  listingStatsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  listingStatText: {
    fontSize: 11,
  },
  bidBadge: {
    marginTop: 8,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
    alignSelf: 'flex-start',
  },
  bidBadgeText: {
    fontSize: 10,
    fontWeight: '600',
  },
  // Loading/Empty
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 32,
  },
  emptyIcon: {
    fontSize: 64,
    marginBottom: 16,
  },
  emptyTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    marginBottom: 8,
  },
  emptyText: {
    fontSize: 14,
    textAlign: 'center',
    marginBottom: 24,
  },
  emptyCreateButton: {
    backgroundColor: '#8B5CF6',
    paddingHorizontal: 24,
    paddingVertical: 14,
    borderRadius: 12,
  },
  emptyCreateButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  // FAB
  fab: {
    position: 'absolute',
    bottom: 100,
    right: 20,
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: '#8B5CF6',
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 8,
  },
  fabIcon: {
    color: '#fff',
    fontSize: 28,
    fontWeight: '300',
  },
  // Modal
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.6)',
    justifyContent: 'flex-end',
  },
  modalContent: {
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    padding: 20,
    maxHeight: '90%',
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: 'bold',
  },
  modalClose: {
    fontSize: 24,
    padding: 4,
  },
  modalPhotoPreview: {
    width: '100%',
    aspectRatio: 1.5,
    borderRadius: 16,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 16,
  },
  modalPhotoEmoji: {
    fontSize: 64,
    opacity: 0.5,
  },
  modalSceneryBadge: {
    position: 'absolute',
    bottom: 12,
    right: 12,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 12,
  },
  modalSceneryBadgeText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: 'bold',
  },
  statsGrid: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 16,
  },
  statBox: {
    flex: 1,
    alignItems: 'center',
    padding: 12,
    borderRadius: 12,
  },
  statBoxIcon: {
    fontSize: 16,
    marginBottom: 4,
  },
  statBoxValue: {
    fontSize: 16,
    fontWeight: 'bold',
  },
  statBoxLabel: {
    fontSize: 10,
    marginTop: 2,
  },
  strengthWeaknessContainer: {
    marginBottom: 16,
    gap: 8,
  },
  swRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    padding: 12,
    borderRadius: 12,
  },
  swLabel: {
    fontSize: 13,
    fontWeight: '600',
  },
  swValue: {
    fontSize: 13,
    fontWeight: '600',
  },
  priceContainer: {
    borderRadius: 12,
    padding: 12,
    marginBottom: 12,
  },
  priceRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 4,
  },
  priceLabel: {
    fontSize: 13,
  },
  priceValue: {
    fontSize: 15,
    fontWeight: 'bold',
  },
  feeNotice: {
    borderRadius: 12,
    padding: 12,
    marginBottom: 16,
  },
  feeNoticeText: {
    fontSize: 12,
    textAlign: 'center',
  },
  actionButtons: {
    gap: 12,
  },
  buyButton: {
    backgroundColor: '#22C55E',
    borderRadius: 12,
    paddingVertical: 16,
    alignItems: 'center',
  },
  buyButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: 'bold',
  },
  bidButton: {
    backgroundColor: '#F59E0B',
    borderRadius: 12,
    paddingVertical: 16,
    alignItems: 'center',
  },
  bidButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: 'bold',
  },
  offerButton: {
    borderRadius: 12,
    paddingVertical: 16,
    alignItems: 'center',
    borderWidth: 1,
  },
  offerButtonText: {
    fontSize: 16,
    fontWeight: 'bold',
  },
  offerForm: {
    gap: 12,
  },
  offerFormTitle: {
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 8,
  },
  offerInput: {
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 12,
    fontSize: 16,
    borderWidth: 1,
  },
  offerFormButtons: {
    flexDirection: 'row',
    gap: 12,
  },
  offerCancelButton: {
    flex: 1,
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: 'center',
    borderWidth: 1,
  },
  offerCancelButtonText: {
    fontSize: 14,
    fontWeight: '600',
  },
  offerSubmitButton: {
    flex: 1,
    backgroundColor: '#8B5CF6',
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: 'center',
  },
  offerSubmitButtonText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: 'bold',
  },
  // Create Listing Modal
  formLabel: {
    fontSize: 14,
    fontWeight: '600',
    marginBottom: 8,
    marginTop: 16,
  },
  photoSelector: {
    flexDirection: 'row',
    marginBottom: 8,
  },
  photoSelectorItem: {
    width: 100,
    height: 100,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 8,
  },
  photoSelectorEmoji: {
    fontSize: 32,
    marginBottom: 4,
  },
  photoSelectorName: {
    color: '#fff',
    fontSize: 10,
    fontWeight: '600',
    textAlign: 'center',
    paddingHorizontal: 4,
  },
  listingTypeSelector: {
    flexDirection: 'row',
    gap: 8,
  },
  listingTypeOption: {
    flex: 1,
    paddingVertical: 14,
    borderRadius: 12,
    alignItems: 'center',
  },
  listingTypeText: {
    fontSize: 14,
    fontWeight: '600',
  },
  priceInput: {
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 12,
    fontSize: 16,
    borderWidth: 1,
  },
  createListingButton: {
    backgroundColor: '#8B5CF6',
    borderRadius: 12,
    paddingVertical: 16,
    alignItems: 'center',
    marginTop: 16,
  },
  createListingButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: 'bold',
  },
});
