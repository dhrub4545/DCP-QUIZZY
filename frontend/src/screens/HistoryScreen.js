import React, { useState, useEffect, useCallback, useRef, memo, useMemo } from 'react';
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
  Modal,
  Animated,
  Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import {
  ArrowLeft,
  Clock,
  Award,
  CheckCircle2,
  Trash2,
  Calendar,
  X,
  Sparkles,
  Lightbulb,
  MessageSquare,
} from 'lucide-react-native';
import {
  fetchHistoryApi,
  fetchHistoryByIdApi,
  deleteHistoryApi,
  fetchAiExplanationApi,
} from '../services/api';
import { useTheme } from '../context/ThemeContext';
import MarkdownRenderer from '../components/MarkdownRenderer';
import ZoomableImageCard from '../components/ZoomableImageCard';
import AiChatModal from '../components/AiChatModal';
import BottomTabBar from '../components/BottomTabBar';
import {
  getCachedHistory,
  getCachedHistoryTotal,
  setCachedHistory,
  appendCachedHistory,
  removeCachedHistoryItem,
} from '../services/appStateCache';

// ----------------------------------------------------
// Card Loading Skeleton Animation Component
// ----------------------------------------------------
const HistoryCardSkeleton = ({ isGlass }) => {
  const pulseAnim = useRef(new Animated.Value(0.35)).current;

  useEffect(() => {
    const pulse = Animated.loop(
      Animated.sequence([
        Animated.timing(pulseAnim, {
          toValue: 0.9,
          duration: 750,
          useNativeDriver: true,
        }),
        Animated.timing(pulseAnim, {
          toValue: 0.35,
          duration: 750,
          useNativeDriver: true,
        }),
      ])
    );
    pulse.start();
    return () => pulse.stop();
  }, [pulseAnim]);

  return (
    <Animated.View style={[styles.card, styles.skeletonCard, isGlass && styles.cardGlass, { opacity: pulseAnim }]}>
      <View style={styles.cardHeader}>
        <View style={[styles.skeletonBadge, isGlass && { backgroundColor: '#e2e8f0' }]} />
        <View style={[styles.skeletonDate, isGlass && { backgroundColor: '#e2e8f0' }]} />
      </View>
      <View style={[styles.skeletonTitle, isGlass && { backgroundColor: '#e2e8f0' }]} />
      <View style={[styles.skeletonSubject, isGlass && { backgroundColor: '#e2e8f0' }]} />
      <View style={styles.statsRow}>
        <View style={[styles.skeletonChip, isGlass && { backgroundColor: '#f1f5f9', borderColor: '#e2e8f0' }]} />
        <View style={[styles.skeletonChip, isGlass && { backgroundColor: '#f1f5f9', borderColor: '#e2e8f0' }]} />
      </View>
    </Animated.View>
  );
};

