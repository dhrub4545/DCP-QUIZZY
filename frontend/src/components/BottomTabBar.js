import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { Home, BookOpen, Plus, Clock } from 'lucide-react-native';

/**
 * BottomTabBar component
 * Fixed bottom navigation bar featuring Home, Quizzes, Add Quiz (+), and History tabs.
 */
export default function BottomTabBar({ activeTab, onTabPress, onAddQuizPress }) {
  return (
    <View style={styles.footerContainer}>
      {/* Home Tab */}
      <TouchableOpacity
        style={styles.tabItem}
        onPress={() => onTabPress('Home')}
        activeOpacity={0.7}
      >
        <Home
          size={20}
          color={activeTab === 'Home' ? '#818cf8' : '#64748b'}
        />
        <Text style={[styles.tabLabel, activeTab === 'Home' && styles.activeTabLabel]}>
          Home
        </Text>
      </TouchableOpacity>

      {/* Quizzes Tab */}
      <TouchableOpacity
        style={styles.tabItem}
        onPress={() => onTabPress('Quizzes')}
        activeOpacity={0.7}
      >
        <BookOpen
          size={20}
          color={activeTab === 'Quizzes' ? '#818cf8' : '#64748b'}
        />
        <Text style={[styles.tabLabel, activeTab === 'Quizzes' && styles.activeTabLabel]}>
          Quizzes
        </Text>
      </TouchableOpacity>

      {/* Add Quiz Floating Tab Button */}
      <TouchableOpacity
        style={styles.addTabItem}
        onPress={onAddQuizPress}
        activeOpacity={0.8}
      >
        <View style={styles.addBtnCircle}>
          <Plus size={22} color="#ffffff" />
        </View>
        <Text style={styles.addTabLabel}>Add Quiz</Text>
      </TouchableOpacity>

      {/* History Tab */}
      <TouchableOpacity
        style={styles.tabItem}
        onPress={() => onTabPress('History')}
        activeOpacity={0.7}
      >
        <Clock
          size={20}
          color={activeTab === 'History' ? '#818cf8' : '#64748b'}
        />
        <Text style={[styles.tabLabel, activeTab === 'History' && styles.activeTabLabel]}>
          History
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
  activeTabLabel: {
    color: '#818cf8',
    fontWeight: '700',
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
  addTabLabel: {
    fontSize: 10.5,
    fontWeight: '700',
    color: '#818cf8',
    marginTop: 2,
  },
});
