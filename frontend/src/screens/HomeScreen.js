import React, { useState, useEffect, useCallback } from 'react';
import { useFocusEffect } from '@react-navigation/native';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ActivityIndicator,
  RefreshControl,
  ScrollView,
  Modal,
  TextInput,
  Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import {
  Sparkles,
  BookOpen,
  Plus,
  Clock,
  Award,
  Target,
  Zap,
  TrendingUp,
  CheckCircle2,
  ChevronRight,
  Lightbulb,
  X,
  SlidersHorizontal,
  Moon,
} from 'lucide-react-native';
import { useTheme } from '../context/ThemeContext';
import { fetchQuizzes, createQuizApi, fetchHistoryApi } from '../services/api';
import ManageQuizModal from '../components/ManageQuizModal';
import TestConfigModal from '../components/TestConfigModal';
import CustomQuizBuilderModal from '../components/CustomQuizBuilderModal';
import BottomTabBar from '../components/BottomTabBar';

export default function HomeScreen({ navigation, route }) {
  const { theme, isGlass, toggleTheme } = useTheme();
  const [quizzes, setQuizzes] = useState([]);
  const [historyList, setHistoryList] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [activeTab, setActiveTab] = useState('Home');

  // Create Quiz Modal State
  const [createModalVisible, setCreateModalVisible] = useState(false);
  const [newTitle, setNewTitle] = useState('');
  const [newSubject, setNewSubject] = useState('');
  const [newDescription, setNewDescription] = useState('');
  const [creating, setCreating] = useState(false);

  // Manage Questions Modal State
  const [manageModalVisible, setManageModalVisible] = useState(false);
  const [activeQuizForManage, setActiveQuizForManage] = useState(null);

  // Test Config Modal State
  const [configModalVisible, setConfigModalVisible] = useState(false);
  const [selectedQuizForTest, setSelectedQuizForTest] = useState(null);

  // Custom Quiz Builder State
  const [customBuilderVisible, setCustomBuilderVisible] = useState(false);

  const handleStartCustomTest = (quiz, config) => {
    navigation.navigate('Test', {
      quiz,
      config,
    });
  };

  const loadDashboardData = async (showSpinner = false) => {
    try {
      if (showSpinner) {
        setLoading(true);
      }
      const [quizRes, historyRes] = await Promise.allSettled([
        fetchQuizzes(),
        fetchHistoryApi(),
      ]);

      if (quizRes.status === 'fulfilled' && quizRes.value?.quizzes) {
        setQuizzes(quizRes.value.quizzes);
      }
      if (historyRes.status === 'fulfilled' && historyRes.value?.history) {
        setHistoryList(historyRes.value.history);
      }
    } catch (err) {
      console.warn('Error loading dashboard data:', err.message);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useFocusEffect(
    useCallback(() => {
      setActiveTab('Home');
      loadDashboardData(quizzes.length === 0);
    }, [])
  );

  useEffect(() => {
    if (route.params?.openCreateModal) {
      setCreateModalVisible(true);
    }
  }, [route.params]);

  const handleRefresh = () => {
    setRefreshing(true);
    loadDashboardData();
  };

  const handleCreateQuiz = async () => {
    if (!newTitle.trim()) {
      Alert.alert('Validation Error', 'Please enter a Quiz Title.');
      return;
    }

    try {
      setCreating(true);
      const res = await createQuizApi({
        title: newTitle.trim(),
        subject: newSubject.trim() || 'General',
        description: newDescription.trim() || '',
      });

      if (res && res.quiz) {
        setCreateModalVisible(false);
        setNewTitle('');
        setNewSubject('');
        setNewDescription('');
        loadDashboardData();

        // Auto-open Manage Questions modal for newly created quiz
        setActiveQuizForManage(res.quiz);
        setManageModalVisible(true);
      }
    } catch (err) {
      Alert.alert(
        'Create Error',
        err.response?.data?.message || err.message || 'Failed to create quiz.'
      );
    } finally {
      setCreating(false);
    }
  };

  const handleTabPress = (tabName) => {
    setActiveTab(tabName);
    if (tabName === 'Quizzes') {
      navigation.navigate('Quizzes');
    } else if (tabName === 'Study') {
      navigation.navigate('Study');
    } else if (tabName === 'History') {
      navigation.navigate('History');
    } else if (tabName === 'Profile') {
      navigation.navigate('Profile', { user: route?.params?.user });
    }
  };

  // Statistical Calculations
  const totalQuizzes = quizzes.length;
  const totalQuestions = quizzes.reduce(
    (sum, q) => sum + (q.questions?.length || q.questionCount || 0),
    0
  );
  const totalAttempts = historyList.length;

  const averageAccuracy =
    totalAttempts > 0
      ? Math.round(
          historyList.reduce(
            (sum, item) => sum + (item.accuracyPercentage || 0),
            0
          ) / totalAttempts
        )
      : 0;

  const totalCorrectCount = historyList.reduce(
    (sum, item) => sum + (item.correctCount || 0),
    0
  );

  return (
    <SafeAreaView style={[styles.container, isGlass && styles.containerGlass]}>
      {/* Header Bar */}
      <View style={[styles.header, isGlass && styles.headerGlass]}>
        <View style={{ flex: 1 }}>
          <View style={styles.brandTitleRow}>
            <Text style={styles.brandTitle}>QUIZZY</Text>
            <View style={[styles.proTag, isGlass && styles.proTagGlass]}>
              <Sparkles size={10} color={isGlass ? '#c084fc' : '#a855f7'} />
              <Text style={[styles.proTagText, isGlass && styles.proTagTextGlass]}>AI Powered</Text>
            </View>
          </View>
          <Text style={styles.brandSubtitle}>Custom Practice & Analytics</Text>
        </View>

        <View style={styles.headerRightActions}>
          {/* Top-Right Theme Toggle Button */}
          <TouchableOpacity
            style={[styles.themeHeaderBtn, isGlass && styles.themeHeaderBtnGlass]}
            onPress={toggleTheme}
            activeOpacity={0.7}
          >
            {isGlass ? (
              <>
                <Sparkles size={14} color="#c084fc" />
                <Text style={styles.themeHeaderBtnTextGlass}>Glass UI</Text>
              </>
            ) : (
              <>
                <Moon size={14} color="#94a3b8" />
                <Text style={styles.themeHeaderBtnTextDark}>Dark UI</Text>
              </>
            )}
          </TouchableOpacity>
        </View>
      </View>

      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={styles.scrollContent}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={handleRefresh}
            colors={[isGlass ? '#a855f7' : '#6366f1']}
          />
        }
      >
        {loading ? (
          <View style={styles.centerContainer}>
            <ActivityIndicator size="large" color={isGlass ? '#a855f7' : '#6366f1'} />
            <Text style={styles.loadingText}>Loading performance metrics...</Text>
          </View>
        ) : (
          <>
            {/* Overall Mastery Progress Banner */}
            <View style={[styles.masteryCard, isGlass && styles.masteryCardGlass]}>
              <View style={styles.masteryHeaderRow}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.masteryTitle}>Overall Progress</Text>
                  <Text style={styles.masterySub}>Target Accuracy & Score Rate</Text>
                </View>

                <View style={styles.masteryHeaderRightGroup}>
                  {/* Theme Mode Toggle inside Progress / History Card Top Right */}
                  <TouchableOpacity
                    style={[styles.themePillToggle, isGlass ? styles.themePillToggleGlass : styles.themePillToggleDark]}
                    onPress={toggleTheme}
                    activeOpacity={0.7}
                  >
                    {isGlass ? (
                      <>
                        <Sparkles size={11} color="#c084fc" />
                        <Text style={styles.themePillTextGlass}>Glass UI</Text>
                        <View style={styles.themePillDotGlass} />
                      </>
                    ) : (
                      <>
                        <Moon size={11} color="#94a3b8" />
                        <Text style={styles.themePillTextDark}>Dark UI</Text>
                        <View style={styles.themePillDotDark} />
                      </>
                    )}
                  </TouchableOpacity>

                  <View style={[styles.masteryScoreBadge, isGlass && styles.masteryScoreBadgeGlass]}>
                    <TrendingUp size={13} color="#10b981" />
                    <Text style={styles.masteryScoreText}>
                      {averageAccuracy > 0 ? `${averageAccuracy}%` : '0%'}
                    </Text>
                  </View>
                </View>
              </View>

              {/* Progress Bar Component */}
              <View style={[styles.progressTrack, isGlass && styles.progressTrackGlass]}>
                <View
                  style={[
                    styles.fillBar,
                    isGlass && styles.fillBarGlass,
                    { width: `${Math.min(Math.max(averageAccuracy, 6), 100)}%` },
                  ]}
                />
              </View>

              <View style={styles.masteryFooterRow}>
                <Text style={[styles.masteryFooterLeft, isGlass && styles.masteryFooterLeftGlass]}>
                  {totalCorrectCount} Total Correct Answers
                </Text>
                <Text style={styles.masteryFooterRight}>
                  {totalAttempts} Tests Completed
                </Text>
              </View>
            </View>

            {/* 4 Statistics Cards Grid */}
            <Text style={styles.sectionTitle}>Performance Analytics</Text>
            <View style={styles.statsGrid}>
              {/* Total Quizzes Card */}
              <View style={[styles.statBox, isGlass && styles.statBoxGlass]}>
                <View style={[styles.statIconBadge, { backgroundColor: isGlass ? 'rgba(129, 140, 248, 0.25)' : 'rgba(99, 102, 241, 0.2)' }]}>
                  <BookOpen size={18} color={isGlass ? '#a5b4fc' : '#818cf8'} />
                </View>
                <Text style={styles.statVal}>{totalQuizzes}</Text>
                <Text style={styles.statLbl}>Available Quizzes</Text>
              </View>

              {/* Total Question Bank Card */}
              <View style={[styles.statBox, isGlass && styles.statBoxGlass]}>
                <View style={[styles.statIconBadge, { backgroundColor: isGlass ? 'rgba(192, 132, 252, 0.25)' : 'rgba(168, 85, 247, 0.2)' }]}>
                  <Zap size={18} color={isGlass ? '#d8b4fe' : '#c084fc'} />
                </View>
                <Text style={styles.statVal}>{totalQuestions}</Text>
                <Text style={styles.statLbl}>Question Bank</Text>
              </View>

              {/* Test Attempts Card */}
              <View style={[styles.statBox, isGlass && styles.statBoxGlass]}>
                <View style={[styles.statIconBadge, { backgroundColor: 'rgba(16, 185, 129, 0.2)' }]}>
                  <Target size={18} color="#10b981" />
                </View>
                <Text style={styles.statVal}>{totalAttempts}</Text>
                <Text style={styles.statLbl}>Tests Taken</Text>
              </View>

              {/* Average Accuracy Card */}
              <View style={[styles.statBox, isGlass && styles.statBoxGlass]}>
                <View style={[styles.statIconBadge, { backgroundColor: 'rgba(245, 158, 11, 0.2)' }]}>
                  <Award size={18} color="#fbbf24" />
                </View>
                <Text style={styles.statVal}>{averageAccuracy}%</Text>
                <Text style={styles.statLbl}>Avg Accuracy</Text>
              </View>
            </View>

            {/* Organized Quick Hub Section */}
            <Text style={styles.sectionTitle}>Quick Hub</Text>

            {/* Explore Quiz Bank Card */}
            <TouchableOpacity
              style={[styles.actionCard, isGlass && styles.actionCardGlass]}
              onPress={() => navigation.navigate('Quizzes')}
              activeOpacity={0.8}
            >
              <View style={[styles.actionIconBox, { backgroundColor: isGlass ? 'rgba(129, 140, 248, 0.25)' : 'rgba(99, 102, 241, 0.2)' }]}>
                <BookOpen size={22} color={isGlass ? '#a5b4fc' : '#818cf8'} />
              </View>
              <View style={{ flex: 1, marginLeft: 12 }}>
                <Text style={styles.actionCardTitle}>Explore Quiz Directory</Text>
                <Text style={styles.actionCardSub}>Browse {totalQuizzes} quizzes & practice MCQs</Text>
              </View>
              <ChevronRight size={18} color="#64748b" />
            </TouchableOpacity>

            {/* Build Custom Multi-Source Test Card */}
            <TouchableOpacity
              style={[styles.actionCard, isGlass && styles.actionCardGlass]}
              onPress={() => setCustomBuilderVisible(true)}
              activeOpacity={0.8}
            >
              <View style={[styles.actionIconBox, { backgroundColor: isGlass ? 'rgba(192, 132, 252, 0.25)' : 'rgba(168, 85, 247, 0.2)' }]}>
                <SlidersHorizontal size={22} color={isGlass ? '#d8b4fe' : '#c084fc'} />
              </View>
              <View style={{ flex: 1, marginLeft: 12 }}>
                <Text style={styles.actionCardTitle}>Build Multi-Source Test</Text>
                <Text style={styles.actionCardSub}>Mix 100 Qs from Medicine + 100 Qs from Pediatrics</Text>
              </View>
              <ChevronRight size={18} color="#64748b" />
            </TouchableOpacity>

            {/* Create New Quiz Card */}
            <TouchableOpacity
              style={[styles.actionCard, isGlass && styles.actionCardGlass]}
              onPress={() => setCreateModalVisible(true)}
              activeOpacity={0.8}
            >
              <View style={[styles.actionIconBox, { backgroundColor: 'rgba(16, 185, 129, 0.2)' }]}>
                <Plus size={22} color="#10b981" />
              </View>
              <View style={{ flex: 1, marginLeft: 12 }}>
                <Text style={styles.actionCardTitle}>Create New Quiz</Text>
                <Text style={styles.actionCardSub}>Add custom question bank & options</Text>
              </View>
              <ChevronRight size={18} color="#64748b" />
            </TouchableOpacity>

            {/* Test Attempt History Card with Theme Mode Toggle on Top-Right */}
            <View style={[styles.historyCardContainer, isGlass && styles.historyCardContainerGlass]}>
              <View style={styles.historyCardHeaderRow}>
                <View style={styles.historyCardTitleRow}>
                  <View style={[styles.actionIconBox, { backgroundColor: isGlass ? 'rgba(192, 132, 252, 0.25)' : 'rgba(168, 85, 247, 0.2)' }]}>
                    <Clock size={20} color={isGlass ? '#d8b4fe' : '#c084fc'} />
                  </View>
                  <View style={{ marginLeft: 10, flex: 1 }}>
                    <Text style={styles.actionCardTitle}>Test Attempt History</Text>
                    <Text style={styles.actionCardSub}>Review scorecards & analytics</Text>
                  </View>
                </View>

                {/* Theme Mode Toggle Button placed on top-right of the History Card */}
                <TouchableOpacity
                  style={[styles.themePillToggle, isGlass ? styles.themePillToggleGlass : styles.themePillToggleDark]}
                  onPress={toggleTheme}
                  activeOpacity={0.7}
                >
                  {isGlass ? (
                    <>
                      <Sparkles size={13} color="#c084fc" />
                      <Text style={styles.themePillTextGlass}>Glass UI</Text>
                      <View style={styles.themePillDotGlass} />
                    </>
                  ) : (
                    <>
                      <Moon size={13} color="#94a3b8" />
                      <Text style={styles.themePillTextDark}>Dark UI</Text>
                      <View style={styles.themePillDotDark} />
                    </>
                  )}
                </TouchableOpacity>
              </View>

              <TouchableOpacity
                style={[styles.historyCardActionBtn, isGlass && styles.historyCardActionBtnGlass]}
                onPress={() => navigation.navigate('History')}
                activeOpacity={0.8}
              >
                <Text style={[styles.historyCardActionText, isGlass && styles.historyCardActionTextGlass]}>
                  Open Full Attempt History & Explanations
                </Text>
                <ChevronRight size={16} color={isGlass ? '#c084fc' : '#818cf8'} />
              </TouchableOpacity>
            </View>

            {/* Daily AI Study Tip Box */}
            <View style={[styles.studyTipBox, isGlass && styles.studyTipBoxGlass]}>
              <View style={styles.tipHeaderRow}>
                <Lightbulb size={16} color="#fbbf24" />
                <Text style={styles.tipTitle}>AI Learning Insight</Text>
              </View>
              <Text style={styles.tipText}>
                Active recall with spaced MCQ testing improves long-term clinical retention by up to 75%. Try configuring custom 25-question random tests daily!
              </Text>
            </View>
          </>
        )}
      </ScrollView>

      {/* Fixed Bottom Navigation Footer Bar */}
      <BottomTabBar
        activeTab={activeTab}
        onTabPress={handleTabPress}
      />

      {/* Modal: Create New Quiz */}
      <Modal
        visible={createModalVisible}
        animationType="slide"
        transparent={true}
        onRequestClose={() => setCreateModalVisible(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalCard}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Create New Quiz</Text>
              <TouchableOpacity onPress={() => setCreateModalVisible(false)}>
                <X size={20} color="#94a3b8" />
              </TouchableOpacity>
            </View>

            <ScrollView keyboardShouldPersistTaps="handled">
              <Text style={styles.formLabel}>Quiz Title *</Text>
              <TextInput
                style={styles.formInput}
                placeholder="e.g. Pediatrics Chapter 1 Test"
                placeholderTextColor="#64748b"
                value={newTitle}
                onChangeText={setNewTitle}
              />

              <Text style={styles.formLabel}>Subject / Category</Text>
              <TextInput
                style={styles.formInput}
                placeholder="e.g. Pediatrics, Pharmacology, Medical Exam..."
                placeholderTextColor="#64748b"
                value={newSubject}
                onChangeText={setNewSubject}
              />

              <Text style={styles.formLabel}>Description (optional)</Text>
              <TextInput
                style={[styles.formInput, { minHeight: 65, textAlignVertical: 'top' }]}
                placeholder="Brief description of topics covered in this quiz..."
                placeholderTextColor="#64748b"
                value={newDescription}
                onChangeText={setNewDescription}
                multiline
              />

              <View style={styles.modalBtnRow}>
                <TouchableOpacity
                  style={styles.modalCancelBtn}
                  onPress={() => setCreateModalVisible(false)}
                >
                  <Text style={styles.modalCancelText}>Cancel</Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={[styles.modalSubmitBtn, creating && { opacity: 0.7 }]}
                  onPress={handleCreateQuiz}
                  disabled={creating}
                >
                  {creating ? (
                    <ActivityIndicator size="small" color="#fff" />
                  ) : (
                    <Text style={styles.modalSubmitText}>Create & Add Questions</Text>
                  )}
                </TouchableOpacity>
              </View>
            </ScrollView>
          </View>
        </View>
      </Modal>

      {/* Modal: Manage Questions */}
      <ManageQuizModal
        visible={manageModalVisible}
        quiz={activeQuizForManage}
        onClose={() => setManageModalVisible(false)}
        onQuizUpdated={(updatedQuiz) => {
          setActiveQuizForManage(updatedQuiz);
          loadDashboardData();
        }}
      />

      {/* Modal: Test Configuration */}
      <TestConfigModal
        visible={configModalVisible}
        quiz={selectedQuizForTest}
        onClose={() => setConfigModalVisible(false)}
        onStartTest={(configuredQuestions, configOptions) => {
          setConfigModalVisible(false);
          navigation.navigate('Test', {
            quiz: selectedQuizForTest,
            questions: configuredQuestions,
            configOptions,
          });
        }}
      />

      {/* Modal: Custom Multi-Source Quiz Builder */}
      <CustomQuizBuilderModal
        visible={customBuilderVisible}
        onClose={() => setCustomBuilderVisible(false)}
        onStartTest={(generatedQuiz, config) => {
          setCustomBuilderVisible(false);
          loadDashboardData();
          navigation.navigate('Test', {
            quiz: generatedQuiz,
            questions: generatedQuiz.questions,
            configOptions: config,
          });
        }}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0f172a',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 12,
    paddingTop: 10,
    paddingBottom: 12,
    backgroundColor: '#1e293b',
    borderBottomWidth: 1,
    borderBottomColor: '#334155',
  },
  brandTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  brandTitle: {
    fontSize: 20,
    fontWeight: '800',
    color: '#f8fafc',
  },
  proTag: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(168, 85, 247, 0.2)',
    paddingHorizontal: 7,
    paddingVertical: 2,
    borderRadius: 8,
    marginLeft: 6,
    borderWidth: 1,
    borderColor: '#a855f7',
  },
  proTagText: {
    fontSize: 10,
    fontWeight: '800',
    color: '#c084fc',
    marginLeft: 3,
  },
  brandSubtitle: {
    fontSize: 11,
    color: '#94a3b8',
    marginTop: 1,
  },
  headerRightActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  themeHeaderBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    backgroundColor: '#0f172a',
    paddingHorizontal: 9,
    paddingVertical: 7,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#475569',
  },
  themeHeaderBtnGlass: {
    backgroundColor: 'rgba(168, 85, 247, 0.2)',
    borderColor: '#c084fc',
    shadowColor: '#c084fc',
    shadowOpacity: 0.35,
    shadowRadius: 5,
  },
  themeHeaderBtnTextDark: {
    fontSize: 11.5,
    fontWeight: '700',
    color: '#94a3b8',
  },
  themeHeaderBtnTextGlass: {
    fontSize: 11.5,
    fontWeight: '800',
    color: '#e9d5ff',
  },
  historyHeaderBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(99, 102, 241, 0.15)',
    paddingHorizontal: 9,
    paddingVertical: 7,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#6366f1',
  },
  historyHeaderBtnText: {
    color: '#818cf8',
    fontWeight: '700',
    fontSize: 12,
    marginLeft: 3,
  },
  masteryHeaderRightGroup: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  scrollContent: {
    paddingHorizontal: 10,
    paddingTop: 10,
    paddingBottom: 30,
  },
  centerContainer: {
    paddingVertical: 40,
    alignItems: 'center',
  },
  loadingText: {
    marginTop: 8,
    color: '#94a3b8',
    fontSize: 13,
  },

  // Mastery Progress Card
  masteryCard: {
    backgroundColor: '#1e293b',
    borderRadius: 14,
    padding: 16,
    marginBottom: 14,
    borderWidth: 1,
    borderColor: '#334155',
  },
  masteryHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  masteryTitle: {
    fontSize: 17,
    fontWeight: '800',
    color: '#f8fafc',
  },
  masterySub: {
    fontSize: 11.5,
    color: '#94a3b8',
    marginTop: 1,
  },
  masteryScoreBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(16, 185, 129, 0.15)',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#10b981',
  },
  masteryScoreText: {
    fontSize: 14,
    fontWeight: '800',
    color: '#10b981',
    marginLeft: 4,
  },
  progressTrack: {
    height: 10,
    backgroundColor: '#0f172a',
    borderRadius: 5,
    overflow: 'hidden',
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#334155',
  },
  fillBar: {
    height: '100%',
    backgroundColor: '#6366f1',
    borderRadius: 5,
  },
  masteryFooterRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  masteryFooterLeft: {
    fontSize: 11,
    color: '#818cf8',
    fontWeight: '600',
  },
  masteryFooterRight: {
    fontSize: 11,
    color: '#cbd5e1',
    fontWeight: '600',
  },

  // Section Header
  sectionTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: '#f8fafc',
    marginBottom: 8,
    marginTop: 4,
  },

  // 4 Stats Grid
  statsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    gap: 8,
    marginBottom: 14,
  },
  statBox: {
    width: '48.5%',
    backgroundColor: '#1e293b',
    borderRadius: 12,
    padding: 12,
    borderWidth: 1,
    borderColor: '#334155',
  },
  statIconBadge: {
    width: 34,
    height: 34,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 8,
  },
  statVal: {
    fontSize: 20,
    fontWeight: '800',
    color: '#f8fafc',
  },
  statLbl: {
    fontSize: 11,
    color: '#94a3b8',
    marginTop: 1,
    fontWeight: '600',
  },

  // Action Cards
  actionCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#1e293b',
    borderRadius: 12,
    padding: 12,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: '#334155',
  },
  actionIconBox: {
    width: 40,
    height: 40,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  actionCardTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: '#f8fafc',
  },
  actionCardSub: {
    fontSize: 11.5,
    color: '#94a3b8',
    marginTop: 1,
  },

  // Study Tip Box
  studyTipBox: {
    backgroundColor: '#0f172a',
    borderRadius: 12,
    padding: 12,
    marginTop: 6,
    marginBottom: 10,
    borderLeftWidth: 3.5,
    borderLeftColor: '#a855f7',
    borderWidth: 1,
    borderColor: '#334155',
  },
  tipHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 4,
  },
  tipTitle: {
    fontSize: 12,
    fontWeight: '700',
    color: '#c084fc',
    marginLeft: 6,
  },
  tipText: {
    fontSize: 11.5,
    color: '#cbd5e1',
    lineHeight: 16,
  },

  // Modal Styles
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(15, 23, 42, 0.85)',
    justifyContent: 'center',
    paddingHorizontal: 12,
  },
  modalCard: {
    backgroundColor: '#1e293b',
    borderRadius: 14,
    padding: 16,
    maxHeight: '80%',
    borderWidth: 1,
    borderColor: '#334155',
  },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  modalTitle: {
    fontSize: 17,
    fontWeight: '700',
    color: '#f8fafc',
  },
  formLabel: {
    fontSize: 12,
    fontWeight: '700',
    color: '#cbd5e1',
    marginBottom: 4,
    marginTop: 6,
  },
  formInput: {
    backgroundColor: '#0f172a',
    borderWidth: 1,
    borderColor: '#334155',
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 8,
    fontSize: 13,
    color: '#f8fafc',
    marginBottom: 8,
  },
  modalBtnRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 16,
  },
  modalCancelBtn: {
    flex: 1,
    backgroundColor: '#334155',
    paddingVertical: 10,
    borderRadius: 8,
    alignItems: 'center',
    marginRight: 6,
  },
  modalCancelText: {
    color: '#cbd5e1',
    fontWeight: '600',
    fontSize: 13,
  },
  modalSubmitBtn: {
    flex: 2,
    backgroundColor: '#6366f1',
    paddingVertical: 10,
    borderRadius: 8,
    alignItems: 'center',
    marginLeft: 6,
  },
  modalSubmitText: {
    color: '#ffffff',
    fontWeight: '700',
    fontSize: 13,
  },

  // Glassmorphic Theme Overrides
  containerGlass: {
    backgroundColor: '#090d16',
  },
  headerGlass: {
    backgroundColor: 'rgba(15, 23, 42, 0.75)',
    borderBottomColor: 'rgba(139, 92, 246, 0.25)',
  },
  proTagGlass: {
    backgroundColor: 'rgba(168, 85, 247, 0.25)',
    borderColor: '#c084fc',
  },
  proTagTextGlass: {
    color: '#e9d5ff',
  },
  historyHeaderBtnGlass: {
    backgroundColor: 'rgba(168, 85, 247, 0.2)',
    borderColor: 'rgba(192, 132, 252, 0.5)',
  },
  historyHeaderBtnTextGlass: {
    color: '#d8b4fe',
  },
  masteryCardGlass: {
    backgroundColor: 'rgba(30, 41, 59, 0.65)',
    borderColor: 'rgba(139, 92, 246, 0.35)',
    shadowColor: '#a855f7',
    shadowOpacity: 0.2,
    shadowRadius: 10,
    elevation: 6,
  },
  masteryScoreBadgeGlass: {
    backgroundColor: 'rgba(16, 185, 129, 0.25)',
    borderColor: '#34d399',
  },
  progressTrackGlass: {
    backgroundColor: 'rgba(15, 23, 42, 0.8)',
    borderColor: 'rgba(139, 92, 246, 0.25)',
  },
  fillBarGlass: {
    backgroundColor: '#9333ea',
  },
  masteryFooterLeftGlass: {
    color: '#c084fc',
  },
  statBoxGlass: {
    backgroundColor: 'rgba(30, 41, 59, 0.6)',
    borderColor: 'rgba(255, 255, 255, 0.12)',
    shadowColor: '#6366f1',
    shadowOpacity: 0.15,
    shadowRadius: 6,
    elevation: 4,
  },
  actionCardGlass: {
    backgroundColor: 'rgba(30, 41, 59, 0.65)',
    borderColor: 'rgba(99, 102, 241, 0.25)',
    shadowColor: '#6366f1',
    shadowOpacity: 0.15,
    shadowRadius: 6,
    elevation: 3,
  },
  historyCardContainer: {
    backgroundColor: '#1e293b',
    borderRadius: 12,
    padding: 12,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: '#334155',
  },
  historyCardContainerGlass: {
    backgroundColor: 'rgba(30, 41, 59, 0.68)',
    borderColor: 'rgba(168, 85, 247, 0.35)',
    shadowColor: '#a855f7',
    shadowOpacity: 0.25,
    shadowRadius: 10,
    elevation: 5,
  },
  historyCardHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 10,
  },
  historyCardTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
    marginRight: 6,
  },
  themePillToggle: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: 9,
    paddingVertical: 5,
    borderRadius: 20,
    borderWidth: 1,
  },
  themePillToggleDark: {
    backgroundColor: '#0f172a',
    borderColor: '#475569',
  },
  themePillToggleGlass: {
    backgroundColor: 'rgba(168, 85, 247, 0.2)',
    borderColor: '#c084fc',
    shadowColor: '#c084fc',
    shadowOpacity: 0.4,
    shadowRadius: 6,
    elevation: 3,
  },
  themePillTextDark: {
    fontSize: 11,
    fontWeight: '700',
    color: '#94a3b8',
  },
  themePillTextGlass: {
    fontSize: 11,
    fontWeight: '800',
    color: '#e9d5ff',
  },
  themePillDotDark: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: '#64748b',
  },
  themePillDotGlass: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: '#a855f7',
  },
  historyCardActionBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#0f172a',
    paddingVertical: 8,
    paddingHorizontal: 10,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#334155',
  },
  historyCardActionBtnGlass: {
    backgroundColor: 'rgba(15, 23, 42, 0.6)',
    borderColor: 'rgba(168, 85, 247, 0.3)',
  },
  historyCardActionText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#818cf8',
  },
  historyCardActionTextGlass: {
    color: '#d8b4fe',
    fontWeight: '700',
  },
  studyTipBoxGlass: {
    backgroundColor: 'rgba(124, 58, 237, 0.15)',
    borderColor: 'rgba(168, 85, 247, 0.35)',
  },
});
