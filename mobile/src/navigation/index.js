/**
 * Navigation Configuration for Blendlink Mobile
 */

import React, { useState, useEffect } from 'react';
import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { View, Text, StyleSheet } from 'react-native';
import { useAuth } from '../context/AuthContext';

// Screens
import LoginScreen from '../screens/LoginScreen';
import RegisterScreen from '../screens/RegisterScreen';
import SocialFeedScreen from '../screens/SocialFeedScreen';
import ProfileScreen from '../screens/ProfileScreen';
import NotificationsScreen from '../screens/NotificationsScreen';
import AnalyticsDashboardScreen from '../screens/AnalyticsDashboardScreen';
import AICreateScreen from '../screens/AICreateScreen';
import SellerDashboardScreen from '../screens/SellerDashboardScreen';
import MarketplaceScreen from '../screens/MarketplaceScreen';
import GamesScreen from '../screens/GamesScreen';
import CasinoScreen from '../screens/CasinoScreen';
import CasinoGameScreen from '../screens/CasinoGameScreen';
import CasinoStatsScreen from '../screens/CasinoStatsScreen';

// Admin Screens
import AdminScreen from '../screens/AdminScreen';
import AdminAnalyticsScreen from '../screens/AdminAnalyticsScreen';
import AdminABTestingScreen from '../screens/AdminABTestingScreen';
import AdminSettingsScreen from '../screens/AdminSettingsScreen';

// API for notification count
import { notificationsAPI } from '../services/api';

// Placeholder screens (to be implemented)
const WalletScreen = () => (
  <View style={styles.placeholder}>
    <Text style={styles.placeholderIcon}>💰</Text>
    <Text style={styles.placeholderTitle}>Wallet</Text>
    <Text style={styles.placeholderText}>Coming Soon</Text>
  </View>
);

const CreatePostScreen = () => (
  <View style={styles.placeholder}>
    <Text style={styles.placeholderIcon}>✍️</Text>
    <Text style={styles.placeholderTitle}>Create Post</Text>
    <Text style={styles.placeholderText}>Coming Soon</Text>
  </View>
);

const FriendsScreen = () => (
  <View style={styles.placeholder}>
    <Text style={styles.placeholderIcon}>👥</Text>
    <Text style={styles.placeholderTitle}>Friends</Text>
    <Text style={styles.placeholderText}>Coming Soon</Text>
  </View>
);

const SettingsScreen = () => (
  <View style={styles.placeholder}>
    <Text style={styles.placeholderIcon}>⚙️</Text>
    <Text style={styles.placeholderTitle}>Settings</Text>
    <Text style={styles.placeholderText}>Coming Soon</Text>
  </View>
);

const Stack = createNativeStackNavigator();
const Tab = createBottomTabNavigator();

// Tab Icon Component with Badge
const TabIcon = ({ icon, focused, badge }) => (
  <View style={styles.tabIconContainer}>
    <Text style={[styles.tabIcon, focused && styles.tabIconFocused]}>{icon}</Text>
    {badge > 0 && (
      <View style={styles.badge}>
        <Text style={styles.badgeText}>{badge > 99 ? '99+' : badge}</Text>
      </View>
    )}
  </View>
);

// Tab Bar Options
const tabBarOptions = {
  tabBarStyle: {
    backgroundColor: '#1E293B',
    borderTopColor: '#334155',
    height: 80,
    paddingBottom: 20,
    paddingTop: 10,
  },
  tabBarActiveTintColor: '#2563EB',
  tabBarInactiveTintColor: '#9CA3AF',
  tabBarLabelStyle: {
    fontSize: 11,
    fontWeight: '500',
  },
  headerShown: false,
};

