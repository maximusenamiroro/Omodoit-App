import React from 'react';
import { View, Text, StyleSheet, Platform } from 'react-native';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { colors, typography, spacing } from '../theme';
import ReelsScreen from '../screens/reels/ReelsScreen';
import FlashJobInboxScreen from '../screens/workstation/FlashJobInboxScreen';
import WorkstationScreen from '../screens/workstation/WorkstationScreen';
import InboxScreen from '../screens/inbox/InboxScreen';
import WorkerProfileScreen from '../screens/profile/WorkerProfileScreen';

const Tab = createBottomTabNavigator();

function FlashIcon() {
  return (
    <View style={styles.flashContainer}>
      <Text style={styles.flashIcon}>⚡</Text>
    </View>
  );
}

export default function WorkerNavigator() {
  return (
    <Tab.Navigator initialRouteName="Station" screenOptions={{ headerShown: false, tabBarStyle: styles.tabBar, tabBarActiveTintColor: colors.primary, tabBarInactiveTintColor: colors.textMuted, tabBarLabelStyle: styles.tabLabel }}>
      <Tab.Screen name="Reels" component={ReelsScreen} options={{ tabBarIcon: ({ focused }) => <Text style={[styles.icon, { color: focused ? colors.primary : colors.textMuted }]}>▶</Text> }} />
      <Tab.Screen name="Flash" component={FlashJobInboxScreen} options={{ tabBarLabel: '', tabBarActiveTintColor: colors.flash, tabBarInactiveTintColor: colors.flash, tabBarIcon: () => <FlashIcon /> }} />
      <Tab.Screen name="Station" component={WorkstationScreen} options={{ tabBarIcon: ({ focused }) => <Text style={[styles.icon, { color: focused ? colors.primary : colors.textMuted }]}>🏢</Text> }} />
      <Tab.Screen name="Inbox" component={InboxScreen} options={{ tabBarIcon: ({ focused }) => <Text style={[styles.icon, { color: focused ? colors.primary : colors.textMuted }]}>💬</Text> }} />
      <Tab.Screen name="Me" component={WorkerProfileScreen} options={{ tabBarIcon: ({ focused }) => <Text style={[styles.icon, { color: focused ? colors.primary : colors.textMuted }]}>👤</Text> }} />
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
