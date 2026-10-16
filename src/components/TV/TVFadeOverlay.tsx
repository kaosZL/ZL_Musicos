import { memo } from 'react'
import { View, type ViewStyle } from 'react-native'

interface Props {
  height: number
  /** rgba 前三段，如 '1,2,6' */
  rgb?: string
  /** 最浓一端的透明度 */
  peak?: number
  /** down = 顶部最浓向下淡出；up = 底部最浓向上淡出 */
  direction?: 'down' | 'up'
  steps?: number
  style?: ViewStyle | ViewStyle[]
}

const TVFadeOverlay = ({ height, rgb = '1,2,6', peak = 0.4, direction = 'up', steps = 12, style }: Props) => (
  <View
    pointerEvents="none"
    style={[
      { position: 'absolute', left: 0, right: 0, height, flexDirection: 'column' },
      direction === 'up' ? { bottom: 0 } : { top: 0 },
      style,
    ]}
  >
    {Array.from({ length: steps }, (_, i) => (
      <View
        key={i}
        style={{ flex: 1, backgroundColor: `rgba(${rgb},${(direction === 'up' ? peak * (i + 1) / steps : peak * (1 - i / steps)).toFixed(3)})` }}
      />
    ))}
  </View>
)

export default memo(TVFadeOverlay)
