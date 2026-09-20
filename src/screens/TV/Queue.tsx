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
import { useMyList } from '@/store/list/hook'
import { getUserLists } from '@/utils/listManage'
import listState from '@/store/list/state'
import { useSettingValue } from '@/store/setting/hook'
import { clearListMusics, removeListMusics, addListMusics, getListMusics } from '@/core/list'
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
  const addAllFocus = useTVFocusRef()
  const firstQueueFocus = useTVFocusRef()
  const activeTabFocus = useRef<FocusNode>(null)
  const tabRefresh = useTVFocusRefresh()
  const getActiveTabHandle = () => (activeTabFocus.current ? findNodeHandle(activeTabFocus.current) : null)
  const listRef = useRef<FlatList<LX.Music.MusicInfo>>(null)
  const queueRefs = useRef<FocusRefMap>({})
  const [localDialog, setLocalDialog] = useState<TVDialogRequest | null>(null)

  // 加歌到自建歌单：前后快照对比，如实区分「新加 / 已存在 / 未写入」。
  // 注：musicInfos/label 必须走参数传入（旧版从 songlistDialog 状态里取，
  // 但那个状态在弹窗改为 localDialog 后已无人写入，守卫直接 return →
  // 按 OK 变成完全空操作、连结果弹窗都没有，09-20 老板实测发现）
  const handleAddToSonglist = async(listId: string, musicInfos: LX.Music.MusicInfo[], label: string) => {
    try {
      const before = await getListMusics(listId)
      const beforeIds = new Set(before.map(m => m.id))
      const alreadyCount = musicInfos.filter(m => beforeIds.has(m.id)).length
      await addListMusics(listId, musicInfos, 'new')
      const after = await getListMusics(listId)
      const afterIds = new Set(after.map(m => m.id))
      const newlyLanded = musicInfos.filter(m => afterIds.has(m.id) && !beforeIds.has(m.id)).length
      if (newlyLanded === 0 && alreadyCount === musicInfos.length) {
        showLocalDialog({
          title: '无需重复添加',
          message: `「${label}」的 ${musicInfos.length} 首都已在这个歌单里（现共 ${after.length} 首）`,
          buttons: [{ label: '确定', tone: 'primary' }],
        })
        return
      }
      if (newlyLanded + alreadyCount < musicInfos.length) {
        showLocalDialog({
          title: '部分未写入',
          message: `${musicInfos.length - newlyLanded - alreadyCount} 首未写入，歌单现共 ${after.length} 首，可到「我的歌单」核对`,
          buttons: [{ label: '确定', tone: 'primary' }],
        })
        return
      }
      showLocalDialog({
        title: '添加成功',
        message: `已添加 ${newlyLanded} 首${alreadyCount ? `（${alreadyCount} 首已存在跳过）` : ''}，歌单现共 ${after.length} 首`,
        buttons: [{ label: '确定', tone: 'primary' }],
      })
    } catch (err) {
      showLocalDialog({
        title: '添加失败',
        message: err instanceof Error ? err.message : '未知错误',
        buttons: [{ label: '确定', tone: 'primary' }],
      })
    }
  }

  const openSonglistPicker = async(musicInfos: LX.Music.MusicInfo[], label: string) => {
    try {
      const lists = await getUserLists()
      if (!lists.length) {
        showLocalDialog({
          title: '暂无歌单',
          message: '还没有自建歌单。请先在歌单导入或手机页创建歌单。',
          buttons: [{ label: '确定', tone: 'primary' }],
        })
        return
      }
      // 只展示最近创建的几个：弹窗按钮太多难选；自动命名的歌单名几乎一样，
      // 按钮里必须带歌曲数才能分出哪张是哪张（老板 09-19 实测：加完歌不知道加到哪张了）
      const maxButtons = 5
      const start = Math.max(0, lists.length - maxButtons)
      const visible = lists.slice(start)
      const counted = await Promise.all(visible.map(async(list) => ({
        id: list.id,
        name: list.name,
        count: (await getListMusics(list.id)).length,
      })))
      showLocalDialog({
        title: '选择要添加到的歌单',
        message: `将「${label}」${musicInfos.length > 1 ? `（${musicInfos.length} 首）` : ''}添加到：${lists.length > visible.length ? `（共 ${lists.length} 个歌单，仅列出最近的 ${visible.length} 个）` : ''}`,
        buttons: [
          ...counted.map(item => ({
            label: `${item.name}（${item.count} 首）`,
            tone: 'primary' as const,
            onPress: () => { void handleAddToSonglist(item.id, musicInfos, label) },
          })),
          { label: '取消', tone: 'dark' as const },
        ],
      })
    } catch {
      showLocalDialog({
        title: '获取歌单失败',
        message: '无法读取歌单列表',
        buttons: [{ label: '确定', tone: 'primary' }],
      })
    }
  }

  // 页面挂载后补一次延迟刷新，确保所有按钮/行的 nextFocus 句柄就位（
  // 首次渲染时 ref 为空 → getNodeHandle 返回 null → nextFocusUp 为 undefined → 引擎找不到目标）
  const mountRefreshRef = useRef(false)
  useEffect(() => {
    if (mountRefreshRef.current) return
    mountRefreshRef.current = true
    const timer = setTimeout(() => tabRefresh(), 350)
    return () => { clearTimeout(timer) }
  }, [tabRefresh])

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
      title: item.name ?? '未知歌曲',
      message: '选择要执行的操作',
      buttons: [
        { label: '加入我的歌单', tone: 'primary', onPress: () => { void openSonglistPicker([item], item.name ?? '未知歌曲') } },
        { label: '从播放列表删除', tone: 'danger', onPress: () => { void removeListMusics(LIST_IDS.TEMP, [item.id]) } },
        { label: '取消', tone: 'dark' },
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

  // 队列的出处：从「我的歌单」播进来的话，tempListMeta.id 就是那个歌单的 id。
  // 显示出来用户才能确认「我现在放的到底是不是我那张歌单」。
  const myLists = useMyList()
  const queueSourceName = myLists.find(l => l.id === listState.tempListMeta.id)?.name
  const queueHint = `${queueSourceName ? `${tvText.queueFromSonglist}「${queueSourceName}」 · ` : ''}OK 播放歌曲 · 长按 OK 加入歌单/删除`

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
              <TVButton ref={playModeFocus.ref as any} label={`模式: ${playModeLabel}`} tone="dark" onPress={handleCyclePlayMode} hasTVPreferredFocus nextFocusUp={getActiveTabHandle() ?? undefined} nextFocusRight={addAllFocus.getNodeHandle() ?? undefined} />
              <TVButton ref={addAllFocus.ref as any} label="全部加入歌单" tone={fetchedMusicList.length ? 'ghost' : 'dark'} onPress={() => { void openSonglistPicker(fetchedMusicList, `播放列表全部 ${fetchedMusicList.length} 首`) }} nextFocusUp={getActiveTabHandle() ?? undefined} nextFocusLeft={playModeFocus.getNodeHandle() ?? undefined} nextFocusRight={clearFocus.getNodeHandle() ?? undefined} />
              <TVButton ref={clearFocus.ref as any} label={tvText.clearList} tone={fetchedMusicList.length ? 'ghost' : 'dark'} onPress={handleClear} nextFocusUp={getActiveTabHandle() ?? undefined} nextFocusLeft={addAllFocus.getNodeHandle() ?? undefined} />
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
              <TVText variant="caption" color={tvColors.dimText} style={styles.hint}>{queueHint}</TVText>
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
