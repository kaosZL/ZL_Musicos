import { useCallback, useEffect, useRef } from 'react'
import { getCachedIsTV } from '@/utils/tvMode'
import { onTVRemoteEvent, debugLog } from '@/utils/nativeModules/utils'
import { activeTargetHasLongPress, clearActiveTVFocusScope, focusPreferredTVTarget, isActiveTVFocusScope, isTVDialogActive, longPressActiveTVTarget, moveTVFocus, pressActiveTVTarget, setActiveTVFocusScope } from './tvFocusManager'
import { startTVBackRouter } from './tvBackManager'
import { useNavigationComponentDidAppear, useNavigationComponentDidDisappear } from '@/navigation/hooks'

const KEY_ACTION_DOWN = 0
const KEY_ACTION_UP = 1
// 长按兜底时限：Android 标准长按阈值为 400ms（首个 repeat 一般在 ~500ms 出现）。
// 部分电视固件对 OK 键不产生 repeat 连发（方向键有、OK 键没有的怪癖真实存在），
// 按住超过此时限即视为长按——长按不再依赖 repeat 事件（v1.9.24 实机反馈：我的歌单长按删除无效）
const LONG_PRESS_FALLBACK_MS = 550

const TVRemoteFocusController = ({ componentId }: { componentId: string }) => {
  const activeRef = useRef(false)
  const selectHoldRef = useRef(false)
  const selectDownTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

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

    // 返回键统一路由：原生把 KEYCODE_BACK 交进管线后由 tvBackManager 分发（幂等启动）
    startTVBackRouter()

    const timer = setTimeout(handleAppear, 320)

    const clearSelectDownTimer = () => {
      if (selectDownTimerRef.current) {
        clearTimeout(selectDownTimerRef.current)
        selectDownTimerRef.current = null
      }
    }

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
          clearSelectDownTimer()
          // 无长按能力的按钮直接在按下时触发（零延迟）
          if (!activeTargetHasLongPress()) {
            pressActiveTVTarget()
            return
          }
          // 有长按能力的按钮：等 repeat 或 550ms 兜底，先不触发短按。
          // 兜底计时器：固件不连发 repeat 时按住超过阈值也判定为长按
          selectDownTimerRef.current = setTimeout(() => {
            selectDownTimerRef.current = null
            if (selectHoldRef.current) return
            selectHoldRef.current = true
            debugLog('select: 550ms兜底长按触发')
            longPressActiveTVTarget()
          }, LONG_PRESS_FALLBACK_MS)
        } else if (eventKeyAction === KEY_ACTION_DOWN && repeatCount > 0 && !selectHoldRef.current) {
          selectHoldRef.current = true
          clearSelectDownTimer()
          debugLog('select: repeat长按触发')
          longPressActiveTVTarget()
        } else if (eventKeyAction === KEY_ACTION_UP) {
          clearSelectDownTimer()
          if (!selectHoldRef.current && activeTargetHasLongPress()) {
            // 有长按能力的按钮：松开时才确定是短按（避免抢先触发）
            pressActiveTVTarget()
          }
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
      clearSelectDownTimer()
      unsubscribe()
    }
  }, [componentId, handleAppear])

  return null
}

export default TVRemoteFocusController
