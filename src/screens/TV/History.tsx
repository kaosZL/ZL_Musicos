import { memo, useEffect, useMemo, useRef, useState, type ComponentRef } from 'react'
import { FlatList, ScrollView, View, findNodeHandle, type TextStyle, type ViewStyle } from 'react-native'
import TVAppleScaffold from '@/components/TV/TVAppleScaffold'
import TVTopTabs from '@/components/TV/TVTopTabs'
import TVText from '@/components/TV/TVText'
import TVButton from '@/components/TV/TVButton'
import TVMusicRow from '@/components/TV/TVMusicRow'
import TVGlassPanel from '@/components/TV/TVGlassPanel'
import Focusable from '@/components/TV/Focusable'
import searchMusicState from '@/store/search/music/state'
import { tvColors, tvFont, tvSize } from '@/theme/tv'
import { getBoardsList } from '@/core/leaderboard'
import leaderboardState, { type BoardItem } from '@/store/leaderboard/state'
import { pushTVDetailScreen, pushTVPlayerScreen } from '@/navigation/navigation'
import { useTVNavigationBack } from '@/utils/hooks/useTVNavigationBack'
import { useTVRemoteActions } from '@/utils/hooks/useTVRemoteActions'
import { useTVFocusRef } from '@/components/TV/useTVFocusRef'
import { useTVFocusRefresh } from '@/components/TV/useTVFocusRefresh'
import { usePlayerMusicInfo } from '@/store/player/hook'
import { dot, tvText } from './labels'
import { createTVTabs, getSourceName } from './utils'

type FocusNode = ComponentRef<typeof Focusable> | null
type FocusRefMap = Record<string, FocusNode>
const ITEM_SIZE = tvSize(78)

