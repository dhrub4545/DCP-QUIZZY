import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useFocusEffect } from '@react-navigation/native';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  Pressable,
  ActivityIndicator,
  Alert,
  RefreshControl,
  TextInput,
  StatusBar,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import {
  BookOpen,
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
import ManageQuizModal from '../components/ManageQuizModal';
import TestConfigModal from '../components/TestConfigModal';
import CustomQuizBuilderModal from '../components/CustomQuizBuilderModal';
import BottomTabBar from '../components/BottomTabBar';

export default function QuizzesScreen({ navigation }) {
  const [quizzes, setQuizzes] = useState([]);
  const [loading, setLoading] = useState(true);
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
      if (showSpinner) {
        setLoading(true);
      }
      const data = await fetchQuizzes();
      if (data && data.quizzes) {
        setQuizzes(data.quizzes);
      } else {
        setQuizzes([]);
      }
    } catch (err) {
      console.warn('Error loading quizzes:', err.message);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useFocusEffect(
    useCallback(() => {
      loadQuizzes(quizzes.length === 0);
    }, [])
  );

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

  const isCustomQuiz = (q) => {
    if (q.isCustom === true) return true;
    if (q.creator === 'user') return true;
    const titleLower = (q.title || '').toLowerCase();
    if (titleLower.includes('custom') || titleLower.includes('combined')) return true;
    return false;
  };

  // Separate Standard (Admin) vs Custom (User) Quizzes
  const standardQuizzes = quizzes.filter((q) => !isCustomQuiz(q));
  const customQuizzes = quizzes.filter((q) => isCustomQuiz(q));

  const currentCategoryQuizzes = quizCategory === 'standard' ? standardQuizzes : customQuizzes;

  // Filter quizzes by search query (Shows ALL when search is blank)
  const filteredQuizzes = currentCategoryQuizzes.filter((q) => {
    if (!searchQuery || !searchQuery.trim()) return true;
    const query = searchQuery.toLowerCase().trim();
    return (
      (q.title && q.title.toLowerCase().includes(query)) ||
      (q.subject && q.subject.toLowerCase().includes(query)) ||
      (q.description && q.description.toLowerCase().includes(query)) ||
      (Array.isArray(q.topics) && q.topics.some((t) => t && t.toLowerCase().includes(query)))
    );
  });

  const handleTabPress = (tabName) => {
    if (tabName === 'Home') {
      navigation.navigate('Home');
    } else if (tabName === 'Study') {
      navigation.navigate('Study');
    } else if (tabName === 'History') {
      navigation.navigate('History');
    } else if (tabName === 'Profile') {
      navigation.navigate('Profile');
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="light-content" backgroundColor="#0f172a" />
      
      {/* Header Bar */}
      <View style={styles.header}>
        <View style={{ flex: 1 }}>
          <Text style={styles.headerTitle}>Quiz Directory</Text>
          <Text style={styles.headerSubtitle}>
            {quizCategory === 'standard'
              ? `${standardQuizzes.length} Admin Quizzes (Public)`
              : `${customQuizzes.length} Custom Quizzes (My Created Tests)`}
          </Text>
        </View>

        <TouchableOpacity
          style={styles.buildCustomHeaderBtn}
          onPress={() => setCustomBuilderVisible(true)}
          activeOpacity={0.8}
        >
          <Plus size={14} color="#FFFFFF" style={{ marginRight: 3 }} />
          <Text style={styles.buildCustomHeaderText}>Build Custom Quiz</Text>
        </TouchableOpacity>
      </View>

      {/* Top Dual Section Switcher: Standard Quizzes (Admin) vs Custom Quizzes (User) */}
      <View style={styles.sectionSwitcherContainer}>
        <TouchableOpacity
          style={[
            styles.sectionBtn,
            quizCategory === 'standard' && styles.sectionBtnActive,
          ]}
          onPress={() => setQuizCategory('standard')}
          activeOpacity={0.8}
        >
          <Shield
            size={15}
            color={quizCategory === 'standard' ? '#ffffff' : '#94a3b8'}
          />
          <Text
            style={[
              styles.sectionBtnText,
              quizCategory === 'standard' && styles.sectionBtnTextActive,
            ]}
          >
            Standard ({standardQuizzes.length})
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[
            styles.sectionBtn,
            quizCategory === 'custom' && styles.sectionBtnActiveCustom,
          ]}
          onPress={() => setQuizCategory('custom')}
          activeOpacity={0.8}
        >
          <UserCheck
            size={15}
            color={quizCategory === 'custom' ? '#ffffff' : '#94a3b8'}
          />
          <Text
            style={[
              styles.sectionBtnText,
              quizCategory === 'custom' && styles.sectionBtnTextActive,
            ]}
          >
            Custom Quizzes ({customQuizzes.length})
          </Text>
        </TouchableOpacity>
      </View>

      {/* Sleek Modern Floating Search Capsule */}
      <View style={styles.searchFilterRow}>
        <Pressable
          style={[
            styles.modernSearchBox,
            isSearchFocused && styles.modernSearchBoxFocused,
          ]}
          onPress={() => searchInputRef.current?.focus()}
        >
          <View style={styles.searchIconBox} pointerEvents="none">
            <Search size={14} color={isSearchFocused ? '#c084fc' : '#818cf8'} />
          </View>

          <TextInput
            ref={searchInputRef}
            style={styles.modernSearchInput}
            placeholder={
              quizCategory === 'standard'
                ? 'Type any keyword, title or topic...'
                : 'Search custom user quizzes...'
            }
            value={searchQuery}
            onChangeText={setSearchQuery}
            onFocus={() => setIsSearchFocused(true)}
            onBlur={() => setIsSearchFocused(false)}
            placeholderTextColor="#64748b"
            editable={true}
            returnKeyType="search"
            autoCapitalize="none"
            autoCorrect={false}
          />

          {searchQuery ? (
            <TouchableOpacity
              style={styles.clearSearchBtn}
              onPress={() => setSearchQuery('')}
              hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
            >
              <X size={14} color="#94a3b8" />
            </TouchableOpacity>
          ) : null}
        </Pressable>
      </View>

      {/* Quiz List */}
      {loading ? (
        <View style={styles.centerContainer}>
          <ActivityIndicator size="large" color="#6366f1" />
          <Text style={styles.loadingText}>Loading quizzes...</Text>
        </View>
      ) : filteredQuizzes.length === 0 ? (
        <View style={styles.emptyContainer}>
          {quizCategory === 'custom' ? (
            <>
              <SlidersHorizontal size={44} color="#a855f7" />
              <Text style={styles.emptyTitle}>
                {searchQuery ? 'No Matching Custom Quizzes' : 'No Custom Quizzes Created Yet'}
              </Text>
              <Text style={styles.emptySubtitle}>
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
              <BookOpen size={44} color="#475569" />
              <Text style={styles.emptyTitle}>No Admin Quizzes Found</Text>
              <Text style={styles.emptySubtitle}>
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
              <View style={styles.quizCard}>
                <View style={styles.quizCardHeader}>
                  <View style={styles.headerBadgesRow}>
                    <View
                      style={[
                        styles.categoryBadge,
                        isCustomItem
                          ? { backgroundColor: 'rgba(168, 85, 247, 0.2)', borderColor: '#a855f7' }
                          : { backgroundColor: 'rgba(99, 102, 241, 0.2)', borderColor: '#6366f1' },
                      ]}
                    >
                      {isCustomItem ? (
                        <UserCheck size={11} color="#c084fc" style={{ marginRight: 4 }} />
                      ) : (
                        <Shield size={11} color="#818cf8" style={{ marginRight: 4 }} />
                      )}
                      <Text
                        style={[
                          styles.categoryBadgeText,
                          isCustomItem ? { color: '#c084fc' } : { color: '#818cf8' },
                        ]}
                      >
                        {isCustomItem ? 'CUSTOM QUIZ' : 'ADMIN QUIZ'}
                      </Text>
                    </View>

                    <View style={styles.subjectBadge}>
                      <Text style={styles.subjectBadgeText}>{item.subject || 'General'}</Text>
                    </View>
                  </View>

                  <Text style={styles.dateText}>
                    {item.createdAt ? new Date(item.createdAt).toLocaleDateString() : ''}
                  </Text>
                </View>

                <Text style={styles.quizTitle}>{item.title}</Text>
                {item.description ? (
                  <Text style={styles.quizDesc} numberOfLines={2}>
                    {item.description}
                  </Text>
                ) : null}

                <View style={styles.quizMetaRow}>
                  <View style={styles.metaItem}>
                    <Layers size={14} color="#818cf8" />
                    <Text style={styles.metaText}>
                      {qCount} {qCount === 1 ? 'Question' : 'Questions'}
                    </Text>
                  </View>
                </View>

                {/* Card Action Buttons */}
                <View style={styles.cardBtnRow}>
                  <TouchableOpacity
                    style={styles.manageBtn}
                    onPress={() => handleOpenManageQuestions(item)}
                  >
                    <Edit3 size={14} color="#818cf8" />
                    <Text style={styles.manageBtnText}>Manage</Text>
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
                      style={styles.deleteBtn}
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
  sectionSwitcherContainer: {
    flexDirection: 'row',
    backgroundColor: '#1e293b',
    marginHorizontal: 10,
    marginTop: 8,
    padding: 3,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#334155',
  },
  sectionBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 7,
    borderRadius: 7,
  },
  sectionBtnActive: {
    backgroundColor: '#6366f1',
  },
  sectionBtnActiveCustom: {
    backgroundColor: '#a855f7',
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
});
