import { memo, useMemo, useRef, useState, type ComponentRef, type MutableRefObject } from 'react'
import { ScrollView, TextInput, View, findNodeHandle, type TextInputProps, type TextStyle, type ViewStyle } from 'react-native'
import TVAppleScaffold from '@/components/TV/TVAppleScaffold'
import TVTopTabs from '@/components/TV/TVTopTabs'
import TVText from '@/components/TV/TVText'
import TVButton from '@/components/TV/TVButton'
import TVSettingsPane from '@/components/TV/TVSettingsPane'
import Focusable from '@/components/TV/Focusable'
import { tvColors } from '@/theme/tv'
import { useSettingValue } from '@/store/setting/hook'
import { usePlayerMusicInfo } from '@/store/player/hook'
import { useStatus, useUserApiList } from '@/store/userApi/hook'
import apiSourceInfo from '@/utils/musicSdk/api-source-info'
import { setApiSource } from '@/core/apiSource'
import { httpFetch } from '@/utils/request'
import { importUserApi, removeUserApi, setUserApiAllowShowUpdateAlert } from '@/core/userApi'
import { TV_PRESET_USER_API_CANDIDATES } from '@/config/tvPresetUserApi'
import { useTVFocusRef } from '@/components/TV/useTVFocusRef'
import { pushTVPlayerScreen } from '@/navigation/navigation'
import { useTVNavigationBack } from '@/utils/hooks/useTVNavigationBack'
import { useTVRemoteActions } from '@/utils/hooks/useTVRemoteActions'
import { dot, tvText } from './labels'
import { createTVTabs, getSourceName } from './utils'

interface SourceItem {
  id: string
  name: string
  desc?: string
  status?: string
}

type FocusNode = ComponentRef<typeof Focusable> | null
type FocusRefMap = Record<string, FocusNode>
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

