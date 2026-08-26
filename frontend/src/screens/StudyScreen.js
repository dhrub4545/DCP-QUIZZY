import React, { useState, useEffect, useCallback, useRef, memo } from 'react';
import { useFocusEffect } from '@react-navigation/native';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  TextInput,
  RefreshControl,
  StatusBar,
  Platform,
  BackHandler,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import {
  GraduationCap,
  BookOpen,
  FolderKanban,
  Search,
  Sparkles,
  Lightbulb,
  MessageSquare,
  ChevronDown,
  ChevronUp,
  ArrowLeft,
  Check,
  X,
  FileText,
  Layers,
  ChevronRight,
  Eye,
  EyeOff,
  Bookmark,
  Shield,
} from 'lucide-react-native';
import { fetchQuizzes, fetchQuizById, fetchQuizChunkApi, fetchAiExplanationApi, fetchQuestionsByTopicApi } from '../services/api';
import { saveStudyProgress, getStudyProgress, getAllStudyProgress } from '../services/storage';
import MarkdownRenderer from '../components/MarkdownRenderer';
import ZoomableImageCard from '../components/ZoomableImageCard';
import AiChatModal from '../components/AiChatModal';
import BottomTabBar from '../components/BottomTabBar';

// Persistent in-memory caches to make opening books and topics instant (0ms)
const globalQuizCache = new Map();
const globalTopicCache = new Map();

const optionLabels = ['A', 'B', 'C', 'D', 'E', 'F'];

// Helper to determine correct option index reliably
const getCorrectOptionIndex = (item) => {
  if (
    item.correctOptionIndex !== undefined &&
    item.correctOptionIndex !== null &&
    typeof item.correctOptionIndex === 'number' &&
    item.correctOptionIndex >= 0
  ) {
    return item.correctOptionIndex;
  }
  if (item.correctAnswerLetter) {
    const letter = String(item.correctAnswerLetter).trim().toUpperCase();
    const idx = optionLabels.indexOf(letter);
    if (idx !== -1) return idx;
  }
  return 0;
};

// Memoized Question Card Component with Answers Toggle & Interactive Choice Feedback
const PdfQuestionCard = memo(({
  item,
  index,
  isExpanded,
  onToggleExpand,
  showAnswers,
  userChoice,
  onSelectOption,
  aiExplanation,
  isLoadingAi,
  onGenerateAiExplanation,
  onOpenAiChat,
}) => {
  // Ultra-fast lightweight skeleton placeholder for lazy-loaded items
  if (item.placeholder) {
    return (
      <View style={[styles.pdfQCard, { opacity: 0.85, paddingVertical: 12 }]}>
        <View style={styles.pdfQHeader}>
          <View style={styles.pdfQNumBadge}>
            <Text style={styles.pdfQNumText}>Question {index + 1}</Text>
          </View>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
            <ActivityIndicator size="small" color="#6366f1" />
            <Text style={{ fontSize: 11.5, color: '#94a3b8', fontWeight: '500' }}>Loading MCQ...</Text>
          </View>
        </View>
      </View>
    );
  }

  const correctOptIdx = getCorrectOptionIndex(item);
  const questionPicUrl = item.questionImage || item.questionpic || item.questionPic || item.image || item.question_image;
  const explanationPicUrl = item.cloudanary_link || item.cloudinary_link || item.explanationPic || item.explanationImage || item.explanation_pic;
  const displayNumber = item.questionNumber || (item.globalIndex !== undefined ? item.globalIndex + 1 : index + 1);

  return (
    <View style={styles.pdfQCard}>
      {/* Question Top Bar */}
      <TouchableOpacity
        style={styles.pdfQHeader}
        onPress={() => onToggleExpand(index)}
        activeOpacity={0.8}
      >
        <View style={styles.pdfQNumBadge}>
          <Text style={styles.pdfQNumText}>Question {displayNumber}</Text>
        </View>

        {item.topic ? (
          <Text style={styles.pdfTopicTag} numberOfLines={1}>
            {item.topic}
          </Text>
        ) : null}

        {isExpanded ? (
          <ChevronUp size={18} color="#64748b" />
        ) : (
          <ChevronDown size={18} color="#64748b" />
        )}
      </TouchableOpacity>

      {isExpanded && (
        <View style={styles.pdfQBody}>
          <Text style={styles.pdfQuestionText}>{item.questionText}</Text>

          {/* Question Image (displayed below question and before options) */}
          {questionPicUrl ? (
            <ZoomableImageCard
              uri={questionPicUrl}
              caption={`Question ${displayNumber} Diagram`}
              theme="light"
              style={{ marginTop: 8, marginBottom: 12 }}
            />
          ) : null}

          {/* Options List */}
          <View style={styles.pdfOptionsList}>
            {(item.options || []).map((optText, optIdx) => {
              const isAnswer = optIdx === correctOptIdx;
              const isUserChoice = userChoice === optIdx;
              const hasAnswered = userChoice !== undefined && userChoice !== null;

              let rowStyle = styles.pdfOptionRow;
              let letterStyle = styles.pdfOptionLetter;
              let textStyle = styles.pdfOptionText;
              let badgeComponent = null;

              if (showAnswers) {
                // Answers ON mode: Always reveal correct answer
                if (isAnswer) {
                  rowStyle = [styles.pdfOptionRow, styles.pdfOptionCorrectRow];
                  letterStyle = [styles.pdfOptionLetter, styles.pdfOptionCorrectLetter];
                  textStyle = [styles.pdfOptionText, styles.pdfOptionCorrectText];
                  badgeComponent = (
                    <View style={styles.pdfCorrectBadge}>
                      <Check size={13} color="#059669" />
                      <Text style={styles.pdfCorrectBadgeText}>Answer</Text>
                    </View>
                  );
                }
              } else {
                // Answers OFF mode: Hide answer until user taps an option
                if (hasAnswered) {
                  if (isUserChoice && isAnswer) {
                    rowStyle = [styles.pdfOptionRow, styles.pdfOptionCorrectRow];
                    letterStyle = [styles.pdfOptionLetter, styles.pdfOptionCorrectLetter];
                    textStyle = [styles.pdfOptionText, styles.pdfOptionCorrectText];
                    badgeComponent = (
                      <View style={styles.pdfCorrectBadge}>
                        <Check size={13} color="#059669" />
                        <Text style={styles.pdfCorrectBadgeText}>Correct!</Text>
                      </View>
                    );
                  } else if (isUserChoice && !isAnswer) {
                    rowStyle = [styles.pdfOptionRow, styles.pdfOptionWrongRow];
                    letterStyle = [styles.pdfOptionLetter, styles.pdfOptionWrongLetter];
                    textStyle = [styles.pdfOptionText, styles.pdfOptionWrongText];
                    badgeComponent = (
                      <View style={styles.pdfWrongBadge}>
                        <X size={13} color="#dc2626" />
                        <Text style={styles.pdfWrongBadgeText}>Your Choice</Text>
                      </View>
                    );
                  } else if (isAnswer) {
                    rowStyle = [styles.pdfOptionRow, styles.pdfOptionCorrectRow];
                    letterStyle = [styles.pdfOptionLetter, styles.pdfOptionCorrectLetter];
                    textStyle = [styles.pdfOptionText, styles.pdfOptionCorrectText];
                    badgeComponent = (
                      <View style={styles.pdfCorrectBadge}>
                        <Check size={13} color="#059669" />
                        <Text style={styles.pdfCorrectBadgeText}>Correct Answer</Text>
                      </View>
                    );
                  }
                }
              }

              return (
                <TouchableOpacity
                  key={optIdx}
                  style={rowStyle}
                  activeOpacity={0.7}
                  onPress={() => onSelectOption(index, optIdx)}
                >
                  <Text style={letterStyle}>{optionLabels[optIdx]}.</Text>
                  <Text style={textStyle}>{optText}</Text>
                  {badgeComponent}
                </TouchableOpacity>
              );
            })}
          </View>

          {/* Printed Explanation (Revealed if showAnswers is true OR if user has answered) */}
          {item.explanation && (showAnswers || userChoice !== undefined) ? (
            <View style={styles.pdfExpBox}>
              <Text style={styles.pdfExpTitle}>Printed Explanation:</Text>
              <MarkdownRenderer
                content={item.explanation}
                explanationImage={explanationPicUrl}
                theme="light"
              />
            </View>
          ) : null}

          {/* AI Generated Explanation Box */}
          {aiExplanation ? (
            <View style={styles.pdfAiExpBox}>
              <View style={styles.pdfAiExpHeader}>
                <View style={styles.pdfAiBadge}>
                  <Sparkles size={11} color="#ffffff" />
                  <Text style={styles.pdfAiBadgeText}>GEMINI 3.6 FLASH AI</Text>
                </View>
                <Text style={styles.pdfAiExpTitle}>In-Depth Explanation</Text>
              </View>
              <MarkdownRenderer content={aiExplanation} theme="light" />
            </View>
          ) : null}

          {/* AI Buttons Row */}
          <View style={styles.pdfAiBtnRow}>
            <TouchableOpacity
              style={styles.pdfAiExplainBtn}
              onPress={() => onGenerateAiExplanation(item, index)}
              disabled={isLoadingAi}
            >
              {isLoadingAi ? (
                <ActivityIndicator size="small" color="#7c3aed" />
              ) : (
                <>
                  <Lightbulb size={15} color="#7c3aed" />
                  <Text style={styles.pdfAiExplainBtnText}>
                    {aiExplanation
                      ? 'Regenerate AI Explanation'
                      : 'Generate AI Explanation'}
                  </Text>
                </>
              )}
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.pdfAiChatBtn}
              onPress={() => onOpenAiChat(item)}
            >
              <MessageSquare size={15} color="#ffffff" />
              <Text style={styles.pdfAiChatBtnText}>Chat with AI Tutor</Text>
            </TouchableOpacity>
          </View>
        </View>
      )}
    </View>
  );
}, (prev, next) => {
  return (
    prev.index === next.index &&
    prev.isExpanded === next.isExpanded &&
    prev.showAnswers === next.showAnswers &&
    prev.userChoice === next.userChoice &&
    prev.aiExplanation === next.aiExplanation &&
    prev.isLoadingAi === next.isLoadingAi &&
    (prev.item?._id || prev.item?.questionNumber) === (next.item?._id || next.item?.questionNumber)
  );
});


