import React, { useEffect, useRef } from 'react';
import {
  Modal,
  View,
  Text,
  StyleSheet,
  ActivityIndicator,
  TouchableOpacity,
  Animated,
  Easing,
  ScrollView,
} from 'react-native';
import {
  FileText,
  CheckCircle,
  AlertCircle,
  X,
  Layers,
  Sparkles,
  Zap,
  RefreshCw,
} from 'lucide-react-native';

export default function UploadModal({
  visible,
  onClose,
  status,
  progress,
  fileName,
  error,
  onSuccessView,
  onRetryFailed,
  batchInfo = {},
}) {
  const pulseAnim = useRef(new Animated.Value(1)).current;
  const rotateAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (status === 'uploading') {
      // Pulsing Ring Animation
      const pulse = Animated.loop(
        Animated.sequence([
          Animated.timing(pulseAnim, {
            toValue: 1.25,
            duration: 1200,
            easing: Easing.inOut(Easing.ease),
            useNativeDriver: true,
          }),
          Animated.timing(pulseAnim, {
            toValue: 1,
            duration: 1200,
            easing: Easing.inOut(Easing.ease),
            useNativeDriver: true,
          }),
        ])
      );

      // Rotating Scanner Beam
      const rotate = Animated.loop(
        Animated.timing(rotateAnim, {
          toValue: 1,
          duration: 3000,
          easing: Easing.linear,
          useNativeDriver: true,
        })
      );

      pulse.start();
      rotate.start();

      return () => {
        pulse.stop();
        rotate.stop();
      };
    }
  }, [status]);

  const spin = rotateAnim.interpolate({
    inputRange: [0, 1],
    outputRange: ['0deg', '360deg'],
  });

  const {
    currentBatch = 1,
    totalBatches = 1,
    processedBatches = 0,
    leftBatches = 0,
    extractedQuestions = 0,
    statusText = 'Processing document...',
    batchQueue = [],
  } = batchInfo;

  return (
    <Modal visible={visible} transparent animationType="fade">
      <View style={styles.overlay}>
        <View style={styles.card}>
          <TouchableOpacity style={styles.closeBtn} onPress={onClose}>
            <X color="#94a3b8" size={20} />
          </TouchableOpacity>

          {status === 'uploading' && (
            <View style={styles.content}>
              {/* Cool Pulsing AI Scanner Animation */}
              <View style={styles.animationContainer}>
                <Animated.View
                  style={[
                    styles.pulseRing,
                    { transform: [{ scale: pulseAnim }] },
                  ]}
                />
                <Animated.View
                  style={[
                    styles.scannerRing,
                    { transform: [{ rotate: spin }] },
                  ]}
                />
                <View style={styles.iconBox}>
                  <Sparkles color="#818cf8" size={32} />
                </View>
              </View>

              <Text style={styles.title}>AI Multimodal Vision</Text>
              <Text style={styles.subtitle} numberOfLines={1}>
                {fileName || 'Processing textbook PDF...'}
              </Text>

              {/* Informative Batch Badges Grid */}
              <View style={styles.badgeRow}>
                <View style={[styles.badge, styles.badgeBatch]}>
                  <Layers color="#818cf8" size={13} style={{ marginRight: 4 }} />
                  <Text style={styles.badgeText}>
                    Batch {currentBatch} of {totalBatches || 1}
                  </Text>
                </View>

                <View style={[styles.badge, styles.badgeLeft]}>
                  <Text style={styles.badgeTextLeft}>
                    {leftBatches > 0 ? `${leftBatches} Left` : 'Finalizing'}
                  </Text>
                </View>

                {extractedQuestions > 0 && (
                  <View style={[styles.badge, styles.badgeQuestions]}>
                    <Zap color="#10b981" size={13} style={{ marginRight: 4 }} />
                    <Text style={styles.badgeTextQuestions}>
                      {extractedQuestions} MCQs Extracted
                    </Text>
                  </View>
                )}
              </View>

              {/* Glowing Progress Bar */}
              <View style={styles.progressSection}>
                <View style={styles.progressBarBg}>
                  <View
                    style={[styles.progressBarFill, { width: `${progress}%` }]}
                  />
                </View>
                <View style={styles.progressPercentRow}>
                  <Text style={styles.statusDetailText} numberOfLines={1}>
                    {statusText}
                  </Text>
                  <Text style={styles.progressPercentText}>{progress}%</Text>
                </View>
              </View>

              {/* Batch Queue List */}
              {Array.isArray(batchQueue) && batchQueue.length > 0 && (
                <View style={styles.batchQueueSection}>
                  <Text style={styles.batchQueueHeader}>
                    Batch Queue ({processedBatches}/{totalBatches} Succeeded)
                  </Text>
                  <ScrollView style={styles.batchQueueList} nestedScrollEnabled={true}>
                    {batchQueue.map((item) => (
                      <View key={item.chunkIndex} style={styles.batchQueueRow}>
                        <Text style={styles.batchQueueTitle}>
                          Batch {item.chunkIndex} <Text style={styles.batchPagesText}>(Pages {item.startPage}-{item.endPage})</Text>
                        </Text>

                        {item.status === 'success' && (
                          <View style={[styles.batchStatusBadge, styles.statusSuccessBadge]}>
                            <CheckCircle color="#10b981" size={12} style={{ marginRight: 4 }} />
                            <Text style={styles.statusTextSuccess}>{item.questionCount || 0} MCQs</Text>
                          </View>
                        )}

                        {item.status === 'processing' && (
                          <View style={[styles.batchStatusBadge, styles.statusProcessingBadge]}>
                            <ActivityIndicator size="small" color="#818cf8" style={{ marginRight: 4 }} />
                            <Text style={styles.statusTextProcessing}>Reading</Text>
                          </View>
                        )}

                        {item.status === 'error' && (
                          <TouchableOpacity
                            style={[styles.batchStatusBadge, styles.statusErrorBadge]}
                            onPress={() => onRetrySingleBatch && onRetrySingleBatch(item.chunkIndex)}
                          >
                            <AlertCircle color="#ef4444" size={12} style={{ marginRight: 4 }} />
                            <Text style={styles.statusTextError}>Retry Batch {item.chunkIndex}</Text>
                          </TouchableOpacity>
                        )}

                        {item.status === 'queued' && (
                          <TouchableOpacity
                            style={[styles.batchStatusBadge, styles.statusQueuedBadge]}
                            onPress={() => onRetrySingleBatch && onRetrySingleBatch(item.chunkIndex)}
                          >
                            <Text style={styles.statusTextQueued}>Run Batch {item.chunkIndex}</Text>
                          </TouchableOpacity>
                        )}
                      </View>
                    ))}
                  </ScrollView>
                </View>
              )}

              <View style={styles.liveIndicatorRow}>
                <ActivityIndicator size="small" color="#818cf8" />
                <Text style={styles.liveIndicatorText}>
                  Verbatim OCR & Markdown Table Extraction...
                </Text>
              </View>
            </View>
          )}

          {status === 'success' && (
            <View style={styles.content}>
              <View style={[styles.iconBox, { backgroundColor: 'rgba(34, 197, 94, 0.15)', borderWidth: 1, borderColor: 'rgba(34, 197, 94, 0.3)' }]}>
                <CheckCircle color="#22c55e" size={36} />
              </View>
              <Text style={styles.title}>Quiz Ready!</Text>
              <Text style={styles.subtitle}>
                {extractedQuestions > 0
                  ? `Successfully extracted ${extractedQuestions} questions across all batches.`
                  : 'Questions successfully extracted from PDF.'}
              </Text>

              <TouchableOpacity style={styles.primaryBtn} onPress={onSuccessView}>
                <Text style={styles.primaryBtnText}>Start Quiz Now</Text>
              </TouchableOpacity>
            </View>
          )}

          {status === 'error' && (
            <View style={styles.content}>
              <View style={[styles.iconBox, { backgroundColor: 'rgba(245, 158, 11, 0.15)', borderWidth: 1, borderColor: 'rgba(245, 158, 11, 0.3)' }]}>
                <AlertCircle color="#f59e0b" size={36} />
              </View>
              <Text style={styles.title}>
                {error && error.includes('15-30') ? 'Quota Limit — Paused' : 'Processing Interrupted'}
              </Text>
              <Text style={styles.errorText}>{error || 'Failed to process PDF'}</Text>

              {/* Batch Queue List in Error / Paused Mode */}
              {Array.isArray(batchQueue) && batchQueue.length > 0 && (
                <View style={styles.batchQueueSection}>
                  <Text style={styles.batchQueueHeader}>
                    Batch Queue ({processedBatches}/{totalBatches} Succeeded)
                  </Text>
                  <ScrollView style={styles.batchQueueList} nestedScrollEnabled={true}>
                    {batchQueue.map((item) => (
                      <View key={item.chunkIndex} style={styles.batchQueueRow}>
                        <Text style={styles.batchQueueTitle}>
                          Batch {item.chunkIndex} <Text style={styles.batchPagesText}>(Pages {item.startPage}-{item.endPage})</Text>
                        </Text>

                        {item.status === 'success' && (
                          <View style={[styles.batchStatusBadge, styles.statusSuccessBadge]}>
                            <CheckCircle color="#10b981" size={12} style={{ marginRight: 4 }} />
                            <Text style={styles.statusTextSuccess}>{item.questionCount || 0} MCQs</Text>
                          </View>
                        )}

                        {(item.status === 'error' || item.status === 'queued') && (
                          <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                            <View style={[styles.batchStatusBadge, styles.statusErrorBadge, { marginRight: 6 }]}>
                              <AlertCircle color="#ef4444" size={12} style={{ marginRight: 4 }} />
                              <Text style={styles.statusTextError}>
                                {item.status === 'error' ? 'Failed' : 'Queued'}
                              </Text>
                            </View>
                            {onRetryFailed && (
                              <TouchableOpacity
                                style={styles.inlineRetryBtn}
                                onPress={() => onRetryFailed(item.chunkIndex)}
                              >
                                <RefreshCw color="#ffffff" size={10} style={{ marginRight: 3 }} />
                                <Text style={styles.inlineRetryBtnText}>Retry</Text>
                              </TouchableOpacity>
                            )}
                          </View>
                        )}

                        {item.status === 'processing' && (
                          <View style={[styles.batchStatusBadge, styles.statusProcessingBadge]}>
                            <ActivityIndicator size="small" color="#818cf8" style={{ marginRight: 4 }} />
                            <Text style={styles.statusTextProcessing}>Reading</Text>
                          </View>
                        )}
                      </View>
                    ))}
                  </ScrollView>
                </View>
              )}

              {onRetryFailed && (
                <TouchableOpacity style={[styles.primaryBtn, { backgroundColor: '#d97706', marginBottom: 8 }]} onPress={() => onRetryFailed('all')}>
                  <RefreshCw color="#ffffff" size={16} style={{ marginRight: 6 }} />
                  <Text style={styles.primaryBtnText}>Retry All Failed Batches</Text>
                </TouchableOpacity>
              )}

              {extractedQuestions > 0 && onSuccessView && (
                <TouchableOpacity style={styles.primaryBtn} onPress={onSuccessView}>
                  <Text style={styles.primaryBtnText}>View {extractedQuestions} Saved Questions</Text>
                </TouchableOpacity>
              )}

              <TouchableOpacity style={[styles.secondaryBtn, { marginTop: 10 }]} onPress={onClose}>
                <Text style={styles.secondaryBtnText}>Close & Retry Later</Text>
              </TouchableOpacity>
            </View>
          )}
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(15, 23, 42, 0.88)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  card: {
    width: '100%',
    maxWidth: 400,
    backgroundColor: '#1e293b',
    borderRadius: 24,
    padding: 24,
    borderWidth: 1,
    borderColor: '#334155',
    elevation: 12,
    position: 'relative',
  },
  closeBtn: {
    position: 'absolute',
    top: 16,
    right: 16,
    zIndex: 10,
    padding: 4,
  },
  content: {
    alignItems: 'center',
  },
  animationContainer: {
    width: 100,
    height: 100,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 16,
    position: 'relative',
  },
  pulseRing: {
    position: 'absolute',
    width: 84,
    height: 84,
    borderRadius: 42,
    backgroundColor: 'rgba(129, 140, 248, 0.15)',
    borderWidth: 1,
    borderColor: 'rgba(129, 140, 248, 0.3)',
  },
  scannerRing: {
    position: 'absolute',
    width: 92,
    height: 92,
    borderRadius: 46,
    borderWidth: 2,
    borderColor: 'transparent',
    borderTopColor: '#818cf8',
    borderRightColor: '#c084fc',
  },
  iconBox: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: '#0f172a',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#334155',
  },
  title: {
    fontSize: 20,
    fontWeight: '800',
    color: '#f8fafc',
    marginBottom: 4,
  },
  subtitle: {
    fontSize: 13,
    color: '#94a3b8',
    textAlign: 'center',
    marginBottom: 16,
  },
  badgeRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'center',
    gap: 8,
    marginBottom: 18,
  },
  badge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 20,
  },
  badgeBatch: {
    backgroundColor: 'rgba(129, 140, 248, 0.15)',
    borderWidth: 1,
    borderColor: 'rgba(129, 140, 248, 0.3)',
  },
  badgeText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#a5b4fc',
  },
  badgeLeft: {
    backgroundColor: 'rgba(71, 85, 105, 0.4)',
    borderWidth: 1,
    borderColor: '#475569',
  },
  badgeTextLeft: {
    fontSize: 12,
    fontWeight: '600',
    color: '#cbd5e1',
  },
  badgeQuestions: {
    backgroundColor: 'rgba(16, 185, 129, 0.15)',
    borderWidth: 1,
    borderColor: 'rgba(16, 185, 129, 0.3)',
  },
  badgeTextQuestions: {
    fontSize: 12,
    fontWeight: '700',
    color: '#34d399',
  },
  progressSection: {
    width: '100%',
    marginBottom: 14,
  },
  progressBarBg: {
    width: '100%',
    height: 8,
    backgroundColor: '#0f172a',
    borderRadius: 4,
    overflow: 'hidden',
    marginBottom: 6,
    borderWidth: 1,
    borderColor: '#334155',
  },
  progressBarFill: {
    height: '100%',
    backgroundColor: '#818cf8',
    borderRadius: 4,
  },
  progressPercentRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  statusDetailText: {
    fontSize: 11,
    color: '#94a3b8',
    flex: 1,
    marginRight: 8,
  },
  progressPercentText: {
    fontSize: 12,
    fontWeight: '800',
    color: '#818cf8',
  },
  liveIndicatorRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  liveIndicatorText: {
    fontSize: 11,
    color: '#64748b',
  },
  batchQueueSection: {
    width: '100%',
    backgroundColor: '#0f172a',
    borderRadius: 14,
    padding: 12,
    marginVertical: 10,
    borderWidth: 1,
    borderColor: '#334155',
    maxHeight: 180,
  },
  batchQueueHeader: {
    fontSize: 11,
    fontWeight: '700',
    color: '#94a3b8',
    marginBottom: 8,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  batchQueueList: {
    width: '100%',
  },
  batchQueueRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 6,
    borderBottomWidth: 1,
    borderBottomColor: '#1e293b',
  },
  batchQueueTitle: {
    fontSize: 12.5,
    fontWeight: '700',
    color: '#f8fafc',
  },
  batchPagesText: {
    fontSize: 11,
    fontWeight: '500',
    color: '#64748b',
  },
  batchStatusBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 12,
  },
  statusSuccessBadge: {
    backgroundColor: 'rgba(16, 185, 129, 0.15)',
    borderWidth: 1,
    borderColor: 'rgba(16, 185, 129, 0.3)',
  },
  statusTextSuccess: {
    fontSize: 11,
    fontWeight: '700',
    color: '#34d399',
  },
  statusProcessingBadge: {
    backgroundColor: 'rgba(129, 140, 248, 0.15)',
    borderWidth: 1,
    borderColor: 'rgba(129, 140, 248, 0.3)',
  },
  statusTextProcessing: {
    fontSize: 11,
    fontWeight: '700',
    color: '#818cf8',
  },
  statusErrorBadge: {
    backgroundColor: 'rgba(239, 68, 68, 0.15)',
    borderWidth: 1,
    borderColor: 'rgba(239, 68, 68, 0.3)',
  },
  statusTextError: {
    fontSize: 11,
    fontWeight: '700',
    color: '#f87171',
  },
  statusQueuedBadge: {
    backgroundColor: '#1e293b',
    borderWidth: 1,
    borderColor: '#334155',
  },
  statusTextQueued: {
    fontSize: 11,
    fontWeight: '600',
    color: '#64748b',
  },
  inlineRetryBtn: {
    backgroundColor: '#6366f1',
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 8,
  },
  inlineRetryBtnText: {
    fontSize: 10.5,
    fontWeight: '700',
    color: '#ffffff',
  },
  errorText: {
    fontSize: 14,
    color: '#f87171',
    textAlign: 'center',
    marginBottom: 20,
  },
  primaryBtn: {
    backgroundColor: '#6366f1',
    paddingVertical: 14,
    paddingHorizontal: 24,
    borderRadius: 14,
    width: '100%',
    alignItems: 'center',
    marginTop: 10,
  },
  primaryBtnText: {
    color: '#ffffff',
    fontSize: 16,
    fontWeight: '700',
  },
  secondaryBtn: {
    backgroundColor: '#334155',
    paddingVertical: 12,
    paddingHorizontal: 24,
    borderRadius: 12,
    width: '100%',
    alignItems: 'center',
  },
  secondaryBtnText: {
    color: '#f8fafc',
    fontSize: 15,
    fontWeight: '600',
  },
});
