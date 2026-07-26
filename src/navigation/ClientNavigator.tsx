import React from 'react';
import { View, Text, StyleSheet, Platform } from 'react-native';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { colors, typography, spacing } from '../theme';
import ReelsScreen from '../screens/reels/ReelsScreen';
import WorkspaceScreen from '../screens/workspace/WorkspaceScreen';
import FlashJobScreen from '../screens/workspace/FlashJobScreen';
import InboxScreen from '../screens/inbox/InboxScreen';
import ClientProfileScreen from '../screens/profile/ClientProfileScreen';

const Tab = createBottomTabNavigator();

function FlashIcon() {
  return (
    <View style={styles.flashContainer}>
      <Text style={styles.flashIcon}>⚡</Text>
    </View>
  );
}

export default function ClientNavigator() {
  return (
    <Tab.Navigator screenOptions={{ headerShown: false, tabBarStyle: styles.tabBar, tabBarActiveTintColor: colors.primary, tabBarInactiveTintColor: colors.textMuted, tabBarLabelStyle: styles.tabLabel }}>
      <Tab.Screen name="Reels" component={ReelsScreen} options={{ tabBarIcon: ({ focused }) => <Text style={[styles.icon, { color: focused ? colors.primary : colors.textMuted }]}>▶</Text> }} />
      <Tab.Screen name="Explore" component={WorkspaceScreen} options={{ tabBarIcon: ({ focused }) => <Text style={[styles.icon, { color: focused ? colors.primary : colors.textMuted }]}>🔍</Text> }} />
      <Tab.Screen name="Flash" component={FlashJobScreen} options={{ tabBarLabel: '', tabBarIcon: () => <FlashIcon /> }} />
      <Tab.Screen name="Inbox" component={InboxScreen} options={{ tabBarIcon: ({ focused }) => <Text style={[styles.icon, { color: focused ? colors.primary : colors.textMuted }]}>💬</Text> }} />
      <Tab.Screen name="Me" component={ClientProfileScreen} options={{ tabBarIcon: ({ focused }) => <Text style={[styles.icon, { color: focused ? colors.primary : colors.textMuted }]}>👤</Text> }} />
    </Tab.Navigator>
  );
}

const styles = StyleSheet.create({
  tabBar: { backgroundColor: '#0a0a0a', borderTopColor: colors.border, borderTopWidth: 1, height: Platform.OS === 'ios' ? 84 : 68, paddingBottom: Platform.OS === 'ios' ? 24 : 8, paddingTop: 8, elevation: 0, shadowOpacity: 0 },
  tabLabel: { fontSize: typography.xs, fontWeight: typography.medium, marginTop: 2 },
  icon: { fontSize: spacing.iconLg },
  flashContainer: { width: 48, height: 48, borderRadius: spacing.radiusFull, backgroundColor: colors.flash + '18', borderWidth: 1.5, borderColor: colors.flash + '35', alignItems: 'center', justifyContent: 'center', marginBottom: Platform.OS === 'ios' ? 16 : 8 },
  flashIcon: { fontSize: 22 },
});
