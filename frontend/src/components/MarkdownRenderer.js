import React, { useState, useRef, useEffect } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Modal, PanResponder } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Maximize2, X, ZoomIn, ZoomOut, RotateCcw, MoveHorizontal } from 'lucide-react-native';

/**
 * Interactive A4 Table Renderer Component
 * Locks table layout to standard A4 document width (794px) with dedicated column proportions:
 * Short metadata columns get fixed width (~100px), while long description/paragraph columns get
 * the remaining space (~270px) so sentences wrap naturally.
 * Includes interactive Zoom controls (Fit A4 / 100% / 150% / 200%), smooth two-finger pinch-to-zoom, and Fullscreen A4 Inspection Sheet.
 */
function InteractiveTableRenderer({ block }) {
  const [zoomModalVisible, setZoomModalVisible] = useState(false);
  const [zoomScale, setZoomScale] = useState(1.0);
  const [isPinching, setIsPinching] = useState(false);

  const initialDistanceRef = useRef(null);
  const initialScaleRef = useRef(1.0);
  const currentScaleRef = useRef(1.0);

  useEffect(() => {
    currentScaleRef.current = zoomScale;
  }, [zoomScale]);

  const synchronizedRows = normalizeTableRows(block.headers, block.rows);
  const colCount = Math.max(block.headers.length, (synchronizedRows[0] || []).length, 1);
  const A4_WIDTH = 794;

  const getTouchDistance = (touches) => {
    if (!touches || touches.length < 2) return 0;
    const [t1, t2] = touches;
    const dx = t1.pageX - t2.pageX;
    const dy = t1.pageY - t2.pageY;
    return Math.sqrt(dx * dx + dy * dy);
  };

  const panResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponderCapture: (evt) => evt.nativeEvent.touches.length === 2,
      onMoveShouldSetPanResponderCapture: (evt) => evt.nativeEvent.touches.length === 2,
      onStartShouldSetPanResponder: (evt) => evt.nativeEvent.touches.length === 2,
      onMoveShouldSetPanResponder: (evt) => evt.nativeEvent.touches.length === 2,
      onPanResponderGrant: (evt) => {
        if (evt.nativeEvent.touches.length === 2) {
          const distance = getTouchDistance(evt.nativeEvent.touches);
          initialDistanceRef.current = distance;
          initialScaleRef.current = currentScaleRef.current;
          setIsPinching(true);
        }
      },
      onPanResponderMove: (evt) => {
        if (evt.nativeEvent.touches.length === 2 && initialDistanceRef.current && initialDistanceRef.current > 0) {
          const currentDistance = getTouchDistance(evt.nativeEvent.touches);
          if (currentDistance > 0) {
            const factor = currentDistance / initialDistanceRef.current;
            const newScale = Math.min(Math.max(initialScaleRef.current * factor, 0.35), 2.5);
            setZoomScale(Number(newScale.toFixed(2)));
          }
        }
      },
      onPanResponderRelease: () => {
        initialDistanceRef.current = null;
        setIsPinching(false);
      },
      onPanResponderTerminate: () => {
        initialDistanceRef.current = null;
        setIsPinching(false);
      },
    })
  ).current;

  const getColWidth = (colIdx) => {
    if (colCount <= 1) return A4_WIDTH - 24;
    if (colCount === 2) return colIdx === 0 ? 280 : A4_WIDTH - 304;
    if (colCount === 3) return colIdx < 2 ? 180 : A4_WIDTH - 384;
    if (colCount === 4) return colIdx < 3 ? 140 : A4_WIDTH - 444;

    // 5 or more columns (e.g. 6 columns: Name, Continuous, Pitch, Timing, Quality, Associated Conditions)
    if (colIdx < colCount - 1) {
      return Math.max(100, Math.floor(520 / (colCount - 1)));
    } else {
      const sumOthers = (colCount - 1) * Math.max(100, Math.floor(520 / (colCount - 1)));
      return Math.max(250, A4_WIDTH - sumOthers - 24);
    }
  };

  const handleZoomIn = () => {
    setZoomScale((prev) => Math.min(prev + 0.25, 2.5));
  };

  const handleZoomOut = () => {
    setZoomScale((prev) => Math.max(prev - 0.25, 0.4));
  };

  const handleSetScale = (scale) => {
    setZoomScale(scale);
  };

  const renderA4TableBody = () => (
    <View style={[styles.a4TableContainer, { width: A4_WIDTH }]}>
      {/* Table Header */}
      {block.headers.length > 0 && (
        <View style={styles.tableHeaderRow}>
          {block.headers.map((cell, cIdx) => (
            <View
              key={cIdx}
              style={[
                styles.tableCell,
                styles.tableHeaderCell,
                { width: getColWidth(cIdx) },
                cIdx < block.headers.length - 1 && styles.cellRightBorder,
              ]}
            >
              <Text style={styles.tableHeaderText}>{formatCellText(cell)}</Text>
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
            rIdx % 2 === 1 && styles.tableRowAlt,
            rIdx === synchronizedRows.length - 1 && styles.tableRowLast,
          ]}
        >
          {row.map((cellText, cIdx) => (
            <View
              key={cIdx}
              style={[
                styles.tableCell,
                { width: getColWidth(cIdx) },
                cIdx < row.length - 1 && styles.cellRightBorder,
              ]}
            >
              <Text style={styles.tableCellText}>
                {renderFormattedInlineText(cellText)}
              </Text>
            </View>
          ))}
        </View>
      ))}
    </View>
  );

  return (
    <View style={styles.tableWrapper}>
      {/* Table Header Bar */}
      <View style={styles.tableActionBar}>
        <View style={styles.tableBadge}>
          <MoveHorizontal size={14} color="#818cf8" style={{ marginRight: 4 }} />
          <Text style={styles.tableBadgeText}>Fixed A4 Format ({colCount} Cols)</Text>
        </View>

        <TouchableOpacity
          style={styles.zoomBtn}
          onPress={() => {
            setZoomScale(1.0);
            setZoomModalVisible(true);
          }}
          activeOpacity={0.8}
        >
          <Maximize2 size={13} color="#FFFFFF" style={{ marginRight: 4 }} />
          <Text style={styles.zoomBtnText}>Zoom A4 Page</Text>
        </TouchableOpacity>
      </View>

      {/* Inline Horizontal Scroll View at Fixed A4 Width */}
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={true}
        nestedScrollEnabled={true}
        contentContainerStyle={{ paddingBottom: 6 }}
      >
        {renderA4TableBody()}
      </ScrollView>

      {/* Fullscreen A4 Inspection & Zoom Modal */}
      <Modal
        visible={zoomModalVisible}
        animationType="slide"
        transparent={false}
        onRequestClose={() => setZoomModalVisible(false)}
      >
        <SafeAreaView style={styles.zoomModalContainer}>
          {/* Modal Header Controls */}
          <View style={styles.zoomModalHeader}>
            <View style={{ flex: 1 }}>
              <Text style={styles.zoomModalTitle}>A4 Document Table Inspection</Text>
              <Text style={styles.zoomModalSubtitle}>
                Format: 794px A4 Width • Scale: {Math.round(zoomScale * 100)}% • Pinch to zoom ✌️
              </Text>
            </View>

            {/* Close Button */}
            <TouchableOpacity
              style={styles.zoomCloseBtn}
              onPress={() => setZoomModalVisible(false)}
            >
              <X size={18} color="#f8fafc" />
            </TouchableOpacity>
          </View>

          {/* Quick Preset Zoom Scale Toolbar */}
          <View style={styles.zoomPresetToolbar}>
            <Text style={styles.presetLabel}>Zoom:</Text>
            {[
              { label: 'Fit', scale: 0.45 },
              { label: '75%', scale: 0.75 },
              { label: '100% (A4)', scale: 1.0 },
              { label: '125%', scale: 1.25 },
              { label: '150%', scale: 1.5 },
            ].map((preset) => (
              <TouchableOpacity
                key={preset.label}
                style={[
                  styles.presetChip,
                  Math.abs(zoomScale - preset.scale) < 0.05 && styles.presetChipActive,
                ]}
                onPress={() => handleSetScale(preset.scale)}
              >
                <Text
                  style={[
                    styles.presetChipText,
                    Math.abs(zoomScale - preset.scale) < 0.05 && styles.presetChipTextActive,
                  ]}
                >
                  {preset.label}
                </Text>
              </TouchableOpacity>
            ))}

            <View style={{ flexDirection: 'row', gap: 4, marginLeft: 'auto' }}>
              <TouchableOpacity style={styles.zoomControlBtn} onPress={handleZoomOut}>
                <ZoomOut size={16} color="#f8fafc" />
              </TouchableOpacity>
              <TouchableOpacity style={styles.zoomControlBtn} onPress={handleZoomIn}>
                <ZoomIn size={16} color="#f8fafc" />
              </TouchableOpacity>
            </View>
          </View>

          {/* A4 Document Canvas Container with Pinch-to-Zoom PanResponder */}
          <View style={{ flex: 1 }} {...panResponder.panHandlers}>
            <ScrollView
              style={{ flex: 1 }}
              contentContainerStyle={styles.zoomCanvasContent}
              showsVerticalScrollIndicator={true}
              scrollEnabled={!isPinching}
            >
              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={true}
                contentContainerStyle={{ padding: 16 }}
                scrollEnabled={!isPinching}
              >
                <View
                  style={[
                    styles.a4PageSheet,
                    { transform: [{ scale: zoomScale }] },
                  ]}
                >
                  {renderA4TableBody()}
                </View>
              </ScrollView>
            </ScrollView>
          </View>
        </SafeAreaView>
      </Modal>
    </View>
  );
}

