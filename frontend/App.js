import React from 'react';
import { View, Text, Platform } from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { NavigationContainer, DarkTheme, DefaultTheme } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { ThemeProvider, useTheme } from './src/context/ThemeContext';

import LoginScreen from './src/screens/LoginScreen';
import MainScreen from './src/screens/MainScreen';
import TestScreen from './src/screens/TestScreen';
import ResultScreen from './src/screens/ResultScreen';

const Stack = createNativeStackNavigator();

class GlobalErrorBoundary extends React.Component {
  state = { hasError: false, error: null, errorInfo: null };

  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }

  componentDidCatch(error, errorInfo) {
    console.error('GLOBAL_ERROR_BOUNDARY_CAUGHT:', error, errorInfo);
    this.setState({ error, errorInfo });
  }

  render() {
    if (this.state.hasError) {
      return (
        <SafeAreaProvider>
          <View style={{ flex: 1, backgroundColor: '#450a0a', padding: 24, justifyContent: 'center' }}>
            <Text style={{ color: '#f87171', fontSize: 20, fontWeight: 'bold' }}>⚠️ Render Error Caught</Text>
            <Text style={{ color: '#ffffff', fontSize: 14, marginVertical: 12 }}>
              {String(this.state.error?.message || this.state.error)}
            </Text>
            <Text style={{ color: '#fca5a5', fontSize: 11 }}>
              {String(this.state.errorInfo?.componentStack || '')}
            </Text>
          </View>
        </SafeAreaProvider>
      );
    }
    return this.props.children;
  }
}

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

const customLightTheme = {
  ...DefaultTheme,
  colors: {
    ...DefaultTheme.colors,
    background: '#f2f2f7',
    card: '#ffffff',
    text: '#0f172a',
    border: '#e2e8f0',
    primary: '#4f46e5',
  },
};

function AppNavigator() {
  const { isGlass } = useTheme();

  return (
    <NavigationContainer theme={isGlass ? customLightTheme : customDarkTheme}>
      <StatusBar style={isGlass ? 'dark' : 'light'} backgroundColor={isGlass ? '#f2f2f7' : '#0f172a'} />
      <Stack.Navigator
        initialRouteName="Login"
        screenOptions={{
          headerShown: false,
          contentStyle: { backgroundColor: isGlass ? '#f2f2f7' : '#0f172a' },
          animation: 'slide_from_right',
          freezeOnBlur: false,
        }}
      >
        <Stack.Screen name="Login" component={LoginScreen} options={{ animation: 'fade' }} />
        <Stack.Screen name="Main" component={MainScreen} options={{ animation: 'none' }} />
        <Stack.Screen name="Home" component={MainScreen} options={{ animation: 'none' }} />
        <Stack.Screen name="Quizzes" component={MainScreen} options={{ animation: 'none' }} />
        <Stack.Screen name="Study" component={MainScreen} options={{ animation: 'none' }} />
        <Stack.Screen name="History" component={MainScreen} options={{ animation: 'none' }} />
        <Stack.Screen name="Profile" component={MainScreen} options={{ animation: 'none' }} />
        <Stack.Screen name="Test" component={TestScreen} options={{ animation: 'slide_from_right' }} />
        <Stack.Screen name="Result" component={ResultScreen} options={{ animation: 'slide_from_right' }} />
      </Stack.Navigator>
    </NavigationContainer>
  );
}

export default function App() {
  return (
    <GlobalErrorBoundary>
      <SafeAreaProvider>
        <ThemeProvider>
          <AppNavigator />
        </ThemeProvider>
      </SafeAreaProvider>
    </GlobalErrorBoundary>
  );
}
