import { memo, type PropsWithChildren } from 'react'
import { ScrollView, View, type TextStyle, type ViewStyle } from 'react-native'
import TVText from './TVText'
import { tvColors } from '@/theme/tv'

interface Props {
  title: string
  subtitle?: string
  horizontal?: boolean
  style?: ViewStyle | ViewStyle[]
  contentStyle?: ViewStyle | ViewStyle[]
}

const TVShelf = ({ title, subtitle, horizontal = true, style, contentStyle, children }: PropsWithChildren<Props>) => (
  <View style={[styles.root, style]}>
    <View style={styles.header}>
      <TVText variant="sectionTitle">{title}</TVText>
      {subtitle ? <TVText variant="caption" style={styles.subtitle}>{subtitle}</TVText> : null}
    </View>
    {horizontal ? (
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={[styles.row, contentStyle]}>
        {children}
      </ScrollView>
    ) : (
      <View style={contentStyle}>{children}</View>
    )}
  </View>
)

const styles: Record<string, ViewStyle | TextStyle> = {
  root: {
    marginTop: 28,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'baseline',
    justifyContent: 'space-between',
    marginBottom: 14,
  },
  subtitle: {
    color: tvColors.dimText,
  },
  row: {
    gap: 18,
    paddingRight: 48,
    paddingBottom: 10,
  },
}

export default memo(TVShelf)
