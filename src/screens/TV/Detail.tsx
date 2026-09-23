import { memo, useCallback, useEffect, useRef, useState, type ComponentRef } from 'react'
import { FlatList, View, findNodeHandle, type ImageStyle, type TextStyle, type ViewStyle } from 'react-native'
import TVAppleScaffold from '@/components/TV/TVAppleScaffold'
import TVTopTabs from '@/components/TV/TVTopTabs'
import TVText from '@/components/TV/TVText'
import TVButton from '@/components/TV/TVButton'
import TVMusicRow from '@/components/TV/TVMusicRow'
import TVGlassPanel from '@/components/TV/TVGlassPanel'
import TVDialog, { type TVDialogRequest } from '@/components/TV/TVDialog'
import { focusTVTargetByRef } from '@/components/TV/tvFocusManager'
import type Focusable from '@/components/TV/Focusable'
import Image from '@/components/common/Image'
import { tvColors, tvFont, tvSize } from '@/theme/tv'
import { pop } from '@/navigation'
import { pushTVPlayerScreen } from '@/navigation/navigation'
import { useTVNavigationBack } from '@/utils/hooks/useTVNavigationBack'import { useTVRemoteActions } from '@/utils/hooks/useTVRemoteActions'
import { useTVFocusRef } from '@/components/TV/useTVFocusRef'
import { useTVFocusRefresh } from '@/components/TV/useTVFocusRefresh'
import { getListDetail as getBoardListDetail } from '@/core/leaderboard'
import { getListDetail as getSonglistDetail } from '@/core/songlist'
import { handlePlay as handleBoardPlay } from '@/screens/Home/Views/Leaderboard/listAction'
import { handlePlay as handleSonglistPlay } from '@/screens/SonglistDetail/listAction'
import { getListMusics, setTempList, removeListMusics } from '@/core/list'
import { playList } from '@/core/player/player'
import { LIST_IDS } from '@/config/constant'
import type { TVDetailPayload } from './types'
import { dot, tvText } from './labels'
import { createTVTabs, getSourceName } from './utils'

type FocusNode = ComponentRef<typeof Focusable> | null
type FocusRefMap = Record<string, FocusNode>
const ITEM_SIZE = tvSize(78)

interface Props {
  componentId: string
  payload: TVDetailPayload
}

