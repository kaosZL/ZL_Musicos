import { memo, type PropsWithChildren } from 'react'
import { View, type TextStyle, type ViewStyle } from 'react-native'
import TVText from './TVText'
import { tvColors } from '@/theme/tv'

interface Props {
  title: string
  subtitle?: string
  style?: ViewStyle | ViewStyle[]
}

const TVSection = ({ title, subtitle, style, children }: PropsWithChildren<Props>) => (
  <View style={[styles.root, style]}>
    <View style={styles.header}>
      <TVText variant="sectionTitle">{title}</TVText>
      {subtitle ? <TVText variant="caption" style={styles.subtitle}>{subtitle}</TVText> : null}
    </View>
    {children}
  </View>
)

const styles: Record<string, ViewStyle | TextStyle> = {
  root: {
    marginBottom: 30,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'baseline',
    gap: 14,
    marginBottom: 16,
  },
  subtitle: {
    color: tvColors.dimText,
  },
}

export default memo(TVSection)
