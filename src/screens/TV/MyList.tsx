import { memo, useCallback, useEffect, useMemo, useRef, useState, type ComponentRef } from 'react'
import { ScrollView, View, type TextStyle, type ViewStyle } from 'react-native'
import TVAppleScaffold from '@/components/TV/TVAppleScaffold'
import TVTopTabs from '@/components/TV/TVTopTabs'
import TVText from '@/components/TV/TVText'
import TVPosterCard from '@/components/TV/TVPosterCard'
import TVGlassPanel from '@/components/TV/TVGlassPanel'
import Focusable from '@/components/TV/Focusable'
import TVDialog, { type TVDialogRequest } from '@/components/TV/TVDialog'
import { tvColors, tvSize } from '@/theme/tv'
import { useMyList } from '@/store/list/hook'
import { removeUserList, getListMusics } from '@/core/list'
import { LIST_IDS } from '@/config/constant'
import { usePlayerMusicInfo } from '@/store/player/hook'
import { pushTVDetailScreen, pushTVPlayerScreen, pushTVRenameScreen, pushTVSettingsScreen } from '@/navigation/navigation'
import { confirmDialog, tipDialog } from '@/utils/tools'
import { useTVFocusRef } from '@/components/TV/useTVFocusRef'
import { useTVFocusRefresh } from '@/components/TV/useTVFocusRefresh'
import { useTVNavigationBack } from '@/utils/hooks/useTVNavigationBack'
import { useTVRemoteActions } from '@/utils/hooks/useTVRemoteActions'
import { tvText } from './labels'
import { createTVTabs, getSourceName } from './utils'

type FocusNode = ComponentRef<typeof Focusable> | null
type FocusRefMap = Record<string, FocusNode>
interface SonglistResult { ok: boolean, message: string }

// 手机端导入/改名/删除的结果缓存在模块级：本页被切走再回来时组件会重新挂载、
// state 会被重置，这里留一份，保证用户回到本页仍能看到「上次的结果」。
let lastSonglistResultCache: SonglistResult | null = null

// 常驻的「导入歌单」入口卡片。这张卡任何时候都在（空态时它兼任空态提示），
// 所以 key 用固定的 IMPORT_CARD_KEY，不随歌单数量变化。
const IMPORT_CARD_KEY = '__mylist_import__'

// 面板内边距。抽成常量是为了让「聚焦滚动」的坐标换算与 styles.panel 用同一个值，不会各写一份。
const PANEL_PADDING = tvSize(28)

