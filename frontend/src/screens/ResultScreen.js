import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Award, CheckCircle2, XCircle, HelpCircle, RotateCcw, Home, ChevronDown, ChevronUp, Sparkles, Lightbulb, MessageSquare } from 'lucide-react-native';
import MarkdownRenderer from '../components/MarkdownRenderer';
import AiChatModal from '../components/AiChatModal';
import { saveHistoryApi, fetchAiExplanationApi } from '../services/api';

export default function ResultScreen({ route, navigation }) {
  const { quiz, userAnswers = {}, timeSpentSeconds = 0 } = route.params || {};

  const [expandedIndex, setExpandedIndex] = useState(null);
  const [historySaved, setHistorySaved] = useState(false);

  // AI Explanation & Chat states
  const [aiExplanations, setAiExplanations] = useState({});
  const [loadingAiIdx, setLoadingAiIdx] = useState(null);

  // AI Chat Modal state
  const [chatModalVisible, setChatModalVisible] = useState(false);
  const [activeQuestionForChat, setActiveQuestionForChat] = useState(null);

  const questions = quiz?.questions || [];
  const totalCount = questions.length;

  let correctCount = 0;
  let incorrectCount = 0;
  let skippedCount = 0;

  const optionLabels = ['A', 'B', 'C', 'D', 'E', 'F'];

  const questionBreakdown = questions.map((q, idx) => {
    const userChoice = userAnswers[idx];
    const isCorrect = userChoice === q.correctOptionIndex;
    const isSkipped = userChoice === undefined || userChoice === null;

    if (isSkipped) {
      skippedCount++;
    } else if (isCorrect) {
      correctCount++;
    } else {
      incorrectCount++;
    }

    return {
      questionText: q.questionText || '',
      topic: q.topic || 'General',
      options: q.options || [],
      userOptionIndex: userChoice !== undefined ? userChoice : -1,
      userLetter: userChoice !== undefined ? (optionLabels[userChoice] || 'A') : '-',
      correctAnswerLetter: q.correctAnswerLetter || (optionLabels[q.correctOptionIndex] || 'A'),
      correctOptionIndex: q.correctOptionIndex !== undefined ? q.correctOptionIndex : 0,
      isCorrect,
      explanation: q.explanation || 'No explanation provided.'
    };
  });

  const scorePercentage = totalCount > 0 ? Math.round((correctCount / totalCount) * 100) : 0;

  // Auto-save history attempt to MongoDB on component mount
  useEffect(() => {
    const saveResult = async () => {
      if (historySaved || !quiz || !quiz._id) return;
      try {
        await saveHistoryApi({
          quizId: quiz._id,
          quizTitle: quiz.title || 'Untitled Quiz',
          subject: quiz.subject || 'General',
          score: correctCount,
          totalQuestions: totalCount,
          correctCount,
          incorrectCount,
          accuracyPercentage: scorePercentage,
          timeTakenSeconds: timeSpentSeconds,
          questionBreakdown
        });
        setHistorySaved(true);
      } catch (err) {
        console.warn('Error saving attempt history:', err.message);
      }
    };
    saveResult();
  }, [quiz, historySaved]);

  const handleGenerateAiExplanation = async (q, idx) => {
    if (aiExplanations[idx]) return;
    try {
      setLoadingAiIdx(idx);
      const res = await fetchAiExplanationApi({
        questionText: q.questionText,
        options: q.options,
        correctAnswerLetter: q.correctAnswerLetter || optionLabels[q.correctOptionIndex],
        explanation: q.explanation
      });

      if (res && res.explanation) {
        setAiExplanations((prev) => ({
          ...prev,
          [idx]: res.explanation
        }));
      }
    } catch (err) {
      console.error('Error fetching AI explanation:', err);
    } finally {
      setLoadingAiIdx(null);
    }
  };

  const handleOpenAiChat = (q, idx) => {
    const userChoice = userAnswers[idx];
    setActiveQuestionForChat({
      questionText: q.questionText,
      options: q.options,
      correctAnswerLetter: q.correctAnswerLetter || optionLabels[q.correctOptionIndex] || 'A',
      userLetter: userChoice !== undefined ? optionLabels[userChoice] : 'Not answered',
      explanation: q.explanation || ''
    });
    setChatModalVisible(true);
  };

  const formatTime = (secs) => {
    const m = Math.floor(secs / 60);
    const s = secs % 60;
    return `${m}m ${s}s`;
  };

  const getPerformanceBadge = (percent) => {
    if (percent >= 80) return { title: 'Excellent!', color: '#22c55e', bg: 'rgba(34, 197, 94, 0.15)' };
    if (percent >= 50) return { title: 'Passed', color: '#6366f1', bg: 'rgba(99, 102, 241, 0.15)' };
    return { title: 'Needs Practice', color: '#f59e0b', bg: 'rgba(245, 158, 11, 0.15)' };
  };

  const badge = getPerformanceBadge(scorePercentage);

  const toggleExpand = (idx) => {
    setExpandedIndex(expandedIndex === idx ? null : idx);
  };

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView contentContainerStyle={styles.scrollContent}>
        {/* Top Score Banner */}
        <View style={styles.scoreCard}>
          <View style={[styles.badgeContainer, { backgroundColor: badge.bg }]}>
            <Award color={badge.color} size={28} />
            <Text style={[styles.badgeText, { color: badge.color }]}>{badge.title}</Text>
          </View>

          <Text style={styles.scorePercent}>{scorePercentage}%</Text>
          <Text style={styles.scoreSubText}>
            You answered {correctCount} out of {totalCount} questions correctly
          </Text>

          {/* Stats Grid */}
          <View style={styles.statsGrid}>
            <View style={styles.statItem}>
              <CheckCircle2 color="#22c55e" size={20} />
              <Text style={styles.statNumber}>{correctCount}</Text>
              <Text style={styles.statLabel}>Correct</Text>
            </View>

            <View style={styles.statItem}>
              <XCircle color="#ef4444" size={20} />
              <Text style={styles.statNumber}>{incorrectCount}</Text>
              <Text style={styles.statLabel}>Incorrect</Text>
            </View>

            <View style={styles.statItem}>
              <HelpCircle color="#94a3b8" size={20} />
              <Text style={styles.statNumber}>{skippedCount}</Text>
              <Text style={styles.statLabel}>Skipped</Text>
            </View>
          </View>

          <Text style={styles.timeText}>Total Time: {formatTime(timeSpentSeconds)}</Text>
        </View>

        {/* Question Review Section */}
        <Text style={styles.sectionHeaderTitle}>Detailed Review & AI Tools</Text>

        <View style={styles.reviewList}>
          {questions.map((q, idx) => {
            const userChoice = userAnswers[idx];
            const isCorrect = userChoice === q.correctOptionIndex;
            const isSkipped = userChoice === undefined || userChoice === null;
            const isExpanded = expandedIndex === idx;

            return (
              <View key={idx} style={styles.reviewCard}>
                <TouchableOpacity
                  style={styles.reviewCardHeader}
                  activeOpacity={0.7}
                  onPress={() => toggleExpand(idx)}
                >
                  <View
                    style={[
                      styles.statusDot,
                      isCorrect
                        ? { backgroundColor: '#22c55e' }
                        : isSkipped
                        ? { backgroundColor: '#94a3b8' }
                        : { backgroundColor: '#ef4444' },
                    ]}
                  />
                  <Text style={styles.reviewQTitle} numberOfLines={1}>
                    Q{idx + 1}. {q.questionText}
                  </Text>
                  {isExpanded ? (
                    <ChevronUp color="#94a3b8" size={18} />
                  ) : (
                    <ChevronDown color="#94a3b8" size={18} />
                  )}
                </TouchableOpacity>

                {/* Expanded Details */}
                {isExpanded && (
                  <View style={styles.reviewDetails}>
                    <Text style={styles.fullQText}>{q.questionText}</Text>

                    <View style={styles.reviewOptionsList}>
                      {(q.options || []).map((optText, optIdx) => {
                        const isUserSelected = userChoice === optIdx;
                        const isAnswer = q.correctOptionIndex === optIdx;

                        return (
                          <View
                            key={optIdx}
                            style={[
                              styles.reviewOptionRow,
                              isAnswer && styles.reviewOptionAnswer,
                              isUserSelected && !isAnswer && styles.reviewOptionWrong,
                            ]}
                          >
                            <Text
                              style={[
                                styles.reviewOptLetter,
                                isAnswer && { color: '#22c55e', fontWeight: '700' },
                                isUserSelected && !isAnswer && { color: '#ef4444', fontWeight: '700' },
                              ]}
                            >
                              {optionLabels[optIdx]}.
                            </Text>
                            <Text style={styles.reviewOptText}>{optText}</Text>
                          </View>
                        );
                      })}
                    </View>

                    {q.explanation && (
                      <View style={styles.reviewExpBox}>
                        <Text style={styles.reviewExpTitle}>Printed Explanation:</Text>
                        <MarkdownRenderer content={q.explanation} />
                      </View>
                    )}

                    {/* AI Explanation Generated Box */}
                    {aiExplanations[idx] && (
                      <View style={styles.aiExpBox}>
                        <View style={styles.aiExpHeader}>
                          <View style={styles.aiBadge}>
                            <Sparkles size={11} color="#ffffff" />
                            <Text style={styles.aiBadgeText}>GEMINI 3.6 FLASH AI</Text>
                          </View>
                          <Text style={styles.aiExpTitle}>In-Depth Explanation</Text>
                        </View>
                        <MarkdownRenderer content={aiExplanations[idx]} />
                      </View>
                    )}

                    {/* AI Action Buttons Row */}
                    <View style={styles.aiBtnRow}>
                      <TouchableOpacity
                        style={styles.aiExplainBtn}
                        onPress={() => handleGenerateAiExplanation(q, idx)}
                        disabled={loadingAiIdx === idx}
                      >
                        {loadingAiIdx === idx ? (
                          <ActivityIndicator size="small" color="#c084fc" />
                        ) : (
                          <>
                            <Lightbulb size={15} color="#c084fc" />
                            <Text style={styles.aiExplainBtnText}>
                              {aiExplanations[idx] ? 'Regenerate AI Explanation' : 'Generate AI Explanation'}
                            </Text>
                          </>
                        )}
                      </TouchableOpacity>

                      <TouchableOpacity
                        style={styles.aiChatBtn}
                        onPress={() => handleOpenAiChat(q, idx)}
                      >
                        <MessageSquare size={15} color="#ffffff" />
                        <Text style={styles.aiChatBtnText}>Chat with AI Tutor</Text>
                      </TouchableOpacity>
                    </View>
                  </View>
                )}
              </View>
            );
          })}
        </View>
      </ScrollView>

      {/* AI Chat Modal */}
      <AiChatModal
        visible={chatModalVisible}
        questionContext={activeQuestionForChat}
        onClose={() => setChatModalVisible(false)}
      />

      {/* Bottom Action Footer */}
      <View style={styles.actionFooter}>
        <TouchableOpacity
          style={styles.retryBtn}
          onPress={() =>
            navigation.replace('Test', {
              quiz: quiz,
              questions: questions,
            })
          }
        >
          <RotateCcw color="#818cf8" size={18} style={{ marginRight: 6 }} />
          <Text style={styles.retryBtnText}>Retry Quiz</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.homeBtn}
          onPress={() => navigation.navigate('Home')}
        >
          <Home color="#ffffff" size={18} style={{ marginRight: 6 }} />
          <Text style={styles.homeBtnText}>Back to Home</Text>
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0f172a',
  },
  scrollContent: {
    padding: 10,
    paddingBottom: 30,
  },
  scoreCard: {
    backgroundColor: '#1e293b',
    borderRadius: 24,
    padding: 24,
    alignItems: 'center',
    marginBottom: 24,
    borderWidth: 1,
    borderColor: '#334155',
  },
  badgeContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 14,
    paddingVertical: 6,
    borderRadius: 20,
    marginBottom: 12,
  },
  badgeText: {
    fontSize: 15,
    fontWeight: '800',
    marginLeft: 8,
  },
  scorePercent: {
    fontSize: 48,
    fontWeight: '800',
    color: '#f8fafc',
    marginBottom: 4,
  },
  scoreSubText: {
    fontSize: 13,
    color: '#94a3b8',
    textAlign: 'center',
    marginBottom: 20,
  },
  statsGrid: {
    flexDirection: 'row',
    width: '100%',
    justifyContent: 'space-around',
    paddingVertical: 16,
    borderTopWidth: 1,
    borderBottomWidth: 1,
    borderColor: '#334155',
    marginBottom: 14,
  },
  statItem: {
    alignItems: 'center',
  },
  statNumber: {
    fontSize: 18,
    fontWeight: '700',
    color: '#f8fafc',
    marginTop: 4,
  },
  statLabel: {
    fontSize: 11,
    color: '#94a3b8',
    marginTop: 2,
  },
  timeText: {
    fontSize: 12,
    color: '#94a3b8',
    fontWeight: '600',
  },
  sectionHeaderTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#f8fafc',
    marginBottom: 14,
  },
  reviewList: {
    gap: 10,
  },
  reviewCard: {
    backgroundColor: '#1e293b',
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#334155',
    overflow: 'hidden',
  },
  reviewCardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 14,
  },
  statusDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    marginRight: 10,
  },
  reviewQTitle: {
    flex: 1,
    fontSize: 14,
    fontWeight: '600',
    color: '#cbd5e1',
  },
  reviewDetails: {
    paddingHorizontal: 14,
    paddingBottom: 14,
    borderTopWidth: 1,
    borderColor: '#334155',
    paddingTop: 10,
  },
  fullQText: {
    fontSize: 15,
    fontWeight: '600',
    color: '#f8fafc',
    marginBottom: 12,
  },
  reviewOptionsList: {
    gap: 6,
  },
  reviewOptionRow: {
    flexDirection: 'row',
    padding: 8,
    borderRadius: 8,
    backgroundColor: '#0f172a',
  },
  reviewOptionAnswer: {
    backgroundColor: 'rgba(34, 197, 94, 0.15)',
    borderWidth: 1,
    borderColor: '#22c55e',
  },
  reviewOptionWrong: {
    backgroundColor: 'rgba(239, 68, 68, 0.15)',
    borderWidth: 1,
    borderColor: '#ef4444',
  },
  reviewOptLetter: {
    fontSize: 13,
    color: '#94a3b8',
    marginRight: 6,
  },
  reviewOptText: {
    fontSize: 13,
    color: '#cbd5e1',
    flex: 1,
  },
  reviewExpBox: {
    marginTop: 10,
    padding: 10,
    borderRadius: 8,
    backgroundColor: 'rgba(129, 140, 248, 0.1)',
  },
  reviewExpTitle: {
    fontSize: 12,
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
    gap: 8,
    marginTop: 12,
  },
  aiExplainBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(168, 85, 247, 0.15)',
    paddingVertical: 10,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#a855f7',
  },
  aiExplainBtnText: {
    color: '#c084fc',
    fontSize: 12,
    fontWeight: '700',
    marginLeft: 5,
  },
  aiChatBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#6366f1',
    paddingVertical: 10,
    borderRadius: 8,
  },
  aiChatBtnText: {
    color: '#ffffff',
    fontSize: 12,
    fontWeight: '700',
    marginLeft: 5,
  },
  actionFooter: {
    flexDirection: 'row',
    padding: 16,
    backgroundColor: '#1e293b',
    borderTopWidth: 1,
    borderColor: '#334155',
    gap: 12,
  },
  retryBtn: {
    flex: 1,
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 12,
    backgroundColor: 'rgba(99, 102, 241, 0.15)',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#6366f1',
  },
  retryBtnText: {
    color: '#818cf8',
    fontSize: 15,
    fontWeight: '700',
  },
  homeBtn: {
    flex: 1,
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 12,
    backgroundColor: '#6366f1',
    borderRadius: 12,
  },
  homeBtnText: {
    color: '#ffffff',
    fontSize: 15,
    fontWeight: '700',
  },
});
