import { onLanSourceEvent, pushLanSources, pushLanSonglists, pushLanSonglistExport, pushLanSyncStatus, startLanImportServer, stopLanImportServer, debugLog } from '@/utils/nativeModules/utils'
import { state as userApiState } from '@/store/userApi/state'
import { event as userApiEvent } from '@/store/userApi/event'
import settingState from '@/store/setting/state'
import syncState from '@/store/sync/state'
import { userLists } from '@/utils/listManage'
import { LIST_IDS } from '@/config/constant'
import { createList, getListMusics, removeUserList, updateUserList } from '@/core/list'
import { setApiSource } from '@/core/apiSource'
import { updateSetting } from '@/core/common'
import { importUserApi, removeUserApi } from '@/core/userApi'
import { connectServer, disconnectServer } from '@/plugins/sync'
import { getSyncHost, setSyncHost } from '@/plugins/sync/data'
import { SYNC_CODE } from '@/plugins/sync/constants'
import { showTVDialog } from '@/components/TV/TVDialog'
import { importSonglist } from '@/screens/TV/songlistImport'
import { getSourceName } from '@/screens/TV/utils'
import { tvText } from '@/screens/TV/labels'
import { TV_PRESET_USER_API_CANDIDATES } from '@/config/tvPresetUserApi'
import apiSourceInfo from '@/utils/musicSdk/api-source-info'
import { httpFetch } from '@/utils/request'

/**
 * TV 局域网手机互联会话（v1.9.25 全局单例化）。
 *
 * 旧结构里「手机扫码导入」的整个会话（服务 + 事件处理 + 快照推送）都长在设置页组件里，
 * 二维码弹层一关 / 设置页一退出就停服——手机页直接断连（老板实测反馈）。
 * 现在抽成与组件生命周期无关的全局单例：
 * - 二维码只是「展示窗口」：收起弹层、退出设置页都不影响手机页连接
 * - 只有显式 stopTvLanSession()（设置页长按按钮 → 确认）才真正断开
 * - 手机操作的结果反馈走全局 TVDialog + app_event 广播 + 手机页自身回显
 */

export interface TvLanSessionState {
  running: boolean
  url: string
}

let sessionState: TvLanSessionState = { running: false, url: '' }
const listeners = new Set<(state: TvLanSessionState) => void>()
const notify = () => {
  for (const listener of listeners) listener({ ...sessionState })
}

/** UI 订阅会话状态（设置页按钮文案用） */
export const subscribeTvLanSession = (listener: (state: TvLanSessionState) => void) => {
  listeners.add(listener)
  listener({ ...sessionState })
  return () => { listeners.delete(listener) }
}

const showLanResult = (title: string, message: string) => {
  showTVDialog({ title, message, buttons: [{ label: tvText.knowIt, tone: 'primary' }] })
}

// ---------- 快照推送（手机页轮询读取的数据源） ----------

let cachedSyncHost = ''
const refreshSyncHost = async() => {
  cachedSyncHost = (await getSyncHost()) ?? ''
}

const pushSourcesSnapshot = () => {
  try {
    const apiSource = settingState.setting['common.apiSource']
    const removedSources = settingState.setting['common.tvRemovedSources'] ?? []
    const userApiList = userApiState.list
    // 与设置页展示列表同源：用户音源在前，随后聚合/预置/内置；手机页只消费 id/name/active/isUser
    const sources = [
      ...userApiList.map(item => ({
        id: item.id,
        name: item.name,
        isUser: true,
      })),
      { id: '', name: tvText.aggregateSource, isUser: false },
      ...TV_PRESET_USER_API_CANDIDATES.filter(item => !removedSources.includes(item.id)).map(item => ({
        id: item.id, name: getSourceName(item.id), isUser: false,
      })),
      ...apiSourceInfo.filter(item => !removedSources.includes(item.id)).map(item => ({
        id: item.id, name: getSourceName(item.id) || item.name, isUser: false,
      })),
    ]
    void pushLanSources(JSON.stringify({ sources: sources.map(src => ({ ...src, active: apiSource === src.id })) }))
  } catch {
    // 快照推送失败静默忽略（与旧实现一致）
  }
}