/**
 * Enhanced MarkdownRenderer component
 * Renders Markdown headers, synchronized grid tables, bullet lists, blockquotes, and visual Flowchart Decision Trees.
 */
export default function MarkdownRenderer({ content, textStyle, style }) {
  if (!content) return null;

  const blocks = parseMarkdownBlocks(content);

  return (
    <View style={[styles.container, style]}>
      {blocks.map((block, index) => {
        if (block.type === 'heading') {
          return (
            <Text key={index} style={[styles.heading, headingStyle(block.level)]}>
              {block.text}
            </Text>
          );
        }

        if (block.type === 'flowchart') {
          return <FlowchartTreeRenderer key={index} text={block.text} />;
        }

        if (block.type === 'table') {
          return <InteractiveTableRenderer key={index} block={block} />;
        }

        if (block.type === 'blockquote') {
          return (
            <View key={index} style={styles.blockquoteContainer}>
              <Text style={styles.blockquoteText}>
                {renderFormattedInlineText(block.text)}
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
                    <Text style={[styles.paragraphText, textStyle, { flex: 1 }]}>
                      {renderFormattedInlineText(textVal)}
                    </Text>
                  </View>
                );
              })}
            </View>
          );
        }

        // Default Paragraph
        return (
          <Text key={index} style={[styles.paragraphText, textStyle]}>
            {renderFormattedInlineText(block.text)}
          </Text>
        );
      })}
    </View>
  );
}

