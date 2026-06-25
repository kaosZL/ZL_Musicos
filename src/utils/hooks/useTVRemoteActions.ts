import { useEffect, useRef } from 'react'
import { getCachedIsTV } from '@/utils/tvMode'
import { onTVRemoteEvent, type TVRemoteEventType } from '@/utils/nativeModules/utils'

type TVRemoteActionHandler = () => void
type TVRemoteActions = Partial<Record<TVRemoteEventType, TVRemoteActionHandler>>

const KEY_ACTION_UP = 1

export const useTVRemoteActions = (actions: TVRemoteActions) => {
  const actionsRef = useRef(actions)

  useEffect(() => {
    actionsRef.current = actions
  }, [actions])

  useEffect(() => {
    if (!getCachedIsTV()) return

    return onTVRemoteEvent(({ eventType, eventKeyAction, repeatCount }) => {
      if (eventKeyAction !== KEY_ACTION_UP) return
      if (repeatCount > 0) return
      actionsRef.current[eventType]?.()
    })
  }, [])
}
