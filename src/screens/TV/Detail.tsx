import { memo, useCallback, useEffect, useRef, useState, type ComponentRef } from 'react'
import { FlatList, View, findNodeHandle, type ImageStyle, type TextStyle, type ViewStyle } from 'react-native'
import TVAppleScaffold from '@/components/TV/TVAppleScaffold'
import TVTopTabs from '@/components/TV/TVTopTabs'
import TVText from '@/components/TV/TVText'
import TVButton from '@/components/TV/TVButton'
import TVMusicRow from '@/components/TV/TVMusicRow'
import TVGlassPanel from '@/components/TV/TVGlassPanel'
import type Focusable from '@/components/TV/Focusable'
import Image from '@/components/common/Image'
import { tvColors } from '@/theme/tv'
import { pop } from '@/navigation'
import { pushTVPlayerScreen, pushTVSettingsScreen } from '@/navigation/navigation'
import { useTVNavigationBack } from '@/utils/hooks/useTVNavigationBack'
import { useTVRemoteActions } from '@/utils/hooks/useTVRemoteActions'
import { useTVFocusRef } from '@/components/TV/useTVFocusRef'
import { getListDetail as getBoardListDetail } from '@/core/leaderboard'
import { getListDetail as getSonglistDetail } from '@/core/songlist'
import { handlePlay as handleBoardPlay } from '@/screens/Home/Views/Leaderboard/listAction'
import { handlePlay as handleSonglistPlay } from '@/screens/SonglistDetail/listAction'
import type { TVDetailPayload } from './types'
import { dot, tvText } from './labels'
import { createTVTabs, getSourceName } from './utils'

type FocusNode = ComponentRef<typeof Focusable> | null
type FocusRefMap = Record<string, FocusNode>
const ITEM_SIZE = 78

interface Props {
  componentId: string
  payload: TVDetailPayload
}

