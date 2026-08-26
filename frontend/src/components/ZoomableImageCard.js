import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  Image,
  StyleSheet,
  TouchableOpacity,
  ActivityIndicator,
  Dimensions,
  Modal,
  Animated,
  PanResponder,
} from 'react-native';
import { AlertCircle } from 'lucide-react-native';

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window');

/**
 * ZoomableImageCard
 * Gallery-grade 60fps/120fps photo viewer with focal-point 2-finger pinch zoom,
 * focal-point double-tap zoom, and blank space tap-to-close dismissal. Zero cross sign.
 */
export default function ZoomableImageCard({
  uri,
  theme = 'dark',
  style,
  imageStyle,
  aspectRatio: customAspectRatio,
}) {
  const [aspectRatio, setAspectRatio] = useState(customAspectRatio || 16 / 9);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [modalVisible, setModalVisible] = useState(false);

  // Animated transforms for 60/120fps GPU performance
  const scale = useRef(new Animated.Value(1)).current;
  const pan = useRef(new Animated.ValueXY({ x: 0, y: 0 })).current;
  const currentScale = useRef(1);
  const currentPan = useRef({ x: 0, y: 0 });

  const initialDistance = useRef(null);
  const initialScale = useRef(1);
  const initialFocal = useRef({ x: 0, y: 0 });
  const initialPan = useRef({ x: 0, y: 0 });
  const lastTapRef = useRef(0);

  useEffect(() => {
    const scaleSub = scale.addListener((v) => {
      currentScale.current = v.value;
    });
    const panSub = pan.addListener((v) => {
      currentPan.current = v;
    });
    return () => {
      scale.removeListener(scaleSub);
      pan.removeListener(panSub);
    };
  }, []);

  // Fetch actual natural image dimensions to preserve exact aspect ratio
  useEffect(() => {
    let isMounted = true;
    if (!uri || typeof uri !== 'string' || !uri.trim()) return;

    setLoading(true);
    setError(false);

    Image.getSize(
      uri,
      (width, height) => {
        if (isMounted && width && height && height > 0) {
          const ratio = width / height;
          const clampedRatio = Math.max(0.5, Math.min(ratio, 2.8));
          setAspectRatio(clampedRatio);
          setLoading(false);
        }
      },
      () => {
        if (isMounted) {
          setLoading(false);
          setError(false);
        }
      }
    );

    return () => {
      isMounted = false;
    };
  }, [uri]);

  const imgWidth = SCREEN_WIDTH * 0.94;
  const imgHeight = imgWidth / (aspectRatio || 16 / 9);

  const resetZoom = (animated = true) => {
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

  const clampPanToBounds = (s) => {
    const maxPanX = Math.max(0, (imgWidth * s - SCREEN_WIDTH) / 2 + 30);
    const maxPanY = Math.max(0, (imgHeight * s - SCREEN_HEIGHT) / 2 + 30);

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
      resetZoom(true);
    } else {
      const targetScale = 2.4;
      // Focal zoom: shift pan directly toward touched point
      const targetPanX = (SCREEN_WIDTH / 2 - touchX) * (targetScale - 1);
      const targetPanY = (SCREEN_HEIGHT / 2 - touchY) * (targetScale - 1);

      const maxPanX = Math.max(0, (imgWidth * targetScale - SCREEN_WIDTH) / 2);
      const maxPanY = Math.max(0, (imgHeight * targetScale - SCREEN_HEIGHT) / 2);
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
          currentScale.current > 1.05 ||
          Math.abs(gs.dx) > 3 ||
          Math.abs(gs.dy) > 3
        );
      },

      onPanResponderGrant: (evt) => {
        if (evt.nativeEvent.touches.length === 2) {
          const [t1, t2] = evt.nativeEvent.touches;
          initialDistance.current = Math.hypot(t1.pageX - t2.pageX, t1.pageY - t2.pageY);
          initialScale.current = currentScale.current;
          initialFocal.current = {
            x: (t1.pageX + t2.pageX) / 2,
            y: (t1.pageY + t2.pageY) / 2,
          };
          initialPan.current = { ...currentPan.current };
        } else if (evt.nativeEvent.touches.length === 1) {
          const now = Date.now();
          const touch = evt.nativeEvent.touches[0];

          if (now - lastTapRef.current < 300) {
            handleDoubleTapAt(touch.pageX, touch.pageY);
            lastTapRef.current = 0;
          } else {
            lastTapRef.current = now;
            initialPan.current = { ...currentPan.current };
          }
        }
      },

      onPanResponderMove: (evt, gs) => {
        if (evt.nativeEvent.touches.length >= 2) {
          const [t1, t2] = evt.nativeEvent.touches;
          const dist = Math.hypot(t1.pageX - t2.pageX, t1.pageY - t2.pageY);
          const currentFocal = {
            x: (t1.pageX + t2.pageX) / 2,
            y: (t1.pageY + t2.pageY) / 2,
          };

          if (initialDistance.current && initialDistance.current > 0) {
            const factor = dist / initialDistance.current;
            const newScale = Math.min(Math.max(initialScale.current * factor, 0.75), 4.0);

            // Real-time focal translation math (keeps touched point locked under fingers)
            const focalShiftX =
              (currentFocal.x - SCREEN_WIDTH / 2) * (1 - newScale / initialScale.current);
            const focalShiftY =
              (currentFocal.y - SCREEN_HEIGHT / 2) * (1 - newScale / initialScale.current);
            const deltaFocalX = currentFocal.x - initialFocal.current.x;
            const deltaFocalY = currentFocal.y - initialFocal.current.y;

            const nextPanX = initialPan.current.x + deltaFocalX + focalShiftX;
            const nextPanY = initialPan.current.y + deltaFocalY + focalShiftY;

            scale.setValue(newScale);
            pan.setValue({ x: nextPanX, y: nextPanY });
          } else {
            initialDistance.current = dist;
            initialScale.current = currentScale.current;
            initialFocal.current = currentFocal;
            initialPan.current = { ...currentPan.current };
          }
        } else if (evt.nativeEvent.touches.length === 1) {
          const nextPanX = initialPan.current.x + gs.dx;
          const nextPanY = initialPan.current.y + gs.dy;
          pan.setValue({ x: nextPanX, y: nextPanY });
        }
      },

      onPanResponderRelease: (evt, gs) => {
        initialDistance.current = null;

        // Check if user tapped without dragging/panning in blank space to dismiss
        if (Math.abs(gs.dx) < 6 && Math.abs(gs.dy) < 6) {
          const touch = evt.nativeEvent;
          const curW = imgWidth * currentScale.current;
          const curH = imgHeight * currentScale.current;
          const imgTop = (SCREEN_HEIGHT - curH) / 2 + currentPan.current.y;
          const imgBottom = (SCREEN_HEIGHT + curH) / 2 + currentPan.current.y;
          const imgLeft = (SCREEN_WIDTH - curW) / 2 + currentPan.current.x;
          const imgRight = (SCREEN_WIDTH + curW) / 2 + currentPan.current.x;

          if (
            touch.pageY < imgTop ||
            touch.pageY > imgBottom ||
            touch.pageX < imgLeft ||
            touch.pageX > imgRight
          ) {
            setModalVisible(false);
            return;
          }
        }

        if (currentScale.current < 1.0) {
          resetZoom(true);
        } else if (currentScale.current > 4.0) {
          Animated.spring(scale, {
            toValue: 3.5,
            useNativeDriver: true,
            bounciness: 4,
            speed: 16,
          }).start();
        } else {
          clampPanToBounds(currentScale.current);
        }
      },

      onPanResponderTerminate: () => {
        initialDistance.current = null;
        if (currentScale.current < 1.0) {
          resetZoom(true);
        }
      },
    })
  ).current;

  if (!uri || typeof uri !== 'string' || !uri.trim()) {
    return null;
  }

  const isLight = theme === 'light';

  return (
    <View style={[styles.wrapper, style]}>
      {/* Clean Inline Picture Card */}
      <TouchableOpacity
        activeOpacity={0.9}
        onPress={() => {
          resetZoom(false);
          setModalVisible(true);
        }}
        style={[
          styles.inlineCard,
          isLight ? styles.inlineCardLight : styles.inlineCardDark,
        ]}
      >
        <View style={[styles.imageContainer, { aspectRatio }]}>
          <Image
            source={{ uri }}
            style={[styles.image, imageStyle]}
            resizeMode="cover"
            onLoadStart={() => setLoading(true)}
            onLoadEnd={() => setLoading(false)}
            onError={() => {
              setLoading(false);
              setError(true);
            }}
          />

          {loading && (
            <View style={[styles.loadingOverlay, isLight && styles.loadingOverlayLight]}>
              <ActivityIndicator size="small" color={isLight ? '#2563eb' : '#6366f1'} />
            </View>
          )}

          {error && (
            <View style={styles.errorOverlay}>
              <AlertCircle size={20} color="#ef4444" />
              <Text style={styles.errorText}>Unable to load image</Text>
            </View>
          )}
        </View>
      </TouchableOpacity>

      {/* Gallery-Grade Full-Screen Modal with Focal Point Zoom (Blank Space Tap Closes) */}
      {modalVisible && (
        <Modal
          visible={true}
          transparent={true}
          animationType="fade"
          presentationStyle="overFullScreen"
          onRequestClose={() => setModalVisible(false)}
        >
          <View style={styles.modalBackdrop} {...panResponder.panHandlers}>
            {/* Absolute Fullscreen Tap-Outside-to-Close Touch Layer */}
            <TouchableOpacity
              activeOpacity={1}
              style={StyleSheet.absoluteFillObject}
              onPress={() => setModalVisible(false)}
            />

            {/* Centered Focal-Zoomable Image Container */}
            <View style={styles.modalContentContainer} pointerEvents="none">
              <Animated.Image
                source={{ uri }}
                style={{
                  width: imgWidth,
                  height: imgHeight,
                  borderRadius: 6,
                  transform: [
                    { translateX: pan.x },
                    { translateY: pan.y },
                    { scale: scale },
                  ],
                }}
                resizeMode="contain"
              />
            </View>
          </View>
        </Modal>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper: {
    marginVertical: 8,
    width: '100%',
  },
  inlineCard: {
    borderRadius: 10,
    borderWidth: 1,
    overflow: 'hidden',
  },
  inlineCardDark: {
    backgroundColor: '#0f172a',
    borderColor: '#334155',
    elevation: 2,
  },
  inlineCardLight: {
    backgroundColor: '#ffffff',
    borderColor: '#e2e8f0',
    elevation: 1,
  },
  imageContainer: {
    width: '100%',
    backgroundColor: '#ffffff',
    justifyContent: 'center',
    alignItems: 'center',
    position: 'relative',
    overflow: 'hidden',
  },
  image: {
    width: '100%',
    height: '100%',
  },
  loadingOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: '#ffffff',
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingOverlayLight: {
    backgroundColor: '#ffffff',
  },
  errorOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(255, 255, 255, 0.95)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 12,
  },
  errorText: {
    color: '#ef4444',
    fontSize: 12,
    marginTop: 4,
    fontWeight: '500',
  },

  // Modal Backdrop & Content
  modalBackdrop: {
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
});
