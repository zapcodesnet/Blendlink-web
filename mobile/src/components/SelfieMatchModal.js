/**
 * SelfieMatchModal Component (Mobile)
 * 
 * Live selfie match for Authenticity bonus verification on minted photos.
 * Uses Expo Camera for capturing selfies and AI face comparison.
 * 
 * Features:
 * - Up to 3 attempts (100 BL coins each)
 * - Front camera capture with mirror preview
 * - Face comparison via GPT-4o Vision
 * - Up to 5% Authenticity bonus on match
 */

import React, { useState, useRef, useCallback, useEffect } from 'react';
import {
  View,
  Text,
  Modal,
  TouchableOpacity,
  StyleSheet,
  Image,
  Dimensions,
  ActivityIndicator,
  Alert,
  Platform,
} from 'react-native';
import { CameraView, useCameraPermissions } from 'expo-camera';
import * as ImageManipulator from 'expo-image-manipulator';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { mintingAPI } from '../services/api';

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window');

// Constants per spec
const COST_PER_ATTEMPT = 100; // BL coins
const MAX_ATTEMPTS = 3;

const SelfieMatchModal = ({
  visible,
  onClose,
  photo, // The minted photo to match against
  onSuccess, // Callback when match succeeds
  userBalance = 0, // User's BL coin balance
}) => {
  // Camera permissions
  const [permission, requestPermission] = useCameraPermissions();
  
  // Camera state
  const [cameraReady, setCameraReady] = useState(false);
  const [capturedImage, setCapturedImage] = useState(null);
  
  // Match state
  const [isMatching, setIsMatching] = useState(false);
  const [matchResult, setMatchResult] = useState(null);
  const [attemptsUsed, setAttemptsUsed] = useState(0);
  const [authenticityStatus, setAuthenticityStatus] = useState(null);
  
  // Refs
  const cameraRef = useRef(null);
  
  // Computed values
  const canAffordAttempt = userBalance >= COST_PER_ATTEMPT;
  const attemptsRemaining = MAX_ATTEMPTS - attemptsUsed;
  const hasAttemptsLeft = attemptsRemaining > 0;
  
  // Load authenticity status when modal opens
  useEffect(() => {
    if (visible && photo?.mint_id) {
      loadAuthenticityStatus();
    }
  }, [visible, photo?.mint_id]);
  
  // Reset state when modal closes
  useEffect(() => {
    if (!visible) {
      setCapturedImage(null);
      setMatchResult(null);
      setCameraReady(false);
    }
  }, [visible]);
  
  const loadAuthenticityStatus = async () => {
    try {
      const status = await mintingAPI.getAuthenticityStatus(photo.mint_id);
      setAuthenticityStatus(status);
      setAttemptsUsed(status.selfie_match_attempts || 0);
    } catch (error) {
      console.error('Failed to load authenticity status:', error);
    }
  };
  
  // Request camera permission
  const handleRequestPermission = async () => {
    const result = await requestPermission();
    if (!result.granted) {
      Alert.alert(
        'Camera Permission Required',
        'Please allow camera access to take a selfie for face verification.',
        [{ text: 'OK' }]
      );
    }
  };
  
  // Capture photo
  const capturePhoto = async () => {
    if (!cameraRef.current || !cameraReady) return;
    
    try {
      const photo = await cameraRef.current.takePictureAsync({
        quality: 0.8,
        base64: false,
        skipProcessing: true,
      });
      
      // Resize and compress the image
      const manipulated = await ImageManipulator.manipulateAsync(
        photo.uri,
        [{ resize: { width: 640 } }],
        { compress: 0.8, format: ImageManipulator.SaveFormat.JPEG, base64: true }
      );
      
      setCapturedImage({
        uri: manipulated.uri,
        base64: manipulated.base64,
      });
    } catch (error) {
      console.error('Capture error:', error);
      Alert.alert('Error', 'Failed to capture photo. Please try again.');
    }
  };
  
  // Retake photo
  const retakePhoto = () => {
    setCapturedImage(null);
    setMatchResult(null);
  };
  
  // Submit selfie for matching
  const submitMatch = async () => {
    if (!capturedImage?.base64 || !photo?.mint_id) return;
    
    if (!canAffordAttempt) {
      Alert.alert(
        'Insufficient Balance',
        `You need ${COST_PER_ATTEMPT} BL coins for each verification attempt.`,
        [{ text: 'OK' }]
      );
      return;
    }
    
    if (!hasAttemptsLeft) {
      Alert.alert(
        'No Attempts Left',
        'You have used all 3 attempts for this photo.',
        [{ text: 'OK' }]
      );
      return;
    }
    
    setIsMatching(true);
    setMatchResult(null);
    
    try {
      const result = await mintingAPI.submitSelfieMatch(
        photo.mint_id,
        capturedImage.base64,
        'image/jpeg'
      );
      
      setAttemptsUsed(prev => prev + 1);
      
      if (result.success) {
        setMatchResult({
          success: true,
          score: result.match_score,
          confidence: result.confidence,
          bonus: result.authenticity_bonus,
          notes: result.notes,
          message: result.message,
        });
        
        // Callback on success
        if (onSuccess) {
          onSuccess(result);
        }
      } else {
        setMatchResult({
          success: false,
          score: result.match_score,
          message: result.message || 'Face match was not successful',
          notes: result.notes,
        });
      }
    } catch (error) {
      console.error('Match error:', error);
      const errorMsg = error.response?.data?.detail || 'Failed to process selfie match';
      setMatchResult({
        success: false,
        message: errorMsg,
      });
      Alert.alert('Error', errorMsg);
    } finally {
      setIsMatching(false);
    }
  };
  
  // Render permission request view
  const renderPermissionRequest = () => (
    <View style={styles.centeredContent}>
      <MaterialCommunityIcons name="camera-off" size={64} color="#6b7280" />
      <Text style={styles.permissionTitle}>Camera Access Required</Text>
      <Text style={styles.permissionText}>
        We need camera access to verify your identity by matching your face with the photo.
      </Text>
      <TouchableOpacity
        style={styles.primaryButton}
        onPress={handleRequestPermission}
      >
        <Ionicons name="camera" size={20} color="#fff" />
        <Text style={styles.primaryButtonText}>Allow Camera</Text>
      </TouchableOpacity>
    </View>
  );
  
  // Render camera view
  const renderCameraView = () => (
    <View style={styles.cameraContainer}>
      <CameraView
        ref={cameraRef}
        style={styles.camera}
        facing="front"
        onCameraReady={() => setCameraReady(true)}
      >
        {/* Overlay guide */}
        <View style={styles.cameraOverlay}>
          <View style={styles.faceGuide}>
            <Text style={styles.guideText}>Position your face here</Text>
          </View>
        </View>
      </CameraView>
      
      {/* Capture button */}
      <View style={styles.captureButtonContainer}>
        <TouchableOpacity
          style={[styles.captureButton, !cameraReady && styles.captureButtonDisabled]}
          onPress={capturePhoto}
          disabled={!cameraReady}
        >
          <View style={styles.captureButtonInner} />
        </TouchableOpacity>
      </View>
    </View>
  );
  
  // Render captured image preview
  const renderPreview = () => (
    <View style={styles.previewContainer}>
      <Image
        source={{ uri: capturedImage.uri }}
        style={styles.previewImage}
        resizeMode="cover"
      />
      
      {/* Action buttons */}
      <View style={styles.previewActions}>
        <TouchableOpacity
          style={styles.secondaryButton}
          onPress={retakePhoto}
          disabled={isMatching}
        >
          <Ionicons name="refresh" size={20} color="#fff" />
          <Text style={styles.secondaryButtonText}>Retake</Text>
        </TouchableOpacity>
        
        <TouchableOpacity
          style={[
            styles.primaryButton,
            (!canAffordAttempt || !hasAttemptsLeft || isMatching) && styles.primaryButtonDisabled
          ]}
          onPress={submitMatch}
          disabled={!canAffordAttempt || !hasAttemptsLeft || isMatching}
        >
          {isMatching ? (
            <>
              <ActivityIndicator size="small" color="#fff" />
              <Text style={styles.primaryButtonText}>Matching...</Text>
            </>
          ) : (
            <>
              <Ionicons name="checkmark-circle" size={20} color="#fff" />
              <Text style={styles.primaryButtonText}>
                Verify ({COST_PER_ATTEMPT} BL)
              </Text>
            </>
          )}
        </TouchableOpacity>
      </View>
    </View>
  );
  
  // Render match result
  const renderMatchResult = () => (
    <View style={styles.resultContainer}>
      {matchResult.success ? (
        <>
          <View style={styles.successIcon}>
            <Ionicons name="checkmark-circle" size={72} color="#10b981" />
          </View>
          <Text style={styles.resultTitle}>Match Successful!</Text>
          <Text style={styles.resultScore}>
            {matchResult.score}% Match
          </Text>
          <Text style={styles.resultBonus}>
            +{matchResult.bonus?.toFixed(1) || 0}% Authenticity Bonus
          </Text>
          <Text style={styles.resultConfidence}>
            Confidence: {matchResult.confidence || 'N/A'}
          </Text>
          {matchResult.notes && (
            <Text style={styles.resultNotes}>{matchResult.notes}</Text>
          )}
        </>
      ) : (
        <>
          <View style={styles.failIcon}>
            <Ionicons name="close-circle" size={72} color="#ef4444" />
          </View>
          <Text style={styles.resultTitle}>Match Failed</Text>
          {matchResult.score !== undefined && (
            <Text style={styles.resultScore}>
              {matchResult.score}% Match
            </Text>
          )}
          <Text style={styles.resultMessage}>
            {matchResult.message || 'Face verification was not successful'}
          </Text>
          {matchResult.notes && (
            <Text style={styles.resultNotes}>{matchResult.notes}</Text>
          )}
        </>
      )}
      
      <View style={styles.resultActions}>
        {hasAttemptsLeft && !matchResult.success && (
          <TouchableOpacity
            style={styles.secondaryButton}
            onPress={retakePhoto}
          >
            <Ionicons name="refresh" size={20} color="#fff" />
            <Text style={styles.secondaryButtonText}>Try Again</Text>
          </TouchableOpacity>
        )}
        <TouchableOpacity
          style={styles.closeButton}
          onPress={onClose}
        >
          <Text style={styles.closeButtonText}>Done</Text>
        </TouchableOpacity>
      </View>
      
      <Text style={styles.attemptsText}>
        {attemptsRemaining} attempt{attemptsRemaining !== 1 ? 's' : ''} remaining
      </Text>
    </View>
  );
  
  // Check if photo is eligible for selfie match
  const canMatchSelfie = photo?.has_face && photo?.face_detection_score > 10;
  
  return (
    <Modal
      visible={visible}
      animationType="slide"
      presentationStyle="fullScreen"
      onRequestClose={onClose}
    >
      <View style={styles.container}>
        {/* Header */}
        <View style={styles.header}>
          <TouchableOpacity
            style={styles.closeIcon}
            onPress={onClose}
          >
            <Ionicons name="close" size={28} color="#fff" />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Selfie Verification</Text>
          <View style={styles.headerRight}>
            <MaterialCommunityIcons name="shield-check" size={24} color="#10b981" />
          </View>
        </View>
        
        {/* Photo being matched */}
        {photo && (
          <View style={styles.photoPreview}>
            <Image
              source={{ uri: photo.image_url || photo.thumbnail_url }}
              style={styles.photoThumbnail}
            />
            <View style={styles.photoInfo}>
              <Text style={styles.photoName} numberOfLines={1}>
                {photo.name || 'Unnamed Photo'}
              </Text>
              <Text style={styles.photoDetail}>
                Face detected: {photo.face_detection_score || 0}%
              </Text>
            </View>
          </View>
        )}
        
        {/* Cost and attempts info */}
        <View style={styles.infoBar}>
          <View style={styles.infoItem}>
            <MaterialCommunityIcons name="coins" size={18} color="#f59e0b" />
            <Text style={styles.infoText}>
              Cost: {COST_PER_ATTEMPT} BL
            </Text>
          </View>
          <View style={styles.infoItem}>
            <Ionicons name="refresh-circle" size={18} color="#3b82f6" />
            <Text style={styles.infoText}>
              {attemptsRemaining}/{MAX_ATTEMPTS} attempts
            </Text>
          </View>
          <View style={styles.infoItem}>
            <MaterialCommunityIcons name="wallet" size={18} color="#10b981" />
            <Text style={styles.infoText}>
              Balance: {Math.floor(userBalance).toLocaleString()} BL
            </Text>
          </View>
        </View>
        
        {/* Main content */}
        <View style={styles.content}>
          {!canMatchSelfie ? (
            <View style={styles.centeredContent}>
              <MaterialCommunityIcons name="face-recognition" size={64} color="#6b7280" />
              <Text style={styles.errorTitle}>Face Not Detected</Text>
              <Text style={styles.errorText}>
                This photo doesn't have a clear face detected. Only photos with faces can be verified.
              </Text>
              <TouchableOpacity style={styles.closeButton} onPress={onClose}>
                <Text style={styles.closeButtonText}>Close</Text>
              </TouchableOpacity>
            </View>
          ) : !permission?.granted ? (
            renderPermissionRequest()
          ) : matchResult ? (
            renderMatchResult()
          ) : capturedImage ? (
            renderPreview()
          ) : (
            renderCameraView()
          )}
        </View>
        
        {/* Instructions */}
        {!matchResult && canMatchSelfie && permission?.granted && !capturedImage && (
          <View style={styles.instructions}>
            <Text style={styles.instructionTitle}>How it works:</Text>
            <Text style={styles.instructionText}>
              1. Take a clear selfie of your face{'\n'}
              2. AI compares it with the face in your photo{'\n'}
              3. 80%+ match = +5% Authenticity bonus{'\n'}
              4. Lower matches earn partial bonus
            </Text>
          </View>
        )}
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#111827',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingTop: Platform.OS === 'ios' ? 50 : 16,
    paddingBottom: 16,
    backgroundColor: '#1f2937',
  },
  closeIcon: {
    padding: 4,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#fff',
  },
  headerRight: {
    width: 36,
    alignItems: 'center',
  },
  photoPreview: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
    backgroundColor: '#1f2937',
    marginHorizontal: 16,
    marginTop: 12,
    borderRadius: 12,
  },
  photoThumbnail: {
    width: 60,
    height: 60,
    borderRadius: 8,
  },
  photoInfo: {
    flex: 1,
    marginLeft: 12,
  },
  photoName: {
    fontSize: 16,
    fontWeight: '600',
    color: '#fff',
    marginBottom: 4,
  },
  photoDetail: {
    fontSize: 13,
    color: '#9ca3af',
  },
  infoBar: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    padding: 12,
    marginHorizontal: 16,
    marginTop: 8,
    backgroundColor: '#1f2937',
    borderRadius: 12,
  },
  infoItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  infoText: {
    fontSize: 12,
    color: '#d1d5db',
  },
  content: {
    flex: 1,
    padding: 16,
  },
  centeredContent: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  permissionTitle: {
    fontSize: 20,
    fontWeight: '600',
    color: '#fff',
    marginTop: 16,
    textAlign: 'center',
  },
  permissionText: {
    fontSize: 14,
    color: '#9ca3af',
    marginTop: 8,
    textAlign: 'center',
    marginBottom: 24,
  },
  errorTitle: {
    fontSize: 20,
    fontWeight: '600',
    color: '#ef4444',
    marginTop: 16,
    textAlign: 'center',
  },
  errorText: {
    fontSize: 14,
    color: '#9ca3af',
    marginTop: 8,
    textAlign: 'center',
    marginBottom: 24,
    paddingHorizontal: 24,
  },
  cameraContainer: {
    flex: 1,
    borderRadius: 16,
    overflow: 'hidden',
  },
  camera: {
    flex: 1,
  },
  cameraOverlay: {
    ...StyleSheet.absoluteFillObject,
    justifyContent: 'center',
    alignItems: 'center',
  },
  faceGuide: {
    width: 250,
    height: 320,
    borderWidth: 3,
    borderColor: 'rgba(255, 255, 255, 0.5)',
    borderRadius: 150,
    justifyContent: 'flex-end',
    alignItems: 'center',
    paddingBottom: 20,
  },
  guideText: {
    color: '#fff',
    fontSize: 14,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: 8,
  },
  captureButtonContainer: {
    position: 'absolute',
    bottom: 30,
    left: 0,
    right: 0,
    alignItems: 'center',
  },
  captureButton: {
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: 'rgba(255, 255, 255, 0.3)',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 4,
    borderColor: '#fff',
  },
  captureButtonDisabled: {
    opacity: 0.5,
  },
  captureButtonInner: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: '#fff',
  },
  previewContainer: {
    flex: 1,
    borderRadius: 16,
    overflow: 'hidden',
  },
  previewImage: {
    flex: 1,
    borderRadius: 16,
    transform: [{ scaleX: -1 }], // Mirror the preview
  },
  previewActions: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    padding: 16,
    gap: 12,
  },
  primaryButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#3b82f6',
    paddingVertical: 14,
    paddingHorizontal: 24,
    borderRadius: 12,
    gap: 8,
    flex: 1,
  },
  primaryButtonDisabled: {
    backgroundColor: '#4b5563',
  },
  primaryButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  secondaryButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#374151',
    paddingVertical: 14,
    paddingHorizontal: 24,
    borderRadius: 12,
    gap: 8,
    flex: 1,
  },
  secondaryButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  resultContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  successIcon: {
    marginBottom: 16,
  },
  failIcon: {
    marginBottom: 16,
  },
  resultTitle: {
    fontSize: 24,
    fontWeight: '700',
    color: '#fff',
    marginBottom: 12,
  },
  resultScore: {
    fontSize: 36,
    fontWeight: '700',
    color: '#10b981',
    marginBottom: 8,
  },
  resultBonus: {
    fontSize: 18,
    fontWeight: '600',
    color: '#f59e0b',
    marginBottom: 8,
  },
  resultConfidence: {
    fontSize: 14,
    color: '#9ca3af',
    marginBottom: 8,
  },
  resultMessage: {
    fontSize: 14,
    color: '#ef4444',
    textAlign: 'center',
    marginBottom: 12,
  },
  resultNotes: {
    fontSize: 13,
    color: '#6b7280',
    textAlign: 'center',
    fontStyle: 'italic',
    marginTop: 8,
  },
  resultActions: {
    flexDirection: 'row',
    gap: 12,
    marginTop: 24,
  },
  closeButton: {
    backgroundColor: '#374151',
    paddingVertical: 14,
    paddingHorizontal: 32,
    borderRadius: 12,
  },
  closeButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  attemptsText: {
    marginTop: 24,
    fontSize: 13,
    color: '#6b7280',
  },
  instructions: {
    padding: 16,
    marginHorizontal: 16,
    marginBottom: 24,
    backgroundColor: '#1f2937',
    borderRadius: 12,
  },
  instructionTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: '#fff',
    marginBottom: 8,
  },
  instructionText: {
    fontSize: 13,
    color: '#9ca3af',
    lineHeight: 20,
  },
});

export default SelfieMatchModal;
