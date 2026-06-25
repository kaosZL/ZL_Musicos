import { memo, useEffect, useRef } from 'react'
import { Animated, Easing, View, type ImageStyle, type ViewStyle } from 'react-native'
import Image from '@/components/common/Image'
import { tvColors } from '@/theme/tv'
import TVText from './TVText'

interface Props {
  image?: string | number | null
  isPlaying: boolean
  size?: number
  onCoverError?: (url: string | number) => void
  style?: ViewStyle | ViewStyle[]
}

const TVVinylRecord = ({ image, isPlaying, size = 392, onCoverError, style }: Props) => {
  const spinValue = useRef(new Animated.Value(0)).current
  const needleValue = useRef(new Animated.Value(isPlaying ? 1 : 0)).current
  const spinLoopRef = useRef<Animated.CompositeAnimation | null>(null)

  useEffect(() => {
    if (isPlaying) {
      spinLoopRef.current?.stop()
      spinLoopRef.current = Animated.loop(
        Animated.timing(spinValue, {
          toValue: 1,
          duration: 18000,
          easing: Easing.linear,
          useNativeDriver: true,
          isInteraction: false,
        }),
      )
      spinLoopRef.current.start()
    } else {
      spinLoopRef.current?.stop()
      spinLoopRef.current = null
      spinValue.stopAnimation(value => {
        spinValue.setValue(value % 1)
      })
    }

    return () => {
      spinLoopRef.current?.stop()
    }
  }, [isPlaying, spinValue])

  useEffect(() => {
    Animated.timing(needleValue, {
      toValue: isPlaying ? 1 : 0,
      duration: 520,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: true,
      isInteraction: false,
    }).start()
  }, [isPlaying, needleValue])

  const recordRotate = spinValue.interpolate({
    inputRange: [0, 1],
    outputRange: ['0deg', '360deg'],
  })
  const needleRotate = needleValue.interpolate({
    inputRange: [0, 1],
    outputRange: ['-26deg', '-6deg'],
  })

  const recordSize = size * 0.82
  const coverSize = size * 0.34
  const centerHoleSize = size * 0.052

  return (
    <View style={[styles.root, { width: size, height: size }, style]}>
      <View style={styles.redHalo} />
      <View style={[styles.platterShadow, { width: size * 0.9, height: size * 0.9, borderRadius: size * 0.45 }]} />
      <Animated.View
        style={[
          styles.record,
          {
            width: recordSize,
            height: recordSize,
            borderRadius: recordSize / 2,
            transform: [{ rotate: recordRotate }],
          },
        ]}
      >
        <View style={[styles.outerRing, { borderRadius: recordSize / 2 }]} />
        <View style={[styles.ringOne, { width: recordSize * 0.82, height: recordSize * 0.82, borderRadius: recordSize * 0.41 }]} />
        <View style={[styles.ringTwo, { width: recordSize * 0.66, height: recordSize * 0.66, borderRadius: recordSize * 0.33 }]} />
        <View style={[styles.ringThree, { width: recordSize * 0.5, height: recordSize * 0.5, borderRadius: recordSize * 0.25 }]} />
        <View style={[styles.ringFour, { width: recordSize * 0.37, height: recordSize * 0.37, borderRadius: recordSize * 0.185 }]} />
        <View style={styles.recordGloss} />
        <View style={[styles.coverWrap, { width: coverSize, height: coverSize, borderRadius: coverSize / 2 }]}>
          {image ? (
            <Image url={image} style={styles.coverImage as ImageStyle} onError={onCoverError} />
          ) : (
            <TVText variant="cardTitle" color={tvColors.primaryHigh}>音乐</TVText>
          )}
          <View style={[styles.centerHole, { width: centerHoleSize, height: centerHoleSize, borderRadius: centerHoleSize / 2 }]} />
        </View>
      </Animated.View>

      <View style={[styles.armBaseOuter, { width: size * 0.18, height: size * 0.18, borderRadius: size * 0.09 }]} />
      <View style={[styles.armBaseInner, { width: size * 0.11, height: size * 0.11, borderRadius: size * 0.055 }]} />
      <Animated.View style={[styles.needleGroup, { transform: [{ rotate: needleRotate }] }]}>
        <View style={[styles.toneArm, { width: size * 0.44 }]} />
        <View style={styles.toneArmHighlight} />
        <View style={styles.cartridge} />
        <View style={styles.needleTip} />
      </Animated.View>
    </View>
  )
}

