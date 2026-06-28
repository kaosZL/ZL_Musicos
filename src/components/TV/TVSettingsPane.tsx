import { memo, type PropsWithChildren } from 'react'
import { View, type TextStyle, type ViewStyle } from 'react-native'
import TVText from './TVText'
import { tvColors, tvSize, tvTokens } from '@/theme/tv'

interface Props {
  title: string
  subtitle?: string
  style?: ViewStyle | ViewStyle[]
}

const TVSettingsPane = ({ title, subtitle, style, children }: PropsWithChildren<Props>) => (
  <View style={[styles.root, style]}>
    <TVText variant="sectionTitle">{title}</TVText>
    {subtitle ? <TVText variant="caption" style={styles.subtitle}>{subtitle}</TVText> : null}
    <View style={styles.body}>{children}</View>
  </View>
)

const styles: Record<string, ViewStyle | TextStyle> = {
  root: {
    borderRadius: tvTokens.radiusLg,
    backgroundColor: 'rgba(255,255,255,0.09)',
    borderWidth: 1,
    borderColor: tvColors.border,
    padding: tvSize(24),
    overflow: 'hidden',
  },
  subtitle: {
    marginTop: tvSize(7),
    color: tvColors.dimText,
  },
  body: {
    marginTop: tvSize(20),
    flex: 1,
  },
}

export default memo(TVSettingsPane)
