import React from 'react';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import AccountTypeScreen from '../screens/auth/AccountTypeScreen';
import LoginScreen from '../screens/auth/LoginScreen';
import PhoneVerifyScreen from '../screens/auth/PhoneVerifyScreen';
import OTPScreen from '../screens/auth/OTPScreen';
import ClientRegStep1Screen from '../screens/auth/ClientRegStep1Screen';
import ClientRegStep2Screen from '../screens/auth/ClientRegStep2Screen';
import ClientRegStep3Screen from '../screens/auth/ClientRegStep3Screen';
import WorkerRegStep1Screen from '../screens/auth/WorkerRegStep1Screen';
import WorkerRegStep2Screen from '../screens/auth/WorkerRegStep2Screen';
import WorkerRegStep3Screen from '../screens/auth/WorkerRegStep3Screen';
import WorkerRegStep4Screen from '../screens/auth/WorkerRegStep4Screen';

export type AuthStackParamList = {
  AccountType: undefined;
  Login: undefined;
  PhoneVerify: { accountType: 'client' | 'worker' };
  OTP: { accountType: 'client' | 'worker'; phoneNumber: string };
  ClientRegStep1: { phoneNumber: string };
  ClientRegStep2: { phoneNumber: string; fullName: string; email: string };
  ClientRegStep3: { phoneNumber: string; fullName: string; email: string; location: string };
  WorkerRegStep1: { phoneNumber: string };
  WorkerRegStep2: { phoneNumber: string; fullName: string; email: string; businessName?: string };
  WorkerRegStep3: { phoneNumber: string; fullName: string; email: string; businessName?: string; category: string; subcategory: string; experience: string };
  WorkerRegStep4: { phoneNumber: string; fullName: string; email: string; businessName?: string; category: string; subcategory: string; experience: string; serviceArea: string };
};

const Stack = createNativeStackNavigator<AuthStackParamList>();

export default function AuthNavigator() {
  return (
    <Stack.Navigator
      initialRouteName="Login"
      screenOptions={{
        headerShown: false,
        animation: 'slide_from_right',
        contentStyle: { backgroundColor: '#0f0f0f' },
      }}>
      <Stack.Screen name="AccountType" component={AccountTypeScreen} />
      <Stack.Screen name="Login" component={LoginScreen} />
      <Stack.Screen name="PhoneVerify" component={PhoneVerifyScreen} />
      <Stack.Screen name="OTP" component={OTPScreen} />
      <Stack.Screen name="ClientRegStep1" component={ClientRegStep1Screen} />
      <Stack.Screen name="ClientRegStep2" component={ClientRegStep2Screen} />
      <Stack.Screen name="ClientRegStep3" component={ClientRegStep3Screen} />
      <Stack.Screen name="WorkerRegStep1" component={WorkerRegStep1Screen} />
      <Stack.Screen name="WorkerRegStep2" component={WorkerRegStep2Screen} />
      <Stack.Screen name="WorkerRegStep3" component={WorkerRegStep3Screen} />
      <Stack.Screen name="WorkerRegStep4" component={WorkerRegStep4Screen} />
    </Stack.Navigator>
  );
}