import { dismissOverlay, onModalDismissed, showSyncModeModal } from '@/navigation'
import syncState from '@/store/sync/state'
import syncActions from '@/store/sync/action'
import { getCachedIsTV } from '@/utils/tvMode'
import { debugLog } from '@/utils/nativeModules/utils'

type RemoveListener = (() => void) | null
let removeEvent: RemoveListener

export const setSyncStatus = (status: LX.Sync.Status) => {
  syncActions.setStatus(status)
}

export const setSyncMessage = (message: LX.Sync.Status['message']) => {
  syncActions.setMessage(message)
}

export const setSyncModeComponentId = (id: string) => {
  syncActions.setSyncModeComponentId(id)
}

const closeSyncModeModal = () => {
  if (syncState.syncModeComponentId) {
    void dismissOverlay(syncState.syncModeComponentId)
    syncActions.setSyncModeComponentId('')
  }
}
// TV：同步方式选择请求推送到手机页（v1.9.25 老板拍板：数据同步的全部操作都在手机网页做）。
// 手机页轮询 /api/sync-status 看到 pendingMode 后渲染选项，选择经 /api/sync-mode 回传，
// 这里通过既有 app_event.selectSyncMode 机制 resolve。
// 60 秒无人选择自动取消连接：防「手机页已关、握手悬挂」——用户重试时页面会重新出现选项
const TV_SYNC_MODE_TIMEOUT_MS = 60_000

const tvSelectSyncMode = <T extends keyof LX.Sync.ModeTypes>(serverName: string, type: T, resolve: (mode: LX.Sync.ModeTypes[T]) => void, reject: (err: Error) => void) => {
  debugLog(`[同步]首次同步请求选择方式（服务器：${serverName}，等手机页选择，60s 超时）`)
  syncActions.setPendingMode({ serverName, type })

  let settled = false
  const finish = (fn: () => void) => {
    if (settled) return
    settled = true
    clearTimeout(timer)
    global.app_event.off('selectSyncMode', handleSelectMode)
    syncActions.setPendingMode(null)
    fn()
  }
  const handleSelectMode = ({ mode }: LX.Sync.ModeType) => {
    finish(() => { resolve(mode as LX.Sync.ModeTypes[T]) })
  }
  const timer = setTimeout(() => {
    finish(() => { reject(new Error('cancel')) })
  }, TV_SYNC_MODE_TIMEOUT_MS)

  global.app_event.on('selectSyncMode', handleSelectMode)
}

export const selectSyncMode = async<T extends keyof LX.Sync.ModeTypes>(serverName: string, type: T) => new Promise<LX.Sync.ModeTypes[T]>((resolve, reject) => {
  removeSyncModeEvent()
  syncActions.setServerInfo(serverName, type)

  // TV：触屏版 SyncModeModal 遥控器无法操作（普通 Button 不在焦点引擎里），
  // 选项经手机页呈现（见 tvSelectSyncMode）
  if (getCachedIsTV()) {
    tvSelectSyncMode(serverName, type, resolve, reject)
    return
  }

  showSyncModeModal()

  const removeListeners = () => {
    removeListener!()
    removeListener = null
    removeEvent = null
    global.app_event.off('selectSyncMode', handleSelectMode)
  }

  const handleSelectMode = ({ mode }: LX.Sync.ModeType) => {
    removeListeners()
    closeSyncModeModal()
    resolve(mode as LX.Sync.ModeTypes[T])
  }

  removeEvent = () => {
    removeListeners()
    reject(new Error('cancel'))
  }

  global.app_event.on('selectSyncMode', handleSelectMode)

  let removeListener: RemoveListener = onModalDismissed(syncState.syncModeComponentId, () => {
    syncActions.setSyncModeComponentId('')
    removeEvent?.()
  })
})

export const removeSyncModeEvent = () => {
  if (!removeEvent) return
  removeEvent()
  removeEvent = null
  closeSyncModeModal()
}
