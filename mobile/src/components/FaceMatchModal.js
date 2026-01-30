/**
 * FaceMatchModal Component for Mobile (React Native/Expo)
 * 
 * Live video selfie match for Authenticity bonus verification.
 * Uses expo-camera for camera access.
 * 
 * Per user specs:
 * - Up to 3 tries (100 BL coins each)
 * - Camera capture and face comparison
 * - Adds up to 5% Authenticity bonus to minted photos
 */

import React, { useState, useRef, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Modal,
  Pressable,
  Image,
  Alert,
  ActivityIndicator,
  Dimensions,
} from 'react-native';
import { CameraView, useCameraPermissions } from 'expo-camera';
import * as Haptics from 'expo-haptics';
import { LinearGradient } from 'expo-linear-gradient';
import { useTheme } from '../context/ThemeContext';
import { useAuth } from '../context/AuthContext';
import { photoGameAPI } from '../services/api';

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window');

// Constants per spec
const COST_PER_ATTEMPT = 100; // BL coins
const MAX_ATTEMPTS = 3;

const FaceMatchModal = ({
  visible,
  onClose,
  photo, // The minted photo to match against
  onSuccess, // Callback when match succeeds
}) => {
  const { colors } = useTheme();
  const { user, updateBalance } = useAuth();
  const cameraRef = useRef(null);
  
  // Permission state
  const [permission, requestPermission] = useCameraPermissions();
  
  // Camera state
  const [cameraReady, setCameraReady] = useState(false);
  const [facing, setFacing] = useState('front');
  const [capturedImage, setCapturedImage] = useState(null);
  
  // Match state
  const [isMatching, setIsMatching] = useState(false);
  const [matchResult, setMatchResult] = useState(null);
  const [attemptsUsed, setAttemptsUsed] = useState(0);
  
  // User balance
  const userBalance = user?.bl_coins || 0;
  const canAffordAttempt = userBalance >= COST_PER_ATTEMPT;
  const attemptsRemaining = MAX_ATTEMPTS - attemptsUsed;
  const hasAttemptsLeft = attemptsRemaining > 0;
  
  // Fetch current attempts when modal opens
  useEffect(() => {
    if (visible && photo?.mint_id) {
      fetchAuthenticityStatus();
    }
  }, [visible, photo?.mint_id]);
  
  const fetchAuthenticityStatus = async () => {
    try {
      const response = await photoGameAPI.getAuthenticityStatus(photo.mint_id);
      setAttemptsUsed(response.selfie_match_attempts || 0);
    } catch (err) {
      console.error('Failed to fetch authenticity status:', err);
    }
  };
  
  // Request permission
  const handleRequestPermission = async () => {
    const result = await requestPermission();
    if (!result.granted) {
      Alert.alert(
        'Camera Permission Required',
        'Please enable camera access in your device settings to use Face Match.',
        [{ text: 'OK' }]
      );
    }
  };
  
  // Capture photo
  const handleCapture = async () => {
    if (!cameraRef.current || !cameraReady) return;
    
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);
    
    try {
      const photo = await cameraRef.current.takePictureAsync({
        quality: 0.8,
        base64: true,
        exif: false,
      });
      
      setCapturedImage(photo);
    } catch (err) {
      console.error('Capture error:', err);
      Alert.alert('Error', 'Failed to capture photo. Please try again.');
    }
  };
  
  // Retake photo
  const handleRetake = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setCapturedImage(null);
    setMatchResult(null);
  };
  
  // Submit for matching
  const handleSubmitMatch = async () => {
    if (!capturedImage?.base64 || !photo?.mint_id) return;
    
    if (!canAffordAttempt) {
      Alert.alert('Insufficient Balance', `You need ${COST_PER_ATTEMPT} BL coins per attempt.`);
      return;
    }
    
    if (!hasAttemptsLeft) {
      Alert.alert('No Attempts Left', 'You have used all 3 attempts for this photo.');
      return;
    }
    
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    setIsMatching(true);
    setMatchResult(null);
    
    try {
      const response = await photoGameAPI.submitSelfieMatch(photo.mint_id, {
        selfie_base64: capturedImage.base64,
        mime_type: 'image/jpeg',
      });
      
      setAttemptsUsed(prev => prev + 1);
      
      if (response.success) {
        setMatchResult({
          success: true,
          score: response.match_score,
          bonus: response.authenticity_bonus_added,
          totalAuthenticity: response.total_authenticity,
        });
        
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        
        // Update user balance
        if (updateBalance) {
          updateBalance(-COST_PER_ATTEMPT);
        }
        
        // Callback
        if (onSuccess) {
          onSuccess(response);
        }
      } else {
        setMatchResult({
          success: false,
          score: response.match_score,
          message: response.message || 'Face match failed. Try again with better lighting.',
        });
        
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      }
    } catch (err) {
      console.error('Match error:', err);
      const errorMsg = err.response?.data?.detail || 'Failed to process selfie match';
      Alert.alert('Error', errorMsg);
      setMatchResult({
        success: false,
        message: errorMsg,
      });
    } finally {
      setIsMatching(false);
    }
  };
  
  // Toggle camera facing
  const handleToggleFacing = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setFacing(prev => (prev === 'front' ? 'back' : 'front'));
  };
  
  // Close and reset
  const handleClose = () => {
    setCapturedImage(null);
    setMatchResult(null);
    setCameraReady(false);
    onClose();
  };
  
  if (!visible) return null;
  
  return (
    <Modal
      visible={visible}
      animationType="slide"
      presentationStyle="fullScreen"
      onRequestClose={handleClose}
    >
      <View style={[styles.container, { backgroundColor: colors.background }]}>
        {/* Header */}
        <View style={[styles.header, { backgroundColor: colors.card }]}>
          <View style={styles.headerLeft}>
            <LinearGradient
              colors={['#A855F7', '#EC4899']}
              style={styles.headerIcon}
            >
              <Text style={styles.headerIconText}>🔐</Text>
            </LinearGradient>
            <View>
              <Text style={[styles.headerTitle, { color: colors.text }]}>
                Selfie Verification
              </Text>
              <Text style={[styles.headerSubtitle, { color: colors.textSecondary }]}>
                Add Authenticity bonus
              </Text>
            </View>
          </View>
          <Pressable onPress={handleClose} style={styles.closeButton}>
            <Text style={styles.closeButtonText}>✕</Text>
          </Pressable>
        </View>
        
        {/* Info Banner */}
        <View style={styles.infoBanner}>
          <Text style={styles.infoBannerIcon}>✨</Text>
          <View style={styles.infoBannerContent}>
            <Text style={styles.infoBannerTitle}>Earn up to +5% Authenticity Bonus</Text>
            <Text style={styles.infoBannerText}>
              Take a live selfie matching the person in your photo.
            </Text>
          </View>
        </View>
        
        {/* Attempts & Cost Info */}
        <View style={[styles.statsRow, { backgroundColor: colors.card }]}>
          <View style={styles.statItem}>
            <Text style={styles.statIcon}>📷</Text>
            <Text style={[styles.statLabel, { color: colors.textSecondary }]}>
              Attempts: <Text style={styles.statValue}>{attemptsRemaining}/{MAX_ATTEMPTS}</Text>
            </Text>
          </View>
          <View style={styles.statItem}>
            <Text style={styles.statIcon}>🪙</Text>
            <Text style={[styles.statLabel, { color: colors.textSecondary }]}>
              Cost: <Text style={[styles.statValue, { color: '#FBBF24' }]}>{COST_PER_ATTEMPT} BL</Text>
            </Text>
          </View>
        </View>
        
        {/* Reference Photo */}
        <View style={[styles.referenceSection, { backgroundColor: colors.card }]}>
          <Text style={[styles.referenceLabel, { color: colors.textSecondary }]}>
            Your minted photo:
          </Text>
          <View style={styles.referenceRow}>
            {photo?.image_url ? (
              <Image source={{ uri: photo.image_url }} style={styles.referenceImage} />
            ) : (
              <View style={[styles.referenceImage, styles.referencePlaceholder]}>
                <Text style={styles.referencePlaceholderText}>👤</Text>
              </View>
            )}
            <View style={styles.referenceInfo}>
              <Text style={[styles.referenceName, { color: colors.text }]}>
                {photo?.name || 'Photo'}
              </Text>
              <Text style={[styles.referenceAuth, { color: colors.textSecondary }]}>
                Current Authenticity: {photo?.face_detection_score || 0}%
              </Text>
            </View>
          </View>
        </View>
        
        {/* Camera / Captured View */}
        <View style={styles.cameraContainer}>
          {!permission?.granted ? (
            // Permission not granted
            <View style={styles.permissionContainer}>
              <Text style={styles.permissionIcon}>📷</Text>
              <Text style={styles.permissionTitle}>Camera Access Required</Text>
              <Text style={styles.permissionText}>
                We need camera access to capture your selfie for face matching.
              </Text>
              <Pressable onPress={handleRequestPermission} style={styles.permissionButton}>
                <LinearGradient
                  colors={['#A855F7', '#EC4899']}
                  style={styles.permissionButtonGradient}
                >
                  <Text style={styles.permissionButtonText}>Enable Camera</Text>
                </LinearGradient>
              </Pressable>
            </View>
          ) : capturedImage ? (
            // Show captured image
            <View style={styles.capturedContainer}>
              <Image source={{ uri: capturedImage.uri }} style={styles.capturedImage} />
              
              {/* Match result overlay */}
              {matchResult && (
                <View style={[
                  styles.resultOverlay,
                  { backgroundColor: matchResult.success ? 'rgba(34, 197, 94, 0.9)' : 'rgba(239, 68, 68, 0.9)' }
                ]}>
                  <Text style={styles.resultIcon}>
                    {matchResult.success ? '✅' : '❌'}
                  </Text>
                  <Text style={styles.resultTitle}>
                    {matchResult.success ? 'Match Successful!' : 'Match Failed'}
                  </Text>
                  {matchResult.score !== undefined && (
                    <Text style={styles.resultScore}>
                      Match Score: {matchResult.score}%
                    </Text>
                  )}
                  {matchResult.success && matchResult.bonus && (
                    <Text style={styles.resultBonus}>
                      +{matchResult.bonus}% Authenticity Added!
                    </Text>
                  )}
                  {!matchResult.success && matchResult.message && (
                    <Text style={styles.resultMessage}>{matchResult.message}</Text>
                  )}
                </View>
              )}
            </View>
          ) : (
            // Show camera
            <CameraView
              ref={cameraRef}
              style={styles.camera}
              facing={facing}
              onCameraReady={() => setCameraReady(true)}
            >
              {/* Camera overlay */}
              <View style={styles.cameraOverlay}>
                {/* Face guide */}
                <View style={styles.faceGuide}>
                  <View style={styles.faceGuideInner} />
                </View>
                
                {/* Toggle facing button */}
                <Pressable onPress={handleToggleFacing} style={styles.toggleFacingButton}>
                  <Text style={styles.toggleFacingIcon}>🔄</Text>
                </Pressable>
              </View>
            </CameraView>
          )}
        </View>
        
        {/* Action Buttons */}
        <View style={[styles.actionContainer, { backgroundColor: colors.card }]}>
          {!permission?.granted ? null : capturedImage ? (
            matchResult?.success ? (
              // Success - show done button
              <Pressable onPress={handleClose} style={styles.fullWidthButton}>
                <LinearGradient
                  colors={['#22C55E', '#16A34A']}
                  style={styles.actionButtonGradient}
                >
                  <Text style={styles.actionButtonText}>Done</Text>
                </LinearGradient>
              </Pressable>
            ) : (
              // Show retake and submit buttons
              <View style={styles.actionRow}>
                <Pressable onPress={handleRetake} style={styles.actionButton}>
                  <View style={[styles.secondaryButton, { borderColor: colors.border }]}>
                    <Text style={[styles.secondaryButtonText, { color: colors.text }]}>
                      Retake
                    </Text>
                  </View>
                </Pressable>
                <Pressable 
                  onPress={handleSubmitMatch} 
                  style={styles.actionButton}
                  disabled={isMatching || !hasAttemptsLeft || !canAffordAttempt}
                >
                  <LinearGradient
                    colors={['#A855F7', '#EC4899']}
                    style={[
                      styles.actionButtonGradient,
                      (!hasAttemptsLeft || !canAffordAttempt) && styles.disabledButton
                    ]}
                  >
                    {isMatching ? (
                      <ActivityIndicator color="#FFFFFF" size="small" />
                    ) : (
                      <Text style={styles.actionButtonText}>
                        Verify ({COST_PER_ATTEMPT} BL)
                      </Text>
                    )}
                  </LinearGradient>
                </Pressable>
              </View>
            )
          ) : (
            // Show capture button
            <Pressable 
              onPress={handleCapture} 
              style={styles.captureButtonContainer}
              disabled={!cameraReady}
            >
              <View style={styles.captureButtonOuter}>
                <View style={[styles.captureButtonInner, !cameraReady && styles.captureButtonDisabled]} />
              </View>
            </Pressable>
          )}
        </View>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 16,
    paddingTop: 50,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255,255,255,0.1)',
  },
  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  headerIcon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerIconText: {
    fontSize: 20,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: 'bold',
  },
  headerSubtitle: {
    fontSize: 12,
  },
  closeButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: 'rgba(255,255,255,0.1)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  closeButtonText: {
    fontSize: 18,
    color: '#9CA3AF',
  },
  infoBanner: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    padding: 12,
    margin: 16,
    marginBottom: 8,
    backgroundColor: 'rgba(168, 85, 247, 0.1)',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: 'rgba(168, 85, 247, 0.3)',
  },
  infoBannerIcon: {
    fontSize: 20,
    marginRight: 8,
  },
  infoBannerContent: {
    flex: 1,
  },
  infoBannerTitle: {
    color: '#C084FC',
    fontWeight: '600',
    fontSize: 14,
  },
  infoBannerText: {
    color: '#9CA3AF',
    fontSize: 12,
    marginTop: 2,
  },
  statsRow: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    padding: 12,
    marginHorizontal: 16,
    borderRadius: 12,
  },
  statItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  statIcon: {
    fontSize: 16,
  },
  statLabel: {
    fontSize: 13,
  },
  statValue: {
    fontWeight: 'bold',
    color: '#FFFFFF',
  },
  referenceSection: {
    padding: 12,
    margin: 16,
    marginTop: 8,
    borderRadius: 12,
  },
  referenceLabel: {
    fontSize: 12,
    marginBottom: 8,
  },
  referenceRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  referenceImage: {
    width: 56,
    height: 56,
    borderRadius: 8,
  },
  referencePlaceholder: {
    backgroundColor: '#374151',
    alignItems: 'center',
    justifyContent: 'center',
  },
  referencePlaceholderText: {
    fontSize: 28,
  },
  referenceInfo: {
    flex: 1,
  },
  referenceName: {
    fontWeight: '600',
  },
  referenceAuth: {
    fontSize: 12,
    marginTop: 2,
  },
  cameraContainer: {
    flex: 1,
    margin: 16,
    borderRadius: 16,
    overflow: 'hidden',
    backgroundColor: '#1F2937',
  },
  camera: {
    flex: 1,
  },
  cameraOverlay: {
    flex: 1,
    position: 'relative',
  },
  faceGuide: {
    position: 'absolute',
    top: '15%',
    left: '20%',
    right: '20%',
    aspectRatio: 1,
    borderRadius: 1000,
    borderWidth: 2,
    borderColor: 'rgba(168, 85, 247, 0.5)',
    borderStyle: 'dashed',
  },
  faceGuideInner: {
    flex: 1,
    borderRadius: 1000,
    backgroundColor: 'rgba(168, 85, 247, 0.1)',
  },
  toggleFacingButton: {
    position: 'absolute',
    bottom: 16,
    right: 16,
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  toggleFacingIcon: {
    fontSize: 24,
  },
  capturedContainer: {
    flex: 1,
    position: 'relative',
  },
  capturedImage: {
    flex: 1,
    resizeMode: 'cover',
  },
  resultOverlay: {
    position: 'absolute',
    inset: 0,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 20,
  },
  resultIcon: {
    fontSize: 48,
    marginBottom: 12,
  },
  resultTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#FFFFFF',
    marginBottom: 8,
  },
  resultScore: {
    fontSize: 16,
    color: '#FFFFFF',
    opacity: 0.9,
  },
  resultBonus: {
    fontSize: 18,
    fontWeight: '600',
    color: '#FFFFFF',
    marginTop: 8,
  },
  resultMessage: {
    fontSize: 14,
    color: '#FFFFFF',
    opacity: 0.9,
    textAlign: 'center',
    marginTop: 8,
  },
  permissionContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 20,
  },
  permissionIcon: {
    fontSize: 48,
    marginBottom: 16,
  },
  permissionTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#FFFFFF',
    marginBottom: 8,
  },
  permissionText: {
    fontSize: 14,
    color: '#9CA3AF',
    textAlign: 'center',
    marginBottom: 24,
  },
  permissionButton: {
    borderRadius: 12,
    overflow: 'hidden',
  },
  permissionButtonGradient: {
    paddingVertical: 12,
    paddingHorizontal: 24,
  },
  permissionButtonText: {
    color: '#FFFFFF',
    fontWeight: '600',
    fontSize: 16,
  },
  actionContainer: {
    padding: 16,
    paddingBottom: 32,
    borderTopWidth: 1,
    borderTopColor: 'rgba(255,255,255,0.1)',
  },
  actionRow: {
    flexDirection: 'row',
    gap: 12,
  },
  actionButton: {
    flex: 1,
  },
  fullWidthButton: {
    borderRadius: 12,
    overflow: 'hidden',
  },
  actionButtonGradient: {
    paddingVertical: 14,
    alignItems: 'center',
    borderRadius: 12,
  },
  actionButtonText: {
    color: '#FFFFFF',
    fontWeight: '600',
    fontSize: 16,
  },
  secondaryButton: {
    paddingVertical: 14,
    alignItems: 'center',
    borderRadius: 12,
    borderWidth: 1,
  },
  secondaryButtonText: {
    fontWeight: '600',
    fontSize: 16,
  },
  disabledButton: {
    opacity: 0.5,
  },
  captureButtonContainer: {
    alignItems: 'center',
  },
  captureButtonOuter: {
    width: 72,
    height: 72,
    borderRadius: 36,
    borderWidth: 4,
    borderColor: '#A855F7',
    padding: 4,
  },
  captureButtonInner: {
    flex: 1,
    borderRadius: 30,
    backgroundColor: '#A855F7',
  },
  captureButtonDisabled: {
    opacity: 0.5,
  },
});

export default FaceMatchModal;
