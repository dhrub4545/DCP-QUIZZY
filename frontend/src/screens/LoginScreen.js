import React, { useState } from 'react';
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
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Mail, Lock, User, ArrowRight, CheckCircle2, Eye, EyeOff } from 'lucide-react-native';
import { loginApi, registerApi } from '../services/api';

const { width } = Dimensions.get('window');

export default function LoginScreen({ navigation }) {
  const [isRegister, setIsRegister] = useState(false);
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);

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

  const handleGuestLogin = () => {
    navigation.replace('Home');
  };

  return (
    <SafeAreaView style={styles.container}>
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
          </View>

          {/* ── Bottom: Auth Card ── */}
          <View style={styles.authCard}>
            {/* Toggle Tabs */}
            <View style={styles.tabRow}>
              <TouchableOpacity
                style={[styles.tab, !isRegister && styles.tabActive]}
                onPress={() => setIsRegister(false)}
                activeOpacity={0.7}
              >
                <Text style={[styles.tabText, !isRegister && styles.tabTextActive]}>Sign In</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.tab, isRegister && styles.tabActive]}
                onPress={() => setIsRegister(true)}
                activeOpacity={0.7}
              >
                <Text style={[styles.tabText, isRegister && styles.tabTextActive]}>Register</Text>
              </TouchableOpacity>
            </View>

            {/* Form Fields */}
            {isRegister && (
              <View style={styles.fieldBlock}>
                <Text style={styles.fieldLabel}>Full Name</Text>
                <View style={styles.fieldRow}>
                  <User size={16} color="#64748b" />
                  <TextInput
                    style={styles.fieldInput}
                    placeholder="Enter your full name"
                    placeholderTextColor="#475569"
                    value={name}
                    onChangeText={setName}
                  />
                </View>
              </View>
            )}

            <View style={styles.fieldBlock}>
              <Text style={styles.fieldLabel}>Email Address</Text>
              <View style={styles.fieldRow}>
                <Mail size={16} color="#64748b" />
                <TextInput
                  style={styles.fieldInput}
                  placeholder="name@example.com"
                  placeholderTextColor="#475569"
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
                <Lock size={16} color="#64748b" />
                <TextInput
                  style={styles.fieldInput}
                  placeholder="Enter your password"
                  placeholderTextColor="#475569"
                  value={password}
                  onChangeText={setPassword}
                  secureTextEntry={!showPassword}
                />
                <TouchableOpacity onPress={() => setShowPassword(!showPassword)} hitSlop={8}>
                  {showPassword
                    ? <EyeOff size={16} color="#94a3b8" />
                    : <Eye size={16} color="#94a3b8" />
                  }
                </TouchableOpacity>
              </View>
            </View>

            {/* Submit */}
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

            {/* Divider */}
            <View style={styles.dividerRow}>
              <View style={styles.dividerLine} />
              <Text style={styles.dividerText}>or</Text>
              <View style={styles.dividerLine} />
            </View>

            {/* Guest */}
            <TouchableOpacity
              style={styles.guestBtn}
              onPress={handleGuestLogin}
              activeOpacity={0.7}
            >
              <CheckCircle2 size={15} color="#818cf8" />
              <Text style={styles.guestBtnText}>Continue as Guest</Text>
            </TouchableOpacity>
          </View>

          {/* Footer */}
          <Text style={styles.footerText}>
            Powered by Gemini 3.6 Flash AI Engine
          </Text>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0f172a',
  },
  scrollContent: {
    flexGrow: 1,
    paddingHorizontal: 22,
    justifyContent: 'center',
    paddingVertical: 20,
  },

  /* ── Hero / Logo ── */
  heroSection: {
    alignItems: 'center',
    marginBottom: 28,
  },
  logoImage: {
    width: width * 0.38,
    height: width * 0.38,
    marginBottom: 10,
  },
  tagline: {
    fontSize: 13,
    color: '#94a3b8',
    letterSpacing: 0.2,
  },

  /* ── Auth Card ── */
  authCard: {
    backgroundColor: '#1e293b',
    borderRadius: 20,
    padding: 18,
    borderWidth: 1,
    borderColor: '#334155',
  },

  /* Tabs */
  tabRow: {
    flexDirection: 'row',
    backgroundColor: '#0f172a',
    borderRadius: 12,
    padding: 3,
    marginBottom: 18,
  },
  tab: {
    flex: 1,
    paddingVertical: 9,
    alignItems: 'center',
    borderRadius: 10,
  },
  tabActive: {
    backgroundColor: '#6366f1',
  },
  tabText: {
    fontSize: 13.5,
    fontWeight: '600',
    color: '#64748b',
  },
  tabTextActive: {
    color: '#ffffff',
    fontWeight: '700',
  },

  /* Fields */
  fieldBlock: {
    marginBottom: 14,
  },
  fieldLabel: {
    fontSize: 12,
    fontWeight: '600',
    color: '#cbd5e1',
    marginBottom: 5,
    marginLeft: 2,
  },
  fieldRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#0f172a',
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
  },

  /* Primary Button */
  primaryBtn: {
    backgroundColor: '#6366f1',
    borderRadius: 12,
    paddingVertical: 13,
    alignItems: 'center',
    marginTop: 4,
    shadowColor: '#6366f1',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.35,
    shadowRadius: 8,
    elevation: 6,
  },
  primaryBtnRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  primaryBtnText: {
    fontSize: 14.5,
    fontWeight: '700',
    color: '#ffffff',
  },

  /* Divider */
  dividerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginVertical: 14,
  },
  dividerLine: {
    flex: 1,
    height: 1,
    backgroundColor: '#334155',
  },
  dividerText: {
    fontSize: 11.5,
    color: '#64748b',
    marginHorizontal: 10,
    fontWeight: '600',
  },

  /* Guest */
  guestBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(99, 102, 241, 0.1)',
    borderRadius: 12,
    paddingVertical: 11,
    borderWidth: 1,
    borderColor: 'rgba(99, 102, 241, 0.25)',
    gap: 6,
  },
  guestBtnText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#818cf8',
  },

  /* Footer */
  footerText: {
    fontSize: 11,
    color: '#475569',
    textAlign: 'center',
    marginTop: 20,
  },
});
