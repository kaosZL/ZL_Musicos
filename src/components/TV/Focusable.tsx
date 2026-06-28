import { forwardRef, useCallback, useContext, useEffect, useImperativeHandle, useRef, useState, type ComponentRef } from 'react'
import { Pressable, type NativeSyntheticEvent, type PressableProps, type StyleProp, type TargetedEvent, type ViewStyle } from 'react-native'
import { tvColors, tvSize, tvTokens } from '@/theme/tv'
import { notifyTVTargetFocused, registerTVFocusTarget, scheduleTVInitialFocus, TVFocusScopeContext, unregisterTVFocusTarget, updateTVFocusTarget } from './tvFocusManager'

export interface FocusableProps extends PressableProps {
  focusStyle?: StyleProp<ViewStyle>
  onPress?: PressableProps['onPress']
  hasTVPreferredFocus?: boolean
  nextFocusUp?: number
  nextFocusDown?: number
  nextFocusLeft?: number
  nextFocusRight?: number
}

type FocusEvent = NativeSyntheticEvent<TargetedEvent>

const Focusable = forwardRef<ComponentRef<typeof Pressable>, FocusableProps>(({
  style,
  focusStyle,
  children,
  onPress,
  hasTVPreferredFocus,
  nextFocusUp,
  nextFocusDown,
  nextFocusLeft,
  nextFocusRight,
  onFocus,
  onBlur,
  ...rest
}, ref) => {
  const [focused, setFocused] = useState(false)
  const nativeRef = useRef<ComponentRef<typeof Pressable> | null>(null)
  const targetIdRef = useRef<number | null>(null)
  const focusScopeId = useContext(TVFocusScopeContext)

  useImperativeHandle(ref, () => nativeRef.current!, [])

  const triggerTVPress = useCallback(() => {
    if (!onPress) return
    ;(onPress as unknown as () => void)()
  }, [onPress])

  const handleFocus = useCallback((event: FocusEvent) => {
    setFocused(true)
    if (targetIdRef.current) notifyTVTargetFocused(targetIdRef.current)
    onFocus?.(event)
  }, [onFocus])

  const handleBlur = useCallback((event: FocusEvent) => {
    setFocused(false)
    onBlur?.(event)
  }, [onBlur])

  useEffect(() => {
    const node = nativeRef.current
    const id = registerTVFocusTarget(focusScopeId, node, false)
    targetIdRef.current = id

    return () => {
      unregisterTVFocusTarget(id)
      targetIdRef.current = null
    }
  }, [focusScopeId])

  useEffect(() => {
    const id = targetIdRef.current
    if (!id) return
    updateTVFocusTarget(id, {
      scopeId: focusScopeId,
      ref: nativeRef.current,
      preferred: !!hasTVPreferredFocus,
      nextFocusUp,
      nextFocusDown,
      nextFocusLeft,
      nextFocusRight,
      onPress: onPress ? triggerTVPress : undefined,
    })
    if (hasTVPreferredFocus) scheduleTVInitialFocus()
  }, [focusScopeId, hasTVPreferredFocus, nextFocusDown, nextFocusLeft, nextFocusRight, nextFocusUp, onPress, triggerTVPress])

  return (
    <Pressable
      ref={nativeRef}
      focusable
      accessible
      accessibilityRole="button"
      hasTVPreferredFocus={hasTVPreferredFocus}
      nextFocusUp={nextFocusUp}
      nextFocusDown={nextFocusDown}
      nextFocusLeft={nextFocusLeft}
      nextFocusRight={nextFocusRight}
      onPress={onPress}
      onFocus={handleFocus}
      onBlur={handleBlur}
      style={state => [
        styles.base,
        typeof style === 'function' ? style(state) : style,
        focused ? styles.focused : null,
        focused ? focusStyle : null,
      ]}
      {...rest}
    >
      {children}
    </Pressable>
  )
})

const styles: Record<string, ViewStyle> = {
  base: {
    borderRadius: tvTokens.radius,
  },
  focused: {
    borderWidth: tvSize(4),
    borderColor: tvColors.primary,
    backgroundColor: 'rgba(138,173,255,0.16)',
    shadowColor: tvColors.primary,
    shadowOpacity: 0.55,
    shadowRadius: tvSize(24),
    elevation: 18,
    transform: [{ scale: tvTokens.focusScale }],
  },
}

export default Focusable
