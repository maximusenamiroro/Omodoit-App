import React from 'react';
import { StyleSheet, Platform } from 'react-native';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { colors, typography } from '../theme';
import TabIcon from '../components/common/TabIcon';

import ReelsScreen from '../screens/reels/ReelsScreen';
import FlashJobInboxScreen from '../screens/workstation/FlashJobInboxScreen';
import WorkstationScreen from '../screens/workstation/WorkstationScreen';
import InboxScreen from '../screens/inbox/InboxScreen';
import WorkerProfileScreen from '../screens/profile/WorkerProfileScreen';

const Tab = createBottomTabNavigator();

export default function WorkerNavigator() {
  return (
    <Tab.Navigator
      initialRouteName="Station"
      screenOptions={{
        headerShown: false,
        tabBarStyle: styles.tabBar,
        tabBarActiveTintColor: colors.primary,
        tabBarInactiveTintColor: colors.textMuted,
        tabBarLabelStyle: styles.tabLabel,
      }}>
      <Tab.Screen
        name="Reels"
        component={ReelsScreen}
        options={{
          tabBarIcon: ({ focused }) => <TabIcon name="reels" focused={focused} />,
        }}
      />
      <Tab.Screen
        name="Flash"
        component={FlashJobInboxScreen}
        options={{
          tabBarLabel: '',
          tabBarActiveTintColor: colors.flash,
          tabBarInactiveTintColor: colors.flash,
          tabBarIcon: ({ focused }) => <TabIcon name="flash" focused={focused} isFlash />,
        }}
      />
      <Tab.Screen
        name="Station"
        component={WorkstationScreen}
        options={{
          tabBarIcon: ({ focused }) => <TabIcon name="station" focused={focused} />,
        }}
      />
      <Tab.Screen
        name="Inbox"
        component={InboxScreen}
        options={{
          tabBarIcon: ({ focused }) => <TabIcon name="inbox" focused={focused} />,
        }}
      />
      <Tab.Screen
        name="Me"
        component={WorkerProfileScreen}
        options={{
          tabBarIcon: ({ focused }) => <TabIcon name="profile" focused={focused} />,
        }}
      />
    </Tab.Navigator>
  );
}

const styles = StyleSheet.create({
  tabBar: {
    backgroundColor: '#0a0a0a',
    borderTopColor: colors.border,
    borderTopWidth: 1,
    height: Platform.OS === 'ios' ? 84 : 68,
    paddingBottom: Platform.OS === 'ios' ? 24 : 8,
    paddingTop: 8,
    elevation: 0,
    shadowOpacity: 0,
  },
  tabLabel: {
    fontSize: typography.xs,
    fontWeight: typography.medium,
    marginTop: 2,
  },
});