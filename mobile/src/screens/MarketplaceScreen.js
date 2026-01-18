/**
 * Marketplace Screen for Blendlink Mobile
 * Browse products, rentals, and services with access to AI Seller Tools
 */

import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  StyleSheet,
  RefreshControl,
  ActivityIndicator,
  Image,
  TextInput,
  FlatList,
  Dimensions,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import api from '../services/api';

const { width } = Dimensions.get('window');
const ITEM_WIDTH = (width - 48) / 2;

// Category data
const CATEGORIES = [
  { id: 'all', name: 'All', icon: '🛍️' },
  { id: 'electronics', name: 'Electronics', icon: '📱' },
  { id: 'fashion', name: 'Fashion', icon: '👕' },
  { id: 'home', name: 'Home', icon: '🏠' },
  { id: 'vehicles', name: 'Vehicles', icon: '🚗' },
  { id: 'sports', name: 'Sports', icon: '⚽' },
  { id: 'digital', name: 'Digital', icon: '💾' },
  { id: 'services', name: 'Services', icon: '🔧' },
];

// Listing Item Component
const ListingItem = ({ item, onPress }) => (
  <TouchableOpacity style={styles.listingItem} onPress={() => onPress(item)}>
    {item.images?.[0] || item.image ? (
      <Image 
        source={{ uri: item.images?.[0] || item.image }} 
        style={styles.listingImage}
        resizeMode="cover"
      />
    ) : (
      <View style={[styles.listingImage, styles.listingImagePlaceholder]}>
        <Text style={styles.placeholderEmoji}>📦</Text>
      </View>
    )}
    <View style={styles.listingInfo}>
      <Text style={styles.listingTitle} numberOfLines={2}>{item.title}</Text>
      <Text style={styles.listingPrice}>${item.price}</Text>
      <View style={styles.listingMeta}>
        <Text style={styles.listingCategory}>{item.category || 'Other'}</Text>
        {item.condition && (
          <View style={[styles.conditionBadge, item.condition === 'new' ? styles.conditionNew : styles.conditionUsed]}>
            <Text style={styles.conditionText}>{item.condition}</Text>
          </View>
        )}
      </View>
    </View>
  </TouchableOpacity>
);

// Category Chip Component
const CategoryChip = ({ category, active, onPress }) => (
  <TouchableOpacity 
    style={[styles.categoryChip, active && styles.categoryChipActive]}
    onPress={onPress}
  >
    <Text style={styles.categoryIcon}>{category.icon}</Text>
    <Text style={[styles.categoryName, active && styles.categoryNameActive]}>{category.name}</Text>
  </TouchableOpacity>
);

