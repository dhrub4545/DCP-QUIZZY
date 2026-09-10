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
  Platform,
} from 'react-native';
import { AlertCircle, X } from 'lucide-react-native';

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window');

/**
 * ZoomableImageCard
 * High-performance full-screen image viewer with:
 * - 100% reliable 2-finger pinch zoom (always activates, baseline-anchored, zero jitter)
 * - Double-tap focal point zoom (1.0x <-> 2.5x)
 * - Translucent/transparent dark overlay (not pitch black, study text visible behind)
 * - Prominent dedicated Close Button (clicking blank space does NOT close)
 * - Swipe-down to dismiss at 1.0x
 */
export default function ZoomableImageCard({
  uri,
  caption,
  theme = 'dark',
  style,
  imageStyle,
  aspectRatio: customAspectRatio,
}) {
  const [aspectRatio, setAspectRatio] = useState(customAspectRatio || 16 / 9);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [modalVisible, setModalVisible] = useState(false);

  // Animated values
  const scale = useRef(new Animated.Value(1)).current;
  const pan = useRef(new Animated.ValueXY({ x: 0, y: 0 })).current;
  const backdropOpacity = useRef(new Animated.Value(1)).current;
  const currentScale = useRef(1);
  const currentPan = useRef({ x: 0, y: 0 });

  // Gesture tracking refs
  const gestureMode = useRef('none'); // 'none' | 'pinch' | 'pan'
  const pinchStartDist = useRef(null);
  const pinchStartScale = useRef(1);
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
    const scaleSub = scale.addListener((v) => {
      if (!isDismissing.current) {
        currentScale.current = v.value;
      }
    });
    const panSub = pan.addListener((v) => {
      if (!isDismissing.current) {
        currentPan.current = v;
      }
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
          // Support very tall (portrait) and wide diagrams alike without distortion
          const clampedRatio = Math.max(0.15, Math.min(ratio, 4.0));
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

  // Fit within screen bounds with zero overflow (both width and height are strictly bounded)
  const maxModalW = SCREEN_WIDTH * 0.92;
  const maxModalH = SCREEN_HEIGHT * 0.82;
  const r = aspectRatio || 16 / 9;

  let imgWidth = maxModalW;
  let imgHeight = imgWidth / r;

  if (imgHeight > maxModalH) {
    imgHeight = maxModalH;
    imgWidth = imgHeight * r;
  }

  const resetZoom = (animated = true) => {
    currentScale.current = 1.0;
    currentPan.current = { x: 0, y: 0 };
    gestureMode.current = 'none';
    pinchStartDist.current = null;
    pinchStartScale.current = 1.0;
    pinchOrigin.current = { x: 0, y: 0 };
    panStartTouch.current = { x: 0, y: 0 };
    panStartPan.current = { x: 0, y: 0 };

    pan.stopAnimation();
    scale.stopAnimation();

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
        Animated.timing(backdropOpacity, {
          toValue: 1,
          duration: 150,
          useNativeDriver: true,
        }),
      ]).start();
    } else {
      scale.setValue(1);
      pan.setValue({ x: 0, y: 0 });
      backdropOpacity.setValue(1);
    }
  };

  const clampPanToBounds = (s) => {
    const maxPanX = Math.max(0, (imgWidth * s - SCREEN_WIDTH) / 2 + 30);
    const maxPanY = Math.max(0, (imgHeight * s - SCREEN_HEIGHT) / 2 + 30);

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
    resetZoom(false);
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
        resetZoom(false);
      }, 350);
    });
  };

  const handleDoubleTapAt = (touchX, touchY) => {
    if (currentScale.current > 1.15) {
      resetZoom(true);
    } else {
      const targetScale = 2.5;
      const targetPanX = (SCREEN_WIDTH / 2 - touchX) * (targetScale - 1);
      const targetPanY = (SCREEN_HEIGHT / 2 - touchY) * (targetScale - 1);

      const maxPanX = Math.max(0, (imgWidth * targetScale - SCREEN_WIDTH) / 2);
      const maxPanY = Math.max(0, (imgHeight * targetScale - SCREEN_HEIGHT) / 2);
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
      x: (centerX - SCREEN_WIDTH / 2 - currentPan.current.x) / (currentScale.current || 1),
      y: (centerY - SCREEN_HEIGHT / 2 - currentPan.current.y) / (currentScale.current || 1),
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

        // TWO FINGERS PINCH TO ZOOM & PAN
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

          const rawScale = (curDist / pinchStartDist.current) * pinchStartScale.current;
          let effectiveScale = rawScale;

          // Elastic rubberbanding past bounds
          if (rawScale < 1.0) {
            effectiveScale = 1.0 - (1.0 - rawScale) * 0.4;
          } else if (rawScale > 4.5) {
            effectiveScale = 4.5 + (rawScale - 4.5) * 0.35;
          }
          effectiveScale = Math.max(0.65, Math.min(effectiveScale, 6.0));

          const curCenterX = (t1.pageX + t2.pageX) / 2;
          const curCenterY = (t1.pageY + t2.pageY) / 2;

          const newPanX = curCenterX - SCREEN_WIDTH / 2 - pinchOrigin.current.x * effectiveScale;
          const newPanY = curCenterY - SCREEN_HEIGHT / 2 - pinchOrigin.current.y * effectiveScale;

          scale.setValue(effectiveScale);
          pan.setValue({ x: newPanX, y: newPanY });
          currentScale.current = effectiveScale;
          currentPan.current = { x: newPanX, y: newPanY };
        }
        // ONE FINGER PAN / PULL-DOWN-TO-DISMISS
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

          if (currentScale.current <= 1.05) {
            // Pull-down-to-dismiss at 1x
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
              scale.setValue(Math.max(0.85, 1 - deltaY / 1500));
            } else {
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

        // Double-Tap Detection (taps with movement < 16px within 350ms)
        if (totalMove < 16 && duration < 350) {
          const now = Date.now();
          const touch = evt.nativeEvent;

          if (now - lastTapTime.current < 380) {
            lastTapTime.current = 0;
            handleDoubleTapAt(touch.pageX, touch.pageY);
            return;
          } else {
            lastTapTime.current = now;
            // NOTE: Clicking blank space DOES NOT close the modal!
            return;
          }
        }

        // Pull-down-to-dismiss at 1x
        if (wasMode === 'pan' && currentScale.current <= 1.05) {
          const dy = gs.dy;
          const vy = gs.vy;
          if (dy > 120 || (dy > 50 && vy > 0.7)) {
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
                resetZoom(false);
              }, 350);
            });
            return;
          } else {
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
              Animated.timing(backdropOpacity, {
                toValue: 1,
                duration: 150,
                useNativeDriver: true,
              }),
            ]).start();
            return;
          }
        }

        // Release for Pinch or Zoomed-in Pan:
        backdropOpacity.setValue(1);
        if (currentScale.current < 1.0) {
          resetZoom(true);
        } else if (currentScale.current > 4.5) {
          Animated.spring(scale, {
            toValue: 4.0,
            useNativeDriver: true,
            bounciness: 4,
            speed: 16,
          }).start();
          clampPanToBounds(4.0);
        } else {
          clampPanToBounds(currentScale.current);
        }
      },

      onPanResponderTerminate: () => {
        gestureMode.current = 'none';
        pinchStartDist.current = null;
        if (currentScale.current < 1.0) {
          resetZoom(true);
        }
        backdropOpacity.setValue(1);
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
        onPress={handleOpenModal}
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

      {/* Translucent Full-Screen Modal with Transparent Blank Space */}
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
              styles.modalBackdrop,
              { opacity: backdropOpacity },
            ]}
            {...panResponder.panHandlers}
          >
            {/* Centered Focal-Zoomable Image Container */}
            <View style={styles.modalContentContainer} pointerEvents="box-none">
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

            {/* Prominent Floating Close Button (Top-Right) */}
            <TouchableOpacity
              style={styles.modalCloseBtn}
              onPress={handleCloseModal}
              activeOpacity={0.8}
              hitSlop={{ top: 20, bottom: 20, left: 20, right: 20 }}
              accessibilityLabel="Close image viewer"
            >
              <X size={24} color="#ffffff" strokeWidth={2.5} />
            </TouchableOpacity>

            {/* Caption Pill (only if caption provided) */}
            {!!caption && (
              <View style={styles.modalHintPill} pointerEvents="none">
                <Text style={styles.modalHintText}>{caption}</Text>
              </View>
            )}
          </Animated.View>
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
    maxHeight: 420,
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

  // Translucent Modal Backdrop (Study text softly visible behind)
  modalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.72)',
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

  // Prominent Floating Close Button
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
    backgroundColor: 'rgba(15, 23, 42, 0.88)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.2)',
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
