import React, { useState, useEffect, useCallback, useRef, memo, useMemo } from 'react';
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
  Alert,
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
  RotateCcw,
} from 'lucide-react-native';
import { fetchQuizzes, fetchQuizById, fetchQuizChunkApi, fetchAiExplanationApi, fetchQuestionsByTopicApi, fetchStudyStructureApi } from '../services/api';
import { saveStudyProgress, getStudyProgress, getAllStudyProgress, getPreservedStudyStructure, savePreservedStudyStructure } from '../services/storage';
import MarkdownRenderer from '../components/MarkdownRenderer';
import ZoomableImageCard from '../components/ZoomableImageCard';
import AiChatModal from '../components/AiChatModal';
import BottomTabBar from '../components/BottomTabBar';
import PageLoadingAnimation from '../components/PageLoadingAnimation';
import { useTheme } from '../context/ThemeContext';
import {
  getCachedQuizzes,
  setCachedQuizzes,
  getCachedStudyProgress,
  setCachedStudyProgress,
  getCachedStudyStructure,
  setCachedStudyStructure,
} from '../services/appStateCache';

// Persistent in-memory caches to make opening books and topics instant (0ms)
const globalQuizCache = new Map();
const globalTopicCache = new Map();
const globalQuizQuestionsCache = new Map();

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

// Helper to get a globally unique key for each question across quizzes/sets
function getQuestionKey(item, index) {
  if (item && item._id) return String(item._id);
  const quizKey = item?.quizId || item?.quizTitle || 'quiz';
  const qIdx = item?.globalIndex !== undefined ? item.globalIndex : (index !== undefined ? index : (item?.questionNumber !== undefined ? item.questionNumber - 1 : 0));
  return `${quizKey}_q_${qIdx}`;
}

// Render question text with bold **anytext** formatting
function renderFormattedQuestionText(text, isOption = false) {
  if (!text) return null;
  let str = String(text)
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<\/?(b|strong)>/gi, '**')
    .replace(/<\/?u>/gi, '');

  // Collapse consecutive bold boundary tokens like **** **** or ******* into a space
  str = str.replace(/\*{2,}\s*\*{2,}/g, ' ');

  // Normalize asymmetric/typo asterisks like *Word** or **Word* into standard **Word**
  str = str
    .replace(/(^|[^\*])\*([^\*\s][^\*]*?)\*\*([^\*]|$)/g, '$1**$2**$3')
    .replace(/(^|[^\*])\*\*([^\*\s][^\*]*?)\*([^\*]|$)/g, '$1**$2**$3');

  const regex = /(\*{2,}[^*]+\*{2,})/g;
  const parts = str.split(regex);

  return parts.map((part, idx) => {
    if (!part) return null;
    if (/^\*{2,}/.test(part) && /\*{2,}$/.test(part)) {
      const boldText = part.replace(/^\*{2,}|\*{2,}$/g, '');
      return (
        <Text
          key={idx}
          style={isOption ? styles.pdfOptionBoldText : styles.pdfQuestionBoldText}
        >
          {boldText}
        </Text>
      );
    }
    return part.replace(/\*{2,}/g, '');
  });
}

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

  const rawQText = item.questionText || '';
  const hasInlinePic = /\(\(pic\)\)/i.test(rawQText);
  let partBefore = null;
  let partAfter = null;

  if (hasInlinePic) {
    const picIdx = rawQText.search(/\(\(pic\)\)/i);
    partBefore = rawQText.slice(0, picIdx).trim();
    // Strip all remaining ((pic)) occurrences to ensure no duplicate placeholders are shown
    partAfter = rawQText.slice(picIdx).replace(/\(\(pic\)\)/gi, '').trim();
  }

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
          {/* Question Text & Diagram */}
          {hasInlinePic ? (
            <>
              {partBefore ? (
                <Text style={styles.pdfQuestionText}>
                  {renderFormattedQuestionText(partBefore)}
                </Text>
              ) : null}

              {questionPicUrl ? (
                <ZoomableImageCard
                  uri={questionPicUrl}
                  caption={`Question ${displayNumber} Diagram`}
                  theme="light"
                  style={{ marginTop: 4, marginBottom: 12 }}
                />
              ) : null}

              {partAfter ? (
                <Text style={styles.pdfQuestionText}>
                  {renderFormattedQuestionText(partAfter)}
                </Text>
              ) : null}
            </>
          ) : (
            <>
              <Text style={styles.pdfQuestionText}>
                {renderFormattedQuestionText(rawQText.replace(/\(\(pic\)\)/gi, '').trim())}
              </Text>

              {/* Question Image (displayed below question and before options when no ((pic)) in text) */}
              {questionPicUrl ? (
                <ZoomableImageCard
                  uri={questionPicUrl}
                  caption={`Question ${displayNumber} Diagram`}
                  theme="light"
                  style={{ marginTop: 8, marginBottom: 12 }}
                />
              ) : null}
            </>
          )}

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
                  <Text style={textStyle}>{renderFormattedQuestionText(optText, true)}</Text>
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
    (String(prev.item?._id || prev.item?.questionNumber) === String(next.item?._id || next.item?.questionNumber)) &&
    (String(prev.item?.quizId || prev.item?.quizTitle) === String(next.item?.quizId || next.item?.quizTitle))
  );
});


