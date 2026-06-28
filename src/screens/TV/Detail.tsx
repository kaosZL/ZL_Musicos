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
import { tvColors, tvFont, tvSize } from '@/theme/tv'
import { pop } from '@/navigation'
import { pushTVPlayerScreen, pushTVSettingsScreen } from '@/navigation/navigation'
import { useTVNavigationBack } from '@/utils/hooks/useTVNavigationBack'
import { useTVRemoteActions } from '@/utils/hooks/useTVRemoteActions'
import { useTVFocusRef } from '@/components/TV/useTVFocusRef'
import { useTVFocusRefresh } from '@/components/TV/useTVFocusRefresh'
import { getListDetail as getBoardListDetail } from '@/core/leaderboard'
import { getListDetail as getSonglistDetail } from '@/core/songlist'
import { handlePlay as handleBoardPlay } from '@/screens/Home/Views/Leaderboard/listAction'
import { handlePlay as handleSonglistPlay } from '@/screens/SonglistDetail/listAction'
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
  const [preferFirstRow, setPreferFirstRow] = useState(false)
  const listRef = useRef<FlatList<LX.Music.MusicInfoOnline>>(null)
  const rowRefs = useRef<FocusRefMap>({})
  const playAllFocus = useTVFocusRef()
  const backFocus = useTVFocusRef()
  const firstRowFocus = useTVFocusRef()
  const queueFocusRefresh = useTVFocusRefresh()
  const actionFocusedRef = useRef(false)

  const focusFirstRow = useCallback(() => {
    if (!firstRowFocus.ref.current) return
    listRef.current?.scrollToOffset({ offset: 0, animated: true })
    setPreferFirstRow(false)
    requestAnimationFrame(() => { setPreferFirstRow(true) })
  }, [firstRowFocus.ref])

  useTVNavigationBack(componentId)
  useTVRemoteActions({
    playPause: () => { if (list.length) void handlePlay(0) },
    down: () => { if (actionFocusedRef.current) focusFirstRow() },
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
    if (syncFirst && node && firstRowFocus.ref.current !== node) {
      firstRowFocus.ref.current = node as any
      queueFocusRefresh()
    }
  }

  const handleFocus = (index: number) => {
    if (preferFirstRow) setPreferFirstRow(false)
    listRef.current?.scrollToOffset({ offset: Math.max(0, index * ITEM_SIZE - ITEM_SIZE), animated: true })
  }

  const handleActionFocus = () => { actionFocusedRef.current = true }
  const handleActionBlur = () => { actionFocusedRef.current = false }

  const handlePlay = async(index = 0) => {
    if (payload.type === 'board') await handleBoardPlay(payload.id, list, index)
    else await handleSonglistPlay(payload.id, payload.source, list, index)
    pushTVPlayerScreen(componentId)
  }

  const statsText = loading
    ? tvText.loadingSongs
    : error
      ? `${tvText.loadFailed}${dot}${error}`
      : `${tvText.loaded} ${list.length} ${tvText.songs}${total ? ` / ${total} ${tvText.songs}` : ''}`

  return (
    <TVAppleScaffold image={image} immersive contentStyle={styles.scaffoldContent}>
      <TVTopTabs items={createTVTabs(componentId)} activeId={payload.type === 'board' ? 'new' : 'home'} subtitle={tvText.detailSubtitle} nextFocusDown={playAllFocus.getNodeHandle() ?? undefined} />
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
                style={styles.actionButton}
                onPress={() => { void handlePlay(0) }}
                onFocus={handleActionFocus}
                onBlur={handleActionBlur}
                hasTVPreferredFocus
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
          <FlatList
            ref={listRef}
            data={list}
            keyExtractor={getRowKey}
            style={styles.list}
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
                  hasTVPreferredFocus={preferFirstRow && index === 0}
                  onFocus={() => { handleFocus(index) }}
                  onPress={() => { void handlePlay(index) }}
                  nextFocusUp={index === 0 ? playAllFocus.getNodeHandle() ?? undefined : getRowHandle(prevKey) ?? undefined}
                  nextFocusLeft={playAllFocus.getNodeHandle() ?? undefined}
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
  listTitle: { fontSize: tvFont(25) },
  list: { flex: 1 },
  listContent: { paddingTop: tvSize(14), paddingBottom: tvSize(18), gap: tvSize(10) },
  empty: { marginTop: tvSize(18) },
}

export default memo(TVDetail)
