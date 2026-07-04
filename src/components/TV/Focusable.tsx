import { forwardRef, useCallback, useContext, useEffect, useImperativeHandle, useRef, useState, type ComponentRef } from 'react'
import { Pressable, type NativeSyntheticEvent, type PressableProps, type StyleProp, type TargetedEvent, type ViewStyle } from 'react-native'
import { tvColors, tvSize, tvTokens } from '@/theme/tv'
import { notifyTVTargetFocused, registerTVFocusTarget, scheduleTVInitialFocus, subscribeTVTargetFocusState, TVFocusScopeContext, unregisterTVFocusTarget, updateTVFocusTarget } from './tvFocusManager'

export interface FocusableProps extends PressableProps {
  focusStyle?: StyleProp<ViewStyle>
  onPress?: PressableProps['onPress']
  onTVFocusChange?: (focused: boolean) => void
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
  onTVFocusChange,
  ...rest
}, ref) => {
  const [focused, setFocused] = useState(false)
  const nativeRef = useRef<ComponentRef<typeof Pressable> | null>(null)
  const targetIdRef = useRef<number | null>(null)
  const focusScopeId = useContext(TVFocusScopeContext)
  const focusedRef = useRef(false)
  const focusChangeRef = useRef(onTVFocusChange)

  useImperativeHandle(ref, () => nativeRef.current!, [])

  useEffect(() => {
    focusChangeRef.current = onTVFocusChange
  }, [onTVFocusChange])

  const setTVFocused = useCallback((nextFocused: boolean) => {
    if (focusedRef.current === nextFocused) return
    focusedRef.current = nextFocused
    setFocused(nextFocused)
    focusChangeRef.current?.(nextFocused)
  }, [])

  const triggerTVPress = useCallback(() => {
    if (!onPress) return
    ;(onPress as unknown as () => void)()
  }, [onPress])

  const handleFocus = useCallback((event: FocusEvent) => {
    setTVFocused(true)
    if (targetIdRef.current) notifyTVTargetFocused(targetIdRef.current)
    onFocus?.(event)
  }, [onFocus, setTVFocused])

  const handleBlur = useCallback((event: FocusEvent) => {
    setTVFocused(false)
    onBlur?.(event)
  }, [onBlur, setTVFocused])

  useEffect(() => {
    const node = nativeRef.current
    const id = registerTVFocusTarget(focusScopeId, node, false)
    targetIdRef.current = id
    const unsubscribe = subscribeTVTargetFocusState(id, setTVFocused)

    return () => {
      unsubscribe()
      unregisterTVFocusTarget(id)
      targetIdRef.current = null
    }
  }, [focusScopeId, setTVFocused])

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
    borderWidth: 1,
    borderColor: 'transparent',
  },
  focused: {
    borderColor: tvColors.primaryHigh,
    shadowColor: tvColors.primaryHigh,
    shadowOpacity: 0.28,
    shadowRadius: tvSize(10),
    shadowOffset: { width: 0, height: tvSize(3) },
    elevation: 8,
    zIndex: 8,
  },
}

export default Focusable