// Fallback generator for Study Directory structure from standard quizzes list
function buildStudyStructureFromQuizzes(quizList) {
  if (!Array.isArray(quizList) || quizList.length === 0) return null;

  const nmcleFiles = [];
  const paradiseFiles = [];
  const medicalFiles = [];
  const customFiles = [];
  const dynamicFoldersMap = {};
  const topicMap = {};

  const STANDARD_MEDICAL_SUBJECTS = new Set([
    'surgery',
    'medicine',
    'pediatrics',
    'gynae & obs',
    'gynae',
    'obstetrics',
    'medical',
    'medical books',
    'medical sets',
  ]);

  const DYNAMIC_THEME_COLORS = [
    { color: '#a855f7', bg: 'rgba(168, 85, 247, 0.15)' },
    { color: '#06b6d4', bg: 'rgba(6, 182, 212, 0.15)' },
    { color: '#f59e0b', bg: 'rgba(245, 158, 11, 0.15)' },
    { color: '#10b981', bg: 'rgba(16, 185, 129, 0.15)' },
    { color: '#f43f5e', bg: 'rgba(244, 63, 94, 0.15)' },
    { color: '#6366f1', bg: 'rgba(99, 102, 241, 0.15)' },
  ];

  quizList.forEach((q) => {
    const titleLower = (q.title || '').toLowerCase();
    const subjectLower = (q.subject || '').toLowerCase();

    const isCustomFlag = Boolean(
      q.isCustom === true ||
      q.creator === 'user' ||
      titleLower.includes('custom') ||
      titleLower.includes('combined')
    );

    if (Array.isArray(q.topics)) {
      q.topics.forEach((top) => {
        const trimmed = (top || '').trim();
        if (trimmed) {
          topicMap[trimmed] = (topicMap[trimmed] || 0) + 1;
        }
      });
    }

    const fileItem = {
      id: String(q._id || q.id),
      _id: String(q._id || q.id),
      title: q.title,
      subject: q.subject || 'General',
      questionCount: q.questionCount || (Array.isArray(q.questions) ? q.questions.length : 0) || 180,
      folder: q.folder || null,
      isCustom: isCustomFlag,
      updatedAt: q.updatedAt || q.createdAt,
    };

    if (isCustomFlag) {
      fileItem.folderType = 'custom';
      customFiles.push(fileItem);
    } else if (subjectLower.includes('paradise') || titleLower.includes('paradise')) {
      fileItem.folderType = 'paradise';
      paradiseFiles.push(fileItem);
    } else if (subjectLower.includes('nmcle') || titleLower.includes('nmcle')) {
      fileItem.folderType = 'nmcle';
      nmcleFiles.push(fileItem);
    } else if (STANDARD_MEDICAL_SUBJECTS.has(subjectLower)) {
      fileItem.folderType = 'book';
      medicalFiles.push(fileItem);
    } else if (q.subject && q.subject.trim() && subjectLower !== 'general') {
      const customSubjectFolder = q.subject.trim();
      fileItem.folderType = 'dynamic';
      if (!dynamicFoldersMap[customSubjectFolder]) dynamicFoldersMap[customSubjectFolder] = [];
      dynamicFoldersMap[customSubjectFolder].push(fileItem);
    } else {
      fileItem.folderType = 'book';
      medicalFiles.push(fileItem);
    }
  });

  const topicFiles = Object.keys(topicMap)
    .sort((a, b) => a.localeCompare(b))
    .map((topicName, idx) => ({
      id: `topic_${idx}`,
      title: topicName,
      bookCount: topicMap[topicName],
      folderType: 'topic',
    }));

  const totalNmcleQuestions = nmcleFiles.reduce((sum, f) => sum + (f.questionCount || 0), 0);
  const totalParadiseQuestions = paradiseFiles.reduce((sum, f) => sum + (f.questionCount || 0), 0);
  const totalMedicalQuestions = medicalFiles.reduce((sum, f) => sum + (f.questionCount || 0), 0);
  const totalCustomQuestions = customFiles.reduce((sum, f) => sum + (f.questionCount || 0), 0);

  const medicalSubjects = Array.from(new Set(medicalFiles.map(f => f.subject).filter(Boolean)));
  const medicalDesc = medicalSubjects.length > 0
    ? `${medicalSubjects.slice(0, 4).join(', ')}${medicalSubjects.length > 4 ? ' & more' : ''} (${medicalFiles.length} Books, ${totalMedicalQuestions.toLocaleString()} MCQs)`
    : `Comprehensive clinical question banks (${medicalFiles.length} Books)`;

  const folders = [
    {
      id: 'nmcle',
      name: 'NMCLE Sets',
      badge: `${nmcleFiles.length} Sets`,
      description: `${nmcleFiles.length} Official Exam & Past Papers (${totalNmcleQuestions > 0 ? totalNmcleQuestions.toLocaleString() : '5,400+'} MCQs)`,
      count: nmcleFiles.length,
      totalQuestions: totalNmcleQuestions,
      folderType: 'nmcle',
      themeColor: '#818cf8',
      themeBg: 'rgba(99, 102, 241, 0.15)',
      files: nmcleFiles,
    },
    {
      id: 'paradise',
      name: 'Paradise Sets',
      badge: `${paradiseFiles.length} Sets`,
      description: `${paradiseFiles.length} High-Yield Model Exam Sets (${totalParadiseQuestions > 0 ? totalParadiseQuestions.toLocaleString() : '3,700+'} MCQs)`,
      count: paradiseFiles.length,
      totalQuestions: totalParadiseQuestions,
      folderType: 'paradise',
      themeColor: '#ec4899',
      themeBg: 'rgba(236, 72, 153, 0.15)',
      files: paradiseFiles,
    },
    {
      id: 'medicalsets',
      name: 'Medical Sets',
      badge: `${medicalFiles.length} Books`,
      description: medicalDesc,
      count: medicalFiles.length,
      totalQuestions: totalMedicalQuestions,
      folderType: 'book',
      themeColor: '#38bdf8',
      themeBg: 'rgba(2, 132, 199, 0.15)',
      files: medicalFiles,
    },
  ];

  Object.keys(dynamicFoldersMap).forEach((fName, idx) => {
    const fFiles = dynamicFoldersMap[fName];
    const fTotalQ = fFiles.reduce((sum, f) => sum + (f.questionCount || 0), 0);
    const safeId = 'folder_' + fName.toLowerCase().replace(/[^a-z0-9]/g, '_');
    const theme = DYNAMIC_THEME_COLORS[idx % DYNAMIC_THEME_COLORS.length];

    folders.push({
      id: safeId,
      name: fName.endsWith('Sets') || fName.endsWith('sets') ? fName : `${fName} Sets`,
      badge: `${fFiles.length} Sets`,
      description: `${fFiles.length} study sets (${fTotalQ > 0 ? fTotalQ.toLocaleString() : 'Practice'} MCQs)`,
      count: fFiles.length,
      totalQuestions: fTotalQ,
      folderType: 'dynamic',
      themeColor: theme.color,
      themeBg: theme.bg,
      files: fFiles,
    });
  });

  if (topicFiles.length > 0) {
    folders.push({
      id: 'topic',
      name: 'Study by Topic',
      badge: `${topicFiles.length} Topics`,
      description: 'Targeted clinical topic modules categorized across all source books & sets',
      count: topicFiles.length,
      totalQuestions: 0,
      folderType: 'topic',
      themeColor: '#34d399',
      themeBg: 'rgba(5, 150, 105, 0.15)',
      files: topicFiles,
    });
  }

  if (customFiles.length > 0) {
    folders.push({
      id: 'custom',
      name: 'Custom Sets',
      badge: `${customFiles.length} Sets`,
      description: `Personalized practice sets created by you (${totalCustomQuestions.toLocaleString()} MCQs)`,
      count: customFiles.length,
      totalQuestions: totalCustomQuestions,
      folderType: 'custom',
      themeColor: '#fbbf24',
      themeBg: 'rgba(217, 119, 6, 0.15)',
      files: customFiles,
    });
  }

  return {
    hash: 'fallback_' + quizList.length,
    folders,
  };
}


