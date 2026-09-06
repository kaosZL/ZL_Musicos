import { useCallback, useEffect, useRef } from 'react'
import { getCachedIsTV } from '@/utils/tvMode'
import { onTVRemoteEvent } from '@/utils/nativeModules/utils'
import { activeTargetHasLongPress, clearActiveTVFocusScope, isActiveTVFocusScope, isTVDialogActive, longPressActiveTVTarget, moveTVFocus, pressActiveTVTarget, setActiveTVFocusScope } from './tvFocusManager'
import { useNavigationComponentDidAppear, useNavigationComponentDidDisappear } from '@/navigation/hooks'

const KEY_ACTION_DOWN = 0
const KEY_ACTION_UP = 1

const TVRemoteFocusController = ({ componentId }: { componentId: string }) => {
  const activeRef = useRef(false)
  const selectHoldRef = useRef(false)

  const handleAppear = useCallback(() => {
    if (!getCachedIsTV()) return
    activeRef.current = true
    setActiveTVFocusScope(componentId)
  }, [componentId])

  const handleDisappear = useCallback(() => {
    activeRef.current = false
    clearActiveTVFocusScope(componentId)
  }, [componentId])

  useNavigationComponentDidAppear(componentId, handleAppear)
  useNavigationComponentDidDisappear(componentId, handleDisappear)

  useEffect(() => {
    if (!getCachedIsTV()) return

    const timer = setTimeout(handleAppear, 320)

    const unsubscribe = onTVRemoteEvent(({ eventType, eventKeyAction, repeatCount }) => {
      if (!activeRef.current || !isActiveTVFocusScope(componentId)) return

      // 弹窗激活时控制器完全让路：弹窗自己处理左右/OK/返回
      if (isTVDialogActive()) return

      // select 键三阶段处理（原生按键被 Activity 消费，Pressable 的 onLongPress 永远不触发）：
      // DOWN(rc=0)=按下 & 无长按目标时立即短按 / DOWN(rc>0)=长按(repeat) / UP=无 repeat 时短按
      // 注意：Android 的 repeat 事件 eventKeyAction 仍是 0，靠 repeatCount>0 识别
      if (eventType === 'select') {
        if (eventKeyAction === KEY_ACTION_DOWN && repeatCount === 0) {
          selectHoldRef.current = false
          // 无长按能力的按钮直接在按下时触发（零延迟）
          if (!activeTargetHasLongPress()) pressActiveTVTarget()
        } else if (eventKeyAction === KEY_ACTION_DOWN && repeatCount > 0 && !selectHoldRef.current) {
          selectHoldRef.current = true
          longPressActiveTVTarget()
        } else if (eventKeyAction === KEY_ACTION_UP && !selectHoldRef.current && activeTargetHasLongPress()) {
          // 有长按能力的按钮：松开时才确定是短按（避免抢先触发）
          pressActiveTVTarget()
        }
        return
      }

      if (eventKeyAction !== KEY_ACTION_DOWN) return

      switch (eventType) {
        case 'up':
        case 'down':
        case 'left':
        case 'right':
          void moveTVFocus(eventType)
          break
        default:
          if (eventType === 'menu') void focusPreferredTVTarget()
          break
      }
    })

    return () => {
      clearTimeout(timer)
      unsubscribe()
    }
  }, [componentId, handleAppear])

  return null
}

export default TVRemoteFocusController
