/**
 * v3.0.76 (BUG-145 修): 全屏图片查看器 — 用户生成图片后可点击查看大图 + 双指缩放 + 单指拖动 + 双击放大/还原 + 单击关闭
 *
 * 用法:
 *   const [viewer, setViewer] = useState<{ src: string; filename: string } | null>(null);
 *   <TouchableOpacity onPress={() => setViewer({ src: imgUrl, filename: 'xxx.jpg' })}>
 *     <ImageWithLoading src={imgUrl} ... />
 *   </TouchableOpacity>
 *   <FullscreenImageViewer
 *     visible={!!viewer}
 *     src={viewer?.src || ''}
 *     filename={viewer?.filename}
 *     onClose={() => setViewer(null)}
 *     onDownload={() => downloadImage(...)}
 *   />
 *
 * 特性:
 * - pinch zoom: 双指缩放, 范围 [1x, 4x]
 * - pan: 单指拖动 (仅在缩放 > 1 时), 手指移动 > 10px 才算 pan
 * - double tap: 双击切换 1x ↔ 2x (200ms 动画过渡)
 * - 单击背景关闭 (按 Pressable, 不影响图片层手势)
 * - 右上角 X 关闭按钮 + 底部"保存到相册"下载按钮
 * - close 时重置 transform 状态 (避免下次打开时残留)
 *
 * 跨项目通用铁律 (跟 BUG-143 src URL 稳定性 + BUG-144 跨端铁律 4++ 1:1 镜像 100% 同源):
 * - src URL 必稳定, 调用方负责传 djb2 hash 稳定的 URL (AGENTS.md § 6.7 / § 6.22)
 * - filename 必传稳定值 (不能 Date.now()), 仅用于"保存到相册"对话框默认文件名
 * - 跨端铁律 4++: web 端 AgentChatPanel 同款功能 (新建 LightboxImage 组件) 待补
 *
 * 选型决策 (跟 BUG-135 "不加重" + BUG-130 "API 兼容性" 教训同源):
 * - 用现有 react-native-gesture-handler v2.14.0 (已装, 不装新依赖)
 * - 用 RN Animated API (不装 reanimated, 避 NDK 编译坑)
 * - 用 RN Modal (跟 Dialog.tsx 1:1 模式, 走 native 层 Android Dialog)
 */