const pushSonglistsSnapshot = async() => {
  try {
    const userSonglists = userLists.filter(item => item.id !== LIST_IDS.DEFAULT && item.id !== LIST_IDS.LOVE)
    // allSettled：单个歌单读取失败只丢那一项，不拖垮整个快照（v1.9.24 实测教训）
    const settled = await Promise.allSettled(userSonglists.map(async(item) => ({
      id: item.id,
      name: item.name,
      count: (await getListMusics(item.id)).length,
    })))
    const lists = settled
      .filter((result): result is PromiseFulfilledResult<{ id: string, name: string, count: number }> => result.status === 'fulfilled')
      .map(result => result.value)
    debugLog(`歌单快照推送: ${lists.length}/${userSonglists.length} 个`)
    void pushLanSonglists(JSON.stringify({ lists }))
  } catch (err: unknown) {
    debugLog(`歌单快照推送失败: ${err instanceof Error ? err.message : String(err)}`)
  }
}

const syncStatusLabel = (enabled: boolean, status: LX.Sync.Status) => {
  if (!enabled) return '未启用'
  const message = status.message
  if (!message) return status.status ? '已连接' : '未连接'
  switch (message) {
    case SYNC_CODE.connecting: return '连接中…'
    case SYNC_CODE.authFailed: return '连接码错误'
    case SYNC_CODE.missingAuthCode: return '需要连接码（在下方填写后重新连接）'
    case SYNC_CODE.msgBlockedIp: return 'IP 被服务器屏蔽'
    case SYNC_CODE.unknownServiceAddress: return '地址无效'
    case SYNC_CODE.lowServiceVersion: return '服务器版本过低，请升级电脑版洛雪'
    case SYNC_CODE.highServiceVersion: return '服务器版本过高，请更新本 App'
    case SYNC_CODE.getServiceIdFailed: return '获取服务 ID 失败'
    case SYNC_CODE.connectServiceFailed: return '连接失败（检查地址 / 电脑端服务是否开启）'
    default: return message
  }
}

const pushSyncSnapshot = () => {
  try {
    void pushLanSyncStatus(JSON.stringify({
      enabled: settingState.setting['sync.enable'],
      connected: syncState.status.status,
      message: syncState.status.message,
      label: syncStatusLabel(settingState.setting['sync.enable'], syncState.status),
      host: cachedSyncHost,
      pendingMode: syncState.pendingMode,
    }))
  } catch {
    // 静默
  }
}

// ---------- 手机页事件处理 ----------

const handleRemoveSource = async(id: string) => {
  try {
    const removedIsActive = settingState.setting['common.apiSource'] === id
    await removeUserApi([id])
    if (removedIsActive) setApiSource('')
    showLanResult('音源', tvText.removeSuccess)
  } catch (err: unknown) {
    showLanResult('音源', err instanceof Error ? err.message : tvText.removeFailed)
  }
}

