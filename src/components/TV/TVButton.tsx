import { forwardRef, memo, type ComponentProps } from 'react'
import { Text, View, type TextStyle, type ViewStyle } from 'react-native'
import Focusable from './Focusable'
import { tvColors, tvFont, tvSize, tvTokens } from '@/theme/tv'

interface Props extends Omit<ComponentProps<typeof Focusable>, 'children'> {
  label: string
  tone?: 'primary' | 'dark' | 'ghost' | 'danger' | 'warning'
  style?: ViewStyle | ViewStyle[]
  focusStyle?: ViewStyle | ViewStyle[]
}

const getToneStyle = (tone: Props['tone']) => {
  switch (tone) {
    case 'dark': return styles.dark
    case 'ghost': return styles.ghost
    case 'danger': return styles.danger
    case 'warning': return styles.warning
    case 'primary':
    default: return styles.primary
  }
}

const getTextStyle = (tone: Props['tone']) => tone === 'primary' ? styles.primaryText : styles.lightText

const TVButtonBase = forwardRef<any, Props>(({ label, tone = 'primary', style, focusStyle, onPress, hasTVPreferredFocus, ...rest }, ref) => (
  <Focusable
    ref={ref}
    style={[styles.root, getToneStyle(tone), style]}
    focusStyle={focusStyle}
    onPress={onPress}
    hasTVPreferredFocus={hasTVPreferredFocus}
    {...rest}
  >
    <View style={styles.inner}>
      <Text style={[styles.text, getTextStyle(tone)]} numberOfLines={1}>{label}</Text>
    </View>
  </Focusable>
))

const styles: Record<string, ViewStyle | TextStyle> = {
  root: {
    minHeight: tvSize(54),
    paddingHorizontal: tvSize(26),
    paddingVertical: tvSize(14),
    borderRadius: tvTokens.radiusPill,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
  },
  inner: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  primary: {
    backgroundColor: tvColors.text,
    borderColor: 'rgba(255,255,255,0.86)',
  },
  dark: {
    backgroundColor: tvColors.glassHigh,
    borderColor: tvColors.border,
  },
  ghost: {
    backgroundColor: 'rgba(255,255,255,0.045)',
    borderColor: tvColors.line,
  },
  danger: {
    backgroundColor: 'rgba(241,195,109,0.14)',
    borderColor: 'rgba(241,195,109,0.36)',
  },
  warning: {
    backgroundColor: 'rgba(241,195,109,0.16)',
    borderColor: 'rgba(241,195,109,0.40)',
  },
  text: {
    fontWeight: '900',
    fontSize: tvFont(18),
  },
  primaryText: {
    color: tvColors.bgDeep,
  },
  lightText: {
    color: tvColors.text,
  },
}

export default memo(TVButtonBase)
