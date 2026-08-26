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

  const scale = useRef(new Animated.Value(1)).current;
  const pan = useRef(new Animated.ValueXY({ x: 0, y: 0 })).current;
  const currentScale = useRef(1);
  const currentPan = useRef({ x: 0, y: 0 });

  const initialDistanceRef = useRef(null);
  const initialScaleRef = useRef(1.0);
  const initialFocalRef = useRef({ x: 0, y: 0 });
  const initialPanRef = useRef({ x: 0, y: 0 });
  const lastTapRef = useRef(0);

  useEffect(() => {
    const sSub = scale.addListener((v) => {
      currentScale.current = v.value;
    });
    const pSub = pan.addListener((v) => {
      currentPan.current = v;
    });
    return () => {
      scale.removeListener(sSub);
      pan.removeListener(pSub);
    };
  }, []);

  const synchronizedRows = normalizeTableRows(block.headers, block.rows);
  const colCount = Math.max(block.headers.length, (synchronizedRows[0] || []).length, 1);
  const A4_WIDTH = 760;

  // Proportional scale factor to fit full A4 width within mobile window card
  const containerWidth = Math.min(SCREEN_WIDTH - 52, 480);
  const scaleRatio = Number((containerWidth / A4_WIDTH).toFixed(4));
  const estimatedHeight = Math.max(120, (synchronizedRows.length + 1) * 38);
  const inlineHeight = (rawTableHeight > 0 ? rawTableHeight : estimatedHeight) * scaleRatio;

  const resetTableZoom = (animated = true) => {
    if (animated) {
      Animated.parallel([
        Animated.spring(scale, {
          toValue: 1,
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
      ]).start();
    } else {
      scale.setValue(1);
      pan.setValue({ x: 0, y: 0 });
    }
  };

  const clampTablePanToBounds = (s) => {
    const tblH = rawTableHeight || estimatedHeight;
    const maxPanX = Math.max(0, (A4_WIDTH * s - SCREEN_WIDTH) / 2 + 50);
    const maxPanY = Math.max(0, (tblH * s - SCREEN_HEIGHT) / 2 + 50);
    const targetX = Math.max(-maxPanX, Math.min(maxPanX, currentPan.current.x));
    const targetY = Math.max(-maxPanY, Math.min(maxPanY, currentPan.current.y));

    if (targetX !== currentPan.current.x || targetY !== currentPan.current.y) {
      Animated.spring(pan, {
        toValue: { x: targetX, y: targetY },
        useNativeDriver: true,
        bounciness: 4,
        speed: 16,
      }).start();
    }
  };

  const handleDoubleTapAt = (touchX, touchY) => {
    if (currentScale.current > 1.1) {
      resetTableZoom(true);
    } else {
      const targetScale = 1.9;
      const targetPanX = (SCREEN_WIDTH / 2 - touchX) * (targetScale - 1);
      const targetPanY = (SCREEN_HEIGHT / 2 - touchY) * (targetScale - 1);

      const maxPanX = Math.max(0, (A4_WIDTH * targetScale - SCREEN_WIDTH) / 2);
      const maxPanY = Math.max(0, ((rawTableHeight || estimatedHeight) * targetScale - SCREEN_HEIGHT) / 2);
      const boundedPanX = Math.max(-maxPanX, Math.min(maxPanX, targetPanX));
      const boundedPanY = Math.max(-maxPanY, Math.min(maxPanY, targetPanY));

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
      ]).start();
    }
  };

  const panResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponder: (evt, gs) => {
        return (
          evt.nativeEvent.touches.length >= 2 ||
          Math.abs(gs.dx) > 3 ||
          Math.abs(gs.dy) > 3
        );
      },
      onPanResponderGrant: (evt) => {
        if (evt.nativeEvent.touches.length === 2) {
          const [t1, t2] = evt.nativeEvent.touches;
          initialDistanceRef.current = Math.hypot(t1.pageX - t2.pageX, t1.pageY - t2.pageY);
          initialScaleRef.current = currentScale.current;
          initialFocalRef.current = {
            x: (t1.pageX + t2.pageX) / 2,
            y: (t1.pageY + t2.pageY) / 2,
          };
          initialPanRef.current = { ...currentPan.current };
        } else if (evt.nativeEvent.touches.length === 1) {
          const now = Date.now();
          const touch = evt.nativeEvent.touches[0];
          if (now - lastTapRef.current < 300) {
            handleDoubleTapAt(touch.pageX, touch.pageY);
            lastTapRef.current = 0;
          } else {
            lastTapRef.current = now;
            initialPanRef.current = { ...currentPan.current };
          }
        }
      },
      onPanResponderMove: (evt, gs) => {
        if (evt.nativeEvent.touches.length === 2) {
          const [t1, t2] = evt.nativeEvent.touches;
          const dist = Math.hypot(t1.pageX - t2.pageX, t1.pageY - t2.pageY);
          const currentFocal = {
            x: (t1.pageX + t2.pageX) / 2,
            y: (t1.pageY + t2.pageY) / 2,
          };

          if (initialDistanceRef.current && initialDistanceRef.current > 0) {
            const factor = dist / initialDistanceRef.current;
            const newScale = Math.min(Math.max(initialScaleRef.current * factor, 0.75), 3.5);

            const focalShiftX =
              (currentFocal.x - SCREEN_WIDTH / 2) * (1 - newScale / initialScaleRef.current);
            const focalShiftY =
              (currentFocal.y - SCREEN_HEIGHT / 2) * (1 - newScale / initialScaleRef.current);
            const deltaFocalX = currentFocal.x - initialFocalRef.current.x;
            const deltaFocalY = currentFocal.y - initialFocalRef.current.y;

            const nextPanX = initialPanRef.current.x + deltaFocalX + focalShiftX;
            const nextPanY = initialPanRef.current.y + deltaFocalY + focalShiftY;

            scale.setValue(newScale);
            pan.setValue({ x: nextPanX, y: nextPanY });
          } else {
            initialDistanceRef.current = dist;
            initialScaleRef.current = currentScale.current;
            initialFocalRef.current = currentFocal;
            initialPanRef.current = { ...currentPan.current };
          }
        } else if (evt.nativeEvent.touches.length === 1) {
          const nextPanX = initialPanRef.current.x + gs.dx;
          const nextPanY = initialPanRef.current.y + gs.dy;
          pan.setValue({
            x: nextPanX,
            y: nextPanY,
          });
        }
      },
      onPanResponderRelease: (evt, gs) => {
        initialDistanceRef.current = null;
        if (Math.abs(gs.dx) < 6 && Math.abs(gs.dy) < 6) {
          const touch = evt.nativeEvent;
          const tblH = rawTableHeight || estimatedHeight;
          const curW = A4_WIDTH * currentScale.current;
          const curH = tblH * currentScale.current;
          const tblTop = (SCREEN_HEIGHT - curH) / 2 + currentPan.current.y;
          const tblBottom = (SCREEN_HEIGHT + curH) / 2 + currentPan.current.y;
          const tblLeft = (SCREEN_WIDTH - curW) / 2 + currentPan.current.x;
          const tblRight = (SCREEN_WIDTH + curW) / 2 + currentPan.current.x;

          if (
            touch.pageY < tblTop ||
            touch.pageY > tblBottom ||
            touch.pageX < tblLeft ||
            touch.pageX > tblRight
          ) {
            setModalVisible(false);
            return;
          }
        }

        if (currentScale.current < 1.0) {
          resetTableZoom(true);
        } else if (currentScale.current > 3.5) {
          Animated.spring(scale, {
            toValue: 3.0,
            useNativeDriver: true,
            bounciness: 4,
            speed: 16,
          }).start();
        } else {
          clampTablePanToBounds(currentScale.current);
        }
      },
      onPanResponderTerminate: () => {
        initialDistanceRef.current = null;
        if (currentScale.current < 1.0) {
          resetTableZoom(true);
        }
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
                {formatCellText(cell)}
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
        onPress={() => {
          resetTableZoom(false);
          setModalVisible(true);
        }}
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
          onRequestClose={() => setModalVisible(false)}
        >
          <View style={styles.tableModalBackdrop} {...panResponder.panHandlers}>
            {/* Absolute Fullscreen Tap-Outside-to-Close Touch Layer */}
            <TouchableOpacity
              activeOpacity={1}
              style={StyleSheet.absoluteFillObject}
              onPress={() => setModalVisible(false)}
            />

            {/* Focal-Zoomable Animated A4 Table Sheet Container */}
            <View style={styles.modalContentContainer} pointerEvents="none">
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
          </View>
        </Modal>
      )}
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
                {bText.slice(1, -1)}
              </Text>
            </View>
          ))}
        </View>
      );
      return;
    }

    // 4. Single Decision Node e.g. [1st episode of nephrotic syndrome]
    if (trimmed.startsWith('[') && trimmed.endsWith(']')) {
      const nodeText = trimmed.slice(1, -1);
      elements.push(
        <View
          key={idx}
          style={[
            styles.flowNodeCard,
            isLight && { backgroundColor: '#ffffff', borderColor: '#6366f1' },
          ]}
        >
          <Text style={[styles.flowNodeTitleText, isLight && { color: '#0f172a' }]}>
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
  // If image URL is provided, replace ((pic)) with a distinct markdown image tag line
  if (imgUrl) {
    if (rawText.includes('((pic))')) {
      rawText = rawText.replace(/\(\(pic\)\)/g, `\n\n![Explanation Diagram](${imgUrl})\n\n`);
    }
  } else {
    // If no image URL is provided, strip ((pic)) cleanly
    rawText = rawText.replace(/\(\(pic\)\)/g, '');
  }

  const lines = rawText.split('\n');
  const blocks = [];

  let currentTable = null;
  let currentList = null;
  let currentFlowchart = [];
  let hasRenderedImage = false;

  lines.forEach((line) => {
    const trimmed = line.trim();

    // Check for Markdown Image syntax: ![alt](url)
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

      blocks.push({
        type: 'image',
        alt: imgMatch[1] || 'Explanation Diagram',
        url: imgMatch[2].trim(),
      });
      hasRenderedImage = true;
      return;
    }

    const isFlowLine =
      trimmed === '↓' ||
      trimmed === '|' ||
      trimmed === 'v' ||
      trimmed === '↓↓' ||
      trimmed.includes('↙') ||
      trimmed.includes('↘') ||
      trimmed.includes('├──') ||
      trimmed.includes('└──') ||
      /^\[[^\]]+\]/.test(trimmed);

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

    const isBulletLine = /^[•\-\*\u2022]\s*/.test(trimmed);
    if (isBulletLine) {
      const itemText = trimmed.replace(/^[•\-\*\u2022]\s*/, '');
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
  if (imgUrl && !hasRenderedImage) {
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
  const cleanText = String(sanitized).replace(/<br\s*\/?>/gi, '\n');
  const isLight = theme === 'light';

  const regex = /(\*\*[^*]+\*\*|`[^`]+`)/g;
  const parts = cleanText.split(regex);

  return parts.map((part, idx) => {
    if (!part) return null;

    if (part.startsWith('**') && part.endsWith('**')) {
      const boldContent = part.slice(2, -2);
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

    if (part.startsWith('`') && part.endsWith('`')) {
      return (
        <Text
          key={idx}
          style={{
            backgroundColor: isLight ? '#f1f5f9' : '#0f172a',
            color: isLight ? '#0284c7' : '#38bdf8',
            fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
            fontSize: 12,
            paddingHorizontal: 4,
            paddingVertical: 1,
            borderRadius: 4,
            borderWidth: 1,
            borderColor: isLight ? '#cbd5e1' : '#334155',
          }}
        >
          {part.slice(1, -1)}
        </Text>
      );
    }

    return cleanLatexFormulas(part);
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
  flowNodeTitleText: {
    fontSize: 13,
    fontWeight: '700',
    color: '#f8fafc',
    textAlign: 'center',
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
});

export default MarkdownRenderer;