function TVDetail({ componentId, payload }: Props) {
  const [list, setList] = useState<LX.Music.MusicInfoOnline[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [total, setTotal] = useState(0)
  const listRef = useRef<FlatList<LX.Music.MusicInfoOnline>>(null)
  const rowRefs = useRef<FocusRefMap>({})
  const playAllFocus = useTVFocusRef()
  const backFocus = useTVFocusRef()
  const firstRowFocus = useTVFocusRef()

  useTVNavigationBack(componentId)
  useTVRemoteActions({
    playPause: () => { if (list.length) void handlePlay(0) },
    menu: () => { pushTVSettingsScreen(componentId) },
  })

  const image = payload.type === 'songlist' ? payload.songlist.img : null
  const heroMeta = payload.type === 'songlist'
    ? `${getSourceName(payload.source)}${dot}${tvText.songlist}${payload.songlist.play_count ? `${dot}${payload.songlist.play_count}` : ''}`
    : `${getSourceName(payload.source)}${dot}${tvText.charts}${dot}${tvText.hotChart}`

  useEffect(() => {
    let mounted = true
    setLoading(true)
    setError('')
    const loader = payload.type === 'board'
      ? getBoardListDetail(payload.id, 1)
      : getSonglistDetail(payload.id, payload.source, 1)

    loader.then(result => {
      if (!mounted) return
      setList(result.list)
      setTotal(result.total)
    }).catch((err: unknown) => {
      if (!mounted) return
      setList([])
      setError(err instanceof Error ? err.message : tvText.loadFailed)
    }).finally(() => {
      if (!mounted) return
      setLoading(false)
    })

    return () => { mounted = false }
  }, [payload])

  const getRowKey = useCallback((item: LX.Music.MusicInfoOnline, index: number) => `${item.source}_${item.id}_${index}`, [])
  const getRowHandle = (key?: string | null) => key && rowRefs.current[key] ? findNodeHandle(rowRefs.current[key]) : null
  const bindRowRef = (key: string, syncFirst = false) => (node: FocusNode) => {
    rowRefs.current[key] = node
    if (syncFirst) firstRowFocus.ref.current = node as any
  }

  const handleFocus = (index: number) => {
    listRef.current?.scrollToOffset({ offset: Math.max(0, index * ITEM_SIZE - ITEM_SIZE), animated: true })
  }

  const handlePlay = async(index = 0) => {
    if (payload.type === 'board') await handleBoardPlay(payload.id, list, index)
    else await handleSonglistPlay(payload.id, payload.source, list, index)
    pushTVPlayerScreen(componentId)
  }

  return (
    <TVAppleScaffold image={image}>
      <TVTopTabs items={createTVTabs(componentId)} activeId={payload.type === 'board' ? 'new' : 'home'} subtitle={tvText.detailSubtitle} />
      <View style={styles.root}>
        <TVGlassPanel style={styles.hero} accent>
          <View style={styles.cover}>
            {image ? <Image url={image} style={styles.coverImage as ImageStyle} resizeMode="cover" /> : <TVText variant="pageTitle" color={tvColors.primaryHigh} style={styles.coverPlaceholder}>{(payload.title || '?').slice(0, 1)}</TVText>}
          </View>
          <View style={styles.heroInfo}>
            <TVText variant="caption" color={tvColors.primaryHigh}>{heroMeta}</TVText>
            <TVText variant="pageTitle" style={styles.title} numberOfLines={2}>{payload.title}</TVText>
            <TVText variant="meta" style={styles.desc} numberOfLines={4}>{payload.subtitle ?? (payload.type === 'songlist' ? payload.songlist.desc : tvText.selectedListDesc)}</TVText>
            <View style={styles.actions}>
              <TVButton ref={playAllFocus.ref as any} label={loading ? tvText.loading : tvText.playAll} onPress={() => { void handlePlay(0) }} hasTVPreferredFocus nextFocusRight={backFocus.getNodeHandle() ?? undefined} nextFocusDown={firstRowFocus.getNodeHandle() ?? undefined} />
              <TVButton ref={backFocus.ref as any} label={tvText.back} tone="dark" onPress={() => { void pop(componentId) }} nextFocusLeft={playAllFocus.getNodeHandle() ?? undefined} nextFocusDown={firstRowFocus.getNodeHandle() ?? undefined} />
            </View>
            <TVText variant="caption" style={styles.stats}>{loading ? tvText.loadingSongs : error ? `${tvText.loadFailed}${dot}${error}` : `${tvText.loaded} ${list.length} ${tvText.songs}${total ? ` / ${total} ${tvText.songs}` : ''}`}</TVText>
          </View>
        </TVGlassPanel>

        <TVGlassPanel style={styles.listPanel}>
          <TVText variant="sectionTitle">{tvText.songList}</TVText>
          <FlatList
            ref={listRef}
            data={list}
            keyExtractor={getRowKey}
            showsVerticalScrollIndicator={false}
            removeClippedSubviews={false}
            contentContainerStyle={styles.listContent}
            ListEmptyComponent={!loading ? <TVText variant="meta" style={styles.empty}>{error || tvText.loadFailed}</TVText> : null}
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
                  onFocus={() => { handleFocus(index) }}
                  onPress={() => { void handlePlay(index) }}
                  nextFocusUp={index === 0 ? playAllFocus.getNodeHandle() ?? undefined : getRowHandle(prevKey) ?? undefined}
                  nextFocusDown={getRowHandle(nextKey) ?? undefined}
                />
              )
            }}
          />
        </TVGlassPanel>
      </View>
    </TVAppleScaffold>
  )
}

const styles: Record<string, ViewStyle | TextStyle | ImageStyle | any> = {
  root: { flex: 1, flexDirection: 'row', gap: 28 },
  hero: { width: 440, padding: 26 },
  cover: { width: 300, height: 300, borderRadius: 36, overflow: 'hidden', backgroundColor: tvColors.surfaceWarm, alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: tvColors.line },
  coverImage: { width: '100%', height: '100%' },
  coverPlaceholder: { fontSize: 120, fontWeight: '900', opacity: 0.5 },
  heroInfo: { marginTop: 24 },
  title: { marginTop: 10, lineHeight: 54 },
  desc: { marginTop: 12, lineHeight: 24 },
  actions: { flexDirection: 'row', gap: 14, marginTop: 24 },
  stats: { marginTop: 14 },
  listPanel: { flex: 1, padding: 26 },
  listContent: { paddingTop: 12, paddingBottom: 20 },
  empty: { marginTop: 18 },
}

export default memo(TVDetail)
