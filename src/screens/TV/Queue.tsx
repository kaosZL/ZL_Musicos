import { memo, useEffect, useRef, useState, type ComponentRef } from 'react'
import { FlatList, View, findNodeHandle, type TextStyle, type ViewStyle } from 'react-native'
import TVAppleScaffold from '@/components/TV/TVAppleScaffold'
import TVTopTabs from '@/components/TV/TVTopTabs'
import TVText from '@/components/TV/TVText'
import TVButton from '@/components/TV/TVButton'
import TVMusicRow from '@/components/TV/TVMusicRow'
import TVGlassPanel from '@/components/TV/TVGlassPanel'
import type Focusable from '@/components/TV/Focusable'
import { Alert } from 'react-native'
import TVDialog, { type TVDialogRequest } from '@/components/TV/TVDialog'
import { tvColors } from '@/theme/tv'
import { usePlayerMusicInfo } from '@/store/player/hook'
import { useSettingValue } from '@/store/setting/hook'
import { clearListMusics, removeListMusics } from '@/core/list'
import { playList } from '@/core/player/player'
import { LIST_IDS, MUSIC_TOGGLE_MODE_LIST } from '@/config/constant'
import { pushTVPlayerScreen } from '@/navigation/navigation'
import { updateSetting } from '@/core/common'
import { useTVNavigationBack } from '@/utils/hooks/useTVNavigationBack'
import { useTVRemoteActions } from '@/utils/hooks/useTVRemoteActions'
import { useTVFocusRef } from '@/components/TV/useTVFocusRef'
import { useTVFocusRefresh } from '@/components/TV/useTVFocusRefresh'
import { tvText } from './labels'
import { createTVTabs, getMusicSubtitle, getSourceName } from './utils'
import { useTVFetchedMusicList } from './useTVFetchedMusicList'

type FocusNode = ComponentRef<typeof Focusable> | null
type FocusRefMap = Record<string, FocusNode>
const ITEM_SIZE = 78

const PLAY_MODE_LABELS: Record<string, string> = {
  listLoop: '列表循环',
  random: '随机播放',
  list: '顺序播放',
  singleLoop: '单曲循环',
  none: '播完停止',
}

