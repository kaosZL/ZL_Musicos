import { useCallback, useEffect } from 'react'
import { pop } from '@/navigation'
import { getCachedIsTV } from '@/utils/tvMode'
import { useBackHandler } from './useBackHandler'
import { registerTVBack } from '@/components/TV/tvBackManager'

export const useTVNavigationBack = (componentId?: string) => {
  const handleBack = useCallback(() => {
    if (!componentId) return false
    void pop(componentId)
    return true
  }, [componentId])

  // TV：返回键走原生统一管线（tvBackManager 按 z 优先级问询，此处 z=10 导航层）。
  // 非 TV（手机构建）：保持系统 BackHandler 路径不变
  const isTV = getCachedIsTV()
  useBackHandler(useCallback(() => (isTV ? false : handleBack()), [isTV, handleBack]))

  useEffect(() => {
    if (!isTV || !componentId) return
    return registerTVBack({ z: 10, componentId, handler: handleBack })
  }, [isTV, componentId, handleBack])
}
