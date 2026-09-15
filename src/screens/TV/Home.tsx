import { memo, useCallback, useEffect, useMemo, useRef, useState, type ComponentRef } from 'react'
import { ScrollView, View, findNodeHandle, type ViewStyle } from 'react-native'
import TVAppleScaffold from '@/components/TV/TVAppleScaffold'
import TVTopTabs from '@/components/TV/TVTopTabs'
import TVHeroShelf from '@/components/TV/TVHeroShelf'
import TVShelf from '@/components/TV/TVShelf'
import TVPosterCard from '@/components/TV/TVPosterCard'
import TVButton from '@/components/TV/TVButton'
import TVText from '@/components/TV/TVText'
import Focusable from '@/components/TV/Focusable'
import { tvColors, tvSize } from '@/theme/tv'
import { setComponentId } from '@/core/common'
import { COMPONENT_IDS, LIST_IDS } from '@/config/constant'
import { togglePlay } from '@/core/player/player'
import { useIsPlay, usePlayerMusicInfo } from '@/store/player/hook'
import { useMyList } from '@/store/list/hook'
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

type FocusNode = ComponentRef<typeof Focusable> | null
type FocusRefMap = Record<string, FocusNode>

function TVHome({ componentId }: { componentId: string }) {
  const musicInfo = usePlayerMusicInfo()
  const isPlay = useIsPlay()
  const [songlists, setSonglists] = useState<ListInfoItem[]>([])
  // 手机导入歌单的结果（由设置页广播），歌单为空时直接显示在首页，省得用户跑回设置页看
  const [importResult, setImportResult] = useState<{ ok: boolean, message: string } | null>(null)
  const playFocus = useTVFocusRef()
  const searchFocus = useTVFocusRef()
  const myListFocus = useTVFocusRef()
  const firstCardFocus = useTVFocusRef()
  const contentScrollRef = useRef<ComponentRef<typeof ScrollView>>(null)
  const activeTabFocus = useRef<FocusNode>(null)
  const cardRefs = useRef<FocusRefMap>({})
  const sectionOffsetRef = useRef({ hero: 0, mySonglists: 0, songlists: 0 })
  const appearTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const queueFocusRefresh = useTVFocusRefresh()

  useEffect(() => { setComponentId(COMPONENT_IDS.home, componentId) }, [componentId])
  useEffect(() => {
    const handleImportResult = (result: { ok: boolean, message: string }) => { setImportResult(result) }
    global.app_event.on('songlistImportResult', handleImportResult)
    return () => { global.app_event.off('songlistImportResult', handleImportResult) }
  }, [])
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

  const songlistSource = songlistState.sources[0]
  const sortId = songlistSource ? songlistState.sortList[songlistSource]?.[0]?.id : ''

  // 「我的歌单」只展示用户自己建的（含手机导入的）列表，试听列表/我的收藏不在这里重复出现
  const allLists = useMyList()
  const userSonglists = useMemo(
    () => allLists.filter((item): item is LX.List.UserListInfo => item.id !== LIST_IDS.DEFAULT && item.id !== LIST_IDS.LOVE).slice(0, 20),
    [allLists],
  )

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
    const changed = cardRefs.current[key] !== node
    cardRefs.current[key] = node
    if (node && changed) queueFocusRefresh()
    if (syncFirst && node && firstCardFocus.ref.current !== node) {
      firstCardFocus.ref.current = node as any
      queueFocusRefresh()
    }
  }
  const bindMyCardRef = (key: string, syncFirst = false) => (node: FocusNode) => {
    const changed = cardRefs.current[key] !== node
    cardRefs.current[key] = node
    if (node && changed) queueFocusRefresh()
    if (syncFirst && node && myListFocus.ref.current !== node) {
      myListFocus.ref.current = node as any
      queueFocusRefresh()
    }
  }
  const getActiveTabHandle = () => activeTabFocus.current ? findNodeHandle(activeTabFocus.current) : null
  const getCardHandle = (key?: string | null) => key && cardRefs.current[key] ? findNodeHandle(cardRefs.current[key]) : null
  const scrollToHero = useCallback((animated = true) => {
    contentScrollRef.current?.scrollTo({ y: Math.max(0, sectionOffsetRef.current.hero - tvSize(12)), animated })
  }, [])
  const scrollToMySonglists = useCallback((animated = true) => {
    contentScrollRef.current?.scrollTo({ y: Math.max(0, sectionOffsetRef.current.mySonglists - tvSize(18)), animated })
  }, [])
  const scrollToSonglists = useCallback((animated = true) => {
    contentScrollRef.current?.scrollTo({ y: Math.max(0, sectionOffsetRef.current.songlists - tvSize(18)), animated })
  }, [])
  const handleHeroFocusChange = useCallback((focused: boolean) => {
    if (focused) scrollToHero()
  }, [scrollToHero])
  const handleMySonglistFocusChange = useCallback((focused: boolean) => {
    if (focused) scrollToMySonglists()
  }, [scrollToMySonglists])
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
    queueFocusRefresh()
  }, [queueFocusRefresh, scrollToHero]))

  const openSonglist = (songlist: ListInfoItem) => {
    pushTVDetailScreen(componentId, { type: 'songlist', id: songlist.id, source: songlist.source, title: songlist.name, subtitle: songlist.desc ?? songlist.author, songlist })
  }

  const openMySonglist = (list: LX.List.UserListInfo) => {
    pushTVDetailScreen(componentId, { type: 'userlist', id: list.id, title: list.name, subtitle: list.source ? getSourceName(list.source) : undefined, source: list.source, userlist: list })
  }

  const heroTitle = musicInfo.name || tvText.livingRoom
  const heroSubtitle = musicInfo.id
    ? `${musicInfo.singer || tvText.unknownSinger}${dot}${isPlay ? tvText.playing : tvText.paused}`
    : tvText.allMusicDesc
  // Hero 上按「下」优先落到「我的歌单」：有歌单时是第一张卡，没有时是那张空态卡片（能被选到、能看到导入提示）
  const heroNextDownHandle = myListFocus.getNodeHandle() ?? firstCardFocus.getNodeHandle()
  const firstRecommendKey = songlists[0] ? `songlist_${songlists[0].source}_${songlists[0].id}` : null

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

        <View onLayout={event => { sectionOffsetRef.current.mySonglists = event.nativeEvent.layout.y }}>
          {userSonglists.length ? (
            <TVShelf title={tvText.mySonglists} subtitle={tvText.mySonglistsDesc}>
              {userSonglists.map((item, index) => {
                const key = `mylist_${item.id}`
                const nextKey = userSonglists[index + 1] ? `mylist_${userSonglists[index + 1].id}` : null
                const prevKey = userSonglists[index - 1] ? `mylist_${userSonglists[index - 1].id}` : null
                const recommendKey = songlists[0] ? `songlist_${songlists[0].source}_${songlists[0].id}` : null
                return <TVPosterCard key={key} ref={bindMyCardRef(key, index === 0) as any} title={item.name} subtitle={item.source ? getSourceName(item.source) : tvText.importSonglist} meta={tvText.openSonglist} size="medium" tint={index % 2 ? tvColors.primary : tvColors.purple} onFocus={() => { scrollToMySonglists() }} onTVFocusChange={handleMySonglistFocusChange} onPress={() => { openMySonglist(item) }} nextFocusUp={getActiveTabHandle() ?? undefined} nextFocusLeft={getCardHandle(prevKey) ?? undefined} nextFocusRight={getCardHandle(nextKey) ?? getCardHandle(key) ?? undefined} nextFocusDown={getCardHandle(recommendKey) ?? undefined} />
              })}
            </TVShelf>
          ) : (
            <TVShelf title={tvText.mySonglists} subtitle={tvText.mySonglistsDesc}>
              {/* 空态也做成可聚焦卡片：否则遥控器够不到这个区块，一往下走就被滚动条顶出屏幕 */}
              <Focusable
                ref={bindMyCardRef('mylist_empty', true) as any}
                style={styles.emptyCard}
                focusStyle={styles.emptyCardFocus}
                onFocus={() => { scrollToMySonglists() }}
                onTVFocusChange={handleMySonglistFocusChange}
                nextFocusUp={getActiveTabHandle() ?? undefined}
                nextFocusDown={getCardHandle(firstRecommendKey) ?? undefined}
              >
                <TVText variant="cardTitle">{tvText.emptyMySonglists}</TVText>
                {importResult
                  ? <TVText variant="caption" color={importResult.ok ? tvColors.primaryHigh : tvColors.warn} style={styles.emptyHint}>{`上次导入结果：${importResult.message}`}</TVText>
                  : null}
                <TVText variant="caption" color={tvColors.dimText} style={styles.emptyHint}>{tvText.emptyMySonglistsHint}</TVText>
              </Focusable>
            </TVShelf>
          )}
        </View>

        <View onLayout={event => { sectionOffsetRef.current.songlists = event.nativeEvent.layout.y }}>
          <TVShelf title={tvText.recommendSonglist} subtitle={songlistSource ? `${getSourceName(songlistSource)}` : tvText.loading}>
            {songlists.map((item, index) => {
              const key = `songlist_${item.source}_${item.id}`
              const nextKey = songlists[index + 1] ? `songlist_${songlists[index + 1].source}_${songlists[index + 1].id}` : null
              const prevKey = songlists[index - 1] ? `songlist_${songlists[index - 1].source}_${songlists[index - 1].id}` : null
              const upKey = userSonglists[index] ? `mylist_${userSonglists[index].id}` : null
              return <TVPosterCard key={key} ref={bindFirstCardRef(key, index === 0) as any} title={item.name} subtitle={item.author || tvText.songlist} meta={item.play_count ? `${item.play_count}` : tvText.openSonglist} image={item.img} size="medium" tint={index % 2 ? tvColors.purple : tvColors.primary} onFocus={() => { scrollToSonglists() }} onTVFocusChange={handleSonglistFocusChange} onPress={() => { openSonglist(item) }} nextFocusUp={getCardHandle(upKey) ?? getCardHandle('mylist_empty') ?? getActiveTabHandle() ?? undefined} nextFocusLeft={getCardHandle(prevKey) ?? playFocus.getNodeHandle() ?? undefined} nextFocusRight={getCardHandle(nextKey) ?? getCardHandle(key) ?? undefined} nextFocusDown={getCardHandle(key) ?? undefined} />
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
  emptyCard: { width: tvSize(460), borderRadius: tvSize(18), borderWidth: 1, borderColor: tvColors.border, backgroundColor: 'rgba(255,255,255,0.04)', padding: tvSize(18), gap: tvSize(8) },
  emptyCardFocus: { borderColor: tvColors.primaryHigh, backgroundColor: 'rgba(255,255,255,0.08)' },
  emptyHint: { lineHeight: tvSize(22) },
}

export default memo(TVHome)
