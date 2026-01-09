/**
 * Seller Dashboard Screen for Blendlink Mobile
 * AI-powered seller tools matching the PWA
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
  Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import * as ImagePicker from 'expo-image-picker';
import api from '../services/api';

// Stat Card Component
const StatCard = ({ title, value, icon, color = '#3B82F6' }) => (
  <View style={styles.statCard}>
    <Text style={styles.statIcon}>{icon}</Text>
    <Text style={[styles.statValue, { color }]}>{value}</Text>
    <Text style={styles.statTitle}>{title}</Text>
  </View>
);

// Listing Card Component
const ListingCard = ({ listing, onImprove }) => {
  const scoreColor = listing.performance_score >= 70 ? '#10B981' : 
                     listing.performance_score >= 40 ? '#F59E0B' : '#EF4444';
  
  return (
    <View style={styles.listingCard}>
      <View style={styles.listingContent}>
        {listing.image ? (
          <Image source={{ uri: listing.image }} style={styles.listingImage} />
        ) : (
          <View style={[styles.listingImage, styles.listingImagePlaceholder]}>
            <Text style={styles.listingImagePlaceholderText}>📦</Text>
          </View>
        )}
        <View style={styles.listingInfo}>
          <Text style={styles.listingTitle} numberOfLines={1}>{listing.title}</Text>
          <Text style={styles.listingPrice}>${listing.price}</Text>
          <View style={styles.listingStats}>
            <Text style={styles.listingStat}>👁 {listing.views}</Text>
            <Text style={styles.listingStat}>❤️ {listing.favorites}</Text>
            <Text style={styles.listingStat}>💬 {listing.inquiries}</Text>
          </View>
        </View>
        <View style={styles.listingScore}>
          <Text style={[styles.scoreValue, { color: scoreColor }]}>{listing.performance_score}</Text>
          <Text style={styles.scoreLabel}>Score</Text>
        </View>
      </View>
      
      {listing.ai_recommendations?.length > 0 && (
        <View style={styles.recommendationsContainer}>
          <Text style={styles.recommendationsTitle}>✨ AI Recommendations</Text>
          {listing.ai_recommendations.slice(0, 2).map((rec, i) => (
            <Text key={i} style={styles.recommendationText}>• {rec}</Text>
          ))}
          <TouchableOpacity style={styles.improveButton} onPress={() => onImprove(listing.listing_id)}>
            <Text style={styles.improveButtonText}>🪄 Get Full Analysis</Text>
          </TouchableOpacity>
        </View>
      )}
    </View>
  );
};

// Tab Button Component
const TabButton = ({ label, icon, active, onPress }) => (
  <TouchableOpacity
    style={[styles.tabButton, active && styles.tabButtonActive]}
    onPress={onPress}
  >
    <Text style={styles.tabIcon}>{icon}</Text>
    <Text style={[styles.tabLabel, active && styles.tabLabelActive]}>{label}</Text>
  </TouchableOpacity>
);

// Country options
const COUNTRIES = [
  { code: "US", name: "United States", flag: "🇺🇸" },
  { code: "UK", name: "United Kingdom", flag: "🇬🇧" },
  { code: "CA", name: "Canada", flag: "🇨🇦" },
  { code: "AU", name: "Australia", flag: "🇦🇺" },
  { code: "DE", name: "Germany", flag: "🇩🇪" },
];

// Main Component
export default function SellerDashboardScreen({ navigation }) {
  const [activeTab, setActiveTab] = useState('overview');
  const [stats, setStats] = useState(null);
  const [listings, setListings] = useState([]);
  const [performance, setPerformance] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);

  // AI Create state
  const [images, setImages] = useState([]);
  const [condition, setCondition] = useState('new');
  const [targetCountries, setTargetCountries] = useState(['US']);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [aiResult, setAiResult] = useState(null);
  const [priceData, setPriceData] = useState(null);

  // Shipping state
  const [originZip, setOriginZip] = useState('');
  const [destZip, setDestZip] = useState('');
  const [shippingResult, setShippingResult] = useState(null);
  const [isEstimating, setIsEstimating] = useState(false);

  const loadData = useCallback(async () => {
    try {
      const [statsRes, perfRes] = await Promise.all([
        api.get('/seller/stats'),
        api.get('/seller/performance?days=30'),
      ]);
      setStats(statsRes.data);
      setPerformance(perfRes.data);
      setListings(perfRes.data.listings || []);
    } catch (error) {
      console.error('Failed to load seller data:', error);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const handleRefresh = async () => {
    setIsRefreshing(true);
    await loadData();
    setIsRefreshing(false);
  };

  const handleImprove = async (listingId) => {
    try {
      const response = await api.post(`/ai-tools/improve-listing?listing_id=${listingId}`);
      Alert.alert('AI Analysis Complete', 'Check the listing for improvement suggestions.');
    } catch (error) {
      Alert.alert('Error', 'Failed to analyze listing');
    }
  };

  const pickImages = async () => {
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsMultipleSelection: true,
      quality: 0.8,
      base64: true,
    });

    if (!result.canceled) {
      const newImages = result.assets.map(asset => `data:image/jpeg;base64,${asset.base64}`);
      setImages(prev => [...prev, ...newImages].slice(0, 20));
    }
  };

  const handleAnalyze = async () => {
    if (images.length === 0) {
      Alert.alert('Error', 'Please upload at least one image');
      return;
    }

    setIsAnalyzing(true);
    setAiResult(null);

    try {
      const response = await api.post('/ai-tools/analyze-listing', {
        images,
        condition,
        target_countries: targetCountries,
      });
      setAiResult(response.data);
      Alert.alert('Success', 'AI analysis complete!');

      // Fetch pricing
      try {
        const priceRes = await api.post('/ai-tools/price-suggestions', {
          title: response.data.title,
          description: response.data.description,
          condition,
          target_countries: targetCountries,
        });
        setPriceData(priceRes.data);
      } catch (e) {
        console.error('Price fetch failed:', e);
      }
    } catch (error) {
      Alert.alert('Error', error.response?.data?.detail || 'Analysis failed');
    } finally {
      setIsAnalyzing(false);
    }
  };

  const handleShippingEstimate = async () => {
    if (!originZip || !destZip) {
      Alert.alert('Error', 'Please enter both ZIP codes');
      return;
    }

    setIsEstimating(true);
    try {
      const response = await api.post('/ai-tools/shipping-estimate', {
        origin_zip: originZip,
        destination_zip: destZip,
        destination_country: 'US',
      });
      setShippingResult(response.data);
    } catch (error) {
      Alert.alert('Error', 'Failed to estimate shipping');
    } finally {
      setIsEstimating(false);
    }
  };

  if (isLoading) {
    return (
      <SafeAreaView style={styles.container}>
        <ActivityIndicator size="large" color="#3B82F6" style={{ flex: 1 }} />
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton}>
          <Text style={styles.backButtonText}>←</Text>
        </TouchableOpacity>
        <Text style={styles.headerTitle}>🏪 Seller Dashboard</Text>
        <View style={{ width: 32 }} />
      </View>

      {/* Tabs */}
      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.tabsContainer}>
        <TabButton label="Overview" icon="📊" active={activeTab === 'overview'} onPress={() => setActiveTab('overview')} />
        <TabButton label="AI Create" icon="✨" active={activeTab === 'create'} onPress={() => setActiveTab('create')} />
        <TabButton label="Listings" icon="📦" active={activeTab === 'listings'} onPress={() => setActiveTab('listings')} />
        <TabButton label="Shipping" icon="🚚" active={activeTab === 'shipping'} onPress={() => setActiveTab('shipping')} />
      </ScrollView>

      <ScrollView
        style={styles.content}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl refreshing={isRefreshing} onRefresh={handleRefresh} tintColor="#3B82F6" />
        }
      >
        {/* Overview Tab */}
        {activeTab === 'overview' && (
          <>
            {/* Stats Grid */}
            <View style={styles.statsGrid}>
              <StatCard title="Active" value={stats?.active_listings || 0} icon="📦" />
              <StatCard title="Revenue" value={`$${stats?.total_revenue || 0}`} icon="💰" color="#10B981" />
              <StatCard title="Views" value={stats?.total_views || 0} icon="👁" />
              <StatCard title="BL Coins" value={Math.floor(stats?.bl_coins_earned || 0)} icon="🪙" color="#F59E0B" />
            </View>

            {/* Underperforming Alert */}
            {performance?.underperforming?.length > 0 && (
              <View style={styles.alertCard}>
                <Text style={styles.alertTitle}>⚠️ Needs Attention</Text>
                <Text style={styles.alertSubtitle}>{performance.underperforming.length} listings need improvement</Text>
              </View>
            )}

            {/* Performance Summary */}
            <Text style={styles.sectionTitle}>📈 Performance</Text>
            <Text style={styles.sectionSubtitle}>Average Score: {performance?.average_score || 0}/100</Text>

            {/* Top Listings */}
            {listings.slice(0, 3).map(listing => (
              <ListingCard key={listing.listing_id} listing={listing} onImprove={handleImprove} />
            ))}
          </>
        )}

        {/* AI Create Tab */}
        {activeTab === 'create' && (
          <>
            <Text style={styles.sectionTitle}>✨ AI Listing Creator</Text>
            <Text style={styles.sectionSubtitle}>Upload photos and let AI generate your listing</Text>

            {/* Image Upload */}
            <View style={styles.imageGrid}>
              {images.map((img, i) => (
                <View key={i} style={styles.imageThumb}>
                  <Image source={{ uri: img }} style={styles.thumbImage} />
                  <TouchableOpacity
                    style={styles.removeImageButton}
                    onPress={() => setImages(prev => prev.filter((_, idx) => idx !== i))}
                  >
                    <Text style={styles.removeImageText}>×</Text>
                  </TouchableOpacity>
                </View>
              ))}
              {images.length < 20 && (
                <TouchableOpacity style={styles.addImageButton} onPress={pickImages}>
                  <Text style={styles.addImageIcon}>📷</Text>
                  <Text style={styles.addImageText}>Add</Text>
                </TouchableOpacity>
              )}
            </View>
            <Text style={styles.imageCount}>{images.length}/20 photos</Text>

            {/* Condition */}
            <Text style={styles.fieldLabel}>Item Condition</Text>
            <View style={styles.conditionButtons}>
              <TouchableOpacity
                style={[styles.conditionButton, condition === 'new' && styles.conditionButtonActive]}
                onPress={() => setCondition('new')}
              >
                <Text style={[styles.conditionButtonText, condition === 'new' && styles.conditionButtonTextActive]}>
                  ✅ New
                </Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.conditionButton, condition === 'used' && styles.conditionButtonActive]}
                onPress={() => setCondition('used')}
              >
                <Text style={[styles.conditionButtonText, condition === 'used' && styles.conditionButtonTextActive]}>
                  🔄 Used
                </Text>
              </TouchableOpacity>
            </View>

            {/* Countries */}
            <Text style={styles.fieldLabel}>Target Countries</Text>
            <View style={styles.countriesRow}>
              {COUNTRIES.map(c => (
                <TouchableOpacity
                  key={c.code}
                  style={[styles.countryChip, targetCountries.includes(c.code) && styles.countryChipActive]}
                  onPress={() => setTargetCountries(prev =>
                    prev.includes(c.code) ? prev.filter(x => x !== c.code) : [...prev, c.code]
                  )}
                >
                  <Text style={styles.countryChipText}>{c.flag} {c.code}</Text>
                </TouchableOpacity>
              ))}
            </View>

            {/* Analyze Button */}
            <TouchableOpacity
              style={[styles.analyzeButton, (images.length === 0 || isAnalyzing) && styles.buttonDisabled]}
              onPress={handleAnalyze}
              disabled={images.length === 0 || isAnalyzing}
            >
              {isAnalyzing ? (
                <ActivityIndicator color="#fff" />
              ) : (
                <Text style={styles.analyzeButtonText}>✨ Generate Listing with AI</Text>
              )}
            </TouchableOpacity>

            {/* AI Results */}
            {aiResult && (
              <View style={styles.aiResultCard}>
                <Text style={styles.aiResultTitle}>{aiResult.title}</Text>
                <Text style={styles.aiResultCategory}>📁 {aiResult.category}</Text>
                <Text style={styles.aiResultDescription}>{aiResult.description}</Text>

                {/* Condition */}
                <View style={styles.conditionBadge}>
                  <Text style={styles.conditionBadgeText}>
                    Condition: {aiResult.detected_condition?.replace('_', ' ')}
                  </Text>
                </View>

                {/* Flaws */}
                {aiResult.flaws_detected?.length > 0 && (
                  <View style={styles.flawsContainer}>
                    <Text style={styles.flawsTitle}>⚠️ Flaws Detected:</Text>
                    {aiResult.flaws_detected.map((flaw, i) => (
                      <Text key={i} style={styles.flawText}>• {flaw}</Text>
                    ))}
                  </View>
                )}

                {/* Pricing */}
                {priceData && (
                  <View style={styles.priceContainer}>
                    <Text style={styles.priceTitle}>💰 Price Suggestions</Text>
                    <View style={styles.priceGrid}>
                      <View style={styles.priceItem}>
                        <Text style={styles.priceLabel}>Low</Text>
                        <Text style={[styles.priceValue, { color: '#10B981' }]}>${priceData.lowest_price}</Text>
                      </View>
                      <View style={styles.priceItem}>
                        <Text style={styles.priceLabel}>Avg</Text>
                        <Text style={styles.priceValue}>${priceData.average_price}</Text>
                      </View>
                      <View style={styles.priceItem}>
                        <Text style={styles.priceLabel}>High</Text>
                        <Text style={[styles.priceValue, { color: '#EF4444' }]}>${priceData.highest_price}</Text>
                      </View>
                      <View style={[styles.priceItem, styles.recommendedPrice]}>
                        <Text style={styles.priceLabel}>Recommended</Text>
                        <Text style={[styles.priceValue, { color: '#3B82F6' }]}>${priceData.recommended_price}</Text>
                      </View>
                    </View>
                    <Text style={styles.pricingAdvice}>{priceData.pricing_advice}</Text>
                  </View>
                )}

                <TouchableOpacity style={styles.createListingButton}>
                  <Text style={styles.createListingButtonText}>✅ Create Listing</Text>
                </TouchableOpacity>
              </View>
            )}
          </>
        )}

        {/* Listings Tab */}
        {activeTab === 'listings' && (
          <>
            <Text style={styles.sectionTitle}>📦 Your Listings ({listings.length})</Text>
            {listings.length === 0 ? (
              <View style={styles.emptyState}>
                <Text style={styles.emptyIcon}>📦</Text>
                <Text style={styles.emptyTitle}>No listings yet</Text>
                <Text style={styles.emptyText}>Create your first listing with AI</Text>
              </View>
            ) : (
              listings.map(listing => (
                <ListingCard key={listing.listing_id} listing={listing} onImprove={handleImprove} />
              ))
            )}
          </>
        )}

        {/* Shipping Tab */}
        {activeTab === 'shipping' && (
          <>
            <Text style={styles.sectionTitle}>🚚 Shipping Estimator</Text>
            <Text style={styles.sectionSubtitle}>Get shipping rates from multiple carriers</Text>

            <Text style={styles.fieldLabel}>Origin ZIP Code</Text>
            <TextInput
              style={styles.input}
              placeholder="e.g., 90210"
              placeholderTextColor="#6B7280"
              value={originZip}
              onChangeText={setOriginZip}
              keyboardType="number-pad"
            />

            <Text style={styles.fieldLabel}>Destination ZIP Code</Text>
            <TextInput
              style={styles.input}
              placeholder="e.g., 10001"
              placeholderTextColor="#6B7280"
              value={destZip}
              onChangeText={setDestZip}
              keyboardType="number-pad"
            />

            <TouchableOpacity
              style={[styles.estimateButton, (!originZip || !destZip || isEstimating) && styles.buttonDisabled]}
              onPress={handleShippingEstimate}
              disabled={!originZip || !destZip || isEstimating}
            >
              {isEstimating ? (
                <ActivityIndicator color="#fff" />
              ) : (
                <Text style={styles.estimateButtonText}>🚚 Get Estimates</Text>
              )}
            </TouchableOpacity>

            {shippingResult && (
              <View style={styles.shippingResults}>
                <View style={styles.packageInfo}>
                  <Text style={styles.packageInfoTitle}>📦 Package Details</Text>
                  <Text style={styles.packageInfoText}>
                    {shippingResult.estimated_dimensions.length}" × {shippingResult.estimated_dimensions.width}" × {shippingResult.estimated_dimensions.height}"
                  </Text>
                  <Text style={styles.packageInfoText}>Weight: {shippingResult.estimated_weight} lbs</Text>
                </View>

                <Text style={styles.shippingOptionsTitle}>Shipping Options</Text>
                {shippingResult.shipping_options.map((option, i) => (
                  <View key={i} style={[styles.shippingOption, i === 0 && styles.shippingOptionRecommended]}>
                    <View>
                      <Text style={styles.shippingProvider}>{option.provider}</Text>
                      <Text style={styles.shippingDays}>{option.delivery_days} days</Text>
                    </View>
                    <View style={styles.shippingPriceContainer}>
                      <Text style={styles.shippingPrice}>${option.estimated_cost}</Text>
                      {i === 0 && <Text style={styles.recommendedTag}>Best</Text>}
                    </View>
                  </View>
                ))}
              </View>
            )}
          </>
        )}

        <View style={{ height: 100 }} />
      </ScrollView>
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
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: '#1E293B',
  },
  backButton: {
    width: 32,
    height: 32,
    justifyContent: 'center',
    alignItems: 'center',
  },
  backButtonText: {
    color: '#fff',
    fontSize: 24,
  },
  headerTitle: {
    color: '#fff',
    fontSize: 18,
    fontWeight: 'bold',
  },
  tabsContainer: {
    backgroundColor: '#1E293B',
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  tabButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 10,
    marginRight: 8,
    borderRadius: 20,
    backgroundColor: '#334155',
  },
  tabButtonActive: {
    backgroundColor: '#3B82F6',
  },
  tabIcon: {
    fontSize: 16,
    marginRight: 6,
  },
  tabLabel: {
    color: '#9CA3AF',
    fontSize: 14,
    fontWeight: '500',
  },
  tabLabelActive: {
    color: '#fff',
  },
  content: {
    flex: 1,
    padding: 16,
  },
  statsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginBottom: 16,
  },
  statCard: {
    width: '48%',
    backgroundColor: '#1E293B',
    borderRadius: 12,
    padding: 16,
    alignItems: 'center',
  },
  statIcon: {
    fontSize: 24,
    marginBottom: 4,
  },
  statValue: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#fff',
  },
  statTitle: {
    color: '#9CA3AF',
    fontSize: 12,
    marginTop: 2,
  },
  alertCard: {
    backgroundColor: '#F59E0B20',
    borderColor: '#F59E0B40',
    borderWidth: 1,
    borderRadius: 12,
    padding: 16,
    marginBottom: 16,
  },
  alertTitle: {
    color: '#F59E0B',
    fontSize: 16,
    fontWeight: '600',
  },
  alertSubtitle: {
    color: '#F59E0B',
    fontSize: 14,
    opacity: 0.8,
  },
  sectionTitle: {
    color: '#fff',
    fontSize: 18,
    fontWeight: '600',
    marginBottom: 4,
    marginTop: 8,
  },
  sectionSubtitle: {
    color: '#9CA3AF',
    fontSize: 14,
    marginBottom: 16,
  },
  listingCard: {
    backgroundColor: '#1E293B',
    borderRadius: 12,
    padding: 12,
    marginBottom: 12,
  },
  listingContent: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  listingImage: {
    width: 60,
    height: 60,
    borderRadius: 8,
    marginRight: 12,
  },
  listingImagePlaceholder: {
    backgroundColor: '#334155',
    justifyContent: 'center',
    alignItems: 'center',
  },
  listingImagePlaceholderText: {
    fontSize: 24,
  },
  listingInfo: {
    flex: 1,
  },
  listingTitle: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '500',
  },
  listingPrice: {
    color: '#3B82F6',
    fontSize: 16,
    fontWeight: 'bold',
    marginTop: 2,
  },
  listingStats: {
    flexDirection: 'row',
    marginTop: 4,
  },
  listingStat: {
    color: '#9CA3AF',
    fontSize: 12,
    marginRight: 10,
  },
  listingScore: {
    alignItems: 'center',
  },
  scoreValue: {
    fontSize: 24,
    fontWeight: 'bold',
  },
  scoreLabel: {
    color: '#9CA3AF',
    fontSize: 10,
  },
  recommendationsContainer: {
    marginTop: 12,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: '#334155',
  },
  recommendationsTitle: {
    color: '#F59E0B',
    fontSize: 12,
    fontWeight: '600',
    marginBottom: 4,
  },
  recommendationText: {
    color: '#9CA3AF',
    fontSize: 12,
    marginBottom: 2,
  },
  improveButton: {
    marginTop: 8,
    padding: 8,
    backgroundColor: '#334155',
    borderRadius: 8,
    alignItems: 'center',
  },
  improveButtonText: {
    color: '#3B82F6',
    fontSize: 12,
    fontWeight: '600',
  },
  // AI Create styles
  imageGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginBottom: 8,
  },
  imageThumb: {
    width: 70,
    height: 70,
    borderRadius: 8,
    position: 'relative',
  },
  thumbImage: {
    width: '100%',
    height: '100%',
    borderRadius: 8,
  },
  removeImageButton: {
    position: 'absolute',
    top: -6,
    right: -6,
    width: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: '#EF4444',
    justifyContent: 'center',
    alignItems: 'center',
  },
  removeImageText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: 'bold',
  },
  addImageButton: {
    width: 70,
    height: 70,
    borderRadius: 8,
    borderWidth: 2,
    borderStyle: 'dashed',
    borderColor: '#334155',
    justifyContent: 'center',
    alignItems: 'center',
  },
  addImageIcon: {
    fontSize: 20,
  },
  addImageText: {
    color: '#9CA3AF',
    fontSize: 10,
    marginTop: 2,
  },
  imageCount: {
    color: '#9CA3AF',
    fontSize: 12,
    marginBottom: 16,
  },
  fieldLabel: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '500',
    marginBottom: 8,
    marginTop: 12,
  },
  conditionButtons: {
    flexDirection: 'row',
    gap: 12,
  },
  conditionButton: {
    flex: 1,
    padding: 16,
    borderRadius: 12,
    backgroundColor: '#334155',
    alignItems: 'center',
  },
  conditionButtonActive: {
    backgroundColor: '#3B82F6',
  },
  conditionButtonText: {
    color: '#9CA3AF',
    fontSize: 14,
    fontWeight: '600',
  },
  conditionButtonTextActive: {
    color: '#fff',
  },
  countriesRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  countryChip: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 20,
    backgroundColor: '#334155',
  },
  countryChipActive: {
    backgroundColor: '#3B82F6',
  },
  countryChipText: {
    color: '#fff',
    fontSize: 12,
  },
  analyzeButton: {
    backgroundColor: '#8B5CF6',
    padding: 16,
    borderRadius: 12,
    alignItems: 'center',
    marginTop: 24,
  },
  analyzeButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  buttonDisabled: {
    opacity: 0.5,
  },
  // AI Result styles
  aiResultCard: {
    backgroundColor: '#1E293B',
    borderRadius: 12,
    padding: 16,
    marginTop: 16,
    borderWidth: 1,
    borderColor: '#3B82F640',
  },
  aiResultTitle: {
    color: '#fff',
    fontSize: 18,
    fontWeight: '600',
    marginBottom: 4,
  },
  aiResultCategory: {
    color: '#9CA3AF',
    fontSize: 14,
    marginBottom: 12,
  },
  aiResultDescription: {
    color: '#D1D5DB',
    fontSize: 14,
    lineHeight: 20,
    marginBottom: 12,
  },
  conditionBadge: {
    backgroundColor: '#10B98120',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 8,
    alignSelf: 'flex-start',
    marginBottom: 12,
  },
  conditionBadgeText: {
    color: '#10B981',
    fontSize: 12,
    fontWeight: '500',
  },
  flawsContainer: {
    backgroundColor: '#EF444420',
    padding: 12,
    borderRadius: 8,
    marginBottom: 12,
  },
  flawsTitle: {
    color: '#EF4444',
    fontSize: 14,
    fontWeight: '600',
    marginBottom: 4,
  },
  flawText: {
    color: '#FCA5A5',
    fontSize: 12,
  },
  priceContainer: {
    backgroundColor: '#F59E0B10',
    padding: 12,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#F59E0B30',
    marginBottom: 16,
  },
  priceTitle: {
    color: '#F59E0B',
    fontSize: 14,
    fontWeight: '600',
    marginBottom: 8,
  },
  priceGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  priceItem: {
    flex: 1,
    minWidth: '45%',
    backgroundColor: '#0F172A50',
    padding: 8,
    borderRadius: 8,
    alignItems: 'center',
  },
  recommendedPrice: {
    borderWidth: 2,
    borderColor: '#3B82F6',
  },
  priceLabel: {
    color: '#9CA3AF',
    fontSize: 10,
  },
  priceValue: {
    color: '#fff',
    fontSize: 18,
    fontWeight: 'bold',
  },
  pricingAdvice: {
    color: '#9CA3AF',
    fontSize: 12,
    marginTop: 8,
  },
  createListingButton: {
    backgroundColor: '#10B981',
    padding: 16,
    borderRadius: 12,
    alignItems: 'center',
  },
  createListingButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  // Shipping styles
  input: {
    backgroundColor: '#1E293B',
    borderRadius: 12,
    padding: 16,
    color: '#fff',
    fontSize: 16,
    marginBottom: 8,
  },
  estimateButton: {
    backgroundColor: '#3B82F6',
    padding: 16,
    borderRadius: 12,
    alignItems: 'center',
    marginTop: 16,
  },
  estimateButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  shippingResults: {
    marginTop: 16,
  },
  packageInfo: {
    backgroundColor: '#1E293B',
    borderRadius: 12,
    padding: 16,
    marginBottom: 16,
  },
  packageInfoTitle: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '600',
    marginBottom: 8,
  },
  packageInfoText: {
    color: '#9CA3AF',
    fontSize: 14,
  },
  shippingOptionsTitle: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 12,
  },
  shippingOption: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: '#1E293B',
    borderRadius: 12,
    padding: 16,
    marginBottom: 8,
  },
  shippingOptionRecommended: {
    borderWidth: 2,
    borderColor: '#3B82F6',
  },
  shippingProvider: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '500',
  },
  shippingDays: {
    color: '#9CA3AF',
    fontSize: 12,
  },
  shippingPriceContainer: {
    alignItems: 'flex-end',
  },
  shippingPrice: {
    color: '#3B82F6',
    fontSize: 18,
    fontWeight: 'bold',
  },
  recommendedTag: {
    color: '#10B981',
    fontSize: 10,
    fontWeight: '600',
  },
  // Empty state
  emptyState: {
    alignItems: 'center',
    padding: 40,
  },
  emptyIcon: {
    fontSize: 48,
    marginBottom: 16,
  },
  emptyTitle: {
    color: '#fff',
    fontSize: 18,
    fontWeight: '600',
    marginBottom: 8,
  },
  emptyText: {
    color: '#9CA3AF',
    fontSize: 14,
  },
});
