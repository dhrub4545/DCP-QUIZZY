import React, { useEffect, useRef, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Animated,
  Dimensions,
  StatusBar,
  Platform,
  Image,
} from 'react-native';
import { Sparkles, GraduationCap, ShieldCheck } from 'lucide-react-native';
import * as SplashScreen from 'expo-splash-screen';
import { useTheme } from '../context/ThemeContext';

const { width, height } = Dimensions.get('window');

const STATUS_MESSAGES = [
  'Initializing Medical Knowledge Base...',
  'Preparing High-Yield Clinical Sets...',
  'Activating Spaced-Recall AI Tutor...',
  'Welcome to QUIZZY',
];

export default function AppSplashScreen({ onFinish }) {
  let themeContext = null;
  try {
    themeContext = useTheme();
  } catch (e) {
    themeContext = { isGlass: false };
  }
  const isGlass = Boolean(themeContext?.isGlass);

  const [statusText, setStatusText] = useState(STATUS_MESSAGES[0]);
  const [percent, setPercent] = useState(0);

  // Animations
  const logoScale = useRef(new Animated.Value(0.7)).current;
  const logoOpacity = useRef(new Animated.Value(0)).current;
  const glowPulse = useRef(new Animated.Value(0.35)).current;
  const progressBar = useRef(new Animated.Value(0)).current;
  const screenFade = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    // Hide the native splash screen as soon as this component mounts
    try {
      SplashScreen.hideAsync().catch(() => {});
    } catch (e) {}

    // 1. Logo entrance (Spring scale & fade in)
    Animated.parallel([
      Animated.spring(logoScale, {
        toValue: 1,
        friction: 5,
        tension: 40,
        useNativeDriver: true,
      }),
      Animated.timing(logoOpacity, {
        toValue: 1,
        duration: 400,
        useNativeDriver: true,
      }),
    ]).start();

    // 2. Continuous neon glow pulsing
    const pulseAnim = Animated.loop(
      Animated.sequence([
        Animated.timing(glowPulse, {
          toValue: 1,
          duration: 750,
          useNativeDriver: true,
        }),
        Animated.timing(glowPulse, {
          toValue: 0.35,
          duration: 750,
          useNativeDriver: true,
        }),
      ])
    );
    pulseAnim.start();

    // 3. Status text cycling
    const t1 = setTimeout(() => setStatusText(STATUS_MESSAGES[1]), 500);
    const t2 = setTimeout(() => setStatusText(STATUS_MESSAGES[2]), 1050);
    const t3 = setTimeout(() => setStatusText(STATUS_MESSAGES[3]), 1550);

    // 4. Progress bar numeric listener
    const listenerId = progressBar.addListener(({ value }) => {
      setPercent(Math.min(100, Math.floor(value * 100)));
    });

    // 5. Progress bar filling smoothly
    Animated.timing(progressBar, {
      toValue: 1,
      duration: 1800,
      useNativeDriver: false,
    }).start(() => {
      // 6. Silky fade-out exit revealing LoginScreen
      Animated.timing(screenFade, {
        toValue: 0,
        duration: 380,
        useNativeDriver: true,
      }).start(() => {
        pulseAnim.stop();
        if (onFinish) onFinish();
      });
    });

    return () => {
      clearTimeout(t1);
      clearTimeout(t2);
      clearTimeout(t3);
      progressBar.removeListener(listenerId);
      pulseAnim.stop();
    };
  }, []);

  const progressWidth = progressBar.interpolate({
    inputRange: [0, 1],
    outputRange: ['0%', '100%'],
  });

  return (
    <Animated.View
      pointerEvents={percent >= 100 ? 'none' : 'auto'}
      style={[
        styles.container,
        isGlass && styles.containerGlass,
        { opacity: screenFade },
      ]}
    >
      <StatusBar
        barStyle={isGlass ? 'dark-content' : 'light-content'}
        backgroundColor={isGlass ? '#f2f2f7' : '#0a0f1d'}
        translucent
      />

      {/* Ambient background glow orbs */}
      <Animated.View
        style={[
          styles.ambientGlowTop,
          isGlass && styles.ambientGlowTopGlass,
          {
            opacity: glowPulse,
            transform: [
              {
                scale: glowPulse.interpolate({
                  inputRange: [0.35, 1],
                  outputRange: [0.9, 1.15],
                }),
              },
            ],
          },
        ]}
      />
      <Animated.View
        style={[
          styles.ambientGlowBottom,
          isGlass && styles.ambientGlowBottomGlass,
          {
            opacity: glowPulse,
            transform: [
              {
                scale: glowPulse.interpolate({
                  inputRange: [0.35, 1],
                  outputRange: [1.12, 0.95],
                }),
              },
            ],
          },
        ]}
      />

      {/* Main Brand Content */}
      <Animated.View
        style={[
          styles.contentBox,
          {
            opacity: logoOpacity,
            transform: [{ scale: logoScale }],
          },
        ]}
      >
        {/* Glowing Icon Emblem */}
        <View style={styles.iconEmblem}>
          <Animated.View
            style={[
              styles.neonRing,
              isGlass && styles.neonRingGlass,
              {
                opacity: glowPulse,
                transform: [
                  {
                    scale: glowPulse.interpolate({
                      inputRange: [0.35, 1],
                      outputRange: [0.98, 1.1],
                    }),
                  },
                ],
              },
            ]}
          />
          <View style={[styles.innerCircle, isGlass && styles.innerCircleGlass]}>
            <Image
              source={require('../../assets/icon.png')}
              style={styles.logoIconImage}
              resizeMode="contain"
            />
          </View>
        </View>

        {/* Brand Name & Glowing Badge */}
        <View style={styles.titleRow}>
          <Text style={[styles.brandTitle, isGlass && styles.brandTitleGlass]}>
            QUIZZY
          </Text>
          <View style={[styles.proPill, isGlass && styles.proPillGlass]}>
            <Sparkles size={11} color={isGlass ? '#4f46e5' : '#c084fc'} />
            <Text style={[styles.proPillText, isGlass && styles.proPillTextGlass]}>
              AI PRO
            </Text>
          </View>
        </View>

        <Text style={[styles.brandSubtitle, isGlass && styles.brandSubtitleGlass]}>
          Clinical Practice & NMCLE Prep
        </Text>

        {/* Dynamic Status Message */}
        <View style={styles.statusBox}>
          <Text style={[styles.statusMessage, isGlass && styles.statusMessageGlass]}>
            {statusText}
          </Text>
        </View>

        {/* Glowing Progress Track & Bar */}
        <View style={styles.progressContainer}>
          <View style={[styles.progressTrack, isGlass && styles.progressTrackGlass]}>
            <Animated.View
              style={[
                styles.progressBar,
                isGlass && styles.progressBarGlass,
                { width: progressWidth },
              ]}
            />
          </View>
          <View style={styles.percentRow}>
            <Text style={[styles.percentText, isGlass && styles.percentTextGlass]}>
              {percent}%
            </Text>
          </View>
        </View>

        {/* Bottom verification badge */}
        <View style={styles.footerRow}>
          <ShieldCheck
            size={13}
            color={isGlass ? '#64748b' : '#475569'}
            style={{ marginRight: 5 }}
          />
          <Text style={[styles.footerText, isGlass && styles.footerTextGlass]}>
            Secure Offline Clinical Engine v2.1.3
          </Text>
        </View>
      </Animated.View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  container: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: '#0a0f1d',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 99999,
    elevation: 99999,
  },
  containerGlass: {
    backgroundColor: '#f2f2f7',
  },
  ambientGlowTop: {
    position: 'absolute',
    top: -80,
    right: -60,
    width: 290,
    height: 290,
    borderRadius: 145,
    backgroundColor: 'rgba(99, 102, 241, 0.18)',
  },
  ambientGlowTopGlass: {
    backgroundColor: 'rgba(79, 70, 229, 0.12)',
  },
  ambientGlowBottom: {
    position: 'absolute',
    bottom: -100,
    left: -70,
    width: 320,
    height: 320,
    borderRadius: 160,
    backgroundColor: 'rgba(168, 85, 247, 0.14)',
  },
  ambientGlowBottomGlass: {
    backgroundColor: 'rgba(99, 102, 241, 0.08)',
  },
  contentBox: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 30,
    width: '100%',
    maxWidth: 380,
  },
  iconEmblem: {
    width: 104,
    height: 104,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 20,
    position: 'relative',
  },
  neonRing: {
    position: 'absolute',
    width: 104,
    height: 104,
    borderRadius: 52,
    borderWidth: 2,
    borderColor: '#6366f1',
    backgroundColor: 'rgba(99, 102, 241, 0.22)',
    shadowColor: '#6366f1',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.85,
    shadowRadius: 20,
    elevation: 10,
  },
  neonRingGlass: {
    borderColor: '#4f46e5',
    backgroundColor: 'rgba(79, 70, 229, 0.15)',
    shadowColor: '#4f46e5',
  },
  innerCircle: {
    width: 82,
    height: 82,
    borderRadius: 41,
    backgroundColor: '#131b2e',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1.5,
    borderColor: '#334155',
    overflow: 'hidden',
  },
  innerCircleGlass: {
    backgroundColor: '#ffffff',
    borderColor: '#e2e8f0',
  },
  logoIconImage: {
    width: 60,
    height: 60,
    borderRadius: 14,
  },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 6,
  },
  brandTitle: {
    fontSize: 32,
    fontWeight: '900',
    color: '#ffffff',
    letterSpacing: 2.2,
    textShadowColor: 'rgba(99, 102, 241, 0.65)',
    textShadowOffset: { width: 0, height: 2 },
    textShadowRadius: 14,
  },
  brandTitleGlass: {
    color: '#0f172a',
    textShadowColor: 'rgba(79, 70, 229, 0.25)',
  },
  proPill: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(168, 85, 247, 0.22)',
    borderWidth: 1,
    borderColor: 'rgba(168, 85, 247, 0.45)',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 12,
    marginLeft: 8,
  },
  proPillGlass: {
    backgroundColor: 'rgba(79, 70, 229, 0.12)',
    borderColor: 'rgba(79, 70, 229, 0.3)',
  },
  proPillText: {
    color: '#e9d5ff',
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 0.8,
    marginLeft: 4,
  },
  proPillTextGlass: {
    color: '#4f46e5',
  },
  brandSubtitle: {
    fontSize: 13.5,
    fontWeight: '600',
    color: '#94a3b8',
    letterSpacing: 0.5,
    marginBottom: 28,
  },
  brandSubtitleGlass: {
    color: '#64748b',
  },
  statusBox: {
    height: 24,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 10,
  },
  statusMessage: {
    fontSize: 12.5,
    fontWeight: '600',
    color: '#a5b4fc',
    letterSpacing: 0.3,
  },
  statusMessageGlass: {
    color: '#4f46e5',
  },
  progressContainer: {
    width: 210,
    alignItems: 'center',
    marginBottom: 32,
  },
  progressTrack: {
    width: '100%',
    height: 5,
    backgroundColor: '#1e293b',
    borderRadius: 3,
    overflow: 'hidden',
  },
  progressTrackGlass: {
    backgroundColor: '#e2e8f0',
  },
  progressBar: {
    height: '100%',
    backgroundColor: '#6366f1',
    borderRadius: 3,
    shadowColor: '#818cf8',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 1,
    shadowRadius: 8,
  },
  progressBarGlass: {
    backgroundColor: '#4f46e5',
    shadowColor: '#4f46e5',
  },
  percentRow: {
    marginTop: 6,
    alignItems: 'center',
  },
  percentText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#64748b',
    letterSpacing: 0.5,
  },
  percentTextGlass: {
    color: '#94a3b8',
  },
  footerRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  footerText: {
    fontSize: 11,
    color: '#475569',
    fontWeight: '500',
    letterSpacing: 0.3,
  },
  footerTextGlass: {
    color: '#94a3b8',
  },
});
