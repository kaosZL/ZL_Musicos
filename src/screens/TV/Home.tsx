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
import { removeUserList } from '@/core/list'
import { getList as getSonglist } from '@/core/songlist'
import songlistState, { type ListInfoItem } from '@/store/songlist/state'
import { showTVDialog } from '@/components/TV/TVDialog'
import { useBackHandler } from '@/utils/hooks/useBackHandler'
import { useTVRemoteActions } from '@/utils/hooks/useTVRemoteActions'
import { confirmDialog, exitApp, tipDialog } from '@/utils/tools'
import { useTVFocusRef } from '@/components/TV/useTVFocusRef'
import { useTVFocusRefresh } from '@/components/TV/useTVFocusRefresh'
import { useNavigationComponentDidAppear } from '@/navigation/hooks'
import { pushTVDetailScreen, pushTVPlayerScreen, pushTVSearchScreen, pushTVSettingsScreen } from '@/navigation/navigation'
import { createTVTabs, getSourceName } from './utils'
import { dot, tvText } from './labels'

type FocusNode = ComponentRef<typeof Focusable> | null
type FocusRefMap = Record<string, FocusNode>
interface SonglistResult { ok: boolean, message: string }

// 手机端的导入/改名/删除结果缓存到模块级：首页被切走再回来时组件会重新挂载、
// state 会被重置，这里留一份，保证用户回到首页仍能看到「上次的结果」
let lastSonglistResultCache: SonglistResult | null = null