/**
 * Dedicated Visual Flowchart & Decision Tree Component
 * Converts text flowcharts (nodes, arrows ↓, side-by-side branches) into structured visual UI cards
 */
function FlowchartTreeRenderer({ text }) {
  const rawLines = text.split('\n').filter((l) => l.trim().length > 0);
  const elements = [];

  rawLines.forEach((line, idx) => {
    const trimmed = line.trim();

    // 1. Down Arrow Indicator
    if (trimmed === '↓' || trimmed === '|' || trimmed === 'v' || trimmed === '↓↓') {
      elements.push(
        <View key={idx} style={styles.flowArrowContainer}>
          <View style={styles.flowLineVertical} />
          <Text style={styles.flowArrowText}>↓</Text>
        </View>
      );
      return;
    }

    // 2. Connector / Slash Branch indicators
    if (trimmed.includes('↙') || trimmed.includes('↘') || trimmed.includes('├──') || trimmed.includes('└──')) {
      elements.push(
        <View key={idx} style={styles.flowBranchLineRow}>
          <View style={styles.flowBranchConnectorLine} />
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
            <View key={bIdx} style={[styles.flowNodeCard, styles.flowBranchNodeCard]}>
              <Text style={styles.flowBranchNodeText}>{bText.slice(1, -1)}</Text>
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
        <View key={idx} style={styles.flowNodeCard}>
          <Text style={styles.flowNodeTitleText}>{nodeText}</Text>
        </View>
      );
      return;
    }

    // 5. Medical details note bullet
    if (trimmed.startsWith('☞') || trimmed.startsWith('•') || trimmed.includes(':')) {
      elements.push(
        <View key={idx} style={styles.flowDetailNoteCard}>
          <Text style={styles.flowDetailNoteText}>{renderFormattedInlineText(trimmed)}</Text>
        </View>
      );
      return;
    }

    // Default Flow Text Line
    elements.push(
      <Text key={idx} style={styles.flowGeneralText}>
        {renderFormattedInlineText(trimmed)}
      </Text>
    );
  });

  return (
    <View style={styles.flowchartContainer}>
      {elements}
    </View>
  );
}

