import { memo } from 'react'
import { Image, type ImageStyle, type StyleProp } from 'react-native'

interface Props {
  height: number
  /** 最浓一端的透明度（叠加在渐变 PNG 的 alpha 之上） */
  peak?: number
  /** down = 顶部最浓向下淡出；up = 底部最浓向上淡出 */
  direction?: 'down' | 'up'
  style?: StyleProp<ImageStyle>
}

// 512 级渐变 PNG + stretch 双线性插值 + 内嵌棋盘抖动：
// 切片堆叠方案会在电视大屏上显形为「条条」（v1.9.21 实测），必须用连续渐变
const TVFadeOverlay = ({ height, peak = 0.4, direction = 'up', style }: Props) => (
  <Image
    source={direction === 'up' ? require('@/resources/images/fade_up.png') : require('@/resources/images/fade_down.png')}
    resizeMode="stretch"
    style={[
      { position: 'absolute', left: 0, right: 0, height, opacity: peak },
      direction === 'up' ? { bottom: 0 } : { top: 0 },
      style,
    ]}
  />
)

export default memo(TVFadeOverlay)
