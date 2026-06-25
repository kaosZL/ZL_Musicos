import { memo, useEffect, useRef, useState, type ComponentRef } from 'react'
import { FlatList, View, findNodeHandle, type TextStyle, type ViewStyle } from 'react-native'
import TVAppleScaffold from '@/components/TV/TVAppleScaffold'
import TVTopTabs from '@/components/TV/TVTopTabs'
import TVText from '@/components/TV/TVText'
import TVButton from '@/components/TV/TVButton'
import TVMusicRow from '@/components/TV/TVMusicRow'
import TVGlassPanel from '@/components/TV/TVGlassPanel'
import type Focusable from '@/components/TV/Focusable'
import { tvColors } from '@/theme/tv'
import { usePlayerMusicInfo } from '@/store/player/hook'
import { clearListMusics } from '@/core/list'
import { playList } from '@/core/player/player'
import { LIST_IDS } from '@/config/constant'
import { pushTVPlayerScreen, pushTVSettingsScreen } from '@/navigation/navigation'
import { useTVNavigationBack } from '@/utils/hooks/useTVNavigationBack'
import { useTVRemoteActions } from '@/utils/hooks/useTVRemoteActions'
import { useTVFocusRef } from '@/components/TV/useTVFocusRef'
import { tvText } from './labels'
import { createTVTabs, getMusicSubtitle, getSourceName } from './utils'
import { useTVFetchedMusicList } from './useTVFetchedMusicList'

type FocusNode = ComponentRef<typeof Focusable> | null
type FocusRefMap = Record<string, FocusNode>
const ITEM_SIZE = 78

function TVQueue({ componentId }: { componentId: string }) {
  const currentMusicInfo = usePlayerMusicInfo()
  const fetchedMusicList = useTVFetchedMusicList()
  const [selectedIndex, setSelectedIndex] = useState(0)
  const playNowFocus = useTVFocusRef()
  const clearFocus = useTVFocusRef()
  const listRef = useRef<FlatList<LX.Music.MusicInfo>>(null)
  const queueRefs = useRef<FocusRefMap>({})

  useTVNavigationBack(componentId)

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
  const bindQueueRef = (key: string) => (node: FocusNode) => { queueRefs.current[key] = node }

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

  const handleClear = () => {
    void clearListMusics([LIST_IDS.TEMP])
    setSelectedIndex(0)
  }

  useTVRemoteActions({
    playPause: () => {
      if (currentMusicInfo.id) {
        pushTVPlayerScreen(componentId)
        return
      }
      if (selectedMusicInfo) void handlePlayNow(selectedIndex)
    },
    menu: () => { pushTVSettingsScreen(componentId) },
  })

  return (
    <TVAppleScaffold image={currentMusicInfo.pic}>
      <TVTopTabs items={createTVTabs(componentId)} activeId="queue" />
      <View style={styles.root}>
        <TVGlassPanel style={styles.listPanel}>
          <View style={styles.header}>
            <View>
              <TVText variant="pageTitle" style={styles.title}>{tvText.playlist}</TVText>
              <TVText variant="body" style={styles.subtitle}>{fetchedMusicList.length} {tvText.songs} · {selectedMusicInfo ? getSourceName(selectedMusicInfo.source) : tvText.aggregateSource}</TVText>
            </View>
            <View style={styles.actions}>
              <TVButton ref={playNowFocus.ref as any} label={selectedMusicInfo ? tvText.playNow : tvText.nowPlaying} onPress={() => { void handlePlayNow(selectedIndex) }} tone={selectedMusicInfo ? 'primary' : 'dark'} hasTVPreferredFocus nextFocusRight={clearFocus.getNodeHandle() ?? undefined} />
              <TVButton ref={clearFocus.ref as any} label={tvText.clearList} onPress={handleClear} tone={fetchedMusicList.length ? 'ghost' : 'dark'} nextFocusLeft={playNowFocus.getNodeHandle() ?? undefined} />
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
            renderItem={({ item, index }) => {
              const itemKey = getQueueItemKey(item, index)
              const prevKey = fetchedMusicList[index - 1] ? getQueueItemKey(fetchedMusicList[index - 1], index - 1) : null
              const nextKey = fetchedMusicList[index + 1] ? getQueueItemKey(fetchedMusicList[index + 1], index + 1) : null
              return (
                <TVMusicRow
                  ref={bindQueueRef(itemKey) as any}
                  index={index}
                  title={item.name ?? tvText.unknownSong}
                  subtitle={getMusicSubtitle(item)}
                  meta={item.interval ?? getSourceName(item.source)}
                  badge={currentMusicInfo.id === item.id ? tvText.nowPlaying : undefined}
                  lazyMusicInfo={item}
                  active={selectedIndex === index}
                  onFocus={() => { handleQueueFocus(index) }}
                  onPress={() => { void handlePlayNow(index) }}
                  nextFocusUp={index === 0 ? undefined : getQueueHandle(prevKey) ?? undefined}
                  nextFocusRight={playNowFocus.getNodeHandle() ?? undefined}
                  nextFocusDown={getQueueHandle(nextKey) ?? undefined}
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
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 18, gap: 24 },
  title: { fontSize: 48, lineHeight: 56 },
  subtitle: { marginTop: 8, color: tvColors.subtext },
  actions: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  listContent: { paddingBottom: 28 },
}

export default memo(TVQueue)
