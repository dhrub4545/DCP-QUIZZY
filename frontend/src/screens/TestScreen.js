import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  ActivityIndicator,
  Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Clock, ArrowLeft, ArrowRight, CheckCircle, HelpCircle, X } from 'lucide-react-native';
import { fetchQuizById } from '../services/api';
import MarkdownRenderer from '../components/MarkdownRenderer';

export default function TestScreen({ route, navigation }) {
  const {
    quizId,
    quiz: paramQuiz,
    questions: paramQuestions,
    configOptions,
    config: paramConfig,
  } = route.params || {};

  const activeConfig = configOptions || paramConfig || {};
  const [quiz, setQuiz] = useState(null);
  const [loading, setLoading] = useState(true);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [userAnswers, setUserAnswers] = useState({});
  const [timeLeft, setTimeLeft] = useState(activeConfig.timerSeconds || 0);
  const [showExplanation, setShowExplanation] = useState(false);
  const [startTime] = useState(Date.now());

  useEffect(() => {
    const initTest = async () => {
      try {
        setLoading(true);

        // Scenario A: Pre-configured quiz & questions passed in route.params
        if (paramQuiz && Array.isArray(paramQuestions) && paramQuestions.length > 0) {
          setQuiz({
            ...paramQuiz,
            questions: paramQuestions,
            questionCount: paramQuestions.length,
          });
          setLoading(false);
          return;
        }

        // Scenario B: Quiz object passed with embedded questions
        if (paramQuiz && Array.isArray(paramQuiz.questions) && paramQuiz.questions.length > 0) {
          setQuiz(paramQuiz);
          setLoading(false);
          return;
        }

        // Scenario C: quizId or paramQuiz._id passed -> fetch from backend
        const targetId = quizId || paramQuiz?._id;
        if (targetId) {
          const data = await fetchQuizById(targetId);
          if (data && data.quiz) {
            setQuiz(data.quiz);
          } else {
            Alert.alert('Error', 'Failed to load quiz questions.');
            navigation.goBack();
          }
        } else {
          Alert.alert('Error', 'No valid quiz or questions provided.');
          navigation.goBack();
        }
      } catch (err) {
        console.error('Error initializing TestScreen:', err);
        Alert.alert('Error', err.message || 'Could not fetch quiz questions.');
        navigation.goBack();
      } finally {
        setLoading(false);
      }
    };

    initTest();
  }, [route.params]);

  const submitTest = () => {
    const timeSpentSeconds = Math.round((Date.now() - startTime) / 1000);
    navigation.replace('Result', {
      quiz,
      userAnswers,
      timeSpentSeconds,
    });
  };

  const confirmSubmitTest = () => {
    const totalQ = quiz?.questions?.length || 0;
    const answeredCount = Object.keys(userAnswers).length;
    const unansweredCount = totalQ - answeredCount;

    let message = 'Are you sure you want to submit your test answers?';
    if (unansweredCount > 0) {
      message = `You still have ${unansweredCount} unanswered questions. Submit anyway?`;
    }

    Alert.alert('Submit Test', message, [
      { text: 'Continue Test', style: 'cancel' },
      {
        text: 'Submit Now',
        onPress: submitTest,
      },
    ]);
  };

  const handleNextQuestion = () => {
    setShowExplanation(false);
    const totalQ = quiz?.questions?.length || 0;
    if (currentIndex < totalQ - 1) {
      setCurrentIndex((prev) => prev + 1);
    } else {
      confirmSubmitTest();
    }
  };

  const handlePrevQuestion = () => {
    setShowExplanation(false);
    if (currentIndex > 0) {
      setCurrentIndex((prev) => prev - 1);
    }
  };

  // Per-question timer logic
  useEffect(() => {
    if (!activeConfig?.timerSeconds || activeConfig.timerSeconds <= 0) return;

    setTimeLeft(activeConfig.timerSeconds);
    const interval = setInterval(() => {
      setTimeLeft((prev) => {
        if (prev <= 1) {
          // Auto advance when timer hits 0
          handleNextQuestion();
          return activeConfig.timerSeconds;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(interval);
  }, [currentIndex, activeConfig?.timerSeconds, quiz]);

  if (loading || !quiz) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator size="large" color="#6366f1" />
        <Text style={styles.loadingText}>Loading Quiz Questions...</Text>
      </View>
    );
  }

  const questions = quiz.questions || [];
  const currentQ = questions[currentIndex];
  const totalQ = questions.length;
  const isLastQuestion = currentIndex === totalQ - 1;

  const handleSelectOption = (optionIndex) => {
    setUserAnswers((prev) => ({
      ...prev,
      [currentIndex]: optionIndex,
    }));
  };

  const optionLabels = ['A', 'B', 'C', 'D'];

  return (
    <SafeAreaView style={styles.container}>
      {/* Top Header Navigation */}
      <View style={styles.topNav}>
        <TouchableOpacity style={styles.iconNavBtn} onPress={() => confirmSubmitTest()}>
          <X color="#94a3b8" size={22} />
        </TouchableOpacity>

        <View style={styles.titleBox}>
          <Text style={styles.navTitle} numberOfLines={1}>{quiz.title}</Text>
          <Text style={styles.navSubtitle}>Question {currentIndex + 1} of {totalQ}</Text>
        </View>

        {activeConfig?.timerSeconds > 0 && (
          <View style={[styles.timerBadge, timeLeft <= 5 && styles.timerBadgeLow]}>
            <Clock color={timeLeft <= 5 ? '#f87171' : '#818cf8'} size={14} />
            <Text style={[styles.timerText, timeLeft <= 5 && styles.timerTextLow]}>{timeLeft}s</Text>
          </View>
        )}
      </View>

      {/* Progress Bar */}
      <View style={styles.progressTrack}>
        <View
          style={[
            styles.progressFill,
            { width: `${((currentIndex + 1) / totalQ) * 100}%` },
          ]}
        />
      </View>

      {/* Question Content Scroll */}
      <ScrollView contentContainerStyle={styles.scrollContent}>
        <View style={styles.questionCard}>
          <View style={styles.qNumBadge}>
            <Text style={styles.qNumBadgeText}>Q{currentIndex + 1}</Text>
          </View>
          <Text style={styles.questionText}>
            {currentQ?.questionText || 'Question text unavailable'}
          </Text>
        </View>

        {/* Options */}
        <View style={styles.optionsList}>
          {(currentQ?.options || []).map((optText, optIdx) => {
            const isSelected = userAnswers[currentIndex] === optIdx;

            return (
              <TouchableOpacity
                key={optIdx}
                activeOpacity={0.8}
                style={[
                  styles.optionCard,
                  isSelected && styles.optionCardSelected,
                ]}
                onPress={() => handleSelectOption(optIdx)}
              >
                <View
                  style={[
                    styles.optionLabelCircle,
                    isSelected && styles.optionLabelCircleSelected,
                  ]}
                >
                  <Text
                    style={[
                      styles.optionLabelText,
                      isSelected && styles.optionLabelTextSelected,
                    ]}
                  >
                    {optionLabels[optIdx]}
                  </Text>
                </View>
                <Text
                  style={[
                    styles.optionText,
                    isSelected && styles.optionTextSelected,
                  ]}
                >
                  {optText}
                </Text>
              </TouchableOpacity>
            );
          })}
        </View>

        {/* Optional Explanation Toggle */}
        {currentQ?.explanation && (
          <View style={styles.explanationSection}>
            <TouchableOpacity
              style={styles.expToggleBtn}
              onPress={() => setShowExplanation(!showExplanation)}
            >
              <HelpCircle color="#a855f7" size={16} />
              <Text style={styles.expToggleText}>
                {showExplanation ? 'Hide Explanation' : 'View Explanation'}
              </Text>
            </TouchableOpacity>

            {showExplanation && (
              <View style={styles.expBox}>
                <Text style={styles.expTitle}>Explanation:</Text>
                <MarkdownRenderer content={currentQ.explanation} />
              </View>
            )}
          </View>
        )}
      </ScrollView>

      {/* Bottom Footer Navigation Controls */}
      <View style={styles.bottomBar}>
        <TouchableOpacity
          style={[styles.navBtn, currentIndex === 0 && styles.navBtnDisabled]}
          disabled={currentIndex === 0}
          onPress={handlePrevQuestion}
        >
          <ArrowLeft color={currentIndex === 0 ? '#475569' : '#f8fafc'} size={18} />
          <Text style={[styles.navBtnText, currentIndex === 0 && styles.navBtnTextDisabled]}>
            Previous
          </Text>
        </TouchableOpacity>

        {isLastQuestion ? (
          <TouchableOpacity style={styles.submitBtn} onPress={confirmSubmitTest}>
            <CheckCircle color="#ffffff" size={18} style={{ marginRight: 6 }} />
            <Text style={styles.submitBtnText}>Submit Test</Text>
          </TouchableOpacity>
        ) : (
          <TouchableOpacity style={styles.nextBtn} onPress={handleNextQuestion}>
            <Text style={styles.nextBtnText}>Next</Text>
            <ArrowRight color="#ffffff" size={18} style={{ marginLeft: 6 }} />
          </TouchableOpacity>
        )}
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0f172a',
  },
  centered: {
    flex: 1,
    backgroundColor: '#0f172a',
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    color: '#94a3b8',
    marginTop: 12,
    fontSize: 14,
  },
  topNav: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  iconNavBtn: {
    padding: 6,
  },
  titleBox: {
    flex: 1,
    marginLeft: 10,
  },
  navTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#f8fafc',
  },
  navSubtitle: {
    fontSize: 12,
    color: '#94a3b8',
  },
  timerBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(99, 102, 241, 0.15)',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#6366f1',
  },
  timerBadgeLow: {
    backgroundColor: 'rgba(239, 68, 68, 0.15)',
    borderColor: '#ef4444',
  },
  timerText: {
    color: '#818cf8',
    fontWeight: '700',
    fontSize: 13,
    marginLeft: 4,
  },
  timerTextLow: {
    color: '#f87171',
  },
  progressTrack: {
    height: 4,
    backgroundColor: '#1e293b',
    width: '100%',
  },
  progressFill: {
    height: '100%',
    backgroundColor: '#6366f1',
  },
  scrollContent: {
    padding: 20,
    paddingBottom: 40,
  },
  questionCard: {
    backgroundColor: '#1e293b',
    borderRadius: 16,
    padding: 20,
    marginBottom: 20,
    borderWidth: 1,
    borderColor: '#334155',
  },
  qNumBadge: {
    alignSelf: 'flex-start',
    backgroundColor: 'rgba(99, 102, 241, 0.15)',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 8,
    marginBottom: 10,
  },
  qNumBadgeText: {
    color: '#818cf8',
    fontSize: 12,
    fontWeight: '700',
  },
  questionText: {
    fontSize: 17,
    fontWeight: '600',
    color: '#f8fafc',
    lineHeight: 24,
  },
  optionsList: {
    gap: 12,
  },
  optionCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#1e293b',
    borderRadius: 14,
    padding: 16,
    borderWidth: 1.5,
    borderColor: '#334155',
  },
  optionCardSelected: {
    borderColor: '#6366f1',
    backgroundColor: 'rgba(99, 102, 241, 0.12)',
  },
  optionLabelCircle: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#334155',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 14,
  },
  optionLabelCircleSelected: {
    backgroundColor: '#6366f1',
  },
  optionLabelText: {
    fontSize: 14,
    fontWeight: '700',
    color: '#cbd5e1',
  },
  optionLabelTextSelected: {
    color: '#ffffff',
  },
  optionText: {
    fontSize: 15,
    color: '#cbd5e1',
    flex: 1,
    lineHeight: 20,
  },
  optionTextSelected: {
    color: '#f8fafc',
    fontWeight: '600',
  },
  explanationSection: {
    marginTop: 24,
  },
  expToggleBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
  },
  expToggleText: {
    color: '#c084fc',
    fontSize: 13,
    fontWeight: '600',
    marginLeft: 6,
  },
  expBox: {
    marginTop: 10,
    backgroundColor: 'rgba(168, 85, 247, 0.1)',
    borderRadius: 12,
    padding: 14,
    borderWidth: 1,
    borderColor: 'rgba(168, 85, 247, 0.3)',
  },
  expTitle: {
    fontSize: 13,
    fontWeight: '700',
    color: '#c084fc',
    marginBottom: 4,
  },
  expBody: {
    fontSize: 13,
    color: '#e2e8f0',
    lineHeight: 18,
  },
  bottomBar: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 14,
    backgroundColor: '#1e293b',
    borderTopWidth: 1,
    borderColor: '#334155',
  },
  navBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderRadius: 10,
    backgroundColor: '#334155',
  },
  navBtnDisabled: {
    backgroundColor: '#0f172a',
  },
  navBtnText: {
    color: '#f8fafc',
    fontWeight: '600',
    fontSize: 14,
    marginLeft: 6,
  },
  navBtnTextDisabled: {
    color: '#475569',
  },
  nextBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#6366f1',
    paddingVertical: 10,
    paddingHorizontal: 20,
    borderRadius: 10,
  },
  nextBtnText: {
    color: '#ffffff',
    fontWeight: '700',
    fontSize: 14,
  },
  submitBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#22c55e',
    paddingVertical: 10,
    paddingHorizontal: 20,
    borderRadius: 10,
  },
  submitBtnText: {
    color: '#ffffff',
    fontWeight: '700',
    fontSize: 14,
  },
});
