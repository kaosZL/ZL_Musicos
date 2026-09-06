import { useCallback, useEffect, useRef } from 'react'
import { getCachedIsTV } from '@/utils/tvMode'
import { onTVRemoteEvent } from '@/utils/nativeModules/utils'
import { clearActiveTVFocusScope, focusPreferredTVTarget, isActiveTVFocusScope, moveTVFocus, pressActiveTVTarget, setActiveTVFocusScope } from './tvFocusManager'
import { useNavigationComponentDidAppear, useNavigationComponentDidDisappear } from '@/navigation/hooks'

const KEY_ACTION_DOWN = 0

const TVRemoteFocusController = ({ componentId }: { componentId: string }) => {
  const activeRef = useRef(false)

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

    const unsubscribe = onTVRemoteEvent(({ eventType, eventKeyAction }) => {
      if (!activeRef.current || !isActiveTVFocusScope(componentId)) return
      if (eventKeyAction !== KEY_ACTION_DOWN) return

      switch (eventType) {
        case 'up':
        case 'down':
        case 'left':
        case 'right':
          void moveTVFocus(eventType)
          break
        case 'select':
          pressActiveTVTarget()
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
