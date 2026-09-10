import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  Image,
  ImageBackground,
  ActivityIndicator,
  Alert,
  ScrollView,
  KeyboardAvoidingView,
  Platform,
  Dimensions,
  StatusBar,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Mail, Lock, User, ArrowRight, Eye, EyeOff, Sparkles } from 'lucide-react-native';
import { loginApi, registerApi } from '../services/api';

const { width } = Dimensions.get('window');

const BG_IMAGES = [
  require('../../assets/login_bg1.jpg'),
  require('../../assets/login_bg2.jpg'),
  require('../../assets/login_bg3.jpg'),
];

export default function LoginScreen({ navigation }) {
  const insets = useSafeAreaInsets();
  const topPadding = Math.max(insets?.top || 0, Platform.OS === 'android' ? (StatusBar.currentHeight || 28) : 44);
  const bottomPadding = Math.max(insets?.bottom || 0, 20);

  const [isRegister, setIsRegister] = useState(false);
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);

  // Live Background Slideshow State
  const [bgIndex, setBgIndex] = useState(0);

  useEffect(() => {
    const timer = setInterval(() => {
      setBgIndex((prev) => (prev + 1) % BG_IMAGES.length);
    }, 6000);

    return () => clearInterval(timer);
  }, []);

  const handleSubmit = async () => {
    if (!email.trim() || !password.trim()) {
      Alert.alert('Validation Error', 'Please enter your email and password.');
      return;
    }

    if (isRegister && !name.trim()) {
      Alert.alert('Validation Error', 'Please enter your name.');
      return;
    }

    try {
      setLoading(true);
      if (isRegister) {
        const res = await registerApi({
          name: name.trim(),
          email: email.trim(),
          password: password.trim(),
        });
        if (res && res.success) {
          Alert.alert('Welcome to QUIZZY! 🎉', 'Your account has been created successfully!');
          navigation.replace('Home');
        }
      } else {
        const res = await loginApi({
          email: email.trim(),
          password: password.trim(),
        });
        if (res && res.success) {
          navigation.replace('Home');
        }
      }
    } catch (err) {
      console.warn('Auth error:', err);
      Alert.alert(
        isRegister ? 'Registration Error' : 'Login Error',
        err.response?.data?.message || err.message || 'Authentication failed.'
      );
    } finally {
      setLoading(false);
    }
  };

  return (
    <ImageBackground
      source={BG_IMAGES[bgIndex]}
      style={styles.container}
      resizeMode="cover"
    >
      <StatusBar translucent backgroundColor="transparent" barStyle="dark-content" />

      {/* ── Frosted Soft Light Overlay Encapsulating All Content ── */}
      <View style={styles.bgOverlay}>
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
          enabled={Platform.OS === 'ios'}
          style={styles.keyboardAvoid}
        >
          <ScrollView
            style={styles.scrollView}
            contentContainerStyle={[
              styles.scrollContent,
              {
                paddingTop: topPadding + 8,
                paddingBottom: bottomPadding + 16,
              },
            ]}
            keyboardShouldPersistTaps="handled"
            showsVerticalScrollIndicator={false}
          >
            {/* Centering Wrapper: Native Android Safe */}
            <View style={styles.centerWrapper}>
            {/* ── Top: Logo & Brand ── */}
            <View style={styles.heroSection}>
              <Image
                source={require('../../assets/logo2.png')}
                style={styles.logoImage}
                resizeMode="contain"
              />
              <Text style={styles.tagline}>Smart MCQ Practice & AI Medical Tutor</Text>

              {/* Live Slide Indicators */}
              <View style={styles.indicatorRow}>
                {BG_IMAGES.map((_, idx) => (
                  <View
                    key={idx}
                    style={[
                      styles.indicatorDot,
                      bgIndex === idx && styles.indicatorDotActive,
                    ]}
                  />
                ))}
              </View>
            </View>

            {/* ── Bottom: Premium Frosted White Auth Card ── */}
            <View style={styles.authCard}>
              {/* Toggle Tabs */}
              <View style={styles.tabRow}>
                <TouchableOpacity
                  style={[styles.tab, !isRegister && styles.tabActive]}
                  onPress={() => setIsRegister(false)}
                  activeOpacity={0.8}
                >
                  <Text style={[styles.tabText, !isRegister && styles.tabTextActive]}>Sign In</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.tab, isRegister && styles.tabActive]}
                  onPress={() => setIsRegister(true)}
                  activeOpacity={0.8}
                >
                  <Text style={[styles.tabText, isRegister && styles.tabTextActive]}>Register</Text>
                </TouchableOpacity>
              </View>

              {/* Form Fields */}
              {isRegister && (
                <View style={styles.fieldBlock}>
                  <Text style={styles.fieldLabel}>Full Name</Text>
                  <View style={styles.fieldRow}>
                    <User size={16} color="#2563eb" />
                    <TextInput
                      style={styles.fieldInput}
                      placeholder="Enter your full name"
                      placeholderTextColor="#94a3b8"
                      value={name}
                      onChangeText={setName}
                    />
                  </View>
                </View>
              )}

              <View style={styles.fieldBlock}>
                <Text style={styles.fieldLabel}>Email Address</Text>
                <View style={styles.fieldRow}>
                  <Mail size={16} color="#2563eb" />
                  <TextInput
                    style={styles.fieldInput}
                    placeholder="name@example.com"
                    placeholderTextColor="#94a3b8"
                    value={email}
                    onChangeText={setEmail}
                    keyboardType="email-address"
                    autoCapitalize="none"
                  />
                </View>
              </View>

              <View style={styles.fieldBlock}>
                <Text style={styles.fieldLabel}>Password</Text>
                <View style={styles.fieldRow}>
                  <Lock size={16} color="#2563eb" />
                  <TextInput
                    style={styles.fieldInput}
                    placeholder="Enter your password"
                    placeholderTextColor="#94a3b8"
                    value={password}
                    onChangeText={setPassword}
                    secureTextEntry={!showPassword}
                  />
                  <TouchableOpacity onPress={() => setShowPassword(!showPassword)} hitSlop={8}>
                    {showPassword ? (
                      <EyeOff size={16} color="#64748b" />
                    ) : (
                      <Eye size={16} color="#64748b" />
                    )}
                  </TouchableOpacity>
                </View>
              </View>

              {/* Submit Button */}
              <TouchableOpacity
                style={[styles.primaryBtn, loading && { opacity: 0.65 }]}
                onPress={handleSubmit}
                disabled={loading}
                activeOpacity={0.8}
              >
                {loading ? (
                  <ActivityIndicator size="small" color="#fff" />
                ) : (
                  <View style={styles.primaryBtnRow}>
                    <Text style={styles.primaryBtnText}>
                      {isRegister ? 'Create Account' : 'Sign In'}
                    </Text>
                    <View style={{ marginLeft: 6 }}>
                      <ArrowRight size={17} color="#fff" />
                    </View>
                  </View>
                )}
              </TouchableOpacity>
            </View>

            {/* Footer */}
            <View style={styles.footerRow}>
              <View style={{ marginRight: 5 }}>
                <Sparkles size={13} color="#2563eb" />
              </View>
              <Text style={styles.footerText}>
                Powered by Gemini 3.6 Flash AI Engine
              </Text>
            </View>
          </View>
          </ScrollView>
        </KeyboardAvoidingView>
      </View>
    </ImageBackground>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f8fafc',
  },
  keyboardAvoid: {
    flex: 1,
    width: '100%',
  },
  scrollView: {
    flex: 1,
    width: '100%',
  },
  scrollContent: {
    flexGrow: 1,
    paddingHorizontal: 20,
    justifyContent: 'center',
    alignItems: 'center',
  },
  centerWrapper: {
    width: '100%',
    maxWidth: 440,
    alignItems: 'center',
    paddingVertical: 16,
  },
  bgOverlay: {
    flex: 1,
    width: '100%',
    height: '100%',
    backgroundColor: 'rgba(255, 255, 255, 0.42)',
  },

  /* ── Hero Section ── */
  heroSection: {
    alignItems: 'center',
    marginBottom: 16,
    width: '100%',
    maxWidth: 440,
  },
  logoImage: {
    width: Math.min(width * 0.48, 190),
    height: Math.min(width * 0.48, 190),
    marginBottom: 2,
  },
  tagline: {
    fontSize: 13,
    color: '#334155',
    marginTop: 2,
    fontWeight: '600',
    letterSpacing: 0.2,
  },
  indicatorRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginTop: 10,
  },
  indicatorDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: 'rgba(37, 99, 235, 0.22)',
  },
  indicatorDotActive: {
    width: 20,
    backgroundColor: '#2563eb',
  },

  /* ── Premium Frosted White Auth Card ── */
  authCard: {
    backgroundColor: 'rgba(255, 255, 255, 0.95)',
    borderRadius: 24,
    padding: 22,
    borderWidth: 1.5,
    borderColor: 'rgba(37, 99, 235, 0.2)',
    shadowColor: '#1d4ed8',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.12,
    shadowRadius: 16,
    elevation: 8,
    width: '100%',
    maxWidth: 440,
  },

  /* Tabs */
  tabRow: {
    flexDirection: 'row',
    backgroundColor: '#f1f5f9',
    borderRadius: 14,
    padding: 4,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: '#e2e8f0',
  },
  tab: {
    flex: 1,
    paddingVertical: 10,
    alignItems: 'center',
    borderRadius: 10,
  },
  tabActive: {
    backgroundColor: '#2563eb',
    shadowColor: '#2563eb',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 4,
    elevation: 3,
  },
  tabText: {
    fontSize: 13.5,
    fontWeight: '600',
    color: '#64748b',
  },
  tabTextActive: {
    color: '#ffffff',
    fontWeight: '800',
  },

  /* Fields */
  fieldBlock: {
    marginBottom: 12,
  },
  fieldLabel: {
    fontSize: 12.5,
    fontWeight: '600',
    color: '#334155',
    marginBottom: 5,
    marginLeft: 2,
  },
  fieldRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#f8fafc',
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 11,
    borderWidth: 1,
    borderColor: '#cbd5e1',
    gap: 8,
  },
  fieldInput: {
    flex: 1,
    fontSize: 13.5,
    color: '#0f172a',
    padding: 0,
    fontWeight: '500',
  },

  /* Primary Button */
  primaryBtn: {
    backgroundColor: '#2563eb',
    borderRadius: 12,
    paddingVertical: 13,
    alignItems: 'center',
    marginTop: 6,
    shadowColor: '#2563eb',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.35,
    shadowRadius: 8,
    elevation: 6,
  },
  primaryBtnRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  primaryBtnText: {
    fontSize: 15,
    fontWeight: '800',
    color: '#ffffff',
    letterSpacing: 0.3,
  },

  /* Footer */
  footerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 18,
  },
  footerText: {
    fontSize: 11.5,
    color: '#475569',
    textAlign: 'center',
    fontWeight: '600',
  },
});
