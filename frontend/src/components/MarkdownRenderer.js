import React, { useState, useRef, useEffect } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Modal, PanResponder, Platform, Dimensions, Animated } from 'react-native';
import { X } from 'lucide-react-native';
import ZoomableImageCard from './ZoomableImageCard';

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window');

function formatCellText(text) {
  if (!text) return '';
  let cleaned = String(text).trim();
  cleaned = cleaned.replace(/<br\s*\/?>/gi, '\n');
  return cleaned;
}

function cleanTableHeaderText(text) {
  if (!text) return '';
  let cleaned = cleanLatexFormulas(String(text).trim());
  cleaned = cleaned.replace(/<br\s*\/?>/gi, '\n');
  cleaned = cleaned.replace(/<\/?(b|strong)>/gi, '');
  cleaned = cleaned.replace(/<\/?u>/gi, '');
  // Collapse consecutive bold tokens like **** **** or ******* into a space
  cleaned = cleaned.replace(/\*{2,}\s*\*{2,}/g, ' ');
  // Remove markdown bold asterisks ** (e.g. **Header** or ** Header** -> Header)
  cleaned = cleaned.replace(/\*{2,}/g, '');
  // Remove backticks
  cleaned = cleaned.replace(/`+/g, '');
  return cleaned.trim();
}

function normalizeTableRows(headers, rawRows) {
  if (!rawRows || !Array.isArray(rawRows)) return [];
  const normalizedRows = [];

  rawRows.forEach((row) => {
    if (!Array.isArray(row)) return;
    const cellLines = row.map((cell) =>
      formatCellText(cell)
        .split('\n')
        .map((l) => l.trim())
    );

    const maxLines = Math.max(...cellLines.map((lines) => lines.length), 1);

    for (let lineIdx = 0; lineIdx < maxLines; lineIdx++) {
      const rowLine = cellLines.map((lines) => lines[lineIdx] || '');
      normalizedRows.push(rowLine);
    }
  });

  return normalizedRows;
}

/**
 * Enhanced Table Component (Strict A4 Paper Format + Responsive Mobile Card)
 * Clean inline card preview with full-screen translucent inspection modal (matches ZoomableImageCard UX)
 * Supports light theme for Study Mode and dark theme for default app mode.
 */
function InteractiveTableRenderer({ block, theme = 'dark' }) {
  const isLight = theme === 'light';

  const [modalVisible, setModalVisible] = useState(false);
  const [rawTableHeight, setRawTableHeight] = useState(0);

  const synchronizedRows = normalizeTableRows(block.headers, block.rows);
  const colCount = Math.max(block.headers.length, (synchronizedRows[0] || []).length, 1);
  const A4_WIDTH = 760;

  // Proportional scale factor to fit full A4 width within mobile window card
  const containerWidth = Math.min(SCREEN_WIDTH - 52, 480);
  const scaleRatio = Number((containerWidth / A4_WIDTH).toFixed(4));
  const estimatedHeight = Math.max(120, (synchronizedRows.length + 1) * 44);
  const inlineHeight = (rawTableHeight > 0 ? rawTableHeight : estimatedHeight) * scaleRatio;

  // Natural overview scale: guarantees both width and height fit completely within screen (zero overflow)
  const currentTblHeight = rawTableHeight > 0 ? rawTableHeight : estimatedHeight;
  const maxModalW = SCREEN_WIDTH - 24;
  const maxModalH = SCREEN_HEIGHT * 0.82;
  const scaleToFitWidth = maxModalW / A4_WIDTH;
  const scaleToFitHeight = maxModalH / Math.max(100, currentTblHeight);
  const initialTableScale = Number(Math.max(0.18, Math.min(scaleToFitWidth, scaleToFitHeight, 1.0)).toFixed(3));

  const scale = useRef(new Animated.Value(initialTableScale)).current;
  const pan = useRef(new Animated.ValueXY({ x: 0, y: 0 })).current;
  const backdropOpacity = useRef(new Animated.Value(1)).current;
  const currentScale = useRef(initialTableScale);
  const currentPan = useRef({ x: 0, y: 0 });

  // Native gallery gesture baseline tracking refs
  const gestureMode = useRef('none'); // 'none' | 'pinch' | 'pan'
  const pinchStartDist = useRef(1);
  const pinchStartScale = useRef(initialTableScale);
  const pinchOrigin = useRef({ x: 0, y: 0 });
  const panStartTouch = useRef({ x: 0, y: 0 });
  const panStartPan = useRef({ x: 0, y: 0 });
  const touchStartTime = useRef(0);
  const lastTapTime = useRef(0);
  const resetTimerRef = useRef(null);
  const isDismissing = useRef(false);

  useEffect(() => {
    return () => {
      if (resetTimerRef.current) {
        clearTimeout(resetTimerRef.current);
      }
    };
  }, []);

  useEffect(() => {
    const sSub = scale.addListener((v) => {
      if (!isDismissing.current) {
        currentScale.current = v.value;
      }
    });
    const pSub = pan.addListener((v) => {
      if (!isDismissing.current) {
        currentPan.current = v;
      }
    });
    return () => {
      scale.removeListener(sSub);
      pan.removeListener(pSub);
    };
  }, []);

  const resetTableZoom = (animated = true) => {
    currentScale.current = initialTableScale;
    currentPan.current = { x: 0, y: 0 };
    gestureMode.current = 'none';
    pinchStartDist.current = 1;
    pinchStartScale.current = initialTableScale;
    pinchOrigin.current = { x: 0, y: 0 };
    panStartTouch.current = { x: 0, y: 0 };
    panStartPan.current = { x: 0, y: 0 };

    pan.stopAnimation();
    scale.stopAnimation();

    if (animated) {
      Animated.parallel([
        Animated.spring(scale, {
          toValue: initialTableScale,
          useNativeDriver: true,
          bounciness: 4,
          speed: 16,
        }),
        Animated.spring(pan, {
          toValue: { x: 0, y: 0 },
          useNativeDriver: true,
          bounciness: 4,
          speed: 16,
        }),
        Animated.timing(backdropOpacity, {
          toValue: 1,
          duration: 150,
          useNativeDriver: true,
        }),
      ]).start();
    } else {
      scale.setValue(initialTableScale);
      pan.setValue({ x: 0, y: 0 });
      backdropOpacity.setValue(1);
    }
  };

  const clampTablePanToBounds = (s) => {
    const tblH = rawTableHeight || estimatedHeight;
    const maxPanX = Math.max(0, (A4_WIDTH * s - SCREEN_WIDTH) / 2 + 30);
    const maxPanY = Math.max(0, (tblH * s - SCREEN_HEIGHT) / 2 + 30);
    const targetX = Math.max(-maxPanX, Math.min(maxPanX, currentPan.current.x));
    const targetY = Math.max(-maxPanY, Math.min(maxPanY, currentPan.current.y));

    if (Math.abs(targetX - currentPan.current.x) > 1 || Math.abs(targetY - currentPan.current.y) > 1) {
      currentPan.current = { x: targetX, y: targetY };
      Animated.spring(pan, {
        toValue: { x: targetX, y: targetY },
        useNativeDriver: true,
        bounciness: 4,
        speed: 16,
      }).start();
    }
  };

  const handleOpenModal = () => {
    if (resetTimerRef.current) {
      clearTimeout(resetTimerRef.current);
      resetTimerRef.current = null;
    }
    isDismissing.current = false;
    resetTableZoom(false);
    backdropOpacity.setValue(1);
    setModalVisible(true);
  };

  const handleCloseModal = () => {
    if (isDismissing.current) return;
    isDismissing.current = true;
    Animated.timing(backdropOpacity, {
      toValue: 0,
      duration: 160,
      useNativeDriver: true,
    }).start(() => {
      setModalVisible(false);
      if (resetTimerRef.current) {
        clearTimeout(resetTimerRef.current);
      }
      resetTimerRef.current = setTimeout(() => {
        isDismissing.current = false;
        resetTableZoom(false);
      }, 350);
    });
  };

  const handleDoubleTapAt = (touchX, touchY) => {
    if (currentScale.current > initialTableScale * 1.15) {
      resetTableZoom(true);
    } else {
      const targetScale = Math.max(initialTableScale * 2.5, 1.2);
      const targetPanX = (SCREEN_WIDTH / 2 - touchX) * (targetScale - initialTableScale);
      const targetPanY = (SCREEN_HEIGHT / 2 - touchY) * (targetScale - initialTableScale);

      const maxPanX = Math.max(0, (A4_WIDTH * targetScale - SCREEN_WIDTH) / 2);
      const maxPanY = Math.max(0, ((rawTableHeight || estimatedHeight) * targetScale - SCREEN_HEIGHT) / 2);
      const boundedPanX = Math.max(-maxPanX, Math.min(maxPanX, targetPanX));
      const boundedPanY = Math.max(-maxPanY, Math.min(maxPanY, targetPanY));

      currentScale.current = targetScale;
      currentPan.current = { x: boundedPanX, y: boundedPanY };

      Animated.parallel([
        Animated.spring(scale, {
          toValue: targetScale,
          useNativeDriver: true,
          bounciness: 4,
          speed: 16,
        }),
        Animated.spring(pan, {
          toValue: { x: boundedPanX, y: boundedPanY },
          useNativeDriver: true,
          bounciness: 4,
          speed: 16,
        }),
        Animated.timing(backdropOpacity, {
          toValue: 1,
          duration: 150,
          useNativeDriver: true,
        }),
      ]).start();
    }
  };

  const startPinch = (t1, t2) => {
    const dist = Math.hypot(t1.pageX - t2.pageX, t1.pageY - t2.pageY);
    if (dist < 5) return;
    gestureMode.current = 'pinch';
    pinchStartDist.current = dist;
    pinchStartScale.current = currentScale.current;
    const centerX = (t1.pageX + t2.pageX) / 2;
    const centerY = (t1.pageY + t2.pageY) / 2;
    pinchOrigin.current = {
      x: (centerX - SCREEN_WIDTH / 2 - currentPan.current.x) / (pinchStartScale.current || 1),
      y: (centerY - SCREEN_HEIGHT / 2 - currentPan.current.y) / (pinchStartScale.current || 1),
    };
  };

  const panResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponder: () => true,
      onPanResponderTerminationRequest: () => false,

      onPanResponderGrant: (evt) => {
        if (isDismissing.current) return;
        const touches = evt.nativeEvent.touches;
        touchStartTime.current = Date.now();

        if (touches.length >= 2) {
          startPinch(touches[0], touches[1]);
        } else if (touches.length === 1) {
          gestureMode.current = 'pan';
          panStartTouch.current = { x: touches[0].pageX, y: touches[0].pageY };
          panStartPan.current = { x: currentPan.current.x, y: currentPan.current.y };
          pinchStartDist.current = null;
        }
      },
      onPanResponderMove: (evt, gs) => {
        if (isDismissing.current) return;
        const touches = evt.nativeEvent.touches;

        // TWO FINGERS PINCH TO ZOOM & PAN (TRUE GALLERY ENGINE)
        if (touches.length >= 2) {
          const t1 = touches[0];
          const t2 = touches[1];
          const curDist = Math.hypot(t1.pageX - t2.pageX, t1.pageY - t2.pageY);
          if (curDist < 5) return;

          // Seamless transition if 2nd finger just arrived
          if (gestureMode.current !== 'pinch' || !pinchStartDist.current) {
            startPinch(t1, t2);
            return;
          }

          // Compute scale directly from baseline anchor (ZERO frame-to-frame noise)
          const rawScale = (curDist / pinchStartDist.current) * pinchStartScale.current;
          let effectiveScale = rawScale;

          // Elastic rubberband resistance for table
          const minBound = initialTableScale * 0.85;
          const maxBound = 3.8;
          if (rawScale < minBound) {
            const under = minBound - rawScale;
            effectiveScale = minBound - under * 0.4;
          } else if (rawScale > maxBound) {
            const over = rawScale - maxBound;
            effectiveScale = maxBound + over * 0.35;
          }

          effectiveScale = Math.max(initialTableScale * 0.6, Math.min(effectiveScale, 5.0));

          const curCenterX = (t1.pageX + t2.pageX) / 2;
          const curCenterY = (t1.pageY + t2.pageY) / 2;

          // Calculate precise focal pan
          const newPanX = curCenterX - SCREEN_WIDTH / 2 - pinchOrigin.current.x * effectiveScale;
          const newPanY = curCenterY - SCREEN_HEIGHT / 2 - pinchOrigin.current.y * effectiveScale;

          scale.setValue(effectiveScale);
          pan.setValue({ x: newPanX, y: newPanY });
          currentScale.current = effectiveScale;
          currentPan.current = { x: newPanX, y: newPanY };
        }
        // ONE FINGER PAN / PULL-TO-DISMISS
        else if (touches.length === 1) {
          const t = touches[0];

          // Seamless transition if 1 finger lifted during pinch
          if (gestureMode.current !== 'pan') {
            gestureMode.current = 'pan';
            panStartTouch.current = { x: t.pageX, y: t.pageY };
            panStartPan.current = { x: currentPan.current.x, y: currentPan.current.y };
            pinchStartDist.current = null;
            return;
          }

          const deltaX = t.pageX - panStartTouch.current.x;
          const deltaY = t.pageY - panStartTouch.current.y;

          // Native Gallery Pull-down-to-dismiss when table is at overview scale
          if (currentScale.current <= initialTableScale * 1.15) {
            if (deltaY > 0) {
              const newX = panStartPan.current.x + deltaX * 0.35;
              const newY = panStartPan.current.y + deltaY;
              pan.setValue({
                x: newX,
                y: newY,
              });
              currentPan.current = { x: newX, y: newY };
              const fade = Math.min(0.7, deltaY / 400);
              backdropOpacity.setValue(Math.max(0.25, 1 - fade));
              scale.setValue(Math.max(initialTableScale * 0.85, initialTableScale - deltaY / 1500));
            } else {
              // Slight upward resistance
              const newX = panStartPan.current.x + deltaX * 0.35;
              const newY = panStartPan.current.y + deltaY * 0.35;
              pan.setValue({
                x: newX,
                y: newY,
              });
              currentPan.current = { x: newX, y: newY };
            }
          } else {
            // Smooth 1:1 pan when zoomed in
            const newX = panStartPan.current.x + deltaX;
            const newY = panStartPan.current.y + deltaY;
            pan.setValue({
              x: newX,
              y: newY,
            });
            currentPan.current = { x: newX, y: newY };
          }
        }
      },
      onPanResponderRelease: (evt, gs) => {
        if (isDismissing.current) return;
        const remainingTouches = evt.nativeEvent.touches;
        if (remainingTouches && remainingTouches.length === 1) {
          // Transition to 1-finger pan seamlessly
          gestureMode.current = 'pan';
          panStartTouch.current = { x: remainingTouches[0].pageX, y: remainingTouches[0].pageY };
          panStartPan.current = { x: currentPan.current.x, y: currentPan.current.y };
          pinchStartDist.current = null;
          return;
        }

        const wasMode = gestureMode.current;
        gestureMode.current = 'none';
        pinchStartDist.current = null;

        const duration = Date.now() - touchStartTime.current;
        const totalMove = Math.hypot(gs.dx, gs.dy);

        // Tap Detection (comfortable tap with movement < 16px within 350ms)
        if (totalMove < 16 && duration < 350) {
          const now = Date.now();
          const touch = evt.nativeEvent;

          if (now - lastTapTime.current < 380) {
            lastTapTime.current = 0;
            handleDoubleTapAt(touch.pageX, touch.pageY);
            return;
          } else {
            lastTapTime.current = now;
            // NOTE: Clicking on blank space DOES NOT close the modal!
            return;
          }
        }

        // Check for Gallery Pull-down-to-dismiss release near overview scale
        if (wasMode === 'pan' && currentScale.current <= initialTableScale * 1.15) {
          const dy = gs.dy;
          const vy = gs.vy;
          if (dy > 120 || (dy > 50 && vy > 0.7)) {
            // Dismiss with smooth slide-down and fade-out
            isDismissing.current = true;
            Animated.parallel([
              Animated.timing(pan, {
                toValue: { x: currentPan.current.x, y: SCREEN_HEIGHT },
                duration: 200,
                useNativeDriver: true,
              }),
              Animated.timing(backdropOpacity, {
                toValue: 0,
                duration: 180,
                useNativeDriver: true,
              }),
            ]).start(() => {
              setModalVisible(false);
              if (resetTimerRef.current) {
                clearTimeout(resetTimerRef.current);
              }
              resetTimerRef.current = setTimeout(() => {
                isDismissing.current = false;
                resetTableZoom(false);
              }, 350);
            });
            return;
          } else {
            // Snap back to overview scale and (0,0)
            Animated.parallel([
              Animated.spring(scale, {
                toValue: initialTableScale,
                useNativeDriver: true,
                bounciness: 4,
                speed: 16,
              }),
              Animated.spring(pan, {
                toValue: { x: 0, y: 0 },
                useNativeDriver: true,
                bounciness: 4,
                speed: 16,
              }),
              Animated.timing(backdropOpacity, {
                toValue: 1,
                duration: 150,
                useNativeDriver: true,
              }),
            ]).start();
            return;
          }
        }

        // Normal Release for Pinch or Zoomed-in Pan:
        backdropOpacity.setValue(1);
        if (currentScale.current < initialTableScale) {
          resetTableZoom(true);
        } else if (currentScale.current > 3.8) {
          Animated.spring(scale, {
            toValue: 3.5,
            useNativeDriver: true,
            bounciness: 4,
            speed: 16,
          }).start();
          clampTablePanToBounds(3.5);
        } else {
          clampTablePanToBounds(currentScale.current);
        }
      },
      onPanResponderTerminate: () => {
        gestureMode.current = 'none';
        pinchStartDist.current = null;
        if (currentScale.current < initialTableScale) {
          resetTableZoom(true);
        }
        backdropOpacity.setValue(1);
      },
    })
  ).current;

  const getColWidth = (colIdx) => {
    if (colCount <= 1) return A4_WIDTH - 24;
    if (colCount === 2) return colIdx === 0 ? 260 : A4_WIDTH - 284;
    if (colCount === 3) return colIdx < 2 ? 180 : A4_WIDTH - 384;
    if (colCount === 4) return colIdx < 3 ? 140 : A4_WIDTH - 444;

    if (colIdx < colCount - 1) {
      return Math.max(100, Math.floor(520 / (colCount - 1)));
    } else {
      const sumOthers = (colCount - 1) * Math.max(100, Math.floor(520 / (colCount - 1)));
      return Math.max(240, A4_WIDTH - sumOthers - 24);
    }
  };

  const renderA4TableBody = () => (
    <View
      style={[
        styles.a4TableContainer,
        { width: A4_WIDTH },
        isLight && { backgroundColor: '#ffffff', borderColor: '#cbd5e1' },
      ]}
      onLayout={(e) => {
        const h = e.nativeEvent.layout.height;
        if (h > 0 && Math.abs(h - rawTableHeight) > 2) {
          setRawTableHeight(h);
        }
      }}
    >
      {/* Table Header */}
      {block.headers.length > 0 && (
        <View
          style={[
            styles.tableHeaderRow,
            isLight && { backgroundColor: '#f1f5f9', borderBottomColor: '#cbd5e1' },
          ]}
        >
          {block.headers.map((cell, cIdx) => (
            <View
              key={cIdx}
              style={[
                styles.tableCell,
                styles.tableHeaderCell,
                isLight && { backgroundColor: '#f1f5f9' },
                { width: getColWidth(cIdx) },
                cIdx < block.headers.length - 1 &&
                  (isLight ? { borderRightWidth: 1, borderRightColor: '#cbd5e1' } : styles.cellRightBorder),
              ]}
            >
              <Text
                style={[
                  styles.tableHeaderText,
                  isLight && { color: '#4338ca', fontWeight: '800' },
                ]}
              >
                {cleanTableHeaderText(cell)}
              </Text>
            </View>
          ))}
        </View>
      )}

      {/* Table Body Rows */}
      {synchronizedRows.map((row, rIdx) => (
        <View
          key={rIdx}
          style={[
            styles.tableRow,
            isLight && { borderBottomColor: '#e2e8f0' },
            rIdx % 2 === 1 && (isLight ? { backgroundColor: '#f8fafc' } : styles.tableRowAlt),
            rIdx === synchronizedRows.length - 1 && styles.tableRowLast,
          ]}
        >
          {row.map((cellText, cIdx) => (
            <View
              key={cIdx}
              style={[
                styles.tableCell,
                { width: getColWidth(cIdx) },
                cIdx < row.length - 1 &&
                  (isLight ? { borderRightWidth: 1, borderRightColor: '#e2e8f0' } : styles.cellRightBorder),
              ]}
            >
              <Text style={[styles.tableCellText, isLight && { color: '#0f172a' }]}>
                {renderFormattedInlineText(cellText, theme)}
              </Text>
            </View>
          ))}
        </View>
      ))}
    </View>
  );

  return (
    <View style={styles.tableWrapper}>
      {/* Scaled Inline A4 Table Card (Fills Mobile Window Width like a Picture) */}
      <TouchableOpacity
        activeOpacity={0.9}
        onPress={handleOpenModal}
        style={[
          styles.inlineTableCard,
          isLight ? styles.inlineTableCardLight : styles.inlineTableCardDark,
        ]}
      >
        <View style={{ width: containerWidth, height: inlineHeight, overflow: 'hidden', alignSelf: 'center' }}>
          <View
            style={{
              width: A4_WIDTH,
              transform: [
                { translateX: -A4_WIDTH * ((1 - scaleRatio) / 2) },
                { translateY: -(rawTableHeight || estimatedHeight) * ((1 - scaleRatio) / 2) },
                { scale: scaleRatio },
              ],
            }}
          >
            {renderA4TableBody()}
          </View>
        </View>
      </TouchableOpacity>

      {/* Full-Screen Translucent Table Inspection Modal (Gallery-Grade Focal Zoom) */}
      {modalVisible && (
        <Modal
          visible={true}
          transparent={true}
          animationType="fade"
          presentationStyle="overFullScreen"
          onRequestClose={handleCloseModal}
        >
          <Animated.View
            style={[
              styles.tableModalBackdrop,
              { opacity: backdropOpacity },
            ]}
            {...panResponder.panHandlers}
          >
            {/* Focal-Zoomable Animated A4 Table Sheet Container */}
            <View style={styles.modalContentContainer} pointerEvents="box-none">
              <Animated.View
                style={[
                  styles.a4PageSheet,
                  isLight && { backgroundColor: '#ffffff' },
                  {
                    transform: [
                      { translateX: pan.x },
                      { translateY: pan.y },
                      { scale: scale },
                    ],
                  },
                ]}
              >
                {renderA4TableBody()}
              </Animated.View>
            </View>

            {/* Prominent Floating Close Button for Table Modal */}
            <TouchableOpacity
              style={styles.modalCloseBtn}
              onPress={handleCloseModal}
              activeOpacity={0.8}
              hitSlop={{ top: 20, bottom: 20, left: 20, right: 20 }}
              accessibilityLabel="Close table viewer"
            >
              <X size={24} color="#ffffff" strokeWidth={2.5} />
            </TouchableOpacity>
          </Animated.View>
        </Modal>
      )}
    </View>
  );
}

/**
 * Dedicated Code Block Component
 * Displays preformatted blocks, schemas, and code with monospace font,
 * subtle background, rounded corners, and horizontal scroll.
 */
function CodeBlockRenderer({ code, language, theme = 'dark' }) {
  const isLight = theme === 'light';
  return (
    <View style={[styles.codeBlockContainer, isLight && styles.codeBlockContainerLight]}>
      {language ? (
        <View style={[styles.codeBlockHeader, isLight && styles.codeBlockHeaderLight]}>
          <Text style={[styles.codeBlockHeaderText, isLight && styles.codeBlockHeaderTextLight]}>
            {language.toUpperCase()}
          </Text>
        </View>
      ) : null}
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={true}
        contentContainerStyle={styles.codeBlockScroll}
      >
        <Text style={[styles.codeBlockText, isLight && styles.codeBlockTextLight]}>
          {code}
        </Text>
      </ScrollView>
    </View>
  );
}

/**
 * Dedicated Visual Flowchart & Decision Tree Component
 * Converts text flowcharts into structured visual UI cards with light/dark theme support.
 */
function FlowchartTreeRenderer({ text, theme = 'dark' }) {
  const isLight = theme === 'light';
  const rawLines = text.split('\n').filter((l) => l.trim().length > 0);
  const elements = [];

  rawLines.forEach((line, idx) => {
    const trimmed = line.trim();

    // 0. Horizontal divider line in flowchart
    if (/^[\-\=\_\*]{2,}$/.test(trimmed)) {
      elements.push(
        <View
          key={idx}
          style={[styles.flowDividerLine, isLight && styles.flowDividerLineLight]}
        />
      );
      return;
    }

    // 1. Down Arrow Indicator
    if (trimmed === '↓' || trimmed === '|' || trimmed === 'v' || trimmed === '↓↓') {
      elements.push(
        <View key={idx} style={styles.flowArrowContainer}>
          <View style={[styles.flowLineVertical, isLight && { backgroundColor: '#6366f1' }]} />
          <Text style={[styles.flowArrowText, isLight && { color: '#4338ca' }]}>↓</Text>
        </View>
      );
      return;
    }

    // 2. Connector / Slash Branch indicators
    if (trimmed.includes('↙') || trimmed.includes('↘') || trimmed.includes('├──') || trimmed.includes('└──')) {
      elements.push(
        <View key={idx} style={styles.flowBranchLineRow}>
          <View style={[styles.flowBranchConnectorLine, isLight && { backgroundColor: '#6366f1' }]} />
        </View>
      );
      return;
    }

    // 3. Side-by-side Branch Nodes e.g. [Infrequent relapses]   [Steroid resistance]
    const bracketMatches = trimmed.match(/\[[^\]]+\]/g);
    if (bracketMatches && bracketMatches.length > 1) {
      elements.push(
        <View key={idx} style={styles.flowBranchRowContainer}>
          {bracketMatches.map((bText, bIdx) => (
            <View
              key={bIdx}
              style={[
                styles.flowNodeCard,
                styles.flowBranchNodeCard,
                isLight && { backgroundColor: '#fffbeb', borderColor: '#d97706' },
              ]}
            >
              <Text style={[styles.flowBranchNodeText, isLight && { color: '#b45309' }]}>
                {bText.slice(1, -1).trim()}
              </Text>
            </View>
          ))}
        </View>
      );
      return;
    }

    // 4. Single Decision Node or bracketed symbol/arrow
    if (trimmed.startsWith('[') && trimmed.endsWith(']')) {
      const nodeText = trimmed.slice(1, -1).trim();
      if (nodeText === '↓' || nodeText === 'v' || nodeText === '↓↓' || nodeText === '!' || nodeText === '↑') {
        elements.push(
          <View key={idx} style={styles.flowArrowContainer}>
            <View style={[styles.flowLineVertical, isLight && { backgroundColor: '#6366f1' }]} />
            <Text style={[styles.flowArrowText, isLight && { color: '#4338ca' }]}>
              {nodeText === '!' ? '!' : '↓'}
            </Text>
          </View>
        );
        return;
      }

      elements.push(
        <View
          key={idx}
          style={[
            styles.flowNodeCard,
            isLight && styles.flowNodeCardLight,
          ]}
        >
          <Text style={[styles.flowNodeTitleText, isLight && styles.flowNodeTitleTextLight]}>
            {nodeText}
          </Text>
        </View>
      );
      return;
    }

    // 5. Medical details note bullet
    if (trimmed.startsWith('☞') || trimmed.startsWith('•') || trimmed.includes(':')) {
      elements.push(
        <View
          key={idx}
          style={[
            styles.flowDetailNoteCard,
            isLight && { backgroundColor: '#f1f5f9', borderLeftColor: '#2563eb' },
          ]}
        >
          <Text style={[styles.flowDetailNoteText, isLight && { color: '#0f172a' }]}>
            {renderFormattedInlineText(trimmed, theme)}
          </Text>
        </View>
      );
      return;
    }

    // 5.5. Target or Clinical Highlight (e.g. 🎯 SAFE NEEDLE ENTRY)
    if (trimmed.startsWith('🎯') || trimmed.startsWith('⚠️') || trimmed.startsWith('⭐')) {
      elements.push(
        <View
          key={idx}
          style={[
            styles.flowTargetCard,
            isLight && styles.flowTargetCardLight,
          ]}
        >
          <Text style={[styles.flowTargetText, isLight && styles.flowTargetTextLight]}>
            {renderFormattedInlineText(trimmed, theme)}
          </Text>
        </View>
      );
      return;
    }

    // 6. ASCII schema line with arrows/pipes (e.g. (V) Intercostal Vein | <-- COSTAL GROOVE)
    if (trimmed.includes('|') || trimmed.includes('<--') || trimmed.includes('-->')) {
      elements.push(
        <Text key={idx} style={[styles.flowAsciiLineText, isLight && { color: '#334155' }]}>
          {renderFormattedInlineText(trimmed, theme)}
        </Text>
      );
      return;
    }

    // Default Flow Text Line
    elements.push(
      <Text key={idx} style={[styles.flowGeneralText, isLight && { color: '#334155' }]}>
        {renderFormattedInlineText(trimmed, theme)}
      </Text>
    );
  });

  return (
    <View
      style={[
        styles.flowchartContainer,
        isLight && { backgroundColor: '#f8fafc', borderColor: '#cbd5e1' },
      ]}
    >
      {elements}
    </View>
  );
}

/**
 * Enhanced MarkdownRenderer component
 * Renders Markdown headers, synchronized grid tables, bullet lists, blockquotes, visual Flowchart Decision Trees,
 * and high-resolution zoomable medical diagram images.
 * Fully memoized for 60fps/120fps smooth scrolling in large question lists.
 */
const MarkdownRenderer = React.memo(function MarkdownRenderer({ content, textStyle, theme = 'dark', style, explanationImage }) {
  if (!content && !explanationImage) return null;

  const blocks = React.useMemo(() => parseMarkdownBlocks(content || '', explanationImage), [content, explanationImage]);
  const defaultTextColor = theme === 'light' ? '#1e293b' : '#cbd5e1';

  return (
    <View style={[styles.container, style]}>
      {blocks.map((block, index) => {
        if (block.type === 'heading') {
          return (
            <Text key={index} style={[styles.heading, headingStyle(block.level, theme)]}>
              {block.text}
            </Text>
          );
        }

        if (block.type === 'image') {
          return (
            <ZoomableImageCard
              key={index}
              uri={block.url}
              caption={block.alt || 'Explanation Diagram'}
              theme={theme}
            />
          );
        }

        if (block.type === 'code') {
          return (
            <CodeBlockRenderer
              key={index}
              code={block.text}
              language={block.language}
              theme={theme}
            />
          );
        }

        if (block.type === 'divider') {
          return (
            <View
              key={index}
              style={[
                styles.markdownDivider,
                theme === 'light' && styles.markdownDividerLight,
              ]}
            />
          );
        }

        if (block.type === 'flowchart') {
          return <FlowchartTreeRenderer key={index} text={block.text} theme={theme} />;
        }

        if (block.type === 'table') {
          return <InteractiveTableRenderer key={index} block={block} theme={theme} />;
        }

        if (block.type === 'blockquote') {
          return (
            <View
              key={index}
              style={[
                styles.blockquoteContainer,
                theme === 'light' && { backgroundColor: '#f1f5f9', borderColor: '#cbd5e1', borderLeftColor: '#6366f1' },
              ]}
            >
              <Text style={[styles.blockquoteText, theme === 'light' && { color: '#0f172a' }]}>
                {renderFormattedInlineText(block.text, theme)}
              </Text>
            </View>
          );
        }

        if (block.type === 'list') {
          return (
            <View key={index} style={styles.listContainer}>
              {block.items.map((item, iIdx) => {
                const isObj = typeof item === 'object';
                const numVal = isObj ? item.num : iIdx + 1;
                const textVal = isObj ? item.text : item;

                return (
                  <View key={iIdx} style={styles.listItem}>
                    {block.listType === 'numbered' ? (
                      <View style={styles.numPill}>
                        <Text style={styles.numPillText}>{numVal}</Text>
                      </View>
                    ) : (
                      <View style={styles.bulletDot} />
                    )}
                    <View style={{ flex: 1, flexShrink: 1, minWidth: 0 }}>
                      <Text style={[styles.paragraphText, { color: defaultTextColor }, textStyle]}>
                        {renderFormattedInlineText(textVal, theme)}
                      </Text>
                    </View>
                  </View>
                );
              })}
            </View>
          );
        }

        // Default Paragraph
        return (
          <Text
            key={index}
            style={[styles.paragraphText, { color: defaultTextColor }, textStyle]}
          >
            {renderFormattedInlineText(block.text, theme)}
          </Text>
        );
      })}
    </View>
  );
});

function parseMarkdownBlocks(text, explanationImage = null) {
  if (!text && !explanationImage) return [];

  let rawText = text || '';
  const imgUrl = (typeof explanationImage === 'string' && explanationImage.trim()) ? explanationImage.trim() : null;

  // Pre-process ((pic)) tags in text:
  // If image URL is provided, replace only the FIRST ((pic)) with a distinct markdown image tag line,
  // and strip any duplicate ((pic)) tags to prevent showing the same picture twice.
  if (imgUrl) {
    if (rawText.includes('((pic))')) {
      let replaced = false;
      rawText = rawText.replace(/\(\(pic\)\)/gi, () => {
        if (!replaced) {
          replaced = true;
          return `\n\n![Explanation Diagram](${imgUrl})\n\n`;
        }
        return '';
      });
    }
  } else {
    // If no image URL is provided, strip ((pic)) cleanly
    rawText = rawText.replace(/\(\(pic\)\)/gi, '');
  }

  const lines = rawText.split('\n');
  const blocks = [];
  const seenImageUrls = new Set();

  let currentCodeBlock = null;
  let currentTable = null;
  let currentList = null;
  let currentFlowchart = [];
  let hasRenderedImage = false;

  lines.forEach((line) => {
    const trimmed = line.trim();

    // 1. Check for Code Block fences or lone backtick lines
    if (/^`{1,}/.test(trimmed)) {
      if (currentCodeBlock) {
        // End of code block
        blocks.push({
          type: 'code',
          language: currentCodeBlock.language,
          text: currentCodeBlock.lines.join('\n'),
        });
        currentCodeBlock = null;
        return;
      } else if (trimmed.startsWith('```')) {
        // Start of standard code fence
        if (currentTable) { blocks.push(currentTable); currentTable = null; }
        if (currentList) { blocks.push(currentList); currentList = null; }
        if (currentFlowchart.length > 0) {
          blocks.push({ type: 'flowchart', text: currentFlowchart.join('\n') });
          currentFlowchart = [];
        }
        const lang = trimmed.replace(/^`+/, '').trim();
        currentCodeBlock = { language: lang, lines: [] };
        return;
      } else if (/^`+$/.test(trimmed)) {
        // Stray single or double backtick on its own line (e.g. `) -> ignore, never render as badge!
        return;
      }
    }

    if (currentCodeBlock) {
      currentCodeBlock.lines.push(line);
      return;
    }

    // 2. Horizontal Divider check: --, ---, ===, ***, ___ (2 or more dashes/equals)
    const isDivider = /^(\-{2,}|\*{3,}|_{3,}|={2,})$/.test(trimmed);
    if (isDivider && currentFlowchart.length === 0) {
      if (currentTable) { blocks.push(currentTable); currentTable = null; }
      if (currentList) { blocks.push(currentList); currentList = null; }
      blocks.push({ type: 'divider' });
      return;
    }

    // 3. Check for Markdown Image syntax: ![alt](url)
    const imgMatch = trimmed.match(/^!\[(.*?)\]\((.*?)\)$/);
    if (imgMatch) {
      if (currentTable) {
        blocks.push(currentTable);
        currentTable = null;
      }
      if (currentList) {
        blocks.push(currentList);
        currentList = null;
      }
      if (currentFlowchart.length > 0) {
        blocks.push({
          type: 'flowchart',
          text: currentFlowchart.join('\n'),
        });
        currentFlowchart = [];
      }

      const imgTarget = imgMatch[2].trim();
      if (!seenImageUrls.has(imgTarget)) {
        seenImageUrls.add(imgTarget);
        blocks.push({
          type: 'image',
          alt: imgMatch[1] || 'Explanation Diagram',
          url: imgTarget,
        });
        hasRenderedImage = true;
      }
      return;
    }

    const inFlow = currentFlowchart.length > 0;
    const isFlowLine =
      trimmed === '↓' ||
      trimmed === '|' ||
      trimmed === 'v' ||
      trimmed === '↓↓' ||
      trimmed.includes('↙') ||
      trimmed.includes('↘') ||
      trimmed.includes('├──') ||
      trimmed.includes('└──') ||
      trimmed.includes('<--') ||
      trimmed.includes('-->') ||
      /^\[[^\]]+\]$/.test(trimmed) ||
      (inFlow && (
        /^[\-\=\_\*]{2,}$/.test(trimmed) ||
        trimmed.includes('|') ||
        (trimmed.startsWith('(') && trimmed.includes(')')) ||
        trimmed.startsWith('🎯') ||
        trimmed.startsWith('⚠️')
      ));

    if (isFlowLine) {
      if (currentTable) {
        blocks.push(currentTable);
        currentTable = null;
      }
      if (currentList) {
        blocks.push(currentList);
        currentList = null;
      }
      currentFlowchart.push(trimmed);
      return;
    } else if (currentFlowchart.length > 0) {
      if (trimmed.startsWith('☞') || (trimmed.includes(':') && currentFlowchart.length >= 2)) {
        currentFlowchart.push(trimmed);
        return;
      }
      blocks.push({
        type: 'flowchart',
        text: currentFlowchart.join('\n'),
      });
      currentFlowchart = [];
    }

    if (isDivider) {
      if (currentTable) { blocks.push(currentTable); currentTable = null; }
      if (currentList) { blocks.push(currentList); currentList = null; }
      blocks.push({ type: 'divider' });
      return;
    }

    const pipeCount = (trimmed.match(/\|/g) || []).length;
    if (trimmed.startsWith('|') || pipeCount >= 2) {
      if (/^\|?[\s\:\-\|]+\|?$/.test(trimmed)) {
        return;
      }

      const rawCells = trimmed.split('|');
      const cells = (rawCells[0] === '' ? rawCells.slice(1) : rawCells)
        .map((c) => c.trim())
        .filter((c, idx, arr) => !(idx === arr.length - 1 && c === ''));

      if (cells.length >= 2) {
        if (!currentTable) {
          currentTable = {
            type: 'table',
            headers: cells,
            rows: [],
          };
        } else {
          currentTable.rows.push(cells);
        }
        return;
      }
    }

    if (currentTable) {
      blocks.push(currentTable);
      currentTable = null;
    }

    if (trimmed.startsWith('>')) {
      const quoteText = trimmed.replace(/^>\s*/, '');
      blocks.push({
        type: 'blockquote',
        text: quoteText,
      });
      return;
    }

    const numMatch = trimmed.match(/^(\d+)\.\s+(.*)$/);
    if (numMatch) {
      if (!currentList || currentList.listType !== 'numbered') {
        if (currentList) blocks.push(currentList);
        currentList = {
          type: 'list',
          listType: 'numbered',
          items: [{ num: numMatch[1], text: numMatch[2] }],
        };
      } else {
        currentList.items.push({ num: numMatch[1], text: numMatch[2] });
      }
      return;
    }

    const isBulletLine = /^(?:[•\u2022]\s*|[\-\*]\s+)/.test(trimmed);
    if (isBulletLine) {
      const itemText = trimmed.replace(/^(?:[•\u2022]\s*|[\-\*]\s+)/, '');
      if (!currentList || currentList.listType === 'numbered') {
        if (currentList) blocks.push(currentList);
        currentList = {
          type: 'list',
          listType: 'bullet',
          items: [itemText],
        };
      } else {
        currentList.items.push(itemText);
      }
      return;
    } else if (currentList) {
      blocks.push(currentList);
      currentList = null;
    }

    if (!trimmed) return;

    const headingMatch = trimmed.match(/^(#{1,6})\s+(.*)$/);
    if (headingMatch) {
      blocks.push({
        type: 'heading',
        level: headingMatch[1].length,
        text: headingMatch[2].trim(),
      });
      return;
    }

    blocks.push({
      type: 'paragraph',
      text: trimmed,
    });
  });

  if (currentCodeBlock) {
    blocks.push({
      type: 'code',
      language: currentCodeBlock.language,
      text: currentCodeBlock.lines.join('\n'),
    });
    currentCodeBlock = null;
  }
  if (currentFlowchart.length > 0) {
    blocks.push({
      type: 'flowchart',
      text: currentFlowchart.join('\n'),
    });
  }
  if (currentTable) blocks.push(currentTable);
  if (currentList) blocks.push(currentList);

  // If explanationImage was provided but neither ((pic)) nor ![...] was in the raw text,
  // append the image block cleanly at the bottom of the explanation!
  if (imgUrl && !seenImageUrls.has(imgUrl)) {
    seenImageUrls.add(imgUrl);
    blocks.push({
      type: 'image',
      alt: 'Explanation Diagram',
      url: imgUrl,
    });
  }

  return blocks;
}


