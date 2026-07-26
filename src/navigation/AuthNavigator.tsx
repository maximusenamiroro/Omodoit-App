import React from 'react';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import AccountTypeScreen from '../screens/auth/AccountTypeScreen';
import LoginScreen from '../screens/auth/LoginScreen';
import ClientRegStep1Screen from '../screens/auth/ClientRegStep1Screen';
import ClientRegStep2Screen from '../screens/auth/ClientRegStep2Screen';
import ClientRegStep3Screen from '../screens/auth/ClientRegStep3Screen';
import WorkerRegStep1Screen from '../screens/auth/WorkerRegStep1Screen';
import WorkerRegStep2Screen from '../screens/auth/WorkerRegStep2Screen';
import WorkerRegStep3Screen from '../screens/auth/WorkerRegStep3Screen';
import WorkerRegStep4Screen from '../screens/auth/WorkerRegStep4Screen';

export type AuthStackParamList = {
  AccountType: undefined; Login: undefined;
  ClientRegStep1: undefined; ClientRegStep2: undefined; ClientRegStep3: undefined;
  WorkerRegStep1: undefined; WorkerRegStep2: undefined; WorkerRegStep3: undefined; WorkerRegStep4: undefined;
};

const Stack = createNativeStackNavigator<AuthStackParamList>();

export default function AuthNavigator() {
  return (
    <Stack.Navigator initialRouteName="AccountType" screenOptions={{ headerShown: false, animation: 'slide_from_right', contentStyle: { backgroundColor: '#0f0f0f' } }}>
      <Stack.Screen name="AccountType" component={AccountTypeScreen} />
      <Stack.Screen name="Login" component={LoginScreen} />
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
