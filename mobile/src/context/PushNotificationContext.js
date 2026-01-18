/**
 * Push Notifications Context for Blendlink Mobile
 * Handles Expo push notification registration and handling
 */

import React, { createContext, useState, useContext, useEffect, useRef } from 'react';
import * as Notifications from 'expo-notifications';
import * as Device from 'expo-device';
import Constants from 'expo-constants';
import { Platform } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { pushNotificationsAPI } from '../services/api';

// Configure notification behavior
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: true,
  }),
});

export const PushNotificationContext = createContext(null);

export const PushNotificationProvider = ({ children }) => {
  const [expoPushToken, setExpoPushToken] = useState(null);
  const [notification, setNotification] = useState(null);
  const [isRegistered, setIsRegistered] = useState(false);
  const notificationListener = useRef();
  const responseListener = useRef();

  useEffect(() => {
    // Set up notification listeners
    notificationListener.current = Notifications.addNotificationReceivedListener(notification => {
      setNotification(notification);
      console.log('Notification received:', notification);
    });

    responseListener.current = Notifications.addNotificationResponseReceivedListener(response => {
      const data = response.notification.request.content.data;
      handleNotificationNavigation(data);
    });

    return () => {
      Notifications.removeNotificationSubscription(notificationListener.current);
      Notifications.removeNotificationSubscription(responseListener.current);
    };
  }, []);

  const handleNotificationNavigation = (data) => {
    // Handle navigation based on notification type
    const screen = data?.screen;
    if (screen) {
      // Navigation will be handled by the consuming component
      console.log('Navigate to:', screen, data);
    }
  };

  const registerForPushNotifications = async () => {
    if (!Device.isDevice) {
      console.log('Push notifications require a physical device');
      return null;
    }

    try {
      // Check existing permissions
      const { status: existingStatus } = await Notifications.getPermissionsAsync();
      let finalStatus = existingStatus;

      // Request permission if not granted
      if (existingStatus !== 'granted') {
        const { status } = await Notifications.requestPermissionsAsync();
        finalStatus = status;
      }

      if (finalStatus !== 'granted') {
        console.log('Push notification permission not granted');
        return null;
      }

      // Get Expo push token
      const projectId = Constants.expoConfig?.extra?.eas?.projectId ?? Constants.easConfig?.projectId;
      const tokenData = await Notifications.getExpoPushTokenAsync({
        projectId,
      });
      const token = tokenData.data;

      // Set up Android notification channel
      if (Platform.OS === 'android') {
        await Notifications.setNotificationChannelAsync('default', {
          name: 'default',
          importance: Notifications.AndroidImportance.MAX,
          vibrationPattern: [0, 250, 250, 250],
          lightColor: '#8B5CF6',
        });

        await Notifications.setNotificationChannelAsync('games', {
          name: 'Game Notifications',
          importance: Notifications.AndroidImportance.HIGH,
          vibrationPattern: [0, 250, 250, 250],
          lightColor: '#8B5CF6',
        });

        await Notifications.setNotificationChannelAsync('marketplace', {
          name: 'Marketplace Notifications',
          importance: Notifications.AndroidImportance.DEFAULT,
          lightColor: '#22C55E',
        });
      }

      setExpoPushToken(token);
      return token;
    } catch (error) {
      console.error('Error registering for push notifications:', error);
      return null;
    }
  };

  const registerTokenWithServer = async (token) => {
    try {
      const deviceInfo = {
        platform: Platform.OS,
        version: Platform.Version,
        model: Device.modelName,
        brand: Device.brand,
      };

      await pushNotificationsAPI.registerToken(token, deviceInfo);
      setIsRegistered(true);
      console.log('Push token registered with server');
      return true;
    } catch (error) {
      console.error('Failed to register token with server:', error);
      return false;
    }
  };

  const unregisterToken = async () => {
    if (expoPushToken) {
      try {
        await pushNotificationsAPI.unregisterToken(expoPushToken);
        setIsRegistered(false);
        console.log('Push token unregistered');
      } catch (error) {
        console.error('Failed to unregister token:', error);
      }
    }
  };

  const sendTestNotification = async () => {
    try {
      const result = await pushNotificationsAPI.testNotification();
      return result;
    } catch (error) {
      console.error('Failed to send test notification:', error);
      return { success: false };
    }
  };

  const initialize = async () => {
    const token = await registerForPushNotifications();
    if (token) {
      await registerTokenWithServer(token);
    }
    return token;
  };

  return (
    <PushNotificationContext.Provider
      value={{
        expoPushToken,
        notification,
        isRegistered,
        initialize,
        registerForPushNotifications,
        registerTokenWithServer,
        unregisterToken,
        sendTestNotification,
      }}
    >
      {children}
    </PushNotificationContext.Provider>
  );
};

export const usePushNotifications = () => {
  const context = useContext(PushNotificationContext);
  if (!context) {
    throw new Error('usePushNotifications must be used within a PushNotificationProvider');
  }
  return context;
};