function TVQueue({ componentId }: { componentId: string }) {
  const currentMusicInfo = usePlayerMusicInfo()
  const fetchedMusicList = useTVFetchedMusicList()
  const playMode = useSettingValue('player.togglePlayMethod')
  const [selectedIndex, setSelectedIndex] = useState(0)
  const playModeFocus = useTVFocusRef()
  const clearFocus = useTVFocusRef()
  const firstQueueFocus = useTVFocusRef()
  const activeTabFocus = useRef<FocusNode>(null)
  const tabRefresh = useTVFocusRefresh()
  const getActiveTabHandle = () => (activeTabFocus.current ? findNodeHandle(activeTabFocus.current) : null)
  const listRef = useRef<FlatList<LX.Music.MusicInfo>>(null)
  const queueRefs = useRef<FocusRefMap>({})
  const [localDialog, setLocalDialog] = useState<TVDialogRequest | null>(null)
  useTVFocusRefresh()

  useTVNavigationBack(componentId)

  // 进入页面时自动滚动到当前播放歌曲
  useEffect(() => {
    if (!fetchedMusicList.length || !currentMusicInfo.id) return
    const playingIndex = fetchedMusicList.findIndex(m => m.id === currentMusicInfo.id)
    if (playingIndex >= 0) {
      setSelectedIndex(playingIndex)
      requestAnimationFrame(() => {
        listRef.current?.scrollToOffset({ offset: Math.max(0, playingIndex * ITEM_SIZE - ITEM_SIZE * 2), animated: false })
      })
    }
  }, [currentMusicInfo.id, fetchedMusicList])

  useEffect(() => {
    if (!fetchedMusicList.length) {
      setSelectedIndex(0)
      return
    }
    if (selectedIndex >= fetchedMusicList.length) setSelectedIndex(fetchedMusicList.length - 1)
  }, [selectedIndex, fetchedMusicList.length])

  const selectedMusicInfo = fetchedMusicList[selectedIndex] ?? null
  const getQueueItemKey = (item: LX.Music.MusicInfo, index: number) => `${item.id}_${index}`
  const getQueueHandle = (key?: string | null) => key && queueRefs.current[key] ? findNodeHandle(queueRefs.current[key]) : null
  const bindQueueRef = (key: string, syncFirst = false) => (node: FocusNode) => {
    queueRefs.current[key] = node
    if (syncFirst) firstQueueFocus.ref.current = node as any
  }

  const handleQueueFocus = (index: number) => {
    setSelectedIndex(index)
    listRef.current?.scrollToOffset({ offset: Math.max(0, index * ITEM_SIZE - ITEM_SIZE), animated: true })
  }

  const handlePlayNow = async(index: number) => {
    const item = fetchedMusicList[index]
    if (!item) return
    await playList(LIST_IDS.TEMP, index)
    pushTVPlayerScreen(componentId)
  }

  const showLocalDialog = (request: TVDialogRequest) => {
    setLocalDialog(request)
  }

  const handleRemoveMusic = (item: LX.Music.MusicInfo, index: number) => {
    showLocalDialog({
      title: '从播放列表删除',
      message: `确定删除「${item.name ?? '未知歌曲'}」吗？`,
      buttons: [
        { label: '取消', tone: 'dark' },
        { label: '删除', tone: 'danger', onPress: () => { void removeListMusics(LIST_IDS.TEMP, [item.id]) } },
      ],
    })
  }

  const handleClear = () => {
    showLocalDialog({
      title: '清空播放列表',
      message: `确定清空全部 ${fetchedMusicList.length} 首歌曲吗？`,
      buttons: [
        { label: '取消', tone: 'dark' },
        { label: '清空', tone: 'danger', onPress: () => { void clearListMusics([LIST_IDS.TEMP]) } },
      ],
    })
  }

  const handleCyclePlayMode = () => {
    const currentIndex = MUSIC_TOGGLE_MODE_LIST.indexOf(playMode)
    const nextIndex = (currentIndex + 1) % MUSIC_TOGGLE_MODE_LIST.length
    updateSetting({ 'player.togglePlayMethod': MUSIC_TOGGLE_MODE_LIST[nextIndex] })
  }

  const playModeLabel = PLAY_MODE_LABELS[playMode] ?? '列表循环'

  useTVRemoteActions({
    playPause: () => {
      if (currentMusicInfo.id) {
        pushTVPlayerScreen(componentId)
        return
      }
      if (selectedMusicInfo) void handlePlayNow(selectedIndex)
    },
  })

  return (
    <TVAppleScaffold image={currentMusicInfo.pic}>
      <TVTopTabs items={createTVTabs(componentId)} activeId="queue" nextFocusDown={firstQueueFocus.getNodeHandle() ?? playModeFocus.getNodeHandle() ?? undefined} activeTabRef={activeTabFocus} onActiveTabReady={tabRefresh} />
      <View style={styles.root}>
        <TVGlassPanel style={styles.listPanel}>
          <View style={styles.header}>
            <View>
              <TVText variant="pageTitle" style={styles.title}>播放列表</TVText>
              <TVText variant="body" style={styles.subtitle}>{fetchedMusicList.length} 首 · {playModeLabel}</TVText>
            </View>
            <View style={styles.actions}>
              <TVButton ref={playModeFocus.ref as any} label={`模式: ${playModeLabel}`} tone="dark" onPress={handleCyclePlayMode} hasTVPreferredFocus nextFocusUp={getActiveTabHandle() ?? undefined} nextFocusRight={clearFocus.getNodeHandle() ?? undefined} />
              <TVButton ref={clearFocus.ref as any} label={tvText.clearList} tone={fetchedMusicList.length ? 'ghost' : 'dark'} onPress={handleClear} nextFocusUp={getActiveTabHandle() ?? undefined} nextFocusLeft={playModeFocus.getNodeHandle() ?? undefined} />
            </View>
          </View>
          <FlatList
            ref={listRef}
            data={fetchedMusicList}
            showsVerticalScrollIndicator={false}
            keyExtractor={getQueueItemKey}
            removeClippedSubviews={false}
            contentContainerStyle={styles.listContent}
            ListEmptyComponent={<TVText variant="meta">{tvText.emptyQueueHint}</TVText>}
            ListHeaderComponent={fetchedMusicList.length ? (
              <TVText variant="caption" color={tvColors.dimText} style={styles.hint}>OK 播放歌曲 · 长按 OK 从列表删除</TVText>
            ) : null}
            renderItem={({ item, index }) => {
              const itemKey = getQueueItemKey(item, index)
              const prevKey = fetchedMusicList[index - 1] ? getQueueItemKey(fetchedMusicList[index - 1], index - 1) : null
              const nextKey = fetchedMusicList[index + 1] ? getQueueItemKey(fetchedMusicList[index + 1], index + 1) : null
              const isCurrentPlaying = currentMusicInfo.id === item.id
              return (
                <TVMusicRow
                  ref={bindQueueRef(itemKey, index === 0) as any}
                  index={index}
                  title={item.name ?? tvText.unknownSong}
                  subtitle={getMusicSubtitle(item)}
                  meta={item.interval ?? getSourceName(item.source)}
                  badge={isCurrentPlaying ? '▶ 正在播放' : undefined}
                  lazyMusicInfo={item}
                  active={isCurrentPlaying || selectedIndex === index}
                  onFocus={() => { handleQueueFocus(index) }}
                  onPress={() => { void handlePlayNow(index) }}
                  onLongPress={() => { handleRemoveMusic(item, index) }}
                  nextFocusUp={index === 0 ? playModeFocus.getNodeHandle() ?? undefined : getQueueHandle(prevKey) ?? undefined}
                  nextFocusDown={getQueueHandle(nextKey) ?? undefined}
                />
              )
            }}
          />
        </TVGlassPanel>
      </View>
      <TVDialog
        visible={!!localDialog}
        title={localDialog?.title ?? ''}
        message={localDialog?.message}
        buttons={localDialog?.buttons?.map(btn => ({
          ...btn,
          onPress: () => {
            setLocalDialog(null)
            btn.onPress?.()
          },
        })) ?? []}
        onDismiss={() => {
          localDialog?.onDismiss?.()
          setLocalDialog(null)
        }}
      />
    </TVAppleScaffold>
  )
}

const styles: Record<string, ViewStyle | TextStyle | any> = {
  root: { flex: 1 },
  listPanel: { flex: 1, paddingHorizontal: 34, paddingVertical: 30 },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14, gap: 24 },
  title: { fontSize: 48, lineHeight: 56 },
  subtitle: { marginTop: 8, color: tvColors.subtext },
  actions: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  hint: { marginBottom: 12, textAlign: 'center' },
  listContent: { paddingBottom: 28 },
}

export default memo(TVQueue)
