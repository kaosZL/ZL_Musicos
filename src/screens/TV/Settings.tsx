import { memo, useEffect, useMemo, useRef, useState, type ComponentRef, type MutableRefObject } from 'react'
import { Alert, Image, ScrollView, TextInput, View, findNodeHandle, type TextInputProps, type TextStyle, type ViewStyle } from 'react-native'
import TVAppleScaffold from '@/components/TV/TVAppleScaffold'
import TVTopTabs from '@/components/TV/TVTopTabs'
import TVText from '@/components/TV/TVText'
import TVButton from '@/components/TV/TVButton'
import TVSettingsPane from '@/components/TV/TVSettingsPane'
import Focusable from '@/components/TV/Focusable'
import { tvColors, tvFont, tvSize } from '@/theme/tv'
import { useSettingValue } from '@/store/setting/hook'
import { usePlayerMusicInfo } from '@/store/player/hook'
import { useStatus, useUserApiList } from '@/store/userApi/hook'
import apiSourceInfo from '@/utils/musicSdk/api-source-info'
import { setApiSource } from '@/core/apiSource'
import { updateSetting } from '@/core/common'
import { httpFetch } from '@/utils/request'
import { generateQRCodeBase64, onLanSourceEvent, pushLanSources, startLanImportServer, stopLanImportServer } from '@/utils/nativeModules/utils'
import { importUserApi, removeUserApi, setUserApiAllowShowUpdateAlert } from '@/core/userApi'
import { TV_PRESET_USER_API_CANDIDATES } from '@/config/tvPresetUserApi'
import { useTVFocusRef } from '@/components/TV/useTVFocusRef'
import { useTVFocusRefresh } from '@/components/TV/useTVFocusRefresh'
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
type TVTextInputProps = TextInputProps & {
  nextFocusUp?: number
  nextFocusDown?: number
  nextFocusLeft?: number
  nextFocusRight?: number
}
const TVTextInput = TextInput as React.ComponentType<TVTextInputProps & { ref?: React.Ref<ComponentRef<typeof TextInput>> }>

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
  const [importUrl, setImportUrl] = useState('')
  const [importing, setImporting] = useState(false)
  const [importMessage, setImportMessage] = useState('')
  const [updateStatus, setUpdateStatus] = useState<TVUpdateStatus>('idle')
  const [updateInfo, setUpdateInfo] = useState<TVUpdateInfo | null>(null)
  const [updateProgress, setUpdateProgress] = useState({ total: 0, current: 0 })
  const [updateMessage, setUpdateMessage] = useState('')
  const firstSourceFocus = useTVFocusRef()
  const updateButtonFocus = useTVFocusRef()
  const importButtonFocus = useTVFocusRef()
  const sourceRefs = useRef<FocusRefMap>({})
  const sourceOpAlertButtonFocus = useTVFocusRef()
  const sourceOpRemoveButtonFocus = useTVFocusRef()
  const [focusedSourceId, setFocusedSourceId] = useState('')
  const inputRef = useRef<ComponentRef<typeof TextInput>>(null)
  const [qrImage, setQrImage] = useState('')
  const [lanRunning, setLanRunning] = useState(false)
  const [lanMessage, setLanMessage] = useState('')
  const lanButtonFocus = useTVFocusRef()
  const lanHandlerRef = useRef<((action: string, payload: string) => void) | null>(null)
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
  const getInputHandle = () => inputRef.current ? findNodeHandle(inputRef.current) : null
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

  const handleImport = async() => {
    const url = importUrl.trim()
    if (!/^https?:\/\//.test(url)) {
      setImportMessage(tvText.invalidUrl)
      return
    }
    setImporting(true)
    setImportMessage('')
    try {
      const script = await httpFetch(url).promise.then(resp => resp.body) as string
      await importUserApi(script)
      setImportMessage(tvText.importSuccess)
      setImportUrl('')
    } catch (err: unknown) {
      setImportMessage(err instanceof Error ? err.message : tvText.removeFailed)
    } finally {
      setImporting(false)
    }
  }

  const pushLanSourcesSnapshot = () => {
    try {
      pushLanSources(JSON.stringify({
        sources: allSources.map(src => ({ id: src.id, name: src.name, active: apiSource === src.id, isUser: userApiById.has(src.id) })),
      }))
    } catch (err: unknown) {
      // 快照推送失败静默忽略
    }
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
        setLanMessage('手机导入成功')
      } else if (action === 'remove') {
        const data = JSON.parse(payload || '{}') as { id?: string }
        if (data.id) await handleRemove(data.id)
      } else if (action === 'activate') {
        const data = JSON.parse(payload || '{}') as { id?: string }
        if (data.id) setApiSource(data.id)
      }
    } catch (err: unknown) {
      setLanMessage(err instanceof Error ? err.message : '手机操作失败')
    }
  }
  lanHandlerRef.current = (action: string, payload: string) => { void handleLanSourceEvent(action, payload) }

  useEffect(() => {
    if (!lanRunning) return
    pushLanSourcesSnapshot()
    return onLanSourceEvent((event) => { void lanHandlerRef.current?.(event.action, event.payload) })
  }, [lanRunning, allSources, apiSource, userApiById])

  const handleOpenLanImport = async() => {
    setLanMessage('')
    try {
      const { ip, port } = await startLanImportServer(9527)
      const qr = await generateQRCodeBase64(`http://${ip}:${port}`, 560)
      setQrImage(qr)
      setLanRunning(true)
      pushLanSourcesSnapshot()
      setTimeout(() => { rightScrollRef.current?.scrollToEnd({ animated: true }) }, 300)
    } catch (err: unknown) {
      setLanMessage(err instanceof Error ? err.message : '启动失败')
    }
  }

  const handleCloseLanImport = () => {
    stopLanImportServer()
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

  const focusedUserApi = userApiById.get(focusedSourceId)
  const focusedSourceName = allSources.find(item => item.id === focusedSourceId)?.name ?? ''

  const handleToggleAlertOp = () => {
    if (!focusedUserApi) {
      setImportMessage('更新提醒仅适用于用户导入的音源，请先选中用户音源')
      return
    }
    if (!focusedUserApi.allowShowUpdateAlert) {
      Alert.alert('开启更新提醒', '好处：音源接口失效后，作者发布新版时你会第一时间收到弹窗提醒，可及时更新修复。\n\n代价：偶尔会有弹窗打扰。\n\n确定要开启吗？', [
        { text: '取消', style: 'cancel' },
        { text: '开启', onPress: () => { void handleToggleUpdateAlert(focusedUserApi.id, true) } },
      ])
    } else {
      void handleToggleUpdateAlert(focusedUserApi.id, false)
    }
  }

  const removePresetOrBuiltinSource = (id: string) => {
    updateSetting({ 'common.tvRemovedSources': [...(removedSources ?? []), id] })
    if (apiSource === id) setApiSource('')
    setFocusedSourceId('')
    setImportMessage('已删除该音源')
  }

  const doRemoveSource = async(id: string) => {
    if (userApiById.has(id)) {
      await handleRemove(id)
      return
    }
    removePresetOrBuiltinSource(id)
  }

  const handleRemoveFocusedSource = () => {
    const id = focusedSourceId
    if (!id) {
      setImportMessage('聚合音源不可删除')
      return
    }
    if (apiSource === id) {
      Alert.alert('删除正在使用的音源', `「${focusedSourceName}」正在使用中。\n删除后将自动切换到聚合音源，当前歌曲会继续播放完，之后的搜索/播放都走聚合音源。\n\n确定删除吗？`, [
        { text: '取消', style: 'cancel' },
        { text: '删除', style: 'destructive', onPress: () => { void doRemoveSource(id) } },
      ])
      return
    }
    void doRemoveSource(id)
  }

  return (
    <TVAppleScaffold image={musicInfo.pic}>
      <TVTopTabs items={createTVTabs(componentId)} activeId="settings" subtitle={tvText.settings} nextFocusDown={firstSourceFocus.getNodeHandle() ?? undefined} />
      <View style={styles.root}>
        <TVSettingsPane title={`${tvText.source}${dot}${tvText.userApi}`} subtitle={tvText.sourceSettingsDesc} style={styles.sourcePanel}>
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
                    onFocus={() => { handleSourceItemFocus(focusKey); setFocusedSourceId(src.id) }}
                    onPress={() => { setApiSource(src.id); setFocusedSourceId(src.id) }}
                    hasTVPreferredFocus={index === 0}
                    nextFocusUp={getSourceHandle(prevSourceId) ?? undefined}
                    nextFocusRight={updateButtonFocus.getNodeHandle() ?? getInputHandle() ?? importButtonFocus.getNodeHandle() ?? undefined}
                    nextFocusDown={getSourceHandle(nextSourceId) ?? sourceOpAlertButtonFocus.getNodeHandle() ?? undefined}
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
          <View style={styles.sourceOps}>
            <TVText variant="caption" color={tvColors.subtext} numberOfLines={1}>{focusedSourceName ? `已选中：${focusedSourceName}` : '用方向键选中音源后可操作'}</TVText>
            <View style={styles.sourceOpsRow}>
              <TVButton ref={sourceOpAlertButtonFocus.ref as any} label={focusedUserApi?.allowShowUpdateAlert ? '关闭更新提醒' : '开启更新提醒'} tone="dark" onPress={() => { handleToggleAlertOp() }} nextFocusUp={getSourceHandle(allSources[allSources.length - 1]?.id) ?? undefined} nextFocusRight={sourceOpRemoveButtonFocus.getNodeHandle() ?? undefined} />
              <TVButton ref={sourceOpRemoveButtonFocus.ref as any} label="删除音源" tone="ghost" onPress={() => { handleRemoveFocusedSource() }} nextFocusUp={getSourceHandle(allSources[allSources.length - 1]?.id) ?? undefined} nextFocusLeft={sourceOpAlertButtonFocus.getNodeHandle() ?? undefined} />
            </View>
          </View>
        </TVSettingsPane>

        <ScrollView ref={rightScrollRef} style={styles.rightColumn} showsVerticalScrollIndicator={false} contentContainerStyle={styles.rightContent}>
          <TVSettingsPane title={tvText.appUpdate} subtitle={tvText.appUpdateDesc} style={styles.updatePanel}>
            <View style={styles.updateMeta}>
              <TVText variant="caption" color={tvColors.subtext} numberOfLines={1}>{tvText.currentVersion}{dot}v{TV_CURRENT_VERSION}</TVText>
              {updateInfo ? <TVText variant="caption" color={tvColors.primaryHigh} numberOfLines={1}>{tvText.latestVersion}{dot}v{updateInfo.version}</TVText> : null}
              {updateInfo ? <TVText variant="caption" color={tvColors.subtext} numberOfLines={1}>{tvText.updatePackage}{dot}{updateInfo.asset.abi}{dot}{formatUpdateSize(updateInfo.asset.size)}</TVText> : null}
              {updateProgressText ? <TVText variant="caption" color={tvColors.subtext} numberOfLines={1}>{tvText.downloadProgress}{dot}{updateProgressText}</TVText> : null}
            </View>
            <TVButton ref={updateButtonFocus.ref as any} label={updateButtonLabel} tone={updateStatus === 'available' || updateStatus === 'downloaded' ? 'primary' : 'dark'} onPress={() => { void handleUpdatePress() }} nextFocusLeft={firstSourceFocus.getNodeHandle() ?? undefined} nextFocusDown={getInputHandle() ?? importButtonFocus.getNodeHandle() ?? undefined} />
            <TVText variant="caption" color={updateStatus === 'error' ? tvColors.warn : tvColors.primaryHigh} style={styles.message}>{updateMessage || tvText.installConfirmTip}</TVText>
          </TVSettingsPane>

          <TVSettingsPane title={tvText.importApi} subtitle={tvText.inputRemoteApi} style={styles.importPanel}>
            <TVTextInput ref={inputRef} value={importUrl} onChangeText={setImportUrl} placeholder="https://.../source.js" placeholderTextColor={tvColors.dimText} style={styles.input} nextFocusUp={updateButtonFocus.getNodeHandle() ?? undefined} nextFocusLeft={firstSourceFocus.getNodeHandle() ?? undefined} nextFocusDown={importButtonFocus.getNodeHandle() ?? undefined} />
            <TVButton ref={importButtonFocus.ref as any} label={importing ? tvText.importing : tvText.import} tone="dark" onPress={() => { void handleImport() }} nextFocusUp={getInputHandle() ?? updateButtonFocus.getNodeHandle() ?? undefined} nextFocusLeft={firstSourceFocus.getNodeHandle() ?? undefined} />
            {importMessage ? <TVText variant="caption" color={importMessage === tvText.importSuccess ? tvColors.primaryHigh : tvColors.warn} style={styles.message}>{importMessage}</TVText> : null}
            <TVButton ref={lanButtonFocus.ref as any} label={lanRunning ? '关闭二维码' : '手机扫码导入'} tone={lanRunning ? 'danger' : 'dark'} onPress={() => { void (lanRunning ? handleCloseLanImport() : handleOpenLanImport()) }} nextFocusUp={importButtonFocus.getNodeHandle() ?? updateButtonFocus.getNodeHandle() ?? undefined} nextFocusLeft={firstSourceFocus.getNodeHandle() ?? undefined} />
            {qrImage ? (
              <View style={styles.qrWrap}>
                <Image source={{ uri: qrImage }} style={styles.qrImage} />
                <TVText variant="caption" color={tvColors.subtext} style={styles.line}>手机扫码打开导入页，粘贴源链接或脚本导入</TVText>
                <TVText variant="caption" color={tvColors.warn} style={styles.line}>⚠ 请确保手机与电视连接同一局域网（WiFi）</TVText>
              </View>
            ) : null}
          </TVSettingsPane>
        </ScrollView>
      </View>
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
  sourceOps: { gap: tvSize(8), marginTop: tvSize(4), paddingTop: tvSize(10), borderTopWidth: 1, borderTopColor: tvColors.border },
  sourceOpsRow: { flexDirection: 'row', gap: tvSize(12) },
  rightColumn: { width: tvSize(430), flexShrink: 0 },
  rightContent: { gap: tvSize(18), paddingBottom: tvSize(20) },
  updatePanel: { minHeight: tvSize(270) },
  updateMeta: { gap: tvSize(8), marginBottom: tvSize(18) },
  importPanel: { flex: 1 },
  input: { minHeight: tvSize(58), color: tvColors.text, backgroundColor: 'rgba(255,255,255,0.085)', borderRadius: tvSize(22), paddingHorizontal: tvSize(18), fontSize: tvFont(18), borderWidth: 1, borderColor: tvColors.border, marginBottom: tvSize(14) },
  line: { marginTop: tvSize(9) },
  message: { marginTop: tvSize(14) },
  qrWrap: { alignItems: 'center', gap: tvSize(12), marginTop: tvSize(14) },
  qrImage: { width: tvSize(320), height: tvSize(320), backgroundColor: '#FFFFFF', borderRadius: tvSize(16) },
}

export default memo(TVSettings)