function cleanLatexFormulas(rawStr) {
  if (!rawStr) return '';
  let text = String(rawStr);

  text = text.replace(/\$\\text\{Na\}\^\+\/\\text\{K\}\^\+\$/g, 'Na⁺/K⁺');
  text = text.replace(/\\text\{Na\}\^\+\/\\text\{K\}\^\+/g, 'Na⁺/K⁺');
  text = text.replace(/\$\\text\{Ca\}\^\{2\+\}\$/g, 'Ca²⁺');

  text = text.replace(/\$([^$]+)\$/g, '$1');
  text = text.replace(/\\\((.*?)\\\)/g, '$1');

  text = text.replace(/\\text\{([^}]+)\}/g, '$1');

  text = text.replace(/\^\{2\+\}/g, '²⁺');
  text = text.replace(/\^\{3\+\}/g, '³⁺');
  text = text.replace(/\^\{2\-\}/g, '²⁻');
  text = text.replace(/\^\+/g, '⁺');
  text = text.replace(/\^-/g, '⁻');

  text = text.replace(/_2/g, '₂');
  text = text.replace(/_3/g, '₃');
  text = text.replace(/_4/g, '₄');
  text = text.replace(/_12/g, '₁₂');

  text = text.replace(/\\/g, '');

  return text;
}

