import { memo, useEffect, useRef, useState, type ComponentRef } from 'react'
import { FlatList, View, findNodeHandle, type TextStyle, type ViewStyle } from 'react-native'
import TVAppleScaffold from '@/components/TV/TVAppleScaffold'
import TVTopTabs from '@/components/TV/TVTopTabs'
import TVText from '@/components/TV/TVText'
import TVButton from '@/components/TV/TVButton'
import TVMusicRow from '@/components/TV/TVMusicRow'
import TVGlassPanel from '@/components/TV/TVGlassPanel'
import type Focusable from '@/components/TV/Focusable'
import { tvColors, tvFont, tvSize } from '@/theme/tv'
import { getBoardsList } from '@/core/leaderboard'
import leaderboardState, { type BoardItem } from '@/store/leaderboard/state'
import { pushTVDetailScreen, pushTVPlayerScreen, pushTVSettingsScreen } from '@/navigation/navigation'
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
  const listRef = useRef<FlatList<BoardItem>>(null)
  const boardRefs = useRef<FocusRefMap>({})
  useTVFocusRefresh()

  useTVNavigationBack(componentId)
  const boardSource = leaderboardState.sources[0]
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
  const getBoardHandle = (key?: string | null) => key && boardRefs.current[key] ? findNodeHandle(boardRefs.current[key]) : null
  const bindBoardRef = (key: string, syncFirst = false) => (node: FocusNode) => {
    boardRefs.current[key] = node
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
    menu: () => { pushTVSettingsScreen(componentId) },
  })

  return (
    <TVAppleScaffold image={currentMusicInfo.pic}>
      <TVTopTabs items={createTVTabs(componentId)} activeId="new" nextFocusDown={firstBoardFocus.getNodeHandle() ?? undefined} />
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
                 nextFocusUp={index === 0 ? undefined : getBoardHandle(prevKey) ?? undefined}
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
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: tvSize(18), gap: tvSize(24) },
  title: { fontSize: tvFont(48), lineHeight: tvFont(56) },
  subtitle: { marginTop: tvSize(8), color: tvColors.subtext },
  actions: { flexDirection: 'row', alignItems: 'center', gap: tvSize(12) },
  listContent: { paddingBottom: tvSize(28) },
}

export default memo(TVHistory)
