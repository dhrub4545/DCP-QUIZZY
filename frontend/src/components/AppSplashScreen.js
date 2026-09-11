import React, { useEffect, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Animated,
  Dimensions,
  StatusBar,
  Image,
  ActivityIndicator,
} from 'react-native';
import * as SplashScreen from 'expo-splash-screen';

const { width } = Dimensions.get('window');

export default function AppSplashScreen({ onFinish }) {
  const fadeAnim = useRef(new Animated.Value(1)).current;
  const scaleAnim = useRef(new Animated.Value(0.92)).current;

  useEffect(() => {
    // Dismiss native splash screen immediately when this clean view mounts
    try {
      SplashScreen.hideAsync().catch(() => {});
    } catch (e) {}

    // Subtle gentle entrance
    Animated.spring(scaleAnim, {
      toValue: 1,
      friction: 7,
      tension: 40,
      useNativeDriver: true,
    }).start();

    // Brief instant loading period matching actual fast app startup (< 0.5s)
    const timer = setTimeout(() => {
      Animated.timing(fadeAnim, {
        toValue: 0,
        duration: 180,
        useNativeDriver: true,
      }).start(() => {
        if (onFinish) onFinish();
      });
    }, 400);

    return () => clearTimeout(timer);
  }, []);

  return (
    <Animated.View style={[styles.container, { opacity: fadeAnim }]}>
      <StatusBar barStyle="dark-content" backgroundColor="#ffffff" translucent={false} />

      <Animated.View style={[styles.contentBox, { transform: [{ scale: scaleAnim }] }]}>
        {/* Crisp Quizzy Brand Logo */}
        <Image
          source={require('../../assets/logo2.png')}
          style={styles.logoImage}
          resizeMode="contain"
        />

        <Text style={styles.tagline}>Smart MCQ Practice & AI Medical Tutor</Text>

        {/* Clean Theme-Matched Minimalist Spinner */}
        <View style={styles.spinnerWrapper}>
          <ActivityIndicator size="large" color="#2563eb" />
        </View>

        <Text style={styles.loadingText}>Loading Quizzy...</Text>
      </Animated.View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  container: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: '#ffffff',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 99999,
    elevation: 99999,
  },
  contentBox: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 24,
    width: '100%',
    maxWidth: 380,
  },
  logoImage: {
    width: Math.min(width * 0.52, 210),
    height: Math.min(width * 0.52, 210) * 0.43,
    marginBottom: 8,
  },
  tagline: {
    fontSize: 13,
    color: '#475569',
    fontWeight: '600',
    letterSpacing: 0.3,
    marginBottom: 28,
  },
  spinnerWrapper: {
    marginBottom: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  loadingText: {
    fontSize: 12,
    color: '#64748b',
    fontWeight: '500',
    letterSpacing: 0.4,
  },
});
