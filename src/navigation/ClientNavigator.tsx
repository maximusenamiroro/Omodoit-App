import React from 'react';
import { StyleSheet, Platform } from 'react-native';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { colors, typography } from '../theme';
import TabIcon from '../components/common/TabIcon';

import ReelsScreen from '../screens/reels/ReelsScreen';
import WorkspaceScreen from '../screens/workspace/WorkspaceScreen';
import FlashJobScreen from '../screens/workspace/FlashJobScreen';
import InboxScreen from '../screens/inbox/InboxScreen';
import ClientProfileScreen from '../screens/profile/ClientProfileScreen';

const Tab = createBottomTabNavigator();

export default function ClientNavigator() {
  return (
    <Tab.Navigator
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
        name="Explore"
        component={WorkspaceScreen}
        options={{
          tabBarIcon: ({ focused }) => <TabIcon name="explore" focused={focused} />,
        }}
      />
      <Tab.Screen
        name="Flash"
        component={FlashJobScreen}
        options={{
          tabBarLabel: '',
          tabBarIcon: ({ focused }) => <TabIcon name="flash" focused={focused} isFlash />,
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
        component={ClientProfileScreen}
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