function TVHome({ componentId }: { componentId: string }) {
  const musicInfo = usePlayerMusicInfo()
  const isPlay = useIsPlay()
  const [songlists, setSonglists] = useState<ListInfoItem[]>([])
  // 手机端操作歌单的结果（由设置页广播），直接显示在首页，省得用户跑回设置页看
  const [importResult, setImportResult] = useState<SonglistResult | null>(() => lastSonglistResultCache)
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
    const handleImportResult = (result: SonglistResult) => {
      lastSonglistResultCache = result
      setImportResult(result)
    }
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

  // 性能关键：ref 回调必须保持稳定引用，并且只在「节点真的换了」时才触发刷新。
  // 若每次渲染都新建箭头函数，React 会在每次提交时先以 null、再以节点调用它，
  // cardRefs 里的引用随之看似变化 → queueFocusRefresh() → setState → 再渲染，
  // 于是形成每帧一次的重渲染死循环（首页 30 多张卡片、每帧上百次 findNodeHandle），
  // 表现就是遥控器移动焦点明显卡顿。这里做两件事：缓存回调 + 按节点去重通知。
  const cardRefCallbacks = useRef<Record<string, (node: FocusNode) => void>>({})
  const notifiedCardNodes = useRef<Record<string, FocusNode>>({})

  const getCardRefCallback = (group: 'my' | 'rec', key: string, syncFirst = false) => {
    const cacheKey = `${group}_${key}_${syncFirst ? 1 : 0}`
    let callback = cardRefCallbacks.current[cacheKey]
    if (!callback) {
      callback = (node: FocusNode) => {
        cardRefs.current[key] = node
        if (!node) return
        const target = group === 'my' ? myListFocus : firstCardFocus
        const needSyncFirst = syncFirst && target.ref.current !== node
        if (needSyncFirst) target.ref.current = node as any
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

  const handleRemoveSonglist = async(list: LX.List.UserListInfo) => {
    const confirmed = await confirmDialog({
      title: `${tvText.deleteSonglist}：${list.name}`,
      message: tvText.deleteSonglistConfirm,
      confirmButtonText: tvText.deleteSonglist,
      cancelButtonText: tvText.cancelAction,
    })
    if (!confirmed) return
    try {
      await removeUserList([list.id])
      // 歌单没了，聚焦的那张卡也被卸载了，重排一次焦点免得遥控器「悬空」
      queueFocusRefresh()
      await tipDialog({ title: tvText.deleteSonglistDone, message: list.name, btnText: tvText.knowIt })
    } catch (err: unknown) {
      await tipDialog({ title: tvText.deleteSonglistFailed, message: err instanceof Error ? err.message : '', btnText: tvText.knowIt })
    }
  }

  // 遥控器「长按 OK」= 歌单管理。改名必须在手机上做（电视遥控器输不了中文），
  // 所以这里只给操作说明 + 删除入口，避免让用户到处找入口。
  const handleManageSonglist = (list: LX.List.UserListInfo) => {
    showTVDialog({
      title: `${tvText.managingSonglist}：${list.name}`,
      message: tvText.renameSonglistNeedPhone,
      buttons: [
        { label: tvText.cancelAction, tone: 'dark' },
        { label: tvText.deleteSonglist, tone: 'danger', onPress: () => { void handleRemoveSonglist(list) } },
      ],
    })
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
                return <TVPosterCard key={key} ref={getCardRefCallback('my', key, index === 0) as any} title={item.name} subtitle={item.source ? getSourceName(item.source) : tvText.importSonglist} meta={tvText.longPressManage} size="medium" tint={index % 2 ? tvColors.primary : tvColors.purple} coverFallback="music" onFocus={() => { scrollToMySonglists() }} onTVFocusChange={handleMySonglistFocusChange} onPress={() => { openMySonglist(item) }} onLongPress={() => { handleManageSonglist(item) }} nextFocusUp={getActiveTabHandle() ?? undefined} nextFocusLeft={getCardHandle(prevKey) ?? undefined} nextFocusRight={getCardHandle(nextKey) ?? getCardHandle(key) ?? undefined} nextFocusDown={getCardHandle(recommendKey) ?? undefined} />
              })}
            </TVShelf>
          ) : (
            <TVShelf title={tvText.mySonglists} subtitle={tvText.mySonglistsDesc}>
              {/* 空态也做成可聚焦卡片：否则遥控器够不到这个区块，一往下走就被滚动条顶出屏幕。
                  再给一个 onPress —— 否则卡片提示「按 OK 去扫码页」却按了没反应，是个死胡同 */}
              <Focusable
                ref={getCardRefCallback('my', 'mylist_empty', true) as any}
                style={styles.emptyCard}
                focusStyle={styles.emptyCardFocus}
                onFocus={() => { scrollToMySonglists() }}
                onTVFocusChange={handleMySonglistFocusChange}
                onPress={() => { pushTVSettingsScreen(componentId) }}
                nextFocusUp={getActiveTabHandle() ?? undefined}
                nextFocusDown={getCardHandle(firstRecommendKey) ?? undefined}
              >
                <TVText variant="cardTitle">{tvText.emptyMySonglists}</TVText>
                <TVText variant="caption" color={tvColors.dimText} style={styles.emptyHint}>{tvText.emptyMySonglistsHint}</TVText>
              </Focusable>
            </TVShelf>
          )}
          {/* 结果提示常显：原来只在「一个歌单都没有」时才显示，导致导入第二个歌单后
              用户回到首页看不到任何反馈（会以为没导入成功） */}
          {importResult
            ? <TVText variant="caption" color={importResult.ok ? tvColors.primaryHigh : tvColors.warn} style={styles.resultLine}>{`${tvText.lastImportResult}${importResult.message}`}</TVText>
            : null}
        </View>

        <View onLayout={event => { sectionOffsetRef.current.songlists = event.nativeEvent.layout.y }}>
          <TVShelf title={tvText.recommendSonglist} subtitle={songlistSource ? `${getSourceName(songlistSource)}` : tvText.loading}>
            {songlists.map((item, index) => {
              const key = `songlist_${item.source}_${item.id}`
              const nextKey = songlists[index + 1] ? `songlist_${songlists[index + 1].source}_${songlists[index + 1].id}` : null
              const prevKey = songlists[index - 1] ? `songlist_${songlists[index - 1].source}_${songlists[index - 1].id}` : null
              const upKey = userSonglists[index] ? `mylist_${userSonglists[index].id}` : null
              return <TVPosterCard key={key} ref={getCardRefCallback('rec', key, index === 0) as any} title={item.name} subtitle={item.author || tvText.songlist} meta={item.play_count ? `${item.play_count}` : tvText.openSonglist} image={item.img} size="medium" tint={index % 2 ? tvColors.purple : tvColors.primary} onFocus={() => { scrollToSonglists() }} onTVFocusChange={handleSonglistFocusChange} onPress={() => { openSonglist(item) }} nextFocusUp={getCardHandle(upKey) ?? getCardHandle('mylist_empty') ?? getActiveTabHandle() ?? undefined} nextFocusLeft={getCardHandle(prevKey) ?? playFocus.getNodeHandle() ?? undefined} nextFocusRight={getCardHandle(nextKey) ?? getCardHandle(key) ?? undefined} nextFocusDown={getCardHandle(key) ?? undefined} />
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
  resultLine: { marginTop: tvSize(10), marginLeft: tvSize(6), lineHeight: tvSize(22) },
}

export default memo(TVHome)
