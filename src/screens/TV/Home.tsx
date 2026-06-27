import { memo, useEffect, useRef, useState, type ComponentRef } from 'react'
import { ScrollView, View, findNodeHandle, type ViewStyle } from 'react-native'
import TVAppleScaffold from '@/components/TV/TVAppleScaffold'
import TVTopTabs from '@/components/TV/TVTopTabs'
import TVHeroShelf from '@/components/TV/TVHeroShelf'
import TVShelf from '@/components/TV/TVShelf'
import TVPosterCard from '@/components/TV/TVPosterCard'
import TVButton from '@/components/TV/TVButton'
import type Focusable from '@/components/TV/Focusable'
import { tvColors } from '@/theme/tv'
import { setComponentId } from '@/core/common'
import { COMPONENT_IDS } from '@/config/constant'
import { togglePlay } from '@/core/player/player'
import { useIsPlay, usePlayerMusicInfo } from '@/store/player/hook'
import { getList as getSonglist } from '@/core/songlist'
import songlistState, { type ListInfoItem } from '@/store/songlist/state'
import { useBackHandler } from '@/utils/hooks/useBackHandler'
import { useTVRemoteActions } from '@/utils/hooks/useTVRemoteActions'
import { exitApp } from '@/utils/tools'
import { useTVFocusRef } from '@/components/TV/useTVFocusRef'
import { useTVFocusRefresh } from '@/components/TV/useTVFocusRefresh'
import { pushTVDetailScreen, pushTVPlayerScreen, pushTVSearchScreen, pushTVSettingsScreen } from '@/navigation/navigation'
import { createTVTabs, getSourceName } from './utils'
import { dot, tvText } from './labels'

type FocusNode = ComponentRef<typeof Focusable> | null
type FocusRefMap = Record<string, FocusNode>

function TVHome({ componentId }: { componentId: string }) {
  const musicInfo = usePlayerMusicInfo()
  const isPlay = useIsPlay()
  const [songlists, setSonglists] = useState<ListInfoItem[]>([])
  const playFocus = useTVFocusRef()
  const searchFocus = useTVFocusRef()
  const firstCardFocus = useTVFocusRef()
  const activeTabFocus = useRef<FocusNode>(null)
  const cardRefs = useRef<FocusRefMap>({})
  const queueFocusRefresh = useTVFocusRefresh()

  useEffect(() => { setComponentId(COMPONENT_IDS.home, componentId) }, [componentId])
  useBackHandler(() => { exitApp(); return true })

  useTVRemoteActions({
    playPause: () => {
      if (musicInfo.id) {
        togglePlay()
        pushTVPlayerScreen(componentId)
        return
      }
      pushTVSearchScreen(componentId)
    },
    menu: () => { pushTVSettingsScreen(componentId) },
  })

  const songlistSource = songlistState.sources[0]
  const sortId = songlistSource ? songlistState.sortList[songlistSource]?.[0]?.id : ''

  useEffect(() => {
    let mounted = true
    const load = async() => {
      try {
        const emptySonglistResult: Awaited<ReturnType<typeof getSonglist>> = {
          list: [],
          total: 0,
          page: 1,
          limit: 30,
          maxPage: 1,
          key: null,
          source: songlistSource ?? 'kw',
          tagId: '',
          sortId: sortId ?? '',
        }
        const songlistResult = songlistSource && sortId ? await getSonglist(songlistSource, '', sortId, 1) : emptySonglistResult
        if (!mounted) return
        setSonglists(songlistResult.list.slice(0, 12))
      } catch {
        if (!mounted) return
        setSonglists([])
      }
    }
    void load()
    return () => { mounted = false }
  }, [songlistSource, sortId])

  const bindFirstCardRef = (key: string, syncFirst = false) => (node: FocusNode) => {
    cardRefs.current[key] = node
    if (syncFirst && node && firstCardFocus.ref.current !== node) {
      firstCardFocus.ref.current = node as any
      queueFocusRefresh()
    }
  }
  const getActiveTabHandle = () => activeTabFocus.current ? findNodeHandle(activeTabFocus.current) : null
  const getCardHandle = (key?: string | null) => key && cardRefs.current[key] ? findNodeHandle(cardRefs.current[key]) : null

  const openSonglist = (songlist: ListInfoItem) => {
    pushTVDetailScreen(componentId, { type: 'songlist', id: songlist.id, source: songlist.source, title: songlist.name, subtitle: songlist.desc ?? songlist.author, songlist })
  }

  const heroTitle = musicInfo.name || tvText.livingRoom
  const heroSubtitle = musicInfo.id
    ? `${musicInfo.singer || tvText.unknownSinger}${dot}${isPlay ? tvText.playing : tvText.paused}`
    : tvText.allMusicDesc

  return (
    <TVAppleScaffold image={musicInfo.pic}>
      <TVTopTabs items={createTVTabs(componentId)} activeId="home" hasTVPreferredFocus nextFocusDown={playFocus.getNodeHandle() ?? undefined} activeTabRef={activeTabFocus as any} onActiveTabReady={queueFocusRefresh} />
      <ScrollView showsVerticalScrollIndicator={false}>
        <TVHeroShelf kicker={tvText.todayRecommend} title={heroTitle} subtitle={heroSubtitle} image={musicInfo.pic}>
         <TVButton ref={playFocus.ref as any} label={musicInfo.id ? (isPlay ? tvText.pause : tvText.continuePlay) : tvText.searchSong} onPress={() => {
           if (musicInfo.id) { togglePlay(); pushTVPlayerScreen(componentId); return }
           pushTVSearchScreen(componentId)
         }} nextFocusUp={getActiveTabHandle() ?? undefined} nextFocusRight={searchFocus.getNodeHandle() ?? undefined} nextFocusDown={firstCardFocus.getNodeHandle() ?? undefined} />
          <TVButton ref={searchFocus.ref as any} label={tvText.search} tone="dark" onPress={() => { pushTVSearchScreen(componentId) }} nextFocusUp={getActiveTabHandle() ?? undefined} nextFocusLeft={playFocus.getNodeHandle() ?? undefined} nextFocusDown={firstCardFocus.getNodeHandle() ?? undefined} />
        </TVHeroShelf>

        <TVShelf title={tvText.recommendSonglist} subtitle={songlistSource ? `${getSourceName(songlistSource)}` : tvText.loading}>
          {songlists.map((item, index) => {
            const key = `songlist_${item.source}_${item.id}`
            const nextKey = songlists[index + 1] ? `songlist_${songlists[index + 1].source}_${songlists[index + 1].id}` : null
            const prevKey = songlists[index - 1] ? `songlist_${songlists[index - 1].source}_${songlists[index - 1].id}` : null
            return <TVPosterCard key={key} ref={bindFirstCardRef(key, index === 0) as any} title={item.name} subtitle={item.author || tvText.songlist} meta={item.play_count ? `${item.play_count}` : tvText.openSonglist} image={item.img} size="medium" tint={index % 2 ? tvColors.purple : tvColors.primary} onPress={() => { openSonglist(item) }} nextFocusUp={getActiveTabHandle() ?? playFocus.getNodeHandle() ?? undefined} nextFocusLeft={getCardHandle(prevKey) ?? undefined} nextFocusRight={getCardHandle(nextKey) ?? undefined} />
          })}
        </TVShelf>
        <View style={styles.bottomSpace} />
      </ScrollView>
    </TVAppleScaffold>
  )
}

const styles: Record<string, ViewStyle | any> = {
  bottomSpace: { height: 60 },
}

export default memo(TVHome)
