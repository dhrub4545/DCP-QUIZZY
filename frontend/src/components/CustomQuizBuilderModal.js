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
  ActivityIndicator,
  Alert,
} from 'react-native';
import {
  Layers,
  Plus,
  Trash2,
  Play,
  X,
  Shuffle,
  Clock,
  Save,
  SlidersHorizontal,
  CheckCircle2,
} from 'lucide-react-native';
import { fetchQuizSourcesApi, generateCustomQuizApi } from '../services/api';

export default function CustomQuizBuilderModal({ visible, onClose, onStartTest }) {
  const [loadingSources, setLoadingSources] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [availableSources, setAvailableSources] = useState([]);

  // Form State
  const [quizTitle, setQuizTitle] = useState('Custom Combined Mock Test');
  const [quizSubject, setQuizSubject] = useState('Custom Mix');
  const [saveAsQuiz, setSaveAsQuiz] = useState(false);
  const [timerSeconds, setTimerSeconds] = useState(30);
  const [shuffleOptions, setShuffleOptions] = useState(false);

  // Array of source allocations: [{ id: string (unique key), quizId: string, count: string }]
  const [allocations, setAllocations] = useState([]);

  const loadSources = async () => {
    try {
      setLoadingSources(true);
      const res = await fetchQuizSourcesApi();
      if (res && res.sources) {
        setAvailableSources(res.sources);

        // Pre-populate sensible defaults if available (e.g. Medicine & Pediatrics)
        if (allocations.length === 0 && res.sources.length > 0) {
          const medSource = res.sources.find((s) => s.subject === 'Medicine') || res.sources[0];
          const pedSource = res.sources.find((s) => s.subject === 'Pediatrics') || (res.sources[1] || res.sources[0]);

          const initial = [];
          if (medSource) {
            initial.push({ id: 'alloc-1', quizId: medSource._id, count: '100' });
          }
          if (pedSource && pedSource._id !== medSource?._id) {
            initial.push({ id: 'alloc-2', quizId: pedSource._id, count: '100' });
          }

          if (initial.length > 0) {
            setAllocations(initial);
          }
        }
      }
    } catch (err) {
      console.warn('Failed to load quiz sources:', err.message);
    } finally {
      setLoadingSources(false);
    }
  };

  useEffect(() => {
    if (visible) {
      loadSources();
    }
  }, [visible]);

  const handleAddSource = () => {
    if (availableSources.length === 0) {
      Alert.alert('No Sources', 'No question banks found in database.');
      return;
    }
    // Default to first available source
    const newId = 'alloc-' + Date.now();
    setAllocations([
      ...allocations,
      { id: newId, quizId: availableSources[0]._id, count: '50' },
    ]);
  };

  const handleRemoveSource = (id) => {
    if (allocations.length <= 1) {
      Alert.alert('Minimum Source', 'You must have at least one question source.');
      return;
    }
    setAllocations(allocations.filter((item) => item.id !== id));
  };

  const handleUpdateSource = (id, field, value) => {
    setAllocations(
      allocations.map((item) => {
        if (item.id === id) {
          return { ...item, [field]: value };
        }
        return item;
      })
    );
  };

  // Calculate live total questions count
  const totalQuestionsRequested = allocations.reduce((sum, item) => {
    const val = parseInt(item.count, 10);
    return sum + (isNaN(val) || val < 0 ? 0 : val);
  }, 0);

  const timerChoices = [
    { label: 'Untimed', value: 0 },
    { label: '15s / Q', value: 15 },
    { label: '30s / Q', value: 30 },
    { label: '60s / Q', value: 60 },
  ];

  const handleGenerateAndStart = async () => {
    if (allocations.length === 0) {
      Alert.alert('Validation Error', 'Please add at least one question source.');
      return;
    }

    const payloadSources = allocations
      .map((item) => ({
        quizId: item.quizId,
        count: parseInt(item.count, 10) || 0,
      }))
      .filter((s) => s.quizId && s.count > 0);

    if (payloadSources.length === 0) {
      Alert.alert('Validation Error', 'Please specify a valid question count (>0) for your sources.');
      return;
    }

    try {
      setSubmitting(true);

      const res = await generateCustomQuizApi({
        title: quizTitle.trim() || 'Custom Combined Mock Test',
        subject: quizSubject.trim() || 'Custom Mix',
        description: `Custom quiz combining questions from ${payloadSources.length} question banks.`,
        sources: payloadSources,
        saveAsQuiz,
      });

      if (res && res.quiz) {
        onClose();
        onStartTest(res.quiz, {
          timerSeconds,
          shuffleOptions,
        });
      } else {
        throw new Error(res?.message || 'Failed to generate custom quiz.');
      }
    } catch (err) {
      Alert.alert('Generation Error', err.message || 'Server failed to generate custom test.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={onClose}>
      <View style={styles.modalOverlay}>
        <View style={styles.modalContainer}>
          {/* Header */}
          <View style={styles.modalHeader}>
            <View style={styles.headerTitleRow}>
              <View style={styles.iconBadge}>
                <SlidersHorizontal size={18} color="#818cf8" />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.modalTitle}>Multi-Source Quiz Builder</Text>
                <Text style={styles.modalSubtitle}>Mix questions from different Question Banks</Text>
              </View>
            </View>
            <TouchableOpacity style={styles.closeBtn} onPress={onClose}>
              <X size={18} color="#94a3b8" />
            </TouchableOpacity>
          </View>

          <ScrollView style={styles.modalBody} showsVerticalScrollIndicator={false}>
            {/* Title & Subject */}
            <View style={styles.sectionCard}>
              <Text style={styles.sectionLabel}>Test Metadata</Text>
              <View style={styles.inputGroup}>
                <Text style={styles.fieldLabel}>Test Title</Text>
                <TextInput
                  style={styles.textInput}
                  value={quizTitle}
                  onChangeText={setQuizTitle}
                  placeholder="e.g. Grand Medicine & Pediatrics Test"
                  placeholderTextColor="#64748b"
                />
              </View>
            </View>

            {/* Question Sources Allocation */}
            <View style={styles.sectionCard}>
              <View style={styles.sectionHeaderRow}>
                <View style={{ flexDirection: 'row', alignItems: 'center', flex: 1, marginRight: 8 }}>
                  <Layers size={16} color="#818cf8" style={{ marginRight: 6 }} />
                  <Text style={styles.sectionLabel} numberOfLines={1}>Source Allocations</Text>
                </View>
                <TouchableOpacity style={styles.addSourceBtn} onPress={handleAddSource}>
                  <Plus size={13} color="#FFFFFF" />
                  <Text style={styles.addSourceText}>Add Source</Text>
                </TouchableOpacity>
              </View>

              {loadingSources ? (
                <ActivityIndicator size="small" color="#818cf8" style={{ marginVertical: 20 }} />
              ) : allocations.length === 0 ? (
                <Text style={styles.emptyText}>No sources added yet. Tap 'Add Source' above.</Text>
              ) : (
                allocations.map((item, index) => {
                  const currentSourceObj = availableSources.find((s) => s._id === item.quizId);
                  const maxAvailable = currentSourceObj?.questionCount || 0;

                  return (
                    <View key={item.id} style={styles.allocationCard}>
                      <View style={styles.allocCardHeader}>
                        <Text style={styles.sourceIndexTag}>Source #{index + 1}</Text>
                        {allocations.length > 1 && (
                          <TouchableOpacity onPress={() => handleRemoveSource(item.id)}>
                            <Trash2 size={16} color="#ef4444" />
                          </TouchableOpacity>
                        )}
                      </View>

                      {/* Source Picker */}
                      <Text style={styles.fieldLabel}>Select Question Bank</Text>
                      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.pickerScroll}>
                        {availableSources.map((src) => {
                          const isSelected = src._id === item.quizId;
                          return (
                            <TouchableOpacity
                              key={src._id}
                              style={[styles.sourceChip, isSelected && styles.sourceChipActive]}
                              onPress={() => handleUpdateSource(item.id, 'quizId', src._id)}
                            >
                              <Text style={[styles.sourceChipText, isSelected && styles.sourceChipTextActive]}>
                                {src.subject || src.title} ({src.questionCount} Qs)
                              </Text>
                            </TouchableOpacity>
                          );
                        })}
                      </ScrollView>

                      {/* Count Selection */}
                      <View style={{ marginTop: 10 }}>
                        <View style={styles.countLabelRow}>
                          <Text style={styles.fieldLabel}>Questions from this bank</Text>
                          <Text style={styles.maxText}>Max available: {maxAvailable}</Text>
                        </View>
                        <TextInput
                          style={styles.textInput}
                          value={String(item.count)}
                          onChangeText={(val) => handleUpdateSource(item.id, 'count', val)}
                          keyboardType="numeric"
                          placeholder="e.g. 100"
                          placeholderTextColor="#64748b"
                        />

                        {/* Quick Preset Chips */}
                        <View style={styles.presetChipsRow}>
                          {['10', '25', '50', '100', String(maxAvailable)].map((presetVal) => {
                            const isPresetActive = item.count === presetVal;
                            return (
                              <TouchableOpacity
                                key={presetVal}
                                style={[styles.presetChip, isPresetActive && styles.presetChipActive]}
                                onPress={() => handleUpdateSource(item.id, 'count', presetVal)}
                              >
                                <Text style={[styles.presetChipText, isPresetActive && styles.presetChipTextActive]}>
                                  {presetVal === String(maxAvailable) ? `All (${maxAvailable})` : presetVal}
                                </Text>
                              </TouchableOpacity>
                            );
                          })}
                        </View>
                      </View>
                    </View>
                  );
                })
              )}
            </View>

            {/* Test Settings (Timer & Options) */}
            <View style={styles.sectionCard}>
              <Text style={styles.sectionLabel}>Test Execution Settings</Text>

              {/* Timer Choice */}
              <View style={{ marginTop: 8 }}>
                <View style={styles.settingRowHeader}>
                  <Clock size={15} color="#818cf8" />
                  <Text style={styles.settingLabel}>Timer Per Question</Text>
                </View>
                <View style={styles.timerChipsRow}>
                  {timerChoices.map((choice) => {
                    const isSelected = timerSeconds === choice.value;
                    return (
                      <TouchableOpacity
                        key={choice.value}
                        style={[styles.timerChip, isSelected && styles.timerChipActive]}
                        onPress={() => setTimerSeconds(choice.value)}
                      >
                        <Text style={[styles.timerChipText, isSelected && styles.timerChipTextActive]}>
                          {choice.label}
                        </Text>
                      </TouchableOpacity>
                    );
                  })}
                </View>
              </View>

              {/* Shuffle Options Switch */}
              <View style={styles.switchRow}>
                <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                  <Shuffle size={15} color="#818cf8" style={{ marginRight: 8 }} />
                  <Text style={styles.settingLabel}>Shuffle Answer Options</Text>
                </View>
                <Switch
                  value={shuffleOptions}
                  onValueChange={setShuffleOptions}
                  trackColor={{ false: '#334155', true: '#6366f1' }}
                  thumbColor={shuffleOptions ? '#818cf8' : '#cbd5e1'}
                />
              </View>

              {/* Save as Quiz Switch */}
              <View style={styles.switchRow}>
                <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                  <Save size={15} color="#818cf8" style={{ marginRight: 8 }} />
                  <View>
                    <Text style={styles.settingLabel}>Save as Permanent Quiz</Text>
                    <Text style={styles.switchSubtext}>Keep this combined quiz in your Quiz library</Text>
                  </View>
                </View>
                <Switch
                  value={saveAsQuiz}
                  onValueChange={setSaveAsQuiz}
                  trackColor={{ false: '#334155', true: '#6366f1' }}
                  thumbColor={saveAsQuiz ? '#818cf8' : '#cbd5e1'}
                />
              </View>
            </View>
          </ScrollView>

          {/* Footer Bar */}
          <View style={styles.modalFooter}>
            <View style={styles.summaryBar}>
              <Text style={styles.summaryLabel}>Total Questions:</Text>
              <Text style={styles.summaryValue}>{totalQuestionsRequested} Qs</Text>
            </View>

            <TouchableOpacity
              style={[styles.startBtn, submitting && { opacity: 0.7 }]}
              onPress={handleGenerateAndStart}
              disabled={submitting}
            >
              {submitting ? (
                <ActivityIndicator size="small" color="#FFFFFF" />
              ) : (
                <>
                  <Play size={18} color="#FFFFFF" style={{ marginRight: 8 }} />
                  <Text style={styles.startBtnText}>Generate & Start Test</Text>
                </>
              )}
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(15, 23, 42, 0.8)',
    justifyContent: 'flex-end',
  },
  modalContainer: {
    backgroundColor: '#0f172a',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    maxHeight: '92%',
    minHeight: '75%',
    borderWidth: 1,
    borderColor: '#334155',
  },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingTop: 16,
    paddingBottom: 14,
    backgroundColor: '#1e293b',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    borderBottomWidth: 1,
    borderBottomColor: '#334155',
  },
  headerTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  iconBadge: {
    width: 38,
    height: 38,
    borderRadius: 10,
    backgroundColor: '#312e81',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 10,
  },
  modalTitle: {
    fontSize: 17,
    fontWeight: '700',
    color: '#f8fafc',
  },
  modalSubtitle: {
    fontSize: 11.5,
    color: '#94a3b8',
    marginTop: 1,
  },
  closeBtn: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#334155',
    alignItems: 'center',
    justifyContent: 'center',
    marginLeft: 8,
  },
  modalBody: {
    paddingHorizontal: 10,
    paddingVertical: 12,
  },
  sectionCard: {
    backgroundColor: '#1e293b',
    borderRadius: 14,
    padding: 12,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#334155',
  },
  sectionHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 10,
  },
  sectionLabel: {
    fontSize: 13,
    fontWeight: '700',
    color: '#818cf8',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  addSourceBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#6366f1',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 8,
  },
  addSourceText: {
    color: '#FFFFFF',
    fontSize: 11.5,
    fontWeight: '700',
    marginLeft: 4,
  },
  inputGroup: {
    marginTop: 8,
  },
  fieldLabel: {
    fontSize: 12.5,
    fontWeight: '600',
    color: '#cbd5e1',
    marginBottom: 6,
  },
  textInput: {
    backgroundColor: '#0f172a',
    borderWidth: 1,
    borderColor: '#334155',
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 8,
    fontSize: 13.5,
    color: '#f8fafc',
  },
  allocationCard: {
    backgroundColor: '#0f172a',
    borderRadius: 10,
    padding: 10,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: '#334155',
  },
  allocCardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  sourceIndexTag: {
    fontSize: 12,
    fontWeight: '700',
    color: '#c084fc',
  },
  pickerScroll: {
    flexDirection: 'row',
    marginBottom: 8,
  },
  sourceChip: {
    backgroundColor: '#1e293b',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 16,
    marginRight: 6,
    borderWidth: 1,
    borderColor: '#334155',
  },
  sourceChipActive: {
    backgroundColor: 'rgba(99, 102, 241, 0.25)',
    borderColor: '#818cf8',
  },
  sourceChipText: {
    fontSize: 11.5,
    color: '#94a3b8',
    fontWeight: '500',
  },
  sourceChipTextActive: {
    color: '#818cf8',
    fontWeight: '700',
  },
  countLabelRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  maxText: {
    fontSize: 11,
    color: '#64748b',
  },
  presetChipsRow: {
    flexDirection: 'row',
    marginTop: 8,
    flexWrap: 'wrap',
    gap: 4,
  },
  presetChip: {
    backgroundColor: '#1e293b',
    paddingHorizontal: 9,
    paddingVertical: 5,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: '#334155',
  },
  presetChipActive: {
    backgroundColor: '#6366f1',
    borderColor: '#6366f1',
  },
  presetChipText: {
    fontSize: 11.5,
    color: '#cbd5e1',
    fontWeight: '600',
  },
  presetChipTextActive: {
    color: '#FFFFFF',
    fontWeight: '700',
  },
  settingRowHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
  },
  settingLabel: {
    fontSize: 13,
    fontWeight: '600',
    color: '#f8fafc',
    marginLeft: 6,
  },
  timerChipsRow: {
    flexDirection: 'row',
    gap: 6,
    marginBottom: 12,
  },
  timerChip: {
    flex: 1,
    backgroundColor: '#0f172a',
    borderWidth: 1,
    borderColor: '#334155',
    paddingVertical: 7,
    borderRadius: 8,
    alignItems: 'center',
  },
  timerChipActive: {
    backgroundColor: 'rgba(99, 102, 241, 0.25)',
    borderColor: '#818cf8',
  },
  timerChipText: {
    fontSize: 11.5,
    color: '#94a3b8',
    fontWeight: '500',
  },
  timerChipTextActive: {
    color: '#818cf8',
    fontWeight: '700',
  },
  switchRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 8,
    borderTopWidth: 1,
    borderTopColor: '#334155',
  },
  switchSubtext: {
    fontSize: 11,
    color: '#64748b',
    marginLeft: 6,
  },
  emptyText: {
    fontSize: 13,
    color: '#64748b',
    textAlign: 'center',
    marginVertical: 16,
  },
  modalFooter: {
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderTopWidth: 1,
    borderTopColor: '#334155',
    backgroundColor: '#1e293b',
  },
  summaryBar: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 10,
  },
  summaryLabel: {
    fontSize: 13.5,
    fontWeight: '600',
    color: '#94a3b8',
  },
  summaryValue: {
    fontSize: 17,
    fontWeight: '800',
    color: '#818cf8',
  },
  startBtn: {
    backgroundColor: '#6366f1',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
    borderRadius: 12,
  },
  startBtnText: {
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: '700',
  },
});
