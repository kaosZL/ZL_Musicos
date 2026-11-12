import { useEffect, useRef } from 'react'
import { getCachedIsTV } from '@/utils/tvMode'
import { onTVRemoteEvent, type TVRemoteEventType } from '@/utils/nativeModules/utils'
import { isActiveTVFocusScope } from '@/components/TV/tvFocusManager'

type TVRemoteActionHandler = () => void
type TVRemoteActions = Partial<Record<TVRemoteEventType, TVRemoteActionHandler>>

const KEY_ACTION_UP = 1

// componentId：传入后仅当本屏是活动屏（栈顶）时才响应。
// 修复：被压在栈底的屏（如 Search/Settings）的 playPause 处理器在用户看着
// 播放页时依然存活——在播放页按媒体播放/暂停键会被栈底屏再 push 一层
// 播放页（无感叠屏，播放页状态被静默重置，v1.9.24 返回键系列 bug 的帮凶）
export const useTVRemoteActions = (actions: TVRemoteActions, componentId?: string) => {
  const actionsRef = useRef(actions)

  useEffect(() => {
    actionsRef.current = actions
  }, [actions])

  useEffect(() => {
    if (!getCachedIsTV()) return

    return onTVRemoteEvent(({ eventType, eventKeyAction, repeatCount }) => {
      if (componentId && !isActiveTVFocusScope(componentId)) return
      if (eventKeyAction !== KEY_ACTION_UP) return
      if (repeatCount > 0) return
      actionsRef.current[eventType]?.()
    })
  }, [componentId])
}