function HistoryScreen({ navigation, route, onTabPress, isActiveTab, onReady }) {
  const { isGlass } = useTheme();

  // Paginated History State (initialized with instant shared cache)
  const cachedHistory = getCachedHistory();
  const [historyList, setHistoryList] = useState(cachedHistory || []);
  const [loading, setLoading] = useState(!cachedHistory);
  const [refreshing, setRefreshing] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(true);
  const [totalCount, setTotalCount] = useState(getCachedHistoryTotal() || 0);

  const isLoadingRef = useRef(false);

  // Detail Modal State
  const [selectedAttempt, setSelectedAttempt] = useState(null);
  const [modalVisible, setModalVisible] = useState(false);
  const [modalLoading, setModalLoading] = useState(false);

  // AI Explanation & Chat states
  const [aiExplanations, setAiExplanations] = useState({});
  const [loadingAiIdx, setLoadingAiIdx] = useState(null);

  // AI Chat Modal state
  const [chatModalVisible, setChatModalVisible] = useState(false);
  const [activeQuestionForChat, setActiveQuestionForChat] = useState(null);

  // Load Paginated History
  const loadHistory = async (pageToFetch = 1, isRefresh = false) => {
    if (isLoadingRef.current) return;
    try {
      isLoadingRef.current = true;
      if (pageToFetch === 1 && !isRefresh && !getCachedHistory()) {
        setLoading(true);
      } else if (pageToFetch > 1) {
        setLoadingMore(true);
      }

      const data = await fetchHistoryApi(pageToFetch, 15);
      if (data && Array.isArray(data.history)) {
        if (pageToFetch === 1) {
          setCachedHistory(data.history, data.total);
          setHistoryList(data.history);
        } else {
          appendCachedHistory(data.history);
          setHistoryList((prev) => {
            const existingIds = new Set(prev.map((item) => item._id));
            const newItems = data.history.filter((item) => !existingIds.has(item._id));
            return [...prev, ...newItems];
          });
        }
        setPage(pageToFetch);
        setHasMore(Boolean(data.hasMore));
        if (data.total !== undefined) {
          setTotalCount(data.total);
        }
      }
    } catch (err) {
      console.warn('Error loading history:', err.message);
    } finally {
      isLoadingRef.current = false;
      setLoading(false);
      setRefreshing(false);
      setLoadingMore(false);
      if (onReady) onReady();
    }
  };

  useEffect(() => {
    loadHistory(1);
  }, []);

  useFocusEffect(
    useCallback(() => {
      const currentCache = getCachedHistory();
      if (currentCache) {
        setHistoryList(currentCache);
        setTotalCount(getCachedHistoryTotal());
        setLoading(false);
      }
    }, [])
  );

  const handleRefresh = () => {
    setRefreshing(true);
    loadHistory(1, true);
  };

  const handleLoadMore = () => {
    if (!loading && !loadingMore && hasMore && !isLoadingRef.current) {
      loadHistory(page + 1);
    }
  };

  const handleDeleteAttempt = (id, title) => {
    Alert.alert(
      'Delete Attempt',
      `Delete this test result for "${title}"?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            try {
              setHistoryList((prev) => prev.filter((item) => item._id !== id));
              await deleteHistoryApi(id);
              loadHistory(1);
            } catch (err) {
              Alert.alert('Delete Error', err.message || 'Failed to delete attempt.');
              loadHistory(1);
            }
          },
        },
      ]
    );
  };

  const handleOpenDetail = async (attempt) => {
    setSelectedAttempt(attempt);
    setAiExplanations({});
    setModalVisible(true);

    // If attempt has full breakdown already, no additional fetch needed
    if (attempt.questionBreakdown && attempt.questionBreakdown.length > 0) {
      setModalLoading(false);
      return;
    }

    // Lazy load full question breakdown by attempt ID
    try {
      setModalLoading(true);
      const res = await fetchHistoryByIdApi(attempt._id);
      if (res && res.history) {
        setSelectedAttempt(res.history);
      }
    } catch (err) {
      console.error('Error fetching full attempt details:', err);
    } finally {
      setModalLoading(false);
    }
  };

  const handleGenerateAiExplanation = async (q, idx) => {
    if (aiExplanations[idx]) return;
    try {
      setLoadingAiIdx(idx);
      const res = await fetchAiExplanationApi({
        questionText: q.questionText,
        options: q.options,
        correctAnswerLetter: q.correctAnswerLetter || 'A',
        explanation: q.explanation,
      });

      if (res && res.explanation) {
        setAiExplanations((prev) => ({
          ...prev,
          [idx]: res.explanation,
        }));
      }
    } catch (err) {
      console.error('Error fetching AI explanation:', err);
      Alert.alert(
        'AI Explanation',
        err.response?.data?.message || err.message || 'AI service is temporarily busy. Please try again in a moment!'
      );
    } finally {
      setLoadingAiIdx(null);
    }
  };

  const handleOpenAiChat = (q) => {
    setActiveQuestionForChat({
      questionText: q.questionText,
      options: q.options,
      correctAnswerLetter: q.correctAnswerLetter || 'A',
      userLetter: q.userLetter || 'Not answered',
      explanation: q.explanation || '',
    });
    setChatModalVisible(true);
  };

  const formatTime = (secs) => {
    if (!secs) return '0s';
    const m = Math.floor(secs / 60);
    const s = secs % 60;
    return m > 0 ? `${m}m ${s}s` : `${s}s`;
  };

  const getScoreBadge = (percent) => {
    if (percent >= 80)
      return {
        title: `${percent}%`,
        color: '#34d399',
        bg: 'rgba(16, 185, 129, 0.2)',
        border: 'rgba(16, 185, 129, 0.4)',
      };
    if (percent >= 50)
      return {
        title: `${percent}%`,
        color: '#818cf8',
        bg: 'rgba(99, 102, 241, 0.2)',
        border: 'rgba(99, 102, 241, 0.4)',
      };
    return {
      title: `${percent}%`,
      color: '#fb7185',
      bg: 'rgba(244, 63, 94, 0.2)',
      border: 'rgba(244, 63, 94, 0.4)',
    };
  };

  // Review Question Item in Detail Modal
  const renderReviewQuestionItem = ({ item: q, index: idx }) => {
    const questionPicUrl =
      q.questionImage || q.questionpic || q.image || q.question_image;
    const explanationPicUrl =
      q.cloudanary_link ||
      q.cloudinary_link ||
      q.explanationPic ||
      q.explanationImage ||
      q.explanation_pic;

    return (
      <View style={styles.reviewCard}>
        <View style={styles.reviewCardHeader}>
          <View
            style={[
              styles.statusDot,
              { backgroundColor: q.isCorrect ? '#10b981' : '#ef4444' },
            ]}
          />
          <Text style={styles.reviewQTitle}>
            Q{idx + 1}. {q.questionText}
          </Text>
        </View>

        {/* Question Image */}
        {questionPicUrl ? (
          <ZoomableImageCard
            uri={questionPicUrl}
            caption={`Question ${idx + 1} Diagram`}
            theme="dark"
            style={{ marginTop: 8, marginBottom: 12 }}
          />
        ) : null}

        <View style={styles.reviewOptionsList}>
          {q.options?.map((opt, optIdx) => {
            const letter = ['A', 'B', 'C', 'D', 'E', 'F'][optIdx];
            const isUserChoice =
              q.userLetter === letter || q.userOptionIndex === optIdx;
            const isAnswer =
              q.correctAnswerLetter === letter ||
              q.correctOptionIndex === optIdx;

            return (
              <View
                key={optIdx}
                style={[
                  styles.reviewOptionRow,
                  isGlass && styles.reviewOptionRowGlass,
                  isAnswer && styles.reviewOptionAnswer,
                  isUserChoice && !isAnswer && styles.reviewOptionWrong,
                ]}
              >
                <Text
                  style={[
                    styles.optLetter,
                    isGlass && { color: '#64748b' },
                    isAnswer && { color: '#10b981', fontWeight: '700' },
                  ]}
                >
                  {letter}.
                </Text>
                <Text style={[styles.optText, isGlass && { color: '#334155' }]}>{opt}</Text>
              </View>
            );
          })}
        </View>

        {q.explanation ? (
          <View style={[styles.expBox, isGlass && styles.expBoxGlass]}>
            <Text style={[styles.expTitle, isGlass && { color: '#4f46e5' }]}>Printed Explanation:</Text>
            <MarkdownRenderer
              content={q.explanation}
              explanationImage={explanationPicUrl}
              theme={isGlass ? 'light' : 'dark'}
            />
          </View>
        ) : null}

        {/* AI Generated Explanation Card */}
        {aiExplanations[idx] && (
          <View style={[styles.aiExpBox, isGlass && styles.aiExpBoxGlass]}>
            <View style={[styles.aiExpHeader, isGlass && { borderBottomColor: 'rgba(168, 85, 247, 0.2)' }]}>
              <View style={styles.aiBadge}>
                <Sparkles size={11} color="#ffffff" />
                <Text style={styles.aiBadgeText}>GEMINI 3.6 FLASH AI</Text>
              </View>
              <Text style={[styles.aiExpTitle, isGlass && { color: '#7c3aed' }]}>In-Depth Explanation</Text>
            </View>
            <MarkdownRenderer content={aiExplanations[idx]} theme={isGlass ? 'light' : 'dark'} />
          </View>
        )}

        {/* AI Action Buttons Row */}
        <View style={styles.aiBtnRow}>
          <TouchableOpacity
            style={[styles.aiExplainBtn, isGlass && styles.aiExplainBtnGlass]}
            onPress={() => handleGenerateAiExplanation(q, idx)}
            disabled={loadingAiIdx === idx}
          >
            {loadingAiIdx === idx ? (
              <ActivityIndicator size="small" color={isGlass ? '#7c3aed' : '#c084fc'} />
            ) : (
              <>
                <Lightbulb size={14} color={isGlass ? '#7c3aed' : '#c084fc'} />
                <Text style={[styles.aiExplainBtnText, isGlass && { color: '#7c3aed' }]}>
                  {aiExplanations[idx]
                    ? 'Regenerate AI Explanation'
                    : 'Generate AI Explanation'}
                </Text>
              </>
            )}
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.aiChatBtn}
            onPress={() => handleOpenAiChat(q)}
          >
            <MessageSquare size={14} color="#ffffff" />
            <Text style={styles.aiChatBtnText}>Chat with AI Tutor</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  };

  const renderHistoryCard = useCallback(({ item }) => {
    const badge = getScoreBadge(item.accuracyPercentage || 0);
    const dateStr = item.completedAt
      ? new Date(item.completedAt).toLocaleDateString()
      : '';
    const timeStr = item.completedAt
      ? new Date(item.completedAt).toLocaleTimeString([], {
          hour: '2-digit',
          minute: '2-digit',
        })
      : '';

    return (
      <TouchableOpacity
        style={[styles.card, isGlass && styles.cardGlass]}
        activeOpacity={0.7}
        onPress={() => handleOpenDetail(item)}
      >
        <View style={styles.cardHeader}>
          <View
            style={[
              styles.badge,
              {
                backgroundColor: badge.bg,
                borderColor: badge.border,
              },
            ]}
          >
            <Award size={13} color={badge.color} />
            <Text style={[styles.badgeText, { color: badge.color }]}>
              {badge.title}
            </Text>
          </View>
          <View style={styles.dateRow}>
            <Calendar
              size={11}
              color="#64748b"
              style={{ marginRight: 4 }}
            />
            <Text style={[styles.dateText, isGlass && { color: '#64748b' }]}>
              {dateStr} • {timeStr}
            </Text>
          </View>
        </View>

        <Text style={[styles.quizTitle, isGlass && { color: '#0f172a' }]} numberOfLines={1}>
          {item.quizTitle}
        </Text>
        <Text style={[styles.subjectText, isGlass && { color: '#64748b' }]}>
          {item.subject || 'General'}
        </Text>

        <View style={styles.statsRow}>
          <View style={[styles.statChip, isGlass && styles.statChipGlass]}>
            <CheckCircle2 size={12.5} color="#10b981" />
            <Text style={[styles.statChipText, isGlass && { color: '#334155' }]}>
              {item.correctCount} / {item.totalQuestions} Correct
            </Text>
          </View>

          <View style={[styles.statChip, isGlass && styles.statChipGlass]}>
            <Clock size={12.5} color={isGlass ? '#4f46e5' : '#818cf8'} />
            <Text style={[styles.statChipText, isGlass && { color: '#334155' }]}>
              {formatTime(item.timeTakenSeconds)}
            </Text>
          </View>

          <View style={{ flex: 1 }} />

          <TouchableOpacity
            style={styles.deleteBtn}
            onPress={() =>
              handleDeleteAttempt(item._id, item.quizTitle)
            }
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
          >
            <Trash2 size={14} color="#ef4444" />
          </TouchableOpacity>
        </View>
      </TouchableOpacity>
    );
  }, [isGlass]);

  return (
    <SafeAreaView style={[styles.container, isGlass && styles.containerGlass]}>
      {/* Header Bar */}
      <View style={[styles.header, isGlass && styles.headerGlass]}>
        <TouchableOpacity
          style={styles.backBtn}
          onPress={() => (navigation.canGoBack() ? navigation.goBack() : navigation.navigate('Home'))}
        >
          <ArrowLeft size={22} color={isGlass ? '#0f172a' : '#f8fafc'} />
        </TouchableOpacity>
        <Text style={[styles.headerTitle, isGlass && { color: '#0f172a' }]}>Test Attempt History</Text>
        <View style={{ width: 22 }} />
      </View>

      {/* Body */}
      {loading ? (
        <View style={styles.listPadding}>
          <HistoryCardSkeleton isGlass={isGlass} />
          <HistoryCardSkeleton isGlass={isGlass} />
          <HistoryCardSkeleton isGlass={isGlass} />
          <HistoryCardSkeleton isGlass={isGlass} />
        </View>
      ) : historyList.length === 0 ? (
        <View style={styles.emptyContainer}>
          <Clock size={56} color={isGlass ? '#94a3b8' : '#475569'} />
          <Text style={[styles.emptyTitle, isGlass && { color: '#0f172a' }]}>No Test History Yet</Text>
          <Text style={[styles.emptySubtitle, isGlass && { color: '#64748b' }]}>
            Complete your first test to see your performance history and detailed
            scorecards here!
          </Text>
        </View>
      ) : (
        <FlatList
          data={historyList}
          keyExtractor={(item) => item._id}
          contentContainerStyle={styles.listPadding}
          initialNumToRender={8}
          maxToRenderPerBatch={8}
          windowSize={7}
          removeClippedSubviews={Platform.OS === 'android'}
          onEndReached={handleLoadMore}
          onEndReachedThreshold={0.4}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={handleRefresh}
              colors={['#6366f1']}
            />
          }
          ListFooterComponent={
            <View>
              {loadingMore ? (
                <View style={styles.footerLoader}>
                  <ActivityIndicator size="small" color={isGlass ? '#4f46e5' : '#818cf8'} />
                  <Text style={[styles.footerLoaderText, isGlass && { color: '#4f46e5' }]}>
                    Loading more test history...
                  </Text>
                </View>
              ) : !hasMore && historyList.length >= 8 ? (
                <View style={styles.endHistoryFooter}>
                  <Text style={[styles.endHistoryText, isGlass && { color: '#64748b' }]}>
                    All {totalCount || historyList.length} test attempts loaded
                  </Text>
                </View>
              ) : null}
            </View>
          }
          renderItem={renderHistoryCard}
        />
      )}

      {/* Fixed Bottom Navigation Footer Bar */}
      <BottomTabBar
        activeTab="History"
        onTabPress={(tab) => {
          if (onTabPress) {
            onTabPress(tab);
          } else {
            if (tab === 'Home') {
              navigation.navigate('Home');
            } else if (tab === 'Quizzes') {
              navigation.navigate('Quizzes');
            } else if (tab === 'Study') {
              navigation.navigate('Study');
            } else if (tab === 'Profile') {
              navigation.navigate('Profile');
            }
          }
        }}
      />

      {/* Attempt Details Review Modal with Virtualized Lazy Rendering */}
      <Modal
        visible={modalVisible}
        animationType="slide"
        transparent={false}
        onRequestClose={() => setModalVisible(false)}
      >
        <SafeAreaView style={[styles.modalContainer, isGlass && styles.modalContainerGlass]}>
          <View style={[styles.modalHeader, isGlass && styles.modalHeaderGlass]}>
            <View style={{ flex: 1 }}>
              <Text style={[styles.modalTitle, isGlass && { color: '#0f172a' }]} numberOfLines={1}>
                {selectedAttempt?.quizTitle || 'Attempt Review'}
              </Text>
              <Text style={[styles.modalSub, isGlass && { color: '#64748b' }]}>
                Score: {selectedAttempt?.accuracyPercentage}% •{' '}
                {selectedAttempt?.correctCount}/{selectedAttempt?.totalQuestions}{' '}
                Correct
              </Text>
            </View>
            <TouchableOpacity
              style={styles.modalCloseBtn}
              onPress={() => setModalVisible(false)}
            >
              <X size={24} color={isGlass ? '#0f172a' : '#94a3b8'} />
            </TouchableOpacity>
          </View>

          {modalLoading ? (
            <View style={styles.modalCenterContainer}>
              <ActivityIndicator size="large" color="#6366f1" />
              <Text style={[styles.modalLoadingText, isGlass && { color: '#64748b' }]}>
                Loading question breakdown...
              </Text>
            </View>
          ) : (
            <FlatList
              data={selectedAttempt?.questionBreakdown || []}
              keyExtractor={(_, idx) => `review_q_${idx}`}
              contentContainerStyle={styles.modalContent}
              initialNumToRender={6}
              maxToRenderPerBatch={6}
              windowSize={5}
              removeClippedSubviews={Platform.OS === 'android'}
              renderItem={renderReviewQuestionItem}
            />
          )}
        </SafeAreaView>
      </Modal>

      {/* AI Chat Modal */}
      <AiChatModal
        visible={chatModalVisible}
        questionContext={activeQuestionForChat}
        onClose={() => setChatModalVisible(false)}
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
    paddingHorizontal: 10,
    paddingVertical: 12,
    backgroundColor: '#1e293b',
    borderBottomWidth: 1,
    borderBottomColor: '#334155',
  },
  backBtn: {
    padding: 4,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#f8fafc',
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 20,
  },
  emptyTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#cbd5e1',
    marginTop: 15,
  },
  emptySubtitle: {
    fontSize: 14,
    color: '#64748b',
    textAlign: 'center',
    marginTop: 6,
    lineHeight: 20,
  },
  listPadding: {
    paddingHorizontal: 6,
    paddingTop: 8,
    paddingBottom: 30,
  },
  card: {
    backgroundColor: '#1e293b',
    borderRadius: 12,
    padding: 10,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: '#334155',
  },
  skeletonCard: {
    backgroundColor: '#1e293b',
    borderColor: '#334155',
  },
  skeletonBadge: {
    width: 65,
    height: 22,
    borderRadius: 6,
    backgroundColor: '#334155',
  },
  skeletonDate: {
    width: 110,
    height: 14,
    borderRadius: 4,
    backgroundColor: '#334155',
  },
  skeletonTitle: {
    width: '80%',
    height: 18,
    borderRadius: 4,
    backgroundColor: '#334155',
    marginBottom: 8,
    marginTop: 4,
  },
  skeletonSubject: {
    width: '45%',
    height: 13,
    borderRadius: 4,
    backgroundColor: '#334155',
    marginBottom: 10,
  },
  skeletonChip: {
    width: 100,
    height: 24,
    borderRadius: 6,
    backgroundColor: '#334155',
    marginRight: 6,
  },
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 6,
  },
  badge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
    borderWidth: 1,
  },
  badgeText: {
    fontSize: 11.5,
    fontWeight: '800',
    marginLeft: 4,
  },
  dateRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  dateText: {
    fontSize: 11,
    color: '#64748b',
    fontWeight: '500',
  },
  quizTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: '#f8fafc',
    marginBottom: 2,
  },
  subjectText: {
    fontSize: 11.5,
    color: '#94a3b8',
    marginBottom: 8,
  },
  statsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  statChip: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#0f172a',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: '#334155',
  },
  statChipText: {
    fontSize: 11.5,
    color: '#cbd5e1',
    fontWeight: '600',
    marginLeft: 4,
  },
  deleteBtn: {
    padding: 5,
    backgroundColor: 'rgba(239, 68, 68, 0.12)',
    borderRadius: 6,
    borderWidth: 1,
    borderColor: 'rgba(239, 68, 68, 0.3)',
  },
  footerLoader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 16,
    gap: 8,
  },
  footerLoaderText: {
    fontSize: 12.5,
    fontWeight: '600',
    color: '#818cf8',
  },
  endHistoryFooter: {
    alignItems: 'center',
    paddingVertical: 18,
  },
  endHistoryText: {
    fontSize: 11.5,
    fontWeight: '600',
    color: '#64748b',
  },
  modalContainer: {
    flex: 1,
    backgroundColor: '#0f172a',
  },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 10,
    paddingVertical: 10,
    backgroundColor: '#1e293b',
    borderBottomWidth: 1,
    borderBottomColor: '#334155',
  },
  modalTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#f8fafc',
  },
  modalSub: {
    fontSize: 11.5,
    color: '#94a3b8',
    marginTop: 2,
  },
  modalCloseBtn: {
    padding: 4,
  },
  modalCenterContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  modalLoadingText: {
    marginTop: 10,
    fontSize: 13.5,
    color: '#94a3b8',
    fontWeight: '500',
  },
  modalContent: {
    paddingHorizontal: 6,
    paddingVertical: 8,
    paddingBottom: 30,
  },
  reviewCard: {
    backgroundColor: '#1e293b',
    borderRadius: 12,
    padding: 10,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: '#334155',
  },
  reviewCardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
  },
  statusDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    marginRight: 6,
  },
  reviewQTitle: {
    fontSize: 14.5,
    fontWeight: '600',
    color: '#f8fafc',
    flex: 1,
    lineHeight: 20,
  },
  reviewOptionsList: {
    gap: 5,
    marginBottom: 8,
  },
  reviewOptionRow: {
    flexDirection: 'row',
    paddingHorizontal: 8,
    paddingVertical: 7,
    borderRadius: 6,
    backgroundColor: '#0f172a',
  },
  reviewOptionAnswer: {
    backgroundColor: 'rgba(16, 185, 129, 0.15)',
    borderWidth: 1,
    borderColor: '#10b981',
  },
  reviewOptionWrong: {
    backgroundColor: 'rgba(239, 68, 68, 0.15)',
    borderWidth: 1,
    borderColor: '#ef4444',
  },
  optLetter: {
    fontSize: 12.5,
    color: '#94a3b8',
    marginRight: 6,
  },
  optText: {
    fontSize: 12.5,
    color: '#cbd5e1',
    flex: 1,
  },
  expBox: {
    marginTop: 6,
    padding: 8,
    borderRadius: 6,
    backgroundColor: 'rgba(129, 140, 248, 0.1)',
  },
  expTitle: {
    fontSize: 11.5,
    fontWeight: '700',
    color: '#818cf8',
    marginBottom: 2,
  },
  aiExpBox: {
    marginTop: 10,
    padding: 12,
    borderRadius: 12,
    backgroundColor: '#1e1b4b',
    borderWidth: 1.5,
    borderColor: 'rgba(168, 85, 247, 0.4)',
    shadowColor: '#a855f7',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 6,
    elevation: 4,
  },
  aiExpHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(168, 85, 247, 0.25)',
    paddingBottom: 6,
  },
  aiBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#6366f1',
    paddingHorizontal: 7,
    paddingVertical: 3,
    borderRadius: 6,
    marginRight: 8,
  },
  aiBadgeText: {
    fontSize: 9.5,
    fontWeight: '800',
    color: '#ffffff',
    marginLeft: 4,
    letterSpacing: 0.5,
  },
  aiExpTitle: {
    fontSize: 12.5,
    fontWeight: '700',
    color: '#c084fc',
  },
  aiBtnRow: {
    flexDirection: 'row',
    gap: 6,
    marginTop: 8,
  },
  aiExplainBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(168, 85, 247, 0.15)',
    paddingVertical: 8,
    paddingHorizontal: 4,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#a855f7',
  },
  aiExplainBtnText: {
    color: '#c084fc',
    fontSize: 11,
    fontWeight: '700',
    marginLeft: 4,
  },
  aiChatBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#6366f1',
    paddingVertical: 8,
    paddingHorizontal: 4,
    borderRadius: 8,
  },
  aiChatBtnText: {
    color: '#ffffff',
    fontSize: 11,
    fontWeight: '700',
    marginLeft: 4,
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
  cardGlass: {
    backgroundColor: '#ffffff',
    borderColor: '#e2e8f0',
    shadowColor: '#64748b',
    shadowOpacity: 0.06,
    shadowRadius: 8,
    elevation: 2,
  },
  statChipGlass: {
    backgroundColor: '#f8fafc',
    borderColor: '#e2e8f0',
  },
  modalContainerGlass: {
    backgroundColor: '#f2f2f7',
  },
  modalHeaderGlass: {
    backgroundColor: '#ffffff',
    borderBottomColor: '#e2e8f0',
    shadowColor: '#64748b',
    shadowOpacity: 0.05,
    shadowRadius: 6,
    elevation: 2,
  },
  reviewCardGlass: {
    backgroundColor: '#ffffff',
    borderColor: '#e2e8f0',
    shadowColor: '#64748b',
    shadowOpacity: 0.06,
    shadowRadius: 8,
    elevation: 2,
  },
  reviewOptionRowGlass: {
    backgroundColor: '#f8fafc',
    borderWidth: 1,
    borderColor: '#e2e8f0',
  },
  expBoxGlass: {
    backgroundColor: '#f8fafc',
    borderWidth: 1,
    borderColor: '#e2e8f0',
  },
  aiExpBoxGlass: {
    backgroundColor: '#faf5ff',
    borderColor: 'rgba(168, 85, 247, 0.3)',
    shadowColor: '#a855f7',
    shadowOpacity: 0.1,
    shadowRadius: 6,
    elevation: 2,
  },
  aiExplainBtnGlass: {
    backgroundColor: 'rgba(168, 85, 247, 0.1)',
    borderColor: '#a855f7',
  },
});

export default memo(HistoryScreen);