export default function MarketplaceScreen({ navigation }) {
  const [listings, setListings] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('all');

  const loadListings = useCallback(async () => {
    try {
      const params = new URLSearchParams();
      if (selectedCategory !== 'all') {
        params.append('category', selectedCategory);
      }
      if (searchQuery) {
        params.append('search', searchQuery);
      }
      
      const response = await api.get(`/marketplace/listings?${params.toString()}`);
      setListings(response.data.listings || response.data || []);
    } catch (error) {
      console.error('Failed to load listings:', error);
      // Use sample data if API fails
      setListings(getSampleListings());
    } finally {
      setIsLoading(false);
      setIsRefreshing(false);
    }
  }, [selectedCategory, searchQuery]);

  useEffect(() => {
    loadListings();
  }, [loadListings]);

  const handleRefresh = () => {
    setIsRefreshing(true);
    loadListings();
  };

  const handleSearch = (text) => {
    setSearchQuery(text);
  };

  const handleListingPress = (item) => {
    // Navigate to listing detail
    console.log('View listing:', item.listing_id);
  };

  const getSampleListings = () => [
    { listing_id: '1', title: 'iPhone 15 Pro Max', price: 999, category: 'electronics', condition: 'new' },
    { listing_id: '2', title: 'Vintage Leather Jacket', price: 150, category: 'fashion', condition: 'used' },
    { listing_id: '3', title: 'MacBook Pro M3', price: 1999, category: 'electronics', condition: 'new' },
    { listing_id: '4', title: 'Gaming Chair', price: 299, category: 'home', condition: 'new' },
    { listing_id: '5', title: 'Mountain Bike', price: 450, category: 'sports', condition: 'used' },
    { listing_id: '6', title: 'Web Development Service', price: 75, category: 'services', condition: 'new' },
  ];

  const filteredListings = listings.filter(item => {
    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      return item.title?.toLowerCase().includes(query) || 
             item.description?.toLowerCase().includes(query);
    }
    return true;
  });

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.headerTitle}>🛒 Marketplace</Text>
        <View style={styles.headerButtons}>
          <TouchableOpacity 
            style={styles.sellerToolsButton}
            onPress={() => navigation.navigate('SellerDashboard')}
          >
            <Text style={styles.sellerToolsIcon}>✨</Text>
            <Text style={styles.sellerToolsText}>AI Tools</Text>
          </TouchableOpacity>
          <TouchableOpacity 
            style={styles.sellButton}
            onPress={() => navigation.navigate('SellerDashboard')}
          >
            <Text style={styles.sellButtonText}>+ Sell</Text>
          </TouchableOpacity>
        </View>
      </View>

      {/* Photo Marketplace CTA */}
      <TouchableOpacity
        style={styles.photoMarketplaceBanner}
        onPress={() => navigation.navigate('PhotoMarketplace')}
        activeOpacity={0.9}
      >
        <View style={styles.photoMarketplaceBannerLeft}>
          <View style={styles.newBadge}>
            <Text style={styles.newBadgeText}>⚡ NEW</Text>
          </View>
          <Text style={styles.photoMarketplaceBannerTitle}>📸 Photo Marketplace</Text>
          <Text style={styles.photoMarketplaceBannerSubtitle}>Trade minted photo collectibles</Text>
        </View>
        <View style={styles.photoMarketplaceBannerRight}>
          <Text style={styles.arrowText}>View →</Text>
        </View>
      </TouchableOpacity>

      {/* Search Bar */}
      <View style={styles.searchContainer}>
        <Text style={styles.searchIcon}>🔍</Text>
        <TextInput
          style={styles.searchInput}
          placeholder="Search items..."
          placeholderTextColor="#6B7280"
          value={searchQuery}
          onChangeText={handleSearch}
        />
        {searchQuery.length > 0 && (
          <TouchableOpacity onPress={() => setSearchQuery('')}>
            <Text style={styles.clearButton}>✕</Text>
          </TouchableOpacity>
        )}
      </View>

      {/* Categories */}
      <ScrollView 
        horizontal 
        showsHorizontalScrollIndicator={false}
        style={styles.categoriesContainer}
        contentContainerStyle={styles.categoriesContent}
      >
        {CATEGORIES.map(cat => (
          <CategoryChip
            key={cat.id}
            category={cat}
            active={selectedCategory === cat.id}
            onPress={() => setSelectedCategory(cat.id)}
          />
        ))}
      </ScrollView>

      {/* Listings Grid */}
      {isLoading ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#3B82F6" />
          <Text style={styles.loadingText}>Loading listings...</Text>
        </View>
      ) : (
        <FlatList
          data={filteredListings}
          renderItem={({ item }) => (
            <ListingItem item={item} onPress={handleListingPress} />
          )}
          keyExtractor={(item) => item.listing_id || item.id || String(Math.random())}
          numColumns={2}
          columnWrapperStyle={styles.listingRow}
          contentContainerStyle={styles.listingContainer}
          showsVerticalScrollIndicator={false}
          refreshControl={
            <RefreshControl 
              refreshing={isRefreshing} 
              onRefresh={handleRefresh}
              tintColor="#3B82F6"
            />
          }
          ListEmptyComponent={
            <View style={styles.emptyContainer}>
              <Text style={styles.emptyIcon}>📦</Text>
              <Text style={styles.emptyTitle}>No listings found</Text>
              <Text style={styles.emptyText}>
                {searchQuery ? 'Try adjusting your search' : 'Be the first to list something!'}
              </Text>
              <TouchableOpacity 
                style={styles.createListingButton}
                onPress={() => navigation.navigate('SellerDashboard')}
              >
                <Text style={styles.createListingButtonText}>✨ Create Listing with AI</Text>
              </TouchableOpacity>
            </View>
          }
        />
      )}

      {/* Quick Action FAB */}
      <TouchableOpacity 
        style={styles.fab}
        onPress={() => navigation.navigate('SellerDashboard')}
      >
        <Text style={styles.fabIcon}>+</Text>
      </TouchableOpacity>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0F172A',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: '#1E293B',
  },
  headerTitle: {
    color: '#fff',
    fontSize: 20,
    fontWeight: 'bold',
  },
  headerButtons: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  sellerToolsButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#8B5CF620',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: '#8B5CF640',
  },
  sellerToolsIcon: {
    fontSize: 14,
    marginRight: 4,
  },
  sellerToolsText: {
    color: '#A78BFA',
    fontSize: 12,
    fontWeight: '600',
  },
  sellButton: {
    backgroundColor: '#3B82F6',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
  },
  sellButtonText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '600',
  },
  searchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#1E293B',
    marginHorizontal: 16,
    marginVertical: 12,
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderRadius: 12,
  },
  searchIcon: {
    fontSize: 16,
    marginRight: 8,
  },
  searchInput: {
    flex: 1,
    color: '#fff',
    fontSize: 16,
  },
  clearButton: {
    color: '#6B7280',
    fontSize: 18,
    padding: 4,
  },
  categoriesContainer: {
    maxHeight: 50,
  },
  categoriesContent: {
    paddingHorizontal: 16,
    gap: 8,
  },
  categoryChip: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#1E293B',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 20,
    marginRight: 8,
  },
  categoryChipActive: {
    backgroundColor: '#3B82F6',
  },
  categoryIcon: {
    fontSize: 14,
    marginRight: 4,
  },
  categoryName: {
    color: '#9CA3AF',
    fontSize: 12,
    fontWeight: '500',
  },
  categoryNameActive: {
    color: '#fff',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    color: '#9CA3AF',
    marginTop: 12,
    fontSize: 14,
  },
  listingContainer: {
    paddingHorizontal: 16,
    paddingTop: 12,
    paddingBottom: 100,
  },
  listingRow: {
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  listingItem: {
    width: ITEM_WIDTH,
    backgroundColor: '#1E293B',
    borderRadius: 12,
    overflow: 'hidden',
  },
  listingImage: {
    width: '100%',
    height: ITEM_WIDTH * 0.8,
    backgroundColor: '#334155',
  },
  listingImagePlaceholder: {
    justifyContent: 'center',
    alignItems: 'center',
  },
  placeholderEmoji: {
    fontSize: 40,
  },
  listingInfo: {
    padding: 12,
  },
  listingTitle: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '500',
    marginBottom: 4,
    height: 36,
  },
  listingPrice: {
    color: '#3B82F6',
    fontSize: 18,
    fontWeight: 'bold',
    marginBottom: 8,
  },
  listingMeta: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  listingCategory: {
    color: '#9CA3AF',
    fontSize: 11,
  },
  conditionBadge: {
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
  },
  conditionNew: {
    backgroundColor: '#10B98130',
  },
  conditionUsed: {
    backgroundColor: '#F59E0B30',
  },
  conditionText: {
    fontSize: 10,
    fontWeight: '600',
    color: '#fff',
    textTransform: 'capitalize',
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 60,
  },
  emptyIcon: {
    fontSize: 64,
    marginBottom: 16,
  },
  emptyTitle: {
    color: '#fff',
    fontSize: 20,
    fontWeight: 'bold',
    marginBottom: 8,
  },
  emptyText: {
    color: '#9CA3AF',
    fontSize: 14,
    marginBottom: 24,
    textAlign: 'center',
  },
  createListingButton: {
    backgroundColor: '#8B5CF6',
    paddingHorizontal: 24,
    paddingVertical: 14,
    borderRadius: 12,
  },
  createListingButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  fab: {
    position: 'absolute',
    bottom: 100,
    right: 20,
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: '#3B82F6',
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
});
