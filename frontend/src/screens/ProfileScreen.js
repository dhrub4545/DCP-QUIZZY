import React, { useState, useEffect, useCallback } from 'react';
import { useFocusEffect } from '@react-navigation/native';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  TextInput,
  ScrollView,
  Alert,
  ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import {
  User,
  Mail,
  Lock,
  Eye,
  EyeOff,
  LogOut,
  ShieldCheck,
  Award,
  BookOpen,
  KeyRound,
  CheckCircle2,
} from 'lucide-react-native';
import { changePasswordApi, fetchHistoryApi, setAuthToken } from '../services/api';
import BottomTabBar from '../components/BottomTabBar';

export default function ProfileScreen({ navigation, route }) {
  const user = route?.params?.user || { name: 'User Profile', email: 'student@quizzy.app' };

  // Password Change Form State
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  
  const [showCurrentPassword, setShowCurrentPassword] = useState(false);
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);

  const [submitting, setSubmitting] = useState(false);
  const [historyCount, setHistoryCount] = useState(0);
  const [avgScore, setAvgScore] = useState(0);

  const loadProfileStats = async () => {
    try {
      const data = await fetchHistoryApi();
      if (data && data.history) {
        setHistoryCount(data.history.length);
        if (data.history.length > 0) {
          const totalAcc = data.history.reduce((sum, item) => sum + (item.accuracyPercentage || 0), 0);
          setAvgScore(Math.round(totalAcc / data.history.length));
        }
      }
    } catch (err) {
      console.warn('Failed to load profile history stats:', err.message);
    }
  };

  useFocusEffect(
    useCallback(() => {
      loadProfileStats();
    }, [])
  );

  const handleChangePassword = async () => {
    if (!currentPassword || !newPassword || !confirmPassword) {
      Alert.alert('Validation Error', 'Please fill in all password fields.');
      return;
    }

    if (newPassword.length < 6) {
      Alert.alert('Validation Error', 'New password must be at least 6 characters long.');
      return;
    }

    if (newPassword !== confirmPassword) {
      Alert.alert('Validation Error', 'New password and confirm password do not match.');
      return;
    }

    try {
      setSubmitting(true);
      const res = await changePasswordApi({ currentPassword, newPassword });
      if (res && res.success) {
        Alert.alert('Success', 'Your password has been changed successfully!');
        setCurrentPassword('');
        setNewPassword('');
        setConfirmPassword('');
      } else {
        throw new Error(res?.message || 'Failed to update password.');
      }
    } catch (err) {
      Alert.alert('Update Error', err.response?.data?.message || err.message || 'Failed to update password.');
    } finally {
      setSubmitting(false);
    }
  };

  const handleLogout = () => {
    Alert.alert(
      'Log Out',
      'Are you sure you want to log out of your account?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Log Out',
          style: 'destructive',
          onPress: () => {
            setAuthToken(null);
            navigation.reset({
              index: 0,
              routes: [{ name: 'Login' }],
            });
          },
        },
      ]
    );
  };

  const getUserInitials = (nameStr) => {
    if (!nameStr) return 'U';
    const parts = nameStr.trim().split(' ');
    if (parts.length >= 2) {
      return (parts[0][0] + parts[1][0]).toUpperCase();
    }
    return parts[0].slice(0, 2).toUpperCase();
  };

  const handleTabPress = (tabName) => {
    if (tabName === 'Home') {
      navigation.navigate('Home');
    } else if (tabName === 'Quizzes') {
      navigation.navigate('Quizzes');
    } else if (tabName === 'Study') {
      navigation.navigate('Study');
    } else if (tabName === 'History') {
      navigation.navigate('History');
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView style={styles.scrollBody} showsVerticalScrollIndicator={false}>
        {/* Profile User Header Card */}
        <View style={styles.userHeaderCard}>
          <View style={styles.avatarCircle}>
            <Text style={styles.avatarText}>{getUserInitials(user.name)}</Text>
          </View>

          <View style={styles.userInfo}>
            <Text style={styles.userName}>{user.name || 'Student Account'}</Text>
            <View style={styles.emailRow}>
              <Mail size={13} color="#94a3b8" style={{ marginRight: 4 }} />
              <Text style={styles.userEmail}>{user.email || 'student@quizzy.app'}</Text>
            </View>
            <View style={styles.activeBadge}>
              <ShieldCheck size={12} color="#34d399" style={{ marginRight: 3 }} />
              <Text style={styles.activeBadgeText}>Secured Account</Text>
            </View>
          </View>
        </View>

        {/* Account Performance Summary */}
        <View style={styles.statsRowContainer}>
          <View style={styles.statBox}>
            <Award size={18} color="#818cf8" style={{ marginBottom: 4 }} />
            <Text style={styles.statNumber}>{historyCount}</Text>
            <Text style={styles.statLabel}>Tests Attempted</Text>
          </View>

          <View style={styles.statBox}>
            <CheckCircle2 size={18} color="#34d399" style={{ marginBottom: 4 }} />
            <Text style={styles.statNumber}>{avgScore}%</Text>
            <Text style={styles.statLabel}>Avg Accuracy</Text>
          </View>
        </View>

        {/* Change Password Card */}
        <View style={styles.cardSection}>
          <View style={styles.cardHeaderRow}>
            <KeyRound size={18} color="#818cf8" style={{ marginRight: 6 }} />
            <Text style={styles.cardHeaderTitle}>Change Password</Text>
          </View>
          <Text style={styles.cardHeaderSub}>
            Update your account password to keep your profile secure.
          </Text>

          {/* Current Password */}
          <View style={styles.inputGroup}>
            <Text style={styles.inputLabel}>Current Password</Text>
            <View style={styles.passwordInputWrapper}>
              <Lock size={15} color="#64748b" style={styles.inputIcon} />
              <TextInput
                style={styles.passwordInput}
                secureTextEntry={!showCurrentPassword}
                placeholder="Enter current password"
                placeholderTextColor="#64748b"
                value={currentPassword}
                onChangeText={setCurrentPassword}
              />
              <TouchableOpacity onPress={() => setShowCurrentPassword(!showCurrentPassword)}>
                {showCurrentPassword ? <EyeOff size={16} color="#94a3b8" /> : <Eye size={16} color="#94a3b8" />}
              </TouchableOpacity>
            </View>
          </View>

          {/* New Password */}
          <View style={styles.inputGroup}>
            <Text style={styles.inputLabel}>New Password</Text>
            <View style={styles.passwordInputWrapper}>
              <Lock size={15} color="#64748b" style={styles.inputIcon} />
              <TextInput
                style={styles.passwordInput}
                secureTextEntry={!showNewPassword}
                placeholder="At least 6 characters"
                placeholderTextColor="#64748b"
                value={newPassword}
                onChangeText={setNewPassword}
              />
              <TouchableOpacity onPress={() => setShowNewPassword(!showNewPassword)}>
                {showNewPassword ? <EyeOff size={16} color="#94a3b8" /> : <Eye size={16} color="#94a3b8" />}
              </TouchableOpacity>
            </View>
          </View>

          {/* Confirm New Password */}
          <View style={styles.inputGroup}>
            <Text style={styles.inputLabel}>Confirm New Password</Text>
            <View style={styles.passwordInputWrapper}>
              <Lock size={15} color="#64748b" style={styles.inputIcon} />
              <TextInput
                style={styles.passwordInput}
                secureTextEntry={!showConfirmPassword}
                placeholder="Re-enter new password"
                placeholderTextColor="#64748b"
                value={confirmPassword}
                onChangeText={setConfirmPassword}
              />
              <TouchableOpacity onPress={() => setShowConfirmPassword(!showConfirmPassword)}>
                {showConfirmPassword ? <EyeOff size={16} color="#94a3b8" /> : <Eye size={16} color="#94a3b8" />}
              </TouchableOpacity>
            </View>
          </View>

          {/* Update Password Button */}
          <TouchableOpacity
            style={[styles.updateBtn, submitting && { opacity: 0.7 }]}
            onPress={handleChangePassword}
            disabled={submitting}
          >
            {submitting ? (
              <ActivityIndicator size="small" color="#FFFFFF" />
            ) : (
              <Text style={styles.updateBtnText}>Update Password</Text>
            )}
          </TouchableOpacity>
        </View>

        {/* Logout Section */}
        <View style={styles.cardSection}>
          <TouchableOpacity style={styles.logoutBtn} onPress={handleLogout}>
            <LogOut size={18} color="#ef4444" style={{ marginRight: 8 }} />
            <Text style={styles.logoutBtnText}>Log Out Account</Text>
          </TouchableOpacity>
        </View>

        <View style={{ height: 40 }} />
      </ScrollView>

      {/* Fixed Bottom Navigation Footer Bar */}
      <BottomTabBar
        activeTab="Profile"
        onTabPress={handleTabPress}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0f172a',
  },
  scrollBody: {
    paddingHorizontal: 12,
    paddingTop: 12,
  },
  userHeaderCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#1e293b',
    borderRadius: 16,
    padding: 14,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#334155',
  },
  avatarCircle: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: '#6366f1',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 14,
    borderWidth: 2,
    borderColor: '#818cf8',
  },
  avatarText: {
    fontSize: 20,
    fontWeight: '800',
    color: '#ffffff',
    letterSpacing: 0.5,
  },
  userInfo: {
    flex: 1,
  },
  userName: {
    fontSize: 17,
    fontWeight: '800',
    color: '#f8fafc',
    marginBottom: 2,
  },
  emailRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 6,
  },
  userEmail: {
    fontSize: 12,
    color: '#94a3b8',
  },
  activeBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(16, 185, 129, 0.15)',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 12,
    alignSelf: 'flex-start',
    borderWidth: 1,
    borderColor: 'rgba(16, 185, 129, 0.3)',
  },
  activeBadgeText: {
    fontSize: 10.5,
    fontWeight: '700',
    color: '#34d399',
  },
  statsRowContainer: {
    flexDirection: 'row',
    gap: 10,
    marginBottom: 12,
  },
  statBox: {
    flex: 1,
    backgroundColor: '#1e293b',
    borderRadius: 14,
    padding: 12,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#334155',
  },
  statNumber: {
    fontSize: 18,
    fontWeight: '800',
    color: '#f8fafc',
  },
  statLabel: {
    fontSize: 11,
    color: '#94a3b8',
    marginTop: 2,
  },
  cardSection: {
    backgroundColor: '#1e293b',
    borderRadius: 16,
    padding: 14,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#334155',
  },
  cardHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 4,
  },
  cardHeaderTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: '#f8fafc',
  },
  cardHeaderSub: {
    fontSize: 11.5,
    color: '#94a3b8',
    marginBottom: 12,
  },
  inputGroup: {
    marginBottom: 10,
  },
  inputLabel: {
    fontSize: 12,
    fontWeight: '600',
    color: '#cbd5e1',
    marginBottom: 4,
  },
  passwordInputWrapper: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#0f172a',
    borderRadius: 10,
    paddingHorizontal: 10,
    paddingVertical: 8,
    borderWidth: 1,
    borderColor: '#334155',
  },
  inputIcon: {
    marginRight: 8,
  },
  passwordInput: {
    flex: 1,
    fontSize: 13,
    color: '#f8fafc',
    paddingVertical: 2,
  },
  updateBtn: {
    backgroundColor: '#6366f1',
    paddingVertical: 11,
    borderRadius: 10,
    alignItems: 'center',
    marginTop: 6,
  },
  updateBtnText: {
    color: '#ffffff',
    fontSize: 14,
    fontWeight: '700',
  },
  logoutBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(239, 68, 68, 0.12)',
    paddingVertical: 12,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: 'rgba(239, 68, 68, 0.3)',
  },
  logoutBtnText: {
    color: '#ef4444',
    fontSize: 14,
    fontWeight: '700',
  },
});
