import React, { useState, useEffect, useCallback, memo, useMemo } from 'react';
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
  Sun,
} from 'lucide-react-native';
import { useTheme } from '../context/ThemeContext';
import { fetchQuizzes, createQuizApi, fetchHistoryApi } from '../services/api';
import ManageQuizModal from '../components/ManageQuizModal';
import TestConfigModal from '../components/TestConfigModal';
import CustomQuizBuilderModal from '../components/CustomQuizBuilderModal';
import BottomTabBar from '../components/BottomTabBar';
import PageLoadingAnimation from '../components/PageLoadingAnimation';
import {
  getCachedQuizzes,
  setCachedQuizzes,
  getCachedHistory,
  setCachedHistory,
  setCachedUserProfile,
} from '../services/appStateCache';

function HomeScreen({ navigation, route, onTabPress, isActiveTab, onReady, hideBottomBar = false }) {
  const { theme, isGlass, toggleTheme } = useTheme();
  const [quizzes, setQuizzes] = useState(getCachedQuizzes() || []);
  const [historyList, setHistoryList] = useState(getCachedHistory() || []);
  const [loading, setLoading] = useState(!getCachedQuizzes());
  const [refreshing, setRefreshing] = useState(false);
  const [activeTab, setActiveTab] = useState('Home');

  useEffect(() => {
    if (route?.params?.user) {
      setCachedUserProfile(route?.params?.user);
    }
  }, [route?.params?.user]);

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
      if (showSpinner && !getCachedQuizzes()) {
        setLoading(true);
      }
      const [quizRes, historyRes] = await Promise.allSettled([
        fetchQuizzes(),
        fetchHistoryApi(),
      ]);

      if (quizRes.status === 'fulfilled' && quizRes.value?.quizzes) {
        setCachedQuizzes(quizRes.value.quizzes);
        setQuizzes(quizRes.value.quizzes);
      }
      if (historyRes.status === 'fulfilled' && historyRes.value?.history) {
        setCachedHistory(historyRes.value.history);
        setHistoryList(historyRes.value.history);
      }
    } catch (err) {
      console.warn('Error loading dashboard data:', err.message);
    } finally {
      setLoading(false);
      setRefreshing(false);
      if (onReady) onReady();
    }
  };

  useEffect(() => {
    loadDashboardData();
  }, []);

  useFocusEffect(
    useCallback(() => {
      setActiveTab('Home');
      const cachedQ = getCachedQuizzes();
      const cachedH = getCachedHistory();
      if (cachedQ) {
        setQuizzes(cachedQ);
        setLoading(false);
      }
      if (cachedH) {
        setHistoryList(cachedH);
      }
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
    if (onTabPress) {
      onTabPress(tabName);
    } else {
      if (tabName === 'Quizzes') {
        navigation.navigate('Quizzes');
      } else if (tabName === 'Study') {
        navigation.navigate('Study');
      } else if (tabName === 'History') {
        navigation.navigate('History');
      } else if (tabName === 'Profile') {
        navigation.navigate('Profile', { user: route?.params?.user });
      }
    }
  };

  // Statistical Calculations (Memoized)
  const { totalQuizzes, totalQuestions, totalAttempts, averageAccuracy, totalCorrectCount } = useMemo(() => {
    const totalQ = quizzes.length;
    const totalQuestionsCount = quizzes.reduce(
      (sum, q) => sum + (q.questions?.length || q.questionCount || 0),
      0
    );
    const attempts = historyList.length;
    const avg =
      attempts > 0
        ? Math.round(
            historyList.reduce(
              (sum, item) => sum + (item.accuracyPercentage || 0),
              0
            ) / attempts
          )
        : 0;
    const correct = historyList.reduce(
      (sum, item) => sum + (item.correctCount || 0),
      0
    );
    return {
      totalQuizzes: totalQ,
      totalQuestions: totalQuestionsCount,
      totalAttempts: attempts,
      averageAccuracy: avg,
      totalCorrectCount: correct,
    };
  }, [quizzes, historyList]);

  return (
    <SafeAreaView
      edges={hideBottomBar ? ['top', 'left', 'right'] : ['top', 'bottom', 'left', 'right']}
      style={[styles.container, isGlass && styles.containerGlass]}
    >
      {/* Header Bar */}
      <View style={[styles.header, isGlass && styles.headerGlass]}>
        <View style={{ flex: 1 }}>
          <View style={styles.brandTitleRow}>
            <Text style={[styles.brandTitle, isGlass && styles.textDarkGlow]}>QUIZZY</Text>
            <View style={[styles.proTag, isGlass && styles.proTagGlass]}>
              <Sparkles size={10} color={isGlass ? '#4f46e5' : '#a855f7'} />
              <Text style={[styles.proTagText, isGlass && styles.proTagTextGlass]}>AI Powered</Text>
            </View>
          </View>
          <Text style={[styles.brandSubtitle, isGlass && styles.textSubDark]}>Custom Practice & Analytics</Text>
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
                <Sun size={14} color="#4f46e5" />
                <Text style={styles.themeHeaderBtnTextGlass}>Light</Text>
              </>
            ) : (
              <>
                <Moon size={14} color="#94a3b8" />
                <Text style={styles.themeHeaderBtnTextDark}>Dark</Text>
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
            colors={[isGlass ? '#4f46e5' : '#6366f1']}
          />
        }
      >
        {loading ? (
          <PageLoadingAnimation
            title="Loading Dashboard..."
            subtitle="Calculating accuracy, analytics & question banks..."
            icon={Sparkles}
          />
        ) : (
          <>
            {/* Overall Mastery Progress Banner */}
            <View style={[styles.masteryCard, isGlass && styles.masteryCardGlass]}>
              <View style={styles.masteryHeaderRow}>
                <View style={{ flex: 1 }}>
                  <Text style={[styles.masteryTitle, isGlass && styles.textDarkGlow]}>Overall Progress</Text>
                  <Text style={[styles.masterySub, isGlass && styles.textSubDark]}>Target Accuracy & Score Rate</Text>
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
                        <Sun size={11} color="#4f46e5" />
                        <Text style={styles.themePillTextGlass}>Light</Text>
                        <View style={styles.themePillDotGlass} />
                      </>
                    ) : (
                      <>
                        <Moon size={11} color="#94a3b8" />
                        <Text style={styles.themePillTextDark}>Dark</Text>
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
                <Text style={[styles.masteryFooterRight, isGlass && styles.textSubDark]}>
                  {totalAttempts} Tests Completed
                </Text>
              </View>
            </View>

            {/* 4 Statistics Cards Grid */}
            <Text style={[styles.sectionTitle, isGlass && styles.textDarkGlow]}>Performance Analytics</Text>
            <View style={styles.statsGrid}>
              {/* Total Quizzes Card */}
              <View style={[styles.statBox, isGlass && styles.statBoxGlass]}>
                <View style={[styles.statIconBadge, { backgroundColor: isGlass ? 'rgba(99, 102, 241, 0.12)' : 'rgba(99, 102, 241, 0.2)' }]}>
                  <BookOpen size={18} color={isGlass ? '#4f46e5' : '#818cf8'} />
                </View>
                <Text style={[styles.statVal, isGlass && styles.textDarkGlow]}>{totalQuizzes}</Text>
                <Text style={[styles.statLbl, isGlass && styles.textSubDark]}>Available Quizzes</Text>
              </View>

              {/* Total Question Bank Card */}
              <View style={[styles.statBox, isGlass && styles.statBoxGlass]}>
                <View style={[styles.statIconBadge, { backgroundColor: isGlass ? 'rgba(168, 85, 247, 0.12)' : 'rgba(168, 85, 247, 0.2)' }]}>
                  <Zap size={18} color={isGlass ? '#7c3aed' : '#c084fc'} />
                </View>
                <Text style={[styles.statVal, isGlass && styles.textDarkGlow]}>{totalQuestions}</Text>
                <Text style={[styles.statLbl, isGlass && styles.textSubDark]}>Question Bank</Text>
              </View>

              {/* Test Attempts Card */}
              <View style={[styles.statBox, isGlass && styles.statBoxGlass]}>
                <View style={[styles.statIconBadge, { backgroundColor: 'rgba(16, 185, 129, 0.12)' }]}>
                  <Target size={18} color="#10b981" />
                </View>
                <Text style={[styles.statVal, isGlass && styles.textDarkGlow]}>{totalAttempts}</Text>
                <Text style={[styles.statLbl, isGlass && styles.textSubDark]}>Tests Taken</Text>
              </View>

              {/* Average Accuracy Card */}
              <View style={[styles.statBox, isGlass && styles.statBoxGlass]}>
                <View style={[styles.statIconBadge, { backgroundColor: 'rgba(245, 158, 11, 0.12)' }]}>
                  <Award size={18} color="#f59e0b" />
                </View>
                <Text style={[styles.statVal, isGlass && styles.textDarkGlow]}>{averageAccuracy}%</Text>
                <Text style={[styles.statLbl, isGlass && styles.textSubDark]}>Avg Accuracy</Text>
              </View>
            </View>

            {/* Organized Quick Hub Section */}
            <Text style={[styles.sectionTitle, isGlass && styles.textDarkGlow]}>Quick Hub</Text>

            {/* Explore Quiz Bank Card */}
            <TouchableOpacity
              style={[styles.actionCard, isGlass && styles.actionCardGlass]}
              onPress={() => navigation.navigate('Quizzes')}
              activeOpacity={0.8}
            >
              <View style={[styles.actionIconBox, { backgroundColor: isGlass ? 'rgba(99, 102, 241, 0.12)' : 'rgba(99, 102, 241, 0.2)' }]}>
                <BookOpen size={22} color={isGlass ? '#4f46e5' : '#818cf8'} />
              </View>
              <View style={{ flex: 1, marginLeft: 12 }}>
                <Text style={[styles.actionCardTitle, isGlass && styles.textDarkGlow]}>Explore Quiz Directory</Text>
                <Text style={[styles.actionCardSub, isGlass && styles.textSubDark]}>Browse {totalQuizzes} quizzes & practice MCQs</Text>
              </View>
              <ChevronRight size={18} color={isGlass ? '#94a3b8' : '#64748b'} />
            </TouchableOpacity>

            {/* Build Custom Multi-Source Test Card */}
            <TouchableOpacity
              style={[styles.actionCard, isGlass && styles.actionCardGlass]}
              onPress={() => setCustomBuilderVisible(true)}
              activeOpacity={0.8}
            >
              <View style={[styles.actionIconBox, { backgroundColor: isGlass ? 'rgba(168, 85, 247, 0.12)' : 'rgba(168, 85, 247, 0.2)' }]}>
                <SlidersHorizontal size={22} color={isGlass ? '#7c3aed' : '#c084fc'} />
              </View>
              <View style={{ flex: 1, marginLeft: 12 }}>
                <Text style={[styles.actionCardTitle, isGlass && styles.textDarkGlow]}>Build Multi-Source Test</Text>
                <Text style={[styles.actionCardSub, isGlass && styles.textSubDark]}>Mix 100 Qs from Medicine + 100 Qs from Pediatrics</Text>
              </View>
              <ChevronRight size={18} color={isGlass ? '#94a3b8' : '#64748b'} />
            </TouchableOpacity>

            {/* Create New Quiz Card */}
            <TouchableOpacity
              style={[styles.actionCard, isGlass && styles.actionCardGlass]}
              onPress={() => setCreateModalVisible(true)}
              activeOpacity={0.8}
            >
              <View style={[styles.actionIconBox, { backgroundColor: 'rgba(16, 185, 129, 0.12)' }]}>
                <Plus size={22} color="#10b981" />
              </View>
              <View style={{ flex: 1, marginLeft: 12 }}>
                <Text style={[styles.actionCardTitle, isGlass && styles.textDarkGlow]}>Create New Quiz</Text>
                <Text style={[styles.actionCardSub, isGlass && styles.textSubDark]}>Add custom question bank & options</Text>
              </View>
              <ChevronRight size={18} color={isGlass ? '#94a3b8' : '#64748b'} />
            </TouchableOpacity>

            {/* Test Attempt History Card with Theme Mode Toggle on Top-Right */}
            <View style={[styles.historyCardContainer, isGlass && styles.historyCardContainerGlass]}>
              <View style={styles.historyCardHeaderRow}>
                <View style={styles.historyCardTitleRow}>
                  <View style={[styles.actionIconBox, { backgroundColor: isGlass ? 'rgba(99, 102, 241, 0.12)' : 'rgba(168, 85, 247, 0.2)' }]}>
                    <Clock size={20} color={isGlass ? '#4f46e5' : '#c084fc'} />
                  </View>
                  <View style={{ marginLeft: 10, flex: 1 }}>
                    <Text style={[styles.actionCardTitle, isGlass && styles.textDarkGlow]}>Test Attempt History</Text>
                    <Text style={[styles.actionCardSub, isGlass && styles.textSubDark]}>Review scorecards & analytics</Text>
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
                      <Sun size={13} color="#4f46e5" />
                      <Text style={styles.themePillTextGlass}>Light</Text>
                      <View style={styles.themePillDotGlass} />
                    </>
                  ) : (
                    <>
                      <Moon size={13} color="#94a3b8" />
                      <Text style={styles.themePillTextDark}>Dark</Text>
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
                <ChevronRight size={16} color={isGlass ? '#4f46e5' : '#818cf8'} />
              </TouchableOpacity>
            </View>

            {/* Daily AI Study Tip Box */}
            <View style={[styles.studyTipBox, isGlass && styles.studyTipBoxGlass]}>
              <View style={styles.tipHeaderRow}>
                <Lightbulb size={16} color="#f59e0b" />
                <Text style={[styles.tipTitle, isGlass && { color: '#4f46e5' }]}>AI Learning Insight</Text>
              </View>
              <Text style={[styles.tipText, isGlass && styles.tipTextGlass]}>
                Active recall with spaced MCQ testing improves long-term clinical retention by up to 75%. Try configuring custom 25-question random tests daily!
              </Text>
            </View>
          </>
        )}
      </ScrollView>

      {/* Fixed Bottom Navigation Footer Bar */}
      {!hideBottomBar && (
        <BottomTabBar
          activeTab={activeTab}
          onTabPress={handleTabPress}
        />
      )}

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
  scrollContent: {
    flexGrow: 1,
    paddingBottom: 24,
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
    backgroundColor: 'rgba(99, 102, 241, 0.08)',
    borderColor: '#6366f1',
  },
  themeHeaderBtnTextDark: {
    fontSize: 11.5,
    fontWeight: '700',
    color: '#94a3b8',
  },
  themeHeaderBtnTextGlass: {
    fontSize: 11.5,
    fontWeight: '800',
    color: '#4f46e5',
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

  // Glassmorphic Apple White Theme Overrides
  containerGlass: {
    backgroundColor: '#f2f2f7',
  },
  headerGlass: {
    backgroundColor: '#ffffff',
    borderBottomColor: '#e2e8f0',
    shadowColor: '#64748b',
    shadowOpacity: 0.05,
    shadowRadius: 6,
    elevation: 2,
  },
  proTagGlass: {
    backgroundColor: 'rgba(99, 102, 241, 0.1)',
    borderColor: '#6366f1',
  },
  proTagTextGlass: {
    color: '#4f46e5',
  },
  historyHeaderBtnGlass: {
    backgroundColor: 'rgba(99, 102, 241, 0.08)',
    borderColor: 'rgba(99, 102, 241, 0.3)',
  },
  historyHeaderBtnTextGlass: {
    color: '#4f46e5',
  },
  masteryCardGlass: {
    backgroundColor: '#ffffff',
    borderColor: '#e2e8f0',
    shadowColor: '#64748b',
    shadowOpacity: 0.07,
    shadowRadius: 10,
    elevation: 3,
  },
  masteryScoreBadgeGlass: {
    backgroundColor: 'rgba(16, 185, 129, 0.12)',
    borderColor: '#10b981',
  },
  progressTrackGlass: {
    backgroundColor: '#f1f5f9',
    borderColor: '#e2e8f0',
  },
  fillBarGlass: {
    backgroundColor: '#6366f1',
  },
  masteryFooterLeftGlass: {
    color: '#4f46e5',
  },
  statBoxGlass: {
    backgroundColor: '#ffffff',
    borderColor: '#e2e8f0',
    shadowColor: '#64748b',
    shadowOpacity: 0.06,
    shadowRadius: 6,
    elevation: 2,
  },
  actionCardGlass: {
    backgroundColor: '#ffffff',
    borderColor: '#e2e8f0',
    shadowColor: '#64748b',
    shadowOpacity: 0.06,
    shadowRadius: 6,
    elevation: 2,
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
    backgroundColor: '#ffffff',
    borderColor: '#e2e8f0',
    shadowColor: '#64748b',
    shadowOpacity: 0.07,
    shadowRadius: 8,
    elevation: 3,
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
    backgroundColor: 'rgba(99, 102, 241, 0.08)',
    borderColor: '#6366f1',
    shadowColor: '#6366f1',
    shadowOpacity: 0.12,
    shadowRadius: 4,
    elevation: 2,
  },
  themePillTextDark: {
    fontSize: 11,
    fontWeight: '700',
    color: '#94a3b8',
  },
  themePillTextGlass: {
    fontSize: 11,
    fontWeight: '800',
    color: '#4f46e5',
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
    backgroundColor: '#6366f1',
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
    backgroundColor: '#f8fafc',
    borderColor: '#e2e8f0',
  },
  historyCardActionText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#818cf8',
  },
  historyCardActionTextGlass: {
    color: '#4f46e5',
    fontWeight: '700',
  },
  studyTipBoxGlass: {
    backgroundColor: '#ffffff',
    borderColor: '#e2e8f0',
    borderLeftColor: '#6366f1',
  },
  textDarkGlow: {
    color: '#0f172a',
  },
  textSubDark: {
    color: '#64748b',
  },
  tipTextGlass: {
    color: '#334155',
  },
});

export default memo(HomeScreen);