export default function StudyScreen({ navigation, route }) {
  // Directory Quizzes Metadata
  const [quizzes, setQuizzes] = useState([]);
  const [quizCache, setQuizCache] = useState({});
  const [studyProgressMap, setStudyProgressMap] = useState({});
  
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [loadingCardId, setLoadingCardId] = useState(null);

  // Folder Wise Navigation State: 'all' | 'nmcle' | 'book' | 'topic' | 'custom'
  const [selectedFolder, setSelectedFolder] = useState('all');
  const [searchQuery, setSearchQuery] = useState('');
  
  // Card-level Answer Key Toggle states (cardId -> boolean)
  const [cardShowAnswers, setCardShowAnswers] = useState({});
  
  // Active Reader Mode State
  const [readerItem, setReaderItem] = useState(null);
  const [readerShowAnswers, setReaderShowAnswers] = useState(false);
  const [userChoices, setUserChoices] = useState({});
  
  // Bookmark & Navigation Index
  const [initialBookmarkIndex, setInitialBookmarkIndex] = useState(0);
  const [lastViewedIndex, setLastViewedIndex] = useState(0);
  
  const [expandedIndices, setExpandedIndices] = useState({});

  // AI Explanation & Chat states
  const [aiExplanations, setAiExplanations] = useState({});
  const [loadingAiIdx, setLoadingAiIdx] = useState(null);

  // AI Chat Modal state
  const [chatModalVisible, setChatModalVisible] = useState(false);
  const [activeQuestionForChat, setActiveQuestionForChat] = useState(null);

  const flatListRef = useRef(null);
  const readerItemRef = useRef(null);
  const userChoicesRef = useRef({});
  const readerShowAnswersRef = useRef(false);

  const studyStateRef = useRef({
    chatModalVisible,
    readerItem,
    selectedFolder,
    searchQuery,
    lastViewedIndex,
    userChoices,
    readerShowAnswers,
  });

  studyStateRef.current = {
    chatModalVisible,
    readerItem,
    selectedFolder,
    searchQuery,
    lastViewedIndex,
    userChoices,
    readerShowAnswers,
  };

  useEffect(() => {
    readerItemRef.current = readerItem;
  }, [readerItem]);

  useEffect(() => {
    userChoicesRef.current = userChoices;
  }, [userChoices]);

  useEffect(() => {
    readerShowAnswersRef.current = readerShowAnswers;
  }, [readerShowAnswers]);

  // Load Directory & Stored Bookmarks
  const loadDirectoryData = async (showSpinner = false) => {
    try {
      if (showSpinner || quizzes.length === 0) {
        setLoading(true);
      }
      const [quizData, storedProgress] = await Promise.all([
        fetchQuizzes(),
        getAllStudyProgress(),
      ]);

      if (quizData && quizData.quizzes) {
        setQuizzes(quizData.quizzes);
      } else {
        setQuizzes([]);
      }

      if (storedProgress) {
        setStudyProgressMap(storedProgress);
      }
    } catch (err) {
      console.warn('Error loading study directory:', err.message);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useFocusEffect(
    useCallback(() => {
      loadDirectoryData(quizzes.length === 0);
    }, [])
  );

  const handleRefresh = () => {
    setRefreshing(true);
    loadDirectoryData();
  };

  const handleTabPress = (tabName) => {
    if (tabName === 'Home') {
      navigation.navigate('Home');
    } else if (tabName === 'Quizzes') {
      navigation.navigate('Quizzes');
    } else if (tabName === 'History') {
      navigation.navigate('History');
    } else if (tabName === 'Profile') {
      navigation.navigate('Profile');
    }
  };

  const toggleCardAnswers = (cardId) => {
    setCardShowAnswers((prev) => ({
      ...prev,
      [cardId]: !prev[cardId],
    }));
  };

  const [isLoadingPrev, setIsLoadingPrev] = useState(false);
  const [isLoadingNext, setIsLoadingNext] = useState(false);
  const isLoadingPrevRef = useRef(false);
  const isLoadingNextRef = useRef(false);
  const hasLoadedInCurrentPullRef = useRef(false);

  // Save Progress to AsyncStorage
  const persistProgress = useCallback((item, lastIdx, choices, isAnswersOn) => {
    if (!item || !item.id) return;
    const total = item.totalCount || item.allQuestions?.length || 0;
    saveStudyProgress(item.id, {
      lastIndex: lastIdx,
      totalCount: total,
      userChoices: choices,
      showAnswers: isAnswersOn,
    });
    // Update local state map for directory badge UI
    setStudyProgressMap((prev) => ({
      ...prev,
      [item.id]: {
        lastIndex: lastIdx,
        totalCount: total,
        userChoices: choices,
        showAnswers: isAnswersOn,
      },
    }));
  }, []);

  // Automatic Load Previous MCQs on Scroll Up (Loads strictly 1 batch per pull gesture)
  const loadMorePrev = useCallback(async () => {
    const currentItem = readerItemRef.current;
    if (!currentItem || isLoadingPrevRef.current || currentItem.startIndex <= 0) return;

    try {
      isLoadingPrevRef.current = true;
      setIsLoadingPrev(true);
      const batchSize = 20;
      const prevOffset = Math.max(0, currentItem.startIndex - batchSize);
      const prevLimit = currentItem.startIndex - prevOffset;

      if (prevLimit <= 0) {
        isLoadingPrevRef.current = false;
        setIsLoadingPrev(false);
        return;
      }

      if (currentItem.type === 'topic') {
        const allTopicQs = globalTopicCache.get(currentItem.title.trim().toLowerCase()) || [];
        const slice = allTopicQs.slice(prevOffset, currentItem.startIndex).map((q, idx) => ({
          ...q,
          globalIndex: prevOffset + idx,
          questionNumber: prevOffset + idx + 1,
          quizTitle: currentItem.title,
          quizSubject: currentItem.subject || 'General',
        }));
        setReaderItem((prev) => {
          if (!prev) return null;
          return {
            ...prev,
            startIndex: prevOffset,
            allQuestions: [...slice, ...prev.allQuestions],
          };
        });
      } else {
        const chunkRes = await fetchQuizChunkApi(currentItem.id, prevOffset, prevLimit).catch(() => null);
        if (chunkRes && chunkRes.quiz && Array.isArray(chunkRes.quiz.questions)) {
          const slice = chunkRes.quiz.questions.map((q, idx) => ({
            ...q,
            globalIndex: prevOffset + idx,
            questionNumber: prevOffset + idx + 1,
            quizTitle: currentItem.title,
            quizSubject: currentItem.subject || 'General',
          }));
          setReaderItem((prev) => {
            if (!prev) return null;
            return {
              ...prev,
              startIndex: prevOffset,
              allQuestions: [...slice, ...prev.allQuestions],
            };
          });
        }
      }
    } catch (err) {
      console.error('Error auto-loading previous questions:', err.message);
    } finally {
      setTimeout(() => {
        isLoadingPrevRef.current = false;
        setIsLoadingPrev(false);
      }, 350);
    }
  }, []);

  // Automatic Load Next MCQs on Scroll Down (Bottom Space Auto Expansion)
  const loadMoreNext = useCallback(async () => {
    const currentItem = readerItemRef.current;
    const total = currentItem?.totalCount || currentItem?.allQuestions?.length || 0;
    if (!currentItem || isLoadingNextRef.current || currentItem.endIndex >= total - 1) return;

    try {
      isLoadingNextRef.current = true;
      setIsLoadingNext(true);
      const batchSize = 20;
      const nextOffset = currentItem.endIndex + 1;
      const nextLimit = Math.min(batchSize, total - nextOffset);

      if (nextLimit <= 0) {
        isLoadingNextRef.current = false;
        setIsLoadingNext(false);
        return;
      }

      if (currentItem.type === 'topic') {
        const allTopicQs = globalTopicCache.get(currentItem.title.trim().toLowerCase()) || [];
        const slice = allTopicQs.slice(nextOffset, nextOffset + nextLimit).map((q, idx) => ({
          ...q,
          globalIndex: nextOffset + idx,
          questionNumber: nextOffset + idx + 1,
          quizTitle: currentItem.title,
          quizSubject: currentItem.subject || 'General',
        }));
        setReaderItem((prev) => {
          if (!prev) return null;
          return {
            ...prev,
            endIndex: nextOffset + slice.length - 1,
            allQuestions: [...prev.allQuestions, ...slice],
          };
        });
      } else {
        const chunkRes = await fetchQuizChunkApi(currentItem.id, nextOffset, nextLimit).catch(() => null);
        if (chunkRes && chunkRes.quiz && Array.isArray(chunkRes.quiz.questions)) {
          const slice = chunkRes.quiz.questions.map((q, idx) => ({
            ...q,
            globalIndex: nextOffset + idx,
            questionNumber: nextOffset + idx + 1,
            quizTitle: currentItem.title,
            quizSubject: currentItem.subject || 'General',
          }));
          setReaderItem((prev) => {
            if (!prev) return null;
            return {
              ...prev,
              endIndex: nextOffset + slice.length - 1,
              allQuestions: [...prev.allQuestions, ...slice],
            };
          });
        }
      }
    } catch (err) {
      console.error('Error auto-loading next questions:', err.message);
    } finally {
      setTimeout(() => {
        isLoadingNextRef.current = false;
        setIsLoadingNext(false);
      }, 350);
    }
  }, []);

  // Single-pull trigger: each distinct pull at the top loads strictly ONE previous batch
  const handleScroll = useCallback((event) => {
    const offsetY = event.nativeEvent.contentOffset.y;
    if (offsetY <= 0 && !hasLoadedInCurrentPullRef.current && !isLoadingPrevRef.current) {
      const currentItem = readerItemRef.current;
      if (currentItem && currentItem.startIndex > 0) {
        hasLoadedInCurrentPullRef.current = true; // Consumes the 1-batch permit for this pull
        loadMorePrev();
      }
    }
  }, [loadMorePrev]);

  const handleScrollBeginDrag = useCallback(() => {
    hasLoadedInCurrentPullRef.current = false; // Reset permit when user initiates a new touch drag
  }, []);

  const handleMomentumScrollEnd = useCallback(() => {
    hasLoadedInCurrentPullRef.current = false;
  }, []);

  // Open Book with instant windowed lazy loading directly from the marked question position
  const handleOpenBook = async (quizSummary) => {
    try {
      setLoadingCardId(quizSummary._id);

      const savedProgress = await getStudyProgress(quizSummary._id);
      const bookmarkIndex = Number(savedProgress?.lastIndex || 0); // 0-based index
      const savedChoices = savedProgress?.userChoices || {};
      const isShow = cardShowAnswers[quizSummary._id] ?? (savedProgress?.showAnswers || false);
      const isNmcle = (quizSummary.title || '').toUpperCase().includes('NMCLE') || ((quizSummary.subject || '').toUpperCase().includes('NMCLE'));

      const totalCount = quizSummary.questionCount || 180;
      const initialLimit = 20;
      // Start window directly at the marked question index
      const initialOffset = Math.max(0, Math.min(bookmarkIndex, Math.max(0, totalCount - 1)));

      // Fast initial slice fetch (~40ms) - Only fetching the active window
      const chunkRes = await fetchQuizChunkApi(quizSummary._id, initialOffset, initialLimit).catch(() => null);

      let initialQuestions = [];
      if (chunkRes && chunkRes.quiz && Array.isArray(chunkRes.quiz.questions)) {
        initialQuestions = chunkRes.quiz.questions.map((q, idx) => ({
          ...q,
          globalIndex: initialOffset + idx,
          questionNumber: initialOffset + idx + 1,
          quizTitle: quizSummary.title,
          quizSubject: quizSummary.subject || 'General',
        }));
      }

      isInitialMountRef.current = true;
      targetScrollIndexRef.current = 0;
      lastViewedIndexRef.current = bookmarkIndex;
      setInitialBookmarkIndex(bookmarkIndex);
      setLastViewedIndex(bookmarkIndex);
      setReaderShowAnswers(isShow);
      setUserChoices(savedChoices);
      setExpandedIndices({});

      const itemObj = {
        id: quizSummary._id,
        title: quizSummary.title,
        subject: quizSummary.subject || 'General',
        type: isNmcle ? 'nmcle' : 'book',
        folderType: isNmcle ? 'nmcle' : 'book',
        totalCount: totalCount,
        startIndex: initialOffset,
        endIndex: initialOffset + Math.max(0, initialQuestions.length - 1),
        allQuestions: initialQuestions,
      };

      // Open Reader Screen IMMEDIATELY (< 60ms total response time!)
      setReaderItem(itemObj);
      persistProgress(itemObj, bookmarkIndex, savedChoices, isShow);
      setLoadingCardId(null);

      setTimeout(() => {
        isInitialMountRef.current = false;
      }, 1000);
    } catch (err) {
      console.error('Error in instant lazy loader:', err.message);
      setLoadingCardId(null);
    }
  };

  // Open Topic with direct initial window from marked position
  const handleOpenTopic = async (topicCard) => {
    const topicName = topicCard.title;
    const targetClean = topicName.trim().toLowerCase();

    try {
      setLoadingCardId(topicCard.id);

      // 1. Check persistent global topic cache (0ms instant)
      let topicQuestions = globalTopicCache.get(targetClean);

      // 2. Fetch directly from optimized single-request backend endpoint
      if (!topicQuestions || topicQuestions.length === 0) {
        try {
          const res = await fetchQuestionsByTopicApi(topicName);
          if (res && Array.isArray(res.questions) && res.questions.length > 0) {
            topicQuestions = res.questions;
            globalTopicCache.set(targetClean, topicQuestions);
          }
        } catch (apiErr) {
          console.warn('Direct topic API fallback:', apiErr.message);
        }
      }

      // 3. Fallback: scan already cached full quizzes in memory
      if (!topicQuestions || topicQuestions.length === 0) {
        topicQuestions = [];
        for (const [quizId, quiz] of globalQuizCache.entries()) {
          (quiz.questions || []).forEach((q) => {
            const qTopic = (q.topic || '').trim().toLowerCase();
            const qSubject = (quiz.subject || '').trim().toLowerCase();

            if (
              qTopic === targetClean ||
              qTopic.includes(targetClean) ||
              targetClean.includes(qTopic && qTopic !== 'general' ? qTopic : 'xyz_none') ||
              (qTopic === '' && qSubject === targetClean)
            ) {
              topicQuestions.push({
                ...q,
                quizTitle: quiz.title,
                quizSubject: quiz.subject || 'General',
              });
            }
          });
        }
      }

      const totalCount = topicQuestions.length;
      const savedProgress = await getStudyProgress(topicCard.id);
      const bookmarkIndex = Number(savedProgress?.lastIndex || 0);
      const savedChoices = savedProgress?.userChoices || {};
      const isShow = cardShowAnswers[topicCard.id] ?? (savedProgress?.showAnswers || false);

      const initialOffset = Math.max(0, Math.min(bookmarkIndex, Math.max(0, totalCount - 1)));
      const initialLimit = 20;
      const slice = topicQuestions.slice(initialOffset, initialOffset + initialLimit).map((q, idx) => ({
        ...q,
        globalIndex: initialOffset + idx,
        questionNumber: initialOffset + idx + 1,
        quizTitle: topicName,
        quizSubject: 'Topic Module',
      }));

      isInitialMountRef.current = true;
      targetScrollIndexRef.current = 0;
      lastViewedIndexRef.current = bookmarkIndex;
      setInitialBookmarkIndex(bookmarkIndex);
      setLastViewedIndex(bookmarkIndex);
      setReaderShowAnswers(isShow);
      setUserChoices(savedChoices);
      setExpandedIndices({});

      const itemObj = {
        id: topicCard.id,
        title: topicName,
        subject: 'Topic Module',
        type: 'topic',
        folderType: 'topic',
        totalCount: totalCount,
        startIndex: initialOffset,
        endIndex: initialOffset + Math.max(0, slice.length - 1),
        allQuestions: slice,
      };

      setReaderItem(itemObj);
      persistProgress(itemObj, bookmarkIndex, savedChoices, isShow);
      setLoadingCardId(null);

      setTimeout(() => {
        isInitialMountRef.current = false;
      }, 1000);
    } catch (err) {
      console.error('Error loading topic lazily:', err.message);
      setLoadingCardId(null);
    }
  };

  const isInitialMountRef = useRef(true);

  const lastViewedIndexRef = useRef(-1);

  const handleCloseReader = useCallback(() => {
    const currentReader = studyStateRef.current.readerItem;
    if (currentReader) {
      const currentIdx =
        lastViewedIndexRef.current >= 0
          ? lastViewedIndexRef.current
          : (studyStateRef.current.lastViewedIndex || 0);
      persistProgress(
        currentReader,
        currentIdx,
        studyStateRef.current.userChoices || {},
        studyStateRef.current.readerShowAnswers || false
      );
    }
    studyStateRef.current.readerItem = null;
    setReaderItem(null);
  }, [persistProgress]);

  // Handle Android System Back Button cleanly without leaving StudyScreen unexpectedly
  useFocusEffect(
    useCallback(() => {
      const onBackPress = () => {
        const {
          chatModalVisible: isChat,
          readerItem: activeReader,
          selectedFolder: activeFolder,
          searchQuery: activeSearch,
        } = studyStateRef.current;

        if (isChat) {
          setChatModalVisible(false);
          return true;
        }
        if (activeReader) {
          handleCloseReader();
          return true;
        }
        if (activeFolder !== 'all') {
          setSelectedFolder('all');
          return true;
        }
        if (activeSearch && activeSearch.trim()) {
          setSearchQuery('');
          return true;
        }
        return false; // Allow system back only when at top-level
      };

      const subscription = BackHandler.addEventListener('hardwareBackPress', onBackPress);
      return () => subscription.remove();
    }, [handleCloseReader])
  );

  // Smooth Viewport Location Tracker (Tracks actual global question index)
  const onViewableItemsChanged = useRef(({ viewableItems }) => {
    if (isInitialMountRef.current) return;
    if (viewableItems && viewableItems.length > 0) {
      const topItem = viewableItems[0];
      if (topItem && topItem.item) {
        const globalIdx =
          topItem.item.globalIndex !== undefined
            ? topItem.item.globalIndex
            : topItem.index;
        if (globalIdx !== undefined && globalIdx !== null) {
          lastViewedIndexRef.current = globalIdx;
          setLastViewedIndex(globalIdx);
        }
      }
    }
  }).current;

  const viewabilityConfig = useRef({
    itemVisiblePercentThreshold: 10,
    minimumViewTime: 50,
  }).current;

  const targetScrollIndexRef = useRef(0);
  const hasScrolledToBookmarkRef = useRef(false);

  // Progressive scroll engine to reliably jump to bookmarked question without invariant errors
  const scrollToTargetQuestion = useCallback((targetIndex) => {
    if (!flatListRef.current || targetIndex <= 0) return;
    try {
      flatListRef.current.scrollToIndex({
        index: targetIndex,
        animated: false,
        viewPosition: 0,
      });
    } catch (err) {
      // Gracefully handed over to handleScrollToIndexFailed
    }
  }, []);

  const handleFlatListLayout = useCallback(() => {
    if (targetScrollIndexRef.current > 0 && flatListRef.current) {
      setTimeout(() => {
        try {
          flatListRef.current?.scrollToIndex({
            index: targetScrollIndexRef.current,
            animated: false,
            viewPosition: 0,
          });
        } catch (e) {
          // Handled gracefully by onScrollToIndexFailed
        }
      }, 60);
    }
  }, []);

  useEffect(() => {
    if (readerItem) {
      const targetIndex = targetScrollIndexRef.current;
      if (targetIndex > 0 && !hasScrolledToBookmarkRef.current) {
        const timer = setTimeout(() => {
          if (!hasScrolledToBookmarkRef.current && flatListRef.current) {
            hasScrolledToBookmarkRef.current = true;
            scrollToTargetQuestion(targetIndex);
          }
        }, 120);

        return () => clearTimeout(timer);
      }
    } else {
      hasScrolledToBookmarkRef.current = false;
    }
  }, [readerItem?.id, scrollToTargetQuestion]);

  const handleScrollToIndexFailed = useCallback((info) => {
    setTimeout(() => {
      if (flatListRef.current) {
        try {
          flatListRef.current?.scrollToIndex({
            index: info.index,
            animated: false,
            viewPosition: 0,
          });
        } catch (err) {
          // Target reached by estimated offset
        }
      }
    }, 80);
  }, []);

  // Classification Helpers
  const isNmcleQuiz = (q) => {
    const t = (q.title || '').toUpperCase();
    const s = (q.subject || '').toUpperCase();
    return t.includes('NMCLE') || s.includes('NMCLE');
  };

  const isCustomQuiz = (q) => {
    return q.isCustom === true || q.creator === 'user';
  };

  const isBookQuiz = (q) => {
    return !isNmcleQuiz(q) && !isCustomQuiz(q);
  };

  // Build Directory Cards Lists per Folder
  const nmcleCards = quizzes.filter(isNmcleQuiz).map((quiz) => ({
    id: quiz._id,
    _id: quiz._id,
    title: quiz.title,
    subject: quiz.subject || 'NMCLE Exam Set',
    questionCount: quiz.questionCount || 0,
    folderType: 'nmcle',
  }));

  const bookCards = quizzes.filter(isBookQuiz).map((quiz) => ({
    id: quiz._id,
    _id: quiz._id,
    title: quiz.title,
    subject: quiz.subject || 'Medical Book',
    questionCount: quiz.questionCount || 0,
    folderType: 'book',
  }));

  const customCards = quizzes.filter(isCustomQuiz).map((quiz) => ({
    id: quiz._id,
    _id: quiz._id,
    title: quiz.title,
    subject: quiz.subject || 'Custom Quiz',
    questionCount: quiz.questionCount || 0,
    folderType: 'custom',
  }));

  // Build Topics Directory List
  const topicMap = {};
  quizzes.forEach((quiz) => {
    (quiz.topics || []).forEach((top) => {
      const trimmed = (top || 'General Topics').trim();
      if (!topicMap[trimmed]) {
        topicMap[trimmed] = 0;
      }
      topicMap[trimmed] += 1;
    });
  });

  const topicCards = Object.keys(topicMap).map((topicName, idx) => ({
    id: `topic_${idx}`,
    title: topicName,
    bookCount: topicMap[topicName],
    folderType: 'topic',
  }));

  const totalNmcleQuestions = nmcleCards.reduce((sum, c) => sum + (c.questionCount || 0), 0);
  const totalBookQuestions = bookCards.reduce((sum, c) => sum + (c.questionCount || 0), 0);

  // Determine active cards list based on selectedFolder
  let activeFolderCards = [];
  if (selectedFolder === 'nmcle') {
    activeFolderCards = nmcleCards;
  } else if (selectedFolder === 'book') {
    activeFolderCards = bookCards;
  } else if (selectedFolder === 'custom') {
    activeFolderCards = customCards;
  } else if (selectedFolder === 'topic') {
    activeFolderCards = topicCards;
  } else {
    // 'all' folder view
    activeFolderCards = [...nmcleCards, ...bookCards, ...customCards];
  }

  // Filter Cards by search query
  const filteredCards = activeFolderCards.filter((card) => {
    if (!searchQuery.trim()) return true;
    const query = searchQuery.toLowerCase();
    return (
      card.title.toLowerCase().includes(query) ||
      (card.subject && card.subject.toLowerCase().includes(query))
    );
  });

  const toggleExpand = useCallback((globalIdx) => {
    setExpandedIndices((prev) => ({
      ...prev,
      [globalIdx]: prev[globalIdx] === false ? true : false,
    }));
  }, []);

  const handleSelectOption = useCallback((qIndex, optIndex) => {
    setUserChoices((prev) => {
      const updated = { ...prev, [qIndex]: optIndex };
      if (readerItemRef.current) {
        const newMaxIdx = Math.max(lastViewedIndexRef.current >= 0 ? lastViewedIndexRef.current : 0, qIndex);
        setLastViewedIndex(newMaxIdx);
        persistProgress(readerItemRef.current, newMaxIdx, updated, readerShowAnswersRef.current);
      }
      return updated;
    });
  }, [persistProgress]);

  const handleGenerateAiExplanation = useCallback(async (item, globalIdx) => {
    if (aiExplanations[globalIdx]) return;
    try {
      setLoadingAiIdx(globalIdx);
      const correctOptIdx = getCorrectOptionIndex(item);
      const correctAnswerLetter =
        item.correctAnswerLetter || optionLabels[correctOptIdx] || 'A';

      const res = await fetchAiExplanationApi({
        questionText: item.questionText,
        options: item.options || [],
        correctAnswerLetter,
        explanation: item.explanation || '',
      });

      if (res && res.explanation) {
        setAiExplanations((prev) => ({
          ...prev,
          [globalIdx]: res.explanation,
        }));
      }
    } catch (err) {
      console.error('Error fetching AI explanation in Study mode:', err);
    } finally {
      setLoadingAiIdx(null);
    }
  }, [aiExplanations]);

  const handleOpenAiChat = useCallback((item) => {
    const correctOptIdx = getCorrectOptionIndex(item);
    const correctAnswerLetter =
      item.correctAnswerLetter || optionLabels[correctOptIdx] || 'A';

    setActiveQuestionForChat({
      questionText: item.questionText,
      options: item.options || [],
      correctAnswerLetter,
      userLetter: 'Study Mode',
      explanation: item.explanation || '',
    });
    setChatModalVisible(true);
  }, []);

  const questionKeyExtractor = useCallback((item, index) => {
    return item._id || (item.globalIndex !== undefined ? `pdf_q_${item.globalIndex}` : `pdf_q_${index}`);
  }, []);

  const renderQuestionItem = useCallback(({ item, index }) => {
    const globalIdx = item.globalIndex !== undefined ? item.globalIndex : index;
    return (
      <PdfQuestionCard
        item={item}
        index={globalIdx}
        isExpanded={expandedIndices[globalIdx] !== false}
        onToggleExpand={toggleExpand}
        showAnswers={readerShowAnswers}
        userChoice={userChoices[globalIdx]}
        onSelectOption={handleSelectOption}
        aiExplanation={aiExplanations[globalIdx]}
        isLoadingAi={loadingAiIdx === globalIdx}
        onGenerateAiExplanation={handleGenerateAiExplanation}
        onOpenAiChat={handleOpenAiChat}
      />
    );
  }, [
    expandedIndices,
    readerShowAnswers,
    userChoices,
    aiExplanations,
    loadingAiIdx,
    toggleExpand,
    handleSelectOption,
    handleGenerateAiExplanation,
    handleOpenAiChat,
  ]);

  // ----------------------------------------------------
  // FULL SCREEN READER VIEW (100% Native 60fps/120fps Smooth Scroll in Both Directions)
  // ----------------------------------------------------
  if (readerItem) {
    const readerTypeLabel =
      readerItem.type === 'topic'
        ? 'Topic Module'
        : readerItem.type === 'nmcle' || readerItem.folderType === 'nmcle'
        ? 'NMCLE Set'
        : 'Medical Book';

    const readerBannerBadgeLabel =
      readerItem.type === 'topic'
        ? 'TOPIC MODULE'
        : readerItem.type === 'nmcle' || readerItem.folderType === 'nmcle'
        ? 'NMCLE EXAM SET'
        : 'MEDICAL BOOK READER';

    const totalDocCount = readerItem.totalCount || readerItem.allQuestions.length;

    return (
      <SafeAreaView style={styles.pdfContainer}>
        <StatusBar barStyle="dark-content" backgroundColor="#ffffff" />
        
        {/* PDF Reader Top Navigation Bar */}
        <View style={styles.pdfHeader}>
          <TouchableOpacity
            style={styles.pdfBackBtn}
            onPress={handleCloseReader}
            activeOpacity={0.7}
          >
            <ArrowLeft size={18} color="#0f172a" />
            <Text style={styles.pdfBackText}>Back</Text>
          </TouchableOpacity>

          <View style={{ flex: 1, marginHorizontal: 8 }}>
            <Text style={styles.pdfHeaderTitle} numberOfLines={1}>
              {readerItem.title}
            </Text>
            <Text style={styles.pdfHeaderSubtitle}>
              Q{lastViewedIndex + 1} of {totalDocCount} • {readerTypeLabel}
            </Text>
          </View>

          {/* Interactive Answer Key Toggle Switch in PDF Header */}
          <TouchableOpacity
            style={[
              styles.pdfToggleBtn,
              readerShowAnswers && styles.pdfToggleBtnActive,
            ]}
            onPress={() => setReaderShowAnswers(!readerShowAnswers)}
            activeOpacity={0.8}
          >
            {readerShowAnswers ? (
              <>
                <Eye size={13} color="#059669" />
                <Text style={styles.pdfToggleTextActive}>Answers: ON</Text>
              </>
            ) : (
              <>
                <EyeOff size={13} color="#64748b" />
                <Text style={styles.pdfToggleTextInactive}>Answers: OFF</Text>
              </>
            )}
          </TouchableOpacity>
        </View>

        {/* PDF Document Questions Virtualized FlatList Optimized for Max Refresh Rate (60/90/120fps) */}
        <FlatList
          ref={flatListRef}
          data={readerItem.allQuestions}
          keyExtractor={questionKeyExtractor}
          renderItem={renderQuestionItem}
          initialNumToRender={8}
          maxToRenderPerBatch={8}
          windowSize={5}
          updateCellsBatchingPeriod={40}
          removeClippedSubviews={Platform.OS === 'android'}
          onScroll={handleScroll}
          onScrollBeginDrag={handleScrollBeginDrag}
          onMomentumScrollEnd={handleMomentumScrollEnd}
          scrollEventThrottle={16}
          showsVerticalScrollIndicator={true}
          nestedScrollEnabled={true}
          decelerationRate="normal"
          onViewableItemsChanged={onViewableItemsChanged}
          viewabilityConfig={viewabilityConfig}
          onEndReached={loadMoreNext}
          onEndReachedThreshold={0.5}
          ListHeaderComponent={
            <View>
              {/* Document Banner */}
              <View style={styles.pdfDocBanner}>
                <View style={styles.pdfBannerTopRow}>
                  <View style={styles.pdfDocBannerBadge}>
                    <GraduationCap size={15} color="#4338ca" />
                    <Text style={styles.pdfDocBannerBadgeText}>
                      {readerBannerBadgeLabel}
                    </Text>
                  </View>

                  {initialBookmarkIndex > 0 ? (
                    <View style={styles.resumedBadge}>
                      <Bookmark size={11} color="#2563eb" />
                      <Text style={styles.resumedBadgeText}>
                        Marked at Question {initialBookmarkIndex + 1}
                      </Text>
                    </View>
                  ) : null}
                </View>

                <Text style={styles.pdfDocTitle}>{readerItem.title}</Text>
                <Text style={styles.pdfDocMeta}>
                  {readerShowAnswers
                    ? 'Study Mode • Correct answers revealed automatically'
                    : 'Self-Test Mode • Tap an option to verify your answer & reveal explanation'}
                </Text>
                <View style={styles.pdfDivider} />
              </View>

              {/* Upper Space Batch Card with single-pull indicator */}
              {readerItem.startIndex > 0 && (
                <View style={styles.upperSpaceCard}>
                  {isLoadingPrev ? (
                    <View style={styles.loadPrevRow}>
                      <ActivityIndicator size="small" color="#4f46e5" />
                      <Text style={styles.loadPrevText}>
                        Loading previous batch ({Math.min(20, readerItem.startIndex)} MCQs)...
                      </Text>
                    </View>
                  ) : (
                    <TouchableOpacity
                      style={styles.loadPrevHintBtn}
                      onPress={() => {
                        if (!isLoadingPrevRef.current) {
                          loadMorePrev();
                        }
                      }}
                      activeOpacity={0.7}
                    >
                      <ChevronUp size={14} color="#6366f1" />
                      <Text style={styles.loadPrevText}>
                        Pull down to load previous batch (Questions 1 – {readerItem.startIndex})
                      </Text>
                    </TouchableOpacity>
                  )}
                  <View style={styles.upperSpaceDivider} />
                </View>
              )}
            </View>
          }
          ListFooterComponent={
            <View>
              {/* Bottom Space Auto Loading Indicator */}
              {readerItem.endIndex < totalDocCount - 1 ? (
                <View style={styles.bottomSpaceCard}>
                  <View style={styles.loadNextRow}>
                    <ActivityIndicator size="small" color="#4f46e5" />
                    <Text style={styles.loadNextText}>
                      Loading next MCQs (Questions {readerItem.endIndex + 2} – {totalDocCount})...
                    </Text>
                  </View>
                </View>
              ) : (
                <View style={styles.endDocFooter}>
                  <Text style={styles.endDocFooterText}>
                    End of Document ({totalDocCount} Questions Total)
                  </Text>
                </View>
              )}
            </View>
          }
        />

        {/* AI Chat Modal Pre-fed with Question Context */}
        <AiChatModal
          visible={chatModalVisible}
          questionContext={activeQuestionForChat}
          onClose={() => setChatModalVisible(false)}
        />
      </SafeAreaView>
    );
  }

  // ----------------------------------------------------
  // DIRECTORY MAIN VIEW (With Saved Bookmarks & Progress Badges)
  // ----------------------------------------------------
  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="light-content" backgroundColor="#0f172a" />
      {/* Header */}
      <View style={styles.header}>
        <View style={{ flex: 1 }}>
          <View style={styles.headerTitleRow}>
            <GraduationCap size={22} color="#818cf8" style={{ marginRight: 8 }} />
            <Text style={styles.headerTitle}>Study Directory</Text>
            <View style={styles.aiBadge}>
              <Sparkles size={10} color="#a855f7" />
              <Text style={styles.aiBadgeText}>AI Tutor</Text>
            </View>
          </View>
          <Text style={styles.headerSubtitle}>
            Select a Book or Topic to read in Full-Screen PDF view
          </Text>
        </View>
      </View>

      {/* Breadcrumb Bar when inside a specific folder */}
      {selectedFolder !== 'all' && (
        <View style={styles.breadcrumbBar}>
          <TouchableOpacity
            style={styles.breadcrumbBackBtn}
            onPress={() => setSelectedFolder('all')}
            activeOpacity={0.8}
          >
            <ArrowLeft size={14} color="#818cf8" style={{ marginRight: 4 }} />
            <Text style={styles.breadcrumbBackText}>All Folders</Text>
          </TouchableOpacity>
          <ChevronRight size={13} color="#64748b" style={{ marginHorizontal: 4 }} />
          <Text style={styles.breadcrumbActiveText} numberOfLines={1}>
            {selectedFolder === 'nmcle'
              ? `NMCLE Sets (${nmcleCards.length})`
              : selectedFolder === 'book'
              ? `Medical Books (${bookCards.length})`
              : selectedFolder === 'topic'
              ? `Topic Modules (${topicCards.length})`
              : `Custom Quizzes (${customCards.length})`}
          </Text>
        </View>
      )}

      {/* Search Bar */}
      <View style={styles.searchContainer}>
        <View style={styles.searchWrapper}>
          <Search size={16} color="#64748b" style={styles.searchIcon} />
          <TextInput
            style={styles.searchInput}
            placeholder={
              selectedFolder === 'nmcle'
                ? 'Search 30 NMCLE sets...'
                : selectedFolder === 'book'
                ? 'Search 4 medical books...'
                : selectedFolder === 'topic'
                ? 'Search topic names...'
                : 'Search study sets & books...'
            }
            placeholderTextColor="#64748b"
            value={searchQuery}
            onChangeText={setSearchQuery}
          />
          {searchQuery ? (
            <TouchableOpacity onPress={() => setSearchQuery('')}>
              <X size={16} color="#94a3b8" />
            </TouchableOpacity>
          ) : null}
        </View>
      </View>

      {/* Main Body: Either Folder Dashboard (when 'all' and no search) or Cards List */}
      {loading ? (
        <View style={styles.centerContainer}>
          <ActivityIndicator size="large" color="#6366f1" />
          <Text style={styles.loadingText}>Loading study directory...</Text>
        </View>
      ) : selectedFolder === 'all' && !searchQuery.trim() ? (
        <ScrollView
          contentContainerStyle={styles.folderDashboardContainer}
          showsVerticalScrollIndicator={false}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={handleRefresh}
              colors={['#6366f1']}
            />
          }
        >
          {/* Folder Card: NMCLE Exam Sets */}
          <TouchableOpacity
            style={[styles.folderOverviewCard, styles.folderCardNmcle]}
            activeOpacity={0.85}
            onPress={() => setSelectedFolder('nmcle')}
          >
            <View style={styles.folderCardHeader}>
              <Text style={styles.folderCardTitle}>NMCLE Sets</Text>
              <View style={[styles.folderBadge, { backgroundColor: 'rgba(99, 102, 241, 0.15)' }]}>
                <Text style={[styles.folderBadgeText, { color: '#818cf8' }]}>{nmcleCards.length} Sets</Text>
              </View>
            </View>
            <Text style={styles.folderCardDesc}>
              {nmcleCards.length} Official Exam & Past Model Sets ({totalNmcleQuestions > 0 ? totalNmcleQuestions.toLocaleString() : '6,000+'} MCQs)
            </Text>
            <View style={styles.folderCardFooter}>
              <Text style={[styles.folderExploreText, { color: '#818cf8' }]}>
                Open Folder ({nmcleCards.length} Sets)
              </Text>
              <ChevronRight size={14} color="#818cf8" />
            </View>
          </TouchableOpacity>

          {/* Folder Card: Medical Books */}
          <TouchableOpacity
            style={[styles.folderOverviewCard, styles.folderCardBook]}
            activeOpacity={0.85}
            onPress={() => setSelectedFolder('book')}
          >
            <View style={styles.folderCardHeader}>
              <Text style={styles.folderCardTitle}>Medical Books</Text>
              <View style={[styles.folderBadge, { backgroundColor: 'rgba(2, 132, 199, 0.15)' }]}>
                <Text style={[styles.folderBadgeText, { color: '#38bdf8' }]}>{bookCards.length} Books</Text>
              </View>
            </View>
            <Text style={styles.folderCardDesc}>
              Surgery, Medicine, Pediatrics, Gynae & OBS ({totalBookQuestions > 0 ? totalBookQuestions.toLocaleString() : '4 Books'} MCQs)
            </Text>
            <View style={styles.folderCardFooter}>
              <Text style={[styles.folderExploreText, { color: '#38bdf8' }]}>
                Open Folder ({bookCards.length} Books)
              </Text>
              <ChevronRight size={14} color="#38bdf8" />
            </View>
          </TouchableOpacity>

          {/* Folder Card: Topic-Wise Study */}
          <TouchableOpacity
            style={[styles.folderOverviewCard, styles.folderCardTopic]}
            activeOpacity={0.85}
            onPress={() => setSelectedFolder('topic')}
          >
            <View style={styles.folderCardHeader}>
              <Text style={styles.folderCardTitle}>Study by Topic</Text>
              <View style={[styles.folderBadge, { backgroundColor: 'rgba(5, 150, 105, 0.15)' }]}>
                <Text style={[styles.folderBadgeText, { color: '#34d399' }]}>{topicCards.length} Topics</Text>
              </View>
            </View>
            <Text style={styles.folderCardDesc}>
              Targeted clinical topic modules categorized across all source books & sets
            </Text>
            <View style={styles.folderCardFooter}>
              <Text style={[styles.folderExploreText, { color: '#34d399' }]}>
                Explore Topics
              </Text>
              <ChevronRight size={14} color="#34d399" />
            </View>
          </TouchableOpacity>

          {/* Folder Card: Custom Sets (if any exist) */}
          {customCards.length > 0 && (
            <TouchableOpacity
              style={[styles.folderOverviewCard, styles.folderCardCustom]}
              activeOpacity={0.85}
              onPress={() => setSelectedFolder('custom')}
            >
              <View style={styles.folderCardHeader}>
                <Text style={styles.folderCardTitle}>Custom Tests</Text>
                <View style={[styles.folderBadge, { backgroundColor: 'rgba(217, 119, 6, 0.15)' }]}>
                  <Text style={[styles.folderBadgeText, { color: '#fbbf24' }]}>{customCards.length} Sets</Text>
                </View>
              </View>
              <Text style={styles.folderCardDesc}>
                Personalized practice sets created by you
              </Text>
              <View style={styles.folderCardFooter}>
                <Text style={[styles.folderExploreText, { color: '#fbbf24' }]}>
                  View Custom Sets
                </Text>
                <ChevronRight size={14} color="#fbbf24" />
              </View>
            </TouchableOpacity>
          )}
        </ScrollView>
      ) : filteredCards.length === 0 ? (
        <View style={styles.emptyContainer}>
          <BookOpen size={48} color="#475569" />
          <Text style={styles.emptyTitle}>No Content Found</Text>
          <Text style={styles.emptySubtitle}>
            {searchQuery
              ? 'No matching book, set, or topic found. Try a different search.'
              : 'No items available in this folder.'}
          </Text>
        </View>
      ) : (
        <FlatList
          data={filteredCards}
          keyExtractor={(item) => item.id}
          contentContainerStyle={styles.cardsGridPadding}
          initialNumToRender={10}
          maxToRenderPerBatch={10}
          windowSize={7}
          removeClippedSubviews={Platform.OS === 'android'}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={handleRefresh}
              colors={['#6366f1']}
            />
          }
          renderItem={({ item }) => {
            const isCardLoading =
              loadingCardId === item.id || loadingCardId === item._id;
            const isAnswerOn = cardShowAnswers[item.id] ?? false;
            const progress = studyProgressMap[item.id];
            const hasBookmark = progress && progress.lastIndex > 0;
            const isTopicItem = item.folderType === 'topic' || (item.id && String(item.id).startsWith('topic_'));

            return (
              <TouchableOpacity
                style={styles.directoryCard}
                activeOpacity={0.8}
                onPress={() =>
                  isTopicItem
                    ? handleOpenTopic(item)
                    : handleOpenBook(item)
                }
                disabled={isCardLoading}
              >
                <View style={styles.cardHeaderRow}>
                  <Text style={styles.cardTitle} numberOfLines={1}>
                    {item.title}
                  </Text>
                  <View style={styles.countBadge}>
                    <Text style={styles.countBadgeText}>
                      {isTopicItem
                        ? `${item.bookCount} Source ${item.bookCount === 1 ? 'Book' : 'Books'}`
                        : `${item.questionCount} MCQs`}
                    </Text>
                  </View>
                </View>

                {item.subject ? (
                  <Text style={styles.cardSubject}>Subject: {item.subject}</Text>
                ) : (
                  <Text style={styles.cardSubject}>Topic Module</Text>
                )}

                {/* Bookmark Study Progress Bar & Badge */}
                {hasBookmark ? (
                  <View style={styles.cardProgressContainer}>
                    <View style={styles.cardProgressBadgeRow}>
                      <View style={styles.bookmarkTag}>
                        <Bookmark size={10} color="#60a5fa" />
                        <Text style={styles.bookmarkTagText}>
                          Resumes at Q{progress.lastIndex + 1}
                        </Text>
                      </View>
                      <Text style={styles.progressPercentText}>
                        {item.questionCount > 0
                          ? Math.round((progress.lastIndex / item.questionCount) * 100)
                          : 0}%
                      </Text>
                    </View>

                    <View style={styles.progressBarTrack}>
                      <View
                        style={[
                          styles.progressBarFill,
                          {
                            width: `${Math.min(
                              item.questionCount > 0
                                ? Math.round((progress.lastIndex / item.questionCount) * 100)
                                : 0,
                              100
                            )}%`,
                          },
                        ]}
                      />
                    </View>
                  </View>
                ) : null}
              </TouchableOpacity>
            );
          }}
        />
      )}

      {/* Fixed Bottom Navigation Footer Bar */}
      <BottomTabBar activeTab="Study" onTabPress={handleTabPress} />
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
    paddingTop: 10,
    paddingBottom: 12,
    backgroundColor: '#1e293b',
    borderBottomWidth: 1,
    borderBottomColor: '#334155',
  },
  headerTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: '800',
    color: '#f8fafc',
  },
  aiBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(168, 85, 247, 0.2)',
    paddingHorizontal: 7,
    paddingVertical: 2,
    borderRadius: 8,
    marginLeft: 8,
    borderWidth: 1,
    borderColor: '#a855f7',
  },
  aiBadgeText: {
    fontSize: 10,
    fontWeight: '800',
    color: '#c084fc',
    marginLeft: 3,
  },
  headerSubtitle: {
    fontSize: 11.5,
    color: '#94a3b8',
    marginTop: 2,
  },
  folderPillsWrapper: {
    backgroundColor: '#0f172a',
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#1e293b',
  },
  folderPillsContainer: {
    paddingHorizontal: 12,
    gap: 8,
    flexDirection: 'row',
    alignItems: 'center',
  },
  folderPillBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#1e293b',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: '#334155',
  },
  folderPillBtnActive: {
    backgroundColor: '#6366f1',
    borderColor: '#818cf8',
  },
  folderPillBtnActiveNmcle: {
    backgroundColor: '#4f46e5',
    borderColor: '#818cf8',
  },
  folderPillBtnActiveBook: {
    backgroundColor: '#0284c7',
    borderColor: '#38bdf8',
  },
  folderPillBtnActiveTopic: {
    backgroundColor: '#059669',
    borderColor: '#34d399',
  },
  folderPillBtnActiveCustom: {
    backgroundColor: '#d97706',
    borderColor: '#fbbf24',
  },
  folderPillBtnText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#94a3b8',
    marginLeft: 6,
  },
  folderPillBtnTextActive: {
    color: '#ffffff',
    fontWeight: '700',
  },
  breadcrumbBar: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 14,
    paddingVertical: 8,
    backgroundColor: '#1e293b',
    borderBottomWidth: 1,
    borderBottomColor: '#334155',
  },
  breadcrumbBackBtn: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  breadcrumbBackText: {
    fontSize: 12.5,
    fontWeight: '700',
    color: '#818cf8',
  },
  breadcrumbActiveText: {
    fontSize: 12.5,
    fontWeight: '600',
    color: '#f8fafc',
    flex: 1,
  },
  folderDashboardContainer: {
    padding: 10,
    gap: 10,
    paddingBottom: 30,
  },
  folderOverviewCard: {
    backgroundColor: '#1e293b',
    borderRadius: 12,
    padding: 12,
    borderWidth: 1,
    borderColor: '#334155',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 6,
    elevation: 3,
  },
  folderCardNmcle: {
    borderColor: 'rgba(99, 102, 241, 0.4)',
    backgroundColor: '#181f38',
  },
  folderCardBook: {
    borderColor: 'rgba(2, 132, 199, 0.4)',
    backgroundColor: '#132338',
  },
  folderCardTopic: {
    borderColor: 'rgba(5, 150, 105, 0.4)',
    backgroundColor: '#132c25',
  },
  folderCardCustom: {
    borderColor: 'rgba(217, 119, 6, 0.4)',
    backgroundColor: '#2b2113',
  },
  folderCardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  folderIconBox: {
    width: 36,
    height: 36,
    borderRadius: 9,
    alignItems: 'center',
    justifyContent: 'center',
  },
  folderBadge: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 8,
  },
  folderBadgeText: {
    fontSize: 10.5,
    fontWeight: '800',
  },
  folderCardTitle: {
    fontSize: 15,
    fontWeight: '800',
    color: '#ffffff',
    marginBottom: 2,
  },
  folderCardDesc: {
    fontSize: 11.5,
    color: '#94a3b8',
    lineHeight: 16,
    marginBottom: 8,
  },
  folderCardFooter: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingTop: 4,
  },
  folderExploreText: {
    fontSize: 12,
    fontWeight: '700',
  },
  searchContainer: {
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  searchWrapper: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#1e293b',
    borderRadius: 8,
    paddingHorizontal: 8,
    paddingVertical: 5,
    borderWidth: 1,
    borderColor: '#334155',
  },
  searchIcon: {
    marginRight: 6,
  },
  searchInput: {
    flex: 1,
    color: '#f8fafc',
    fontSize: 12.5,
    paddingVertical: 2,
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
    fontWeight: '700',
    color: '#f8fafc',
    marginTop: 12,
  },
  emptySubtitle: {
    fontSize: 12.5,
    color: '#94a3b8',
    textAlign: 'center',
    marginTop: 4,
    lineHeight: 18,
  },
  cardsGridPadding: {
    padding: 10,
    paddingBottom: 24,
    gap: 8,
  },
  directoryCard: {
    backgroundColor: '#1e293b',
    borderRadius: 10,
    padding: 10,
    borderWidth: 1,
    borderColor: '#334155',
  },
  cardMainSection: {
    marginBottom: 4,
  },
  cardHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 6,
  },
  countBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(99, 102, 241, 0.15)',
    paddingHorizontal: 7,
    paddingVertical: 3,
    borderRadius: 6,
  },
  countBadgeText: {
    fontSize: 10.5,
    fontWeight: '700',
    color: '#818cf8',
  },
  cardTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: '#f8fafc',
    flex: 1,
    marginRight: 8,
  },
  cardSubject: {
    fontSize: 11,
    color: '#94a3b8',
  },
  cardProgressContainer: {
    marginTop: 6,
    backgroundColor: '#0f172a',
    padding: 6,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: '#334155',
  },
  cardProgressBadgeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 4,
  },
  bookmarkTag: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  bookmarkTagText: {
    fontSize: 10,
    fontWeight: '700',
    color: '#60a5fa',
    marginLeft: 3,
  },
  progressPercentText: {
    fontSize: 10,
    fontWeight: '800',
    color: '#93c5fd',
  },
  progressBarTrack: {
    height: 4,
    backgroundColor: '#1e293b',
    borderRadius: 2,
    overflow: 'hidden',
  },
  progressBarFill: {
    height: '100%',
    backgroundColor: '#3b82f6',
    borderRadius: 2,
  },
  cardFooterRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingTop: 4,
    marginTop: 4,
  },
  cardToggleBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#0f172a',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: '#334155',
  },
  cardToggleBtnActive: {
    backgroundColor: 'rgba(16, 185, 129, 0.15)',
    borderColor: '#10b981',
  },
  cardToggleTextInactive: {
    fontSize: 10.5,
    fontWeight: '700',
    color: '#94a3b8',
    marginLeft: 3,
  },
  cardToggleTextActive: {
    fontSize: 10.5,
    fontWeight: '700',
    color: '#10b981',
    marginLeft: 3,
  },
  openPdfBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(99, 102, 241, 0.15)',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: '#6366f1',
  },
  openPdfBtnText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#818cf8',
    marginRight: 2,
  },

  // ----------------------------------------------------
  // CLEAN WHITE PDF READER STYLES (Maximal Screen Width)
  // ----------------------------------------------------
  pdfContainer: {
    flex: 1,
    backgroundColor: '#f8fafc',
  },
  pdfHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 8,
    paddingVertical: 8,
    backgroundColor: '#ffffff',
    borderBottomWidth: 1,
    borderBottomColor: '#e2e8f0',
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 3,
  },
  pdfBackBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#f1f5f9',
    paddingHorizontal: 8,
    paddingVertical: 5,
    borderRadius: 6,
  },
  pdfBackText: {
    fontSize: 12.5,
    fontWeight: '700',
    color: '#0f172a',
    marginLeft: 3,
  },
  pdfHeaderTitle: {
    fontSize: 14.5,
    fontWeight: '800',
    color: '#0f172a',
  },
  pdfHeaderSubtitle: {
    fontSize: 10.5,
    color: '#64748b',
  },
  pdfToggleBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#f1f5f9',
    paddingHorizontal: 8,
    paddingVertical: 5,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: '#cbd5e1',
  },
  pdfToggleBtnActive: {
    backgroundColor: '#ecfdf5',
    borderColor: '#10b981',
  },
  pdfToggleTextInactive: {
    fontSize: 11,
    fontWeight: '700',
    color: '#64748b',
    marginLeft: 3,
  },
  pdfToggleTextActive: {
    fontSize: 11,
    fontWeight: '700',
    color: '#059669',
    marginLeft: 3,
  },
  pdfScrollPadding: {
    paddingHorizontal: 6,
    paddingTop: 8,
    paddingBottom: 30,
    gap: 8,
  },
  pdfDocBanner: {
    backgroundColor: '#ffffff',
    padding: 12,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    marginBottom: 4,
  },
  pdfBannerTopRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 6,
  },
  pdfDocBannerBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#e0e7ff',
    paddingHorizontal: 7,
    paddingVertical: 2,
    borderRadius: 6,
  },
  pdfDocBannerBadgeText: {
    fontSize: 9.5,
    fontWeight: '800',
    color: '#4338ca',
    marginLeft: 3,
  },
  resumedBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#eff6ff',
    paddingHorizontal: 7,
    paddingVertical: 2,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: '#bfdbfe',
  },
  resumedBadgeText: {
    fontSize: 10,
    fontWeight: '700',
    color: '#1d4ed8',
    marginLeft: 3,
  },
  pdfDocTitle: {
    fontSize: 20,
    fontWeight: '800',
    color: '#0f172a',
    marginBottom: 3,
  },
  pdfDocMeta: {
    fontSize: 11.5,
    color: '#64748b',
    lineHeight: 15,
  },
  pdfDivider: {
    height: 2,
    backgroundColor: '#6366f1',
    width: 36,
    marginTop: 8,
    borderRadius: 1,
  },
  pdfQCard: {
    backgroundColor: '#ffffff',
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    overflow: 'hidden',
    marginBottom: 10,
    elevation: 1,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.04,
    shadowRadius: 3,
  },
  pdfQHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 10,
    paddingVertical: 9,
    backgroundColor: '#f8fafc',
    borderBottomWidth: 1,
    borderBottomColor: '#e2e8f0',
  },
  pdfQNumBadge: {
    backgroundColor: '#e0e7ff',
    paddingHorizontal: 7,
    paddingVertical: 3,
    borderRadius: 5,
  },
  pdfQNumText: {
    fontSize: 11.5,
    fontWeight: '800',
    color: '#4338ca',
  },
  pdfTopicTag: {
    flex: 1,
    fontSize: 11,
    color: '#64748b',
    marginHorizontal: 6,
    textAlign: 'right',
  },
  pdfQBody: {
    paddingHorizontal: 10,
    paddingVertical: 10,
  },
  pdfQuestionText: {
    fontSize: 15,
    fontWeight: '700',
    color: '#0f172a',
    lineHeight: 22,
    marginBottom: 10,
  },
  pdfOptionsList: {
    gap: 6,
    marginBottom: 10,
  },
  pdfOptionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 10,
    paddingVertical: 8,
    borderRadius: 8,
    backgroundColor: '#f8fafc',
    borderWidth: 1,
    borderColor: '#e2e8f0',
  },
  pdfOptionCorrectRow: {
    backgroundColor: '#ecfdf5',
    borderColor: '#10b981',
  },
  pdfOptionWrongRow: {
    backgroundColor: '#fef2f2',
    borderColor: '#ef4444',
  },
  pdfOptionLetter: {
    fontSize: 13,
    fontWeight: '800',
    color: '#64748b',
    width: 22,
  },
  pdfOptionCorrectLetter: {
    color: '#059669',
  },
  pdfOptionWrongLetter: {
    color: '#dc2626',
  },
  pdfOptionText: {
    fontSize: 13.5,
    color: '#334155',
    flex: 1,
  },
  pdfOptionCorrectText: {
    color: '#065f46',
    fontWeight: '700',
  },
  pdfOptionWrongText: {
    color: '#991b1b',
    fontWeight: '700',
  },
  pdfCorrectBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#d1fae5',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 5,
    marginLeft: 6,
  },
  pdfCorrectBadgeText: {
    fontSize: 9.5,
    fontWeight: '800',
    color: '#059669',
    marginLeft: 2,
  },
  pdfWrongBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fee2e2',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 5,
    marginLeft: 6,
  },
  pdfWrongBadgeText: {
    fontSize: 9.5,
    fontWeight: '800',
    color: '#dc2626',
    marginLeft: 2,
  },
  pdfExpBox: {
    marginTop: 10,
    padding: 10,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#cbd5e1',
    backgroundColor: '#f8fafc',
    width: '100%',
    flexShrink: 1,
  },
  pdfExpTitle: {
    fontSize: 12,
    fontWeight: '700',
    color: '#334155',
    marginBottom: 6,
  },
  pdfAiExpBox: {
    marginTop: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: 10,
    backgroundColor: '#f3e8ff',
    borderWidth: 1,
    borderColor: '#c084fc',
    overflow: 'hidden',
    width: '100%',
    flexShrink: 1,
  },
  pdfAiExpHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 6,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(168, 85, 247, 0.2)',
    paddingBottom: 4,
  },
  pdfAiBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#7c3aed',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 5,
    marginRight: 6,
  },
  pdfAiBadgeText: {
    fontSize: 9,
    fontWeight: '800',
    color: '#ffffff',
    marginLeft: 3,
  },
  pdfAiExpTitle: {
    fontSize: 12,
    fontWeight: '800',
    color: '#6b21a8',
  },
  pdfAiBtnRow: {
    flexDirection: 'row',
    gap: 6,
    marginTop: 10,
  },
  pdfAiExplainBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#f3e8ff',
    paddingVertical: 9,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#a855f7',
  },
  pdfAiExplainBtnText: {
    color: '#7c3aed',
    fontSize: 11.5,
    fontWeight: '700',
    marginLeft: 4,
  },
  pdfAiChatBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#4338ca',
    paddingVertical: 9,
    borderRadius: 8,
  },
  pdfAiChatBtnText: {
    color: '#ffffff',
    fontSize: 11.5,
    fontWeight: '700',
    marginLeft: 4,
  },
  endDocFooter: {
    alignItems: 'center',
    paddingVertical: 16,
  },
  endDocFooterText: {
    fontSize: 11.5,
    fontWeight: '600',
    color: '#94a3b8',
  },
  upperSpaceCard: {
    paddingHorizontal: 12,
    paddingTop: 8,
    paddingBottom: 4,
    alignItems: 'center',
    justifyContent: 'center',
  },
  loadPrevRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: '#f5f3ff',
    borderWidth: 1,
    borderColor: '#ddd6fe',
    borderRadius: 8,
    paddingVertical: 9,
    paddingHorizontal: 14,
    width: '100%',
  },
  loadPrevHintBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    backgroundColor: '#f5f3ff',
    borderWidth: 1,
    borderColor: '#ddd6fe',
    borderRadius: 8,
    paddingVertical: 9,
    paddingHorizontal: 14,
    width: '100%',
  },
  loadPrevText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#6366f1',
  },
  upperSpaceDivider: {
    height: 1,
    backgroundColor: '#e2e8f0',
    marginTop: 10,
    marginBottom: 4,
    width: '100%',
  },
  bottomSpaceCard: {
    paddingHorizontal: 12,
    paddingVertical: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  loadNextRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: '#f5f3ff',
    borderWidth: 1,
    borderColor: '#ddd6fe',
    borderRadius: 8,
    paddingVertical: 9,
    paddingHorizontal: 14,
    width: '100%',
  },
  loadNextText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#6366f1',
  },
});
