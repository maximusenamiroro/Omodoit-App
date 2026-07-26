import React from 'react';
import { View, ActivityIndicator, StyleSheet } from 'react-native';
import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { useAuth } from '../context/AuthContext';
import { colors } from '../theme';
import AuthNavigator from './AuthNavigator';
import ClientNavigator from './ClientNavigator';
import WorkerNavigator from './WorkerNavigator';
import TrackingScreen from '../screens/tracking/TrackingScreen';
import NotificationsScreen from '../screens/notifications/NotificationsScreen';
import ChatScreen from '../screens/inbox/ChatScreen';

const Stack = createNativeStackNavigator();

function LoadingScreen() {
  return (
    <View style={styles.loadingContainer}>
      <ActivityIndicator size="large" color={colors.primary} />
    </View>
  );
}

export default function AppNavigator() {
  const { user, role, loading, profileLoading } = useAuth();
  if (loading) return <LoadingScreen />;
  if (user && profileLoading && !role) return <LoadingScreen />;

  return (
    <NavigationContainer>
      <Stack.Navigator screenOptions={{ headerShown: false, gestureEnabled: false }}>
        {!user ? (
          <Stack.Screen name="Auth" component={AuthNavigator} options={{ animation: 'fade' }} />
        ) : role === 'client' ? (
          <Stack.Screen name="ClientApp" component={ClientNavigator} options={{ animation: 'fade' }} />
        ) : role === 'worker' ? (
          <Stack.Screen name="WorkerApp" component={WorkerNavigator} options={{ animation: 'fade' }} />
        ) : (
          <Stack.Screen name="Auth" component={AuthNavigator} options={{ animation: 'fade' }} />
        )}
        <Stack.Screen name="Chat" component={ChatScreen} options={{ animation: 'slide_from_right', gestureEnabled: true }} />
        <Stack.Screen name="Notifications" component={NotificationsScreen} options={{ animation: 'slide_from_right', gestureEnabled: true }} />
        <Stack.Screen name="Tracking" component={TrackingScreen} options={{ animation: 'slide_from_bottom', gestureEnabled: false }} />
      </Stack.Navigator>
    </NavigationContainer>
  );
}

const styles = StyleSheet.create({
  loadingContainer: { flex: 1, backgroundColor: colors.bg, alignItems: 'center', justifyContent: 'center' },
});
