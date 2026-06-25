import { memo, useCallback, useEffect, useRef, useState, type ComponentRef, type MutableRefObject } from 'react'
import { FlatList, TextInput, View, findNodeHandle, type TextInputProps, type TextStyle, type ViewStyle } from 'react-native'
import TVAppleScaffold from '@/components/TV/TVAppleScaffold'
import TVTopTabs from '@/components/TV/TVTopTabs'
import TVText from '@/components/TV/TVText'
import TVButton from '@/components/TV/TVButton'
import TVMusicRow from '@/components/TV/TVMusicRow'
import TVGlassPanel from '@/components/TV/TVGlassPanel'
import TVSearchKeyboard from '@/components/TV/TVSearchKeyboard'
import Focusable from '@/components/TV/Focusable'
import { tvColors } from '@/theme/tv'
import { search, setSource as setSearchSource } from '@/core/search/music'
import searchMusicState from '@/store/search/music/state'
import { pushTVPlayerScreen, pushTVSettingsScreen } from '@/navigation/navigation'
import { setTempList } from '@/core/list'
import { playList } from '@/core/player/player'
import { useTVFocusRef } from '@/components/TV/useTVFocusRef'
import { useTVNavigationBack } from '@/utils/hooks/useTVNavigationBack'
import { usePlayerMusicInfo } from '@/store/player/hook'
import { useTVRemoteActions } from '@/utils/hooks/useTVRemoteActions'
import { LIST_IDS } from '@/config/constant'
import { tvText } from './labels'
import { createTVTabs, getMusicSubtitle, getSourceName } from './utils'

type FocusNode = ComponentRef<typeof Focusable> | null
type FocusRefMap = Record<string, FocusNode>
type TVTextInputProps = TextInputProps & {
  nextFocusUp?: number
  nextFocusDown?: number
  nextFocusLeft?: number
  nextFocusRight?: number
}
const TVTextInput = TextInput as React.ComponentType<TVTextInputProps & { ref?: React.Ref<ComponentRef<typeof TextInput>> }>
const RESULT_ITEM_SIZE = 78
const hotWords = ['\u5468\u6770\u4f26', '\u6797\u4fca\u6770', '\u9648\u5955\u8fc5', 'Taylor Swift', '\u4e94\u6708\u5929', '\u7ca4\u8bed\u7ecf\u5178', tvText.hotChart, tvText.newSongs]

const getHandleFromMap = (mapRef: MutableRefObject<FocusRefMap>, key?: string | null) => {
  if (!key) return null
  const node = mapRef.current[key]
  return node ? findNodeHandle(node) : null
}

