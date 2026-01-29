/**
 * Navigation Configuration for Blendlink Mobile
 */

import React, { useState, useEffect } from 'react';
import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { useAuth } from '../context/AuthContext';
import { useTheme } from '../context/ThemeContext';

// Screens
import LoginScreen from '../screens/LoginScreen';
import RegisterScreen from '../screens/RegisterScreen';
import SocialFeedScreen from '../screens/SocialFeedScreen';
import ProfileScreen from '../screens/ProfileScreen';
import NotificationsScreen from '../screens/NotificationsScreen';
import AnalyticsDashboardScreen from '../screens/AnalyticsDashboardScreen';
import AICreateScreen from '../screens/AICreateScreen';
import SellerDashboardScreen from '../screens/SellerDashboardScreen';
import PhotoEditorScreen from '../screens/PhotoEditorScreen';
import MarketplaceScreen from '../screens/MarketplaceScreen';
import GamesScreen from '../screens/GamesScreen';
import CasinoScreen from '../screens/CasinoScreen';
import CasinoGameScreen from '../screens/CasinoGameScreen';
import CasinoStatsScreen from '../screens/CasinoStatsScreen';

// Photo Game Screens
import PhotoGameArenaScreen from '../screens/PhotoGameArenaScreen';
import MintedPhotosScreen from '../screens/MintedPhotosScreen';
import PhotoMarketplaceScreen from '../screens/PhotoMarketplaceScreen';
import OpenGamesBrowserScreen from '../screens/OpenGamesBrowserScreen';

// Admin Screens
import AdminScreen from '../screens/AdminScreen';
import AdminAnalyticsScreen from '../screens/AdminAnalyticsScreen';
import AdminABTestingScreen from '../screens/AdminABTestingScreen';
import AdminSettingsScreen from '../screens/AdminSettingsScreen';
import AdminUsersScreen from '../screens/AdminUsersScreen';
import AdminWithdrawalsScreen from '../screens/AdminWithdrawalsScreen';
import AdminAuditScreen from '../screens/AdminAuditScreen';
import AdminGenealogyScreen from '../screens/AdminGenealogyScreen';
import AdminManagementScreen from '../screens/AdminManagementScreen';
import AdminOrphansScreen from '../screens/AdminOrphansScreen';
import AdminDiamondLeadersScreen from '../screens/AdminDiamondLeadersScreen';
import AdminSecurityScreen from '../screens/AdminSecurityScreen';
import AdminNotificationsScreen from '../screens/AdminNotificationsScreen';
import AdminThemesScreen from '../screens/AdminThemesScreen';
import AdminUIEditorScreen from '../screens/AdminUIEditorScreen';
import AdminPagesScreen from '../screens/AdminPagesScreen';
import AdminAIScreen from '../screens/AdminAIScreen';
import MyTeamScreen from '../screens/MyTeamScreen';

// Poker Screens
import { PokerLobbyScreen, PokerTableScreen } from '../screens/PokerTournamentScreen';

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