import React, { useEffect, useRef, useState } from 'react';
import {
  Animated,
  Dimensions,
  Image,
  Modal,
  Pressable,
  StatusBar,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import {
  GestureHandlerRootView,
  PanGestureHandler,
  PinchGestureHandler,
  State,
  TapGestureHandler,
} from 'react-native-gesture-handler';
import Ionicons from 'react-native-vector-icons/Ionicons';
import { colors, radii, spacing } from '../../theme';

const { width: SCREEN_W, height: SCREEN_H } = Dimensions.get('window');

// 缩放范围
const MIN_SCALE = 1;
const MAX_SCALE = 4;
const DOUBLE_TAP_SCALE = 2;
// pan 触发阈值 (手指移动 > 10px 才算 pan, 否则算单击让 TapGestureHandler 触发)
const PAN_ACTIVE_OFFSET = 10;

interface FullscreenImageViewerProps {
  visible: boolean;
  src: string;
  alt?: string;
  /** 文件名 (用于"保存到相册"对话框默认名, 调用方必传稳定值, 不能 Date.now()) */
  filename?: string;
  onClose: () => void;
  onDownload?: () => void;
}

export function FullscreenImageViewer({
  visible,
  src,
  alt = '',
  filename,
  onClose,
  onDownload,
}: FullscreenImageViewerProps) {
  // ========== 手势期间 transform 临时值 (Animated.Value, 由 gesture-handler 直接驱动) ==========
  // pinch 期间: pinchScale = gesture 当前 scale (1.0 = 不变, 2.0 = 放大到 2x)
  const pinchScale = useRef(new Animated.Value(1)).current;
  // pan 期间: panTranslateX/Y = gesture 当前 translation (相对 gesture start 的偏移)
  const panTranslateX = useRef(new Animated.Value(0)).current;
  const panTranslateY = useRef(new Animated.Value(0)).current;

  // ========== 累计 transform 值 (gesture END 时保存, 双击 toggle 时直接赋值) ==========
  const baseScale = useRef(new Animated.Value(1)).current;
  const baseTranslateX = useRef(new Animated.Value(0)).current;
  const baseTranslateY = useRef(new Animated.Value(0)).current;

  // ========== 同步镜像 (供 PanGestureHandler onGestureEvent / 边界判断读取) ==========
  // Animated.Value 不能在普通 JS 上下文直接同步读取 (._value 在 native driver 时不可用),
  // 所以用 ref 维护一份同步值, gesture END 时同步更新
  const baseScaleValueRef = useRef(1);
  const baseTranslateXValueRef = useRef(0);
  const baseTranslateYValueRef = useRef(0);

  // ========== UI 状态 (用于顶部 zoom hint 文案 + 决定 pan 是否 enabled) ==========
  const [currentScale, setCurrentScale] = useState(1);

  // ========== pinch gesture handler ==========
  // v3.0.76 (BUG-145): 双指缩放, 范围 [1, 4]
  const onPinchGestureEvent = Animated.event(
    [{ nativeEvent: { scale: pinchScale } }],
    { useNativeDriver: true }
  );

  const onPinchStateChange = (event: { nativeEvent: { state: number; oldState: number } }) => {
    if (event.nativeEvent.oldState === State.ACTIVE) {
      // gesture 结束: 把 final scale 累加到 baseScale, 限制在 [1, 4]
      const finalScale = Math.max(
        MIN_SCALE,
        Math.min(MAX_SCALE, baseScaleValueRef.current * (pinchScale as any)._value)
      );
      baseScale.setValue(finalScale);
      pinchScale.setValue(1);
      baseScaleValueRef.current = finalScale;
      setCurrentScale(finalScale);

      // 缩放回 1 时重置 pan 位置 (防止下次放大时图片位置错乱)
      if (finalScale <= 1) {
        baseTranslateX.setValue(0);
        baseTranslateY.setValue(0);
        baseTranslateXValueRef.current = 0;
        baseTranslateYValueRef.current = 0;
      }
    }
  };

  // ========== pan gesture handler ==========
  // v3.0.76 (BUG-145): 单指拖动, 仅在缩放 > 1 时生效 (否则 pan 会被 TapGestureHandler 抢)
  // activeOffsetX/Y [-10, 10] 防止手指抖动误触发, 让单击 tap 能正常识别
  const onPanGestureEvent = Animated.event(
    [
      {
        nativeEvent: {
          translationX: panTranslateX,
          translationY: panTranslateY,
        },
      },
    ],
    { useNativeDriver: true }
  );

  const onPanStateChange = (event: { nativeEvent: { state: number; oldState: number } }) => {
    if (event.nativeEvent.state === State.ACTIVE) {
      // 缩放 = 1 时禁止 pan (让单击 tap 能正常触发)
      if (baseScaleValueRef.current <= 1) {
        panTranslateX.setValue(0);
        panTranslateY.setValue(0);
      }
    }
    if (event.nativeEvent.oldState === State.ACTIVE) {
      // gesture 结束: 累加到 baseTranslate
      baseTranslateXValueRef.current += (panTranslateX as any)._value;
      baseTranslateYValueRef.current += (panTranslateY as any)._value;
      baseTranslateX.setValue(baseTranslateXValueRef.current);
      baseTranslateY.setValue(baseTranslateYValueRef.current);
      panTranslateX.setValue(0);
      panTranslateY.setValue(0);
    }
  };

  // ========== double tap gesture handler ==========
  // v3.0.76 (BUG-145): 双击切换 1x ↔ 2x, 用 Animated.timing 200ms 动画过渡
  const onDoubleTapStateChange = (event: { nativeEvent: { state: number } }) => {
    if (event.nativeEvent.state === State.ACTIVE) {
      if (baseScaleValueRef.current > 1) {
        // 还原到 1x
        Animated.parallel([
          Animated.timing(baseScale, {
            toValue: 1,
            duration: 200,
            useNativeDriver: true,
          }),
          Animated.timing(baseTranslateX, {
            toValue: 0,
            duration: 200,
            useNativeDriver: true,
          }),
          Animated.timing(baseTranslateY, {
            toValue: 0,
            duration: 200,
            useNativeDriver: true,
          }),
        ]).start();
        baseScaleValueRef.current = 1;
        baseTranslateXValueRef.current = 0;
        baseTranslateYValueRef.current = 0;
        setCurrentScale(1);
      } else {
        // 放大到 2x
        Animated.timing(baseScale, {
          toValue: DOUBLE_TAP_SCALE,
          duration: 200,
          useNativeDriver: true,
        }).start();
        baseScaleValueRef.current = DOUBLE_TAP_SCALE;
        setCurrentScale(DOUBLE_TAP_SCALE);
      }
    }
  };

  // ========== close 时重置状态 (防止下次打开残留) ==========
  useEffect(() => {
    if (!visible) {
      baseScale.setValue(1);
      baseTranslateX.setValue(0);
      baseTranslateY.setValue(0);
      pinchScale.setValue(1);
      panTranslateX.setValue(0);
      panTranslateY.setValue(0);
      baseScaleValueRef.current = 1;
      baseTranslateXValueRef.current = 0;
      baseTranslateYValueRef.current = 0;
      setCurrentScale(1);
    }
  }, [visible, baseScale, baseTranslateX, baseTranslateY, pinchScale, panTranslateX, panTranslateY]);

  // ========== transform: combine base + gesture ==========
  // translateX/Y = base + pan, scale = base * pinch
  const animatedImageStyle = {
    transform: [
      { translateX: Animated.add(baseTranslateX, panTranslateX) },
      { translateY: Animated.add(baseTranslateY, panTranslateY) },
      { scale: Animated.multiply(baseScale, pinchScale) },
    ],
  };

  return (
    <Modal
      visible={visible}
      animationType="fade"
      transparent
      onRequestClose={onClose}
      statusBarTranslucent
    >
      <StatusBar barStyle="light-content" backgroundColor="rgba(0,0,0,0.92)" />
      <GestureHandlerRootView style={styles.container}>
        {/* 背景层: 单击关闭 (在 GestureHandlerRootView 内, 但跟图片层是兄弟节点, 不影响手势) */}
        <Pressable style={StyleSheet.absoluteFill} onPress={onClose}>
          <View style={[StyleSheet.absoluteFill, styles.bg]} />
        </Pressable>

        {/* 图片 + 手势层: Pinch (双指) > Pan (单指) > Tap (双击) 三层嵌套 */}
        <PinchGestureHandler
          onGestureEvent={onPinchGestureEvent}
          onHandlerStateChange={onPinchStateChange}
        >
          <Animated.View style={styles.imageContainer}>
            <PanGestureHandler
              onGestureEvent={onPanGestureEvent}
              onHandlerStateChange={onPanStateChange}
              minPointers={1}
              maxPointers={1}
              activeOffsetX={[-PAN_ACTIVE_OFFSET, PAN_ACTIVE_OFFSET]}
              activeOffsetY={[-PAN_ACTIVE_OFFSET, PAN_ACTIVE_OFFSET]}
            >
              <Animated.View style={StyleSheet.absoluteFill}>
                <TapGestureHandler
                  numberOfTaps={2}
                  maxDelayMs={300}
                  onHandlerStateChange={onDoubleTapStateChange}
                >
                  <Animated.View style={[styles.imageWrapper, animatedImageStyle]}>
                    <Image
                      source={{ uri: src }}
                      style={styles.image}
                      resizeMode="contain"
                      accessibilityLabel={alt}
                    />
                  </Animated.View>
                </TapGestureHandler>
              </Animated.View>
            </PanGestureHandler>
          </Animated.View>
        </PinchGestureHandler>

        {/* 顶部关闭按钮 (右上角 X) */}
        <TouchableOpacity
          style={styles.closeBtn}
          onPress={onClose}
          accessibilityLabel="关闭"
          accessibilityRole="button"
        >
          <Ionicons name="close" size={28} color="#fff" />
        </TouchableOpacity>

        {/* 顶部 zoom 提示 (左上角文字, pointerEvents=none 不挡手势) */}
        <View style={styles.zoomHint} pointerEvents="none">
          <Text style={styles.zoomHintText}>
            {currentScale > 1
              ? `${currentScale.toFixed(1)}x · 双击还原 · 单指拖动`
              : '双指缩放 · 双击放大 · 单击关闭'}
          </Text>
        </View>

        {/* 底部下载按钮 */}
        {onDownload && (
          <View style={styles.bottomBar}>
            <TouchableOpacity
              style={styles.downloadBtn}
              onPress={onDownload}
              accessibilityLabel="保存到相册"
              accessibilityRole="button"
            >
              <Ionicons name="download" size={18} color="#fff" />
              <Text style={styles.downloadBtnText}>
                {filename ? `保存 ${filename}` : '保存到相册'}
              </Text>
            </TouchableOpacity>
          </View>
        )}
      </GestureHandlerRootView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  bg: {
    backgroundColor: 'rgba(0, 0, 0, 0.92)',
  },
  imageContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  imageWrapper: {
    width: SCREEN_W,
    height: SCREEN_H * 0.75,
    justifyContent: 'center',
    alignItems: 'center',
  },
  image: {
    width: '100%',
    height: '100%',
  },
  closeBtn: {
    position: 'absolute',
    top: StatusBar.currentHeight ? StatusBar.currentHeight + 12 : 48,
    right: 16,
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: 'rgba(255, 255, 255, 0.18)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  zoomHint: {
    position: 'absolute',
    top: StatusBar.currentHeight ? StatusBar.currentHeight + 22 : 58,
    left: 16,
    right: 80,
    paddingHorizontal: spacing.md,
    paddingVertical: 8,
    borderRadius: radii.md,
    backgroundColor: 'rgba(0, 0, 0, 0.45)',
  },
  zoomHintText: {
    color: '#fff',
    fontSize: 12,
    textAlign: 'center',
  },
  bottomBar: {
    position: 'absolute',
    bottom: 36,
    left: 0,
    right: 0,
    alignItems: 'center',
  },
  downloadBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: radii.lg,
    backgroundColor: colors.accent,
  },
  downloadBtnText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '600',
  },
});