import React, { useState, useEffect } from 'react';
import {
  Modal,
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  TextInput,
  ScrollView,
  Switch,
} from 'react-native';
import { Play, Clock, Shuffle, X, Layers, Filter, Search, CheckCircle2 } from 'lucide-react-native';
import { fetchQuizById } from '../services/api';

export default function TestConfigModal({ visible, quiz, onClose, onStartTest }) {
  const [currentQuiz, setCurrentQuiz] = useState(quiz);
  const [loadingQuizDetails, setLoadingQuizDetails] = useState(false);

  const [questionCountChoice, setQuestionCountChoice] = useState('50'); // '10' | '25' | '50' | '100' | 'all' | 'custom'
  const [customCountInput, setCustomCountInput] = useState('50');
  const [selectionMode, setSelectionMode] = useState('random'); // 'random' | 'sequential'
  const [selectedTopic, setSelectedTopic] = useState('All');
  const [topicSearchQuery, setTopicSearchQuery] = useState('');
  const [timerSeconds, setTimerSeconds] = useState(30);
  const [shuffleOptions, setShuffleOptions] = useState(false);

  useEffect(() => {
    setCurrentQuiz(quiz);
    if (visible && quiz && quiz._id) {
      if (!quiz.questions || quiz.questions.length === 0) {
        loadFullQuiz(quiz._id);
      }
    }
  }, [visible, quiz]);

  const loadFullQuiz = async (quizId) => {
    try {
      setLoadingQuizDetails(true);
      const res = await fetchQuizById(quizId);
      if (res && res.quiz) {
        setCurrentQuiz(res.quiz);
      }
    } catch (err) {
      console.warn('Error loading quiz details:', err.message);
    } finally {
      setLoadingQuizDetails(false);
    }
  };

  const activeQuiz = currentQuiz || quiz;
  const totalAvailable = activeQuiz?.questions?.length || activeQuiz?.questionCount || 0;

  // Extract unique topics from activeQuiz questions
  const availableTopics = ['All'];
  if (activeQuiz && Array.isArray(activeQuiz.questions)) {
    activeQuiz.questions.forEach((q) => {
      if (q.topic && !availableTopics.includes(q.topic)) {
        availableTopics.push(q.topic);
      }
    });
  } else if (activeQuiz && Array.isArray(activeQuiz.topics)) {
    activeQuiz.topics.forEach((t) => {
      if (!availableTopics.includes(t)) {
        availableTopics.push(t);
      }
    });
  }

  const filteredTopics = availableTopics.filter((t) =>
    t.toLowerCase().includes(topicSearchQuery.trim().toLowerCase())
  );

  useEffect(() => {
    if (visible && activeQuiz) {
      setTopicSearchQuery('');
      if (totalAvailable >= 50) {
        setQuestionCountChoice('50');
        setCustomCountInput('50');
      } else if (totalAvailable > 0) {
        setQuestionCountChoice('all');
        setCustomCountInput(String(totalAvailable));
      }
    }
  }, [visible, activeQuiz, totalAvailable]);

  if (!quiz) return null;

  const timerChoices = [
    { label: 'Untimed', value: 0 },
    { label: '15s / Q', value: 15 },
    { label: '30s / Q', value: 30 },
    { label: '60s / Q', value: 60 },
  ];

  const handleStart = () => {
    let pool = activeQuiz?.questions ? [...activeQuiz.questions] : [];

    // 1. Filter by Topic if specific topic is selected
    if (selectedTopic !== 'All') {
      pool = pool.filter((q) => q.topic === selectedTopic);
    }

    // 2. Determine target count
    let targetCount = pool.length;
    if (questionCountChoice === 'custom') {
      const parsed = parseInt(customCountInput, 10);
      if (!isNaN(parsed) && parsed > 0) {
        targetCount = Math.min(parsed, pool.length);
      }
    } else if (questionCountChoice !== 'all') {
      const parsed = parseInt(questionCountChoice, 10);
      if (!isNaN(parsed) && parsed > 0) {
        targetCount = Math.min(parsed, pool.length);
      }
    }

    // 3. Apply Selection Mode (Random Shuffle vs Sequential)
    let configuredQuestions = [];
    if (selectionMode === 'random') {
      // Fisher-Yates shuffle copy
      const shuffled = [...pool];
      for (let i = shuffled.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
      }
      configuredQuestions = shuffled.slice(0, targetCount);
    } else {
      configuredQuestions = pool.slice(0, targetCount);
    }

    // 4. Optionally shuffle option orders inside each question
    if (shuffleOptions) {
      configuredQuestions = configuredQuestions.map((q) => {
        if (!q.options || q.options.length < 2) return q;
        const correctOptText = q.options[q.correctOptionIndex !== undefined ? q.correctOptionIndex : 0];
        const shuffledOpts = [...q.options];
        for (let i = shuffledOpts.length - 1; i > 0; i--) {
          const j = Math.floor(Math.random() * (i + 1));
          [shuffledOpts[i], shuffledOpts[j]] = [shuffledOpts[j], shuffledOpts[i]];
        }
        const newCorrectIndex = shuffledOpts.indexOf(correctOptText);
        const letters = ['A', 'B', 'C', 'D', 'E', 'F'];
        return {
          ...q,
          options: shuffledOpts,
          correctOptionIndex: newCorrectIndex >= 0 ? newCorrectIndex : 0,
          correctAnswerLetter: letters[newCorrectIndex] || 'A'
        };
      });
    }

    onStartTest(configuredQuestions, {
      timerSeconds,
      selectionMode,
      selectedTopic,
      targetCount: configuredQuestions.length
    });
  };

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <View style={styles.overlay}>
        <View style={styles.card}>
          <View style={styles.header}>
            <View style={{ flex: 1, marginRight: 8 }}>
              <Text style={styles.title} numberOfLines={1}>{quiz.title}</Text>
              <Text style={styles.metaText}>
                Total Pool: {totalAvailable} Questions • {quiz.subject || 'General'}
              </Text>
            </View>
            <TouchableOpacity onPress={onClose} style={styles.closeBtn}>
              <X color="#94a3b8" size={20} />
            </TouchableOpacity>
          </View>

          <ScrollView style={{ maxHeight: 440 }} showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
            {/* 1. Question Count Selection */}
            <View style={styles.section}>
              <View style={styles.sectionHeader}>
                <Layers color="#818cf8" size={16} />
                <Text style={styles.sectionTitle}>Number of Questions</Text>
              </View>

              <View style={styles.chipRow}>
                {['10', '25', '50', '100'].map((preset) => {
                  const num = parseInt(preset, 10);
                  const disabled = num > totalAvailable;
                  return (
                    <TouchableOpacity
                      key={preset}
                      disabled={disabled}
                      style={[
                        styles.chip,
                        questionCountChoice === preset && styles.chipActive,
                        disabled && styles.chipDisabled
                      ]}
                      onPress={() => {
                        setQuestionCountChoice(preset);
                        setCustomCountInput(preset);
                      }}
                    >
                      <Text style={[styles.chipText, questionCountChoice === preset && styles.chipTextActive, disabled && styles.chipTextDisabled]}>
                        {preset} Qs
                      </Text>
                    </TouchableOpacity>
                  );
                })}

                <TouchableOpacity
                  style={[styles.chip, questionCountChoice === 'all' && styles.chipActive]}
                  onPress={() => {
                    setQuestionCountChoice('all');
                    setCustomCountInput(String(totalAvailable));
                  }}
                >
                  <Text style={[styles.chipText, questionCountChoice === 'all' && styles.chipTextActive]}>
                    All ({totalAvailable})
                  </Text>
                </TouchableOpacity>
              </View>

              {/* Custom Number Input */}
              <View style={styles.customInputRow}>
                <Text style={styles.customLabel}>Custom Count:</Text>
                <TextInput
                  style={styles.customInput}
                  keyboardType="number-pad"
                  value={customCountInput}
                  onChangeText={(val) => {
                    setCustomCountInput(val);
                    setQuestionCountChoice('custom');
                  }}
                  placeholder="e.g. 50"
                  placeholderTextColor="#64748b"
                />
                <Text style={styles.customMaxText}>/ {totalAvailable} max</Text>
              </View>
            </View>

            {/* 2. Selection Mode (Randomized vs Sequential) */}
            <View style={styles.section}>
              <View style={styles.sectionHeader}>
                <Shuffle color="#c084fc" size={16} />
                <Text style={styles.sectionTitle}>Question Selection Mode</Text>
              </View>

              <View style={styles.chipRow}>
                <TouchableOpacity
                  style={[styles.chip, { flex: 1 }, selectionMode === 'random' && styles.chipActive]}
                  onPress={() => setSelectionMode('random')}
                >
                  <Text style={[styles.chipText, selectionMode === 'random' && styles.chipTextActive]} numberOfLines={1}>
                    🔀 Random Shuffle
                  </Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={[styles.chip, { flex: 1 }, selectionMode === 'sequential' && styles.chipActive]}
                  onPress={() => setSelectionMode('sequential')}
                >
                  <Text style={[styles.chipText, selectionMode === 'sequential' && styles.chipTextActive]} numberOfLines={1}>
                    🔢 Sequential (1 to N)
                  </Text>
                </TouchableOpacity>
              </View>
            </View>

            {/* 3. Searchable Topic Filter */}
            {availableTopics.length > 2 && (
              <View style={styles.section}>
                <View style={styles.sectionHeaderRow}>
                  <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                    <Filter color="#38bdf8" size={16} />
                    <Text style={styles.sectionTitle}>Topic Filter</Text>
                  </View>
                  <Text style={styles.topicBadgeText}>
                    {selectedTopic === 'All' ? `${availableTopics.length - 1} Topics` : `Selected: ${selectedTopic}`}
                  </Text>
                </View>

                {/* Instant Topic Search Box */}
                <View style={styles.topicSearchBox}>
                  <Search color="#64748b" size={14} style={{ marginRight: 6 }} />
                  <TextInput
                    style={styles.topicSearchInput}
                    placeholder={`Search ${availableTopics.length - 1} topics (e.g. Cardiology)...`}
                    placeholderTextColor="#64748b"
                    value={topicSearchQuery}
                    onChangeText={setTopicSearchQuery}
                  />
                  {topicSearchQuery.length > 0 && (
                    <TouchableOpacity onPress={() => setTopicSearchQuery('')}>
                      <X color="#64748b" size={14} />
                    </TouchableOpacity>
                  )}
                </View>

                {/* Multi-Row Wrap Container for Fast 1-Click Topic Selection */}
                <View style={styles.topicWrapGrid}>
                  {filteredTopics.slice(0, 12).map((topicItem) => (
                    <TouchableOpacity
                      key={topicItem}
                      style={[styles.topicChip, selectedTopic === topicItem && styles.topicChipActive]}
                      onPress={() => setSelectedTopic(topicItem)}
                    >
                      <Text style={[styles.topicChipText, selectedTopic === topicItem && styles.topicChipTextActive]}>
                        {topicItem}
                      </Text>
                    </TouchableOpacity>
                  ))}
                  {filteredTopics.length === 0 && (
                    <Text style={styles.noTopicFoundText}>No topics matching "{topicSearchQuery}"</Text>
                  )}
                  {filteredTopics.length > 12 && !topicSearchQuery && (
                    <Text style={styles.topicHintText}>
                      +{filteredTopics.length - 12} more topics (type in search bar above)
                    </Text>
                  )}
                </View>
              </View>
            )}

            {/* 4. Timer Config */}
            <View style={styles.section}>
              <View style={styles.sectionHeader}>
                <Clock color="#34d399" size={16} />
                <Text style={styles.sectionTitle}>Question Timer</Text>
              </View>
              <View style={styles.chipRow}>
                {timerChoices.map((choice) => (
                  <TouchableOpacity
                    key={choice.value}
                    style={[styles.chip, { flex: 1 }, timerSeconds === choice.value && styles.chipActive]}
                    onPress={() => setTimerSeconds(choice.value)}
                  >
                    <Text style={[styles.chipText, timerSeconds === choice.value && styles.chipTextActive]}>
                      {choice.label}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
            </View>

            {/* 5. Shuffle Option Choices */}
            <View style={styles.rowSection}>
              <View style={styles.sectionHeader}>
                <Shuffle color="#fbbf24" size={16} />
                <Text style={styles.sectionTitle}>Shuffle MCQ Options (A-D)</Text>
              </View>
              <Switch
                value={shuffleOptions}
                onValueChange={setShuffleOptions}
                trackColor={{ false: '#334155', true: '#6366f1' }}
                thumbColor={shuffleOptions ? '#818cf8' : '#94a3b8'}
              />
            </View>
          </ScrollView>

          {/* Start Action Button */}
          <TouchableOpacity style={styles.startBtn} onPress={handleStart}>
            <Play color="#ffffff" size={18} style={{ marginRight: 8 }} />
            <Text style={styles.startBtnText}>
              Begin Test ({questionCountChoice === 'all' ? totalAvailable : customCountInput || 50} Qs)
            </Text>
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(15, 23, 42, 0.8)',
    justifyContent: 'flex-end',
  },
  card: {
    backgroundColor: '#0f172a',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    paddingHorizontal: 12,
    paddingTop: 16,
    paddingBottom: 20,
    borderWidth: 1,
    borderColor: '#334155',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#334155',
    paddingBottom: 10,
  },
  title: {
    fontSize: 17,
    fontWeight: '700',
    color: '#f8fafc',
  },
  closeBtn: {
    padding: 6,
    backgroundColor: '#1e293b',
    borderRadius: 16,
  },
  metaText: {
    fontSize: 11.5,
    color: '#94a3b8',
    marginTop: 2,
  },
  section: {
    marginBottom: 14,
    backgroundColor: '#1e293b',
    borderRadius: 12,
    padding: 10,
    borderWidth: 1,
    borderColor: '#334155',
  },
  rowSection: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 14,
    backgroundColor: '#1e293b',
    borderRadius: 12,
    padding: 10,
    borderWidth: 1,
    borderColor: '#334155',
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
  },
  sectionTitle: {
    fontSize: 13,
    fontWeight: '700',
    color: '#f8fafc',
    marginLeft: 6,
  },
  chipRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
  },
  chip: {
    paddingHorizontal: 8,
    paddingVertical: 7,
    backgroundColor: '#0f172a',
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: '#334155',
  },
  chipActive: {
    backgroundColor: 'rgba(99, 102, 241, 0.25)',
    borderColor: '#818cf8',
  },
  chipDisabled: {
    opacity: 0.4,
  },
  chipText: {
    fontSize: 12,
    color: '#94a3b8',
    fontWeight: '600',
  },
  chipTextActive: {
    color: '#818cf8',
    fontWeight: '700',
  },
  chipTextDisabled: {
    color: '#64748b',
  },
  customInputRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 8,
    backgroundColor: '#0f172a',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#334155',
  },
  customLabel: {
    fontSize: 12,
    color: '#94a3b8',
    marginRight: 8,
  },
  customInput: {
    flex: 1,
    color: '#f8fafc',
    fontSize: 14,
    fontWeight: '700',
    paddingVertical: 4,
  },
  customMaxText: {
    fontSize: 11,
    color: '#64748b',
  },
  sectionHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  topicBadgeText: {
    fontSize: 11,
    color: '#38bdf8',
    fontWeight: '600',
  },
  topicSearchBox: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#0f172a',
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderWidth: 1,
    borderColor: '#334155',
    marginBottom: 8,
  },
  topicSearchInput: {
    flex: 1,
    color: '#f8fafc',
    fontSize: 12.5,
    paddingVertical: 2,
  },
  topicWrapGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
  },
  noTopicFoundText: {
    fontSize: 12,
    color: '#64748b',
    fontStyle: 'italic',
    paddingVertical: 4,
  },
  topicHintText: {
    fontSize: 11,
    color: '#64748b',
    marginTop: 4,
    width: '100%',
  },
  topicChip: {
    paddingHorizontal: 9,
    paddingVertical: 5,
    backgroundColor: '#0f172a',
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#334155',
  },
  topicChipActive: {
    backgroundColor: '#3b82f6',
    borderColor: '#60a5fa',
  },
  topicChipText: {
    fontSize: 11.5,
    fontWeight: '600',
    color: '#94a3b8',
  },
  topicChipTextActive: {
    color: '#ffffff',
    fontWeight: '700',
  },
  startBtn: {
    backgroundColor: '#6366f1',
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 12,
    borderRadius: 12,
    marginTop: 8,
  },
  startBtnText: {
    color: '#ffffff',
    fontSize: 15,
    fontWeight: '700',
  },
});
