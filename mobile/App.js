/**
 * Blendlink Mobile App
 * React Native/Expo app sharing backend with PWA
 */

import React, { useEffect } from 'react';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { AuthProvider, useAuth } from './src/context/AuthContext';
import { ThemeProvider, useTheme } from './src/context/ThemeContext';
import { PushNotificationProvider, usePushNotifications } from './src/context/PushNotificationContext';
import Navigation from './src/navigation';

// Status bar component that respects theme
const ThemedStatusBar = () => {
  const { isDark } = useTheme();
  return <StatusBar style={isDark ? 'light' : 'dark'} />;
};

// Initialize push notifications when user is authenticated
const PushNotificationInitializer = ({ children }) => {
  const { user } = useAuth();
  const { initialize } = usePushNotifications();

  useEffect(() => {
    if (user) {
      // Register for push notifications when user is logged in
      initialize();
    }
  }, [user]);

  return children;
};

export default function App() {
  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <SafeAreaProvider>
        <ThemeProvider>
          <AuthProvider>
            <PushNotificationProvider>
              <PushNotificationInitializer>
                <ThemedStatusBar />
                <Navigation />
              </PushNotificationInitializer>
            </PushNotificationProvider>
          </AuthProvider>
        </ThemeProvider>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}