function TVMyList({ componentId }: { componentId: string }) {
  const musicInfo = usePlayerMusicInfo()
  const allLists = useMyList()
  // 「我的歌单」只展示用户自己建的（含手机导入的）列表，试听列表/我的收藏不在这里重复出现
  const userSonglists = useMemo(
    () => allLists.filter((item): item is LX.List.UserListInfo => item.id !== LIST_IDS.DEFAULT && item.id !== LIST_IDS.LOVE),
    [allLists],
  )
  // 卡片带歌曲数：自动命名的歌单名几乎一样，没数量分不出哪张是哪张（09-19 实测：加完歌不知道加到哪张了）；
  // 歌单内容/列表结构变化时实时重算，从播放列表加完歌回本页，数量立刻更新
  const [songCounts, setSongCounts] = useState<Record<string, number>>({})
  // 卡片封面：取每个歌单第一首歌的专辑图（没有则保持占位图）；「我的收藏」一并计数（09-20 需求）
  const [cardCovers, setCardCovers] = useState<Record<string, string>>({})
  useEffect(() => {
    let mounted = true
    const load = async() => {
      const targetIds = [LIST_IDS.LOVE, ...userSonglists.map(list => list.id)]
      const results = await Promise.all(targetIds.map(async(id): Promise<[string, number, string]> => {
        const musics = await getListMusics(id)
        const first = musics[0] as unknown as { meta?: { picUrl?: string | null } } | undefined
        const pic = first?.meta?.picUrl ?? ''
        return [id, musics.length, pic]
      }))
      if (!mounted) return
      setSongCounts(Object.fromEntries(results.map(([id, count]) => [id, count])))
      setCardCovers(Object.fromEntries(results.map(([id, , pic]) => [id, pic])))
    }
    void load()
    const handleMusicUpdate = (ids: string[]) => {
      if (ids.some(id => id === LIST_IDS.LOVE || userSonglists.some(list => list.id === id))) void load()
    }
    const handleListsChanged = () => { void load() }
    global.app_event.on('myListMusicUpdate', handleMusicUpdate)
    global.state_event.on('mylistUpdated', handleListsChanged)
    return () => {
      mounted = false
      global.app_event.off('myListMusicUpdate', handleMusicUpdate)
      global.state_event.off('mylistUpdated', handleListsChanged)
    }
  }, [userSonglists])
  // 手机端操作歌单的结果（由设置页广播），直接显示在本页
  const [importResult, setImportResult] = useState<SonglistResult | null>(() => lastSonglistResultCache)
  const [localDialog, setLocalDialog] = useState<TVDialogRequest | null>(null)
  const firstCardFocus = useTVFocusRef()
  const cardRefs = useRef<FocusRefMap>({})
  const listRefresh = useTVFocusRefresh()

  // ── 「聚焦即滚动」 ──────────────────────────────────────────────
  // 本页 ScrollView 原先没有任何滚动管理：卡片换行到第二排及以后时，整排在屏幕外，
  // 但焦点引擎用 measureInWindow 仍量得到（rect 只是 y 越界）→ 焦点能移过去、用户却看不见。
  // Home.tsx 已有同款做法；这里按「聚焦到哪张卡，就把那张卡所在的【整排】露出来」实现，
  // 比 Home 多一步：Home 每屏只有一排（shelf），本页是 flexWrap 多排网格，只滚到面板顶不够
  // （实测 960x540dp 6 张卡时仍有 5 张在屏外）。
  const contentScrollRef = useRef<ComponentRef<typeof ScrollView>>(null)
  const scrollYRef = useRef(0) // 当前滚动位移（onScroll，仅写 ref → 不触发重渲染）
  const viewportHRef = useRef(0) // ScrollView 可视高度（onLayout）
  const panelTopRef = useRef(0) // 面板在「滚动内容」坐标系里的 y（onLayout 挂在 ScrollView 直接子节点）
  const cardBoxes = useRef<Record<string, { y: number, height: number }>>({})

  const recordCardBox = (key: string, y: number, height: number) => {
    const prev = cardBoxes.current[key]
    if (prev && prev.y === y && prev.height === height) return
    cardBoxes.current[key] = { y, height }
  }

  // 只在「该排没完整露出来」时才滚动，且只滚最小距离 —— 内容放得下时是纯 no-op
  const revealCardRow = useCallback((key: string) => {
    const scroller = contentScrollRef.current
    const box = cardBoxes.current[key]
    const viewport = viewportHRef.current
    if (!scroller || !box || viewport <= 0) return
    const margin = tvSize(12)
    // 卡片是 grid 的直接子节点，onLayout.y 相对 grid；grid 又在面板内、距面板顶一个 PANEL_PADDING
    const rowTop = panelTopRef.current + PANEL_PADDING + box.y
    const rowBottom = rowTop + box.height
    const y = scrollYRef.current
    if (rowBottom > y + viewport - margin) {
      scroller.scrollTo({ y: rowBottom - viewport + margin, animated: true })
    } else if (rowTop < y + margin) {
      scroller.scrollTo({ y: Math.max(0, rowTop - margin), animated: true })
    }
  }, [])

  useEffect(() => {
    const handleImportResult = (result: SonglistResult) => {
      lastSonglistResultCache = result
      setImportResult(result)
    }
    global.app_event.on('songlistImportResult', handleImportResult)
    return () => { global.app_event.off('songlistImportResult', handleImportResult) }
  }, [])

  // 页面挂载后补一次延迟刷新：首次渲染时卡片 ref 为空 → 顶部 Tab 的 nextFocusDown 拿不到句柄，
  // 引擎找不到「下」的目标，焦点会「悬空」。
  const mountRefreshRef = useRef(false)
  useEffect(() => {
    if (mountRefreshRef.current) return
    mountRefreshRef.current = true
    const timer = setTimeout(() => { listRefresh() }, 350)
    return () => { clearTimeout(timer) }
  }, [listRefresh])

  useTVNavigationBack(componentId)
  useTVRemoteActions({
    playPause: () => { if (musicInfo.id) pushTVPlayerScreen(componentId) },
  })

  // 性能关键：ref 回调必须保持稳定引用，并且只在「节点真的换了」时才触发刷新。
  // 若每次渲染都新建箭头函数，React 会在每次提交时先以 null、再以节点调用它，
  // cardRefs 里的引用随之看似变化 → listRefresh() → setState → 再渲染，
  // 于是形成每帧一次的重渲染死循环，遥控器移动焦点会明显卡顿。
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
        if (freshNode || needSyncFirst) listRefresh()
      }
      cardRefCallbacks.current[cacheKey] = callback
    }
    return callback
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
      listRefresh()
      await tipDialog({ title: tvText.deleteSonglistDone, message: list.name, btnText: tvText.knowIt })
    } catch (err: unknown) {
      await tipDialog({ title: tvText.deleteSonglistFailed, message: err instanceof Error ? err.message : '', btnText: tvText.knowIt })
    }
  }

  // 遥控器「长按 OK」= 歌单管理。改名现在可以直接在电视上做（屏上键盘），
  // 但电视遥控器输不了中文，所以仍保留「去手机改」的说明。
  const handleManageSonglist = (list: LX.List.UserListInfo) => {
    setLocalDialog({
      title: `${tvText.managingSonglist}：${list.name}`,
      message: tvText.renameSonglistNeedPhone,
      buttons: [
        { label: tvText.cancelAction, tone: 'dark' },
        { label: tvText.renameAction, tone: 'primary', onPress: () => { pushTVRenameScreen(componentId, { id: list.id, name: list.name }) } },
        { label: tvText.deleteSonglist, tone: 'danger', onPress: () => { void handleRemoveSonglist(list) } },
      ],
    })
  }

  const hasLists = userSonglists.length > 0

  return (
    <TVAppleScaffold image={musicInfo.pic}>
      <TVTopTabs items={createTVTabs(componentId)} activeId="mylist" hasTVPreferredFocus nextFocusDown={firstCardFocus.getNodeHandle() ?? undefined} />
      {/* 聚焦即滚动：ScrollView 记录滚动位移 / 可视高度，卡片获焦时把它所在的【整排】滚进视野（见上方 revealCardRow） */}
      <ScrollView
        ref={contentScrollRef}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.content}
        scrollEventThrottle={16}
        onScroll={(e) => { scrollYRef.current = e.nativeEvent.contentOffset.y }}
        onLayout={(e) => { viewportHRef.current = e.nativeEvent.layout.height }}
      >
        <View style={styles.header}>
          <TVText variant="pageTitle">{tvText.mySonglists}</TVText>
          <TVText variant="body" style={styles.subtitle}>{hasLists ? `${userSonglists.length} ${tvText.songlist}` : tvText.emptyMySonglists}</TVText>
          <TVText variant="caption" color={tvColors.dimText} style={styles.hint}>{tvText.myListHint}</TVText>
        </View>
        {/* TVGlassPanel 只透传 style/accent、不接受 onLayout，量不到面板在【滚动内容坐标系】里的 y；
            这里外套一层透明 View 专门取这个 y，作为 revealCardRow 的坐标基准 */}
        <View onLayout={(e) => { panelTopRef.current = e.nativeEvent.layout.y }}>
          <TVGlassPanel style={styles.panel}>
            {/* 注意：这里【不再】按 hasLists 二选一渲染。
                以前「导入歌单」入口只长在空态卡上，一旦导入成功第一张歌单，hasLists 变 true，
                整张空态卡（连同 onPress → 扫码页）就被卸载了，页面上再也没有第二次导入的入口 ——
                这就是「歌单只能导入一个，想导入第二个没反应」的直接原因。

                入口卡【保持与歌单卡同一排】的方形卡（而不是独占整行的横幅）：
                焦点可达性已由 tvFocusManager 的「同带优先」独立解决
                （见 focus_geometry_sim.js 实验 L：现状引擎 112 组不可达 → 同带优先 0 组），
                不需要再靠「改布局」兜底；横幅还会造成明显的布局位移。
                本页另已补「聚焦即滚动」，无论卡片换行到第几排都能被滚进视野。
                与歌单卡的视觉区分改用【虚线边框 + ＋ 号】实现 —— 对早年导入、名字仍是
                「导入歌单 MM-DD HH:mm」的旧数据同样有效（改名只影响之后新导入的）。 */}
            <View style={styles.grid}>
              <Focusable
                ref={getCardRefCallback(IMPORT_CARD_KEY, true) as any}
                style={styles.importCard}
                focusStyle={styles.importCardFocus}
                onPress={() => { pushTVSettingsScreen(componentId) }}
                onFocus={() => { revealCardRow(IMPORT_CARD_KEY) }}
                onLayout={(e) => { recordCardBox(IMPORT_CARD_KEY, e.nativeEvent.layout.y, e.nativeEvent.layout.height) }}
              >
                <View style={styles.importHead}>
                  <TVText variant="cardTitle" style={styles.importPlus}>＋</TVText>
                  <TVText variant="cardTitle" numberOfLines={1}>{hasLists ? tvText.importSonglist : tvText.emptyMySonglists}</TVText>
                </View>
                <TVText variant="caption" color={tvColors.dimText} style={styles.emptyHint}>
                  {hasLists ? tvText.importSonglistTip : tvText.emptyMySonglistsHint}
                </TVText>
              </Focusable>
              {/* 「我的收藏」常驻卡：上游一直存在这个列表，但 TV 端此前无任何入口（09-20 需求）；
                  红色调与自建歌单区分，封面取收藏里第一首歌的专辑图 */}
              <TVPosterCard
                key="mylist_love"
                ref={getCardRefCallback('mylist_love') as any}
                title="我的收藏"
                subtitle={`收藏 · ${songCounts[LIST_IDS.LOVE] ?? '…'} 首`}
                size="medium"
                tint={tvColors.warn}
                coverFallback="music"
                image={cardCovers[LIST_IDS.LOVE] || undefined}
                onPress={() => {
                  pushTVDetailScreen(componentId, { type: 'userlist', id: LIST_IDS.LOVE, title: '我的收藏', subtitle: '收藏', userlist: { id: LIST_IDS.LOVE, name: '我的收藏', locationUpdateTime: null } as unknown as LX.List.UserListInfo })
                }}
                onFocus={() => { revealCardRow('mylist_love') }}
                onLayout={(e) => { recordCardBox('mylist_love', e.nativeEvent.layout.y, e.nativeEvent.layout.height) }}
              />
              {userSonglists.map((item, index) => (
                <TVPosterCard
                  key={`mylist_${item.id}`}
                  ref={getCardRefCallback(`mylist_${item.id}`) as any}
                  title={item.name}
                  subtitle={`${item.source ? getSourceName(item.source) : tvText.songlist} · ${songCounts[item.id] ?? '…'} 首`}
                  meta={tvText.longPressManage}
                  size="medium"
                  tint={index % 2 ? tvColors.primary : tvColors.purple}
                  coverFallback="music"
                  image={cardCovers[item.id] || undefined}
                  onPress={() => { openMySonglist(item) }}
                  onLongPress={() => { handleManageSonglist(item) }}
                  onFocus={() => { revealCardRow(`mylist_${item.id}`) }}
                  onLayout={(e) => { recordCardBox(`mylist_${item.id}`, e.nativeEvent.layout.y, e.nativeEvent.layout.height) }}
                />
              ))}
            </View>
            {importResult
              ? <TVText variant="caption" color={importResult.ok ? tvColors.primaryHigh : tvColors.warn} style={styles.resultLine}>{`${tvText.lastImportResult}${importResult.message}`}</TVText>
              : null}
          </TVGlassPanel>
        </View>
      </ScrollView>
      <TVDialog
        visible={!!localDialog}
        resetKey={localDialog}
        title={localDialog?.title ?? ''}
        message={localDialog?.message}
        buttons={localDialog?.buttons?.map(btn => ({
          ...btn,
          onPress: () => {
            setLocalDialog(null)
            btn.onPress?.()
          },
        })) ?? []}
        onDismiss={() => {
          localDialog?.onDismiss?.()
          setLocalDialog(null)
        }}
      />
    </TVAppleScaffold>
  )
}

