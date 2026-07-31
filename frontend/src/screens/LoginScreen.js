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
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Mail, Lock, User, ArrowRight, Sparkles, CheckCircle2 } from 'lucide-react-native';
import { loginApi, registerApi } from '../services/api';

export default function LoginScreen({ navigation }) {
  const [isRegister, setIsRegister] = useState(false);
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
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
        >
          {/* Logo & Brand Title Header */}
          <View style={styles.brandContainer}>
            <View style={styles.logoWrapper}>
              <Image
                source={require('../../assets/logo2.png')}
                style={styles.logoImage}
                resizeMode="contain"
              />
            </View>

            <View style={styles.appNameRow}>
              <Text style={styles.appName}>QUIZZY</Text>
              <View style={styles.proBadge}>
                <Sparkles size={11} color="#a855f7" />
                <Text style={styles.proBadgeText}>PRO</Text>
              </View>
            </View>

            <Text style={styles.tagline}>Smart MCQ Practice & AI Medical Tutor</Text>
          </View>

          {/* Login / Register Toggle Tabs */}
          <View style={styles.tabContainer}>
            <TouchableOpacity
              style={[styles.tabBtn, !isRegister && styles.activeTabBtn]}
              onPress={() => setIsRegister(false)}
            >
              <Text style={[styles.tabBtnText, !isRegister && styles.activeTabBtnText]}>
                Sign In
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.tabBtn, isRegister && styles.activeTabBtn]}
              onPress={() => setIsRegister(true)}
            >
              <Text style={[styles.tabBtnText, isRegister && styles.activeTabBtnText]}>
                Register
              </Text>
            </TouchableOpacity>
          </View>

          {/* Form Fields */}
          <View style={styles.formCard}>
            {isRegister && (
              <View style={styles.inputGroup}>
                <Text style={styles.inputLabel}>Full Name</Text>
                <View style={styles.inputWrapper}>
                  <User size={18} color="#64748b" style={styles.inputIcon} />
                  <TextInput
                    style={styles.input}
                    placeholder="Enter your full name"
                    placeholderTextColor="#64748b"
                    value={name}
                    onChangeText={setName}
                  />
                </View>
              </View>
            )}

            <View style={styles.inputGroup}>
              <Text style={styles.inputLabel}>Email Address</Text>
              <View style={styles.inputWrapper}>
                <Mail size={18} color="#64748b" style={styles.inputIcon} />
                <TextInput
                  style={styles.input}
                  placeholder="name@example.com"
                  placeholderTextColor="#64748b"
                  value={email}
                  onChangeText={setEmail}
                  keyboardType="email-address"
                  autoCapitalize="none"
                />
              </View>
            </View>

            <View style={styles.inputGroup}>
              <Text style={styles.inputLabel}>Password</Text>
              <View style={styles.inputWrapper}>
                <Lock size={18} color="#64748b" style={styles.inputIcon} />
                <TextInput
                  style={styles.input}
                  placeholder="Enter your password"
                  placeholderTextColor="#64748b"
                  value={password}
                  onChangeText={setPassword}
                  secureTextEntry
                />
              </View>
            </View>

            {/* Submit Button */}
            <TouchableOpacity
              style={[styles.submitBtn, loading && { opacity: 0.7 }]}
              onPress={handleSubmit}
              disabled={loading}
              activeOpacity={0.8}
            >
              {loading ? (
                <ActivityIndicator size="small" color="#ffffff" />
              ) : (
                <View style={styles.submitBtnContent}>
                  <Text style={styles.submitBtnText}>
                    {isRegister ? 'Create QUIZZY Account' : 'Sign In to QUIZZY'}
                  </Text>
                  <ArrowRight size={18} color="#ffffff" style={{ marginLeft: 6 }} />
                </View>
              )}
            </TouchableOpacity>

            {/* Guest Quick Entry */}
            <TouchableOpacity
              style={styles.guestBtn}
              onPress={handleGuestLogin}
              activeOpacity={0.7}
            >
              <CheckCircle2 size={16} color="#818cf8" />
              <Text style={styles.guestBtnText}>Continue as Guest / Instant Entry</Text>
            </TouchableOpacity>
          </View>

          {/* Footer Info */}
          <Text style={styles.footerText}>
            QUIZZY • Powered by Gemini 3.6 Flash AI Engine
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
    paddingHorizontal: 20,
    paddingTop: 30,
    paddingBottom: 40,
    alignItems: 'center',
  },

  // Brand Header
  brandContainer: {
    alignItems: 'center',
    marginBottom: 28,
  },
  logoWrapper: {
    width: 90,
    height: 90,
    borderRadius: 24,
    backgroundColor: '#1e293b',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: '#6366f1',
    shadowColor: '#6366f1',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.35,
    shadowRadius: 10,
    elevation: 8,
    marginBottom: 14,
  },
  logoImage: {
    width: 68,
    height: 68,
  },
  appNameRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  appName: {
    fontSize: 32,
    fontWeight: '900',
    color: '#f8fafc',
    letterSpacing: 2,
  },
  proBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(168, 85, 247, 0.2)',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 8,
    marginLeft: 8,
    borderWidth: 1,
    borderColor: '#a855f7',
  },
  proBadgeText: {
    fontSize: 10,
    fontWeight: '800',
    color: '#c084fc',
    marginLeft: 3,
  },
  tagline: {
    fontSize: 13,
    color: '#94a3b8',
    marginTop: 4,
  },

  // Toggle Tabs
  tabContainer: {
    flexDirection: 'row',
    backgroundColor: '#1e293b',
    borderRadius: 12,
    padding: 4,
    width: '100%',
    marginBottom: 16,
    borderWidth: 1,
    borderColor: '#334155',
  },
  tabBtn: {
    flex: 1,
    paddingVertical: 10,
    alignItems: 'center',
    borderRadius: 8,
  },
  activeTabBtn: {
    backgroundColor: '#6366f1',
  },
  tabBtnText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#94a3b8',
  },
  activeTabBtnText: {
    color: '#ffffff',
    fontWeight: '700',
  },

  // Form Card
  formCard: {
    width: '100%',
    backgroundColor: '#1e293b',
    borderRadius: 16,
    padding: 18,
    borderWidth: 1,
    borderColor: '#334155',
    elevation: 4,
  },
  inputGroup: {
    marginBottom: 14,
  },
  inputLabel: {
    fontSize: 12.5,
    fontWeight: '700',
    color: '#cbd5e1',
    marginBottom: 6,
  },
  inputWrapper: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#0f172a',
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#334155',
    paddingHorizontal: 12,
  },
  inputIcon: {
    marginRight: 8,
  },
  input: {
    flex: 1,
    paddingVertical: 10,
    fontSize: 14,
    color: '#f8fafc',
  },
  submitBtn: {
    backgroundColor: '#6366f1',
    borderRadius: 10,
    paddingVertical: 12,
    alignItems: 'center',
    marginTop: 8,
    shadowColor: '#6366f1',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 6,
    elevation: 4,
  },
  submitBtnContent: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  submitBtnText: {
    fontSize: 15,
    fontWeight: '700',
    color: '#ffffff',
  },
  guestBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(99, 102, 241, 0.12)',
    borderRadius: 10,
    paddingVertical: 10,
    marginTop: 12,
    borderWidth: 1,
    borderColor: '#6366f1',
  },
  guestBtnText: {
    fontSize: 13,
    fontWeight: '700',
    color: '#818cf8',
    marginLeft: 6,
  },
  footerText: {
    fontSize: 11,
    color: '#64748b',
    marginTop: 24,
  },
});