function TVSettings({ componentId }: { componentId: string }) {
  const apiSource = useSettingValue('common.apiSource')
  const musicInfo = usePlayerMusicInfo()
  const userApiList = useUserApiList()
  const apiStatus = useStatus()
  const [importUrl, setImportUrl] = useState('')
  const [importing, setImporting] = useState(false)
  const [importMessage, setImportMessage] = useState('')
  const firstSourceFocus = useTVFocusRef()
  const importButtonFocus = useTVFocusRef()
  const sourceRefs = useRef<FocusRefMap>({})
  const alertRefs = useRef<FocusRefMap>({})
  const removeRefs = useRef<FocusRefMap>({})
  const inputRef = useRef<ComponentRef<typeof TextInput>>(null)
  const sourceScrollRef = useRef<ComponentRef<typeof ScrollView>>(null)
  const sourceLayoutRef = useRef<Record<string, number>>({})

  useTVNavigationBack(componentId)
  useTVRemoteActions({ playPause: () => { if (musicInfo.id) pushTVPlayerScreen(componentId) } })

  const defaultSources = useMemo<SourceItem[]>(() => apiSourceInfo.map(item => ({
    id: item.id,
    name: getSourceName(item.id) || item.name,
    desc: item.disabled ? tvText.unavailable : tvText.builtinSource,
    status: item.disabled ? tvText.unavailable : tvText.available,
  })), [])

  const presetSources = useMemo<SourceItem[]>(() => TV_PRESET_USER_API_CANDIDATES.map(item => ({
    id: item.id,
    name: getSourceName(item.id),
    desc: `TV ${tvText.preset}${tvText.userApi}`,
    status: apiSource === item.id ? (apiStatus.status ? tvText.loaded : apiStatus.message === 'initing' ? tvText.loading : tvText.loadFailed) : tvText.preset,
  })), [apiSource, apiStatus.message, apiStatus.status])

  const baseSources = useMemo<SourceItem[]>(() => ([
    { id: '', name: tvText.aggregateSource, desc: tvText.sourceSettingsDesc, status: tvText.available },
    ...presetSources,
    ...defaultSources,
  ]), [defaultSources, presetSources])

  const userApiById = useMemo(() => new Map(userApiList.map(item => [item.id, item])), [userApiList])
  const allSources = useMemo<SourceItem[]>(() => [
    ...baseSources,
    ...userApiList.map(item => ({
      id: item.id,
      name: item.name,
      desc: item.version ? `${tvText.userApi}${dot}v${item.version}` : tvText.userApi,
      status: apiSource === item.id ? (apiStatus.status ? tvText.loaded : apiStatus.message === 'initing' ? tvText.loading : tvText.loadFailed) : '',
    })),
  ], [apiSource, apiStatus.message, apiStatus.status, baseSources, userApiList])

  const bindFocusRef = (mapRef: MutableRefObject<FocusRefMap>, key: string, syncFirstSource = false) => (node: FocusNode) => {
    mapRef.current[key] = node
    if (syncFirstSource) firstSourceFocus.ref.current = node as any
  }
  const getInputHandle = () => inputRef.current ? findNodeHandle(inputRef.current) : null
  const getSourceHandle = (id?: string | null) => getHandleFromMap(sourceRefs, id ? getFocusKey(id) : null)
  const getAlertHandle = (id?: string | null) => getHandleFromMap(alertRefs, id ? getFocusKey(id) : null)
  const getRemoveHandle = (id?: string | null) => getHandleFromMap(removeRefs, id ? getFocusKey(id) : null)

  const handleSourceItemFocus = (key: string) => {
    const targetY = sourceLayoutRef.current[key]
    if (targetY == null) return
    sourceScrollRef.current?.scrollTo({ y: Math.max(0, targetY - 24), animated: true })
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

  const handleRemove = async(id: string) => {
    setImportMessage('')
    try {
      const removedIsActive = apiSource === id
      await removeUserApi([id])
      if (removedIsActive) {
        const fallbackId = apiSourceInfo.find(item => !item.disabled)?.id ?? userApiList.find(item => item.id !== id)?.id ?? ''
        setApiSource(fallbackId)
      }
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

  return (
    <TVAppleScaffold image={musicInfo.pic}>
      <TVTopTabs items={createTVTabs(componentId)} activeId="settings" subtitle={tvText.settings} />
      <View style={styles.root}>
        <TVSettingsPane title={`${tvText.source}${dot}${tvText.userApi}`} subtitle={tvText.sourceSettingsDesc} style={styles.sourcePanel}>
          <ScrollView ref={sourceScrollRef} showsVerticalScrollIndicator={false} contentContainerStyle={styles.sourceContent}>
            {allSources.map((src, index) => {
              const focusKey = getFocusKey(src.id)
              const prevSourceId = allSources[index - 1]?.id
              const nextSourceId = allSources[index + 1]?.id
              const userApi = userApiById.get(src.id)
              const active = apiSource === src.id
              return (
                <View key={focusKey} style={styles.sourceBlock} onLayout={event => { sourceLayoutRef.current[focusKey] = event.nativeEvent.layout.y }}>
                  <Focusable
                    ref={bindFocusRef(sourceRefs, focusKey, src.id === '') as any}
                    style={[styles.sourceItem, active ? styles.sourceActive : null]}
                    onFocus={() => { handleSourceItemFocus(focusKey) }}
                    onPress={() => { setApiSource(src.id) }}
                    hasTVPreferredFocus={src.id === ''}
                    nextFocusUp={getSourceHandle(prevSourceId) ?? undefined}
                    nextFocusRight={getInputHandle() ?? importButtonFocus.getNodeHandle() ?? undefined}
                    nextFocusDown={userApi ? (getAlertHandle(src.id) ?? getSourceHandle(nextSourceId) ?? undefined) : (getSourceHandle(nextSourceId) ?? undefined)}
                  >
                    <View style={styles.sourceRow}>
                      <View style={styles.sourceInfo}>
                        <TVText variant="cardTitle" numberOfLines={1}>{src.name}</TVText>
                        <TVText variant="caption" style={styles.line} numberOfLines={1}>{src.desc ?? (src.id || tvText.defaultSource)}</TVText>
                      </View>
                      <TVText variant="caption" color={active ? tvColors.primaryHigh : tvColors.subtext}>{active ? tvText.currentUsing : src.status ?? ''}</TVText>
                    </View>
                  </Focusable>
                  {userApi ? (
                    <View style={styles.userApiActions}>
                      <TVButton ref={bindFocusRef(alertRefs, focusKey) as any} label={userApi.allowShowUpdateAlert ? tvText.closeUpdateAlert : tvText.openUpdateAlert} tone="dark" onFocus={() => { handleSourceItemFocus(focusKey) }} onPress={() => { void handleToggleUpdateAlert(src.id, !userApi.allowShowUpdateAlert) }} nextFocusUp={getSourceHandle(src.id) ?? undefined} nextFocusRight={getRemoveHandle(src.id) ?? undefined} nextFocusDown={getSourceHandle(nextSourceId) ?? undefined} />
                      <TVButton ref={bindFocusRef(removeRefs, focusKey) as any} label={tvText.delete} tone="danger" onFocus={() => { handleSourceItemFocus(focusKey) }} onPress={() => { void handleRemove(src.id) }} nextFocusUp={getSourceHandle(src.id) ?? undefined} nextFocusLeft={getAlertHandle(src.id) ?? undefined} nextFocusDown={getSourceHandle(nextSourceId) ?? undefined} />
                    </View>
                  ) : null}
                </View>
              )
            })}
          </ScrollView>
        </TVSettingsPane>

        <TVSettingsPane title={tvText.importApi} subtitle={tvText.inputRemoteApi} style={styles.importPanel}>
          <TVTextInput ref={inputRef} value={importUrl} onChangeText={setImportUrl} placeholder="https://.../source.js" placeholderTextColor={tvColors.dimText} style={styles.input} nextFocusLeft={firstSourceFocus.getNodeHandle() ?? undefined} nextFocusDown={importButtonFocus.getNodeHandle() ?? undefined} />
          <TVButton ref={importButtonFocus.ref as any} label={importing ? tvText.importing : tvText.import} onPress={() => { void handleImport() }} nextFocusUp={getInputHandle() ?? undefined} nextFocusLeft={firstSourceFocus.getNodeHandle() ?? undefined} />
          {importMessage ? <TVText variant="caption" color={importMessage === tvText.importSuccess ? tvColors.primaryHigh : tvColors.warn} style={styles.message}>{importMessage}</TVText> : null}
        </TVSettingsPane>
      </View>
    </TVAppleScaffold>
  )
}

const styles: Record<string, ViewStyle | TextStyle | any> = {
  root: { flex: 1, flexDirection: 'row', gap: 26 },
  sourcePanel: { flex: 1 },
  sourceContent: { paddingBottom: 20 },
  sourceBlock: { marginBottom: 12 },
  sourceItem: { borderRadius: 24, backgroundColor: 'rgba(255,255,255,0.075)', borderWidth: 1, borderColor: tvColors.border, padding: 18 },
  sourceActive: { backgroundColor: tvColors.primarySoft, borderColor: tvColors.primaryHigh },
  sourceRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 16 },
  sourceInfo: { flex: 1 },
  userApiActions: { flexDirection: 'row', gap: 12, marginTop: 10, marginLeft: 16 },
  importPanel: { width: 410, alignSelf: 'flex-start' },
  input: { minHeight: 58, color: tvColors.text, backgroundColor: 'rgba(255,255,255,0.085)', borderRadius: 22, paddingHorizontal: 18, fontSize: 18, borderWidth: 1, borderColor: tvColors.border, marginBottom: 14 },
  line: { marginTop: 9 },
  message: { marginTop: 14 },
}

export default memo(TVSettings)
