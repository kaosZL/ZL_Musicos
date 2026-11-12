import { useEffect } from 'react'
import { useIsPlay } from '@/store/player/hook'
import { screenkeepAwake, screenUnkeepAwake } from '@/utils/nativeModules/utils'

// Issue #12：TV 播放中系统屏保（华为智慧屏等）会自动切入并中断播放。
// 上游的 keepAwake 只接在手机版播放页（PlayDetail），TV 端从无人调用——
// 这里挂到每个屏幕的包装层（registerScreens），跟随播放状态持有/释放
// FLAG_KEEP_SCREEN_ON。screenkeepAwake 内部用 global.lx.isScreenKeepAwake
// 去重，多实例幂等。
const TVKeepScreenOn = () => {
  const isPlay = useIsPlay()

  useEffect(() => {
    if (isPlay) screenkeepAwake()
    else screenUnkeepAwake()
  }, [isPlay])

  return null
}

export default TVKeepScreenOn