function renderFormattedInlineText(text, theme = 'dark') {
  if (!text) return '';
  const sanitized = cleanLatexFormulas(text);
  let cleanText = String(sanitized)
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<\/?(b|strong)>/gi, '**')
    .replace(/<\/?u>/gi, '');

  // Strip triple backticks or fence leaks to prevent orphan badge glitches
  cleanText = cleanText.replace(/`{3,}/g, '');

  // Strip isolated single backticks (e.g. ` alone with space or boundaries)
  cleanText = cleanText.replace(/(^|\s)`+(\s|$)/g, ' ');

  // Collapse consecutive bold boundary tokens like **** **** or ******* into a space
  cleanText = cleanText.replace(/\*{2,}\s*\*{2,}/g, ' ');

  // Normalize bold with inner leading/trailing spaces e.g. ** text** or **text ** -> **text**
  cleanText = cleanText
    .replace(/\*\*\s+([^\*]+?)\*\*/g, '**$1**')
    .replace(/\*\*([^\*]+?)\s+\*\*/g, '**$1**');

  // Normalize asymmetric/typo asterisks like *Word** or **Word* into standard **Word**
  cleanText = cleanText
    .replace(/(^|[^\*])\*([^\*\s][^\*]*?)\*\*([^\*]|$)/g, '$1**$2**$3')
    .replace(/(^|[^\*])\*\*([^\*\s][^\*]*?)\*([^\*]|$)/g, '$1**$2**$3');

  const isLight = theme === 'light';

  const regex = /(\*{2,}[^*]+\*{2,}|`[^`]+`)/g;
  const parts = cleanText.split(regex);

  return parts.map((part, idx) => {
    if (!part) return null;

    if (/^\*{2,}/.test(part) && /\*{2,}$/.test(part)) {
      const boldContent = part.replace(/^\*{2,}|\*{2,}$/g, '');
      return (
        <Text
          key={idx}
          style={{
            fontWeight: '700',
            color: isLight ? '#0f172a' : '#f8fafc',
          }}
        >
          {cleanLatexFormulas(boldContent)}
        </Text>
      );
    }

    if (part.startsWith('`') && part.endsWith('`') && part.length > 2) {
      const codeContent = part.slice(1, -1).trim();
      if (!codeContent) return null;
      return (
        <Text
          key={idx}
          style={{
            backgroundColor: isLight ? '#f1f5f9' : '#0f172a',
            color: isLight ? '#0284c7' : '#38bdf8',
            fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
            fontSize: 12,
            paddingHorizontal: 5,
            paddingVertical: 1.5,
            borderRadius: 4,
            borderWidth: 1,
            borderColor: isLight ? '#cbd5e1' : '#334155',
          }}
        >
          {codeContent}
        </Text>
      );
    }

    return cleanLatexFormulas(part.replace(/\*{2,}/g, '').replace(/`/g, ''));
  });
}

function headingStyle(level, theme = 'dark') {
  const isLight = theme === 'light';
  switch (level) {
    case 1:
      return { fontSize: 17, color: isLight ? '#6d28d9' : '#c084fc', marginTop: 12, marginBottom: 8, fontWeight: '800' };
    case 2:
      return { fontSize: 15, color: isLight ? '#4338ca' : '#818cf8', marginTop: 10, marginBottom: 6, fontWeight: '700' };
    case 3:
    default:
      return { fontSize: 13.5, color: isLight ? '#047857' : '#a7f3d0', marginTop: 8, marginBottom: 4, fontWeight: '700' };
  }
}

const styles = StyleSheet.create({
  container: {
    width: '100%',
    flexShrink: 1,
  },
  heading: {
    fontWeight: '700',
    flexShrink: 1,
  },
  paragraphText: {
    fontSize: 13,
    color: '#cbd5e1',
    lineHeight: 20,
    marginVertical: 3,
    flexShrink: 1,
    width: '100%',
    textAlign: 'left',
  },

  badgeHeader: {
    backgroundColor: 'rgba(99, 102, 241, 0.15)',
    borderRadius: 6,
    paddingVertical: 3,
    paddingHorizontal: 8,
    alignSelf: 'flex-start',
    marginBottom: 8,
    borderWidth: 1,
    borderColor: '#6366f1',
  },
  badgeHeaderText: {
    fontSize: 10,
    fontWeight: '800',
    color: '#818cf8',
    letterSpacing: 0.5,
  },

  flowchartContainer: {
    backgroundColor: '#0f172a',
    borderRadius: 14,
    padding: 12,
    marginVertical: 10,
    borderWidth: 1.5,
    borderColor: '#6366f1',
    shadowColor: '#6366f1',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.25,
    shadowRadius: 8,
    elevation: 5,
  },
  flowNodeCard: {
    backgroundColor: '#1e293b',
    borderRadius: 10,
    paddingVertical: 8,
    paddingHorizontal: 12,
    alignItems: 'center',
    justifyContent: 'center',
    marginVertical: 4,
    borderWidth: 1.5,
    borderColor: '#818cf8',
  },
  flowNodeCardLight: {
    backgroundColor: '#ffffff',
    borderColor: '#6366f1',
    borderWidth: 1.5,
    borderRadius: 8,
    paddingVertical: 7,
    paddingHorizontal: 12,
  },
  flowNodeTitleText: {
    fontSize: 13,
    fontWeight: '700',
    color: '#f8fafc',
    textAlign: 'center',
  },
  flowNodeTitleTextLight: {
    color: '#312e81',
    fontWeight: '800',
    fontSize: 12.5,
    letterSpacing: 0.4,
  },
  flowTargetCard: {
    backgroundColor: 'rgba(16, 185, 129, 0.15)',
    borderRadius: 8,
    paddingVertical: 6,
    paddingHorizontal: 10,
    marginVertical: 4,
    borderWidth: 1,
    borderColor: '#10b981',
  },
  flowTargetCardLight: {
    backgroundColor: '#ecfdf5',
    borderColor: '#a7f3d0',
  },
  flowTargetText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#34d399',
  },
  flowTargetTextLight: {
    color: '#065f46',
  },
  flowArrowContainer: {
    alignItems: 'center',
    marginVertical: 2,
  },
  flowLineVertical: {
    width: 2,
    height: 10,
    backgroundColor: '#818cf8',
  },
  flowArrowText: {
    fontSize: 15,
    color: '#818cf8',
    fontWeight: '900',
    marginTop: -3,
  },
  flowBranchLineRow: {
    alignItems: 'center',
    marginVertical: 4,
  },
  flowBranchConnectorLine: {
    width: '80%',
    height: 2,
    backgroundColor: '#818cf8',
  },
  flowBranchRowContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 6,
    marginVertical: 6,
  },
  flowBranchNodeCard: {
    flex: 1,
    backgroundColor: '#1e293b',
    borderColor: '#f59e0b',
    borderWidth: 1.5,
    paddingVertical: 8,
    paddingHorizontal: 6,
  },
  flowBranchNodeText: {
    fontSize: 11.5,
    fontWeight: '700',
    color: '#fbbf24',
    textAlign: 'center',
  },
  flowDetailNoteCard: {
    backgroundColor: 'rgba(30, 41, 59, 0.7)',
    borderRadius: 8,
    padding: 8,
    marginVertical: 4,
    borderLeftWidth: 3.5,
    borderLeftColor: '#10b981',
  },
  flowDetailNoteText: {
    fontSize: 12,
    color: '#cbd5e1',
    lineHeight: 18,
    textAlign: 'left',
  },
  flowGeneralText: {
    fontSize: 12,
    color: '#94a3b8',
    marginVertical: 2,
  },
  flowDividerLine: {
    height: 1,
    backgroundColor: '#334155',
    marginVertical: 6,
    width: '100%',
  },
  flowDividerLineLight: {
    backgroundColor: '#cbd5e1',
  },
  flowAsciiLineText: {
    fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
    fontSize: 11.5,
    lineHeight: 18,
    color: '#94a3b8',
    marginVertical: 1,
  },

  markdownDivider: {
    height: 1,
    backgroundColor: '#334155',
    marginVertical: 10,
    width: '100%',
  },
  markdownDividerLight: {
    backgroundColor: '#e2e8f0',
  },

  codeBlockContainer: {
    backgroundColor: '#0f172a',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#334155',
    marginVertical: 8,
    overflow: 'hidden',
    width: '100%',
  },
  codeBlockContainerLight: {
    backgroundColor: '#f8fafc',
    borderColor: '#cbd5e1',
  },
  codeBlockHeader: {
    backgroundColor: '#1e293b',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderBottomWidth: 1,
    borderBottomColor: '#334155',
  },
  codeBlockHeaderLight: {
    backgroundColor: '#f1f5f9',
    borderBottomColor: '#cbd5e1',
  },
  codeBlockHeaderText: {
    fontSize: 10,
    fontWeight: '700',
    color: '#818cf8',
    letterSpacing: 0.5,
  },
  codeBlockHeaderTextLight: {
    color: '#6366f1',
  },
  codeBlockScroll: {
    padding: 10,
  },
  codeBlockText: {
    fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
    fontSize: 12,
    lineHeight: 18,
    color: '#38bdf8',
  },
  codeBlockTextLight: {
    color: '#0f172a',
  },

  tableWrapper: {
    marginVertical: 10,
  },
  tableActionBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  tableBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(99, 102, 241, 0.15)',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: 'rgba(99, 102, 241, 0.3)',
  },
  tableBadgeText: {
    fontSize: 11,
    color: '#818cf8',
    fontWeight: '600',
  },
  zoomBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#6366f1',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 6,
  },
  zoomBtnText: {
    fontSize: 11,
    color: '#FFFFFF',
    fontWeight: '700',
  },
  tableContainer: {
    borderWidth: 1.5,
    borderColor: '#475569',
    borderRadius: 10,
    overflow: 'hidden',
    backgroundColor: '#0f172a',
    elevation: 3,
  },
  a4TableContainer: {
    borderWidth: 1.5,
    borderColor: '#475569',
    borderRadius: 8,
    overflow: 'hidden',
    backgroundColor: '#0f172a',
  },
  a4PageSheet: {
    backgroundColor: '#0f172a',
    borderRadius: 8,
    padding: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 5,
  },
  tableHeaderRow: {
    flexDirection: 'row',
    backgroundColor: '#1e293b',
    borderBottomWidth: 1.5,
    borderBottomColor: '#475569',
  },
  tableRow: {
    flexDirection: 'row',
    borderBottomWidth: 1,
    borderBottomColor: '#334155',
    alignItems: 'stretch',
  },
  tableRowAlt: {
    backgroundColor: 'rgba(30, 41, 59, 0.45)',
  },
  tableRowLast: {
    borderBottomWidth: 0,
  },
  tableCell: {
    paddingVertical: 7,
    paddingHorizontal: 8,
    justifyContent: 'center',
    flexShrink: 1,
  },
  cellRightBorder: {
    borderRightWidth: 1,
    borderRightColor: '#334155',
  },
  tableHeaderCell: {
    backgroundColor: '#1e293b',
    paddingVertical: 8,
  },
  tableHeaderText: {
    fontSize: 12,
    fontWeight: '800',
    color: '#818cf8',
    letterSpacing: 0.2,
  },
  tableCellText: {
    fontSize: 11.5,
    color: '#e2e8f0',
    lineHeight: 16,
  },

  tableModalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.78)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalContentContainer: {
    width: '100%',
    height: '100%',
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 10,
  },
  inlineTableCard: {
    borderRadius: 10,
    borderWidth: 1,
    overflow: 'hidden',
    marginVertical: 6,
  },
  inlineTableCardDark: {
    backgroundColor: '#0f172a',
    borderColor: '#334155',
    elevation: 2,
  },
  inlineTableCardLight: {
    backgroundColor: '#ffffff',
    borderColor: '#e2e8f0',
    elevation: 1,
  },

  blockquoteContainer: {
    backgroundColor: 'rgba(168, 85, 247, 0.1)',
    borderLeftWidth: 3.5,
    borderLeftColor: '#c084fc',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 8,
    marginVertical: 6,
    borderWidth: 1,
    borderColor: 'rgba(168, 85, 247, 0.25)',
    flexShrink: 1,
    width: '100%',
  },
  blockquoteText: {
    fontSize: 13,
    color: '#f8fafc',
    lineHeight: 20,
    textAlign: 'left',
    flexShrink: 1,
  },

  listContainer: {
    marginVertical: 4,
    width: '100%',
    flexShrink: 1,
  },
  listItem: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginVertical: 3,
    width: '100%',
    flexShrink: 1,
    paddingRight: 6,
  },
  bulletDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: '#818cf8',
    marginTop: 6,
    marginRight: 8,
  },
  numPill: {
    backgroundColor: 'rgba(99, 102, 241, 0.2)',
    paddingHorizontal: 6,
    paddingVertical: 1,
    borderRadius: 4,
    marginRight: 8,
    marginTop: 1,
    borderWidth: 1,
    borderColor: 'rgba(129, 140, 248, 0.4)',
  },
  numPillText: {
    fontSize: 10.5,
    fontWeight: '800',
    color: '#818cf8',
  },
  modalCloseBtn: {
    position: 'absolute',
    top: Platform.OS === 'ios' ? 52 : 36,
    right: 20,
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: 'rgba(15, 23, 42, 0.90)',
    borderWidth: 1.5,
    borderColor: 'rgba(255, 255, 255, 0.35)',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 9999,
    elevation: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.35,
    shadowRadius: 6,
  },
  modalHintPill: {
    position: 'absolute',
    bottom: Platform.OS === 'ios' ? 42 : 26,
    alignSelf: 'center',
    backgroundColor: 'rgba(15, 23, 42, 0.85)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.15)',
    paddingHorizontal: 16,
    paddingVertical: 7,
    borderRadius: 20,
    zIndex: 998,
    elevation: 6,
  },
  modalHintText: {
    color: '#f8fafc',
    fontSize: 11.5,
    fontWeight: '600',
    letterSpacing: 0.2,
  },
});

export default MarkdownRenderer;