function TVHistory({ componentId }: { componentId: string }) {
  const currentMusicInfo = usePlayerMusicInfo()
  const [boards, setBoards] = useState<BoardItem[]>([])
  const [selectedIndex, setSelectedIndex] = useState(0)
  const [loadingText, setLoadingText] = useState(tvText.loading + tvText.hotChart)
  const playerFocus = useTVFocusRef()
  const firstBoardFocus = useTVFocusRef()
  const activeTabFocus = useRef<FocusNode>(null)
  const listRef = useRef<FlatList<BoardItem>>(null)
  const boardRefs = useRef<FocusRefMap>({})
  const queueFocusRefresh = useTVFocusRefresh()

  useTVNavigationBack(componentId)
  const [sourceSel, setSourceSel] = useState<string>(leaderboardState.sources[0] ?? '')
  const boardSource = sourceSel as typeof leaderboardState.sources[0]
  const sourceRefs = useRef<FocusRefMap>({})
  const sourceOptions = useMemo(() => searchMusicState.sources.filter(s => s !== 'all'), [searchMusicState.sources])
  const sourceTabs = useMemo(() => sourceOptions.map(s => ({ id: s, label: getSourceName(s) ?? s })), [sourceOptions])
  const getSourceHandle = (id?: string | null) => id && sourceRefs.current[id] ? findNodeHandle(sourceRefs.current[id]) : null
  const bindSourceRef = (id: string) => (node: FocusNode) => { sourceRefs.current[id] = node }
  const handleSourceChange = (newSource: string) => {
    if (newSource === sourceSel) return
    setSourceSel(newSource)
    setSelectedIndex(0)
    setLoadingText(tvText.loading + tvText.hotChart)
  }
  const selectedBoard = boards[selectedIndex] ?? null

  useEffect(() => {
    let mounted = true
    const load = async() => {
      try {
        const result = boardSource ? await getBoardsList(boardSource) : []
        if (!mounted) return
        setBoards(result)
        setLoadingText(result.length ? '' : tvText.noAvailableCharts)
      } catch (err: unknown) {
        if (!mounted) return
        setBoards([])
        setLoadingText(err instanceof Error ? `${tvText.chartLoadFailed}${dot}${err.message}` : tvText.chartLoadFailed)
      }
    }
    void load()
    return () => { mounted = false }
  }, [boardSource])

  const getBoardKey = (item: BoardItem, index: number) => `${boardSource}_${item.bangid}_${index}`
  const getActiveTabHandle = () => activeTabFocus.current ? findNodeHandle(activeTabFocus.current) : null
  const getBoardHandle = (key?: string | null) => key && boardRefs.current[key] ? findNodeHandle(boardRefs.current[key]) : null
  const bindBoardRef = (key: string, syncFirst = false) => (node: FocusNode) => {
    const changed = boardRefs.current[key] !== node
    boardRefs.current[key] = node
    if (node && changed) queueFocusRefresh()
    if (syncFirst) firstBoardFocus.ref.current = node as any
  }

  const handleBoardFocus = (index: number) => {
    setSelectedIndex(index)
    listRef.current?.scrollToOffset({ offset: Math.max(0, index * ITEM_SIZE - ITEM_SIZE), animated: true })
  }

  const openBoard = (board = selectedBoard) => {
    if (!board || !boardSource) return
    pushTVDetailScreen(componentId, {
      type: 'board',
      id: `${boardSource}__${board.bangid}`,
      source: boardSource,
      title: board.name,
      subtitle: tvText.platformHot,
      board,
    })
  }

  useTVRemoteActions({
    playPause: () => {
      if (currentMusicInfo.id) {
        pushTVPlayerScreen(componentId)
        return
      }
      openBoard()
    },
  })

  return (
    <TVAppleScaffold image={currentMusicInfo.pic}>
      <TVTopTabs items={createTVTabs(componentId)} activeId="new" nextFocusDown={firstBoardFocus.getNodeHandle() ?? undefined} activeTabRef={activeTabFocus as any} onActiveTabReady={queueFocusRefresh} />
      <View style={styles.root}>
        <TVGlassPanel style={styles.listPanel}>
         <View style={styles.header}>
           <View>
             <TVText variant="pageTitle" style={styles.title}>{tvText.ranking}</TVText>
             <TVText variant="body" style={styles.subtitle}>{boardSource ? getSourceName(boardSource) : tvText.noMusic} · {boards.length} {tvText.charts}</TVText>
           </View>
          <View style={styles.actions}>
            <TVButton ref={playerFocus.ref as any} label={tvText.nowPlaying} tone="ghost" onPress={() => { pushTVPlayerScreen(componentId) }} />
          </View>
         </View>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.sourceTabWrap} contentContainerStyle={styles.sourceTabContent}>
            {sourceTabs.map((tab, index) => (
              <Focusable
                key={tab.id}
                ref={bindSourceRef(tab.id) as any}
                style={[styles.sourceTab, sourceSel === tab.id && styles.sourceTabActive]}
                onPress={() => { handleSourceChange(tab.id) }}
                nextFocusLeft={getSourceHandle(sourceTabs[index - 1]?.id) ?? undefined}
                nextFocusRight={getSourceHandle(sourceTabs[index + 1]?.id) ?? undefined}
                nextFocusDown={firstBoardFocus.getNodeHandle() ?? undefined}
                nextFocusUp={getActiveTabHandle() ?? undefined}
              >
                <TVText variant="caption" style={sourceSel === tab.id ? styles.sourceTabTextActive : styles.sourceTabText}>
                  {tab.label}
                </TVText>
              </Focusable>
            ))}
          </ScrollView>
          <FlatList
            ref={listRef}
            data={boards}
            showsVerticalScrollIndicator={false}
            keyExtractor={getBoardKey}
            removeClippedSubviews={false}
            contentContainerStyle={styles.listContent}
            ListEmptyComponent={<TVText variant="meta">{loadingText}</TVText>}
            renderItem={({ item, index }) => {
              const itemKey = getBoardKey(item, index)
              const prevKey = boards[index - 1] ? getBoardKey(boards[index - 1], index - 1) : null
              const nextKey = boards[index + 1] ? getBoardKey(boards[index + 1], index + 1) : null
              return (
               <TVMusicRow
                 ref={bindBoardRef(itemKey, index === 0) as any}
                 index={index}
                 hasTVPreferredFocus={index === 0}
                 title={item.name}
                 subtitle={`${getSourceName(boardSource)}${dot}${tvText.realSongs}`}
                 meta={index === 0 ? tvText.hotChart : tvText.charts}
                 badge={index < 3 ? tvText.hotChart : undefined}
                 active={selectedIndex === index}
                 onFocus={() => { handleBoardFocus(index) }}
                 onPress={() => { openBoard(item) }}
                 nextFocusUp={index === 0 ? getActiveTabHandle() ?? undefined : getBoardHandle(prevKey) ?? undefined}
                 nextFocusRight={playerFocus.getNodeHandle() ?? undefined}
                 nextFocusDown={getBoardHandle(nextKey) ?? undefined}
               />
              )
            }}
          />
        </TVGlassPanel>
      </View>
    </TVAppleScaffold>
  )
}

const styles: Record<string, ViewStyle | TextStyle | any> = {
  root: { flex: 1 },
  listPanel: { flex: 1, paddingHorizontal: 34, paddingVertical: 30 },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: tvSize(12), gap: tvSize(24) },
  title: { fontSize: tvFont(48), lineHeight: tvFont(56) },
  subtitle: { marginTop: tvSize(8), color: tvColors.subtext },
  actions: { flexDirection: 'row', alignItems: 'center', gap: tvSize(12) },
  listContent: { paddingBottom: tvSize(28) },
  sourceTabWrap: { marginBottom: tvSize(14), flexGrow: 0 },
  sourceTabContent: { flexDirection: 'row', gap: tvSize(8), alignItems: 'center', minHeight: tvSize(34), paddingRight: tvSize(8) },
  sourceTab: { minHeight: tvSize(30), borderRadius: 999, paddingHorizontal: tvSize(14), alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(255,255,255,0.08)', borderWidth: 1, borderColor: tvColors.border },
  sourceTabActive: { backgroundColor: 'rgba(0,103,192,0.25)', borderColor: tvColors.primary },
  sourceTabText: { color: tvColors.subtext },
  sourceTabTextActive: { color: tvColors.text, fontWeight: '700' },
}

export default memo(TVHistory)
