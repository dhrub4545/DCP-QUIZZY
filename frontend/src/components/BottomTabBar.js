import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { Home, BookOpen, Clock, User, GraduationCap } from 'lucide-react-native';
import { useTheme } from '../context/ThemeContext';

/**
 * BottomTabBar component
 * Fixed bottom navigation bar featuring Home, Quizzes, Study, History, and Profile tabs.
 */
export default function BottomTabBar({ activeTab, onTabPress, onStudyPress, onAddQuizPress }) {
  const { isGlass } = useTheme();

  const handleStudyPress = () => {
    if (onStudyPress) {
      onStudyPress();
    } else if (onTabPress) {
      onTabPress('Study');
    }
  };

  return (
    <View style={[styles.footerContainer, isGlass && styles.footerContainerGlass]}>
      {/* Home Tab */}
      <TouchableOpacity
        style={styles.tabItem}
        onPress={() => onTabPress && onTabPress('Home')}
        activeOpacity={0.7}
      >
        <Home
          size={19}
          color={activeTab === 'Home' ? (isGlass ? '#a78bfa' : '#818cf8') : (isGlass ? '#94a3b8' : '#64748b')}
        />
        <Text style={[styles.tabLabel, isGlass && styles.tabLabelGlass, activeTab === 'Home' && (isGlass ? styles.activeTabLabelGlass : styles.activeTabLabel)]}>
          Home
        </Text>
      </TouchableOpacity>

      {/* Quizzes Tab */}
      <TouchableOpacity
        style={styles.tabItem}
        onPress={() => onTabPress && onTabPress('Quizzes')}
        activeOpacity={0.7}
      >
        <BookOpen
          size={19}
          color={activeTab === 'Quizzes' ? (isGlass ? '#a78bfa' : '#818cf8') : (isGlass ? '#94a3b8' : '#64748b')}
        />
        <Text style={[styles.tabLabel, isGlass && styles.tabLabelGlass, activeTab === 'Quizzes' && (isGlass ? styles.activeTabLabelGlass : styles.activeTabLabel)]}>
          Quizzes
        </Text>
      </TouchableOpacity>

      {/* Study Floating Tab Button */}
      <TouchableOpacity
        style={styles.addTabItem}
        onPress={handleStudyPress}
        activeOpacity={0.8}
      >
        <View style={[styles.addBtnCircle, isGlass && styles.addBtnCircleGlass, activeTab === 'Study' && (isGlass ? styles.activeAddBtnCircleGlass : styles.activeAddBtnCircle)]}>
          <GraduationCap size={23} color="#ffffff" />
        </View>
        <Text style={[styles.addTabLabel, isGlass && styles.addTabLabelGlass, activeTab === 'Study' && (isGlass ? styles.activeAddTabLabelGlass : styles.activeAddTabLabel)]}>
          Study
        </Text>
      </TouchableOpacity>

      {/* History Tab */}
      <TouchableOpacity
        style={styles.tabItem}
        onPress={() => onTabPress && onTabPress('History')}
        activeOpacity={0.7}
      >
        <Clock
          size={19}
          color={activeTab === 'History' ? (isGlass ? '#a78bfa' : '#818cf8') : (isGlass ? '#94a3b8' : '#64748b')}
        />
        <Text style={[styles.tabLabel, isGlass && styles.tabLabelGlass, activeTab === 'History' && (isGlass ? styles.activeTabLabelGlass : styles.activeTabLabel)]}>
          History
        </Text>
      </TouchableOpacity>

      {/* Profile Tab */}
      <TouchableOpacity
        style={styles.tabItem}
        onPress={() => onTabPress && onTabPress('Profile')}
        activeOpacity={0.7}
      >
        <User
          size={19}
          color={activeTab === 'Profile' ? (isGlass ? '#a78bfa' : '#818cf8') : (isGlass ? '#94a3b8' : '#64748b')}
        />
        <Text style={[styles.tabLabel, isGlass && styles.tabLabelGlass, activeTab === 'Profile' && (isGlass ? styles.activeTabLabelGlass : styles.activeTabLabel)]}>
          Profile
        </Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  footerContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-around',
    backgroundColor: '#1e293b',
    height: 62,
    borderTopWidth: 1,
    borderTopColor: '#334155',
    paddingHorizontal: 8,
    elevation: 10,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -3 },
    shadowOpacity: 0.25,
    shadowRadius: 6,
  },
  footerContainerGlass: {
    backgroundColor: 'rgba(15, 23, 42, 0.88)',
    borderTopColor: 'rgba(139, 92, 246, 0.3)',
    borderTopWidth: 1.5,
    shadowColor: '#a855f7',
    shadowOpacity: 0.2,
    shadowRadius: 10,
  },
  tabItem: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 6,
  },
  tabLabel: {
    fontSize: 11,
    fontWeight: '600',
    color: '#64748b',
    marginTop: 3,
  },
  tabLabelGlass: {
    color: '#94a3b8',
  },
  activeTabLabel: {
    color: '#818cf8',
    fontWeight: '700',
  },
  activeTabLabelGlass: {
    color: '#c084fc',
    fontWeight: '800',
  },
  addTabItem: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: -14,
  },
  addBtnCircle: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: '#6366f1',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 3,
    borderColor: '#0f172a',
    shadowColor: '#6366f1',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.4,
    shadowRadius: 6,
    elevation: 6,
  },
  addBtnCircleGlass: {
    backgroundColor: '#7c3aed',
    borderColor: 'rgba(15, 23, 42, 0.9)',
    shadowColor: '#a855f7',
    shadowOpacity: 0.5,
    shadowRadius: 8,
  },
  activeAddBtnCircle: {
    backgroundColor: '#818cf8',
    borderColor: '#6366f1',
  },
  activeAddBtnCircleGlass: {
    backgroundColor: '#9333ea',
    borderColor: '#c084fc',
  },
  addTabLabel: {
    fontSize: 10.5,
    fontWeight: '700',
    color: '#818cf8',
    marginTop: 2,
  },
  addTabLabelGlass: {
    color: '#c084fc',
  },
  activeAddTabLabel: {
    color: '#a5b4fc',
    fontWeight: '800',
  },
  activeAddTabLabelGlass: {
    color: '#e9d5ff',
    fontWeight: '800',
  },
});
