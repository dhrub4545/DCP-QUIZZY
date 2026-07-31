import React, { useState, useEffect, useCallback } from 'react';
import { useFocusEffect } from '@react-navigation/native';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
  RefreshControl,
  TextInput,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { BookOpen, Search, X, Edit3, Play, Trash2, Layers, Plus, Filter, SlidersHorizontal } from 'lucide-react-native';
import { fetchQuizzes, deleteQuiz } from '../services/api';
import ManageQuizModal from '../components/ManageQuizModal';
import TestConfigModal from '../components/TestConfigModal';
import CustomQuizBuilderModal from '../components/CustomQuizBuilderModal';
import BottomTabBar from '../components/BottomTabBar';

export default function QuizzesScreen({ navigation }) {
  const [quizzes, setQuizzes] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedSubject, setSelectedSubject] = useState('All');

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
          }
        }
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

  // Get unique subjects for filter chips
  const subjects = ['All', ...Array.from(new Set(quizzes.map((q) => q.subject || 'General')))];

  const filteredQuizzes = quizzes.filter((q) => {
    const query = searchQuery.toLowerCase().trim();
    const matchesQuery =
      !query ||
      (q.title && q.title.toLowerCase().includes(query)) ||
      (q.subject && q.subject.toLowerCase().includes(query)) ||
      (q.description && q.description.toLowerCase().includes(query));

    const matchesSubject = selectedSubject === 'All' || (q.subject || 'General') === selectedSubject;

    return matchesQuery && matchesSubject;
  });

  const handleTabPress = (tabName) => {
    if (tabName === 'Home') {
      navigation.navigate('Home');
    } else if (tabName === 'History') {
      navigation.navigate('History');
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      {/* Header Bar */}
      <View style={styles.header}>
        <View style={{ flex: 1 }}>
          <Text style={styles.headerTitle}>Quiz Directory</Text>
          <Text style={styles.headerSubtitle}>{quizzes.length} Quizzes Available</Text>
        </View>
        <TouchableOpacity
          style={styles.buildCustomHeaderBtn}
          onPress={() => setCustomBuilderVisible(true)}
        >
          <SlidersHorizontal size={14} color="#FFFFFF" style={{ marginRight: 4 }} />
          <Text style={styles.buildCustomHeaderText}>Build Custom Test</Text>
        </TouchableOpacity>
      </View>

      {/* Search Bar */}
      <View style={styles.searchContainer}>
        <Search size={14} color="#94a3b8" style={styles.searchIcon} />
        <TextInput
          style={styles.searchInput}
          placeholder="Search quizzes by title or subject..."
          value={searchQuery}
          onChangeText={setSearchQuery}
          placeholderTextColor="#64748b"
        />
        {searchQuery ? (
          <TouchableOpacity onPress={() => setSearchQuery('')}>
            <X size={14} color="#94a3b8" />
          </TouchableOpacity>
        ) : null}
      </View>

      {/* Subject Filter Chips */}
      <View style={styles.filterChipContainer}>
        <FlatList
          horizontal
          showsHorizontalScrollIndicator={false}
          data={subjects}
          keyExtractor={(item) => item}
          contentContainerStyle={{ paddingHorizontal: 10, gap: 4 }}
          renderItem={({ item }) => (
            <TouchableOpacity
              style={[styles.chip, selectedSubject === item && styles.selectedChip]}
              onPress={() => setSelectedSubject(item)}
            >
              <Text style={[styles.chipText, selectedSubject === item && styles.selectedChipText]}>
                {item}
              </Text>
            </TouchableOpacity>
          )}
        />
      </View>

      {/* Quiz List */}
      {loading ? (
        <View style={styles.centerContainer}>
          <ActivityIndicator size="large" color="#6366f1" />
          <Text style={styles.loadingText}>Loading quizzes...</Text>
        </View>
      ) : filteredQuizzes.length === 0 ? (
        <View style={styles.emptyContainer}>
          <BookOpen size={48} color="#475569" />
          <Text style={styles.emptyTitle}>No Quizzes Found</Text>
          <Text style={styles.emptySubtitle}>
            Try adjusting your search query or filter chips.
          </Text>
        </View>
      ) : (
        <FlatList
          data={filteredQuizzes}
          keyExtractor={(item) => item._id}
          contentContainerStyle={styles.listPadding}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={handleRefresh} colors={['#6366f1']} />
          }
          renderItem={({ item }) => {
            const qCount = item.questions?.length || item.questionCount || 0;
            return (
              <View style={styles.quizCard}>
                <View style={styles.quizCardHeader}>
                  <View style={styles.subjectBadge}>
                    <Text style={styles.subjectBadgeText}>{item.subject || 'General'}</Text>
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
                    <Text style={styles.metaText}>{qCount} {qCount === 1 ? 'Question' : 'Questions'}</Text>
                  </View>
                </View>

                {/* Card Action Buttons */}
                <View style={styles.cardBtnRow}>
                  <TouchableOpacity
                    style={styles.manageBtn}
                    onPress={() => handleOpenManageQuestions(item)}
                  >
                    <Edit3 size={15} color="#818cf8" />
                    <Text style={styles.manageBtnText}>Manage</Text>
                  </TouchableOpacity>

                  <TouchableOpacity
                    style={[styles.testBtn, qCount === 0 && styles.disabledTestBtn]}
                    onPress={() => handleOpenStartTest(item)}
                  >
                    <Play size={15} color="#ffffff" />
                    <Text style={styles.testBtnText}>Start Test</Text>
                  </TouchableOpacity>

                  <TouchableOpacity
                    style={styles.deleteBtn}
                    onPress={() => handleDeleteQuiz(item._id, item.title)}
                  >
                    <Trash2 size={16} color="#ef4444" />
                  </TouchableOpacity>
                </View>
              </View>
            );
          }}
        />
      )}

      {/* Fixed Bottom Navigation Footer Bar */}
      <BottomTabBar
        activeTab="Quizzes"
        onTabPress={handleTabPress}
        onAddQuizPress={() => {
          navigation.navigate('Home', { openCreateModal: true });
        }}
      />

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

      {/* Modal: Custom Multi-Source Quiz Builder */}
      <CustomQuizBuilderModal
        visible={customBuilderVisible}
        onClose={() => setCustomBuilderVisible(false)}
        onStartTest={(generatedQuiz, config) => {
          setCustomBuilderVisible(false);
          loadQuizzes();
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
  buildCustomHeaderBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#6366f1',
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 10,
  },
  buildCustomHeaderText: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '700',
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: '800',
    color: '#f8fafc',
  },
  headerSubtitle: {
    fontSize: 11,
    color: '#94a3b8',
    marginTop: 1,
  },
  searchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#1e293b',
    marginHorizontal: 10,
    marginTop: 6,
    marginBottom: 4,
    paddingHorizontal: 10,
    paddingVertical: 3,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#334155',
  },
  searchIcon: {
    marginRight: 6,
  },
  searchInput: {
    flex: 1,
    fontSize: 12.5,
    color: '#f8fafc',
    paddingVertical: 3,
  },
  filterChipContainer: {
    marginVertical: 4,
  },
  chip: {
    backgroundColor: '#1e293b',
    paddingHorizontal: 9,
    paddingVertical: 4,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#334155',
  },
  selectedChip: {
    backgroundColor: '#6366f1',
    borderColor: '#818cf8',
  },
  chipText: {
    fontSize: 11.5,
    color: '#94a3b8',
    fontWeight: '600',
  },
  selectedChipText: {
    color: '#ffffff',
    fontWeight: '700',
  },
  centerContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    marginTop: 8,
    color: '#94a3b8',
    fontSize: 13,
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 20,
  },
  emptyTitle: {
    fontSize: 17,
    fontWeight: '700',
    color: '#cbd5e1',
    marginTop: 12,
  },
  emptySubtitle: {
    fontSize: 13,
    color: '#64748b',
    textAlign: 'center',
    marginTop: 4,
    lineHeight: 18,
  },
  listPadding: {
    paddingHorizontal: 10,
    paddingTop: 6,
    paddingBottom: 30,
  },
  quizCard: {
    backgroundColor: '#1e293b',
    borderRadius: 12,
    padding: 14,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: '#334155',
    elevation: 2,
  },
  quizCardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 6,
  },
  subjectBadge: {
    backgroundColor: 'rgba(99, 102, 241, 0.2)',
    paddingHorizontal: 9,
    paddingVertical: 3,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#6366f1',
  },
  subjectBadgeText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#818cf8',
  },
  dateText: {
    fontSize: 11,
    color: '#94a3b8',
  },
  quizTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#f8fafc',
    marginBottom: 3,
  },
  quizDesc: {
    fontSize: 12,
    color: '#cbd5e1',
    lineHeight: 16,
    marginBottom: 10,
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
    fontSize: 12,
    fontWeight: '600',
    color: '#cbd5e1',
    marginLeft: 5,
  },
  cardBtnRow: {
    flexDirection: 'row',
    alignItems: 'center',
    borderTopWidth: 1,
    borderTopColor: '#334155',
    paddingTop: 10,
  },
  manageBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(99, 102, 241, 0.15)',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 8,
    marginRight: 6,
    borderWidth: 1,
    borderColor: '#6366f1',
  },
  manageBtnText: {
    color: '#818cf8',
    fontWeight: '700',
    fontSize: 12,
    marginLeft: 4,
  },
  testBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#10b981',
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 8,
    flex: 1,
    justifyContent: 'center',
  },
  disabledTestBtn: {
    backgroundColor: '#475569',
  },
  testBtnText: {
    color: '#ffffff',
    fontWeight: '700',
    fontSize: 12,
    marginLeft: 4,
  },
  deleteBtn: {
    padding: 6,
    marginLeft: 6,
  },
});
