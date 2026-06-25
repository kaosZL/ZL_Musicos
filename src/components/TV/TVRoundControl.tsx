import { forwardRef, memo, type ComponentProps } from 'react'
import { Text, type TextStyle, type ViewStyle } from 'react-native'
import Focusable from './Focusable'
import { tvColors } from '@/theme/tv'

interface Props extends Omit<ComponentProps<typeof Focusable>, 'children'> {
  label: string
  primary?: boolean
  size?: number
  style?: ViewStyle | ViewStyle[]
}

const TVRoundControl = forwardRef<any, Props>(({ label, primary, size = 64, style, ...props }, ref) => (
  <Focusable
    ref={ref}
    style={[
      styles.root,
      { width: size, height: size, borderRadius: size / 2 },
      primary ? styles.primary : styles.normal,
      style,
    ]}
    focusStyle={primary ? styles.primaryFocus : styles.focus}
    {...props}
  >
    <Text style={[styles.text, primary ? styles.primaryText : null]} numberOfLines={1}>{label}</Text>
  </Focusable>
))

const styles: Record<string, ViewStyle | TextStyle> = {
  root: {
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
  },
  normal: {
    backgroundColor: 'rgba(255,255,255,0.10)',
    borderColor: 'rgba(255,255,255,0.16)',
  },
  primary: {
    backgroundColor: tvColors.text,
    borderColor: tvColors.text,
  },
  focus: {
    backgroundColor: 'rgba(255,255,255,0.22)',
    borderColor: tvColors.text,
  },
  primaryFocus: {
    backgroundColor: '#ffffff',
    borderColor: tvColors.primaryHigh,
  },
  text: {
    color: tvColors.text,
    fontSize: 24,
    fontWeight: '900',
  },
  primaryText: {
    color: tvColors.bgDeep,
    fontSize: 28,
  },
}

export default memo(TVRoundControl)
