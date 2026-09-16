import { memo, useEffect, useMemo, useRef, useState, type ComponentRef } from 'react'
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
import { removeUserList } from '@/core/list'
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

function TVMyList({ componentId }: { componentId: string }) {
  const musicInfo = usePlayerMusicInfo()
  const allLists = useMyList()
  // 「我的歌单」只展示用户自己建的（含手机导入的）列表，试听列表/我的收藏不在这里重复出现
  const userSonglists = useMemo(
    () => allLists.filter((item): item is LX.List.UserListInfo => item.id !== LIST_IDS.DEFAULT && item.id !== LIST_IDS.LOVE),
    [allLists],
  )
  // 手机端操作歌单的结果（由设置页广播），直接显示在本页
  const [importResult, setImportResult] = useState<SonglistResult | null>(() => lastSonglistResultCache)
  const [localDialog, setLocalDialog] = useState<TVDialogRequest | null>(null)
  const firstCardFocus = useTVFocusRef()
  const cardRefs = useRef<FocusRefMap>({})
  const listRefresh = useTVFocusRefresh()

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
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.content}>
        <View style={styles.header}>
          <TVText variant="pageTitle">{tvText.mySonglists}</TVText>
          <TVText variant="body" style={styles.subtitle}>{hasLists ? `${userSonglists.length} ${tvText.songlist}` : tvText.emptyMySonglists}</TVText>
          <TVText variant="caption" color={tvColors.dimText} style={styles.hint}>{tvText.myListHint}</TVText>
        </View>
        <TVGlassPanel style={styles.panel}>
          {/* 注意：这里【不再】按 hasLists 二选一渲染。
              以前「导入歌单」入口只长在空态卡上，一旦导入成功第一张歌单，hasLists 变 true，
              整张空态卡（连同 onPress → 扫码页）就被卸载了，页面上再也没有第二次导入的入口 ——
              这就是「歌单只能导入一个，想导入第二个没反应」的直接原因。
              现在把入口做成常驻卡片、固定在网格第一位：有歌单时文案切到「导入歌单」提示，
              没歌单时沿用原来的空态文案。顺带还解决了「删光歌单后焦点悬空」的问题。 */}
          <View style={styles.grid}>
            <Focusable
              ref={getCardRefCallback(IMPORT_CARD_KEY, true) as any}
              style={styles.emptyCard}
              focusStyle={styles.emptyCardFocus}
              onPress={() => { pushTVSettingsScreen(componentId) }}
            >
              <TVText variant="cardTitle">{hasLists ? tvText.importSonglist : tvText.emptyMySonglists}</TVText>
              <TVText variant="caption" color={tvColors.dimText} style={styles.emptyHint}>
                {hasLists ? tvText.importSonglistTip : tvText.emptyMySonglistsHint}
              </TVText>
            </Focusable>
            {userSonglists.map((item, index) => (
              <TVPosterCard
                key={`mylist_${item.id}`}
                ref={getCardRefCallback(`mylist_${item.id}`) as any}
                title={item.name}
                subtitle={item.source ? getSourceName(item.source) : tvText.songlist}
                meta={tvText.longPressManage}
                size="medium"
                tint={index % 2 ? tvColors.primary : tvColors.purple}
                coverFallback="music"
                onPress={() => { openMySonglist(item) }}
                onLongPress={() => { handleManageSonglist(item) }}
              />
            ))}
          </View>
          {importResult
            ? <TVText variant="caption" color={importResult.ok ? tvColors.primaryHigh : tvColors.warn} style={styles.resultLine}>{`${tvText.lastImportResult}${importResult.message}`}</TVText>
            : null}
        </TVGlassPanel>
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
  panel: { padding: tvSize(28) },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: tvSize(18) },
  emptyCard: { width: tvSize(460), borderRadius: tvSize(18), borderWidth: 1, borderColor: tvColors.border, backgroundColor: 'rgba(255,255,255,0.04)', padding: tvSize(18), gap: tvSize(8) },
  emptyCardFocus: { borderColor: tvColors.primaryHigh, backgroundColor: 'rgba(255,255,255,0.08)' },
  emptyHint: { lineHeight: tvSize(22) },
  resultLine: { marginTop: tvSize(16), lineHeight: tvSize(22) },
}

export default memo(TVMyList)