function TVDetail({ componentId, payload }: Props) {
  const [list, setList] = useState<LX.Music.MusicInfoOnline[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [total, setTotal] = useState(0)
  // 重试令牌：加载失败点「重试」时 +1，触发重新拉取；分页状态：加载更多 + 每页条数
  const [retryToken, setRetryToken] = useState(0)
  const [loadingMore, setLoadingMore] = useState(false)
  const [listLimit, setListLimit] = useState(30)
  const listRef = useRef<FlatList<LX.Music.MusicInfoOnline>>(null)
  const rowRefs = useRef<FocusRefMap>({})
  const playAllFocus = useTVFocusRef()
  const backFocus = useTVFocusRef()
  const firstRowFocus = useTVFocusRef()
  const retryFocus = useTVFocusRef()
  const loadMoreFocus = useTVFocusRef()
  const queueFocusRefresh = useTVFocusRefresh()
  const activeTabFocus = useRef<FocusNode>(null)
  const getActiveTabHandle = () => (activeTabFocus.current ? findNodeHandle(activeTabFocus.current) : null)
  const actionFocusedRef = useRef(false)

  // 从操作按钮下键进列表首行：直接聚焦（不再靠 preferred 翻转间接实现——
  // 初始焦点改为仅挂载时调度后，翻转不再触发焦点移动，09-22）
  const focusFirstRow = useCallback(() => {
    if (!firstRowFocus.ref.current) return
    listRef.current?.scrollToOffset({ offset: 0, animated: true })
    void focusTVTargetByRef(firstRowFocus.ref.current)
  }, [firstRowFocus.ref])

  useTVNavigationBack(componentId)
  useTVRemoteActions({
    playPause: () => { if (list.length) void handlePlay(0) },
    down: () => { if (actionFocusedRef.current) focusFirstRow() },
  })

  const image = payload.type === 'songlist' ? payload.songlist.img : null
  const heroMeta = payload.type === 'songlist'
    ? `${getSourceName(payload.source)}${dot}${tvText.songlist}${payload.songlist.play_count ? `${dot}${payload.songlist.play_count}` : ''}`
    : payload.type === 'board'
      ? `${getSourceName(payload.source)}${dot}${tvText.charts}${dot}${tvText.hotChart}`
      : `${tvText.userList}${payload.source ? `${dot}${getSourceName(payload.source)}` : ''}`

  useEffect(() => {
    let mounted = true
    setLoading(true)
    setError('')
    const load = async(): Promise<{ list: LX.Music.MusicInfoOnline[], total: number, limit: number }> => {
      if (payload.type === 'board') {
        const result = await getBoardListDetail(payload.id, 1)
        return { list: result.list, total: result.total, limit: result.limit || 30 }
      }
      if (payload.type === 'userlist') {
        const localList = await getListMusics(payload.id)
        // 必须复制快照：getListMusics 返回的是歌单活数组的引用，
        // 后续刷新时 setList(同引用) 会被 React 的 Object.is 短路而跳过重渲染（09-19 审查发现）
        return { list: [...localList] as unknown as LX.Music.MusicInfoOnline[], total: localList.length, limit: 0 }
      }
      const result = await getSonglistDetail(payload.id, payload.source, 1)
      return { list: result.list, total: result.total, limit: result.limit || 30 }
    }

    load().then(result => {
      if (!mounted) return
      setList(result.list)
      setTotal(result.total)
      if (result.limit) setListLimit(result.limit)
    }).catch((err: unknown) => {
      if (!mounted) return
      setList([])
      setError(err instanceof Error ? err.message : tvText.loadFailed)
    }).finally(() => {
      if (!mounted) return
      setLoading(false)
    })

    return () => { mounted = false }
  }, [payload, retryToken])

  // 在线歌单/榜单分页：首屏只拿第一页（约 30 首），滚到底点「加载更多」拉下一页（09-20 需求）
  const isOnlineList = payload.type === 'board' || payload.type === 'songlist'
  const hasMore = isOnlineList && !loading && !error && total > list.length && listLimit > 0
  const handleLoadMore = async() => {
    if (!hasMore || loadingMore) return
    setLoadingMore(true)
    try {
      const nextPage = Math.floor(list.length / listLimit) + 1
      const result = payload.type === 'board'
        ? await getBoardListDetail(payload.id, nextPage)
        : await getSonglistDetail(payload.id, payload.source, nextPage)
      // 分页接口偶尔重复返回边界歌曲，按 source+id 去重后追加
      const seen = new Set(list.map(m => `${m.source}_${m.id}`))
      const fresh = result.list.filter(m => !seen.has(`${m.source}_${m.id}`))
      setList(prev => [...prev, ...fresh])
      if (result.total) setTotal(result.total)
    } catch { /* 加载更多失败保持现状，可重点「重试」重新拉首页 */ }
    finally { setLoadingMore(false) }
  }

  // 本地歌单（userlist）内容变化时实时刷新：
  // 之前只在挂载时读一次，从播放列表加完歌再回来，看到的还是旧快照，误以为没加进去
  useEffect(() => {
    if (payload.type !== 'userlist') return
    const handleMusicUpdate = async(ids: string[]) => {
      if (!Array.isArray(ids) || !ids.includes(payload.id)) return
      try {
        const fresh = await getListMusics(payload.id)
        // 同上：复制快照，避免 setList(同引用) 被 Object.is 短路
        setList([...fresh] as unknown as LX.Music.MusicInfoOnline[])
        setTotal(fresh.length)
      } catch { /* 刷新失败保持现有展示 */ }
    }
    global.app_event.on('myListMusicUpdate', handleMusicUpdate)
    return () => { global.app_event.off('myListMusicUpdate', handleMusicUpdate) }
  }, [payload])

  const getRowKey = useCallback((item: LX.Music.MusicInfoOnline, index: number) => `${item.source}_${item.id}_${index}`, [])
  const getRowHandle = (key?: string | null) => key && rowRefs.current[key] ? findNodeHandle(rowRefs.current[key]) : null
  const bindRowRef = (key: string, syncFirst = false) => (node: FocusNode) => {
    rowRefs.current[key] = node
    if (syncFirst && node && firstRowFocus.ref.current !== node) {
      firstRowFocus.ref.current = node as any
      queueFocusRefresh()
    }
  }

  const handleFocus = (index: number) => {
    listRef.current?.scrollToOffset({ offset: Math.max(0, index * ITEM_SIZE - ITEM_SIZE), animated: true })
  }

  const handleActionFocus = () => { actionFocusedRef.current = true }
  const handleActionBlur = () => { actionFocusedRef.current = false }

  const handlePlay = async(index = 0) => {
    if (payload.type === 'board') await handleBoardPlay(payload.id, list, index)
    else if (payload.type === 'userlist') {
      // 本地歌单：**必须把整张歌单灌进「播放列表」(TEMP) 再播**。
      // 不能写成 playList(payload.id, index)：那样 playerListId 会是歌单自己的 id，
      // 而队列页只读 TEMP，于是队列页显示的是上一次留下的旧歌 —— 用户一按 OK
      // 就跳到不相干的歌上，看起来就是「播完这首就不播歌单里的歌了」。
      if (!list.length) return
      await setTempList(payload.id, [...list])
      await playList(LIST_IDS.TEMP, index)
    } else await handleSonglistPlay(payload.id, payload.source, list, index)
    pushTVPlayerScreen(componentId)
  }

  // 单曲追加（长按 OK）：把这一首塞到播放列表末尾，不动前面的歌。
  // 注：追加是按「当时已播/未播」的语义放在列表尾部，播完会继续走后面的歌，
  // 所以它只适合「顺手加一首」，不适合「我想听这张歌单」——后者用短按 OK。
  const handleSinglePlay = async(item: LX.Music.MusicInfoOnline) => {
    const currentList = await getListMusics(LIST_IDS.TEMP)
    let playIndex = currentList.findIndex(m => m.id === item.id)
    if (playIndex < 0) {
      await setTempList(`append_single__${item.id}`, [...currentList, item] as LX.Music.MusicInfoOnline[])
      playIndex = currentList.length
    }
    await playList(LIST_IDS.TEMP, playIndex)
    pushTVPlayerScreen(componentId)
  }

  // 长按删除歌曲（仅自建歌单，老板 09-20 需求）：弹窗确认后从歌单移除。
  // 在线歌单/榜单不支持改远端数据，保持原来的「长按追加到播放列表」。
  const [localDialog, setLocalDialog] = useState<TVDialogRequest | null>(null)
  const confirmRemoveSong = (item: LX.Music.MusicInfoOnline) => {
    setLocalDialog({
      title: `删除：${item.name ?? '未知歌曲'}`,
      message: `确定从该歌单删除这首歌吗？${item.singer ? `（${item.singer}）` : ''}`,
      buttons: [
        { label: '取消', tone: 'dark' },
        { label: '删除', tone: 'danger', onPress: () => { void doRemoveSong(item) } },
      ],
    })
  }
  const doRemoveSong = async(item: LX.Music.MusicInfoOnline) => {
    try {
      await removeListMusics(payload.id, [item.id])
      // 列表经本页的 myListMusicUpdate 订阅自动刷新，无需手动重载
    } catch (err: unknown) {
      setLocalDialog({
        title: '删除失败',
        message: err instanceof Error ? err.message : '未知错误',
        buttons: [{ label: '确定', tone: 'primary' }],
      })
    }
  }

  const statsText = loading
    ? tvText.loadingSongs
    : error
      ? `${tvText.loadFailed}${dot}${error}`
      : `${tvText.loaded} ${list.length} ${tvText.songs}${total ? ` / ${total} ${tvText.songs}` : ''}`

  return (
    <TVAppleScaffold image={image} immersive contentStyle={styles.scaffoldContent}>
      <TVTopTabs items={createTVTabs(componentId)} activeId={payload.type === 'board' ? 'new' : 'home'} subtitle={tvText.detailSubtitle} nextFocusDown={playAllFocus.getNodeHandle() ?? undefined} activeTabRef={activeTabFocus} onActiveTabReady={queueFocusRefresh} />
      <View style={styles.root}>
        <View style={styles.stage}>
          <View style={styles.coverStage}>
            <View style={styles.coverGlow} />
            <View style={styles.coverFrame}>
              {image ? <Image url={image} style={styles.coverImage as ImageStyle} resizeMode="cover" /> : <TVText variant="pageTitle" color={tvColors.primaryHigh} style={styles.coverPlaceholder}>{(payload.title || '?').slice(0, 1)}</TVText>}
            </View>
            <View style={styles.coverReflection} />
          </View>

          <View style={styles.heroInfo}>
            <View style={styles.kickerRow}>
              <TVText variant="caption" color={tvColors.primaryHigh} numberOfLines={1} style={styles.kicker}>{heroMeta}</TVText>
            </View>
            <TVText variant="pageTitle" style={styles.title} numberOfLines={2}>{payload.title}</TVText>
            <TVText variant="meta" style={styles.desc} numberOfLines={3}>{payload.subtitle ?? (payload.type === 'songlist' ? payload.songlist.desc : tvText.selectedListDesc)}</TVText>
            <View style={styles.actions}>
              <TVButton
                ref={playAllFocus.ref as any}
                label={loading ? tvText.loading : tvText.playAll}
                tone="dark"
                style={styles.actionButton}
                onPress={() => { void handlePlay(0) }}
                onFocus={handleActionFocus}
                onBlur={handleActionBlur}
                hasTVPreferredFocus
                nextFocusUp={getActiveTabHandle() ?? undefined}
                nextFocusRight={backFocus.getNodeHandle() ?? undefined}
                nextFocusDown={firstRowFocus.getNodeHandle() ?? undefined}
              />
              <TVButton
                ref={backFocus.ref as any}
                label={tvText.back}
                tone="dark"
                style={styles.backButton}
                onPress={() => { void pop(componentId) }}
                onFocus={handleActionFocus}
                onBlur={handleActionBlur}
                nextFocusUp={getActiveTabHandle() ?? undefined}
                nextFocusLeft={playAllFocus.getNodeHandle() ?? undefined}
                nextFocusRight={firstRowFocus.getNodeHandle() ?? undefined}
                nextFocusDown={firstRowFocus.getNodeHandle() ?? undefined}
              />
            </View>
          </View>
        </View>

        <TVGlassPanel style={styles.listPanel}>
          <View style={styles.listHeader}>
            <TVText variant="sectionTitle" style={styles.listTitle}>{tvText.songList}</TVText>
            <TVText variant="caption" color={tvColors.primaryHigh}>{statsText}</TVText>
          </View>
          {list.length ? <TVText variant="caption" color={tvColors.dimText} style={styles.listHint}>{tvText.detailPlayHint}</TVText> : null}
          <FlatList
            ref={listRef}
            data={list}
            keyExtractor={getRowKey}
            style={styles.list}
            showsVerticalScrollIndicator={false}
            removeClippedSubviews={false}
            contentContainerStyle={styles.listContent}
            ListEmptyComponent={!loading ? (
              <View style={styles.emptyBox}>
                <TVText variant="meta" style={styles.empty}>{error || tvText.loadFailed}</TVText>
                {error ? (
                  <TVButton
                    ref={retryFocus.ref as any}
                    label="重试"
                    tone="primary"
                    hasTVPreferredFocus
                    onPress={() => { setRetryToken(t => t + 1) }}
                    nextFocusUp={getActiveTabHandle() ?? playAllFocus.getNodeHandle() ?? undefined}
                  />
                ) : null}
              </View>
            ) : null}
            ListFooterComponent={hasMore ? (
              <TVButton
                ref={loadMoreFocus.ref as any}
                label={loadingMore ? tvText.loading : tvText.loadMore}
                tone="dark"
                style={styles.loadMore}
                onPress={() => { void handleLoadMore() }}
              />
            ) : null}
            renderItem={({ item, index }) => {
              const key = getRowKey(item, index)
              const prevKey = list[index - 1] ? getRowKey(list[index - 1], index - 1) : null
              const nextKey = list[index + 1] ? getRowKey(list[index + 1], index + 1) : null
              return (
                <TVMusicRow
                  ref={bindRowRef(key, index === 0) as any}
                  index={index}
                  title={item.name}
                  subtitle={`${item.singer ?? tvText.unknownSinger}${dot}${item.meta.albumName ?? tvText.unknownAlbum}`}
                  meta={item.interval ?? getSourceName(item.source)}
                  badge={index < 3 ? tvText.hotChart : undefined}
                  hasTVPreferredFocus={false}
                  onFocus={() => { handleFocus(index) }}
                  onPress={() => { void handlePlay(index) }}
                  onLongPress={payload.type === 'userlist' ? () => { confirmRemoveSong(item) } : () => { void handleSinglePlay(item) }}
                  nextFocusUp={index === 0 ? getActiveTabHandle() ?? playAllFocus.getNodeHandle() ?? undefined : getRowHandle(prevKey) ?? undefined}
                  nextFocusLeft={playAllFocus.getNodeHandle() ?? undefined}
                  nextFocusDown={getRowHandle(nextKey) ?? undefined}
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
        onDismiss={() => { setLocalDialog(null) }}
      />
    </TVAppleScaffold>
  )
}

const styles: Record<string, ViewStyle | TextStyle | ImageStyle | any> = {
  scaffoldContent: { paddingTop: tvSize(30), paddingBottom: tvSize(38) },
  root: { flex: 1, flexDirection: 'row', gap: tvSize(24), alignItems: 'stretch' },
  stage: { flex: 1, minWidth: 0, flexDirection: 'row', alignItems: 'center', gap: tvSize(18), paddingRight: tvSize(2) },
  coverStage: { width: tvSize(188), height: tvSize(300), alignItems: 'center', justifyContent: 'center' },
  coverGlow: {
    position: 'absolute',
    width: tvSize(198),
    height: tvSize(198),
    borderRadius: tvSize(44),
    backgroundColor: 'rgba(216,230,255,0.16)',
    top: tvSize(32),
    opacity: 0.9,
  },
  coverFrame: {
    width: tvSize(184),
    height: tvSize(184),
    borderRadius: tvSize(26),
    overflow: 'hidden',
    backgroundColor: tvColors.surfaceWarm,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.34)',
    elevation: 24,
    shadowColor: '#000',
    shadowOpacity: 0.45,
    shadowRadius: tvSize(30),
    shadowOffset: { width: 0, height: tvSize(22) },
  },
  coverImage: { width: '100%', height: '100%' },
  coverPlaceholder: { fontSize: tvFont(76), fontWeight: '900', opacity: 0.5 },
  coverReflection: {
    width: tvSize(146),
    height: tvSize(46),
    marginTop: tvSize(12),
    borderRadius: tvSize(40),
    backgroundColor: 'rgba(255,255,255,0.07)',
    transform: [{ scaleY: 0.42 }],
    opacity: 0.72,
  },
  heroInfo: { flex: 1, minWidth: 0, justifyContent: 'center', paddingBottom: tvSize(18) },
  kickerRow: { flexDirection: 'row', alignItems: 'center', maxWidth: '100%' },
  kicker: { flexShrink: 1 },
  title: { marginTop: tvSize(14), lineHeight: tvFont(42), fontSize: tvFont(36) },
  desc: { marginTop: tvSize(12), lineHeight: tvFont(22), color: tvColors.subtext },
  actions: { flexDirection: 'row', gap: tvSize(12), marginTop: tvSize(20) },
  actionButton: { minWidth: tvSize(118), minHeight: tvSize(50), paddingHorizontal: tvSize(18), paddingVertical: tvSize(12) },
  backButton: { minWidth: tvSize(88), minHeight: tvSize(50), paddingHorizontal: tvSize(18), paddingVertical: tvSize(12) },
  listPanel: {
    width: tvSize(376),
    padding: tvSize(22),
    backgroundColor: 'rgba(10,14,24,0.55)',
    borderColor: 'rgba(255,255,255,0.24)',
  },
  listHeader: { minHeight: tvSize(42), flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between', gap: tvSize(16) },
  listHint: { marginBottom: tvSize(10) },
  listTitle: { fontSize: tvFont(25) },
  list: { flex: 1 },
  listContent: { paddingTop: tvSize(14), paddingBottom: tvSize(18), gap: tvSize(10) },
  empty: { marginTop: tvSize(18) },
  emptyBox: { marginTop: tvSize(18), gap: tvSize(12), alignItems: 'flex-start' },
  loadMore: { marginTop: tvSize(8), alignSelf: 'stretch' },
}

export default memo(TVDetail)
