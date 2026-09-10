import React, { useEffect, useRef } from 'react';
import { View, Text, StyleSheet, Animated, ActivityIndicator, Modal } from 'react-native';
import { Sparkles } from 'lucide-react-native';
import { useTheme } from '../context/ThemeContext';

export default function PageLoadingAnimation({
  title = 'Loading...',
  subtitle = 'Please wait a moment while we prepare your content',
  icon: IconComponent = Sparkles,
  fullScreen = false,
  onDismiss,
}) {
  const { isGlass } = useTheme();
  const pulseAnim = useRef(new Animated.Value(0.4)).current;
  const scaleAnim = useRef(new Animated.Value(0.95)).current;
  const barAnim = useRef(new Animated.Value(0.2)).current;

  useEffect(() => {
    const pulse = Animated.loop(
      Animated.sequence([
        Animated.parallel([
          Animated.timing(pulseAnim, {
            toValue: 1,
            duration: 750,
            useNativeDriver: true,
          }),
          Animated.timing(scaleAnim, {
            toValue: 1.05,
            duration: 750,
            useNativeDriver: true,
          }),
          Animated.timing(barAnim, {
            toValue: 1,
            duration: 750,
            useNativeDriver: true,
          }),
        ]),
        Animated.parallel([
          Animated.timing(pulseAnim, {
            toValue: 0.4,
            duration: 750,
            useNativeDriver: true,
          }),
          Animated.timing(scaleAnim, {
            toValue: 0.95,
            duration: 750,
            useNativeDriver: true,
          }),
          Animated.timing(barAnim, {
            toValue: 0.2,
            duration: 750,
            useNativeDriver: true,
          }),
        ]),
      ])
    );
    pulse.start();
    return () => pulse.stop();
  }, [pulseAnim, scaleAnim, barAnim]);

  const loadingContent = (
    <>
      <Animated.View
        style={[
          styles.iconGlowWrapper,
          isGlass ? styles.iconGlowWrapperGlass : styles.iconGlowWrapperDark,
          { opacity: pulseAnim, transform: [{ scale: scaleAnim }] },
        ]}
      >
        <IconComponent size={28} color={isGlass ? '#4f46e5' : '#818cf8'} />
      </Animated.View>

      <ActivityIndicator size="large" color={isGlass ? '#4f46e5' : '#6366f1'} style={styles.spinner} />

      <Text style={[styles.title, isGlass ? styles.titleGlass : styles.titleDark]} numberOfLines={2}>
        {title}
      </Text>
      
      {subtitle ? (
        <Text style={[styles.subtitle, isGlass ? styles.subtitleGlass : styles.subtitleDark]} numberOfLines={3}>
          {subtitle}
        </Text>
      ) : null}

      <View style={[styles.progressTrack, isGlass ? styles.progressTrackGlass : styles.progressTrackDark]}>
        <Animated.View
          style={[
            styles.progressFill,
            isGlass ? styles.progressFillGlass : styles.progressFillDark,
            {
              opacity: pulseAnim,
              transform: [{ scaleX: barAnim }],
            },
          ]}
        />
      </View>
    </>
  );

  if (fullScreen) {
    return (
      <Modal
        visible={true}
        transparent={true}
        animationType="fade"
        statusBarTranslucent={true}
        onRequestClose={onDismiss || (() => {})}
      >
        <View style={[styles.modalBackdrop, isGlass ? styles.modalBackdropGlass : styles.modalBackdropDark]}>
          <View style={[styles.modalCard, isGlass ? styles.modalCardGlass : styles.modalCardDark]}>
            {loadingContent}
          </View>
        </View>
      </Modal>
    );
  }

  return (
    <View style={[styles.container, isGlass ? styles.containerGlass : styles.containerDark]}>
      {loadingContent}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
    minHeight: 280,
  },
  containerDark: {
    backgroundColor: '#0f172a',
  },
  containerGlass: {
    backgroundColor: '#f2f2f7',
  },
  modalBackdrop: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 20,
  },
  modalBackdropDark: {
    backgroundColor: 'rgba(15, 23, 42, 0.82)',
  },
  modalBackdropGlass: {
    backgroundColor: 'rgba(15, 23, 42, 0.45)',
  },
  modalCard: {
    width: '88%',
    maxWidth: 340,
    borderRadius: 20,
    paddingVertical: 26,
    paddingHorizontal: 22,
    alignItems: 'center',
    justifyContent: 'center',
    elevation: 14,
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.25,
    shadowRadius: 16,
  },
  modalCardDark: {
    backgroundColor: '#1e293b',
    borderColor: '#334155',
    borderWidth: 1.5,
    shadowColor: '#000',
  },
  modalCardGlass: {
    backgroundColor: '#ffffff',
    borderColor: '#e2e8f0',
    borderWidth: 1.5,
    shadowColor: '#475569',
  },
  iconGlowWrapper: {
    width: 66,
    height: 66,
    borderRadius: 33,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 16,
    borderWidth: 1.5,
  },
  iconGlowWrapperDark: {
    backgroundColor: 'rgba(99, 102, 241, 0.18)',
    borderColor: '#6366f1',
    shadowColor: '#6366f1',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.35,
    shadowRadius: 10,
    elevation: 4,
  },
  iconGlowWrapperGlass: {
    backgroundColor: 'rgba(79, 70, 229, 0.12)',
    borderColor: '#4f46e5',
    shadowColor: '#4f46e5',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.25,
    shadowRadius: 8,
    elevation: 3,
  },
  spinner: {
    marginBottom: 14,
  },
  title: {
    fontSize: 16,
    fontWeight: '800',
    textAlign: 'center',
    marginBottom: 6,
    letterSpacing: 0.3,
  },
  titleDark: {
    color: '#f8fafc',
  },
  titleGlass: {
    color: '#0f172a',
  },
  subtitle: {
    fontSize: 12.5,
    textAlign: 'center',
    maxWidth: 280,
    lineHeight: 18,
    marginBottom: 16,
  },
  subtitleDark: {
    color: '#94a3b8',
  },
  subtitleGlass: {
    color: '#64748b',
  },
  progressTrack: {
    width: 140,
    height: 4,
    borderRadius: 2,
    overflow: 'hidden',
    marginTop: 4,
  },
  progressTrackDark: {
    backgroundColor: '#334155',
  },
  progressTrackGlass: {
    backgroundColor: '#e2e8f0',
  },
  progressFill: {
    width: '100%',
    height: '100%',
    borderRadius: 2,
  },
  progressFillDark: {
    backgroundColor: '#6366f1',
  },
  progressFillGlass: {
    backgroundColor: '#4f46e5',
  },
});