const styles: Record<string, ViewStyle | TextStyle | any> = {
  content: { paddingBottom: tvSize(40) },
  header: { marginBottom: tvSize(20) },
  subtitle: { marginTop: tvSize(8), color: tvColors.subtext },
  hint: { marginTop: tvSize(10) },
  panel: { padding: PANEL_PADDING },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: tvSize(18) },
  // 入口卡：与歌单卡同排的方形卡（宽度沿用原来的 460），用「虚线边框 + ＋ 号」与歌单卡区分，
  // 刻意不改成独占整行的横幅 —— 横幅会造成明显布局位移，而焦点可达性已由引擎「同带优先」解决，
  // 卡片换行后的可见性由本页新补的「聚焦即滚动」保证。
  importCard: {
    width: tvSize(460),
    borderRadius: tvSize(18),
    borderWidth: 2,
    borderStyle: 'dashed',
    borderColor: tvColors.border,
    backgroundColor: 'rgba(255,255,255,0.04)',
    padding: tvSize(18),
    gap: tvSize(8),
  },
  importCardFocus: { borderColor: tvColors.primaryHigh, borderStyle: 'solid', backgroundColor: 'rgba(255,255,255,0.08)' },
  importHead: { flexDirection: 'row', alignItems: 'center', gap: tvSize(10) },
  importPlus: { color: tvColors.primaryHigh },
  emptyHint: { lineHeight: tvSize(22) },
  resultLine: { marginTop: tvSize(16), lineHeight: tvSize(22) },
}

export default memo(TVMyList)
