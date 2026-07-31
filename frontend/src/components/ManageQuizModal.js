import React, { useState, useEffect } from 'react';
import {
  Modal,
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  TextInput,
  Alert,
  ActivityIndicator,
  FlatList,
} from 'react-native';
import { X, Plus, Edit2, Trash2, Check, HelpCircle, BookOpen, Layers } from 'lucide-react-native';
import { addQuestionApi, updateQuestionApi, deleteQuestionApi, fetchQuizById } from '../services/api';
import MarkdownRenderer from './MarkdownRenderer';

export default function ManageQuizModal({ visible, quiz, onClose, onQuizUpdated }) {
  const [currentQuiz, setCurrentQuiz] = useState(quiz);
  const [loading, setLoading] = useState(false);

  // Form mode: 'list' | 'add' | 'edit'
  const [mode, setMode] = useState('list');
  const [editingQuestionId, setEditingQuestionId] = useState(null);

  // Form state
  const [questionText, setQuestionText] = useState('');
  const [topic, setTopic] = useState('');
  const [optionA, setOptionA] = useState('');
  const [optionB, setOptionB] = useState('');
  const [optionC, setOptionC] = useState('');
  const [optionD, setOptionD] = useState('');
  const [correctLetter, setCorrectLetter] = useState('A');
  const [explanation, setExplanation] = useState('');
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (visible && quiz && quiz._id) {
      loadQuizDetails(quiz._id);
    } else {
      setCurrentQuiz(quiz);
    }
    setMode('list');
    resetForm();
  }, [visible, quiz]);

  const loadQuizDetails = async (quizId) => {
    try {
      setLoading(true);
      const res = await fetchQuizById(quizId);
      if (res && res.quiz) {
        setCurrentQuiz(res.quiz);
      }
    } catch (err) {
      console.warn('Error refreshing quiz details:', err.message);
    } finally {
      setLoading(false);
    }
  };

  const resetForm = () => {
    setQuestionText('');
    setTopic(currentQuiz?.subject || 'General');
    setOptionA('');
    setOptionB('');
    setOptionC('');
    setOptionD('');
    setCorrectLetter('A');
    setExplanation('');
    setEditingQuestionId(null);
  };

  const handleOpenAddForm = () => {
    resetForm();
    setMode('add');
  };

  const handleOpenEditForm = (q) => {
    setEditingQuestionId(q._id);
    setQuestionText(q.questionText || '');
    setTopic(q.topic || currentQuiz?.subject || 'General');
    setOptionA(q.options?.[0] || '');
    setOptionB(q.options?.[1] || '');
    setOptionC(q.options?.[2] || '');
    setOptionD(q.options?.[3] || '');
    setCorrectLetter(q.correctAnswerLetter || 'A');
    setExplanation(q.explanation || '');
    setMode('edit');
  };

  const handleSaveQuestion = async () => {
    if (!questionText.trim()) {
      Alert.alert('Validation Error', 'Please enter the question text.');
      return;
    }
    if (!optionA.trim() || !optionB.trim()) {
      Alert.alert('Validation Error', 'Option A and Option B are required.');
      return;
    }

    const options = [optionA.trim(), optionB.trim()];
    if (optionC.trim()) options.push(optionC.trim());
    if (optionD.trim()) options.push(optionD.trim());

    const letterIndexMap = { 'A': 0, 'B': 1, 'C': 2, 'D': 3 };
    let correctOptionIndex = letterIndexMap[correctLetter] !== undefined ? letterIndexMap[correctLetter] : 0;
    if (correctOptionIndex >= options.length) {
      correctOptionIndex = 0;
    }

    const payload = {
      questionText: questionText.trim(),
      topic: topic.trim() || 'General',
      options,
      correctOptionIndex,
      correctAnswerLetter: correctLetter,
      explanation: explanation.trim() || 'No explanation provided.'
    };

    try {
      setSubmitting(true);
      let response;
      if (mode === 'edit' && editingQuestionId) {
        response = await updateQuestionApi(currentQuiz._id, editingQuestionId, payload);
      } else {
        response = await addQuestionApi(currentQuiz._id, payload);
      }

      if (response && response.quiz) {
        setCurrentQuiz(response.quiz);
        if (onQuizUpdated) onQuizUpdated(response.quiz);
      }

      Alert.alert('Success', mode === 'edit' ? 'Question updated!' : 'Question added successfully!');
      setMode('list');
      resetForm();
    } catch (err) {
      console.error('Save Question Error:', err);
      Alert.alert('Save Error', err.response?.data?.message || err.message || 'Failed to save question.');
    } finally {
      setSubmitting(false);
    }
  };

  const handleDeleteQuestion = (qId, qText) => {
    Alert.alert(
      'Delete Question',
      `Are you sure you want to delete this question?\n\n"${qText.slice(0, 60)}..."`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            try {
              setLoading(true);
              const response = await deleteQuestionApi(currentQuiz._id, qId);
              if (response && response.quiz) {
                setCurrentQuiz(response.quiz);
                if (onQuizUpdated) onQuizUpdated(response.quiz);
              }
            } catch (err) {
              Alert.alert('Delete Error', err.message || 'Failed to delete question.');
            } finally {
              setLoading(false);
            }
          }
        }
      ]
    );
  };

  if (!visible) return null;

  return (
    <Modal visible={visible} animationType="slide" transparent={false} onRequestClose={onClose}>
      <View style={styles.container}>
        {/* Header */}
        <View style={styles.header}>
          <View style={styles.headerLeft}>
            <BookOpen size={22} color="#818cf8" />
            <Text style={styles.headerTitle} numberOfLines={1}>
              {currentQuiz?.title || 'Manage Quiz'}
            </Text>
          </View>
          <TouchableOpacity style={styles.closeBtn} onPress={onClose}>
            <X size={22} color="#94a3b8" />
          </TouchableOpacity>
        </View>

        {/* Subtitle / Stat Bar */}
        <View style={styles.statBar}>
          <View style={styles.statItem}>
            <Layers size={15} color="#818cf8" />
            <Text style={styles.statText}>{currentQuiz?.questions?.length || 0} Questions</Text>
          </View>
          {currentQuiz?.subject && (
            <View style={styles.subjectBadge}>
              <Text style={styles.subjectBadgeText}>{currentQuiz.subject}</Text>
            </View>
          )}
        </View>

        {/* Body Content */}
        {mode === 'list' ? (
          <View style={{ flex: 1 }}>
            <View style={styles.actionRow}>
              <Text style={styles.sectionTitle}>Question List</Text>
              <TouchableOpacity style={styles.addBtn} onPress={handleOpenAddForm}>
                <Plus size={16} color="#fff" />
                <Text style={styles.addBtnText}>Add Question</Text>
              </TouchableOpacity>
            </View>

            {loading ? (
              <View style={styles.loadingContainer}>
                <ActivityIndicator size="large" color="#6366f1" />
              </View>
            ) : !currentQuiz?.questions || currentQuiz.questions.length === 0 ? (
              <View style={styles.emptyState}>
                <HelpCircle size={48} color="#475569" />
                <Text style={styles.emptyTitle}>No Questions Yet</Text>
                <Text style={styles.emptySub}>
                  Click "Add Question" above to manually add your first multiple-choice question!
                </Text>
              </View>
            ) : (
              <FlatList
                data={currentQuiz.questions}
                keyExtractor={(item) => item._id || String(item.questionNumber)}
                contentContainerStyle={styles.listContent}
                renderItem={({ item, index }) => (
                  <View style={styles.questionCard}>
                    <View style={styles.cardHeader}>
                      <View style={styles.numBadge}>
                        <Text style={styles.numBadgeText}>Q{index + 1}</Text>
                      </View>
                      <Text style={styles.topicBadge}>{item.topic || 'General'}</Text>
                      <View style={styles.cardActions}>
                        <TouchableOpacity
                          style={styles.iconBtn}
                          onPress={() => handleOpenEditForm(item)}
                        >
                          <Edit2 size={16} color="#3b82f6" />
                        </TouchableOpacity>
                        <TouchableOpacity
                          style={styles.iconBtn}
                          onPress={() => handleDeleteQuestion(item._id, item.questionText)}
                        >
                          <Trash2 size={16} color="#ef4444" />
                        </TouchableOpacity>
                      </View>
                    </View>

                    <Text style={styles.qText}>{item.questionText}</Text>

                    {/* Options Preview */}
                    <View style={styles.optionsList}>
                      {item.options?.map((opt, oIdx) => {
                        const letter = ['A', 'B', 'C', 'D', 'E'][oIdx];
                        const isCorrect = item.correctAnswerLetter === letter || item.correctOptionIndex === oIdx;
                        return (
                          <View
                            key={oIdx}
                            style={[
                              styles.optionRow,
                              isCorrect && styles.correctOptionRow
                            ]}
                          >
                            <Text style={[styles.optLetter, isCorrect && styles.correctOptLetter]}>
                              {letter}.
                            </Text>
                            <Text style={[styles.optText, isCorrect && styles.correctOptText]}>
                              {opt}
                            </Text>
                            {isCorrect && <Check size={15} color="#10b981" />}
                          </View>
                        );
                      })}
                    </View>

                    {item.explanation ? (
                      <View style={styles.expBox}>
                        <Text style={styles.expTitle}>Explanation:</Text>
                        <MarkdownRenderer content={item.explanation} />
                      </View>
                    ) : null}
                  </View>
                )}
              />
            )}
          </View>
        ) : (
          /* Add / Edit Question Form */
          <ScrollView style={styles.formContainer} keyboardShouldPersistTaps="handled">
            <Text style={styles.formTitle}>
              {mode === 'edit' ? 'Edit Question' : 'Add New Question'}
            </Text>

            {/* Question Text */}
            <Text style={styles.label}>Question Text *</Text>
            <TextInput
              style={[styles.input, styles.textArea]}
              placeholder="Enter the question text..."
              placeholderTextColor="#64748b"
              value={questionText}
              onChangeText={setQuestionText}
              multiline
              numberOfLines={3}
            />

            {/* Topic */}
            <Text style={styles.label}>Topic / Category</Text>
            <TextInput
              style={styles.input}
              placeholder="e.g. Pediatrics, Nephrology..."
              placeholderTextColor="#64748b"
              value={topic}
              onChangeText={setTopic}
            />

            {/* Options */}
            <Text style={styles.label}>Options *</Text>

            {/* Option A */}
            <View style={styles.optInputRow}>
              <Text style={styles.optInputLetter}>A.</Text>
              <TextInput
                style={[styles.input, { flex: 1, marginBottom: 0 }]}
                placeholder="Option A text..."
                placeholderTextColor="#64748b"
                value={optionA}
                onChangeText={setOptionA}
              />
            </View>

            {/* Option B */}
            <View style={styles.optInputRow}>
              <Text style={styles.optInputLetter}>B.</Text>
              <TextInput
                style={[styles.input, { flex: 1, marginBottom: 0 }]}
                placeholder="Option B text..."
                placeholderTextColor="#64748b"
                value={optionB}
                onChangeText={setOptionB}
              />
            </View>

            {/* Option C */}
            <View style={styles.optInputRow}>
              <Text style={styles.optInputLetter}>C.</Text>
              <TextInput
                style={[styles.input, { flex: 1, marginBottom: 0 }]}
                placeholder="Option C text (optional)..."
                placeholderTextColor="#64748b"
                value={optionC}
                onChangeText={setOptionC}
              />
            </View>

            {/* Option D */}
            <View style={styles.optInputRow}>
              <Text style={styles.optInputLetter}>D.</Text>
              <TextInput
                style={[styles.input, { flex: 1, marginBottom: 0 }]}
                placeholder="Option D text (optional)..."
                placeholderTextColor="#64748b"
                value={optionD}
                onChangeText={setOptionD}
              />
            </View>

            {/* Correct Answer Selection */}
            <Text style={styles.label}>Select Correct Answer *</Text>
            <View style={styles.correctSelectorRow}>
              {['A', 'B', 'C', 'D'].map((letter) => (
                <TouchableOpacity
                  key={letter}
                  style={[
                    styles.letterChip,
                    correctLetter === letter && styles.selectedLetterChip
                  ]}
                  onPress={() => setCorrectLetter(letter)}
                >
                  <Text
                    style={[
                      styles.letterChipText,
                      correctLetter === letter && styles.selectedLetterChipText
                    ]}
                  >
                    Option {letter}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>

            {/* Explanation */}
            <Text style={styles.label}>Explanation</Text>
            <TextInput
              style={[styles.input, styles.textArea]}
              placeholder="Enter explanation or clinical rationale..."
              placeholderTextColor="#64748b"
              value={explanation}
              onChangeText={setExplanation}
              multiline
              numberOfLines={3}
            />

            {/* Form Buttons */}
            <View style={styles.formBtnRow}>
              <TouchableOpacity
                style={styles.cancelBtn}
                onPress={() => {
                  setMode('list');
                  resetForm();
                }}
              >
                <Text style={styles.cancelBtnText}>Cancel</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[styles.saveBtn, submitting && { opacity: 0.7 }]}
                onPress={handleSaveQuestion}
                disabled={submitting}
              >
                {submitting ? (
                  <ActivityIndicator size="small" color="#fff" />
                ) : (
                  <Text style={styles.saveBtnText}>
                    {mode === 'edit' ? 'Update Question' : 'Save Question'}
                  </Text>
                )}
              </TouchableOpacity>
            </View>

            <View style={{ height: 40 }} />
          </ScrollView>
        )}
      </View>
    </Modal>
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
    paddingTop: 45,
    paddingBottom: 12,
    backgroundColor: '#1e293b',
    borderBottomWidth: 1,
    borderBottomColor: '#334155',
  },
  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  headerTitle: {
    fontSize: 17,
    fontWeight: '700',
    color: '#f8fafc',
    marginLeft: 8,
    flex: 1,
  },
  closeBtn: {
    padding: 6,
  },
  statBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 12,
    paddingVertical: 10,
    backgroundColor: '#1e293b',
    borderBottomWidth: 1,
    borderBottomColor: '#334155',
  },
  statItem: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  statText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#818cf8',
    marginLeft: 6,
  },
  subjectBadge: {
    backgroundColor: 'rgba(99, 102, 241, 0.2)',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#6366f1',
  },
  subjectBadgeText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#818cf8',
  },
  actionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 12,
    paddingVertical: 12,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#f8fafc',
  },
  addBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#6366f1',
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 8,
  },
  addBtnText: {
    color: '#ffffff',
    fontWeight: '600',
    fontSize: 13,
    marginLeft: 4,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  emptyState: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 20,
  },
  emptyTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#cbd5e1',
    marginTop: 12,
  },
  emptySub: {
    fontSize: 14,
    color: '#64748b',
    textAlign: 'center',
    marginTop: 6,
    lineHeight: 20,
  },
  listContent: {
    paddingHorizontal: 10,
    paddingBottom: 30,
  },
  questionCard: {
    backgroundColor: '#1e293b',
    borderRadius: 12,
    padding: 12,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: '#334155',
    elevation: 2,
  },
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
  },
  numBadge: {
    backgroundColor: '#0f172a',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: '#334155',
  },
  numBadgeText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#818cf8',
  },
  topicBadge: {
    fontSize: 12,
    fontWeight: '600',
    color: '#c084fc',
    marginLeft: 8,
    flex: 1,
  },
  cardActions: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  iconBtn: {
    padding: 6,
    marginLeft: 4,
  },
  qText: {
    fontSize: 15,
    fontWeight: '600',
    color: '#f8fafc',
    lineHeight: 22,
    marginBottom: 10,
  },
  optionsList: {
    marginBottom: 8,
  },
  optionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#0f172a',
    paddingHorizontal: 10,
    paddingVertical: 8,
    borderRadius: 8,
    marginBottom: 6,
    borderWidth: 1,
    borderColor: '#334155',
  },
  correctOptionRow: {
    backgroundColor: 'rgba(16, 185, 129, 0.15)',
    borderColor: '#10b981',
  },
  optLetter: {
    fontSize: 13,
    fontWeight: '700',
    color: '#94a3b8',
    width: 22,
  },
  correctOptLetter: {
    color: '#10b981',
  },
  optText: {
    fontSize: 13,
    color: '#cbd5e1',
    flex: 1,
  },
  correctOptText: {
    color: '#a7f3d0',
    fontWeight: '600',
  },
  expBox: {
    backgroundColor: '#0f172a',
    padding: 10,
    borderRadius: 10,
    borderLeftWidth: 3,
    borderLeftColor: '#6366f1',
    marginTop: 8,
  },
  expTitle: {
    fontSize: 12,
    fontWeight: '700',
    color: '#818cf8',
    marginBottom: 4,
  },
  formContainer: {
    flex: 1,
    paddingHorizontal: 12,
    paddingTop: 12,
  },
  formTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#f8fafc',
    marginBottom: 15,
  },
  label: {
    fontSize: 13,
    fontWeight: '600',
    color: '#cbd5e1',
    marginBottom: 6,
    marginTop: 10,
  },
  input: {
    backgroundColor: '#1e293b',
    borderWidth: 1,
    borderColor: '#334155',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 14,
    color: '#f8fafc',
    marginBottom: 10,
  },
  textArea: {
    minHeight: 80,
    textAlignVertical: 'top',
  },
  optInputRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 10,
  },
  optInputLetter: {
    fontSize: 15,
    fontWeight: '700',
    color: '#818cf8',
    width: 24,
  },
  correctSelectorRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 15,
  },
  letterChip: {
    flex: 1,
    backgroundColor: '#1e293b',
    paddingVertical: 10,
    borderRadius: 8,
    alignItems: 'center',
    marginHorizontal: 3,
    borderWidth: 1,
    borderColor: '#334155',
  },
  selectedLetterChip: {
    backgroundColor: '#10b981',
    borderColor: '#059669',
  },
  letterChipText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#94a3b8',
  },
  selectedLetterChipText: {
    color: '#ffffff',
  },
  formBtnRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 20,
  },
  cancelBtn: {
    flex: 1,
    backgroundColor: '#334155',
    paddingVertical: 12,
    borderRadius: 8,
    alignItems: 'center',
    marginRight: 8,
  },
  cancelBtnText: {
    color: '#cbd5e1',
    fontWeight: '600',
    fontSize: 14,
  },
  saveBtn: {
    flex: 2,
    backgroundColor: '#6366f1',
    paddingVertical: 12,
    borderRadius: 8,
    alignItems: 'center',
    marginLeft: 8,
  },
  saveBtnText: {
    color: '#ffffff',
    fontWeight: '700',
    fontSize: 14,
  },
});
