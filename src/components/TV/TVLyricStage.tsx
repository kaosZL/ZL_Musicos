import { memo } from 'react'
import { View, type ViewStyle } from 'react-native'
import { tvColors } from '@/theme/tv'
import TVText from './TVText'

interface Props {
  previous?: string
  current: string
  translation?: string
  next?: string
  style?: ViewStyle | ViewStyle[]
}

const TVLyricStage = ({ previous, current, translation, next, style }: Props) => (
  <View style={[styles.root, style]}>
    {previous ? <TVText variant="sectionTitle" style={styles.prev} numberOfLines={1}>{previous}</TVText> : null}
    <TVText variant="pageTitle" style={styles.current} numberOfLines={2}>{current}</TVText>
    {translation ? <TVText variant="body" color={tvColors.primaryHigh} style={styles.translation} numberOfLines={1}>{translation}</TVText> : null}
    {next ? <TVText variant="sectionTitle" style={styles.next} numberOfLines={1}>{next}</TVText> : null}
  </View>
)

const styles: Record<string, ViewStyle | any> = {
  root: {
    justifyContent: 'center',
  },
  prev: {
    color: tvColors.lyricDim,
    fontSize: 24,
    lineHeight: 34,
  },
  current: {
    marginTop: 18,
    color: tvColors.lyricActive,
    fontSize: 46,
    lineHeight: 58,
  },
  translation: {
    marginTop: 14,
    fontSize: 21,
  },
  next: {
    marginTop: 22,
    color: tvColors.lyricDim,
    fontSize: 25,
    lineHeight: 35,
  },
}

export default memo(TVLyricStage)