function StudyScreen({ navigation, route, onTabPress, isActiveTab, onReady, hideBottomBar = false, onReaderModeChange }) {
  const { isGlass } = useTheme();

  // Dynamic Study Directory Folders & File Lists (Initialized with instant shared cache)
  const initialStructure = getCachedStudyStructure();
  const [folders, setFolders] = useState(initialStructure?.folders || []);
  const [foldersHash, setFoldersHash] = useState(initialStructure?.hash || null);
  const [studyProgressMap, setStudyProgressMap] = useState(getCachedStudyProgress() || {});
  
  const [loading, setLoading] = useState(!initialStructure?.folders?.length);
  const [refreshing, setRefreshing] = useState(false);
  const [loadingCardId, setLoadingCardId] = useState(null);
  const [isOpeningReader, setIsOpeningReader] = useState(false);
  const [openingTitle, setOpeningTitle] = useState('');

  // Folder Wise Navigation State: 'all' | folderId
  const [selectedFolder, setSelectedFolder] = useState('all');
  const [searchQuery, setSearchQuery] = useState('');
  
  // Card-level Answer Key Toggle states (cardId -> boolean)
  const [cardShowAnswers, setCardShowAnswers] = useState({});
  
  // Active Reader Mode State
  const [readerItem, setReaderItem] = useState(null);
  const [readerShowAnswers, setReaderShowAnswers] = useState(false);
  const [userChoices, setUserChoices] = useState({});
  const [readerFullQuestions, setReaderFullQuestions] = useState(null);

  useEffect(() => {
    if (onReaderModeChange) {
      onReaderModeChange(Boolean(readerItem));
    }
  }, [readerItem, onReaderModeChange]);
  
  // Bookmark & Navigation Index
  const [initialBookmarkIndex, setInitialBookmarkIndex] = useState(0);
  const [lastViewedIndex, setLastViewedIndex] = useState(0);
  
  const [expandedIndices, setExpandedIndices] = useState({});

  // AI Explanation & Chat states
  const [aiExplanations, setAiExplanations] = useState({});
  const [loadingAiIdx, setLoadingAiIdx] = useState(null);
  const loadingAiKeyRef = useRef(null);

  // AI Chat Modal state
  const [chatModalVisible, setChatModalVisible] = useState(false);
  const [activeQuestionForChat, setActiveQuestionForChat] = useState(null);

  const flatListRef = useRef(null);
  const readerItemRef = useRef(null);
  const userChoicesRef = useRef({});
  const readerShowAnswersRef = useRef(false);
  const foldersHashRef = useRef(foldersHash);

  const studyStateRef = useRef({
    chatModalVisible: false,
    readerItem: null,
    selectedFolder: 'all',
    searchQuery: '',
    lastViewedIndex: 0,
    userChoices: {},
    readerShowAnswers: false,
    foldersHash: null,
  });

  Object.assign(studyStateRef.current, {
    chatModalVisible,
    readerItem,
    selectedFolder,
    searchQuery,
    lastViewedIndex,
    userChoices,
    readerShowAnswers,
    foldersHash,
  });

  useEffect(() => {
    foldersHashRef.current = foldersHash;
  }, [foldersHash]);

  useEffect(() => {
    readerItemRef.current = readerItem;
  }, [readerItem]);

  useEffect(() => {
    userChoicesRef.current = userChoices;
  }, [userChoices]);

  useEffect(() => {
    readerShowAnswersRef.current = readerShowAnswers;
  }, [readerShowAnswers]);

  // Load Directory Structure & Stored Bookmarks
  const loadDirectoryData = async (showSpinner = false) => {
    try {
      const cached = getCachedStudyStructure();
      if (showSpinner && (!cached || !cached.folders || cached.folders.length === 0)) {
        setLoading(true);
      }

      // Check preserved local storage if in-memory cache was empty for 0ms instant display
      if (!cached || !cached.folders || cached.folders.length === 0) {
        const preserved = await getPreservedStudyStructure();
        if (preserved && Array.isArray(preserved.folders) && preserved.folders.length > 0) {
          setCachedStudyStructure(preserved);
          setFolders(preserved.folders);
          setFoldersHash(preserved.hash);
          setLoading(false);
        }
      }

      // Fetch DB study structure (lightweight dynamic manifest) & stored progress in parallel
      let [structureData, storedProgress] = await Promise.all([
        fetchStudyStructureApi().catch(err => {
          console.warn('Study structure API fallback:', err.message);
          return null;
        }),
        getAllStudyProgress().catch(() => ({})),
      ]);

      // Fallback: if structureData is null or missing folders, construct from quizzes API or cache
      if (!structureData || !Array.isArray(structureData.folders) || structureData.folders.length === 0) {
        try {
          let quizList = getCachedQuizzes();
          if (!quizList || !quizList.length) {
            const qRes = await fetchQuizzes().catch(() => null);
            if (qRes && Array.isArray(qRes.quizzes) && qRes.quizzes.length > 0) {
              quizList = qRes.quizzes;
              setCachedQuizzes(quizList);
            }
          }
          if (Array.isArray(quizList) && quizList.length > 0) {
            structureData = buildStudyStructureFromQuizzes(quizList);
          }
        } catch (fbErr) {
          console.warn('Fallback building study structure failed:', fbErr.message);
        }
      }

      if (structureData && Array.isArray(structureData.folders) && structureData.folders.length > 0) {
        const currentHash = foldersHashRef.current;
        // Check if DB updated: if hash differs, not yet cached, or current folders empty
        if (!currentHash || structureData.hash !== currentHash || folders.length === 0) {
          setCachedStudyStructure(structureData);
          setFolders(structureData.folders);
          setFoldersHash(structureData.hash);
          // Preserve locally in AsyncStorage
          await savePreservedStudyStructure(structureData);
        }
      }

      if (storedProgress) {
        setCachedStudyProgress(storedProgress);
        setStudyProgressMap(storedProgress);
      }
    } catch (err) {
      console.warn('Error loading study directory:', err.message);
    } finally {
      setLoading(false);
      setRefreshing(false);
      if (onReady) onReady();
    }
  };

  useEffect(() => {
    loadDirectoryData();
  }, []);

  useFocusEffect(
    useCallback(() => {
      const cached = getCachedStudyStructure();
      const cachedProgress = getCachedStudyProgress();
      if (cached && Array.isArray(cached.folders) && cached.folders.length > 0) {
        setFolders(cached.folders);
        setFoldersHash(cached.hash);
        setLoading(false);
      } else {
        loadDirectoryData();
      }
      if (cachedProgress) {
        setStudyProgressMap(cachedProgress);
      }
    }, [])
  );

  const handleRefresh = () => {
    setRefreshing(true);
    loadDirectoryData(false);
  };

  const handleTabPress = (tabName) => {
    if (onTabPress) {
      onTabPress(tabName);
    } else {
      if (tabName === 'Home') {
        navigation.navigate('Home');
      } else if (tabName === 'Quizzes') {
        navigation.navigate('Quizzes');
      } else if (tabName === 'History') {
        navigation.navigate('History');
      } else if (tabName === 'Profile') {
        navigation.navigate('Profile');
      }
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
          quizId: currentItem.id,
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
            quizId: currentItem.id,
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
          quizId: currentItem.id,
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
            quizId: currentItem.id,
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
    const targetQuizId = quizSummary?._id || quizSummary?.id;
    if (!targetQuizId) return;

    try {
      setOpeningTitle(quizSummary.title || 'Study Material');
      setIsOpeningReader(true);
      setLoadingCardId(targetQuizId);

      // Failsafe watchdog timer (ensures overlay never hangs under slow networks)
      const safetyWatchdog = setTimeout(() => {
        setIsOpeningReader(false);
        setLoadingCardId(null);
      }, 5000);

      const savedProgress = await getStudyProgress(targetQuizId);
      const bookmarkIndex = Number(savedProgress?.lastIndex || 0); // 0-based index
      const savedChoices = savedProgress?.userChoices || {};
      const isShow = cardShowAnswers[targetQuizId] ?? (savedProgress?.showAnswers || false);
      const isParadise = (quizSummary.folderType === 'paradise') || (quizSummary.title || '').toUpperCase().includes('PARADISE') || ((quizSummary.subject || '').toUpperCase().includes('PARADISE'));
      const isNmcle = !isParadise && ((quizSummary.title || '').toUpperCase().includes('NMCLE') || ((quizSummary.subject || '').toUpperCase().includes('NMCLE')));
      const folderTypeVal = isParadise ? 'paradise' : isNmcle ? 'nmcle' : 'book';

      const totalCount = quizSummary.questionCount || 180;
      const initialLimit = 20;
      // Start window directly at the marked question index
      const initialOffset = Math.max(0, Math.min(bookmarkIndex, Math.max(0, totalCount - 1)));

      // Fast initial slice fetch (~40ms) - Only fetching the active window
      const chunkRes = await fetchQuizChunkApi(targetQuizId, initialOffset, initialLimit).catch(() => null);

      let initialQuestions = [];
      if (chunkRes && chunkRes.quiz && Array.isArray(chunkRes.quiz.questions)) {
        initialQuestions = chunkRes.quiz.questions.map((q, idx) => ({
          ...q,
          quizId: targetQuizId,
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
        id: targetQuizId,
        title: quizSummary.title,
        subject: quizSummary.subject || 'General',
        type: folderTypeVal,
        folderType: folderTypeVal,
        totalCount: totalCount,
        startIndex: initialOffset,
        endIndex: initialOffset + Math.max(0, initialQuestions.length - 1),
        allQuestions: initialQuestions,
      };

      clearTimeout(safetyWatchdog);

      // Open Reader Screen IMMEDIATELY (< 60ms total response time!)
      setReaderItem(itemObj);
      persistProgress(itemObj, bookmarkIndex, savedChoices, isShow);

      // Check if full quiz questions are cached or fetch in background for counter accuracy
      const cachedFullQs = globalQuizQuestionsCache.get(targetQuizId);
      if (cachedFullQs && Array.isArray(cachedFullQs)) {
        setReaderFullQuestions(cachedFullQs);
      } else {
        setReaderFullQuestions(null);
        fetchQuizById(targetQuizId)
          .then((res) => {
            if (res && res.quiz && Array.isArray(res.quiz.questions)) {
              globalQuizQuestionsCache.set(targetQuizId, res.quiz.questions);
              if (readerItemRef.current?.id === targetQuizId) {
                setReaderFullQuestions(res.quiz.questions);
              }
            }
          })
          .catch(() => {});
      }

      setTimeout(() => {
        setIsOpeningReader(false);
        setLoadingCardId(null);
        isInitialMountRef.current = false;
      }, 300);
    } catch (err) {
      console.error('Error in instant lazy loader:', err.message);
      setIsOpeningReader(false);
      setLoadingCardId(null);
    }
  };

  // Open Topic with direct initial window from marked position
  const handleOpenTopic = async (topicCard) => {
    const topicName = topicCard.title;
    const targetClean = topicName.trim().toLowerCase();
    const topicId = topicCard.id || topicCard._id;

    try {
      setOpeningTitle(topicName || 'Topic Module');
      setIsOpeningReader(true);
      setLoadingCardId(topicId);

      const safetyWatchdog = setTimeout(() => {
        setIsOpeningReader(false);
        setLoadingCardId(null);
      }, 5000);

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
      const savedProgress = await getStudyProgress(topicId);
      const bookmarkIndex = Number(savedProgress?.lastIndex || 0);
      const savedChoices = savedProgress?.userChoices || {};
      const isShow = cardShowAnswers[topicId] ?? (savedProgress?.showAnswers || false);

      const initialOffset = Math.max(0, Math.min(bookmarkIndex, Math.max(0, totalCount - 1)));
      const initialLimit = 20;
      const slice = topicQuestions.slice(initialOffset, initialOffset + initialLimit).map((q, idx) => ({
        ...q,
        quizId: topicId,
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
        id: topicId,
        title: topicName,
        subject: 'Topic Module',
        type: 'topic',
        folderType: 'topic',
        totalCount: totalCount,
        startIndex: initialOffset,
        endIndex: initialOffset + Math.max(0, slice.length - 1),
        allQuestions: slice,
      };

      clearTimeout(safetyWatchdog);

      setReaderItem(itemObj);
      setReaderFullQuestions(topicQuestions);
      persistProgress(itemObj, bookmarkIndex, savedChoices, isShow);

      setTimeout(() => {
        setIsOpeningReader(false);
        setLoadingCardId(null);
        isInitialMountRef.current = false;
      }, 300);
    } catch (err) {
      console.error('Error loading topic lazily:', err.message);
      setIsOpeningReader(false);
      setLoadingCardId(null);
    }
  };

  const isInitialMountRef = useRef(true);

  const lastViewedIndexRef = useRef(-1);

  const handleCloseReader = useCallback(() => {
    setIsOpeningReader(false);
    setLoadingCardId(null);
    setLoadingAiIdx(null);
    setReaderFullQuestions(null);
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

  // Handle Android System Back Button cleanly when in Reader View Mode or inside Study Screen
  useEffect(() => {
    // If Study tab is not active and no reader is open, don't intercept
    if (isActiveTab === false && !readerItem) return;

    const onBackPress = () => {
      const isChat = studyStateRef.current.chatModalVisible;
      const activeReader = studyStateRef.current.readerItem;
      const activeFolder = studyStateRef.current.selectedFolder;
      const activeSearch = studyStateRef.current.searchQuery;

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
      return false; // Allow system back to return to Home tab if at top level of Study directory
    };

    const subscription = BackHandler.addEventListener('hardwareBackPress', onBackPress);
    return () => subscription.remove();
  }, [isActiveTab, readerItem, chatModalVisible, selectedFolder, searchQuery, handleCloseReader]);

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

  // Active Folder Object (if currently inside a specific folder)
  const activeFolder = useMemo(() => {
    if (selectedFolder === 'all') return null;
    return folders.find((f) => f.id === selectedFolder) || null;
  }, [folders, selectedFolder]);

  // All Cards across non-topic folders for global search
  const allCards = useMemo(() => {
    const list = [];
    folders.forEach((f) => {
      if (f.id !== 'topic') {
        list.push(...(f.files || []));
      }
    });
    return list;
  }, [folders]);

  // Determine active cards list based on selectedFolder (Memoized)
  const activeFolderCards = useMemo(() => {
    if (selectedFolder === 'all') return allCards;
    return activeFolder?.files || [];
  }, [selectedFolder, activeFolder, allCards]);

  // Filter Cards by search query (Memoized)
  const filteredCards = useMemo(() => {
    const sourceList = selectedFolder === 'all' ? allCards : (activeFolder?.files || []);
    if (!searchQuery.trim()) return sourceList;
    const query = searchQuery.toLowerCase().trim();
    return sourceList.filter((card) => {
      return (
        (card.title && card.title.toLowerCase().includes(query)) ||
        (card.subject && card.subject.toLowerCase().includes(query))
      );
    });
  }, [selectedFolder, allCards, activeFolder, searchQuery]);

  // Hardware Back Handler to navigate back to All Folders smoothly
  useEffect(() => {
    const onBackPress = () => {
      if (readerItemRef.current) {
        handleCloseReader();
        return true;
      }
      if (selectedFolder !== 'all') {
        setSelectedFolder('all');
        return true;
      }
      return false;
    };

    const backSub = BackHandler.addEventListener('hardwareBackPress', onBackPress);
    return () => backSub.remove();
  }, [selectedFolder, handleCloseReader]);

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

  const handleResetSelectedAnswers = useCallback(() => {
    const totalSelected = Object.keys(userChoices).length;
    if (totalSelected === 0) {
      Alert.alert('Reset Answers', 'No answers are currently selected in this session.');
      return;
    }

    Alert.alert(
      'Reset Selected Answers',
      `Are you sure you want to clear your selected answers for all ${totalSelected} question(s) in this document?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Reset All',
          style: 'destructive',
          onPress: () => {
            setUserChoices({});
            if (readerItemRef.current) {
              persistProgress(
                readerItemRef.current,
                lastViewedIndexRef.current >= 0 ? lastViewedIndexRef.current : 0,
                {},
                readerShowAnswersRef.current
              );
            }
          },
        },
      ]
    );
  }, [userChoices, persistProgress]);

  const handleGenerateAiExplanation = useCallback(async (item, globalIdx) => {
    const qKey = getQuestionKey(item, globalIdx);
    if (loadingAiKeyRef.current === qKey) return;
    loadingAiKeyRef.current = qKey;
    setLoadingAiIdx(qKey);
    try {
      const correctOptIdx = getCorrectOptionIndex(item);
      const correctAnswerLetter =
        item.correctAnswerLetter || optionLabels[correctOptIdx] || 'A';

      const res = await fetchAiExplanationApi({
        questionText: item.questionText,
        options: item.options || [],
        correctAnswerLetter,
        explanation: item.explanation || '',
        forceRefresh: Boolean(aiExplanations[qKey] || item.aiExplanation),
      });

      if (res && res.explanation) {
        setAiExplanations((prev) => ({
          ...prev,
          [qKey]: res.explanation,
        }));
        setReaderItem((prev) => {
          if (!prev || !Array.isArray(prev.allQuestions)) return prev;
          const updated = prev.allQuestions.map((q, qIdx) => {
            const thisKey = getQuestionKey(q, q.globalIndex !== undefined ? q.globalIndex : qIdx);
            if (thisKey === qKey) {
              return { ...q, aiExplanation: res.explanation };
            }
            return q;
          });
          return { ...prev, allQuestions: updated };
        });
      }
    } catch (err) {
      console.error('Error fetching AI explanation in Study mode:', err);
      Alert.alert(
        'AI Explanation',
        err.response?.data?.message || err.message || 'AI service is temporarily busy. Please try again in a moment!'
      );
    } finally {
      loadingAiKeyRef.current = null;
      setLoadingAiIdx(null);
    }
  }, []);

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
    return getQuestionKey(item, index);
  }, []);

  const renderQuestionItem = useCallback(({ item, index }) => {
    const globalIdx = item.globalIndex !== undefined ? item.globalIndex : index;
    const qKey = getQuestionKey(item, globalIdx);
    const hasAiExplanation = aiExplanations[qKey] || item.aiExplanation;
    const isThisLoading = loadingAiIdx === qKey || (loadingAiIdx !== null && (loadingAiIdx === globalIdx || loadingAiIdx === item.questionNumber));

    return (
      <PdfQuestionCard
        item={item}
        index={globalIdx}
        isExpanded={expandedIndices[globalIdx] !== false}
        onToggleExpand={toggleExpand}
        showAnswers={readerShowAnswers}
        userChoice={userChoices[globalIdx]}
        onSelectOption={handleSelectOption}
        aiExplanation={hasAiExplanation}
        isLoadingAi={Boolean(isThisLoading)}
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

  // Memoized count of ONLY the correct answers selected in the study PDF view page
  const correctAnswersCount = useMemo(() => {
    if (!readerItem || !userChoices) return 0;

    const choiceKeys = Object.keys(userChoices);
    if (choiceKeys.length === 0) return 0;

    // Fast question lookup map
    const qMap = new Map();

    // 1. Full questions from state or global cache
    const fullList =
      readerFullQuestions ||
      (readerItem.id ? globalQuizQuestionsCache.get(readerItem.id) : null);
    if (Array.isArray(fullList)) {
      fullList.forEach((q, idx) => {
        const gIdx = q.globalIndex !== undefined ? q.globalIndex : idx;
        qMap.set(gIdx, q);
        qMap.set(String(gIdx), q);
      });
    }

    // 2. Global topic cache if topic module
    if (readerItem.type === 'topic' && readerItem.title) {
      const topicQs = globalTopicCache.get(readerItem.title.trim().toLowerCase());
      if (Array.isArray(topicQs)) {
        topicQs.forEach((q, idx) => {
          const gIdx = q.globalIndex !== undefined ? q.globalIndex : idx;
          qMap.set(gIdx, q);
          qMap.set(String(gIdx), q);
        });
      }
    }

    // 3. Questions currently rendered in readerItem.allQuestions
    if (Array.isArray(readerItem.allQuestions)) {
      readerItem.allQuestions.forEach((q, idx) => {
        const gIdx = q.globalIndex !== undefined ? q.globalIndex : idx;
        qMap.set(gIdx, q);
        qMap.set(String(gIdx), q);
      });
    }

    let count = 0;
    for (const key of choiceKeys) {
      const selectedOpt = userChoices[key];
      if (selectedOpt === undefined || selectedOpt === null) continue;

      const q = qMap.get(key) ?? qMap.get(Number(key));
      if (q) {
        const correctIdx = getCorrectOptionIndex(q);
        if (Number(selectedOpt) === Number(correctIdx)) {
          count++;
        }
      }
    }

    return count;
  }, [readerItem, userChoices, readerFullQuestions]);

  // ----------------------------------------------------
  // FULL SCREEN READER VIEW (100% Native 60fps/120fps Smooth Scroll in Both Directions)
  // ----------------------------------------------------
  if (readerItem) {
    const readerTypeLabel =
      readerItem.type === 'topic'
        ? 'Topic Module'
        : readerItem.type === 'paradise' || readerItem.folderType === 'paradise'
        ? 'Paradise Set'
        : readerItem.type === 'nmcle' || readerItem.folderType === 'nmcle'
        ? 'NMCLE Set'
        : 'Medical Book';

    const readerBannerBadgeLabel =
      readerItem.type === 'topic'
        ? 'TOPIC MODULE'
        : readerItem.type === 'paradise' || readerItem.folderType === 'paradise'
        ? 'PARADISE MODEL SET'
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
            accessibilityLabel="Back to Directory"
          >
            <ArrowLeft size={19} color="#0f172a" />
          </TouchableOpacity>

          <View style={{ flex: 1, marginHorizontal: 8 }}>
            <Text style={styles.pdfHeaderTitle} numberOfLines={1}>
              {readerItem.title}
            </Text>
            <Text style={styles.pdfHeaderSubtitle}>
              Q{lastViewedIndex + 1} of {totalDocCount} • {readerTypeLabel}
            </Text>
          </View>

          {/* Right Top Action Buttons Row: Correct Counter, Answers Toggle & Reset Answers Button */}
          <View style={styles.pdfHeaderRightRow}>
            {/* Correct Answers Counter Badge (Only displays the number of correct answers selected) */}
            <View
              style={styles.pdfCorrectCounterBadge}
              accessibilityLabel={`Correct Answers: ${correctAnswersCount}`}
            >
              <Check size={13} color="#059669" strokeWidth={2.5} />
              <Text style={styles.pdfCorrectCounterText}>{correctAnswersCount}</Text>
            </View>

            {/* Interactive Answer Key Toggle Switch in PDF Header */}
            <TouchableOpacity
              style={[
                styles.pdfToggleBtn,
                readerShowAnswers && styles.pdfToggleBtnActive,
              ]}
              onPress={() => setReaderShowAnswers(!readerShowAnswers)}
              activeOpacity={0.8}
              accessibilityLabel={readerShowAnswers ? "Answers: ON" : "Answers: OFF"}
            >
              {readerShowAnswers ? (
                <Eye size={17} color="#059669" />
              ) : (
                <EyeOff size={17} color="#64748b" />
              )}
            </TouchableOpacity>

            {/* Reset Selected Answers Icon Button */}
            <TouchableOpacity
              style={styles.pdfResetBtn}
              onPress={handleResetSelectedAnswers}
              activeOpacity={0.7}
              accessibilityLabel="Reset Selected Answers"
            >
              <RotateCcw size={15} color="#475569" />
            </TouchableOpacity>
          </View>
        </View>

        {/* PDF Document Questions Virtualized FlatList Optimized for Max Refresh Rate (60/90/120fps) */}
        <FlatList
          ref={flatListRef}
          data={readerItem.allQuestions}
          extraData={{
            aiExplanations,
            loadingAiIdx,
            expandedIndices,
            userChoices,
            readerShowAnswers,
          }}
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

        {/* Full screen loading animation during opening transitions */}
        {(isOpeningReader || loadingCardId) && (
          <PageLoadingAnimation
            fullScreen
            title={`Opening ${openingTitle || 'Study Material'}...`}
            subtitle="Preparing MCQs, Answer Keys & AI Tutor..."
            icon={BookOpen}
            onDismiss={() => {
              setIsOpeningReader(false);
              setLoadingCardId(null);
            }}
          />
        )}
      </SafeAreaView>
    );
  }

  // ----------------------------------------------------
  // DIRECTORY MAIN VIEW (With Saved Bookmarks & Progress Badges)
  // ----------------------------------------------------
  return (
    <SafeAreaView
      edges={hideBottomBar ? ['top', 'left', 'right'] : ['top', 'bottom', 'left', 'right']}
      style={[styles.container, isGlass && styles.containerGlass]}
    >
      {/* Header */}
      <View style={[styles.header, isGlass && styles.headerGlass]}>
        <View style={{ flex: 1 }}>
          <View style={styles.headerTitleRow}>
            <GraduationCap size={22} color="#818cf8" style={{ marginRight: 8 }} />
            <Text style={[styles.headerTitle, isGlass && { color: '#0f172a' }]}>Study Directory</Text>
            <View style={styles.aiBadge}>
              <Sparkles size={10} color="#a855f7" />
              <Text style={styles.aiBadgeText}>AI Tutor</Text>
            </View>
          </View>
          <Text style={[styles.headerSubtitle, isGlass && { color: '#64748b' }]}>
            Select a Book or Topic to read in Full-Screen PDF view
          </Text>
        </View>
      </View>

      {/* Breadcrumb Bar when inside a specific folder */}
      {selectedFolder !== 'all' && (
        <View style={[styles.breadcrumbBar, isGlass && styles.breadcrumbBarGlass]}>
          <TouchableOpacity
            style={styles.breadcrumbBackBtn}
            onPress={() => setSelectedFolder('all')}
            activeOpacity={0.8}
          >
            <ArrowLeft size={14} color="#818cf8" style={{ marginRight: 4 }} />
            <Text style={styles.breadcrumbBackText}>All Folders</Text>
          </TouchableOpacity>
          <ChevronRight size={13} color="#64748b" style={{ marginHorizontal: 4 }} />
          <Text style={[styles.breadcrumbActiveText, isGlass && { color: '#0f172a' }]} numberOfLines={1}>
            {activeFolder ? `${activeFolder.name} (${activeFolder.files ? activeFolder.files.length : 0})` : 'Folder'}
          </Text>
        </View>
      )}

      {/* Search Bar */}
      <View style={styles.searchContainer}>
        <View style={[styles.searchWrapper, isGlass && styles.searchWrapperGlass]}>
          <Search size={16} color="#64748b" style={styles.searchIcon} />
          <TextInput
            style={[styles.searchInput, isGlass && { color: '#0f172a' }]}
            placeholder={
              activeFolder
                ? `Search in ${activeFolder.name}...`
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

      {/* Main Body: Either Dynamic Folder Dashboard (when 'all' and no search) or Cards List */}
      {loading && folders.length === 0 ? (
        <PageLoadingAnimation
          title="Loading Study Directory..."
          subtitle="Organizing medical books, NMCLE sets & topics..."
          icon={GraduationCap}
        />
      ) : selectedFolder === 'all' && !searchQuery.trim() ? (
        folders.length === 0 ? (
          <View style={styles.emptyContainer}>
            <BookOpen size={48} color={isGlass ? '#94a3b8' : '#475569'} />
            <Text style={[styles.emptyTitle, isGlass && { color: '#0f172a' }]}>
              {loading ? 'Loading Study Directory...' : 'No Study Sets Found'}
            </Text>
            <Text style={[styles.emptySubtitle, isGlass && { color: '#64748b' }]}>
              {loading
                ? 'Preparing medical books, NMCLE sets & topics...'
                : 'Unable to load study materials. Tap below to reload.'}
            </Text>
            {!loading && (
              <TouchableOpacity
                style={[styles.reloadBtn, isGlass && styles.reloadBtnGlass]}
                onPress={() => loadDirectoryData(true)}
                activeOpacity={0.8}
              >
                <RotateCcw size={16} color="#ffffff" style={{ marginRight: 6 }} />
                <Text style={styles.reloadBtnText}>Reload Study Directory</Text>
              </TouchableOpacity>
            )}
          </View>
        ) : (
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
            {folders.map((folder) => {
            const folderColor = folder.themeColor || '#818cf8';
            const folderBg = folder.themeBg || 'rgba(99, 102, 241, 0.15)';
            const isNmcle = folder.id === 'nmcle' || folder.folderType === 'nmcle';
            const isParadise = folder.id === 'paradise' || folder.folderType === 'paradise';
            const isBook = folder.id === 'medicalsets' || folder.folderType === 'book';
            const isTopic = folder.id === 'topic' || folder.folderType === 'topic';
            const isCustom = folder.id === 'custom' || folder.folderType === 'custom';

            const cardStyle = isNmcle
              ? styles.folderCardNmcle
              : isParadise
              ? styles.folderCardParadise
              : isBook
              ? styles.folderCardBook
              : isTopic
              ? styles.folderCardTopic
              : isCustom
              ? styles.folderCardCustom
              : { borderColor: folderColor, backgroundColor: '#181f38' };

            const glassStyle = isNmcle
              ? styles.folderCardNmcleGlass
              : isParadise
              ? styles.folderCardParadiseGlass
              : isBook
              ? styles.folderCardBookGlass
              : isTopic
              ? styles.folderCardTopicGlass
              : isCustom
              ? styles.folderCardCustomGlass
              : styles.folderOverviewCardGlass;

            return (
              <TouchableOpacity
                key={folder.id}
                style={[
                  styles.folderOverviewCard,
                  cardStyle,
                  isGlass && glassStyle,
                ]}
                activeOpacity={0.85}
                onPress={() => setSelectedFolder(folder.id)}
              >
                <View style={styles.folderCardHeader}>
                  <Text style={[styles.folderCardTitle, isGlass && { color: '#0f172a' }]}>
                    {folder.name}
                  </Text>
                  <View style={[styles.folderBadge, { backgroundColor: folderBg }]}>
                    <Text style={[styles.folderBadgeText, { color: folderColor }]}>
                      {folder.badge || `${folder.count} Items`}
                    </Text>
                  </View>
                </View>
                <Text style={[styles.folderCardDesc, isGlass && { color: '#64748b' }]}>
                  {folder.description}
                </Text>
                <View style={styles.folderCardFooter}>
                  <Text style={[styles.folderExploreText, { color: folderColor }]}>
                    {isTopic ? 'Explore Topics' : `Open Folder (${folder.count} ${isBook ? 'Books' : 'Sets'})`}
                  </Text>
                  <ChevronRight size={14} color={folderColor} />
                </View>
              </TouchableOpacity>
            );
          })}
        </ScrollView>
        )
      ) : filteredCards.length === 0 ? (
        <View style={styles.emptyContainer}>
          <BookOpen size={48} color={isGlass ? '#94a3b8' : '#475569'} />
          <Text style={[styles.emptyTitle, isGlass && { color: '#0f172a' }]}>No Content Found</Text>
          <Text style={[styles.emptySubtitle, isGlass && { color: '#64748b' }]}>
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
                style={[styles.directoryCard, isGlass && styles.directoryCardGlass]}
                activeOpacity={0.8}
                onPress={() =>
                  isTopicItem
                    ? handleOpenTopic(item)
                    : handleOpenBook(item)
                }
                disabled={isCardLoading}
              >
                <View style={styles.cardHeaderRow}>
                  <Text style={[styles.cardTitle, isGlass && { color: '#0f172a' }]} numberOfLines={1}>
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
                  <Text style={[styles.cardSubject, isGlass && { color: '#64748b' }]}>Subject: {item.subject}</Text>
                ) : (
                  <Text style={[styles.cardSubject, isGlass && { color: '#64748b' }]}>Topic Module</Text>
                )}

                {/* Bookmark Study Progress Bar & Badge */}
                {hasBookmark ? (
                  <View style={[styles.cardProgressContainer, isGlass && styles.cardProgressContainerGlass]}>
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

                    <View style={[styles.progressBarTrack, isGlass && { backgroundColor: '#e2e8f0' }]}>
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

      {/* Instant Interactive Loading Overlay when opening a Book or Topic */}
      {(isOpeningReader || loadingCardId) && (
        <PageLoadingAnimation
          fullScreen
          title={`Opening ${openingTitle || 'Study Material'}...`}
          subtitle="Preparing MCQs, Answer Keys & AI Tutor..."
          icon={BookOpen}
          onDismiss={() => {
            setIsOpeningReader(false);
            setLoadingCardId(null);
          }}
        />
      )}

      {/* Fixed Bottom Navigation Footer Bar */}
      {!hideBottomBar && <BottomTabBar activeTab="Study" onTabPress={handleTabPress} />}
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
  folderCardParadise: {
    borderColor: 'rgba(236, 72, 153, 0.4)',
    backgroundColor: '#2e1529',
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
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#f1f5f9',
    width: 34,
    height: 34,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#e2e8f0',
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
  pdfHeaderRightRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  pdfCorrectCounterBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#ecfdf5',
    paddingHorizontal: 8,
    height: 34,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#a7f3d0',
    gap: 4,
  },
  pdfCorrectCounterText: {
    fontSize: 13,
    fontWeight: '800',
    color: '#059669',
  },
  pdfResetBtn: {
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#f1f5f9',
    width: 34,
    height: 34,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#cbd5e1',
  },
  pdfToggleBtn: {
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#f1f5f9',
    width: 34,
    height: 34,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#cbd5e1',
  },
  pdfToggleBtnActive: {
    backgroundColor: '#ecfdf5',
    borderColor: '#10b981',
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
    fontWeight: '600',
    color: '#1e293b',
    lineHeight: 22,
    marginBottom: 10,
  },
  pdfQuestionBoldText: {
    fontWeight: '800',
    color: '#000000',
  },
  pdfOptionBoldText: {
    fontWeight: '800',
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
    marginTop: 12,
    paddingHorizontal: 14,
    paddingVertical: 12,
    borderRadius: 12,
    backgroundColor: '#faf5ff',
    borderWidth: 1.5,
    borderColor: '#d8b4fe',
    overflow: 'hidden',
    width: '100%',
    flexShrink: 1,
    shadowColor: '#a855f7',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 6,
    elevation: 2,
  },
  pdfAiExpHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#ede9fe',
    paddingBottom: 6,
  },
  pdfAiBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#7c3aed',
    paddingHorizontal: 7,
    paddingVertical: 3,
    borderRadius: 6,
    marginRight: 8,
  },
  pdfAiBadgeText: {
    fontSize: 9.5,
    fontWeight: '800',
    color: '#ffffff',
    marginLeft: 4,
    letterSpacing: 0.3,
  },
  pdfAiExpTitle: {
    fontSize: 13,
    fontWeight: '800',
    color: '#581c87',
  },
  pdfAiBtnRow: {
    flexDirection: 'row',
    gap: 8,
    marginTop: 12,
  },
  pdfAiExplainBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#f5f3ff',
    paddingVertical: 10,
    borderRadius: 8,
    borderWidth: 1.5,
    borderColor: '#c084fc',
  },
  pdfAiExplainBtnText: {
    color: '#7c3aed',
    fontSize: 12,
    fontWeight: '700',
    marginLeft: 5,
  },
  pdfAiChatBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#6366f1',
    paddingVertical: 10,
    borderRadius: 8,
  },
  pdfAiChatBtnText: {
    color: '#ffffff',
    fontSize: 12,
    fontWeight: '700',
    marginLeft: 5,
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
  breadcrumbBarGlass: {
    backgroundColor: '#ffffff',
    borderBottomColor: '#e2e8f0',
  },
  searchWrapperGlass: {
    backgroundColor: '#ffffff',
    borderColor: '#e2e8f0',
    shadowColor: '#64748b',
    shadowOpacity: 0.05,
    shadowRadius: 4,
  },
  folderOverviewCardGlass: {
    backgroundColor: '#ffffff',
    borderColor: '#e2e8f0',
    shadowColor: '#64748b',
    shadowOpacity: 0.06,
    shadowRadius: 8,
    elevation: 2,
  },
  folderCardNmcleGlass: {
    backgroundColor: '#ffffff',
    borderColor: '#e2e8f0',
    borderLeftWidth: 4,
    borderLeftColor: '#6366f1',
    shadowColor: '#64748b',
    shadowOpacity: 0.06,
    shadowRadius: 8,
    elevation: 2,
  },
  folderCardParadiseGlass: {
    backgroundColor: '#ffffff',
    borderColor: '#e2e8f0',
    borderLeftWidth: 4,
    borderLeftColor: '#ec4899',
    shadowColor: '#64748b',
    shadowOpacity: 0.06,
    shadowRadius: 8,
    elevation: 2,
  },
  folderCardBookGlass: {
    backgroundColor: '#ffffff',
    borderColor: '#e2e8f0',
    borderLeftWidth: 4,
    borderLeftColor: '#0284c7',
    shadowColor: '#64748b',
    shadowOpacity: 0.06,
    shadowRadius: 8,
    elevation: 2,
  },
  folderCardTopicGlass: {
    backgroundColor: '#ffffff',
    borderColor: '#e2e8f0',
    borderLeftWidth: 4,
    borderLeftColor: '#059669',
    shadowColor: '#64748b',
    shadowOpacity: 0.06,
    shadowRadius: 8,
    elevation: 2,
  },
  folderCardCustomGlass: {
    backgroundColor: '#ffffff',
    borderColor: '#e2e8f0',
    borderLeftWidth: 4,
    borderLeftColor: '#d97706',
    shadowColor: '#64748b',
    shadowOpacity: 0.06,
    shadowRadius: 8,
    elevation: 2,
  },
  directoryCardGlass: {
    backgroundColor: '#ffffff',
    borderColor: '#e2e8f0',
    shadowColor: '#64748b',
    shadowOpacity: 0.06,
    shadowRadius: 8,
    elevation: 2,
  },
  cardProgressContainerGlass: {
    backgroundColor: '#f8fafc',
    borderColor: '#e2e8f0',
  },
  reloadBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#6366f1',
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 10,
    marginTop: 14,
  },
  reloadBtnGlass: {
    backgroundColor: '#4f46e5',
  },
  reloadBtnText: {
    color: '#ffffff',
    fontSize: 14,
    fontWeight: '700',
  },
});

export default memo(StudyScreen);
