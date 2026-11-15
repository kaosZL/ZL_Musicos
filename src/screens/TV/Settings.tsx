import { memo, useCallback, useEffect, useMemo, useRef, useState, type ComponentRef, type MutableRefObject } from 'react'
import { Image, ScrollView, View, findNodeHandle, type TextStyle, type ViewStyle } from 'react-native'
import TVAppleScaffold from '@/components/TV/TVAppleScaffold'
import TVTopTabs from '@/components/TV/TVTopTabs'
import TVText from '@/components/TV/TVText'
import TVButton from '@/components/TV/TVButton'
import TVSettingsPane from '@/components/TV/TVSettingsPane'
import { showTVDialog, isTVDialogVisible, type TVDialogButtonConfig } from '@/components/TV/TVDialog'
import Focusable from '@/components/TV/Focusable'
import { tvColors, tvSize } from '@/theme/tv'
import { useSettingValue } from '@/store/setting/hook'
import { usePlayerMusicInfo } from '@/store/player/hook'
import { useMyList } from '@/store/list/hook'
import { useStatus, useUserApiList } from '@/store/userApi/hook'
import syncState from '@/store/sync/state'
import apiSourceInfo from '@/utils/musicSdk/api-source-info'
import { LIST_IDS } from '@/config/constant'
import { setApiSource } from '@/core/apiSource'
import { updateSetting } from '@/core/common'
import { generateQRCodeBase64, onTVRemoteEvent } from '@/utils/nativeModules/utils'
import { removeUserApi, setUserApiAllowShowUpdateAlert } from '@/core/userApi'
import { confirmDialog } from '@/utils/tools'
import { startTvLanSession, stopTvLanSession, subscribeTvLanSession } from '@/core/tvLan'
import { TV_PRESET_USER_API_CANDIDATES } from '@/config/tvPresetUserApi'
import { useTVFocusRef } from '@/components/TV/useTVFocusRef'
import { useTVFocusRefresh } from '@/components/TV/useTVFocusRefresh'
import { setTVDialogActive } from '@/components/TV/tvFocusManager'
import { registerTVBack } from '@/components/TV/tvBackManager'
import { pushTVPlayerScreen } from '@/navigation/navigation'
import { useTVNavigationBack } from '@/utils/hooks/useTVNavigationBack'
import { useTVRemoteActions } from '@/utils/hooks/useTVRemoteActions'
import { dot, tvText } from './labels'
import { createTVTabs, getSourceName } from './utils'
import { TV_CURRENT_VERSION, checkTVUpdate, downloadTVUpdate, getDownloadedTVUpdatePath, installTVUpdate, type TVUpdateInfo } from './update'

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

// 音乐音质四档（v1.9.23）：写 player.playQuality，核心链路按歌逐首自动降档（getPlayQuality）
const QUALITY_OPTIONS: Array<{ q: LX.Quality, label: string, short: string }> = [
  { q: '128k', label: '流畅 · 128K', short: '流畅' },
  { q: '320k', label: '高清 · 320K', short: '高清' },
  { q: 'flac', label: '无损 · FLAC', short: '无损' },
  { q: 'flac24bit', label: 'Hi-Res · FLAC 24bit', short: 'Hi-Res' },
]
const qualityLabel = (q: LX.Quality) => QUALITY_OPTIONS.find(o => o.q == q)?.label ?? q
const qualityShortLabel = (q: LX.Quality) => QUALITY_OPTIONS.find(o => o.q == q)?.short ?? q
// 当前音源申报的最高音质：global.lx.qualityList 在源初始化时填充（只覆盖使用中的源），
// 未安装/未初始化的源要切过去用一次才知道
const getMaxSupportedQuality = (): LX.Quality | null => {
  const all = new Set<LX.Quality>()
  for (const qs of Object.values(global.lx.qualityList ?? {})) qs?.forEach(q => all.add(q))
  for (let i = QUALITY_OPTIONS.length - 1; i >= 0; i--) {
    if (all.has(QUALITY_OPTIONS[i].q)) return QUALITY_OPTIONS[i].q
  }
  return null
}

