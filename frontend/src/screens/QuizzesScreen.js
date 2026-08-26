import React, { useState, useEffect, useCallback, useRef, memo, useMemo } from 'react';
import { useFocusEffect } from '@react-navigation/native';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  ScrollView,
  TouchableOpacity,
  Pressable,
  ActivityIndicator,
  Alert,
  RefreshControl,
  TextInput,
  StatusBar,
  BackHandler,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import {
  BookOpen,
  FolderKanban,
  Search,
  X,
  Edit3,
  Play,
  Trash2,
  Layers,
  Plus,
  SlidersHorizontal,
  Shield,
  UserCheck,
} from 'lucide-react-native';
import { fetchQuizzes, deleteQuiz } from '../services/api';
import { useTheme } from '../context/ThemeContext';
import ManageQuizModal from '../components/ManageQuizModal';
import TestConfigModal from '../components/TestConfigModal';
import CustomQuizBuilderModal from '../components/CustomQuizBuilderModal';
import BottomTabBar from '../components/BottomTabBar';
import PageLoadingAnimation from '../components/PageLoadingAnimation';
import { getCachedQuizzes, setCachedQuizzes } from '../services/appStateCache';

function QuizzesScreen({ navigation, route, onTabPress, isActiveTab, onReady }) {
  const { isGlass } = useTheme();
  const [quizzes, setQuizzes] = useState(getCachedQuizzes() || []);
  const [loading, setLoading] = useState(!getCachedQuizzes());
  const [refreshing, setRefreshing] = useState(false);
  
  // Quiz Category Switcher: 'standard' (Admin) vs 'custom' (User)
  const [quizCategory, setQuizCategory] = useState('standard');
  const [searchQuery, setSearchQuery] = useState('');
  const [isSearchFocused, setIsSearchFocused] = useState(false);

  const searchInputRef = useRef(null);

  // Modal states
  const [manageModalVisible, setManageModalVisible] = useState(false);
  const [activeQuizForManage, setActiveQuizForManage] = useState(null);

  const [configModalVisible, setConfigModalVisible] = useState(false);
  const [selectedQuizForTest, setSelectedQuizForTest] = useState(null);

  const [customBuilderVisible, setCustomBuilderVisible] = useState(false);

  const loadQuizzes = async (showSpinner = false) => {
    try {
      if (showSpinner && !getCachedQuizzes()) {
        setLoading(true);
      }
      const data = await fetchQuizzes();
      if (data && data.quizzes) {
        setCachedQuizzes(data.quizzes);
        setQuizzes(data.quizzes);
      } else {
        setQuizzes([]);
      }
    } catch (err) {
      console.warn('Error loading quizzes:', err.message);
    } finally {
      setLoading(false);
      setRefreshing(false);
      if (onReady) onReady();
    }
  };

  useEffect(() => {
    loadQuizzes();
  }, []);

  useFocusEffect(
    useCallback(() => {
      const cached = getCachedQuizzes();
      if (cached) {
        setQuizzes(cached);
        setLoading(false);
      }
    }, [])
  );

  useEffect(() => {
    if (isActiveTab === false && !configModalVisible && !manageModalVisible && !customBuilderVisible) return;

    const onBackPress = () => {
      if (configModalVisible) {
        setConfigModalVisible(false);
        return true;
      }
      if (manageModalVisible) {
        setManageModalVisible(false);
        return true;
      }
      if (customBuilderVisible) {
        setCustomBuilderVisible(false);
        return true;
      }
      if (searchQuery && searchQuery.trim()) {
        setSearchQuery('');
        return true;
      }
      return false;
    };

    const subscription = BackHandler.addEventListener('hardwareBackPress', onBackPress);
    return () => subscription.remove();
  }, [isActiveTab, configModalVisible, manageModalVisible, customBuilderVisible, searchQuery]);

  const handleRefresh = () => {
    setRefreshing(true);
    loadQuizzes();
  };

  const handleDeleteQuiz = (id, title) => {
    Alert.alert(
      'Delete Quiz',
      `Are you sure you want to delete "${title}"? All questions inside this quiz will be permanently removed.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            try {
              setLoading(true);
              await deleteQuiz(id);
              loadQuizzes();
            } catch (err) {
              Alert.alert('Delete Error', err.message || 'Failed to delete quiz.');
              setLoading(false);
            }
          },
        },
      ]
    );
  };

  const handleOpenManageQuestions = (quizItem) => {
    setActiveQuizForManage(quizItem);
    setManageModalVisible(true);
  };

  const handleOpenStartTest = (quizItem) => {
    const totalQ = quizItem.questions?.length || quizItem.questionCount || 0;
    if (totalQ === 0) {
      Alert.alert(
        'No Questions Available',
        'This quiz has no questions yet. Please add questions first using "Manage Questions".'
      );
      return;
    }
    setSelectedQuizForTest(quizItem);
    setConfigModalVisible(true);
  };

  const isNmcleQuiz = useCallback((q) => {
    const t = (q.title || '').toUpperCase();
    const s = (q.subject || '').toUpperCase();
    return t.includes('NMCLE') || s.includes('NMCLE');
  }, []);

  const isCustomQuiz = useCallback((q) => {
    if (q.isCustom === true) return true;
    if (q.creator === 'user') return true;
    const titleLower = (q.title || '').toLowerCase();
    if (titleLower.includes('custom') || titleLower.includes('combined')) return true;
    return false;
  }, []);

  const isBookQuiz = useCallback((q) => {
    return !isNmcleQuiz(q) && !isCustomQuiz(q);
  }, [isNmcleQuiz, isCustomQuiz]);

  const nmcleQuizzes = useMemo(() => quizzes.filter(isNmcleQuiz), [quizzes, isNmcleQuiz]);
  const bookQuizzes = useMemo(() => quizzes.filter(isBookQuiz), [quizzes, isBookQuiz]);
  const customQuizzes = useMemo(() => quizzes.filter(isCustomQuiz), [quizzes, isCustomQuiz]);

  const currentCategoryQuizzes = useMemo(() => {
    if (quizCategory === 'nmcle') return nmcleQuizzes;
    if (quizCategory === 'book') return bookQuizzes;
    if (quizCategory === 'custom') return customQuizzes;
    return quizzes;
  }, [quizCategory, nmcleQuizzes, bookQuizzes, customQuizzes, quizzes]);

  // Filter quizzes by search query (Memoized)
  const filteredQuizzes = useMemo(() => {
    if (!searchQuery || !searchQuery.trim()) return currentCategoryQuizzes;
    const query = searchQuery.toLowerCase().trim();
    return currentCategoryQuizzes.filter((q) => {
      return (
        (q.title && q.title.toLowerCase().includes(query)) ||
        (q.subject && q.subject.toLowerCase().includes(query)) ||
        (q.description && q.description.toLowerCase().includes(query)) ||
        (Array.isArray(q.topics) && q.topics.some((t) => t && t.toLowerCase().includes(query)))
      );
    });
  }, [currentCategoryQuizzes, searchQuery]);

  const handleTabPress = (tabName) => {
    if (onTabPress) {
      onTabPress(tabName);
    } else {
      if (tabName === 'Home') {
        navigation.navigate('Home');
      } else if (tabName === 'Study') {
        navigation.navigate('Study');
      } else if (tabName === 'History') {
        navigation.navigate('History');
      } else if (tabName === 'Profile') {
        navigation.navigate('Profile');
      }
    }
  };

  return (
    <SafeAreaView style={[styles.container, isGlass && styles.containerGlass]}>
      {/* Header Bar */}
      <View style={[styles.header, isGlass && styles.headerGlass]}>
        <View style={{ flex: 1 }}>
          <Text style={[styles.headerTitle, isGlass && { color: '#0f172a' }]}>Quiz Directory</Text>
          <Text style={[styles.headerSubtitle, isGlass && { color: '#64748b' }]}>
            {quizCategory === 'nmcle'
              ? `${nmcleQuizzes.length} NMCLE Exam Sets`
              : quizCategory === 'book'
              ? `${bookQuizzes.length} Medical Books`
              : quizCategory === 'custom'
              ? `${customQuizzes.length} Custom Quizzes`
              : `${quizzes.length} Total Sets & Books`}
          </Text>
        </View>

        <TouchableOpacity
          style={[styles.buildCustomHeaderBtn, isGlass && styles.buildCustomHeaderBtnGlass]}
          onPress={() => setCustomBuilderVisible(true)}
          activeOpacity={0.8}
        >
          <Plus size={14} color="#FFFFFF" style={{ marginRight: 3 }} />
          <Text style={styles.buildCustomHeaderText}>Build Custom Quiz</Text>
        </TouchableOpacity>
      </View>

      {/* Top Folder / Category Switcher Pills */}
      <View style={[styles.sectionSwitcherWrapper, isGlass && styles.sectionSwitcherWrapperGlass]}>
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.sectionSwitcherContainer}
        >
          <TouchableOpacity
            style={[
              styles.sectionBtn,
              isGlass && styles.sectionBtnGlass,
              quizCategory === 'all' && styles.sectionBtnActive,
            ]}
            onPress={() => setQuizCategory('all')}
            activeOpacity={0.8}
          >
            <FolderKanban
              size={13}
              color={quizCategory === 'all' ? '#ffffff' : (isGlass ? '#64748b' : '#94a3b8')}
            />
            <Text
              style={[
                styles.sectionBtnText,
                isGlass && { color: '#64748b' },
                quizCategory === 'all' && styles.sectionBtnTextActive,
              ]}
            >
              All ({quizzes.length})
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[
              styles.sectionBtn,
              isGlass && styles.sectionBtnGlass,
              quizCategory === 'nmcle' && styles.sectionBtnActiveNmcle,
            ]}
            onPress={() => setQuizCategory('nmcle')}
            activeOpacity={0.8}
          >
            <Shield
              size={13}
              color={quizCategory === 'nmcle' ? '#ffffff' : (isGlass ? '#4f46e5' : '#818cf8')}
            />
            <Text
              style={[
                styles.sectionBtnText,
                isGlass && { color: '#64748b' },
                quizCategory === 'nmcle' && styles.sectionBtnTextActive,
              ]}
            >
              NMCLE Sets ({nmcleQuizzes.length})
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[
              styles.sectionBtn,
              isGlass && styles.sectionBtnGlass,
              quizCategory === 'book' && styles.sectionBtnActiveBook,
            ]}
            onPress={() => setQuizCategory('book')}
            activeOpacity={0.8}
          >
            <BookOpen
              size={13}
              color={quizCategory === 'book' ? '#ffffff' : (isGlass ? '#0284c7' : '#38bdf8')}
            />
            <Text
              style={[
                styles.sectionBtnText,
                isGlass && { color: '#64748b' },
                quizCategory === 'book' && styles.sectionBtnTextActive,
              ]}
            >
              Medical Books ({bookQuizzes.length})
            </Text>
          </TouchableOpacity>

          {customQuizzes.length > 0 && (
            <TouchableOpacity
              style={[
                styles.sectionBtn,
                isGlass && styles.sectionBtnGlass,
                quizCategory === 'custom' && styles.sectionBtnActiveCustom,
              ]}
              onPress={() => setQuizCategory('custom')}
              activeOpacity={0.8}
            >
              <UserCheck
                size={13}
                color={quizCategory === 'custom' ? '#ffffff' : (isGlass ? '#d97706' : '#fbbf24')}
              />
              <Text
                style={[
                  styles.sectionBtnText,
                  isGlass && { color: '#64748b' },
                  quizCategory === 'custom' && styles.sectionBtnTextActive,
                ]}
              >
                Custom ({customQuizzes.length})
              </Text>
            </TouchableOpacity>
          )}
        </ScrollView>
      </View>

      {/* Sleek Modern Floating Search Capsule */}
      <View style={styles.searchFilterRow}>
        <Pressable
          style={[
            styles.modernSearchBox,
            isGlass && styles.modernSearchBoxGlass,
            isSearchFocused && styles.modernSearchBoxFocused,
          ]}
          onPress={() => searchInputRef.current?.focus()}
        >
          <View style={styles.searchIconBox} pointerEvents="none">
            <Search size={14} color={isSearchFocused ? '#4f46e5' : (isGlass ? '#64748b' : '#818cf8')} />
          </View>

          <TextInput
            ref={searchInputRef}
            style={[styles.modernSearchInput, isGlass && { color: '#0f172a' }]}
            placeholder={
              quizCategory === 'standard'
                ? 'Type any keyword, title or topic...'
                : 'Search custom user quizzes...'
            }
            placeholderTextColor={isGlass ? '#94a3b8' : '#64748b'}
            value={searchQuery}
            onChangeText={setSearchQuery}
            onFocus={() => setIsSearchFocused(true)}
            onBlur={() => setIsSearchFocused(false)}
            returnKeyType="search"
          />

          {searchQuery.length > 0 ? (
            <TouchableOpacity
              onPress={handleClearSearch}
              style={styles.clearSearchBtn}
            >
              <X size={15} color={isGlass ? '#64748b' : '#94a3b8'} />
            </TouchableOpacity>
          ) : null}
        </Pressable>
      </View>

      {/* Quiz List */}
      {loading ? (
        <PageLoadingAnimation
          title="Loading Quizzes..."
          subtitle="Fetching NMCLE sets, medical books & question banks..."
          icon={BookOpen}
        />
      ) : filteredQuizzes.length === 0 ? (
        <View style={styles.emptyContainer}>
          {quizCategory === 'custom' ? (
            <>
              <SlidersHorizontal size={44} color="#a855f7" />
              <Text style={[styles.emptyTitle, isGlass && { color: '#0f172a' }]}>
                {searchQuery ? 'No Matching Custom Quizzes' : 'No Custom Quizzes Created Yet'}
              </Text>
              <Text style={[styles.emptySubtitle, isGlass && { color: '#64748b' }]}>
                {searchQuery
                  ? 'Try a different search term.'
                  : 'Create your own personalized custom tests from specific topics or custom question banks!'}
              </Text>
              <TouchableOpacity
                style={styles.emptyCreateBtn}
                onPress={() => setCustomBuilderVisible(true)}
                activeOpacity={0.8}
              >
                <Plus size={15} color="#ffffff" style={{ marginRight: 6 }} />
                <Text style={styles.emptyCreateBtnText}>Create Custom Quiz Now</Text>
              </TouchableOpacity>
            </>
          ) : (
            <>
              <BookOpen size={44} color={isGlass ? '#94a3b8' : '#475569'} />
              <Text style={[styles.emptyTitle, isGlass && { color: '#0f172a' }]}>No Admin Quizzes Found</Text>
              <Text style={[styles.emptySubtitle, isGlass && { color: '#64748b' }]}>
                No quizzes match "{searchQuery}". Try a different keyword.
              </Text>
            </>
          )}
        </View>
      ) : (
        <FlatList
          data={filteredQuizzes}
          keyExtractor={(item) => item._id}
          contentContainerStyle={styles.listPadding}
          keyboardShouldPersistTaps="handled"
          initialNumToRender={8}
          maxToRenderPerBatch={8}
          windowSize={7}
          updateCellsBatchingPeriod={40}
          removeClippedSubviews={true}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={handleRefresh}
              colors={['#6366f1']}
            />
          }
          renderItem={({ item }) => {
            const qCount = item.questions?.length || item.questionCount || 0;
            const isCustomItem = isCustomQuiz(item);

            return (
              <View style={[styles.quizCard, isGlass && styles.quizCardGlass]}>
                <View style={styles.quizCardHeader}>
                  <View style={styles.headerBadgesRow}>
                    <View
                      style={[
                        styles.categoryBadge,
                        isCustomItem
                          ? { backgroundColor: isGlass ? 'rgba(168, 85, 247, 0.12)' : 'rgba(168, 85, 247, 0.2)', borderColor: isGlass ? '#9333ea' : '#a855f7' }
                          : { backgroundColor: isGlass ? 'rgba(99, 102, 241, 0.12)' : 'rgba(99, 102, 241, 0.2)', borderColor: isGlass ? '#4f46e5' : '#6366f1' },
                      ]}
                    >
                      {isCustomItem ? (
                        <UserCheck size={11} color={isGlass ? '#7c3aed' : '#c084fc'} style={{ marginRight: 4 }} />
                      ) : (
                        <Shield size={11} color={isGlass ? '#4f46e5' : '#818cf8'} style={{ marginRight: 4 }} />
                      )}
                      <Text
                        style={[
                          styles.categoryBadgeText,
                          isCustomItem ? { color: isGlass ? '#7c3aed' : '#c084fc' } : { color: isGlass ? '#4f46e5' : '#818cf8' },
                        ]}
                      >
                        {isCustomItem ? 'CUSTOM QUIZ' : 'ADMIN QUIZ'}
                      </Text>
                    </View>

                    <View style={[styles.subjectBadge, isGlass && { backgroundColor: 'rgba(241, 245, 249, 0.9)' }]}>
                      <Text style={[styles.subjectBadgeText, isGlass && { color: '#475569' }]}>{item.subject || 'General'}</Text>
                    </View>
                  </View>

                  <Text style={[styles.dateText, isGlass && { color: '#94a3b8' }]}>
                    {item.createdAt ? new Date(item.createdAt).toLocaleDateString() : ''}
                  </Text>
                </View>

                <Text style={[styles.quizTitle, isGlass && { color: '#0f172a' }]}>{item.title}</Text>
                {item.description ? (
                  <Text style={[styles.quizDesc, isGlass && { color: '#64748b' }]} numberOfLines={2}>
                    {item.description}
                  </Text>
                ) : null}

                <View style={styles.quizMetaRow}>
                  <View style={styles.metaItem}>
                    <Layers size={14} color={isGlass ? '#4f46e5' : '#818cf8'} />
                    <Text style={[styles.metaText, isGlass && { color: '#475569' }]}>
                      {qCount} {qCount === 1 ? 'Question' : 'Questions'}
                    </Text>
                  </View>
                </View>

                {/* Card Action Buttons */}
                <View style={[styles.cardBtnRow, isGlass && { borderTopColor: 'rgba(226, 232, 240, 0.9)' }]}>
                  <TouchableOpacity
                    style={[styles.manageBtn, isGlass && { backgroundColor: 'rgba(241, 245, 249, 0.85)', borderColor: 'rgba(226, 232, 240, 0.9)' }]}
                    onPress={() => handleOpenManageQuestions(item)}
                  >
                    <Edit3 size={14} color={isGlass ? '#4f46e5' : '#818cf8'} />
                    <Text style={[styles.manageBtnText, isGlass && { color: '#4f46e5' }]}>Manage</Text>
                  </TouchableOpacity>

                  <TouchableOpacity
                    style={[styles.testBtn, qCount === 0 && styles.disabledTestBtn]}
                    onPress={() => handleOpenStartTest(item)}
                  >
                    <Play size={14} color="#ffffff" />
                    <Text style={styles.testBtnText}>Start Test</Text>
                  </TouchableOpacity>

                  {isCustomItem ? (
                    <TouchableOpacity
                      style={[styles.deleteBtn, isGlass && { backgroundColor: 'rgba(241, 245, 249, 0.85)', borderColor: 'rgba(226, 232, 240, 0.9)' }]}
                      onPress={() => handleDeleteQuiz(item._id, item.title)}
                    >
                      <Trash2 size={15} color="#ef4444" />
                    </TouchableOpacity>
                  ) : null}
                </View>
              </View>
            );
          }}
        />
      )}

      {/* Fixed Bottom Navigation Footer Bar */}
      <BottomTabBar activeTab="Quizzes" onTabPress={handleTabPress} />

      {/* Manage Questions Modal */}
      <ManageQuizModal
        visible={manageModalVisible}
        quiz={activeQuizForManage}
        onClose={() => setManageModalVisible(false)}
        onQuizUpdated={(updatedQuiz) => {
          setActiveQuizForManage(updatedQuiz);
          loadQuizzes();
        }}
      />

      {/* Test Config Modal */}
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

      {/* Custom Quiz Builder Modal */}
      <CustomQuizBuilderModal
        visible={customBuilderVisible}
        quizzes={quizzes}
        onClose={() => setCustomBuilderVisible(false)}
        onQuizCreated={(newQuiz, targetCategory) => {
          setCustomBuilderVisible(false);
          setQuizCategory(targetCategory || 'custom');
          loadQuizzes();
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
    paddingHorizontal: 14,
    paddingTop: 8,
    paddingBottom: 10,
    backgroundColor: '#1e293b',
    borderBottomWidth: 1,
    borderBottomColor: '#334155',
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: '800',
    color: '#f8fafc',
  },
  headerSubtitle: {
    fontSize: 11.5,
    color: '#94a3b8',
    marginTop: 1,
  },
  buildCustomHeaderBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#a855f7',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 8,
  },
  buildCustomHeaderText: {
    color: '#FFFFFF',
    fontSize: 11.5,
    fontWeight: '700',
  },
  sectionSwitcherWrapper: {
    backgroundColor: '#0f172a',
    paddingVertical: 6,
    borderBottomWidth: 1,
    borderBottomColor: '#1e293b',
  },
  sectionSwitcherContainer: {
    paddingHorizontal: 10,
    gap: 8,
    flexDirection: 'row',
    alignItems: 'center',
  },
  sectionBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#1e293b',
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: '#334155',
  },
  sectionBtnActive: {
    backgroundColor: '#6366f1',
    borderColor: '#818cf8',
  },
  sectionBtnActiveNmcle: {
    backgroundColor: '#4f46e5',
    borderColor: '#818cf8',
  },
  sectionBtnActiveBook: {
    backgroundColor: '#0284c7',
    borderColor: '#38bdf8',
  },
  sectionBtnActiveCustom: {
    backgroundColor: '#d97706',
    borderColor: '#fbbf24',
  },
  sectionBtnText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#94a3b8',
    marginLeft: 5,
  },
  sectionBtnTextActive: {
    color: '#ffffff',
    fontWeight: '700',
  },

  // Ultra-Modern Floating Search Box
  searchFilterRow: {
    paddingHorizontal: 10,
    marginVertical: 8,
  },
  modernSearchBox: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#1e293b',
    borderRadius: 12,
    paddingHorizontal: 10,
    height: 42,
    borderWidth: 1.5,
    borderColor: '#334155',
  },
  modernSearchBoxFocused: {
    borderColor: '#a855f7',
    backgroundColor: '#0f172a',
    shadowColor: '#a855f7',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 6,
    elevation: 3,
  },
  searchIconBox: {
    width: 24,
    height: 24,
    borderRadius: 6,
    backgroundColor: 'rgba(99, 102, 241, 0.15)',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 8,
  },
  modernSearchInput: {
    flex: 1,
    color: '#f8fafc',
    fontSize: 13,
    fontWeight: '600',
    paddingVertical: 8,
    paddingHorizontal: 4,
    height: '100%',
  },
  clearSearchBtn: {
    padding: 6,
  },

  centerContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 20,
  },
  loadingText: {
    marginTop: 10,
    color: '#94a3b8',
    fontSize: 13,
  },
  emptyContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 30,
  },
  emptyTitle: {
    fontSize: 16,
    fontWeight: '800',
    color: '#f8fafc',
    marginTop: 12,
  },
  emptySubtitle: {
    fontSize: 12,
    color: '#94a3b8',
    textAlign: 'center',
    marginTop: 4,
    lineHeight: 17,
  },
  emptyCreateBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#a855f7',
    paddingHorizontal: 14,
    paddingVertical: 9,
    borderRadius: 8,
    marginTop: 14,
  },
  emptyCreateBtnText: {
    color: '#ffffff',
    fontSize: 12.5,
    fontWeight: '700',
  },
  listPadding: {
    paddingHorizontal: 10,
    paddingBottom: 30,
    gap: 10,
  },
  quizCard: {
    backgroundColor: '#1e293b',
    borderRadius: 12,
    padding: 12,
    borderWidth: 1,
    borderColor: '#334155',
  },
  quizCardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 6,
  },
  headerBadgesRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  categoryBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 5,
    borderWidth: 1,
  },
  categoryBadgeText: {
    fontSize: 9,
    fontWeight: '800',
  },
  subjectBadge: {
    backgroundColor: 'rgba(51, 65, 85, 0.6)',
    paddingHorizontal: 7,
    paddingVertical: 2,
    borderRadius: 5,
  },
  subjectBadgeText: {
    color: '#cbd5e1',
    fontSize: 10.5,
    fontWeight: '600',
  },
  dateText: {
    color: '#64748b',
    fontSize: 10.5,
  },
  quizTitle: {
    fontSize: 15.5,
    fontWeight: '700',
    color: '#f8fafc',
    marginBottom: 3,
  },
  quizDesc: {
    fontSize: 12,
    color: '#94a3b8',
    lineHeight: 17,
    marginBottom: 8,
  },
  quizMetaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 10,
  },
  metaItem: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  metaText: {
    color: '#cbd5e1',
    fontSize: 11.5,
    marginLeft: 4,
    fontWeight: '600',
  },
  cardBtnRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    borderTopWidth: 1,
    borderTopColor: '#334155',
    paddingTop: 8,
  },
  manageBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#0f172a',
    paddingVertical: 7,
    borderRadius: 7,
    borderWidth: 1,
    borderColor: '#334155',
  },
  manageBtnText: {
    color: '#818cf8',
    fontSize: 11.5,
    fontWeight: '700',
    marginLeft: 4,
  },
  testBtn: {
    flex: 1.2,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#6366f1',
    paddingVertical: 7,
    borderRadius: 7,
  },
  disabledTestBtn: {
    opacity: 0.5,
  },
  testBtnText: {
    color: '#ffffff',
    fontSize: 11.5,
    fontWeight: '700',
    marginLeft: 4,
  },
  deleteBtn: {
    width: 32,
    height: 32,
    borderRadius: 7,
    backgroundColor: '#0f172a',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: '#334155',
  },

  // Glassmorphism Apple White Theme Overrides
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
  buildCustomHeaderBtnGlass: {
    backgroundColor: '#4f46e5',
    shadowColor: '#4f46e5',
    shadowOpacity: 0.25,
    shadowRadius: 6,
    elevation: 3,
  },
  sectionSwitcherWrapperGlass: {
    backgroundColor: 'transparent',
    borderBottomColor: '#e2e8f0',
  },
  sectionBtnGlass: {
    backgroundColor: '#ffffff',
    borderColor: '#e2e8f0',
  },
  modernSearchBoxGlass: {
    backgroundColor: '#ffffff',
    borderColor: '#e2e8f0',
    shadowColor: '#64748b',
    shadowOpacity: 0.05,
    shadowRadius: 6,
  },
  quizCardGlass: {
    backgroundColor: '#ffffff',
    borderColor: '#e2e8f0',
    shadowColor: '#64748b',
    shadowOpacity: 0.06,
    shadowRadius: 8,
    elevation: 2,
  },
});

export default memo(QuizzesScreen);
