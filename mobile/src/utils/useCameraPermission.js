/**
 * Camera Permission Hook for Mobile
 * 
 * Handles camera permissions for future selfie verification feature
 * (Authenticity bonus for dollar value calculation)
 */

import { useState, useEffect, useCallback } from 'react';
import { Platform, Linking, Alert } from 'react-native';
import * as Camera from 'expo-camera';

export const CameraPermissionStatus = {
  UNDETERMINED: 'undetermined',
  GRANTED: 'granted',
  DENIED: 'denied',
};

/**
 * Hook to manage camera permissions
 * 
 * @returns {Object} Permission status and request functions
 */
export function useCameraPermission() {
  const [status, setStatus] = useState(CameraPermissionStatus.UNDETERMINED);
  const [isLoading, setIsLoading] = useState(true);

  // Check current permission status
  const checkPermission = useCallback(async () => {
    try {
      const { status: currentStatus } = await Camera.getCameraPermissionsAsync();
      
      if (currentStatus === 'granted') {
        setStatus(CameraPermissionStatus.GRANTED);
      } else if (currentStatus === 'denied') {
        setStatus(CameraPermissionStatus.DENIED);
      } else {
        setStatus(CameraPermissionStatus.UNDETERMINED);
      }
    } catch (error) {
      console.error('Error checking camera permission:', error);
      setStatus(CameraPermissionStatus.DENIED);
    } finally {
      setIsLoading(false);
    }
  }, []);

  // Request permission
  const requestPermission = useCallback(async () => {
    try {
      setIsLoading(true);
      const { status: newStatus } = await Camera.requestCameraPermissionsAsync();
      
      if (newStatus === 'granted') {
        setStatus(CameraPermissionStatus.GRANTED);
        return true;
      } else {
        setStatus(CameraPermissionStatus.DENIED);
        return false;
      }
    } catch (error) {
      console.error('Error requesting camera permission:', error);
      setStatus(CameraPermissionStatus.DENIED);
      return false;
    } finally {
      setIsLoading(false);
    }
  }, []);

  // Open app settings for permission
  const openSettings = useCallback(() => {
    if (Platform.OS === 'ios') {
      Linking.openURL('app-settings:');
    } else {
      Linking.openSettings();
    }
  }, []);

  // Show permission dialog with explanation
  const requestWithExplanation = useCallback(async (reason = 'selfie_verification') => {
    const explanations = {
      selfie_verification: {
        title: '📸 Camera Access Required',
        message: 'To verify your identity for the Authenticity Bonus, we need access to your camera. This helps prevent photo theft and gives you a +10% dollar value boost!',
      },
      photo_minting: {
        title: '📸 Camera Access Required',
        message: 'To mint new photos, we need access to your camera.',
      },
      default: {
        title: '📸 Camera Access',
        message: 'This feature requires camera access.',
      },
    };

    const explanation = explanations[reason] || explanations.default;

    if (status === CameraPermissionStatus.DENIED) {
      // Permission was previously denied, show alert to open settings
      Alert.alert(
        explanation.title,
        `${explanation.message}\n\nPlease enable camera access in your device settings.`,
        [
          { text: 'Cancel', style: 'cancel' },
          { text: 'Open Settings', onPress: openSettings },
        ]
      );
      return false;
    }

    if (status === CameraPermissionStatus.GRANTED) {
      return true;
    }

    // First time asking - show explanation then request
    return new Promise((resolve) => {
      Alert.alert(
        explanation.title,
        explanation.message,
        [
          { 
            text: 'Not Now', 
            style: 'cancel',
            onPress: () => resolve(false),
          },
          { 
            text: 'Allow Camera', 
            onPress: async () => {
              const granted = await requestPermission();
              resolve(granted);
            },
          },
        ]
      );
    });
  }, [status, openSettings, requestPermission]);

  // Check permission on mount
  useEffect(() => {
    checkPermission();
  }, [checkPermission]);

  return {
    status,
    isLoading,
    isGranted: status === CameraPermissionStatus.GRANTED,
    isDenied: status === CameraPermissionStatus.DENIED,
    isUndetermined: status === CameraPermissionStatus.UNDETERMINED,
    checkPermission,
    requestPermission,
    requestWithExplanation,
    openSettings,
  };
}

/**
 * Stub component for future selfie verification feature
 * 
 * This will be expanded to include:
 * - Live video selfie capture
 * - Face detection via GPT-4o Vision
 * - Identity verification flow
 */
export function SelfieVerificationStub() {
  // Placeholder for future implementation
  return null;
}

export default useCameraPermission;
