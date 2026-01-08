/**
 * AI Create Screen for Blendlink Mobile
 * AI-powered image and video generation using BL coins
 */

import React, { useState } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  ActivityIndicator,
  Alert,
  Image,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { aiMediaAPI } from '../services/api';

// Media type options
const MEDIA_TYPES = [
  { type: 'image', icon: '🖼️', label: 'Image', cost: '200', description: 'Generate stunning AI images' },
  { type: 'video', icon: '🎬', label: 'Video', cost: '400', description: 'Create short AI videos (4-12s)' },
  { type: 'music', icon: '🎵', label: 'Music', cost: '300', description: 'Coming soon', disabled: true },
];

// Duration options for video
const DURATION_OPTIONS = [4, 8, 12];

export default function AICreateScreen({ navigation }) {
  const [prompt, setPrompt] = useState('');
  const [mediaType, setMediaType] = useState('image');
  const [duration, setDuration] = useState(4);
  const [isEstimating, setIsEstimating] = useState(false);
  const [isGenerating, setIsGenerating] = useState(false);
  const [estimate, setEstimate] = useState(null);
  const [generatedResult, setGeneratedResult] = useState(null);

  const handleEstimateCost = async () => {
    if (!prompt.trim()) {
      Alert.alert('Error', 'Please enter a description for your content');
      return;
    }

    setIsEstimating(true);
    setEstimate(null);

    try {
      const result = await aiMediaAPI.estimateCost(prompt, mediaType, mediaType === 'video' ? duration : null);
      setEstimate(result);
    } catch (error) {
      Alert.alert('Error', error.response?.data?.detail || 'Failed to estimate cost');
    } finally {
      setIsEstimating(false);
    }
  };

  const handleGenerate = async () => {
    if (!estimate?.can_afford) {
      Alert.alert('Insufficient BL Coins', 'You need more BL coins. Post content to earn more!');
      return;
    }

    setIsGenerating(true);

    try {
      const result = await aiMediaAPI.generate(prompt, mediaType, mediaType === 'video' ? duration : null);
      setGeneratedResult(result);
      Alert.alert(
        'Success!',
        `Your ${mediaType} has been generated! ${result.cost_deducted} BL coins deducted.`
      );
    } catch (error) {
      const message = error.response?.data?.detail?.message || error.response?.data?.detail || 'Generation failed';
      Alert.alert('Generation Failed', message);
    } finally {
      setIsGenerating(false);
    }
  };

  const handleNewGeneration = () => {
    setPrompt('');
    setEstimate(null);
    setGeneratedResult(null);
  };

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <ScrollView showsVerticalScrollIndicator={false}>
        {/* Header */}
        <View style={styles.header}>
          <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton}>
            <Text style={styles.backButtonText}>←</Text>
          </TouchableOpacity>
          <Text style={styles.headerTitle}>✨ AI Create</Text>
          <View style={{ width: 32 }} />
        </View>

        {/* Info Banner */}
        <View style={styles.infoBanner}>
          <Text style={styles.infoBannerText}>
            Create unique images and videos using AI. Content costs BL coins to generate.
          </Text>
        </View>

        {/* Media Type Selection */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>What do you want to create?</Text>
          <View style={styles.mediaTypeGrid}>
            {MEDIA_TYPES.map((item) => (
              <TouchableOpacity
                key={item.type}
                style={[
                  styles.mediaTypeCard,
                  mediaType === item.type && styles.mediaTypeCardActive,
                  item.disabled && styles.mediaTypeCardDisabled,
                ]}
                onPress={() => !item.disabled && setMediaType(item.type)}
                disabled={item.disabled}
              >
                <Text style={styles.mediaTypeIcon}>{item.icon}</Text>
                <Text style={styles.mediaTypeLabel}>{item.label}</Text>
                <Text style={styles.mediaTypeCost}>{item.cost} BL</Text>
                {item.disabled && (
                  <View style={styles.comingSoonBadge}>
                    <Text style={styles.comingSoonText}>Soon</Text>
                  </View>
                )}
              </TouchableOpacity>
            ))}
          </View>
        </View>

        {/* Duration Selection (Video only) */}
        {mediaType === 'video' && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Video Duration</Text>
            <View style={styles.durationRow}>
              {DURATION_OPTIONS.map((d) => (
                <TouchableOpacity
                  key={d}
                  style={[
                    styles.durationButton,
                    duration === d && styles.durationButtonActive,
                  ]}
                  onPress={() => setDuration(d)}
                >
                  <Text
                    style={[
                      styles.durationText,
                      duration === d && styles.durationTextActive,
                    ]}
                  >
                    {d}s
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>
        )}

        {/* Prompt Input */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Describe your creation</Text>
          <TextInput
            style={styles.promptInput}
            placeholder={`e.g., "A beautiful sunset over mountains with golden light"`}
            placeholderTextColor="#6B7280"
            multiline
            value={prompt}
            onChangeText={(text) => {
              setPrompt(text);
              setEstimate(null);
            }}
          />
        </View>

        {/* Cost Estimate */}
        {!estimate ? (
          <TouchableOpacity
            style={[styles.estimateButton, (!prompt.trim() || isEstimating) && styles.buttonDisabled]}
            onPress={handleEstimateCost}
            disabled={!prompt.trim() || isEstimating}
          >
            {isEstimating ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <>
                <Text style={styles.estimateButtonIcon}>🪙</Text>
                <Text style={styles.estimateButtonText}>Estimate Cost</Text>
              </>
            )}
          </TouchableOpacity>
        ) : (
          <View style={[styles.estimateCard, estimate.can_afford ? styles.estimateCardSuccess : styles.estimateCardError]}>
            <View style={styles.estimateRow}>
              <Text style={styles.estimateLabel}>Estimated Cost:</Text>
              <Text style={styles.estimateValue}>🪙 {estimate.estimated_cost} BL</Text>
            </View>
            <View style={styles.estimateRow}>
              <Text style={styles.estimateLabel}>Your Balance:</Text>
              <Text style={styles.estimateBalanceValue}>{estimate.current_balance} BL</Text>
            </View>
            {!estimate.can_afford && (
              <Text style={styles.estimateError}>
                Not enough BL coins. Post content to earn more!
              </Text>
            )}
          </View>
        )}

        {/* Generate Button */}
        {estimate && (
          <TouchableOpacity
            style={[styles.generateButton, (!estimate.can_afford || isGenerating) && styles.buttonDisabled]}
            onPress={handleGenerate}
            disabled={!estimate.can_afford || isGenerating}
          >
            {isGenerating ? (
              <>
                <ActivityIndicator color="#fff" style={{ marginRight: 8 }} />
                <Text style={styles.generateButtonText}>
                  Generating ({mediaType === 'video' ? '2-5 min' : '30s'})...
                </Text>
              </>
            ) : (
              <>
                <Text style={styles.generateButtonIcon}>✨</Text>
                <Text style={styles.generateButtonText}>Generate {mediaType}</Text>
              </>
            )}
          </TouchableOpacity>
        )}

        {/* Generated Result Preview */}
        {generatedResult && (
          <View style={styles.resultSection}>
            <Text style={styles.sectionTitle}>🎉 Your Creation</Text>
            {generatedResult.media_type === 'image' && generatedResult.result?.base64 && (
              <Image
                source={{ uri: `data:image/png;base64,${generatedResult.result.base64}` }}
                style={styles.resultImage}
                resizeMode="contain"
              />
            )}
            {generatedResult.media_type === 'video' && (
              <View style={styles.videoPlaceholder}>
                <Text style={styles.videoPlaceholderText}>🎬</Text>
                <Text style={styles.videoPlaceholderLabel}>Video Generated!</Text>
                <Text style={styles.videoPlaceholderSubtext}>Duration: {generatedResult.result?.duration}s</Text>
              </View>
            )}
            <TouchableOpacity style={styles.newGenerationButton} onPress={handleNewGeneration}>
              <Text style={styles.newGenerationButtonText}>Create Another</Text>
            </TouchableOpacity>
          </View>
        )}

        {/* Disclaimer */}
        <Text style={styles.disclaimer}>
          AI-generated content is royalty-free for personal use.
        </Text>

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
  infoBanner: {
    backgroundColor: '#8B5CF620',
    margin: 12,
    padding: 12,
    borderRadius: 8,
    borderLeftWidth: 4,
    borderLeftColor: '#8B5CF6',
  },
  infoBannerText: {
    color: '#A78BFA',
    fontSize: 13,
  },
  section: {
    paddingHorizontal: 16,
    marginBottom: 20,
  },
  sectionTitle: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 12,
  },
  mediaTypeGrid: {
    flexDirection: 'row',
    gap: 12,
  },
  mediaTypeCard: {
    flex: 1,
    backgroundColor: '#1E293B',
    borderRadius: 12,
    padding: 16,
    alignItems: 'center',
    borderWidth: 2,
    borderColor: 'transparent',
    position: 'relative',
  },
  mediaTypeCardActive: {
    borderColor: '#3B82F6',
    backgroundColor: '#3B82F610',
  },
  mediaTypeCardDisabled: {
    opacity: 0.5,
  },
  mediaTypeIcon: {
    fontSize: 28,
    marginBottom: 8,
  },
  mediaTypeLabel: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '600',
    marginBottom: 4,
  },
  mediaTypeCost: {
    color: '#9CA3AF',
    fontSize: 12,
  },
  comingSoonBadge: {
    position: 'absolute',
    top: 8,
    right: 8,
    backgroundColor: '#F59E0B',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
  },
  comingSoonText: {
    color: '#000',
    fontSize: 10,
    fontWeight: 'bold',
  },
  durationRow: {
    flexDirection: 'row',
    gap: 12,
  },
  durationButton: {
    flex: 1,
    backgroundColor: '#334155',
    paddingVertical: 12,
    borderRadius: 8,
    alignItems: 'center',
  },
  durationButtonActive: {
    backgroundColor: '#3B82F6',
  },
  durationText: {
    color: '#9CA3AF',
    fontSize: 16,
    fontWeight: '600',
  },
  durationTextActive: {
    color: '#fff',
  },
  promptInput: {
    backgroundColor: '#1E293B',
    borderRadius: 12,
    padding: 16,
    color: '#fff',
    fontSize: 15,
    minHeight: 120,
    textAlignVertical: 'top',
  },
  estimateButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#334155',
    marginHorizontal: 16,
    padding: 16,
    borderRadius: 12,
  },
  buttonDisabled: {
    opacity: 0.5,
  },
  estimateButtonIcon: {
    fontSize: 20,
    marginRight: 8,
  },
  estimateButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  estimateCard: {
    marginHorizontal: 16,
    padding: 16,
    borderRadius: 12,
    borderWidth: 1,
  },
  estimateCardSuccess: {
    backgroundColor: '#10B98110',
    borderColor: '#10B98140',
  },
  estimateCardError: {
    backgroundColor: '#EF444410',
    borderColor: '#EF444440',
  },
  estimateRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  estimateLabel: {
    color: '#9CA3AF',
    fontSize: 14,
  },
  estimateValue: {
    color: '#F59E0B',
    fontSize: 18,
    fontWeight: 'bold',
  },
  estimateBalanceValue: {
    color: '#fff',
    fontSize: 14,
  },
  estimateError: {
    color: '#EF4444',
    fontSize: 13,
    marginTop: 8,
  },
  generateButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#8B5CF6',
    marginHorizontal: 16,
    marginTop: 16,
    padding: 16,
    borderRadius: 12,
  },
  generateButtonIcon: {
    fontSize: 20,
    marginRight: 8,
  },
  generateButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  resultSection: {
    margin: 16,
    backgroundColor: '#1E293B',
    borderRadius: 12,
    padding: 16,
  },
  resultImage: {
    width: '100%',
    height: 300,
    borderRadius: 8,
    marginTop: 12,
    backgroundColor: '#334155',
  },
  videoPlaceholder: {
    alignItems: 'center',
    padding: 40,
    backgroundColor: '#334155',
    borderRadius: 8,
    marginTop: 12,
  },
  videoPlaceholderText: {
    fontSize: 48,
    marginBottom: 8,
  },
  videoPlaceholderLabel: {
    color: '#fff',
    fontSize: 18,
    fontWeight: '600',
  },
  videoPlaceholderSubtext: {
    color: '#9CA3AF',
    fontSize: 14,
    marginTop: 4,
  },
  newGenerationButton: {
    backgroundColor: '#334155',
    padding: 12,
    borderRadius: 8,
    alignItems: 'center',
    marginTop: 16,
  },
  newGenerationButtonText: {
    color: '#3B82F6',
    fontSize: 14,
    fontWeight: '600',
  },
  disclaimer: {
    color: '#6B7280',
    fontSize: 12,
    textAlign: 'center',
    marginTop: 20,
    paddingHorizontal: 16,
  },
});
