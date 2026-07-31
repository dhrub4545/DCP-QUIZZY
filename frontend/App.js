import React from 'react';
import { StatusBar } from 'expo-status-bar';
import { NavigationContainer, DarkTheme } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';

import LoginScreen from './src/screens/LoginScreen';
import HomeScreen from './src/screens/HomeScreen';
import QuizzesScreen from './src/screens/QuizzesScreen';
import TestScreen from './src/screens/TestScreen';
import ResultScreen from './src/screens/ResultScreen';
import HistoryScreen from './src/screens/HistoryScreen';

const Stack = createNativeStackNavigator();

const customDarkTheme = {
  ...DarkTheme,
  colors: {
    ...DarkTheme.colors,
    background: '#0f172a',
    card: '#1e293b',
    text: '#f8fafc',
    border: '#334155',
    primary: '#6366f1',
  },
};

export default function App() {
  return (
    <NavigationContainer theme={customDarkTheme}>
      <StatusBar style="light" backgroundColor="#0f172a" />
      <Stack.Navigator
        initialRouteName="Login"
        screenOptions={{
          headerShown: false,
          contentStyle: { backgroundColor: '#0f172a' },
          animation: 'slide_from_right',
        }}
      >
        <Stack.Screen name="Login" component={LoginScreen} />
        <Stack.Screen name="Home" component={HomeScreen} options={{ animation: 'none' }} />
        <Stack.Screen name="Quizzes" component={QuizzesScreen} options={{ animation: 'none' }} />
        <Stack.Screen name="Test" component={TestScreen} />
        <Stack.Screen name="Result" component={ResultScreen} />
        <Stack.Screen name="History" component={HistoryScreen} options={{ animation: 'none' }} />
      </Stack.Navigator>
    </NavigationContainer>
  );
}
