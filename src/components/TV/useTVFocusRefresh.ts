import { useCallback, useEffect, useRef, useState } from 'react'

export const useTVFocusRefresh = () => {
  const [, setTick] = useState(0)
  const queuedRef = useRef(false)

  const refresh = useCallback(() => {
    if (queuedRef.current) return
    queuedRef.current = true
    requestAnimationFrame(() => {
      queuedRef.current = false
      setTick(value => value + 1)
    })
  }, [])

  useEffect(() => { refresh() }, [refresh])

  return refresh
}