function TVSearch({ componentId }: { componentId: string }) {
  const musicInfo = usePlayerMusicInfo()
  const [text, setText] = useState('')
  const [results, setResults] = useState<LX.Music.MusicInfoOnline[]>([])
  const [loading, setLoading] = useState(false)
  const [loadingMore, setLoadingMore] = useState(false)
  const [error, setError] = useState('')
  const [pageInfo, setPageInfo] = useState({ page: 0, maxPage: 0, total: 0 })
  const sourceOptions = searchMusicState.sources
  const [source, setSource] = useState<typeof searchMusicState.source>(sourceOptions.includes(searchMusicState.source) ? searchMusicState.source : sourceOptions[0])
  const searchButtonFocus = useTVFocusRef()
  const firstSourceFocus = useTVFocusRef()
  const firstResultFocus = useTVFocusRef()
  const loadMoreFocus = useTVFocusRef()
  const inputRef = useRef<ComponentRef<typeof TextInput>>(null)
  const listRef = useRef<FlatList<LX.Music.MusicInfoOnline>>(null)
  const sourceRefs = useRef<FocusRefMap>({})
  const resultRefs = useRef<FocusRefMap>({})
  const hotRefs = useRef<FocusRefMap>({})

  useTVNavigationBack(componentId)
  useTVRemoteActions({
    playPause: () => { if (musicInfo.id) pushTVPlayerScreen(componentId) },
    menu: () => { pushTVSettingsScreen(componentId) },
  })

  const getInputHandle = () => inputRef.current ? findNodeHandle(inputRef.current) : null
  const getHotHandle = (id?: string | null) => getHandleFromMap(hotRefs, id)
  const getResultHandle = (key?: string | null) => getHandleFromMap(resultRefs, key)
  const getResultKey = useCallback((item: LX.Music.MusicInfoOnline) => `${item.source}_${item.id}`, [])
  const bindSourceRef = (id: string, syncFirstSource = false) => (node: FocusNode) => {
    sourceRefs.current[id] = node
    if (syncFirstSource) firstSourceFocus.ref.current = node as any
  }
  const bindHotRef = (id: string) => (node: FocusNode) => { hotRefs.current[id] = node }
  const bindResultRef = (key: string, syncFirstResult = false) => (node: FocusNode) => {
    resultRefs.current[key] = node
    if (syncFirstResult) firstResultFocus.ref.current = node as any
  }

  const syncPageInfo = useCallback((targetSource: typeof source) => {
    const listInfo = searchMusicState.listInfos[targetSource]
    if (!listInfo) return
    setPageInfo({ page: listInfo.page, maxPage: listInfo.maxPage, total: listInfo.total })
  }, [])

  useEffect(() => {
    const listInfo = searchMusicState.listInfos[source]
    syncPageInfo(source)
    if (!listInfo) return
    const keyword = text.trim()
    const expectedKey = keyword ? `${listInfo.page || 1}__${keyword}` : ''
    setResults(listInfo.key === expectedKey ? listInfo.list : [])
  }, [source, text, syncPageInfo])

  const handleSearch = async(targetPage = 1, keywordOverride?: string) => {
    const keyword = (keywordOverride ?? text).trim()
    if (!keyword) {
      setResults([])
      setError('')
      setPageInfo({ page: 0, maxPage: 0, total: 0 })
      return
    }
    if (keywordOverride != null) setText(keywordOverride)
    if (targetPage > 1) setLoadingMore(true)
    else setLoading(true)
    setError('')
    try {
      const list = await search(keyword, targetPage, source)
      setResults(list)
      syncPageInfo(source)
      if (targetPage === 1) requestAnimationFrame(() => { listRef.current?.scrollToOffset({ offset: 0, animated: false }) })
    } catch (err: unknown) {
      if (targetPage === 1) setResults([])
      setError(err instanceof Error ? err.message : tvText.loadFailed)
    } finally {
      if (targetPage > 1) setLoadingMore(false)
      else setLoading(false)
    }
  }

  const handleOpenPlayer = async(targetMusicInfo: LX.Music.MusicInfoOnline, index: number) => {
    const nextList = results.length ? results : [targetMusicInfo]
    await setTempList(`tv_search__${source}__${text.trim() || targetMusicInfo.id}`, nextList)
    await playList(LIST_IDS.TEMP, Math.max(0, index))
    pushTVPlayerScreen(componentId)
  }

  const handleResultFocus = (index: number) => {
    listRef.current?.scrollToOffset({ offset: Math.max(0, index * RESULT_ITEM_SIZE - RESULT_ITEM_SIZE), animated: true })
  }

  const handleLoadMore = async() => {
    if (loading || loadingMore || !text.trim()) return
    if (!pageInfo.maxPage || pageInfo.page >= pageInfo.maxPage) return
    await handleSearch(pageInfo.page + 1)
  }

  const handleKeyboardKey = (key: string) => { setText(value => `${value}${key}`) }
  const hasMore = !!pageInfo.maxPage && pageInfo.page < pageInfo.maxPage

  return (
    <TVAppleScaffold image={musicInfo.pic}>
      <TVTopTabs items={createTVTabs(componentId)} activeId="search" />
      <View style={styles.root}>
        <TVGlassPanel style={styles.leftPanel}>
          <TVText variant="pageTitle" style={styles.pageTitle}>{tvText.searchTitle}</TVText>
          <TVText variant="body" style={styles.pageSubtitle}>{tvText.searchPlaceholder}</TVText>
          <View style={styles.inputRow}>
            <TVTextInput ref={inputRef} value={text} onChangeText={setText} placeholder={tvText.searchPlaceholder} placeholderTextColor={tvColors.dimText} style={styles.input} nextFocusRight={searchButtonFocus.getNodeHandle() ?? undefined} nextFocusDown={getHotHandle(hotWords[0]) ?? firstSourceFocus.getNodeHandle() ?? undefined} onSubmitEditing={() => { void handleSearch() }} />
            <TVButton ref={searchButtonFocus.ref as any} label={loading ? tvText.searching : tvText.search} onPress={() => { void handleSearch() }} hasTVPreferredFocus nextFocusLeft={getInputHandle() ?? undefined} />
          </View>
          <TVText variant="cardTitle" style={styles.blockTitle}>{tvText.hotSearch}</TVText>
          <View style={styles.hotWrap}>{hotWords.map((word, index) => <Focusable key={word} ref={bindHotRef(word) as any} style={styles.hotItem} onPress={() => { void handleSearch(1, word) }} nextFocusLeft={getHotHandle(hotWords[index - 1]) ?? undefined} nextFocusRight={getHotHandle(hotWords[index + 1]) ?? undefined}><TVText variant="body">{word}</TVText></Focusable>)}</View>
          <TVText variant="cardTitle" style={styles.blockTitle}>{tvText.searchSource}</TVText>
          <View style={styles.sourceWrap}>{sourceOptions.map((item, index) => <Focusable key={item} ref={bindSourceRef(item, index === 0) as any} style={[styles.sourceItem, item === source ? styles.sourceActive : null]} onPress={() => { setSource(item); setSearchSource(item); syncPageInfo(item) }}><TVText variant="body" color={item === source ? tvColors.text : tvColors.subtext}>{getSourceName(item)}</TVText></Focusable>)}</View>
          <TVText variant="cardTitle" style={styles.blockTitle}>{tvText.tvKeyboard}</TVText>
          <TVSearchKeyboard onKeyPress={handleKeyboardKey} onBackspace={() => { setText(value => value.slice(0, -1)) }} onClear={() => { setText('') }} onSubmit={() => { void handleSearch() }} />
        </TVGlassPanel>
        <TVGlassPanel style={styles.resultPanel}>
          <View style={styles.resultHeader}>
            <View><TVText variant="sectionTitle">{tvText.searchResult}</TVText><TVText variant="caption" style={styles.line}>{loading ? `${tvText.searching} ${getSourceName(source)}...` : `${results.length} ${tvText.songs}${pageInfo.total ? ` / 共 ${pageInfo.total}` : ''}${pageInfo.page ? ` / 第 ${pageInfo.page}/${pageInfo.maxPage || pageInfo.page} 页` : ''}`}</TVText></View>
            <TVText variant="caption" color={tvColors.primaryHigh}>{getSourceName(source)}</TVText>
          </View>
          {error ? <TVText variant="caption" color={tvColors.warn} style={styles.error}>{error}</TVText> : null}
          <FlatList ref={listRef} data={results} keyExtractor={getResultKey} showsVerticalScrollIndicator={false} removeClippedSubviews={false} contentContainerStyle={styles.resultContent} ListEmptyComponent={!loading && !error ? <TVText variant="meta">{tvText.emptySearchHint}</TVText> : null} ListFooterComponent={hasMore ? <View style={styles.footer}><TVButton ref={loadMoreFocus.ref as any} label={loadingMore ? tvText.loading : tvText.loadMore} tone="dark" onFocus={() => { listRef.current?.scrollToEnd({ animated: true }) }} onPress={() => { void handleLoadMore() }} /></View> : null} renderItem={({ item, index }) => {
            const itemKey = getResultKey(item)
            const prevKey = results[index - 1] ? getResultKey(results[index - 1]) : null
            const nextKey = results[index + 1] ? getResultKey(results[index + 1]) : null
            return <TVMusicRow ref={bindResultRef(itemKey, index === 0) as any} hasTVPreferredFocus={index === 0 && !!results.length} index={index} title={item.name} subtitle={getMusicSubtitle(item)} meta={item.interval ?? getSourceName(item.source)} badge={index < 3 ? tvText.hotChart : undefined} onFocus={() => { handleResultFocus(index) }} onPress={() => { void handleOpenPlayer(item, index) }} nextFocusUp={index === 0 ? (firstSourceFocus.getNodeHandle() ?? searchButtonFocus.getNodeHandle() ?? undefined) : (getResultHandle(prevKey) ?? undefined)} nextFocusDown={getResultHandle(nextKey) ?? (hasMore && index === results.length - 1 ? loadMoreFocus.getNodeHandle() ?? undefined : undefined)} />
          }} />
        </TVGlassPanel>
      </View>
    </TVAppleScaffold>
  )
}