// Settings Screen with Theme Toggle
const SettingsScreen = () => {
  const { colors, isDark, toggleTheme, theme } = useTheme();
  
  return (
    <View style={[styles.settingsContainer, { backgroundColor: colors.background }]}>
      <Text style={[styles.settingsTitle, { color: colors.text }]}>⚙️ Settings</Text>
      
      {/* Theme Section */}
      <View style={[styles.settingsSection, { backgroundColor: colors.card }]}>
        <Text style={[styles.settingsSectionTitle, { color: colors.text }]}>Appearance</Text>
        
        <TouchableOpacity 
          style={[styles.settingsRow, { borderBottomColor: colors.border }]}
          onPress={toggleTheme}
        >
          <View style={styles.settingsRowLeft}>
            <Text style={styles.settingsRowIcon}>{isDark ? '🌙' : '☀️'}</Text>
            <View>
              <Text style={[styles.settingsRowLabel, { color: colors.text }]}>Theme</Text>
              <Text style={[styles.settingsRowValue, { color: colors.textMuted }]}>
                {isDark ? 'Dark Mode' : 'Light Mode'}
              </Text>
            </View>
          </View>
          <View style={[styles.themeToggle, { backgroundColor: isDark ? colors.primary : colors.cardSecondary }]}>
            <Text style={styles.themeToggleText}>{isDark ? '🌙' : '☀️'}</Text>
          </View>
        </TouchableOpacity>
      </View>
      
      {/* Account Section */}
      <View style={[styles.settingsSection, { backgroundColor: colors.card }]}>
        <Text style={[styles.settingsSectionTitle, { color: colors.text }]}>Account</Text>
        
        <View style={[styles.settingsRow, { borderBottomColor: colors.border }]}>
          <View style={styles.settingsRowLeft}>
            <Text style={styles.settingsRowIcon}>👤</Text>
            <Text style={[styles.settingsRowLabel, { color: colors.text }]}>Profile</Text>
          </View>
          <Text style={[styles.settingsRowArrow, { color: colors.textMuted }]}>→</Text>
        </View>
        
        <View style={[styles.settingsRow, { borderBottomColor: colors.border }]}>
          <View style={styles.settingsRowLeft}>
            <Text style={styles.settingsRowIcon}>🔔</Text>
            <Text style={[styles.settingsRowLabel, { color: colors.text }]}>Notifications</Text>
          </View>
          <Text style={[styles.settingsRowArrow, { color: colors.textMuted }]}>→</Text>
        </View>
        
        <View style={[styles.settingsRow, { borderBottomColor: colors.border }]}>
          <View style={styles.settingsRowLeft}>
            <Text style={styles.settingsRowIcon}>🔒</Text>
            <Text style={[styles.settingsRowLabel, { color: colors.text }]}>Privacy</Text>
          </View>
          <Text style={[styles.settingsRowArrow, { color: colors.textMuted }]}>→</Text>
        </View>
      </View>
      
      {/* App Info */}
      <View style={[styles.settingsSection, { backgroundColor: colors.card }]}>
        <Text style={[styles.settingsSectionTitle, { color: colors.text }]}>About</Text>
        
        <View style={[styles.settingsRow, { borderBottomWidth: 0 }]}>
          <View style={styles.settingsRowLeft}>
            <Text style={styles.settingsRowIcon}>📱</Text>
            <Text style={[styles.settingsRowLabel, { color: colors.text }]}>Version</Text>
          </View>
          <Text style={[styles.settingsRowValue, { color: colors.textMuted }]}>1.0.0</Text>
        </View>
      </View>
    </View>
  );
};

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
  tabBarActiveTintColor: '#8B5CF6',
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
  const { colors } = useTheme();

  // Dynamic tab bar style based on theme
  const themedTabBarOptions = {
    tabBarStyle: {
      backgroundColor: colors.tabBar,
      borderTopColor: colors.tabBarBorder,
      height: 80,
      paddingBottom: 20,
      paddingTop: 10,
    },
    tabBarActiveTintColor: colors.primary,
    tabBarInactiveTintColor: colors.textMuted,
    tabBarLabelStyle: {
      fontSize: 11,
      fontWeight: '500',
    },
    headerShown: false,
  };

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
    <Tab.Navigator screenOptions={themedTabBarOptions}>
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
  const { colors } = useTheme();

  return (
    <Stack.Navigator
      screenOptions={{
        headerStyle: { backgroundColor: colors.card },
        headerTintColor: colors.text,
        headerTitleStyle: { fontWeight: '600' },
        contentStyle: { backgroundColor: colors.background },
      }}
    >
      <Stack.Screen name="Main" component={MainTabs} options={{ headerShown: false }} />
      <Stack.Screen name="CreatePost" component={CreatePostScreen} options={{ title: 'Create Post' }} />
      <Stack.Screen name="AICreate" component={AICreateScreen} options={{ headerShown: false }} />
      <Stack.Screen name="Analytics" component={AnalyticsDashboardScreen} options={{ headerShown: false }} />
      <Stack.Screen name="SellerDashboard" component={SellerDashboardScreen} options={{ headerShown: false }} />
      <Stack.Screen name="PhotoEditor" component={PhotoEditorScreen} options={{ headerShown: false }} />
      <Stack.Screen name="Casino" component={CasinoScreen} options={{ headerShown: false }} />
      <Stack.Screen name="CasinoGame" component={CasinoGameScreen} options={{ headerShown: false }} />
      <Stack.Screen name="CasinoStats" component={CasinoStatsScreen} options={{ headerShown: false }} />
      {/* Photo Game Screens */}
      <Stack.Screen name="PhotoGameArena" component={PhotoGameArenaScreen} options={{ headerShown: false }} />
      <Stack.Screen name="MintedPhotos" component={MintedPhotosScreen} options={{ headerShown: false }} />
      <Stack.Screen name="PhotoMarketplace" component={PhotoMarketplaceScreen} options={{ headerShown: false }} />
      <Stack.Screen name="OpenGamesBrowser" component={OpenGamesBrowserScreen} options={{ headerShown: false }} />
      {/* PKO Poker Screens */}
      <Stack.Screen name="PokerLobby" component={PokerLobbyScreen} options={{ headerShown: false }} />
      <Stack.Screen name="PokerTable" component={PokerTableScreen} options={{ headerShown: false, orientation: 'landscape' }} />
      <Stack.Screen name="Friends" component={FriendsScreen} options={{ title: 'Friends' }} />
      <Stack.Screen name="Settings" component={SettingsScreen} options={{ title: 'Settings' }} />
      {/* Admin Screens */}
      <Stack.Screen name="Admin" component={AdminScreen} options={{ headerShown: false }} />
      <Stack.Screen name="AdminDashboard" component={AdminScreen} options={{ headerShown: false }} />
      <Stack.Screen name="AdminUsers" component={AdminUsersScreen} options={{ headerShown: false }} />
      <Stack.Screen name="AdminManagement" component={AdminManagementScreen} options={{ headerShown: false }} />
      <Stack.Screen name="AdminGenealogy" component={AdminGenealogyScreen} options={{ headerShown: false }} />
      <Stack.Screen name="AdminAnalytics" component={AdminAnalyticsScreen} options={{ headerShown: false }} />
      <Stack.Screen name="AdminABTesting" component={AdminABTestingScreen} options={{ headerShown: false }} />
      <Stack.Screen name="AdminAudit" component={AdminAuditScreen} options={{ headerShown: false }} />
      <Stack.Screen name="AdminSettings" component={AdminSettingsScreen} options={{ headerShown: false }} />
      <Stack.Screen name="AdminWithdrawals" component={AdminWithdrawalsScreen} options={{ headerShown: false }} />
      <Stack.Screen name="AdminOrphans" component={AdminOrphansScreen} options={{ headerShown: false }} />
      <Stack.Screen name="AdminDiamondLeaders" component={AdminDiamondLeadersScreen} options={{ headerShown: false }} />
      <Stack.Screen name="AdminSecurity" component={AdminSecurityScreen} options={{ headerShown: false }} />
      <Stack.Screen name="AdminNotifications" component={AdminNotificationsScreen} options={{ headerShown: false }} />
      <Stack.Screen name="AdminThemes" component={AdminThemesScreen} options={{ headerShown: false }} />
      <Stack.Screen name="AdminUIEditor" component={AdminUIEditorScreen} options={{ headerShown: false }} />
      <Stack.Screen name="AdminPages" component={AdminPagesScreen} options={{ headerShown: false }} />
      <Stack.Screen name="AdminAI" component={AdminAIScreen} options={{ headerShown: false }} />
      {/* Referral System */}
      <Stack.Screen name="MyTeam" component={MyTeamScreen} options={{ headerShown: false }} />
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
  // Settings Styles
  settingsContainer: {
    flex: 1,
    padding: 16,
  },
  settingsTitle: {
    fontSize: 28,
    fontWeight: 'bold',
    marginBottom: 24,
    marginTop: 8,
  },
  settingsSection: {
    borderRadius: 16,
    marginBottom: 16,
    overflow: 'hidden',
  },
  settingsSectionTitle: {
    fontSize: 14,
    fontWeight: '600',
    padding: 16,
    paddingBottom: 8,
  },
  settingsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderBottomWidth: 1,
  },
  settingsRowLeft: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  settingsRowIcon: {
    fontSize: 20,
    marginRight: 12,
  },
  settingsRowLabel: {
    fontSize: 16,
  },
  settingsRowValue: {
    fontSize: 14,
  },
  settingsRowArrow: {
    fontSize: 18,
  },
  themeToggle: {
    width: 48,
    height: 28,
    borderRadius: 14,
    justifyContent: 'center',
    alignItems: 'center',
  },
  themeToggleText: {
    fontSize: 14,
  },
});
