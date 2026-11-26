import { useEffect, useRef } from 'react'
import { getCachedIsTV } from '@/utils/tvMode'
import { onTVRemoteEvent, type TVRemoteEventType } from '@/utils/nativeModules/utils'
import { isActiveTVFocusScope, isTVDialogActive } from '@/components/TV/tvFocusManager'
import { isTVDialogVisible } from '@/components/TV/TVDialog'

type TVRemoteActionHandler = () => void
type TVRemoteActions = Partial<Record<TVRemoteEventType, TVRemoteActionHandler>>

const KEY_ACTION_UP = 1
const MEDIA_EVENTS = new Set<TVRemoteEventType>(['playPause', 'previous', 'rewind', 'next', 'fastForward', 'stop'])

// componentId：传入后仅当本屏是活动屏（栈顶）时才响应。
// 修复：被压在栈底的屏（如 Search/Settings）的 playPause 处理器在用户看着
// 播放页时依然存活——在播放页按媒体播放/暂停键会被栈底屏再 push 一层
// 播放页（无感叠屏，播放页状态被静默重置，v1.9.24 返回键系列 bug 的帮凶）
// allowMediaDuringOverlay：播放页在全屏歌词等非弹窗全屏弹层下仍允许专用媒体键直达播放核心
export const useTVRemoteActions = (
  actions: TVRemoteActions,
  componentId?: string,
  options?: { allowMediaDuringOverlay?: boolean },
) => {
  const actionsRef = useRef(actions)
  const allowMediaRef = useRef(!!options?.allowMediaDuringOverlay)

  useEffect(() => {
    actionsRef.current = actions
  }, [actions])

  useEffect(() => {
    allowMediaRef.current = !!options?.allowMediaDuringOverlay
  }, [options?.allowMediaDuringOverlay])

  useEffect(() => {
    if (!getCachedIsTV()) return

    return onTVRemoteEvent(({ eventType, eventKeyAction, repeatCount }) => {
      if (componentId && !isActiveTVFocusScope(componentId)) return
      if (isTVDialogVisible()) return
      if (isTVDialogActive() && !(allowMediaRef.current && MEDIA_EVENTS.has(eventType))) return
      if (eventKeyAction !== KEY_ACTION_UP) return
      if (repeatCount > 0) return
      actionsRef.current[eventType]?.()
    })
  }, [componentId])
}

