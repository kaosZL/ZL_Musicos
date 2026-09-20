import { memo, useCallback, useEffect, useMemo, useRef, useState, type ComponentRef, type MutableRefObject } from 'react'
import { Image, ScrollView, View, findNodeHandle, type TextStyle, type ViewStyle } from 'react-native'
import TVAppleScaffold from '@/components/TV/TVAppleScaffold'
import TVTopTabs from '@/components/TV/TVTopTabs'
import TVText from '@/components/TV/TVText'
import TVButton from '@/components/TV/TVButton'
import TVSettingsPane from '@/components/TV/TVSettingsPane'
import TVDialog, { showTVDialog, type TVDialogButtonConfig, type TVDialogRequest } from '@/components/TV/TVDialog'
import Focusable from '@/components/TV/Focusable'
import { tvColors, tvSize } from '@/theme/tv'
import { useSettingValue } from '@/store/setting/hook'
import { usePlayerMusicInfo } from '@/store/player/hook'
import { useMyList } from '@/store/list/hook'
import { useStatus, useUserApiList } from '@/store/userApi/hook'
import apiSourceInfo from '@/utils/musicSdk/api-source-info'
import { LIST_IDS } from '@/config/constant'
import { setApiSource } from '@/core/apiSource'
import { updateSetting } from '@/core/common'
import { removeUserList, updateUserList, getListMusics } from '@/core/list'
import { httpFetch } from '@/utils/request'
import { generateQRCodeBase64, onLanSourceEvent, pushLanSonglists, pushLanSonglistExport, pushLanSources, startLanImportServer, stopLanImportServer } from '@/utils/nativeModules/utils'
import { importUserApi, removeUserApi, setUserApiAllowShowUpdateAlert } from '@/core/userApi'
import { TV_PRESET_USER_API_CANDIDATES } from '@/config/tvPresetUserApi'
import { useTVFocusRef } from '@/components/TV/useTVFocusRef'
import { useTVFocusRefresh } from '@/components/TV/useTVFocusRefresh'
import { pushTVPlayerScreen } from '@/navigation/navigation'
import { useTVNavigationBack } from '@/utils/hooks/useTVNavigationBack'
import { useTVRemoteActions } from '@/utils/hooks/useTVRemoteActions'
import { dot, tvText } from './labels'
import { importSonglist } from './songlistImport'
import { createTVTabs, getSourceName } from './utils'
import { TV_CURRENT_VERSION, checkTVUpdate, downloadTVUpdate, getDownloadedTVUpdatePath, installTVUpdate, type TVUpdateInfo } from './update'
import { setSleepTimer, setStopAfterCurrent, clearSleepTimer, getSleepTimerState } from '@/core/tvSleepTimer'

interface SourceItem {
  id: string
  name: string
  desc?: string
  status?: string
}

type FocusNode = ComponentRef<typeof Focusable> | null
type FocusRefMap = Record<string, FocusNode>
type TVUpdateStatus = 'idle' | 'checking' | 'latest' | 'available' | 'downloading' | 'downloaded' | 'installing' | 'error'
// 原生局域网服务（LanImportServer）是【单例】，生命周期比本页长：
// 一旦起来就会一直跑到 stopServer() 为止。因此同一时刻只能有一个 Settings 实例「拥有」这个会话，
// 否则从设置页再 push 一个设置页时，同一次手机提交会被两个实例各处理一遍（歌单被导入两遍）。
// 这个 token 记录「当前会话的归属实例」。
let lanSessionOwner: symbol | null = null

const DEFAULT_SOURCE_FOCUS_KEY = '__default__'
const getFocusKey = (id: string) => id || DEFAULT_SOURCE_FOCUS_KEY
const getHandleFromMap = (mapRef: MutableRefObject<FocusRefMap>, key?: string | null) => {
  if (!key) return null
  const node = mapRef.current[key]
  return node ? findNodeHandle(node) : null
}
const formatUpdateSize = (size: number) => {
  if (!size || size <= 0) return tvText.unknownSize
  if (size > 1024 * 1024) return `${Math.round(size / 1024 / 1024 * 10) / 10} MB`
  if (size > 1024) return `${Math.round(size / 1024 * 10) / 10} KB`
  return `${size} B`
}
const getUpdateErrorText = (err: unknown) => {
  const message = err instanceof Error ? err.message : ''
  switch (message) {
    case 'NO_APK_ASSET':
      return tvText.updateNoPackage
    default:
      return tvText.updateFailed
  }
}