/**
 * Synchronizes multiline table cells across columns into 100% aligned table rows
 */
function normalizeTableRows(headers, rawRows) {
  const normalizedRows = [];

  rawRows.forEach((row) => {
    const cellLines = row.map((cell) =>
      formatCellText(cell)
        .split('\n')
        .map((l) => l.trim())
    );

    const maxLines = Math.max(...cellLines.map((lines) => lines.length), 1);

    if (maxLines > 1) {
      for (let lineIdx = 0; lineIdx < maxLines; lineIdx++) {
        const synchronizedRow = cellLines.map((lines) => lines[lineIdx] || '');
        if (synchronizedRow.some((text) => text.length > 0)) {
          normalizedRows.push(synchronizedRow);
        }
      }
    } else {
      normalizedRows.push(row.map((cell) => formatCellText(cell)));
    }
  });

  return normalizedRows;
}

/**
 * Formats cell text by replacing HTML <br> tags with clean line breaks
 */
function formatCellText(cellText) {
  if (!cellText) return '';
  return cellText
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/&nbsp;/gi, ' ')
    .trim();
}

/**
 * Parses raw markdown string into block tokens (headings, flowcharts, tables, list, blockquotes, paragraphs)
 */
function parseMarkdownBlocks(rawText) {
  const lines = rawText.split('\n');
  const blocks = [];
  let currentTable = null;
  let currentList = null;
  let currentFlowchart = [];

  lines.forEach((line) => {
    const trimmed = line.trim();

    // Check if line belongs to a flowchart block
    const isFlowLine =
      trimmed === '↓' ||
      trimmed === 'v' ||
      trimmed.includes('↙') ||
      trimmed.includes('↘') ||
      trimmed.includes('├──') ||
      trimmed.includes('└──') ||
      (trimmed.startsWith('[') && trimmed.includes(']'));

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

    // Check if table row: starts with '|' or contains multiple '|' pipes
    const pipeCount = (trimmed.match(/\|/g) || []).length;
    if (trimmed.startsWith('|') || pipeCount >= 2) {
      if (/^\|?[\s\:\-\|]+\|?$/.test(trimmed)) {
        return; // Ignore table divider line |---|---|
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

    // Check for Blockquote: '> text'
    if (trimmed.startsWith('>')) {
      const quoteText = trimmed.replace(/^>\s*/, '');
      blocks.push({
        type: 'blockquote',
        text: quoteText,
      });
      return;
    }

    // Check for Numbered List item: '1. item'
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

    // Check for Bullet List item: '- item' or '* item'
    if (/^[\-\*]\s+/.test(trimmed)) {
      const itemText = trimmed.replace(/^[\-\*]\s+/, '');
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

    // Check for Heading: '#', '##', '###'
    const headingMatch = trimmed.match(/^(#{1,6})\s+(.*)$/);
    if (headingMatch) {
      blocks.push({
        type: 'heading',
        level: headingMatch[1].length,
        text: headingMatch[2].trim(),
      });
      return;
    }

    // Paragraph
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

  return blocks;
}

/**
 * Cleans and converts LaTeX chemical and mathematical expressions into human-readable text
 * e.g. $\text{Na}^+/\text{K}^+$ -> Na⁺/K⁺
 */
function cleanLatexFormulas(rawStr) {
  if (!rawStr) return '';
  let text = String(rawStr);

  // 1. Direct replacement for common chemical pumps / ions
  text = text.replace(/\$\\text\{Na\}\^\+\/\\text\{K\}\^\+\$/g, 'Na⁺/K⁺');
  text = text.replace(/\\text\{Na\}\^\+\/\\text\{K\}\^\+/g, 'Na⁺/K⁺');
  text = text.replace(/\$\\text\{Ca\}\^\{2\+\}\$/g, 'Ca²⁺');

  // 2. Remove math mode wrappers: $ ... $ or \( ... \)
  text = text.replace(/\$([^\$]+)\$/g, '$1');
  text = text.replace(/\\\(([^\)]+)\\\)/g, '$1');

  // 3. Remove \text{...} wrappers
  text = text.replace(/\\text\{([^}]+)\}/g, '$1');

  // 4. Superscripts & Ion Charges:
  text = text.replace(/\^\{2\+\}/g, '²⁺');
  text = text.replace(/\^\{3\+\}/g, '³⁺');
  text = text.replace(/\^\{2\-\}/g, '²⁻');
  text = text.replace(/\^\+/g, '⁺');
  text = text.replace(/\^-/g, '⁻');

  // 5. Subscripts:
  text = text.replace(/_2/g, '₂');
  text = text.replace(/_3/g, '₃');
  text = text.replace(/_4/g, '₄');
  text = text.replace(/_12/g, '₁₂');

  // 6. Clean up remaining raw LaTeX backslashes
  text = text.replace(/\\/g, '');

  return text;
}

function renderFormattedInlineText(text) {
  if (!text) return '';
  const sanitized = cleanLatexFormulas(text);
  const cleanText = String(sanitized).replace(/<br\s*\/?>/gi, '\n');

  // Split by bold (**bold**) and inline code (`code`)
  const regex = /(\*\*[^*]+\*\*|`[^`]+`)/g;
  const parts = cleanText.split(regex);

  return parts.map((part, idx) => {
    if (!part) return null;

    if (part.startsWith('**') && part.endsWith('**')) {
      const boldContent = part.slice(2, -2);
      const isKeyLabel = boldContent.endsWith(':');
      return (
        <Text
          key={idx}
          style={{
            fontWeight: '700',
            color: isKeyLabel ? '#c084fc' : '#f8fafc',
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
            backgroundColor: '#0f172a',
            color: '#38bdf8',
            fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
            fontSize: 12,
            paddingHorizontal: 4,
            paddingVertical: 1,
            borderRadius: 4,
            borderWidth: 1,
            borderColor: '#334155',
          }}
        >
          {part.slice(1, -1)}
        </Text>
      );
    }

    // Check for inline Key: Value pattern e.g. "Diagnosis: Acute Epiglottitis"
    const kvMatch = part.match(/^([A-Z][A-Za-z0-9\s-]{1,25}:)(\s+.*)$/);
    if (kvMatch) {
      return (
        <Text key={idx}>
          <Text style={{ fontWeight: '700', color: '#c084fc' }}>{kvMatch[1]}</Text>
          <Text style={{ color: '#cbd5e1' }}>{cleanLatexFormulas(kvMatch[2])}</Text>
        </Text>
      );
    }

    return <Text key={idx}>{part}</Text>;
  });
}

function headingStyle(level) {
  switch (level) {
    case 1:
      return { fontSize: 17, color: '#c084fc', marginTop: 12, marginBottom: 8, fontWeight: '800' };
    case 2:
      return { fontSize: 15, color: '#818cf8', marginTop: 10, marginBottom: 6, fontWeight: '700' };
    case 3:
    default:
      return { fontSize: 13.5, color: '#a7f3d0', marginTop: 8, marginBottom: 4, fontWeight: '700' };
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
    lineHeight: 19,
    marginVertical: 3,
    flexShrink: 1,
  },

  // Badge Header
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

  // Flowchart & Decision Tree UI Components
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
    lineHeight: 17,
  },
  flowGeneralText: {
    fontSize: 12,
    color: '#94a3b8',
    marginVertical: 2,
  },

  // Synchronized Table Grid Layout
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
    paddingVertical: 8,
    paddingHorizontal: 10,
    justifyContent: 'center',
  },
  cellRightBorder: {
    borderRightWidth: 1,
    borderRightColor: '#334155',
  },
  tableHeaderCell: {
    backgroundColor: '#1e293b',
    paddingVertical: 10,
  },
  tableHeaderText: {
    fontSize: 12.5,
    fontWeight: '800',
    color: '#818cf8',
    letterSpacing: 0.3,
  },
  tableCellText: {
    fontSize: 12,
    color: '#e2e8f0',
    lineHeight: 17,
  },

  // Zoom Modal Styles
  zoomModalContainer: {
    flex: 1,
    backgroundColor: '#0f172a',
  },
  zoomModalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: '#1e293b',
    borderBottomWidth: 1,
    borderBottomColor: '#334155',
  },
  zoomModalTitle: {
    fontSize: 16,
    fontWeight: '800',
    color: '#f8fafc',
  },
  zoomModalSubtitle: {
    fontSize: 11,
    color: '#94a3b8',
    marginTop: 2,
  },
  zoomPresetToolbar: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#1e293b',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#334155',
    gap: 6,
  },
  presetLabel: {
    fontSize: 12,
    color: '#94a3b8',
    marginRight: 4,
    fontWeight: '600',
  },
  presetChip: {
    backgroundColor: '#334155',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 6,
  },
  presetChipActive: {
    backgroundColor: '#6366f1',
  },
  presetChipText: {
    fontSize: 11,
    color: '#cbd5e1',
    fontWeight: '600',
  },
  presetChipTextActive: {
    color: '#FFFFFF',
    fontWeight: '700',
  },
  zoomControlsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  zoomControlBtn: {
    width: 34,
    height: 34,
    borderRadius: 8,
    backgroundColor: '#334155',
    alignItems: 'center',
    justifyContent: 'center',
  },
  zoomCloseBtn: {
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: '#ef4444',
    alignItems: 'center',
    justifyContent: 'center',
    marginLeft: 4,
  },
  zoomCanvasContent: {
    paddingVertical: 20,
    alignItems: 'flex-start',
  },

  // Blockquote Styling
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
  },
  blockquoteText: {
    fontSize: 13,
    color: '#f8fafc',
    lineHeight: 19,
  },

  // List Styling
  listContainer: {
    marginVertical: 4,
    width: '100%',
  },
  listItem: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginVertical: 3,
    width: '100%',
    flexShrink: 1,
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
