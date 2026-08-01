import React, { useState, useEffect, useCallback, useRef, memo } from 'react';
import { useFocusEffect } from '@react-navigation/native';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  ActivityIndicator,
  TextInput,
  RefreshControl,
  StatusBar,
  Platform,
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
} from 'lucide-react-native';
import { fetchQuizzes, fetchQuizById, fetchAiExplanationApi } from '../services/api';
import { saveStudyProgress, getStudyProgress, getAllStudyProgress } from '../services/storage';
import MarkdownRenderer from '../components/MarkdownRenderer';
import AiChatModal from '../components/AiChatModal';
import BottomTabBar from '../components/BottomTabBar';

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
  const correctOptIdx = getCorrectOptionIndex(item);

  return (
    <View style={styles.pdfQCard}>
      {/* Question Top Bar */}
      <TouchableOpacity
        style={styles.pdfQHeader}
        onPress={() => onToggleExpand(index)}
        activeOpacity={0.8}
      >
        <View style={styles.pdfQNumBadge}>
          <Text style={styles.pdfQNumText}>Question {index + 1}</Text>
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
});

export default function StudyScreen({ navigation, route }) {
  // Directory Quizzes Metadata
  const [quizzes, setQuizzes] = useState([]);
  const [quizCache, setQuizCache] = useState({});
  const [studyProgressMap, setStudyProgressMap] = useState({});
  
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [loadingCardId, setLoadingCardId] = useState(null);

  const [filterType, setFilterType] = useState('book'); // 'book' | 'topic'
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

  useEffect(() => {
    readerItemRef.current = readerItem;
  }, [readerItem]);

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

  // Save Progress to AsyncStorage
  const persistProgress = useCallback((item, lastIdx, choices, isAnswersOn) => {
    if (!item || !item.id) return;
    saveStudyProgress(item.id, {
      lastIndex: lastIdx,
      totalCount: item.allQuestions.length,
      userChoices: choices,
      showAnswers: isAnswersOn,
    });
    // Update local state map for directory badge UI
    setStudyProgressMap((prev) => ({
      ...prev,
      [item.id]: {
        lastIndex: lastIdx,
        totalCount: item.allQuestions.length,
        userChoices: choices,
        showAnswers: isAnswersOn,
      },
    }));
  }, []);

  // Open Book with direct initialScrollIndex to bookmarked question
  const handleOpenBook = async (quizSummary) => {
    try {
      setLoadingCardId(quizSummary._id);

      let fullQuiz = quizCache[quizSummary._id];
      if (!fullQuiz) {
        const res = await fetchQuizById(quizSummary._id);
        if (res && res.quiz) {
          fullQuiz = res.quiz;
          setQuizCache((prev) => ({ ...prev, [quizSummary._id]: fullQuiz }));
        }
      }

      if (fullQuiz) {
        const formattedQuestions = (fullQuiz.questions || []).map((q) => ({
          ...q,
          quizTitle: fullQuiz.title,
          quizSubject: fullQuiz.subject || 'General',
        }));

        const savedProgress = await getStudyProgress(fullQuiz._id);
        const bookmarkIndex = savedProgress?.lastIndex || 0;
        const savedChoices = savedProgress?.userChoices || {};
        const isShow = cardShowAnswers[quizSummary._id] ?? (savedProgress?.showAnswers || false);

        targetScrollIndexRef.current = bookmarkIndex;
        setInitialBookmarkIndex(bookmarkIndex);
        setLastViewedIndex(bookmarkIndex);
        setReaderShowAnswers(isShow);
        setUserChoices(savedChoices);
        setExpandedIndices({});

        const itemObj = {
          id: fullQuiz._id,
          title: fullQuiz.title,
          type: 'book',
          allQuestions: formattedQuestions,
        };
        setReaderItem(itemObj);

        persistProgress(itemObj, bookmarkIndex, savedChoices, isShow);
      }
    } catch (err) {
      console.error('Error loading book lazily:', err.message);
    } finally {
      setLoadingCardId(null);
    }
  };

  // Open Topic with direct initialScrollIndex to bookmarked question
  const handleOpenTopic = async (topicCard) => {
    const topicName = topicCard.title;
    const targetClean = topicName.trim().toLowerCase();

    try {
      setLoadingCardId(topicCard.id);

      // Fetch all available quizzes to guarantee no topic questions are missed
      const fetchPromises = quizzes.map(async (qSummary) => {
        if (quizCache[qSummary._id]) {
          return quizCache[qSummary._id];
        }
        const res = await fetchQuizById(qSummary._id).catch(() => null);
        if (res && res.quiz) {
          setQuizCache((prev) => ({ ...prev, [qSummary._id]: res.quiz }));
          return res.quiz;
        }
        return null;
      });

      const loadedFullQuizzes = (await Promise.all(fetchPromises)).filter(Boolean);

      const topicQuestions = [];
      loadedFullQuizzes.forEach((quiz) => {
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
      });

      const savedProgress = await getStudyProgress(topicCard.id);
      const bookmarkIndex = savedProgress?.lastIndex || 0;
      const savedChoices = savedProgress?.userChoices || {};
      const isShow = cardShowAnswers[topicCard.id] ?? (savedProgress?.showAnswers || false);

      targetScrollIndexRef.current = bookmarkIndex;
      setInitialBookmarkIndex(bookmarkIndex);
      setLastViewedIndex(bookmarkIndex);
      setReaderShowAnswers(isShow);
      setUserChoices(savedChoices);
      setExpandedIndices({});

      const itemObj = {
        id: topicCard.id,
        title: topicName,
        type: 'topic',
        allQuestions: topicQuestions,
      };
      setReaderItem(itemObj);

      persistProgress(itemObj, bookmarkIndex, savedChoices, isShow);
    } catch (err) {
      console.error('Error loading topic lazily:', err.message);
    } finally {
      setLoadingCardId(null);
    }
  };

  const isInitialMountRef = useRef(true);

  const lastViewedIndexRef = useRef(-1);

  const handleScrollEnd = useCallback(() => {
    if (lastViewedIndexRef.current >= 0) {
      setLastViewedIndex(lastViewedIndexRef.current);
    }
  }, []);

  // Smooth Viewport Location Tracker (Zero Re-renders while scrolling!)
  const onViewableItemsChanged = useRef(({ viewableItems }) => {
    if (isInitialMountRef.current) return;

    if (viewableItems && viewableItems.length > 0) {
      const topItem = viewableItems[0];
      if (topItem && typeof topItem.index === 'number') {
        const currentIdx = topItem.index;
        if (lastViewedIndexRef.current !== currentIdx) {
          lastViewedIndexRef.current = currentIdx;

          if (readerItemRef.current) {
            persistProgress(
              readerItemRef.current,
              currentIdx,
              userChoices,
              readerShowAnswers
            );
          }
        }
      }
    }
  }).current;

  const viewabilityConfig = useRef({
    itemVisiblePercentThreshold: 65,
    minimumViewTime: 250,
  }).current;

  const targetScrollIndexRef = useRef(0);
  const hasScrolledToBookmarkRef = useRef(false);

  useEffect(() => {
    if (readerItem) {
      if (!hasScrolledToBookmarkRef.current) {
        hasScrolledToBookmarkRef.current = true;
        isInitialMountRef.current = true;

        const targetIndex = targetScrollIndexRef.current;

        if (targetIndex > 0) {
          const timer = setTimeout(() => {
            flatListRef.current?.scrollToIndex({
              index: targetIndex,
              animated: false,
            });
          }, 80);

          const unblockTimer = setTimeout(() => {
            isInitialMountRef.current = false;
          }, 600);

          return () => {
            clearTimeout(timer);
            clearTimeout(unblockTimer);
          };
        } else {
          isInitialMountRef.current = false;
        }
      }
    } else {
      hasScrolledToBookmarkRef.current = false;
    }
  }, [readerItem?.id]);

  const HEADER_HEIGHT = 160;
  const ITEM_HEIGHT = 280;

  const getItemLayout = useCallback(
    (data, index) => ({
      length: ITEM_HEIGHT,
      offset: HEADER_HEIGHT + ITEM_HEIGHT * index,
      index,
    }),
    []
  );

  const handleScrollToIndexFailed = useCallback((info) => {
    const estimatedOffset = HEADER_HEIGHT + ITEM_HEIGHT * info.index;
    flatListRef.current?.scrollToOffset({
      offset: estimatedOffset,
      animated: false,
    });
    setTimeout(() => {
      flatListRef.current?.scrollToIndex({
        index: info.index,
        animated: false,
      });
    }, 50);
  }, []);

  // Build Directory Cards List
  const bookCards = quizzes.map((quiz) => ({
    id: quiz._id,
    _id: quiz._id,
    title: quiz.title,
    subject: quiz.subject || 'General',
    questionCount: quiz.questionCount || 0,
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
  }));

  // Filter Cards by search query
  const rawCards = filterType === 'book' ? bookCards : topicCards;
  const filteredCards = rawCards.filter((card) => {
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
        const newMaxIdx = Math.max(lastViewedIndex, qIndex);
        setLastViewedIndex(newMaxIdx);
        persistProgress(readerItemRef.current, newMaxIdx, updated, readerShowAnswers);
      }
      return updated;
    });
  }, [lastViewedIndex, readerShowAnswers, persistProgress]);

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

  // ----------------------------------------------------
  // FULL SCREEN READER VIEW (100% Native 60fps Smooth Scroll in Both Directions)
  // ----------------------------------------------------
  if (readerItem) {
    return (
      <SafeAreaView style={styles.pdfContainer}>
        <StatusBar barStyle="dark-content" backgroundColor="#ffffff" />
        
        {/* PDF Reader Top Navigation Bar */}
        <View style={styles.pdfHeader}>
          <TouchableOpacity
            style={styles.pdfBackBtn}
            onPress={() => setReaderItem(null)}
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
              Q{lastViewedIndex + 1} of {readerItem.allQuestions.length} • {filterType === 'book' ? 'Book' : 'Topic'}
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

        {/* PDF Document Questions Virtualized FlatList with Smooth 2-Way Native Virtualization */}
        <FlatList
          ref={flatListRef}
          data={readerItem.allQuestions}
          keyExtractor={(item, index) => item._id || `pdf_q_${index}`}
          initialScrollIndex={initialBookmarkIndex > 0 ? initialBookmarkIndex : undefined}
          getItemLayout={getItemLayout}
          initialNumToRender={5}
          maxToRenderPerBatch={5}
          windowSize={3}
          updateCellsBatchingPeriod={50}
          removeClippedSubviews={true}
          onScrollToIndexFailed={handleScrollToIndexFailed}
          onViewableItemsChanged={onViewableItemsChanged}
          viewabilityConfig={viewabilityConfig}
          onMomentumScrollEnd={handleScrollEnd}
          onScrollEndDrag={handleScrollEnd}
          ListHeaderComponent={
            <View style={styles.pdfDocBanner}>
              <View style={styles.pdfBannerTopRow}>
                <View style={styles.pdfDocBannerBadge}>
                  <GraduationCap size={15} color="#4338ca" />
                  <Text style={styles.pdfDocBannerBadgeText}>
                    {filterType === 'book' ? 'MEDICAL BOOK READER' : 'TOPIC MODULE'}
                  </Text>
                </View>

                {initialBookmarkIndex > 0 ? (
                  <View style={styles.resumedBadge}>
                    <Bookmark size={11} color="#2563eb" />
                    <Text style={styles.resumedBadgeText}>
                      Resumed at Question {initialBookmarkIndex + 1}
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
          }
          ListFooterComponent={
            <View style={styles.endDocFooter}>
              <Text style={styles.endDocFooterText}>
                End of Document ({readerItem.allQuestions.length} Questions Total)
              </Text>
            </View>
          }
          renderItem={({ item, index }) => (
            <PdfQuestionCard
              item={item}
              index={index}
              isExpanded={expandedIndices[index] !== false}
              onToggleExpand={toggleExpand}
              showAnswers={readerShowAnswers}
              userChoice={userChoices[index]}
              onSelectOption={handleSelectOption}
              aiExplanation={aiExplanations[index]}
              isLoadingAi={loadingAiIdx === index}
              onGenerateAiExplanation={handleGenerateAiExplanation}
              onOpenAiChat={handleOpenAiChat}
            />
          )}
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

      {/* Top Segmented Control: By Book vs By Topic */}
      <View style={styles.segmentContainer}>
        <TouchableOpacity
          style={[
            styles.segmentBtn,
            filterType === 'book' && styles.segmentBtnActive,
          ]}
          onPress={() => setFilterType('book')}
          activeOpacity={0.8}
        >
          <BookOpen
            size={16}
            color={filterType === 'book' ? '#ffffff' : '#94a3b8'}
          />
          <Text
            style={[
              styles.segmentText,
              filterType === 'book' && styles.segmentTextActive,
            ]}
          >
            By Book / Quiz ({bookCards.length})
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[
            styles.segmentBtn,
            filterType === 'topic' && styles.segmentBtnActive,
          ]}
          onPress={() => setFilterType('topic')}
          activeOpacity={0.8}
        >
          <FolderKanban
            size={16}
            color={filterType === 'topic' ? '#ffffff' : '#94a3b8'}
          />
          <Text
            style={[
              styles.segmentText,
              filterType === 'topic' && styles.segmentTextActive,
            ]}
          >
            By Topic ({topicCards.length})
          </Text>
        </TouchableOpacity>
      </View>

      {/* Search Bar */}
      <View style={styles.searchContainer}>
        <View style={styles.searchWrapper}>
          <Search size={16} color="#64748b" style={styles.searchIcon} />
          <TextInput
            style={styles.searchInput}
            placeholder={
              filterType === 'book'
                ? 'Search book names...'
                : 'Search topic names...'
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

      {/* Directory Grid / Cards List */}
      {loading ? (
        <View style={styles.centerContainer}>
          <ActivityIndicator size="large" color="#6366f1" />
          <Text style={styles.loadingText}>Loading study directory...</Text>
        </View>
      ) : filteredCards.length === 0 ? (
        <View style={styles.emptyContainer}>
          <BookOpen size={48} color="#475569" />
          <Text style={styles.emptyTitle}>No Collection Found</Text>
          <Text style={styles.emptySubtitle}>
            {searchQuery
              ? 'No matching book or topic found. Try a different search.'
              : 'No content available in this category.'}
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

            return (
              <View style={styles.directoryCard}>
                {/* Card Header Row */}
                <TouchableOpacity
                  style={styles.cardMainSection}
                  activeOpacity={0.8}
                  onPress={() =>
                    filterType === 'book'
                      ? handleOpenBook(item)
                      : handleOpenTopic(item)
                  }
                  disabled={isCardLoading}
                >
                  <View style={styles.cardHeaderRow}>
                    <View
                      style={[
                        styles.cardIconBox,
                        filterType === 'book'
                          ? { backgroundColor: 'rgba(99, 102, 241, 0.2)' }
                          : { backgroundColor: 'rgba(168, 85, 247, 0.2)' },
                      ]}
                    >
                      {filterType === 'book' ? (
                        <BookOpen size={20} color="#818cf8" />
                      ) : (
                        <FolderKanban size={20} color="#c084fc" />
                      )}
                    </View>

                    <View style={styles.countBadge}>
                      <Layers size={12} color="#818cf8" />
                      <Text style={styles.countBadgeText}>
                        {filterType === 'book'
                          ? `${item.questionCount} MCQs`
                          : `${item.bookCount} Source ${item.bookCount === 1 ? 'Book' : 'Books'}`}
                      </Text>
                    </View>
                  </View>

                  <Text style={styles.cardTitle}>{item.title}</Text>
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
                          <Bookmark size={11} color="#60a5fa" />
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

                {/* Card Action Footer Row: Answers Toggle + Open PDF View */}
                <View style={styles.cardFooterRow}>
                  {/* Card Level Answers Toggle Button */}
                  <TouchableOpacity
                    style={[
                      styles.cardToggleBtn,
                      isAnswerOn && styles.cardToggleBtnActive,
                    ]}
                    onPress={() => toggleCardAnswers(item.id)}
                    activeOpacity={0.8}
                  >
                    {isAnswerOn ? (
                      <>
                        <Eye size={13} color="#10b981" />
                        <Text style={styles.cardToggleTextActive}>Answers: ON</Text>
                      </>
                    ) : (
                      <>
                        <EyeOff size={13} color="#94a3b8" />
                        <Text style={styles.cardToggleTextInactive}>Answers: OFF</Text>
                      </>
                    )}
                  </TouchableOpacity>

                  {/* Open PDF View Button */}
                  <TouchableOpacity
                    style={styles.openPdfBtn}
                    onPress={() =>
                      filterType === 'book'
                        ? handleOpenBook(item)
                        : handleOpenTopic(item)
                    }
                    disabled={isCardLoading}
                    activeOpacity={0.8}
                  >
                    {isCardLoading ? (
                      <ActivityIndicator size="small" color="#818cf8" />
                    ) : (
                      <>
                        <Text style={styles.openPdfBtnText}>
                          {hasBookmark ? `Resume Q${progress.lastIndex + 1}` : 'Open PDF'}
                        </Text>
                        <ChevronRight size={15} color="#818cf8" />
                      </>
                    )}
                  </TouchableOpacity>
                </View>
              </View>
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
  segmentContainer: {
    flexDirection: 'row',
    backgroundColor: '#1e293b',
    marginHorizontal: 12,
    marginTop: 10,
    padding: 4,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#334155',
  },
  segmentBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 9,
    borderRadius: 8,
  },
  segmentBtnActive: {
    backgroundColor: '#6366f1',
  },
  segmentText: {
    fontSize: 12.5,
    fontWeight: '600',
    color: '#94a3b8',
    marginLeft: 6,
  },
  segmentTextActive: {
    color: '#ffffff',
    fontWeight: '700',
  },
  searchContainer: {
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  searchWrapper: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#1e293b',
    borderRadius: 10,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderWidth: 1,
    borderColor: '#334155',
  },
  searchIcon: {
    marginRight: 6,
  },
  searchInput: {
    flex: 1,
    color: '#f8fafc',
    fontSize: 13,
    paddingVertical: 4,
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
    padding: 12,
    paddingBottom: 30,
    gap: 10,
  },
  directoryCard: {
    backgroundColor: '#1e293b',
    borderRadius: 14,
    padding: 14,
    borderWidth: 1,
    borderColor: '#334155',
  },
  cardMainSection: {
    marginBottom: 6,
  },
  cardHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  cardIconBox: {
    width: 38,
    height: 38,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  countBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(99, 102, 241, 0.15)',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#6366f1',
  },
  countBadgeText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#818cf8',
    marginLeft: 4,
  },
  cardTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#f8fafc',
    marginBottom: 2,
  },
  cardSubject: {
    fontSize: 12,
    color: '#94a3b8',
  },
  cardProgressContainer: {
    marginTop: 10,
    backgroundColor: '#0f172a',
    padding: 8,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#334155',
  },
  cardProgressBadgeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 6,
  },
  bookmarkTag: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  bookmarkTagText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#60a5fa',
    marginLeft: 4,
  },
  progressPercentText: {
    fontSize: 11,
    fontWeight: '800',
    color: '#93c5fd',
  },
  progressBarTrack: {
    height: 6,
    backgroundColor: '#1e293b',
    borderRadius: 3,
    overflow: 'hidden',
  },
  progressBarFill: {
    height: '100%',
    backgroundColor: '#3b82f6',
    borderRadius: 3,
  },
  cardFooterRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderTopWidth: 1,
    borderTopColor: '#334155',
    paddingTop: 10,
    marginTop: 6,
  },
  cardToggleBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#0f172a',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#334155',
  },
  cardToggleBtnActive: {
    backgroundColor: 'rgba(16, 185, 129, 0.15)',
    borderColor: '#10b981',
  },
  cardToggleTextInactive: {
    fontSize: 11.5,
    fontWeight: '700',
    color: '#94a3b8',
    marginLeft: 4,
  },
  cardToggleTextActive: {
    fontSize: 11.5,
    fontWeight: '700',
    color: '#10b981',
    marginLeft: 4,
  },
  openPdfBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(99, 102, 241, 0.15)',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#6366f1',
  },
  openPdfBtnText: {
    fontSize: 12,
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
    marginTop: 8,
    padding: 10,
    borderRadius: 8,
    backgroundColor: '#f1f5f9',
    borderLeftWidth: 3,
    borderLeftColor: '#3b82f6',
  },
  pdfExpTitle: {
    fontSize: 11.5,
    fontWeight: '800',
    color: '#1e40af',
    marginBottom: 3,
  },
  pdfAiExpBox: {
    marginTop: 10,
    padding: 10,
    borderRadius: 10,
    backgroundColor: '#f3e8ff',
    borderWidth: 1,
    borderColor: '#c084fc',
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
});
