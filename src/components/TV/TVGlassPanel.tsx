import { memo, type PropsWithChildren } from 'react'
import { View, type ViewStyle } from 'react-native'
import { tvColors, tvTokens } from '@/theme/tv'

interface Props {
  style?: ViewStyle | ViewStyle[]
  accent?: boolean
}

const TVGlassPanel = ({ style, accent, children }: PropsWithChildren<Props>) => (
  <View style={[styles.root, accent ? styles.accent : null, style]}>{children}</View>
)

const styles: Record<string, ViewStyle> = {
  root: {
    borderRadius: tvTokens.radiusLg,
    backgroundColor: tvColors.glass,
    borderWidth: 1,
    borderColor: tvColors.border,
    overflow: 'hidden',
  },
  accent: {
    backgroundColor: tvColors.surfaceWarm,
    borderColor: 'rgba(216,230,255,0.24)',
  },
}

export default memo(TVGlassPanel)
