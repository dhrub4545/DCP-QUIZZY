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
  BookOpen,
  Check,
  CheckCircle2,
  Clock,
  Layers,
  Play,
  Plus,
  Save,
  Shuffle,
  SlidersHorizontal,
  X,
  Sparkles,
  Dice5,
  Sliders,
  Shield,
  UserCheck,
} from 'lucide-react-native';
import { fetchQuizSourcesApi, generateCustomQuizApi } from '../services/api';

export default function CustomQuizBuilderModal({ visible, onClose, onStartTest, onQuizCreated }) {
  const [loadingSources, setLoadingSources] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [availableSources, setAvailableSources] = useState([]);

  // Selected Quiz/Book IDs
  const [selectedSourceIds, setSelectedSourceIds] = useState([]);

  // Distribution Mode: 'random' vs 'custom_counts'
  const [distributionMode, setDistributionMode] = useState('random');

  // Destination Directory: 'custom' (My Custom Quizzes) vs 'standard' (Standard Quizzes)
  const [destinationCategory, setDestinationCategory] = useState('custom');

  // Custom Per-Book Allocation state: { [sourceId]: string }
  const [customBookCounts, setCustomBookCounts] = useState({});

  // Global Question Count Preset (used when distributionMode === 'random')
  const [targetCountPreset, setTargetCountPreset] = useState(50);

  // Form Customization State
  const [quizTitle, setQuizTitle] = useState('');
  const [saveAsQuiz, setSaveAsQuiz] = useState(true);
  const [timerSeconds, setTimerSeconds] = useState(30);
  const [shuffleQuestions, setShuffleQuestions] = useState(true);
  const [shuffleOptions, setShuffleOptions] = useState(true);

  const loadSources = async () => {
    try {
      setLoadingSources(true);
      const res = await fetchQuizSourcesApi();
      if (res && res.sources) {
        setAvailableSources(res.sources);
        // By default, select all available sources
        if (res.sources.length > 0) {
          setSelectedSourceIds(res.sources.map((s) => s._id));

          // Initialize custom per-book counts default to 25 each
          const initialCounts = {};
          res.sources.forEach((s) => {
            initialCounts[s._id] = '25';
          });
          setCustomBookCounts(initialCounts);
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

  const toggleSourceSelection = (id) => {
    if (selectedSourceIds.includes(id)) {
      if (selectedSourceIds.length === 1) {
        Alert.alert('Required Selection', 'You must select at least one question book/topic.');
        return;
      }
      setSelectedSourceIds(selectedSourceIds.filter((item) => item !== id));
    } else {
      setSelectedSourceIds([...selectedSourceIds, id]);
    }
  };

  const handleSelectAll = () => {
    setSelectedSourceIds(availableSources.map((s) => s._id));
  };

  const handleDeselectAll = () => {
    if (availableSources.length > 0) {
      setSelectedSourceIds([availableSources[0]._id]);
    }
  };

  const handleBookCountChange = (id, text) => {
    const cleaned = text.replace(/[^0-9]/g, '');
    setCustomBookCounts({ ...customBookCounts, [id]: cleaned });
  };

  // Calculate total available questions across selected books
  const totalAvailableInSelected = availableSources
    .filter((s) => selectedSourceIds.includes(s._id))
    .reduce((sum, s) => sum + (s.questionCount || 0), 0);

  // Compute final question target count
  let calculatedTotalQ = 50;

  if (distributionMode === 'custom_counts') {
    calculatedTotalQ = selectedSourceIds.reduce((sum, id) => {
      const val = parseInt(customBookCounts[id], 10);
      return sum + (isNaN(val) || val <= 0 ? 0 : val);
    }, 0);
  } else {
    if (targetCountPreset === 'all') {
      calculatedTotalQ = totalAvailableInSelected;
    } else {
      calculatedTotalQ = Number(targetCountPreset) || 50;
    }
  }

  const finalEffectiveCount = Math.min(calculatedTotalQ, totalAvailableInSelected || 1);

  // Auto-generate title if left empty
  const selectedSourceNames = availableSources
    .filter((s) => selectedSourceIds.includes(s._id))
    .map((s) => s.subject || s.title);

  const defaultTitle =
    selectedSourceNames.length === availableSources.length
      ? `Grand All-Subject Test (${finalEffectiveCount} Qs)`
      : `${selectedSourceNames.slice(0, 2).join(' & ')} Practice Test`;

  const countPresets = [
    { label: '10 Qs', value: 10 },
    { label: '25 Qs', value: 25 },
    { label: '50 Qs', value: 50 },
    { label: '100 Qs', value: 100 },
    { label: '200 Qs', value: 200 },
    { label: 'MAX', value: 'all' },
  ];

  const timerChoices = [
    { label: 'Untimed', value: 0 },
    { label: '15s / Q', value: 15 },
    { label: '30s / Q', value: 30 },
    { label: '60s / Q', value: 60 },
  ];

  const handleGenerateAndStart = async () => {
    if (selectedSourceIds.length === 0) {
      Alert.alert('Selection Error', 'Please select at least one question book/topic.');
      return;
    }

    let payloadSources = [];

    if (distributionMode === 'custom_counts') {
      payloadSources = selectedSourceIds.map((id) => ({
        quizId: id,
        count: parseInt(customBookCounts[id], 10) || 10,
      }));
    } else {
      const evenSplit = Math.max(1, Math.ceil(finalEffectiveCount / selectedSourceIds.length));
      payloadSources = selectedSourceIds.map((id) => ({
        quizId: id,
        count: evenSplit,
      }));
    }

    try {
      setSubmitting(true);

      const finalTitle = quizTitle.trim() || defaultTitle;

      const res = await generateCustomQuizApi({
        title: finalTitle,
        subject: selectedSourceNames.slice(0, 2).join(' & ') || 'Custom Mix',
        description: `Quiz pulling ${finalEffectiveCount} questions from ${selectedSourceIds.length} books.`,
        sources: payloadSources,
        saveAsQuiz,
        randomizeDistribution: distributionMode === 'random',
        targetTotalQuestions: finalEffectiveCount,
        destinationCategory,
      });

      if (res && res.quiz) {
        onClose();
        if (onQuizCreated) onQuizCreated(res.quiz, destinationCategory);
        if (onStartTest) {
          onStartTest(res.quiz, {
            timerSeconds,
            shuffleQuestions,
            shuffleOptions,
          });
        }
      } else {
        throw new Error(res?.message || 'Failed to generate quiz.');
      }
    } catch (err) {
      Alert.alert('Generation Error', err.message || 'Server failed to generate test.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={onClose}>
      <View style={styles.modalOverlay}>
        <View style={styles.modalContainer}>
          {/* Modal Header */}
          <View style={styles.modalHeader}>
            <View style={styles.headerTitleRow}>
              <View style={styles.iconBadge}>
                <SlidersHorizontal size={18} color="#c084fc" />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.modalTitle}>Quiz Generator & Builder</Text>
                <Text style={styles.modalSubtitle}>Pick topics, destination section & test options</Text>
              </View>
            </View>
            <TouchableOpacity style={styles.closeBtn} onPress={onClose}>
              <X size={18} color="#94a3b8" />
            </TouchableOpacity>
          </View>

          <ScrollView style={styles.modalBody} showsVerticalScrollIndicator={false}>
            {/* Distribution Strategy Mode Switcher */}
            <View style={styles.modeSwitcherContainer}>
              <TouchableOpacity
                style={[
                  styles.modeBtn,
                  distributionMode === 'random' && styles.modeBtnActive,
                ]}
                onPress={() => setDistributionMode('random')}
                activeOpacity={0.8}
              >
                <Dice5
                  size={14}
                  color={distributionMode === 'random' ? '#ffffff' : '#94a3b8'}
                />
                <Text
                  style={[
                    styles.modeBtnText,
                    distributionMode === 'random' && styles.modeBtnTextActive,
                  ]}
                >
                  Randomized Book Mix
                </Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[
                  styles.modeBtn,
                  distributionMode === 'custom_counts' && styles.modeBtnActive,
                ]}
                onPress={() => setDistributionMode('custom_counts')}
                activeOpacity={0.8}
              >
                <Sliders
                  size={14}
                  color={distributionMode === 'custom_counts' ? '#ffffff' : '#94a3b8'}
                />
                <Text
                  style={[
                    styles.modeBtnText,
                    distributionMode === 'custom_counts' && styles.modeBtnTextActive,
                  ]}
                >
                  Custom Per-Book Count
                </Text>
              </TouchableOpacity>
            </View>

            {/* Step 1: Select Question Books & Topics */}
            <View style={styles.sectionCard}>
              <View style={styles.sectionHeaderRow}>
                <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                  <Layers size={16} color="#818cf8" style={{ marginRight: 6 }} />
                  <Text style={styles.sectionLabel}>1. Select Question Books / Topics</Text>
                </View>
                <View style={styles.selectAllRow}>
                  <TouchableOpacity onPress={handleSelectAll} style={styles.quickSelectBtn}>
                    <Text style={styles.quickSelectText}>Select All</Text>
                  </TouchableOpacity>
                  <Text style={{ color: '#475569', marginHorizontal: 4 }}>|</Text>
                  <TouchableOpacity onPress={handleDeselectAll} style={styles.quickSelectBtn}>
                    <Text style={styles.quickSelectText}>Reset</Text>
                  </TouchableOpacity>
                </View>
              </View>

              {loadingSources ? (
                <View style={styles.loadingBox}>
                  <ActivityIndicator size="small" color="#a855f7" />
                  <Text style={styles.loadingText}>Loading question banks...</Text>
                </View>
              ) : availableSources.length === 0 ? (
                <Text style={styles.emptyText}>No question sources found in database.</Text>
              ) : (
                <View style={styles.booksGrid}>
                  {availableSources.map((source) => {
                    const isSelected = selectedSourceIds.includes(source._id);
                    return (
                      <View
                        key={source._id}
                        style={[styles.bookCard, isSelected && styles.bookCardSelected]}
                      >
                        <TouchableOpacity
                          style={{ flexDirection: 'row', alignItems: 'center', flex: 1 }}
                          onPress={() => toggleSourceSelection(source._id)}
                          activeOpacity={0.8}
                        >
                          <View
                            style={[
                              styles.checkbox,
                              isSelected && styles.checkboxSelected,
                            ]}
                          >
                            {isSelected ? <Check size={12} color="#ffffff" /> : null}
                          </View>
                          <View style={{ marginLeft: 10, flex: 1 }}>
                            <Text style={styles.bookTitle} numberOfLines={1}>
                              {source.title}
                            </Text>
                            <Text style={styles.bookSubject}>
                              {source.subject || 'General'} • {source.questionCount || 0} Qs available
                            </Text>
                          </View>
                        </TouchableOpacity>

                        {/* Per-book count input when in custom_counts mode */}
                        {distributionMode === 'custom_counts' && isSelected ? (
                          <View style={styles.perBookInputContainer}>
                            <TextInput
                              style={styles.perBookInput}
                              keyboardType="number-pad"
                              value={customBookCounts[source._id] !== undefined ? customBookCounts[source._id] : '25'}
                              onChangeText={(val) => handleBookCountChange(source._id, val)}
                              selectTextOnFocus={true}
                            />
                            <Text style={styles.perBookInputLabel}>Qs</Text>
                          </View>
                        ) : (
                          <View style={styles.countBadge}>
                            <Text style={styles.countBadgeText}>
                              {source.questionCount || 0} Qs
                            </Text>
                          </View>
                        )}
                      </View>
                    );
                  })}
                </View>
              )}
            </View>

            {/* Step 2: Global Question Target (when in Randomized Book Mix) */}
            {distributionMode === 'random' ? (
              <View style={styles.sectionCard}>
                <View style={styles.sectionHeaderRow}>
                  <Layers size={16} color="#818cf8" style={{ marginRight: 6 }} />
                  <Text style={styles.sectionLabel}>2. Total Questions Preset</Text>
                </View>
                <Text style={styles.sectionDesc}>
                  Number of questions randomly sampled across your selected books.
                </Text>

                <View style={styles.presetsRow}>
                  {countPresets.map((preset) => {
                    const isSelected = targetCountPreset === preset.value;
                    return (
                      <TouchableOpacity
                        key={preset.label}
                        style={[styles.presetChip, isSelected && styles.presetChipSelected]}
                        onPress={() => setTargetCountPreset(preset.value)}
                        activeOpacity={0.8}
                      >
                        <Text
                          style={[
                            styles.presetChipText,
                            isSelected && styles.presetChipTextSelected,
                          ]}
                        >
                          {preset.label}
                        </Text>
                      </TouchableOpacity>
                    );
                  })}
                </View>
              </View>
            ) : null}

            {/* Step 3: Destination Section & Test Options */}
            <View style={styles.sectionCard}>
              <Text style={styles.sectionLabel}>3. Destination Section & Options</Text>

              {/* Destination Section Switcher */}
              <View style={styles.inputGroup}>
                <Text style={styles.fieldLabel}>Save to Quiz Section</Text>
                <View style={styles.destinationRow}>
                  <TouchableOpacity
                    style={[
                      styles.destinationBtn,
                      destinationCategory === 'standard' && styles.destinationBtnActiveStandard,
                    ]}
                    onPress={() => setDestinationCategory('standard')}
                    activeOpacity={0.8}
                  >
                    <Shield size={14} color={destinationCategory === 'standard' ? '#ffffff' : '#94a3b8'} />
                    <Text style={[styles.destinationBtnText, destinationCategory === 'standard' && styles.destinationBtnTextActive]}>
                      Standard Quizzes
                    </Text>
                  </TouchableOpacity>

                  <TouchableOpacity
                    style={[
                      styles.destinationBtn,
                      destinationCategory === 'custom' && styles.destinationBtnActiveCustom,
                    ]}
                    onPress={() => setDestinationCategory('custom')}
                    activeOpacity={0.8}
                  >
                    <UserCheck size={14} color={destinationCategory === 'custom' ? '#ffffff' : '#94a3b8'} />
                    <Text style={[styles.destinationBtnText, destinationCategory === 'custom' && styles.destinationBtnTextActive]}>
                      Custom Quizzes
                    </Text>
                  </TouchableOpacity>
                </View>
              </View>

              {/* Title Input */}
              <View style={styles.inputGroup}>
                <Text style={styles.fieldLabel}>Quiz Title</Text>
                <TextInput
                  style={styles.textInput}
                  value={quizTitle}
                  onChangeText={setQuizTitle}
                  placeholder={defaultTitle}
                  placeholderTextColor="#64748b"
                />
              </View>

              {/* Timer Choice */}
              <View style={styles.inputGroup}>
                <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 6 }}>
                  <Clock size={14} color="#818cf8" style={{ marginRight: 6 }} />
                  <Text style={styles.fieldLabel}>Question Timer Speed</Text>
                </View>

                <View style={styles.presetsRow}>
                  {timerChoices.map((tc) => (
                    <TouchableOpacity
                      key={tc.label}
                      style={[
                        styles.presetChip,
                        timerSeconds === tc.value && styles.presetChipSelected,
                      ]}
                      onPress={() => setTimerSeconds(tc.value)}
                      activeOpacity={0.8}
                    >
                      <Text
                        style={[
                          styles.presetChipText,
                          timerSeconds === tc.value && styles.presetChipTextSelected,
                        ]}
                      >
                        {tc.label}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </View>
              </View>

              {/* Randomization Switches */}
              <View style={styles.toggleRow}>
                <View style={{ flex: 1, marginRight: 10 }}>
                  <Text style={styles.toggleTitle}>Randomize Question Sequence</Text>
                  <Text style={styles.toggleDesc}>
                    Shuffle question order randomly every time
                  </Text>
                </View>
                <Switch
                  value={shuffleQuestions}
                  onValueChange={setShuffleQuestions}
                  trackColor={{ false: '#334155', true: '#a855f7' }}
                  thumbColor="#ffffff"
                />
              </View>

              <View style={styles.toggleRow}>
                <View style={{ flex: 1, marginRight: 10 }}>
                  <Text style={styles.toggleTitle}>Shuffle Answer Choice Options</Text>
                  <Text style={styles.toggleDesc}>
                    Randomize A, B, C, D choice order per question
                  </Text>
                </View>
                <Switch
                  value={shuffleOptions}
                  onValueChange={setShuffleOptions}
                  trackColor={{ false: '#334155', true: '#6366f1' }}
                  thumbColor="#ffffff"
                />
              </View>

              <View style={[styles.toggleRow, { borderBottomWidth: 0 }]}>
                <View style={{ flex: 1, marginRight: 10 }}>
                  <Text style={styles.toggleTitle}>Save to Quiz Directory</Text>
                  <Text style={styles.toggleDesc}>
                    Keep this test saved in selected directory section
                  </Text>
                </View>
                <Switch
                  value={saveAsQuiz}
                  onValueChange={setSaveAsQuiz}
                  trackColor={{ false: '#334155', true: '#a855f7' }}
                  thumbColor="#ffffff"
                />
              </View>
            </View>
          </ScrollView>

          {/* Footer Action Bar */}
          <View style={styles.modalFooter}>
            <TouchableOpacity
              style={[
                styles.generateBtn,
                (submitting || selectedSourceIds.length === 0) && styles.disabledBtn,
              ]}
              onPress={handleGenerateAndStart}
              disabled={submitting || selectedSourceIds.length === 0}
              activeOpacity={0.8}
            >
              {submitting ? (
                <ActivityIndicator size="small" color="#FFFFFF" />
              ) : (
                <>
                  <Sparkles size={16} color="#FFFFFF" style={{ marginRight: 6 }} />
                  <Text style={styles.generateBtnText}>
                    Create & Start Test ({finalEffectiveCount} Qs)
                  </Text>
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
    backgroundColor: 'rgba(15, 23, 42, 0.85)',
    justifyContent: 'flex-end',
  },
  modalContainer: {
    backgroundColor: '#0f172a',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    maxHeight: '90%',
    minHeight: '75%',
    borderWidth: 1,
    borderColor: '#334155',
  },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 14,
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
    width: 34,
    height: 34,
    borderRadius: 10,
    backgroundColor: 'rgba(168, 85, 247, 0.15)',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 10,
    borderWidth: 1,
    borderColor: 'rgba(168, 85, 247, 0.3)',
  },
  modalTitle: {
    fontSize: 17,
    fontWeight: '800',
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
    backgroundColor: '#0f172a',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: '#334155',
  },
  modalBody: {
    padding: 14,
  },
  modeSwitcherContainer: {
    flexDirection: 'row',
    backgroundColor: '#1e293b',
    padding: 3,
    borderRadius: 10,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#334155',
  },
  modeBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 8,
    borderRadius: 7,
  },
  modeBtnActive: {
    backgroundColor: '#a855f7',
  },
  modeBtnText: {
    fontSize: 11.5,
    fontWeight: '600',
    color: '#94a3b8',
    marginLeft: 5,
  },
  modeBtnTextActive: {
    color: '#ffffff',
    fontWeight: '700',
  },
  sectionCard: {
    backgroundColor: '#1e293b',
    borderRadius: 14,
    padding: 14,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#334155',
  },
  sectionHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  sectionLabel: {
    fontSize: 14,
    fontWeight: '700',
    color: '#f8fafc',
  },
  sectionDesc: {
    fontSize: 12,
    color: '#94a3b8',
    marginBottom: 10,
    lineHeight: 16,
  },
  selectAllRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  quickSelectBtn: {
    paddingHorizontal: 4,
  },
  quickSelectText: {
    fontSize: 11.5,
    color: '#a855f7',
    fontWeight: '700',
  },
  loadingBox: {
    paddingVertical: 20,
    alignItems: 'center',
  },
  loadingText: {
    color: '#94a3b8',
    fontSize: 12,
    marginTop: 8,
  },
  emptyText: {
    color: '#64748b',
    fontSize: 12.5,
    fontStyle: 'italic',
    paddingVertical: 10,
  },
  booksGrid: {
    gap: 8,
    marginTop: 4,
  },
  bookCard: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#0f172a',
    borderRadius: 10,
    padding: 10,
    borderWidth: 1.5,
    borderColor: '#334155',
  },
  bookCardSelected: {
    borderColor: '#a855f7',
    backgroundColor: 'rgba(168, 85, 247, 0.08)',
  },
  checkbox: {
    width: 20,
    height: 20,
    borderRadius: 6,
    borderWidth: 1.5,
    borderColor: '#64748b',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#1e293b',
  },
  checkboxSelected: {
    backgroundColor: '#a855f7',
    borderColor: '#a855f7',
  },
  bookTitle: {
    fontSize: 13.5,
    fontWeight: '700',
    color: '#f8fafc',
  },
  bookSubject: {
    fontSize: 11,
    color: '#94a3b8',
    marginTop: 1,
  },
  countBadge: {
    backgroundColor: 'rgba(99, 102, 241, 0.15)',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: 'rgba(99, 102, 241, 0.3)',
  },
  countBadgeText: {
    fontSize: 10.5,
    fontWeight: '700',
    color: '#818cf8',
  },
  perBookInputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#1e293b',
    borderRadius: 6,
    borderWidth: 1,
    borderColor: '#a855f7',
    paddingHorizontal: 6,
    paddingVertical: 2,
  },
  perBookInput: {
    color: '#f8fafc',
    fontSize: 12,
    fontWeight: '700',
    width: 32,
    textAlign: 'center',
    padding: 0,
  },
  perBookInputLabel: {
    color: '#a855f7',
    fontSize: 10.5,
    fontWeight: '700',
    marginLeft: 2,
  },
  presetsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
    marginTop: 4,
  },
  presetChip: {
    backgroundColor: '#0f172a',
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#334155',
  },
  presetChipSelected: {
    backgroundColor: '#a855f7',
    borderColor: '#a855f7',
  },
  presetChipText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#94a3b8',
  },
  presetChipTextSelected: {
    color: '#ffffff',
    fontWeight: '800',
  },
  inputGroup: {
    marginTop: 10,
  },
  fieldLabel: {
    fontSize: 12,
    fontWeight: '600',
    color: '#cbd5e1',
    marginBottom: 4,
  },
  destinationRow: {
    flexDirection: 'row',
    gap: 8,
    marginTop: 2,
  },
  destinationBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#0f172a',
    paddingVertical: 8,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#334155',
  },
  destinationBtnActiveStandard: {
    backgroundColor: '#6366f1',
    borderColor: '#6366f1',
  },
  destinationBtnActiveCustom: {
    backgroundColor: '#a855f7',
    borderColor: '#a855f7',
  },
  destinationBtnText: {
    fontSize: 11.5,
    fontWeight: '600',
    color: '#94a3b8',
    marginLeft: 4,
  },
  destinationBtnTextActive: {
    color: '#ffffff',
    fontWeight: '700',
  },
  textInput: {
    backgroundColor: '#0f172a',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#334155',
    color: '#f8fafc',
    paddingHorizontal: 12,
    paddingVertical: 8,
    fontSize: 13,
  },
  toggleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#334155',
    marginTop: 6,
  },
  toggleTitle: {
    fontSize: 13,
    fontWeight: '600',
    color: '#f8fafc',
  },
  toggleDesc: {
    fontSize: 11,
    color: '#94a3b8',
    marginTop: 2,
  },
  modalFooter: {
    padding: 14,
    backgroundColor: '#1e293b',
    borderTopWidth: 1,
    borderTopColor: '#334155',
  },
  generateBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#a855f7',
    paddingVertical: 12,
    borderRadius: 12,
  },
  disabledBtn: {
    opacity: 0.5,
  },
  generateBtnText: {
    color: '#ffffff',
    fontSize: 14,
    fontWeight: '800',
  },
});
