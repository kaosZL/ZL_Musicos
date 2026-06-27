import { forwardRef, useCallback, useState, type ComponentRef } from 'react'
import { Pressable, type NativeSyntheticEvent, type PressableProps, type StyleProp, type TargetedEvent, type ViewStyle } from 'react-native'
import { tvColors, tvTokens } from '@/theme/tv'

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

const Focusable = forwardRef<ComponentRef<typeof Pressable>, FocusableProps>(({ style, focusStyle, children, onPress, hasTVPreferredFocus, onFocus, onBlur, ...rest }, ref) => {
  const [focused, setFocused] = useState(false)

  const handleFocus = useCallback((event: FocusEvent) => {
    setFocused(true)
    onFocus?.(event)
  }, [onFocus])

  const handleBlur = useCallback((event: FocusEvent) => {
    setFocused(false)
    onBlur?.(event)
  }, [onBlur])

  return (
    <Pressable
      ref={ref}
      focusable
      hasTVPreferredFocus={hasTVPreferredFocus}
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
    borderWidth: 4,
    borderColor: tvColors.primary,
    backgroundColor: 'rgba(138,173,255,0.16)',
    shadowColor: tvColors.primary,
    shadowOpacity: 0.55,
    shadowRadius: 24,
    elevation: 18,
    transform: [{ scale: tvTokens.focusScale }],
  },
}

export default Focusable