const styles: Record<string, ViewStyle | TextStyle | any> = {
  root: { flex: 1, flexDirection: 'row', gap: 24 },
  leftPanel: { width: 500, paddingHorizontal: 30, paddingVertical: 26 },
  pageTitle: { fontSize: 46, lineHeight: 54 },
  pageSubtitle: { marginTop: 6, color: tvColors.subtext },
  inputRow: { flexDirection: 'row', gap: 12, marginTop: 18 },
  input: { flex: 1, minHeight: 58, color: tvColors.text, backgroundColor: 'rgba(255,255,255,0.10)', borderRadius: 24, paddingHorizontal: 20, fontSize: 20, borderWidth: 1, borderColor: tvColors.border },
  blockTitle: { marginTop: 18 },
  hotWrap: { flexDirection: 'row', flexWrap: 'wrap', gap: 9, marginTop: 10 },
  hotItem: { minHeight: 40, borderRadius: 999, paddingHorizontal: 15, alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(255,255,255,0.10)', borderWidth: 1, borderColor: tvColors.border },
  sourceWrap: { flexDirection: 'row', flexWrap: 'wrap', gap: 9, marginTop: 10 },
  sourceItem: { minHeight: 40, borderRadius: 999, paddingHorizontal: 15, alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(255,255,255,0.08)', borderWidth: 1, borderColor: tvColors.border },
  sourceActive: { backgroundColor: tvColors.primarySoft, borderColor: tvColors.primaryHigh },
  resultPanel: { flex: 1, paddingHorizontal: 30, paddingVertical: 26, backgroundColor: 'rgba(10,13,21,0.96)' },
  resultHeader: { flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 18 },
  resultContent: { paddingBottom: 20 },
  footer: { alignItems: 'center', paddingVertical: 18 },
  line: { marginTop: 8 },
  error: { marginBottom: 12 },
}

export default memo(TVSearch)