const styles: Record<string, ViewStyle> = {
  root: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  redHalo: {
    position: 'absolute',
    width: '100%',
    height: '100%',
    borderRadius: 999,
    backgroundColor: 'rgba(236,45,56,0.16)',
  },
  platterShadow: {
    position: 'absolute',
    backgroundColor: '#151720',
    borderWidth: 14,
    borderColor: '#20232d',
    shadowColor: '#000',
    shadowOpacity: 0.65,
    shadowRadius: 28,
    elevation: 18,
  },
  record: {
    backgroundColor: '#040405',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 18,
    borderColor: '#11131a',
    overflow: 'hidden',
  },
  outerRing: {
    position: 'absolute',
    left: 9,
    right: 9,
    top: 9,
    bottom: 9,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
  },
  ringOne: {
    position: 'absolute',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.075)',
  },
  ringTwo: {
    position: 'absolute',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.055)',
  },
  ringThree: {
    position: 'absolute',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.045)',
  },
  ringFour: {
    position: 'absolute',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.038)',
  },
  recordGloss: {
    position: 'absolute',
    width: '28%',
    height: '120%',
    left: '13%',
    top: '-10%',
    backgroundColor: 'rgba(255,255,255,0.075)',
    transform: [{ rotate: '-34deg' }],
  },
  coverWrap: {
    overflow: 'hidden',
    backgroundColor: tvColors.bgWarm,
    borderWidth: 8,
    borderColor: '#282a32',
    alignItems: 'center',
    justifyContent: 'center',
  },
  coverImage: {
    width: '100%',
    height: '100%',
  },
  centerHole: {
    position: 'absolute',
    backgroundColor: '#030303',
    borderWidth: 2,
    borderColor: 'rgba(255,255,255,0.36)',
  },
  armBaseOuter: {
    position: 'absolute',
    right: '8%',
    top: '4%',
    backgroundColor: '#151822',
    borderWidth: 7,
    borderColor: '#262936',
    shadowColor: tvColors.primaryHigh,
    shadowOpacity: 0.35,
    shadowRadius: 18,
    elevation: 10,
  },
  armBaseInner: {
    position: 'absolute',
    right: '11.5%',
    top: '7.6%',
    backgroundColor: '#3c3f4b',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.12)',
  },
  needleGroup: {
    position: 'absolute',
    right: '16%',
    top: '14%',
    width: '55%',
    height: 44,
  },
  toneArm: {
    position: 'absolute',
    right: 20,
    top: 11,
    height: 13,
    borderRadius: 999,
    backgroundColor: '#f4eeee',
  },
  toneArmHighlight: {
    position: 'absolute',
    right: 28,
    top: 14,
    width: '36%',
    height: 3,
    borderRadius: 999,
    backgroundColor: 'rgba(255,255,255,0.55)',
  },
  cartridge: {
    position: 'absolute',
    left: 0,
    top: 0,
    width: 58,
    height: 34,
    borderRadius: 14,
    backgroundColor: tvColors.primaryHigh,
    transform: [{ rotate: '18deg' }],
  },
  needleTip: {
    position: 'absolute',
    left: 48,
    top: 27,
    width: 18,
    height: 5,
    borderRadius: 5,
    backgroundColor: '#fef2f2',
    transform: [{ rotate: '36deg' }],
  },
}

export default memo(TVVinylRecord)
