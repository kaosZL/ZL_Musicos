import { memo, useCallback, useEffect, useRef, useState, type ComponentRef } from 'react'
import { ScrollView, View, findNodeHandle, type ViewStyle } from 'react-native'
import TVAppleScaffold from '@/components/TV/TVAppleScaffold'
import TVTopTabs from '@/components/TV/TVTopTabs'
import TVHeroShelf from '@/components/TV/TVHeroShelf'
import TVShelf from '@/components/TV/TVShelf'
import TVPosterCard from '@/components/TV/TVPosterCard'
import TVButton from '@/components/TV/TVButton'
import type Focusable from '@/components/TV/Focusable'
import { tvColors, tvSize } from '@/theme/tv'
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
import { useNavigationComponentDidAppear } from '@/navigation/hooks'
import { pushTVDetailScreen, pushTVPlayerScreen, pushTVSearchScreen } from '@/navigation/navigation'
import { createTVTabs, getSourceName } from './utils'
import { dot, tvText } from './labels'
import { getData } from '@/plugins/storage'

type FocusNode = ComponentRef<typeof Focusable> | null
type FocusRefMap = Record<string, FocusNode>

function TVHome({ componentId }: { componentId: string }) {
  const musicInfo = usePlayerMusicInfo()
  const isPlay = useIsPlay()
  const [songlists, setSonglists] = useState<ListInfoItem[]>([])
  const playFocus = useTVFocusRef()
  const searchFocus = useTVFocusRef()
  const firstCardFocus = useTVFocusRef()
  const contentScrollRef = useRef<ComponentRef<typeof ScrollView>>(null)
  const activeTabFocus = useRef<FocusNode>(null)
  const cardRefs = useRef<FocusRefMap>({})
  const sectionOffsetRef = useRef({ hero: 0, songlists: 0 })
  const appearTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const queueFocusRefresh = useTVFocusRefresh()

  useEffect(() => { setComponentId(COMPONENT_IDS.home, componentId) }, [componentId])
  useEffect(() => () => {
    if (appearTimerRef.current) clearTimeout(appearTimerRef.current)
  }, [])
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
  })

  // 排行榜推荐源跟随排行榜页选择（09-22 老板需求）：
  // 持久化键 tv_board_source（History 页写入），未选过时回退 sources[0]（酷我）
  const [boardSource, setBoardSource] = useState<LX.OnlineSource | null>(null)
  const readBoardSource = useCallback(() => {
    void getData<LX.OnlineSource>('tv_board_source').then(saved => {
      if (saved && songlistState.sources.includes(saved)) setBoardSource(saved)
    }).catch(() => { })
  }, [])
  useEffect(() => { readBoardSource() }, [readBoardSource])
  const songlistSource = boardSource ?? songlistState.sources[0]
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

  // 性能关键：ref 回调必须保持稳定引用，并且只在「节点真的换了」时才触发刷新。
  // 若每次渲染都新建箭头函数，React 会在每次提交时先以 null、再以节点调用它，
  // cardRefs 里的引用随之看似变化 → queueFocusRefresh() → setState → 再渲染，
  // 于是形成每帧一次的重渲染死循环（首页 30 多张卡片、每帧上百次 findNodeHandle），
  // 表现就是遥控器移动焦点明显卡顿。这里做两件事：缓存回调 + 按节点去重通知。
  const cardRefCallbacks = useRef<Record<string, (node: FocusNode) => void>>({})
  const notifiedCardNodes = useRef<Record<string, FocusNode>>({})

  const getCardRefCallback = (key: string, syncFirst = false) => {
    const cacheKey = `${key}_${syncFirst ? 1 : 0}`
    let callback = cardRefCallbacks.current[cacheKey]
    if (!callback) {
      callback = (node: FocusNode) => {
        cardRefs.current[key] = node
        if (!node) return
        const needSyncFirst = syncFirst && firstCardFocus.ref.current !== node
        if (needSyncFirst) firstCardFocus.ref.current = node as any
        const freshNode = notifiedCardNodes.current[key] !== node
        if (freshNode) notifiedCardNodes.current[key] = node
        if (freshNode || needSyncFirst) queueFocusRefresh()
      }
      cardRefCallbacks.current[cacheKey] = callback
    }
    return callback
  }
  const getActiveTabHandle = () => activeTabFocus.current ? findNodeHandle(activeTabFocus.current) : null
  const getCardHandle = (key?: string | null) => key && cardRefs.current[key] ? findNodeHandle(cardRefs.current[key]) : null
  const scrollToHero = useCallback((animated = true) => {
    contentScrollRef.current?.scrollTo({ y: Math.max(0, sectionOffsetRef.current.hero - tvSize(12)), animated })
  }, [])
  const scrollToSonglists = useCallback((animated = true) => {
    contentScrollRef.current?.scrollTo({ y: Math.max(0, sectionOffsetRef.current.songlists - tvSize(18)), animated })
  }, [])
  const handleHeroFocusChange = useCallback((focused: boolean) => {
    if (focused) scrollToHero()
  }, [scrollToHero])
  const handleSonglistFocusChange = useCallback((focused: boolean) => {
    if (focused) scrollToSonglists()
  }, [scrollToSonglists])

  useNavigationComponentDidAppear(componentId, useCallback(() => {
    const resetHomeContent = () => { scrollToHero(false) }
    requestAnimationFrame(resetHomeContent)
    if (appearTimerRef.current) clearTimeout(appearTimerRef.current)
    appearTimerRef.current = setTimeout(() => {
      appearTimerRef.current = null
      resetHomeContent()
    }, 260)
    // 回到首页时重读排行榜页选的源，推荐架即时跟随（09-22）
    readBoardSource()
    queueFocusRefresh()
  }, [queueFocusRefresh, readBoardSource, scrollToHero]))

  const openSonglist = (songlist: ListInfoItem) => {
    pushTVDetailScreen(componentId, { type: 'songlist', id: songlist.id, source: songlist.source, title: songlist.name, subtitle: songlist.desc ?? songlist.author, songlist })
  }

  const heroTitle = musicInfo.name || tvText.livingRoom
  const heroSubtitle = musicInfo.id
    ? `${musicInfo.singer || tvText.unknownSinger}${dot}${isPlay ? tvText.playing : tvText.paused}`
    : tvText.allMusicDesc
  // Hero 上按「下」落到第一张推荐歌单卡：「我的歌单」已搬到顶部 Tab，不再出现在首页，
  // 所以焦点链改为指向下方第一条推荐内容（firstCardFocus 由首张推荐卡同步）。
  const heroNextDownHandle = firstCardFocus.getNodeHandle()

  return (
    <TVAppleScaffold image={musicInfo.pic}>
      <TVTopTabs items={createTVTabs(componentId)} activeId="home" hasTVPreferredFocus nextFocusDown={playFocus.getNodeHandle() ?? undefined} activeTabRef={activeTabFocus as any} onActiveTabReady={queueFocusRefresh} />
      <ScrollView ref={contentScrollRef} showsVerticalScrollIndicator={false}>
        <View onLayout={event => { sectionOffsetRef.current.hero = event.nativeEvent.layout.y }}>
          <TVHeroShelf kicker={tvText.todayRecommend} title={heroTitle} subtitle={heroSubtitle} image={musicInfo.pic}>
            <TVButton ref={playFocus.ref as any} label={musicInfo.id ? '查看详情' : tvText.searchSong} tone="dark" onFocus={() => { scrollToHero() }} onTVFocusChange={handleHeroFocusChange} onPress={() => {
              if (musicInfo.id) { pushTVPlayerScreen(componentId); return }
              pushTVSearchScreen(componentId)
            }} nextFocusUp={getActiveTabHandle() ?? undefined} nextFocusRight={searchFocus.getNodeHandle() ?? undefined} nextFocusDown={heroNextDownHandle ?? undefined} />
            <TVButton ref={searchFocus.ref as any} label={tvText.search} tone="dark" onFocus={() => { scrollToHero() }} onTVFocusChange={handleHeroFocusChange} onPress={() => { pushTVSearchScreen(componentId) }} nextFocusUp={getActiveTabHandle() ?? undefined} nextFocusLeft={playFocus.getNodeHandle() ?? undefined} nextFocusDown={heroNextDownHandle ?? undefined} />
          </TVHeroShelf>
        </View>

        <View onLayout={event => { sectionOffsetRef.current.songlists = event.nativeEvent.layout.y }}>
          <TVShelf title={tvText.recommendSonglist} subtitle={songlistSource ? `${getSourceName(songlistSource)}` : tvText.loading}>
            {songlists.map((item, index) => {
              const key = `songlist_${item.source}_${item.id}`
              const nextKey = songlists[index + 1] ? `songlist_${songlists[index + 1].source}_${songlists[index + 1].id}` : null
              const prevKey = songlists[index - 1] ? `songlist_${songlists[index - 1].source}_${songlists[index - 1].id}` : null
              return <TVPosterCard key={key} ref={getCardRefCallback(key, index === 0) as any} title={item.name} subtitle={item.author || tvText.songlist} meta={item.play_count ? `${item.play_count}` : tvText.openSonglist} image={item.img} size="medium" tint={index % 2 ? tvColors.purple : tvColors.primary} onFocus={() => { scrollToSonglists() }} onTVFocusChange={handleSonglistFocusChange} onPress={() => { openSonglist(item) }} nextFocusUp={getActiveTabHandle() ?? undefined} nextFocusLeft={getCardHandle(prevKey) ?? playFocus.getNodeHandle() ?? undefined} nextFocusRight={getCardHandle(nextKey) ?? getCardHandle(key) ?? undefined} nextFocusDown={getCardHandle(key) ?? undefined} />
            })}
          </TVShelf>
        </View>
        <View style={styles.bottomSpace} />
      </ScrollView>
    </TVAppleScaffold>
  )
}

const styles: Record<string, ViewStyle | any> = {
  bottomSpace: { height: 60 },
}

export default memo(TVHome)
