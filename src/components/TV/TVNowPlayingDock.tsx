import { memo, type PropsWithChildren } from 'react'
import { View, type ViewStyle } from 'react-native'
import TVText from './TVText'
import { tvColors } from '@/theme/tv'

interface Props {
  progressPercent: number
  now: string
  total: string
  style?: ViewStyle | ViewStyle[]
}

const TVNowPlayingDock = ({ progressPercent, now, total, style, children }: PropsWithChildren<Props>) => (
  <View style={[styles.root, style]}>
    <View style={styles.progressTrack}>
      <View style={[styles.progressBar, { width: `${Math.max(0, Math.min(progressPercent, 100))}%` }]} />
    </View>
    <View style={styles.timeRow}>
      <TVText variant="caption">{now}</TVText>
      <TVText variant="caption">{total}</TVText>
    </View>
    <View style={styles.controls}>{children}</View>
  </View>
)

const styles: Record<string, ViewStyle> = {
  root: {
    paddingTop: 10,
  },
  progressTrack: {
    height: 4,
    borderRadius: 999,
    backgroundColor: 'rgba(255,255,255,0.18)',
    overflow: 'hidden',
  },
  progressBar: {
    height: '100%',
    borderRadius: 999,
    backgroundColor: tvColors.text,
  },
  timeRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 7,
    opacity: 0.68,
  },
  controls: {
    marginTop: 11,
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 0,
  },
}

export default memo(TVNowPlayingDock)
