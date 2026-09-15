import React, { useEffect } from 'react';
import { View, ActivityIndicator, StyleSheet } from 'react-native';
import { NavigationContainer, createNavigationContainerRef } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { useAuth } from '../context/AuthContext';
import { colors } from '../theme';
import { useIncomingCallListener } from '../lib/calling';
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
import AllBookingsScreen from '../screens/workstation/AllBookingsScreen';
import AllOrdersScreen from '../screens/workstation/AllOrdersScreen';
import MyProductsScreen from '../screens/products/MyProductsScreen';
import OutgoingCallScreen from '../screens/call/OutgoingCallScreen';
import IncomingCallScreen from '../screens/call/IncomingCallScreen';
import InCallScreen from '../screens/call/InCallScreen';
import FlashJobScreen from '../screens/workspace/FlashJobScreen';
import ProductCatalogueScreen from '../screens/products/ProductCatalogueScreen';
import ProductDetailScreen from '../screens/products/ProductDetailScreen';
import EditProfileScreen from '../screens/settings/EditProfileScreen';
import AddProductScreen from '../screens/products/AddProductScreen';
import CreateReelScreen from '../screens/reels/CreateReelScreen';
import SearchScreen from '../screens/search/SearchScreen';
import BlockedUsersScreen from '../screens/settings/BlockedUsersScreen';
import LeaveReviewScreen from '../screens/reviews/LeaveReviewScreen';
import AnalyticsScreen from '../screens/analytics/AnalyticsScreen';
import EarningsScreen from '../screens/earnings/EarningsScreen';

const Stack = createNativeStackNavigator();
export const navigationRef = createNavigationContainerRef();

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
  const { user, role, loading } = useAuth();
  // Whenever a user is authenticated but their role hasn't resolved
  // yet, show loading — full stop. This used to also check
  // profileLoading, but setUser() and loadProfile()'s internal
  // setProfileLoading(true) happen across an await boundary, so there
  // was a real render frame where user was set, role was still null,
  // and profileLoading hadn't flipped to true yet. In that frame this
  // fell through to the Auth screen, causing a visible flash back to
  // login/signup right after a successful sign-in, before correcting
  // itself a moment later.
  const showLoading = loading || (!!user && !role);

  // Global — a call can arrive while the user is anywhere in the app,
  // not just while a specific screen is open. Uses navigationRef
  // rather than a screen's own navigation prop, since this listener
  // isn't itself a screen.
  useIncomingCallListener(user?.id, (payload) => {
    if (navigationRef.isReady()) {
      (navigationRef as any).navigate('IncomingCall', {
        callId: payload.callId,
        callerId: payload.callerId,
        callerName: payload.callerName,
        callerCategory: payload.callerCategory,
      });
    }
  });

  // Sign-out has to reset the stack, not just swap the root screen.
  //
  // Settings, Chat, EditProfile and the rest below are registered
  // OUTSIDE the auth conditional, so they exist whether or not anyone
  // is logged in. Signing out from Settings therefore swapped the root
  // from WorkerApp to Auth underneath — while Settings stayed pushed on
  // top of the stack. The user stayed staring at the settings screen
  // and it looked like the button did nothing at all.
  //
  // Resetting clears those pushed screens so Auth is actually what's
  // on screen.
  useEffect(() => {
    if (!user && !loading && navigationRef.isReady()) {
      navigationRef.reset({ index: 0, routes: [{ name: 'Auth' }] });
    }
  }, [user, loading]);

  return (
    <NavigationContainer ref={navigationRef}>
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
        <Stack.Screen name="LeaveReview" component={LeaveReviewScreen} options={{ animation: 'slide_from_bottom' }} />
        <Stack.Screen name="Analytics" component={AnalyticsScreen} options={{ animation: 'slide_from_right', gestureEnabled: true }} />
        <Stack.Screen name="Earnings" component={EarningsScreen} options={{ animation: 'slide_from_right', gestureEnabled: true }} />
        <Stack.Screen name="NewArrivals" component={NewArrivalsScreen} options={{ animation: 'slide_from_right', gestureEnabled: true }} />
        <Stack.Screen name="Orders" component={OrdersScreen} options={{ animation: 'slide_from_right', gestureEnabled: true }} />
        <Stack.Screen name="AllBookings" component={AllBookingsScreen} options={{ animation: 'slide_from_right', gestureEnabled: true }} />
        <Stack.Screen name="AllOrders" component={AllOrdersScreen} options={{ animation: 'slide_from_right', gestureEnabled: true }} />
        <Stack.Screen name="MyProducts" component={MyProductsScreen} options={{ animation: 'slide_from_right', gestureEnabled: true }} />
         <Stack.Screen name="OutgoingCall" component={OutgoingCallScreen} options={{ animation: 'fade', gestureEnabled: false, presentation: 'fullScreenModal' }} />
        <Stack.Screen name="IncomingCall" component={IncomingCallScreen} options={{ animation: 'fade', gestureEnabled: false, presentation: 'fullScreenModal' }} />
        <Stack.Screen name="InCall" component={InCallScreen} options={{ animation: 'fade', gestureEnabled: false, presentation: 'fullScreenModal' }} />
        <Stack.Screen name="FlashJob" component={FlashJobScreen} options={{ animation: 'slide_from_bottom', gestureEnabled: true }} />
        <Stack.Screen name="ProductCatalogue" component={ProductCatalogueScreen} options={{ animation: 'slide_from_right', gestureEnabled: true }} />
        <Stack.Screen name="ProductDetail" component={ProductDetailScreen} options={{ animation: 'slide_from_right', gestureEnabled: true }} />
        <Stack.Screen name="EditProfile" component={EditProfileScreen} options={{ animation: 'slide_from_right', gestureEnabled: true }} />
        <Stack.Screen name="AddProduct" component={AddProductScreen} options={{ animation: 'slide_from_right', gestureEnabled: true }} />
        <Stack.Screen name="CreateReel" component={CreateReelScreen} options={{ animation: 'slide_from_right', gestureEnabled: true }} />
        <Stack.Screen name="Search" component={SearchScreen} options={{ animation: 'slide_from_bottom', gestureEnabled: true }} />
        <Stack.Screen name="BlockedUsers" component={BlockedUsersScreen} options={{ animation: 'slide_from_right', gestureEnabled: true }} />
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
