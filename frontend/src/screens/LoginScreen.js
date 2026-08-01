import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  Image,
  ActivityIndicator,
  Alert,
  ScrollView,
  KeyboardAvoidingView,
  Platform,
  Dimensions,
  Animated,
  StatusBar,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Mail, Lock, User, ArrowRight, Eye, EyeOff, Sparkles } from 'lucide-react-native';
import { loginApi, registerApi } from '../services/api';

const { width } = Dimensions.get('window');

const BG_IMAGES = [
  require('../../assets/login_bg1.jpg'),
  require('../../assets/login_bg2.jpg'),
  require('../../assets/login_bg3.jpg'),
];

export default function LoginScreen({ navigation }) {
  const [isRegister, setIsRegister] = useState(false);
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);

  // Live Background Slideshow State
  const [bgIndex, setBgIndex] = useState(0);
  const fadeAnim = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    const timer = setInterval(() => {
      // Fade out slightly
      Animated.timing(fadeAnim, {
        toValue: 0.35,
        duration: 900,
        useNativeDriver: true,
      }).start(() => {
        setBgIndex((prev) => (prev + 1) % BG_IMAGES.length);
        // Fade smoothly back in
        Animated.timing(fadeAnim, {
          toValue: 1,
          duration: 900,
          useNativeDriver: true,
        }).start();
      });
    }, 5500);

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
    <View style={styles.container}>
      <StatusBar translucent backgroundColor="transparent" barStyle="light-content" />

      {/* ── True Edge-To-Edge Fullscreen Background & Overlay ── */}
      <View style={styles.bgContainer}>
        <Animated.Image
          source={BG_IMAGES[bgIndex]}
          style={[styles.bgImage, { opacity: fadeAnim }]}
          resizeMode="cover"
        />
        <View style={styles.bgOverlay} />
      </View>

      <SafeAreaView style={{ flex: 1 }}>
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
          style={{ flex: 1 }}
        >
          <ScrollView
            contentContainerStyle={styles.scrollContent}
            keyboardShouldPersistTaps="handled"
            showsVerticalScrollIndicator={false}
          >
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

            {/* ── Bottom: Glassmorphism Auth Card ── */}
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
                    <User size={16} color="#818cf8" />
                    <TextInput
                      style={styles.fieldInput}
                      placeholder="Enter your full name"
                      placeholderTextColor="#64748b"
                      value={name}
                      onChangeText={setName}
                    />
                  </View>
                </View>
              )}

              <View style={styles.fieldBlock}>
                <Text style={styles.fieldLabel}>Email Address</Text>
                <View style={styles.fieldRow}>
                  <Mail size={16} color="#818cf8" />
                  <TextInput
                    style={styles.fieldInput}
                    placeholder="name@example.com"
                    placeholderTextColor="#64748b"
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
                  <Lock size={16} color="#818cf8" />
                  <TextInput
                    style={styles.fieldInput}
                    placeholder="Enter your password"
                    placeholderTextColor="#64748b"
                    value={password}
                    onChangeText={setPassword}
                    secureTextEntry={!showPassword}
                  />
                  <TouchableOpacity onPress={() => setShowPassword(!showPassword)} hitSlop={8}>
                    {showPassword ? (
                      <EyeOff size={16} color="#94a3b8" />
                    ) : (
                      <Eye size={16} color="#94a3b8" />
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
                    <ArrowRight size={17} color="#fff" style={{ marginLeft: 5 }} />
                  </View>
                )}
              </TouchableOpacity>
            </View>

            {/* Footer */}
            <View style={styles.footerRow}>
              <Sparkles size={13} color="#a855f7" style={{ marginRight: 4 }} />
              <Text style={styles.footerText}>
                Powered by Gemini 3.6 Flash AI Engine
              </Text>
            </View>
          </ScrollView>
        </KeyboardAvoidingView>
      </SafeAreaView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0f172a',
  },
  bgContainer: {
    ...StyleSheet.absoluteFillObject,
    width: '100%',
    height: '100%',
  },
  bgImage: {
    width: '100%',
    height: '100%',
  },
  bgOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(15, 23, 42, 0.82)',
  },
  scrollContent: {
    flexGrow: 1,
    paddingHorizontal: 20,
    justifyContent: 'center',
    paddingVertical: 16,
  },

  /* ── Hero Section ── */
  heroSection: {
    alignItems: 'center',
    marginBottom: 20,
  },
  logoImage: {
    width: width * 0.52,
    height: width * 0.52,
    marginBottom: 4,
  },
  tagline: {
    fontSize: 12.5,
    color: '#cbd5e1',
    marginTop: 2,
    fontWeight: '500',
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
    backgroundColor: 'rgba(255, 255, 255, 0.25)',
  },
  indicatorDotActive: {
    width: 18,
    backgroundColor: '#a855f7',
  },

  /* ── Glassmorphism Auth Card ── */
  authCard: {
    backgroundColor: 'rgba(30, 41, 59, 0.88)',
    borderRadius: 22,
    padding: 18,
    borderWidth: 1.5,
    borderColor: 'rgba(168, 85, 247, 0.35)',
    shadowColor: '#a855f7',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.3,
    shadowRadius: 10,
    elevation: 8,
  },

  /* Tabs */
  tabRow: {
    flexDirection: 'row',
    backgroundColor: 'rgba(15, 23, 42, 0.75)',
    borderRadius: 12,
    padding: 3,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: '#334155',
  },
  tab: {
    flex: 1,
    paddingVertical: 9,
    alignItems: 'center',
    borderRadius: 9,
  },
  tabActive: {
    backgroundColor: '#6366f1',
  },
  tabText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#94a3b8',
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
    fontSize: 12,
    fontWeight: '600',
    color: '#cbd5e1',
    marginBottom: 4,
    marginLeft: 2,
  },
  fieldRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(15, 23, 42, 0.85)',
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderWidth: 1,
    borderColor: '#334155',
    gap: 8,
  },
  fieldInput: {
    flex: 1,
    fontSize: 13.5,
    color: '#f8fafc',
    padding: 0,
    fontWeight: '500',
  },

  /* Primary Button */
  primaryBtn: {
    backgroundColor: '#a855f7',
    borderRadius: 12,
    paddingVertical: 13,
    alignItems: 'center',
    marginTop: 6,
    shadowColor: '#a855f7',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.4,
    shadowRadius: 8,
    elevation: 6,
  },
  primaryBtnRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  primaryBtnText: {
    fontSize: 14.5,
    fontWeight: '800',
    color: '#ffffff',
  },

  /* Footer */
  footerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 18,
  },
  footerText: {
    fontSize: 11,
    color: '#94a3b8',
    textAlign: 'center',
    fontWeight: '500',
  },
});