function TVSettings({ componentId }: { componentId: string }) {
  const apiSource = useSettingValue('common.apiSource')
  const playQuality = useSettingValue('player.playQuality')
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
  const qualityButtonFocus = useTVFocusRef()
  const updateButtonFocus = useTVFocusRef()
  const sourceRefs = useRef<FocusRefMap>({})
  const [qrImage, setQrImage] = useState('')
  // 二维码对应的完整网址（含一次性 token）：显示在二维码下方——
  // 电脑模拟器测试时网络是 NAT 隔离的（手机扫了也连不进模拟器），可在电脑上
  // `adb forward tcp:9527 tcp:9527` 后用浏览器直接打开；也是扫码失败的兜底入口
  const [qrUrl, setQrUrl] = useState('')
  const [lanRunning, setLanRunning] = useState(false)
  const lanButtonFocus = useTVFocusRef()
  const sourceScrollRef = useRef<ComponentRef<typeof ScrollView>>(null)
  const rightScrollRef = useRef<ComponentRef<typeof ScrollView>>(null)
  const sourceLayoutRef = useRef<Record<string, number>>({})
  const settingsFocusRefresh = useTVFocusRefresh()
  // 顶部导航接线契约：音源列表首项按上直达导航栏
  const activeTabFocus = useRef<FocusNode>(null)
  const getActiveTabHandle = () => (activeTabFocus.current ? findNodeHandle(activeTabFocus.current) : null)

  useTVNavigationBack(componentId)
  useTVRemoteActions({ playPause: () => { if (musicInfo.id) pushTVPlayerScreen(componentId) } }, componentId)

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



  // 手机互联会话状态（v1.9.25 全局单例化：二维码只是展示窗口，会话独立于本组件存活）
  const [tvLanSession, setTvLanSessionState] = useState({ running: false, url: '' })
  useEffect(() => subscribeTvLanSession(setTvLanSessionState), [])

  const handleOpenLanImport = async() => {
    try {
      // 会话的开启/事件处理/快照推送都在全局单例里（src/core/tvLan.ts）；
      // 这里只负责生成并展示二维码。URL 带一次性 token：服务绑 0.0.0.0，没鉴权的话同局域网任意设备都能操作
      const session = await startTvLanSession()
      const qr = await generateQRCodeBase64(session.url, 560)
      setQrUrl(session.url)
      setQrImage(qr)
      setLanRunning(true)
    } catch (err: unknown) {
      const detail = err instanceof Error ? err.message : ''
      const message = detail ? `${tvText.lanStartFailed}：${detail}` : tvText.lanStartFailed
      showTVDialog({
        title: tvText.lanStartFailed,
        message,
        buttons: [{ label: tvText.knowIt, tone: 'primary' }],
      })
    }
  }

  // 收起二维码弹层——只是隐藏展示，手机页连接保持（v1.9.25 老板实测反馈：
  // 「返回/OK 关二维码导致手机页断连」——断开只能走长按按钮 → 确认 → stopTvLanSession）
  const handleCloseLanImport = () => {
    setLanRunning(false)
    setQrImage('')
    setQrUrl('')
  }

  const handleStopLanSession = () => {
    confirmDialog({
      title: '关闭手机互联',
      message: '断开后手机页面将无法操作电视（音乐播放不受影响）。确定关闭吗？',
      confirmButtonText: '关闭互联',
      cancelButtonText: tvText.cancelAction,
    }).then(confirmed => {
      if (!confirmed) return
      handleCloseLanImport()
      void stopTvLanSession()
    })
  }

  // 二维码弹层期间接管按键：弹层里没有可聚焦项，焦点控制器让路（setTVDialogActive），
  // OK 短按 / 返回键直接关闭。400ms 防抖忽略打开弹层那次按键的余波（与 TVDialog 同理）。
  // 有结果弹窗在显示时 OK 让给弹窗——否则确认弹窗的同一下 OK 会把二维码一起关掉、
  // 手机页连接直接断（v1.9.25 实测反馈）
  useEffect(() => {
    if (!qrImage) return
    // 计数式让路：弹层打开即获取一份，关闭时在 cleanup 里释放。
    // （旧写法靠「每个按键重新断言」对抗 TVDialog 关闭时把标志置 false——
    //   但断言发生在焦点控制器之后，存在穿透窗口，v1.9.25 实测「焦点卡住」的根源）
    setTVDialogActive(true)
    const openedAt = Date.now()
    const unsub = onTVRemoteEvent(({ eventType, eventKeyAction, repeatCount }) => {
      if (eventKeyAction !== 1 || repeatCount > 0) return
      if (isTVDialogVisible()) return
      if (eventType === 'select' && Date.now() - openedAt > 400) handleCloseLanImport()
    })
    // 返回键关弹层走统一路由（z=200 弹层级，低于 TVDialog 的 300）
    const unregisterBack = registerTVBack({
      z: 200,
      componentId,
      handler: () => {
        handleCloseLanImport()
        return true
      },
    })
    return () => {
      setTVDialogActive(false)
      unsub()
      unregisterBack()
    }
  }, [qrImage, componentId])

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

  // 音乐音质选择（v1.9.23）：选高档位后逐首自动匹配，取链失败同源降档重试、全败才换源
  const showQualityPicker = () => {
    const maxQ = getMaxSupportedQuality()
    showTVDialog({
      title: '音乐音质',
      message: maxQ
        ? `当前音源申报最高支持${dot}${qualityLabel(maxQ)}\n选高档位后逐首自动匹配，歌曲/音源不支持或取链失败时自动降档`
        : '选高档位后逐首自动匹配，歌曲/音源不支持或取链失败时自动降档',
      buttons: QUALITY_OPTIONS.map(o => ({
        label: (playQuality == o.q ? '● ' : '') + o.label,
        tone: playQuality == o.q ? 'primary' : 'dark',
        onPress: () => { updateSetting({ 'player.playQuality': o.q }) },
      })),
    })
  }
  const maxSupportedQuality = useMemo(() => getMaxSupportedQuality(), [apiSource, apiStatus.status, apiStatus.message])

  return (
    <TVAppleScaffold image={musicInfo.pic}>
      <TVTopTabs items={createTVTabs(componentId, 'settings')} activeId="settings" subtitle={tvText.settings} nextFocusDown={lanButtonFocus.getNodeHandle() ?? firstSourceFocus.getNodeHandle() ?? undefined} activeTabRef={activeTabFocus} onActiveTabReady={settingsFocusRefresh} />
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
                    nextFocusUp={index === 0 ? getActiveTabHandle() ?? undefined : getSourceHandle(prevSourceId) ?? undefined}
                    nextFocusRight={updateButtonFocus.getNodeHandle() ?? lanButtonFocus.getNodeHandle() ?? undefined}
                    nextFocusDown={getSourceHandle(nextSourceId) ?? undefined}
                  >
                    <View style={styles.sourceRow}>
                      <View style={styles.sourceInfo}>
                        <TVText variant="cardTitle" numberOfLines={1}>{src.name}</TVText>
                        <TVText variant="caption" style={styles.line} numberOfLines={1}>{src.desc ?? (src.id || tvText.defaultSource)}</TVText>
                      </View>
                      <TVText variant="caption" color={active ? tvColors.primaryHigh : tvColors.subtext}>{active ? `${tvText.currentUsing}${maxSupportedQuality ? `${dot}${qualityShortLabel(maxSupportedQuality)}` : ''}` : src.status ?? ''}</TVText>
                    </View>
                  </Focusable>
                </View>
              )
            })}
          </ScrollView>
        </TVSettingsPane>

        <ScrollView ref={rightScrollRef} style={styles.rightColumn} showsVerticalScrollIndicator={false} contentContainerStyle={styles.rightContent}>
          <TVSettingsPane title="播放" subtitle="音乐音质 · 能高则高，自动降档" style={styles.playPanel}>
            <Focusable
              ref={qualityButtonFocus.ref as any}
              style={styles.qualityItem}
              onPress={showQualityPicker}
              nextFocusLeft={firstSourceFocus.getNodeHandle() ?? undefined}
              nextFocusDown={updateButtonFocus.getNodeHandle() ?? undefined}
            >
              <View style={styles.sourceRow}>
                <View style={styles.sourceInfo}>
                  <TVText variant="cardTitle" numberOfLines={1}>音乐音质</TVText>
                  <TVText variant="caption" style={styles.line} numberOfLines={1}>逐首自动匹配 · 不支持自动降档 · 失败换源</TVText>
                </View>
                <TVText variant="caption" color={tvColors.primaryHigh}>{qualityLabel(playQuality)}</TVText>
              </View>
            </Focusable>
          </TVSettingsPane>

          <TVSettingsPane title={tvText.appUpdate} subtitle={tvText.appUpdateDesc} style={styles.updatePanel}>
            <View style={styles.updateMeta}>
              <TVText variant="caption" color={tvColors.subtext} numberOfLines={1}>{tvText.currentVersion}{dot}v{TV_CURRENT_VERSION}</TVText>
              {updateInfo ? <TVText variant="caption" color={tvColors.primaryHigh} numberOfLines={1}>{tvText.latestVersion}{dot}v{updateInfo.version}</TVText> : null}
              {updateInfo ? <TVText variant="caption" color={tvColors.subtext} numberOfLines={1}>{tvText.updatePackage}{dot}{updateInfo.asset.abi}{dot}{formatUpdateSize(updateInfo.asset.size)}</TVText> : null}
              {updateProgressText ? <TVText variant="caption" color={tvColors.subtext} numberOfLines={1}>{tvText.downloadProgress}{dot}{updateProgressText}</TVText> : null}
            </View>
            <TVButton ref={updateButtonFocus.ref as any} label={updateButtonLabel} tone={updateStatus === 'available' || updateStatus === 'downloaded' ? 'primary' : 'dark'} onPress={() => { void handleUpdatePress() }} nextFocusUp={qualityButtonFocus.getNodeHandle() ?? undefined} nextFocusLeft={firstSourceFocus.getNodeHandle() ?? undefined} nextFocusDown={lanButtonFocus.getNodeHandle() ?? undefined} />
            <TVText variant="caption" color={updateStatus === 'error' ? tvColors.warn : tvColors.primaryHigh} style={styles.message}>{updateMessage || tvText.installConfirmTip}</TVText>
          </TVSettingsPane>

          <TVSettingsPane title={tvText.importApi} subtitle={tvText.inputRemoteApi} style={styles.importPanel}>
            {importMessage ? <TVText variant="caption" color={importMessage === tvText.importSuccess ? tvColors.primaryHigh : tvColors.warn} style={styles.message}>{importMessage}</TVText> : null}
            {/* 手机互联会话状态行：二维码收起后手机页仍在连接（会话是全局单例，v1.9.25） */}
            <View style={[styles.lanResult, tvLanSession.running ? styles.lanResultOk : null]}>
              <TVText variant="body" color={tvLanSession.running ? tvColors.primaryHigh : tvColors.subtext}>
                {tvLanSession.running ? '手机互联运行中 · 收起二维码不断开' : '未连接 · 按 OK 打开二维码，手机扫码操作'}
              </TVText>
            </View>
            <TVButton
              ref={lanButtonFocus.ref as any}
              label={lanRunning ? '收起二维码' : tvLanSession.running ? '查看二维码 · 互联运行中' : '手机扫码导入'}
              tone={tvLanSession.running ? 'primary' : 'dark'}
              onPress={() => { void (lanRunning ? handleCloseLanImport() : handleOpenLanImport()) }}
              onLongPress={tvLanSession.running ? handleStopLanSession : undefined}
              nextFocusUp={updateButtonFocus.getNodeHandle() ?? undefined}
              nextFocusLeft={firstSourceFocus.getNodeHandle() ?? undefined}
            />
            {tvLanSession.running ? <TVText variant="caption" color={tvColors.dimText} style={styles.message}>长按此按钮可关闭手机互联</TVText> : null}
          </TVSettingsPane>
        </ScrollView>
      </View>
      {/* 手机侧操作的结果弹窗统一走全局 showTVDialog（本页 Host 渲染），
          避免局部弹窗与其他全局弹窗叠加、双弹窗同时吃按键 */}
      {qrImage ? (
        <View style={styles.qrOverlay} pointerEvents="none">
          <View style={styles.qrCard}>
            <Image source={{ uri: qrImage }} style={styles.qrBigImage} />
          </View>
          <TVText variant="body" style={styles.qrOverlayHint}>手机扫码打开页面，可导入音源/歌单、新建歌单、配置数据同步</TVText>
          <TVText variant="caption" style={styles.qrUrlText} numberOfLines={2}>{qrUrl}</TVText>
          <TVText variant="caption" color={tvColors.warn} style={styles.qrOverlayHint}>⚠ 手机与电视需同一局域网 · 按 OK 或返回键收起二维码（手机页保持连接，断开请到设置页长按按钮）</TVText>
        </View>
      ) : null}
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
  playPanel: { minHeight: tvSize(160) },
  qualityItem: { borderRadius: tvSize(24), backgroundColor: 'rgba(255,255,255,0.075)', borderWidth: 1, borderColor: tvColors.border, padding: tvSize(18) },
  updatePanel: { minHeight: tvSize(270) },
  updateMeta: { gap: tvSize(8), marginBottom: tvSize(18) },
  importPanel: { flex: 1 },
  line: { marginTop: tvSize(9) },
  message: { marginTop: tvSize(14) },
  // 手机扫码结果框：放在按钮上方，带边框与底色，保证不用滚动就能看到
  lanResult: { marginTop: tvSize(14), marginBottom: tvSize(14), paddingVertical: tvSize(12), paddingHorizontal: tvSize(16), borderRadius: tvSize(12), borderWidth: 1 },
  lanResultOk: { backgroundColor: 'rgba(255,255,255,0.06)', borderColor: tvColors.primaryHigh },
  lanResultWarn: { backgroundColor: 'rgba(241,195,109,0.10)', borderColor: tvColors.warn },
  // 二维码居中弹层：全屏遮罩 + 中央白卡（此前嵌在右栏里被其他 UI 遮住一部分，扫不了码）
  qrOverlay: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(2,3,8,0.92)', alignItems: 'center', justifyContent: 'center', zIndex: 900, elevation: 40, gap: tvSize(18), paddingHorizontal: tvSize(80) },
  qrCard: { backgroundColor: '#FFFFFF', borderRadius: tvSize(24), padding: tvSize(28), elevation: 50 },
  qrBigImage: { width: tvSize(420), height: tvSize(420) },
  qrOverlayHint: { textAlign: 'center' },
  qrUrlText: { textAlign: 'center', color: 'rgba(247,248,251,0.72)', marginTop: tvSize(6) },
}

export default memo(TVSettings)