const handleLanEvent = async(action: string, payload: string) => {
  try {
    if (action === 'import') {
      const data = JSON.parse(payload || '{}') as { url?: string, script?: string }
      let script = data.script ?? ''
      if (!script && data.url) script = await httpFetch(data.url).promise.then(resp => resp.body) as string
      if (!script.trim()) {
        showLanResult(tvText.importFailed, '手机提交的内容为空')
        return
      }
      await importUserApi(script)
      showLanResult(tvText.importSuccess, '手机导入音源成功')
    } else if (action === 'remove') {
      const data = JSON.parse(payload || '{}') as { id?: string }
      if (data.id) await handleRemoveSource(data.id)
    } else if (action === 'activate') {
      const data = JSON.parse(payload || '{}') as { id?: string }
      if (data.id) setApiSource(data.id)
    } else if (action === 'songlist') {
      const data = JSON.parse(payload || '{}') as {
        text?: string
        fileText?: string
        listName?: string
        fileName?: string
        truncated?: boolean
      }
      // 原生层已经把压缩包 / base64 展开过，这里 text + fileText 拼一起再解析
      const rawText = [data.text ?? '', data.fileText ?? ''].filter(item => item.trim()).join('\n')
      if (!rawText.trim()) {
        global.app_event.songlistImportResult({ ok: false, message: '手机提交的歌单内容为空' })
        showLanResult(tvText.importFailed, '手机提交的歌单内容为空')
        return
      }
      const outcome = await importSonglist(rawText, {
        listName: data.listName,
        fileName: data.fileName,
      })
      // 原生展开超限（总 6MB/单条目 2MB/40 条目）会静默截断，必须如实告知
      if (data.truncated) outcome.message += '（注意：提交的内容过大被截断，只导入了前面一部分）'
      global.app_event.songlistImportResult({ ok: outcome.ok, message: outcome.message })
      showLanResult(outcome.ok ? tvText.importSuccess : tvText.importFailed, outcome.message)
    } else if (action === 'songlist-create') {
      // 手机页新建空歌单（v1.9.25 老板拍板：歌单增删全部集中在手机页）
      const data = JSON.parse(payload || '{}') as { name?: string }
      const name = data.name?.trim()
      if (!name) {
        showLanResult('新建失败', '请填写歌单名称')
        return
      }
      if (userLists.some(list => list.name === name)) {
        showLanResult('新建失败', `已有名为「${name}」的歌单`)
        return
      }
      await createList({ name, list: [] })
      const createdMessage = `已新建歌单「${name}」`
      global.app_event.songlistImportResult({ ok: true, message: createdMessage })
      showLanResult('新建歌单', createdMessage)
    } else if (action === 'sync-config') {
      // 手机页数据同步配置（v1.9.25 老板拍板：数据同步的全部操作都在手机网页做）
      const data = JSON.parse(payload || '{}') as { host?: string, code?: string, disconnect?: boolean }
      if (data.disconnect) {
        disconnectServer()
        updateSetting({ 'sync.enable': false })
        showLanResult('数据同步', '已断开数据同步')
        return
      }
      const host = data.host?.trim() ?? ''
      if (!/^https?:\/\/\S+/i.test(host)) {
        showLanResult('数据同步', '同步地址无效，应形如 http://192.168.1.100:23332')
        return
      }
      await setSyncHost(host)
      cachedSyncHost = host
      updateSetting({ 'sync.enable': true })
      void connectServer(host, data.code?.trim() || undefined)
      showLanResult('数据同步', `已保存 ${host}，正在连接…\n状态请在手机页查看；首次同步如需选择方式，按钮会出现在本页`)
    } else if (action === 'sync-mode') {
      // 手机页回传的「首次同步方式」选择 → 走既有 app_event 机制 resolve selectSyncMode
      const data = JSON.parse(payload || '{}') as { mode?: string }
      if (!data.mode) return
      global.app_event.selectSyncMode({ type: syncState.type, mode: data.mode } as LX.Sync.ModeType)
      debugLog(`同步方式已选: ${data.mode}`)
    } else if (action === 'songlist-rename') {
      // 手机页改名：拿本地列表补全其余字段（locationUpdateTime 等），只覆盖 name
      const data = JSON.parse(payload || '{}') as { renames?: Array<{ id?: string, name?: string }> }
      const infos: LX.List.UserListInfo[] = []
      for (const item of data.renames ?? []) {
        if (!item.id) continue
        const name = item.name?.trim()
        if (!name) continue
        const target = userLists.find(list => list.id === item.id && list.id !== LIST_IDS.DEFAULT && list.id !== LIST_IDS.LOVE)
        if (!target || target.name === name) continue
        infos.push({ ...target, name })
      }
      if (!infos.length) {
        showLanResult(tvText.renameAction, '没有需要修改的歌单名')
        return
      }
      await updateUserList(infos)
      const renamedMessage = `已重命名 ${infos.length} 个歌单`
      global.app_event.songlistImportResult({ ok: true, message: renamedMessage })
      showLanResult(tvText.renameDone, renamedMessage)
    } else if (action === 'songlist-remove') {
      // 手机页删除歌单：唯一的删除入口
      const data = JSON.parse(payload || '{}') as { id?: string, ids?: Array<string | undefined> }
      const ids: string[] = []
      for (const id of data.ids ?? []) { if (id) ids.push(id) }
      if (!ids.length && data.id) ids.push(data.id)
      // 手机页拿到的是上一次推送的快照，可能已经过期
      const existingIds = ids.filter(id => userLists.some(list => list.id === id))
      if (!existingIds.length) {
        showLanResult(tvText.deleteSonglist, ids.length ? '电视上已经没有这些歌单了，请重新读取' : '没有指定要删除的歌单')
        return
      }
      await removeUserList(existingIds)
      const removedMessage = existingIds.length > 1 ? `已删除 ${existingIds.length} 个歌单` : '已删除歌单'
      global.app_event.songlistImportResult({ ok: true, message: removedMessage })
      showLanResult(tvText.deleteSonglistDone, removedMessage)
    } else if (action === 'songlist-export') {
      // 手机页导出歌单：打包成洛雪 playList_v2 JSON，手机端下载保存
      const data = JSON.parse(payload || '{}') as { id?: string }
      const id = data.id ?? ''
      const info = userLists.find(list => list.id === id)
      if (!info) {
        void pushLanSonglistExport(JSON.stringify({ ok: false, message: '歌单不存在，请重新读取' }))
        return
      }
      const songs = await getListMusics(id)
      const lxData = {
        type: 'playList_v2',
        data: [{ name: info.name, id, source: info.source, sourceListId: info.sourceListId, list: songs }],
      }
      void pushLanSonglistExport(JSON.stringify({ ok: true, id, name: info.name, payload: JSON.stringify(lxData) }))
    }
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : '手机操作失败'
    global.app_event.songlistImportResult({ ok: false, message })
    showLanResult(tvText.importFailed, message)
  }
}