// Main Tab Navigator
function MainTabs() {
  const [unreadCount, setUnreadCount] = useState(0);

  // Fetch unread notification count
  useEffect(() => {
    const fetchUnreadCount = async () => {
      try {
        const data = await notificationsAPI.getNotifications(0, 1, false);
        setUnreadCount(data.unread_count || 0);
      } catch (error) {
        console.error('Failed to fetch notification count:', error);
      }
    };

    fetchUnreadCount();
    const interval = setInterval(fetchUnreadCount, 30000);
    return () => clearInterval(interval);
  }, []);

  return (
    <Tab.Navigator screenOptions={tabBarOptions}>
      <Tab.Screen
        name="Feed"
        component={SocialFeedScreen}
        options={{
          tabBarIcon: ({ focused }) => <TabIcon icon="🏠" focused={focused} />,
          tabBarLabel: 'Home',
        }}
      />
      <Tab.Screen
        name="Marketplace"
        component={MarketplaceScreen}
        options={{
          tabBarIcon: ({ focused }) => <TabIcon icon="🛒" focused={focused} />,
          tabBarLabel: 'Market',
        }}
      />
      <Tab.Screen
        name="Games"
        component={GamesScreen}
        options={{
          tabBarIcon: ({ focused }) => <TabIcon icon="🎮" focused={focused} />,
          tabBarLabel: 'Games',
        }}
      />
      <Tab.Screen
        name="Notifications"
        component={NotificationsScreen}
        options={{
          tabBarIcon: ({ focused }) => <TabIcon icon="🔔" focused={focused} badge={unreadCount} />,
          tabBarLabel: 'Alerts',
        }}
      />
      <Tab.Screen
        name="Profile"
        component={ProfileScreen}
        options={{
          tabBarIcon: ({ focused }) => <TabIcon icon="👤" focused={focused} />,
          tabBarLabel: 'Profile',
        }}
      />
    </Tab.Navigator>
  );
}

// Auth Stack Navigator
function AuthStack() {
  return (
    <Stack.Navigator
      screenOptions={{
        headerShown: false,
        contentStyle: { backgroundColor: '#0F172A' },
      }}
    >
      <Stack.Screen name="Login" component={LoginScreen} />
      <Stack.Screen name="Register" component={RegisterScreen} />
    </Stack.Navigator>
  );
}

// Main App Stack Navigator
function AppStack() {
  return (
    <Stack.Navigator
      screenOptions={{
        headerStyle: { backgroundColor: '#1E293B' },
        headerTintColor: '#fff',
        headerTitleStyle: { fontWeight: '600' },
        contentStyle: { backgroundColor: '#0F172A' },
      }}
    >
      <Stack.Screen name="Main" component={MainTabs} options={{ headerShown: false }} />
      <Stack.Screen name="CreatePost" component={CreatePostScreen} options={{ title: 'Create Post' }} />
      <Stack.Screen name="AICreate" component={AICreateScreen} options={{ headerShown: false }} />
      <Stack.Screen name="Analytics" component={AnalyticsDashboardScreen} options={{ headerShown: false }} />
      <Stack.Screen name="SellerDashboard" component={SellerDashboardScreen} options={{ headerShown: false }} />
      <Stack.Screen name="Casino" component={CasinoScreen} options={{ headerShown: false }} />
      <Stack.Screen name="CasinoGame" component={CasinoGameScreen} options={{ headerShown: false }} />
      <Stack.Screen name="CasinoStats" component={CasinoStatsScreen} options={{ headerShown: false }} />
      <Stack.Screen name="Friends" component={FriendsScreen} options={{ title: 'Friends' }} />
      <Stack.Screen name="Settings" component={SettingsScreen} options={{ title: 'Settings' }} />
    </Stack.Navigator>
  );
}

// Root Navigator
export default function Navigation() {
  const { isAuthenticated, isLoading } = useAuth();

  if (isLoading) {
    return (
      <View style={styles.loadingContainer}>
        <Text style={styles.loadingIcon}>🔄</Text>
        <Text style={styles.loadingText}>Loading...</Text>
      </View>
    );
  }

  return (
    <NavigationContainer>
      {isAuthenticated ? <AppStack /> : <AuthStack />}
    </NavigationContainer>
  );
}

const styles = StyleSheet.create({
  tabIconContainer: {
    position: 'relative',
  },
  tabIcon: {
    fontSize: 22,
  },
  tabIconFocused: {
    transform: [{ scale: 1.1 }],
  },
  badge: {
    position: 'absolute',
    top: -4,
    right: -8,
    backgroundColor: '#EF4444',
    minWidth: 16,
    height: 16,
    borderRadius: 8,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 4,
  },
  badgeText: {
    color: '#fff',
    fontSize: 10,
    fontWeight: 'bold',
  },
  placeholder: {
    flex: 1,
    backgroundColor: '#0F172A',
    justifyContent: 'center',
    alignItems: 'center',
  },
  placeholderIcon: {
    fontSize: 64,
    marginBottom: 16,
  },
  placeholderTitle: {
    color: '#fff',
    fontSize: 24,
    fontWeight: 'bold',
    marginBottom: 8,
  },
  placeholderText: {
    color: '#9CA3AF',
    fontSize: 16,
  },
  loadingContainer: {
    flex: 1,
    backgroundColor: '#0F172A',
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingIcon: {
    fontSize: 48,
    marginBottom: 16,
  },
  loadingText: {
    color: '#fff',
    fontSize: 16,
  },
});
