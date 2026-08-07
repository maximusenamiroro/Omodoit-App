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
import SettingsScreen from '../screens/settings/SettingsScreen';
import SubCategoriesScreen from '../screens/workspace/SubCategoriesScreen';
import WorkerListScreen from '../screens/workspace/WorkerListScreen';
import WorkerPublicProfileScreen from '../screens/workspace/WorkerPublicProfileScreen';
import HireWorkerScreen from '../screens/workspace/HireWorkerScreen';
import NewArrivalsScreen from '../screens/workspace/NewArrivalsScreen';
import OrdersScreen from '../screens/orders/OrdersScreen';
import OutgoingCallScreen from '../screens/call/OutgoingCallScreen';
import IncomingCallScreen from '../screens/call/IncomingCallScreen';
import InCallScreen from '../screens/call/InCallScreen';
import FlashJobScreen from '../screens/workspace/FlashJobScreen';
import ProductCatalogueScreen from '../screens/products/ProductCatalogueScreen';
import ProductDetailScreen from '../screens/products/ProductDetailScreen';
import EditProfileScreen from '../screens/settings/EditProfileScreen';
import AddProductScreen from '../screens/products/AddProductScreen';
import CreateReelScreen from '../screens/reels/CreateReelScreen';

const Stack = createNativeStackNavigator();

// Rendered as an opaque overlay INSIDE the NavigationContainer instead
// of replacing it. Replacing the container unmounts the whole navigation
// tree, so every loading toggle wiped navigation state and reset users
// back to each stack's initial screen.
function LoadingOverlay() {
  return (
    <View style={styles.loadingOverlay}>
      <ActivityIndicator size="large" color={colors.primary} />
    </View>
  );
}

export default function AppNavigator() {
  const { user, role, loading, profileLoading } = useAuth();
  const showLoading = loading || (!!user && profileLoading && !role);

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
        <Stack.Screen name="Settings" component={SettingsScreen} options={{ animation: 'slide_from_right', gestureEnabled: true }} />
        <Stack.Screen name="SubCategories" component={SubCategoriesScreen} options={{ animation: 'slide_from_right', gestureEnabled: true }} />
        <Stack.Screen name="WorkerList" component={WorkerListScreen} options={{ animation: 'slide_from_right', gestureEnabled: true }} />
        <Stack.Screen name="WorkerPublicProfile" component={WorkerPublicProfileScreen} options={{ animation: 'slide_from_right', gestureEnabled: true }} />
        <Stack.Screen name="HireWorker" component={HireWorkerScreen} options={{ animation: 'slide_from_right', gestureEnabled: true }} />
        <Stack.Screen name="Notifications" component={NotificationsScreen} options={{ animation: 'slide_from_right', gestureEnabled: true }} />
        <Stack.Screen name="Tracking" component={TrackingScreen} options={{ animation: 'slide_from_bottom', gestureEnabled: false }} />
        <Stack.Screen name="NewArrivals" component={NewArrivalsScreen} options={{ animation: 'slide_from_right', gestureEnabled: true }} />
        <Stack.Screen name="Orders" component={OrdersScreen} options={{ animation: 'slide_from_right', gestureEnabled: true }} />
         <Stack.Screen name="OutgoingCall" component={OutgoingCallScreen} options={{ animation: 'fade', gestureEnabled: false, presentation: 'fullScreenModal' }} />
        <Stack.Screen name="IncomingCall" component={IncomingCallScreen} options={{ animation: 'fade', gestureEnabled: false, presentation: 'fullScreenModal' }} />
        <Stack.Screen name="InCall" component={InCallScreen} options={{ animation: 'fade', gestureEnabled: false, presentation: 'fullScreenModal' }} />
        <Stack.Screen name="FlashJob" component={FlashJobScreen} options={{ animation: 'slide_from_bottom', gestureEnabled: true }} />
        <Stack.Screen name="ProductCatalogue" component={ProductCatalogueScreen} options={{ animation: 'slide_from_right', gestureEnabled: true }} />
        <Stack.Screen name="ProductDetail" component={ProductDetailScreen} options={{ animation: 'slide_from_right', gestureEnabled: true }} />
        <Stack.Screen name="EditProfile" component={EditProfileScreen} options={{ animation: 'slide_from_right', gestureEnabled: true }} />
        <Stack.Screen name="AddProduct" component={AddProductScreen} options={{ animation: 'slide_from_right', gestureEnabled: true }} />
        <Stack.Screen name="CreateReel" component={CreateReelScreen} options={{ animation: 'slide_from_right', gestureEnabled: true }} />
      </Stack.Navigator>
      {showLoading && <LoadingOverlay />}
    </NavigationContainer>
  );
}

const styles = StyleSheet.create({
  loadingOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: colors.bg,
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 999,
    elevation: 999,
  },
});