// ---------- 会话生命周期 ----------

let offLanEvents: (() => void) | null = null
let offWatchers: (() => void) | null = null

const watchStores = () => {
  // 音源列表 / 当前音源变化 → 重推音源快照
  userApiEvent.on('list_changed', pushSourcesSnapshot)
  const handleConfigUpdate = (keys: Array<keyof LX.AppSetting>) => {
    if (keys.includes('common.apiSource') || keys.includes('common.tvRemovedSources') || keys.includes('sync.enable')) {
      pushSourcesSnapshot()
      pushSyncSnapshot()
    }
  }
  global.state_event.on('configUpdated', handleConfigUpdate)
  // 歌单变化 → 重推歌单快照（同步落地也走 mylistUpdated）
  const handleMyListUpdated = () => { void pushSonglistsSnapshot() }
  global.state_event.on('mylistUpdated', handleMyListUpdated)
  // 同步状态/待选方式变化 → 重推同步快照
  const handleSyncUpdated = () => pushSyncSnapshot()
  global.state_event.on('syncStatusUpdated', handleSyncUpdated)

  offWatchers = () => {
    userApiEvent.off('list_changed', pushSourcesSnapshot)
    global.state_event.off('configUpdated', handleConfigUpdate)
    global.state_event.off('mylistUpdated', handleMyListUpdated)
    global.state_event.off('syncStatusUpdated', handleSyncUpdated)
  }
}

/** 开启手机互联会话（幂等）。返回含二维码 URL 的会话状态。 */
export const startTvLanSession = async(): Promise<TvLanSessionState> => {
  if (sessionState.running) return sessionState
  const { ip, port, token } = await startLanImportServer(9527)
  const url = `http://${ip}:${port}/?t=${encodeURIComponent(token)}`
  await refreshSyncHost()
  offLanEvents = onLanSourceEvent(({ action, payload }) => { void handleLanEvent(action, payload) })
  watchStores()
  sessionState = { running: true, url }
  notify()
  debugLog(`手机互联会话开启: ${ip}:${port}`)
  pushSourcesSnapshot()
  void pushSonglistsSnapshot()
  pushSyncSnapshot()
  return sessionState
}

/** 关闭手机互联会话（唯一断开方式：设置页长按按钮确认后调用） */
export const stopTvLanSession = async() => {
  offWatchers?.()
  offWatchers = null
  offLanEvents?.()
  offLanEvents = null
  sessionState = { running: false, url: '' }
  notify()
  debugLog('手机互联会话关闭')
  await stopLanImportServer()
}