function TVSettings({ componentId }: { componentId: string }) {
  const apiSource = useSettingValue('common.apiSource')
  const removedSources = useSettingValue('common.tvRemovedSources')
  const alertsMigrated = useSettingValue('common.tvUpdateAlertsOffMigrated')
  const musicInfo = usePlayerMusicInfo()
  const userApiList = useUserApiList()
  const apiStatus = useStatus()
  const [importMessage, setImportMessage] = useState('')
  const [updateStatus, setUpdateStatus] = useState<TVUpdateStatus>('idle')
  const [updateInfo, setUpdateInfo] = useState<TVUpdateInfo | null>(null)
  const [updateProgress, setUpdateProgress] = useState({ total: 0, current: 0 })
  const [updateMessage, setUpdateMessage] = useState('')
  const firstSourceFocus = useTVFocusRef()
  const updateButtonFocus = useTVFocusRef()
  const sourceRefs = useRef<FocusRefMap>({})
  const [qrImage, setQrImage] = useState('')
  const [lanRunning, setLanRunning] = useState(false)
  const [lanMessage, setLanMessage] = useState('')
  const [lanMessageOk, setLanMessageOk] = useState(false)
  // 手机侧操作（导入/改名/删除）的最终结果弹窗。
  // 用本页自己的 TVDialog 而不是全局 tipDialog：全局 showTVDialog 只会投给「最后挂载的
  // TVDialogHost」，而各屏 pop 时它的 cleanup 会把 activeListener 置 null、且不再重注册，
  // 于是全局弹窗有可能静默失效 —— 用户就又变成「啥也没看到」。本页自己弹最稳。
  const [lanResultDialog, setLanResultDialog] = useState<TVDialogRequest | null>(null)
  const lanInstanceToken = useRef<symbol>(Symbol('tv-settings'))
  const lanButtonFocus = useTVFocusRef()
  const lanHandlerRef = useRef<((action: string, payload: string) => void) | null>(null)
  // 定时关闭（09-20 需求）：状态存在模块单例里，页面每秒刷新显示剩余时间
  const [sleepState, setSleepState] = useState(() => getSleepTimerState())
  const [, setSleepTick] = useState(0)
  useEffect(() => {
    const timer = setInterval(() => { setSleepState(getSleepTimerState()); setSleepTick(t => t + 1) }, 1000)
    return () => { clearInterval(timer) }
  }, [])
  const sleepRemaining = sleepState.deadline > Date.now() ? Math.ceil((sleepState.deadline - Date.now()) / 60000) : 0
  const sleepActive = sleepRemaining > 0 || sleepState.stopAfterCurrent
  const sourceScrollRef = useRef<ComponentRef<typeof ScrollView>>(null)
  const rightScrollRef = useRef<ComponentRef<typeof ScrollView>>(null)
  const sourceLayoutRef = useRef<Record<string, number>>({})
  useTVFocusRefresh()

  useTVNavigationBack(componentId)
  useTVRemoteActions({ playPause: () => { if (musicInfo.id) pushTVPlayerScreen(componentId) } })

  useEffect(() => {
    if (alertsMigrated || !userApiList.length) return
    updateSetting({ 'common.tvUpdateAlertsOffMigrated': true })
    for (const api of userApiList) {
      if (api.allowShowUpdateAlert) void setUserApiAllowShowUpdateAlert(api.id, false)
    }
  }, [alertsMigrated, userApiList])

  const defaultSources = useMemo<SourceItem[]>(() => apiSourceInfo.filter(item => !removedSources.includes(item.id)).map(item => ({
    id: item.id,
    name: getSourceName(item.id) || item.name,
    desc: item.disabled ? tvText.unavailable : tvText.builtinSource,
    status: item.disabled ? tvText.unavailable : tvText.available,
  })), [removedSources])

  const presetSources = useMemo<SourceItem[]>(() => TV_PRESET_USER_API_CANDIDATES.filter(item => !removedSources.includes(item.id)).map(item => ({
    id: item.id,
    name: getSourceName(item.id),
    desc: `TV ${tvText.preset}${tvText.userApi}`,
    status: apiSource === item.id ? (apiStatus.status ? tvText.loaded : apiStatus.message === 'initing' ? tvText.loading : tvText.loadFailed) : tvText.preset,
  })), [apiSource, apiStatus.message, apiStatus.status, removedSources])

  const baseSources = useMemo<SourceItem[]>(() => ([
    { id: '', name: tvText.aggregateSource, desc: tvText.sourceSettingsDesc, status: tvText.available },
    ...presetSources,
    ...defaultSources,
  ]), [defaultSources, presetSources])

  const userApiById = useMemo(() => new Map(userApiList.map(item => [item.id, item])), [userApiList])
  // 「我的歌单」快照：推给原生层缓存，手机页读取后在手机上改名（TV 屏上无法输入中文）
  const allLists = useMyList()
  const userSonglists = useMemo(
    () => allLists.filter((item): item is LX.List.UserListInfo => item.id !== LIST_IDS.DEFAULT && item.id !== LIST_IDS.LOVE),
    [allLists],
  )
  const allSources = useMemo<SourceItem[]>(() => [
    ...userApiList.map(item => ({
      id: item.id,
      name: item.name,
      desc: item.version ? `${tvText.userApi}${dot}v${item.version}` : tvText.userApi,
      status: apiSource === item.id ? (apiStatus.status ? tvText.loaded : apiStatus.message === 'initing' ? tvText.loading : tvText.loadFailed) : '',
    })),
    ...baseSources,
  ], [apiSource, apiStatus.message, apiStatus.status, baseSources, userApiList])

  const bindFocusRef = (mapRef: MutableRefObject<FocusRefMap>, key: string, syncFirstSource = false) => (node: FocusNode) => {
    mapRef.current[key] = node
    if (syncFirstSource) firstSourceFocus.ref.current = node as any
  }
  const getSourceHandle = (id?: string | null) => getHandleFromMap(sourceRefs, id ? getFocusKey(id) : null)
  const updateProgressText = useMemo(() => {
    if (updateStatus !== 'downloading' && updateStatus !== 'downloaded') return ''
    if (!updateProgress.total) return formatUpdateSize(updateProgress.current)
    const percent = Math.min(100, Math.round(updateProgress.current / updateProgress.total * 100))
    return `${percent}%${dot}${formatUpdateSize(updateProgress.current)} / ${formatUpdateSize(updateProgress.total)}`
  }, [updateProgress, updateStatus])
  const updateButtonLabel = useMemo(() => {
    switch (updateStatus) {
      case 'checking':
        return tvText.checkingUpdate
      case 'available':
        return tvText.downloadUpdate
      case 'downloading':
        return updateProgressText ? `${tvText.downloadingUpdate}${dot}${updateProgressText}` : tvText.downloadingUpdate
      case 'downloaded':
        return tvText.installUpdate
      case 'installing':
        return tvText.installingUpdate
      default:
        return tvText.checkUpdate
    }
  }, [updateProgressText, updateStatus])

  const handleSourceItemFocus = (key: string) => {
    const targetY = sourceLayoutRef.current[key]
    if (targetY == null) return
    sourceScrollRef.current?.scrollTo({ y: Math.max(0, targetY - 24), animated: true })
  }

  const handleCheckUpdate = async() => {
    setUpdateStatus('checking')
    setUpdateMessage('')
    setUpdateProgress({ total: 0, current: 0 })
    try {
      const result = await checkTVUpdate()
      if (result.hasUpdate && result.info) {
        setUpdateInfo(result.info)
        setUpdateStatus('available')
        setUpdateMessage(tvText.updateAvailable)
      } else {
        setUpdateInfo(null)
        setUpdateStatus('latest')
        setUpdateMessage(tvText.updateLatest)
      }
    } catch (err: unknown) {
      setUpdateStatus('error')
      setUpdateMessage(getUpdateErrorText(err))
    }
  }

  const handleDownloadUpdate = async() => {
    if (!updateInfo) {
      await handleCheckUpdate()
      return
    }
    setUpdateStatus('downloading')
    setUpdateMessage('')
    setUpdateProgress({ total: updateInfo.asset.size, current: 0 })
    try {
      await downloadTVUpdate(updateInfo, (total, current) => {
        setUpdateProgress({ total, current })
      })
      setUpdateStatus('downloaded')
      setUpdateMessage(tvText.updateDownloaded)
    } catch (err: unknown) {
      setUpdateStatus('error')
      setUpdateMessage(getUpdateErrorText(err))
    }
  }

  const handleInstallUpdate = async() => {
    setUpdateStatus('installing')
    setUpdateMessage(tvText.installConfirmTip)
    try {
      await installTVUpdate(getDownloadedTVUpdatePath())
      setUpdateStatus('downloaded')
    } catch (err: unknown) {
      setUpdateStatus('error')
      setUpdateMessage(getUpdateErrorText(err))
    }
  }

  const handleUpdatePress = async() => {
    switch (updateStatus) {
      case 'checking':
      case 'downloading':
      case 'installing':
        return
      case 'available':
        await handleDownloadUpdate()
        return
      case 'downloaded':
        await handleInstallUpdate()
        return
      default:
        await handleCheckUpdate()
    }
  }

  const pushLanSourcesSnapshot = useCallback(() => {
    try {
      void pushLanSources(JSON.stringify({
        sources: allSources.map(src => ({ id: src.id, name: src.name, active: apiSource === src.id, isUser: userApiById.has(src.id) })),
      }))
    } catch (err: unknown) {
      // 快照推送失败静默忽略
    }
  }, [allSources, apiSource, userApiById])

  const pushLanSonglistsSnapshot = useCallback(async() => {
    try {
      // 带上每个歌单的歌曲数（09-20 需求）：手机页与 TV 卡片信息对齐
      const lists = await Promise.all(userSonglists.map(async(item) => ({
        id: item.id,
        name: item.name,
        count: (await getListMusics(item.id)).length,
      })))
      void pushLanSonglists(JSON.stringify({ lists }))
    } catch (err: unknown) {
      // 快照推送失败静默忽略
    }
  }, [userSonglists])

  // 手机侧操作的最终结果除了写页面常显文案，再弹一次本页弹窗 —— 用户就是靠这个知道「到底成没成」。
  // 之前只写 setLanMessage，而它在右栏最下方、导入结束时也不会自动滚动过去，用户根本看不到，
  // 只能靠「歌单卡有没有出现」来猜。
  const showLanResult = (title: string, message: string) => {
    setLanResultDialog({ title, message, buttons: [{ label: tvText.knowIt, tone: 'primary' }] })
  }

  const handleLanSourceEvent = async(action: string, payload: string) => {
    try {
      if (action === 'import') {
        const data = JSON.parse(payload || '{}') as { url?: string, script?: string }
        let script = data.script ?? ''
        if (!script && data.url) script = await httpFetch(data.url).promise.then(resp => resp.body) as string
        if (!script.trim()) {
          setLanMessage('手机提交的内容为空')
          return
        }
        await importUserApi(script)
        setLanMessageOk(true)
        setLanMessage('手机导入成功')
      } else if (action === 'remove') {
        const data = JSON.parse(payload || '{}') as { id?: string }
        if (data.id) await handleRemove(data.id)
      } else if (action === 'activate') {
        const data = JSON.parse(payload || '{}') as { id?: string }
        if (data.id) setApiSource(data.id)
      } else if (action === 'songlist') {
        const data = JSON.parse(payload || '{}') as {
          text?: string
          fileText?: string
          listName?: string
          fileName?: string
        }
        // 原生层已经把压缩包 / base64 展开过，这里 text + fileText 拼一起再解析
        const rawText = [data.text ?? '', data.fileText ?? ''].filter(item => item.trim()).join('\n')
        if (!rawText.trim()) {
          setLanMessageOk(false)
          setLanMessage('手机提交的歌单内容为空')
          global.app_event.songlistImportResult({ ok: false, message: '手机提交的歌单内容为空' })
          showLanResult(tvText.importFailed, '手机提交的歌单内容为空')
          return
        }
        setLanMessageOk(false)
        const outcome = await importSonglist(rawText, {
          listName: data.listName,
          fileName: data.fileName,
          onProgress: setLanMessage,
        })
        setLanMessageOk(outcome.ok)
        setLanMessage(outcome.message)
        // 同时广播给首页「我的歌单」，让用户不用回到设置页也能看到导入结果
        global.app_event.songlistImportResult({ ok: outcome.ok, message: outcome.message })
        showLanResult(outcome.ok ? tvText.importSuccess : tvText.importFailed, outcome.message)
      } else if (action === 'songlist-rename') {
        // 手机页改名：拿本地列表补全其余字段（locationUpdateTime 等），只覆盖 name
        const data = JSON.parse(payload || '{}') as { renames?: Array<{ id?: string, name?: string }> }
        const infos: LX.List.UserListInfo[] = []
        for (const item of data.renames ?? []) {
          if (!item.id) continue
          const name = item.name?.trim()
          if (!name) continue
          const target = userSonglists.find(list => list.id === item.id)
          if (!target || target.name === name) continue
          infos.push({ ...target, name })
        }
        if (!infos.length) {
          setLanMessageOk(false)
          setLanMessage('没有需要修改的歌单名')
          return
        }
        await updateUserList(infos)
        const renamedMessage = `已重命名 ${infos.length} 个歌单`
        setLanMessageOk(true)
        setLanMessage(renamedMessage)
        global.app_event.songlistImportResult({ ok: true, message: renamedMessage })
        showLanResult(tvText.renameDone, renamedMessage)
      } else if (action === 'songlist-remove') {
        // 手机页删除歌单：这里是唯一的删除入口，删完同步广播给首页
        const data = JSON.parse(payload || '{}') as { id?: string, ids?: Array<string | undefined> }
        const ids: string[] = []
        for (const id of data.ids ?? []) { if (id) ids.push(id) }
        if (!ids.length && data.id) ids.push(data.id)
        // 手机页拿到的是上一次推送的快照，可能已经过期（比如刚在电视上删过）
        const existingIds = ids.filter(id => userSonglists.some(list => list.id === id))
        if (!existingIds.length) {
          setLanMessageOk(false)
          setLanMessage(ids.length ? '电视上已经没有这些歌单了，请重新读取' : '没有指定要删除的歌单')
          return
        }
        await removeUserList(existingIds)
        const removedMessage = existingIds.length > 1 ? `已删除 ${existingIds.length} 个歌单` : '已删除歌单'
        setLanMessageOk(true)
        setLanMessage(removedMessage)
        global.app_event.songlistImportResult({ ok: true, message: removedMessage })
        showLanResult(tvText.deleteSonglistDone, removedMessage)
      } else if (action === 'songlist-export') {
        // 手机页导出歌单（09-20 需求）：打包成洛雪 playList_v2 JSON，手机端下载保存
        const data = JSON.parse(payload || '{}') as { id?: string }
        const id = data.id ?? ''
        const info = userSonglists.find(list => list.id === id)
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
      setLanMessageOk(false)
      setLanMessage(message)
      global.app_event.songlistImportResult({ ok: false, message })
      showLanResult(tvText.importFailed, message)
    }
  }
  lanHandlerRef.current = (action: string, payload: string) => { void handleLanSourceEvent(action, payload) }

  // 订阅跟「本页是否挂载」走，而不是跟「二维码是否打开」走。
  // 旧写法（`if (!lanRunning) return` + 依赖 lanRunning）有两个丢事件窗口：
  //   ① 原生服务是单例、本页卸载时并不会停服 —— 订阅被 cleanup 移除后，手机页面还开着、
  //      还能继续「提交成功」，而电视侧 JS 已经没人接（原生只 emit、不回放）
  //   ② 就算留在本页，重新按「手机扫码导入」时 setLanRunning(true) 排在两个 await 之后
  //      （startLanImportServer + generateQRCodeBase64），这期间到达的事件一样会被丢掉
  // 现在改成挂载即订阅，并在卸载时把「订阅没了 → 服务也停掉」这条对齐。
  useEffect(() => {
    const token = lanInstanceToken.current
    const off = onLanSourceEvent((event) => {
      // 只让当前会话的归属实例处理，避免「设置页里再 push 一个设置页」时同一件事被处理两遍
      if (lanSessionOwner !== token) return
      void lanHandlerRef.current?.(event.action, event.payload)
    })
    return () => {
      off()
      // 生命周期对齐：本页一离开，订阅就没了；此时必须把原生服务一起停掉，
      // 否则手机页面还能继续「提交成功」，而电视上永远不会有人响应。
      if (lanSessionOwner === token) {
        lanSessionOwner = null
        void stopLanImportServer()
      }
    }
  }, [])

  // 快照推送：扫码页一打开就立刻推一次，之后内容一变就补推（手机页读它做「歌单改名 / 删除」）
  useEffect(() => {
    if (!lanRunning) return
    pushLanSourcesSnapshot()
  }, [lanRunning, pushLanSourcesSnapshot])

  useEffect(() => {
    if (!lanRunning) return
    void pushLanSonglistsSnapshot()
  }, [lanRunning, pushLanSonglistsSnapshot])

  const handleOpenLanImport = async() => {
    setLanMessage('')
    setLanMessageOk(false)
    try {
      const { ip, port } = await startLanImportServer(9527)
      // 立刻接管会话：订阅在挂载时就已经挂上（见上面的 effect），所以从这一刻起
      // 手机推来的事件就有人处理，不必等二维码渲染完成 —— 消除「按了按钮、二维码还没出来时提交」的窗口
      lanSessionOwner = lanInstanceToken.current
      pushLanSourcesSnapshot()
      void pushLanSonglistsSnapshot()
      const qr = await generateQRCodeBase64(`http://${ip}:${port}`, 560)
      setQrImage(qr)
      setLanRunning(true)
      setTimeout(() => { rightScrollRef.current?.scrollToEnd({ animated: true }) }, 300)
    } catch (err: unknown) {
      const detail = err instanceof Error ? err.message : ''
      const message = detail ? `${tvText.lanStartFailed}：${detail}` : tvText.lanStartFailed
      setLanMessageOk(false)
      setLanMessage(message)
      // 启动失败必须让用户【看到】：旧代码只写 setLanMessage，而它在右栏最下方、不会自动滚过去，
      // 于是「端口被占 / 服务起不来」在用户眼里就是「按了按钮没反应」
      setLanResultDialog({
        title: tvText.lanStartFailed,
        message,
        buttons: [{ label: tvText.knowIt, tone: 'primary' }],
      })
    }
  }

  const handleCloseLanImport = () => {
    // 停服也必须走 owner 判定（与卸载 cleanup 的守卫语义一致）：
    // 非 owner 实例本来就没在跑服务 —— 它是被压在栈下的另一个设置页，正由 owner 在跑。
    // 若在这里无条件 stopServer()，会把 owner 还在用的服务停掉：owner 页面上二维码仍挂着
    // （lanRunning 仍为 true），服务却已经死了，变成「假存活」。
    if (lanSessionOwner === lanInstanceToken.current) {
      lanSessionOwner = null
      void stopLanImportServer()
    }
    setLanRunning(false)
    setQrImage('')
  }

  const handleRemove = async(id: string) => {
    setImportMessage('')
    try {
      const removedIsActive = apiSource === id
      await removeUserApi([id])
      if (removedIsActive) setApiSource('')
      setImportMessage(tvText.removeSuccess)
    } catch (err: unknown) {
      setImportMessage(err instanceof Error ? err.message : tvText.removeFailed)
    }
  }

  const handleToggleUpdateAlert = async(id: string, enable: boolean) => {
    setImportMessage('')
    try {
      await setUserApiAllowShowUpdateAlert(id, enable)
      setImportMessage(enable ? tvText.updateAlertOn : tvText.updateAlertOff)
    } catch (err: unknown) {
      setImportMessage(err instanceof Error ? err.message : tvText.updateAlertFailed)
    }
  }

  const removePresetOrBuiltinSource = (id: string) => {
    updateSetting({ 'common.tvRemovedSources': [...(removedSources ?? []), id] })
    if (apiSource === id) setApiSource('')
    setImportMessage('已删除该音源')
  }

  const doRemoveSource = async(id: string) => {
    if (userApiById.has(id)) {
      await handleRemove(id)
      return
    }
    removePresetOrBuiltinSource(id)
  }

  const confirmRemoveSource = (src: SourceItem) => {
    if (apiSource === src.id) {
      showTVDialog({
        title: '删除正在使用的音源',
        message: `「${src.name}」正在使用中。\n删除后将自动切换到聚合音源，当前歌曲会继续播放完。确定删除吗？`,
        buttons: [
          { label: '取消', tone: 'dark' },
          { label: '删除', tone: 'danger', onPress: () => { void doRemoveSource(src.id) } },
        ],
      })
      return
    }
    void doRemoveSource(src.id)
  }

  const showSourceActionMenu = (src: SourceItem) => {
    if (src.id === '') return
    const userApi = userApiById.get(src.id)
    const buttons: TVDialogButtonConfig[] = [{ label: '取消', tone: 'dark' }]
    if (userApi) {
      buttons.push({
        label: userApi.allowShowUpdateAlert ? '关闭更新提醒' : '开启更新提醒',
        tone: 'ghost',
        onPress: () => {
          if (userApi.allowShowUpdateAlert) {
            void handleToggleUpdateAlert(src.id, false)
            return
          }
          showTVDialog({
            title: '开启更新提醒',
            message: '好处：音源接口失效后，作者发布新版时你会第一时间收到弹窗提醒，可及时更新修复。\n\n代价：偶尔会有弹窗打扰。确定开启吗？',
            buttons: [
              { label: '取消', tone: 'dark' },
              { label: '开启', tone: 'primary', onPress: () => { void handleToggleUpdateAlert(src.id, true) } },
            ],
          })
        },
      })
    }
    buttons.push({ label: '删除音源', tone: 'danger', onPress: () => { confirmRemoveSource(src) } })
    showTVDialog({ title: src.name, message: '选择要执行的操作', buttons })
  }

  return (
    <TVAppleScaffold image={musicInfo.pic}>
      <TVTopTabs items={createTVTabs(componentId)} activeId="settings" subtitle={tvText.settings} nextFocusDown={lanButtonFocus.getNodeHandle() ?? firstSourceFocus.getNodeHandle() ?? undefined} />
      <View style={styles.root}>
        <TVSettingsPane title={`${tvText.source}${dot}${tvText.userApi}`} subtitle={tvText.sourceSettingsDesc} style={styles.sourcePanel}>
          <TVText variant="caption" color={tvColors.dimText} style={styles.listHint}>OK 键使用音源 · 长按 OK 键删除/管理</TVText>
          <ScrollView ref={sourceScrollRef} style={{ flex: 1 }} showsVerticalScrollIndicator={false} contentContainerStyle={styles.sourceContent}>
            {allSources.map((src, index) => {
              const focusKey = getFocusKey(src.id)
              const prevSourceId = allSources[index - 1]?.id
              const nextSourceId = allSources[index + 1]?.id
              const active = apiSource === src.id
              return (
                <View key={focusKey} style={styles.sourceBlock} onLayout={event => { sourceLayoutRef.current[focusKey] = event.nativeEvent.layout.y }}>
                  <Focusable
                    ref={bindFocusRef(sourceRefs, focusKey, index === 0) as any}
                    style={[styles.sourceItem, active ? styles.sourceActive : null]}
                    onFocus={() => { handleSourceItemFocus(focusKey) }}
                    onPress={() => { setApiSource(src.id) }}
                    onLongPress={() => { showSourceActionMenu(src) }}
                    hasTVPreferredFocus={index === 0}
                    nextFocusUp={getSourceHandle(prevSourceId) ?? undefined}
                    nextFocusRight={updateButtonFocus.getNodeHandle() ?? lanButtonFocus.getNodeHandle() ?? undefined}
                    nextFocusDown={getSourceHandle(nextSourceId) ?? undefined}
                  >
                    <View style={styles.sourceRow}>
                      <View style={styles.sourceInfo}>
                        <TVText variant="cardTitle" numberOfLines={1}>{src.name}</TVText>
                        <TVText variant="caption" style={styles.line} numberOfLines={1}>{src.desc ?? (src.id || tvText.defaultSource)}</TVText>
                      </View>
                      <TVText variant="caption" color={active ? tvColors.primaryHigh : tvColors.subtext}>{active ? tvText.currentUsing : src.status ?? ''}</TVText>
                    </View>
                  </Focusable>
                </View>
              )
            })}
          </ScrollView>
        </TVSettingsPane>

        <ScrollView ref={rightScrollRef} style={styles.rightColumn} showsVerticalScrollIndicator={false} contentContainerStyle={styles.rightContent}>
          <TVSettingsPane title={tvText.appUpdate} subtitle={tvText.appUpdateDesc} style={styles.updatePanel}>
            <View style={styles.updateMeta}>
              <TVText variant="caption" color={tvColors.subtext} numberOfLines={1}>{tvText.currentVersion}{dot}v{TV_CURRENT_VERSION}</TVText>
              {updateInfo ? <TVText variant="caption" color={tvColors.primaryHigh} numberOfLines={1}>{tvText.latestVersion}{dot}v{updateInfo.version}</TVText> : null}
              {updateInfo ? <TVText variant="caption" color={tvColors.subtext} numberOfLines={1}>{tvText.updatePackage}{dot}{updateInfo.asset.abi}{dot}{formatUpdateSize(updateInfo.asset.size)}</TVText> : null}
              {updateProgressText ? <TVText variant="caption" color={tvColors.subtext} numberOfLines={1}>{tvText.downloadProgress}{dot}{updateProgressText}</TVText> : null}
            </View>
            <TVButton ref={updateButtonFocus.ref as any} label={updateButtonLabel} tone={updateStatus === 'available' || updateStatus === 'downloaded' ? 'primary' : 'dark'} onPress={() => { void handleUpdatePress() }} nextFocusLeft={firstSourceFocus.getNodeHandle() ?? undefined} nextFocusDown={lanButtonFocus.getNodeHandle() ?? undefined} />
            <TVText variant="caption" color={updateStatus === 'error' ? tvColors.warn : tvColors.primaryHigh} style={styles.message}>{updateMessage || tvText.installConfirmTip}</TVText>
          </TVSettingsPane>

          {/* 定时关闭（09-20 需求）：睡前听歌自动停 */}
          <TVSettingsPane title="定时关闭" subtitle="睡前听歌自动停">
            <TVText variant="caption" color={sleepActive ? tvColors.primaryHigh : tvColors.subtext}>
              {sleepActive
                ? (sleepState.stopAfterCurrent ? '已开启：播完当前这首就停' : `已开启：${sleepRemaining} 分钟后停止`)
                : '未开启'}
            </TVText>
            <View style={styles.sleepRow}>
              <TVButton label="播完即停" tone={sleepState.stopAfterCurrent ? 'primary' : 'dark'} onPress={() => { setStopAfterCurrent(); setSleepState(getSleepTimerState()) }} />
              <TVButton label="30 分钟" tone="dark" onPress={() => { setSleepTimer(30); setSleepState(getSleepTimerState()) }} />
              <TVButton label="60 分钟" tone="dark" onPress={() => { setSleepTimer(60); setSleepState(getSleepTimerState()) }} />
              <TVButton label="90 分钟" tone="dark" onPress={() => { setSleepTimer(90); setSleepState(getSleepTimerState()) }} />
              {sleepActive ? <TVButton label="取消定时" tone="danger" onPress={() => { clearSleepTimer(); setSleepState(getSleepTimerState()) }} /> : null}
            </View>
          </TVSettingsPane>

          <TVSettingsPane title={tvText.importApi} subtitle={tvText.inputRemoteApi} style={styles.importPanel}>
            {importMessage ? <TVText variant="caption" color={importMessage === tvText.importSuccess ? tvColors.primaryHigh : tvColors.warn} style={styles.message}>{importMessage}</TVText> : null}
            {/* 手机扫码的结果放在按钮【上方】并且做成显眼的框：
                旧位置在面板最下方，右栏内容一长就被顶出可视区、且导入结束时不会自动滚过去，
                用户看不到「已导入 N 个歌单」，只能靠歌单卡有没有出现来猜 —— 这就是「没反应」的观感来源 */}
            {lanMessage ? (
              <View style={[styles.lanResult, lanMessageOk ? styles.lanResultOk : styles.lanResultWarn]}>
                <TVText variant="body" color={lanMessageOk ? tvColors.primaryHigh : tvColors.warn}>{lanMessage}</TVText>
              </View>
            ) : null}
            <TVButton ref={lanButtonFocus.ref as any} label={lanRunning ? '关闭二维码' : '手机扫码导入'} tone={lanRunning ? 'danger' : 'dark'} onPress={() => { void (lanRunning ? handleCloseLanImport() : handleOpenLanImport()) }} nextFocusUp={updateButtonFocus.getNodeHandle() ?? undefined} nextFocusLeft={firstSourceFocus.getNodeHandle() ?? undefined} />
            {qrImage ? (
              <View style={styles.qrWrap}>
                <Image source={{ uri: qrImage }} style={styles.qrImage} />
                <TVText variant="caption" color={tvColors.subtext} style={styles.line}>手机扫码打开页面，可导入音源/歌单，也能给已导入的歌单改名、删除</TVText>
                <TVText variant="caption" color={tvColors.subtext} style={styles.line}>改名必须在手机上做：电视遥控器输不了中文</TVText>
                <TVText variant="caption" color={tvColors.warn} style={styles.line}>⚠ 请确保手机与电视连接同一局域网（WiFi）</TVText>
              </View>
            ) : null}
          </TVSettingsPane>
        </ScrollView>
      </View>
      {/* 手机侧操作的结果弹窗：必须让人不可能错过（页面上的常显文案是兜底） */}
      <TVDialog
        visible={!!lanResultDialog}
        resetKey={lanResultDialog}
        title={lanResultDialog?.title ?? ''}
        message={lanResultDialog?.message}
        buttons={(lanResultDialog?.buttons ?? []).map(btn => ({
          ...btn,
          onPress: () => {
            setLanResultDialog(null)
            btn.onPress?.()
          },
        }))}
        onDismiss={() => { setLanResultDialog(null) }}
      />
    </TVAppleScaffold>
  )
}

const styles: Record<string, ViewStyle | TextStyle | any> = {
  root: { flex: 1, flexDirection: 'row', gap: tvSize(26) },
  sourcePanel: { flex: 1 },
  sourceContent: { paddingBottom: tvSize(20) },
  sourceBlock: { marginBottom: tvSize(12) },
  sourceItem: { borderRadius: tvSize(24), backgroundColor: 'rgba(255,255,255,0.075)', borderWidth: 1, borderColor: tvColors.border, padding: tvSize(18) },
  sourceActive: { backgroundColor: tvColors.primarySoft, borderColor: tvColors.primaryHigh },
  sourceRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: tvSize(16) },
  sourceInfo: { flex: 1 },
  listHint: { marginBottom: tvSize(8) },
  rightColumn: { width: tvSize(430), flexShrink: 0 },
  rightContent: { gap: tvSize(18), paddingBottom: tvSize(20) },
  updatePanel: { minHeight: tvSize(270) },
  updateMeta: { gap: tvSize(8), marginBottom: tvSize(18) },
  sleepRow: { flexDirection: 'row', flexWrap: 'wrap', gap: tvSize(10), marginTop: tvSize(14) },
  importPanel: { flex: 1 },
  line: { marginTop: tvSize(9) },
  message: { marginTop: tvSize(14) },
  // 手机扫码结果框：放在按钮上方，带边框与底色，保证不用滚动就能看到
  lanResult: { marginTop: tvSize(14), marginBottom: tvSize(14), paddingVertical: tvSize(12), paddingHorizontal: tvSize(16), borderRadius: tvSize(12), borderWidth: 1 },
  lanResultOk: { backgroundColor: 'rgba(255,255,255,0.06)', borderColor: tvColors.primaryHigh },
  lanResultWarn: { backgroundColor: 'rgba(241,195,109,0.10)', borderColor: tvColors.warn },
  qrWrap: { alignItems: 'center', gap: tvSize(12), marginTop: tvSize(14) },
  qrImage: { width: tvSize(320), height: tvSize(320), backgroundColor: '#FFFFFF', borderRadius: tvSize(16) },
}

export default memo(TVSettings)
