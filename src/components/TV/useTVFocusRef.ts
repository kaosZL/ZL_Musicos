import { useMemo, useRef } from 'react'
import { findNodeHandle, type View } from 'react-native'

export const useTVFocusRef = () => {
  const ref = useRef<View | null>(null)

  return useMemo(() => ({
    ref,
    getNodeHandle() {
      return findNodeHandle(ref.current)
    },
  }), [])
}
