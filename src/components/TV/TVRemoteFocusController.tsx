import { useCallback, useEffect } from 'react'
import { getCachedIsTV } from '@/utils/tvMode'
import { clearActiveTVFocusScope, setActiveTVFocusScope } from './tvFocusManager'
import { useNavigationComponentDidAppear, useNavigationComponentDidDisappear } from '@/navigation/hooks'

// 原生优先焦点模式（对齐 react-native-tvos / Apple TV 的单一裁判做法）：
// 方向键与 OK 交给 Android 原生焦点系统（FocusFinder）处理——
// 焦点移动由框架的空间算法决定，JS 层不再拦截计算，
// 从根源上消除「自研焦点管理器 + 原生系统」双轨打架的问题。
// 本组件仅负责页面焦点 scope 的生命周期与初始焦点调度。
const TVRemoteFocusController = ({ componentId }: { componentId: string }) => {
  const handleAppear = useCallback(() => {
    if (!getCachedIsTV()) return
    setActiveTVFocusScope(componentId)
  }, [componentId])

  const handleDisappear = useCallback(() => {
    clearActiveTVFocusScope(componentId)
  }, [componentId])

  useNavigationComponentDidAppear(componentId, handleAppear)
  useNavigationComponentDidDisappear(componentId, handleDisappear)

  useEffect(() => {
    if (!getCachedIsTV()) return
    const timer = setTimeout(handleAppear, 320)
    return () => {
      clearTimeout(timer)
    }
  }, [componentId, handleAppear])

  return null
}

export default TVRemoteFocusController
