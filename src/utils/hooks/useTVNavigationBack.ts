import { useCallback } from 'react'
import { pop } from '@/navigation'
import { useBackHandler } from './useBackHandler'

export const useTVNavigationBack = (componentId?: string) => {
  const handleBack = useCallback(() => {
    if (!componentId) return false
    void pop(componentId)
    return true
  }, [componentId])

  useBackHandler(handleBack)
}
