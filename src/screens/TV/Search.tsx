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
import { tvColors, tvFont, tvSize } from '@/theme/tv'
import { search } from '@/core/search/music'
import searchMusicState from '@/store/search/music/state'
import { pushTVPlayerScreen, pushTVSettingsScreen } from '@/navigation/navigation'
import { setTempList } from '@/core/list'
import { playList } from '@/core/player/player'
import { useTVFocusRef } from '@/components/TV/useTVFocusRef'
import { useTVFocusRefresh } from '@/components/TV/useTVFocusRefresh'
import { useTVNavigationBack } from '@/utils/hooks/useTVNavigationBack'
import { usePlayerMusicInfo } from '@/store/player/hook'
import { useTVRemoteActions } from '@/utils/hooks/useTVRemoteActions'
import { LIST_IDS } from '@/config/constant'
import { tvText } from './labels'
import { createTVTabs, getMusicSubtitle } from './utils'

type FocusNode = ComponentRef<typeof Focusable> | null
type FocusRefMap = Record<string, FocusNode>
type TVTextInputProps = TextInputProps & {
  nextFocusUp?: number
  nextFocusDown?: number
  nextFocusLeft?: number
  nextFocusRight?: number
}

const TVTextInput = TextInput as React.ComponentType<TVTextInputProps & { ref?: React.Ref<ComponentRef<typeof TextInput>> }>
const RESULT_ITEM_SIZE = tvSize(78)
const hotWords = ['\u5468\u6770\u4f26', '\u6797\u4fca\u6770', '\u9648\u5955\u8fc5']

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
  const [source] = useState<typeof searchMusicState.source>(sourceOptions.includes(searchMusicState.source) ? searchMusicState.source : sourceOptions[0])
  const queueFocusRefresh = useTVFocusRefresh()
  const searchButtonFocus = useTVFocusRef()
  const firstResultFocus = useTVFocusRef()
  const firstKeyboardKeyFocus = useRef<FocusNode>(null)
  const loadMoreFocus = useTVFocusRef()
  const inputRef = useRef<ComponentRef<typeof TextInput>>(null)
  const listRef = useRef<FlatList<LX.Music.MusicInfoOnline>>(null)
  const resultRefs = useRef<FocusRefMap>({})
  const hotRefs = useRef<FocusRefMap>({})

  useTVNavigationBack(componentId)
  useTVRemoteActions({
    playPause: () => { if (musicInfo.id) pushTVPlayerScreen(componentId) },
    menu: () => { pushTVSettingsScreen(componentId) },
  })

  const getInputHandle = () => inputRef.current ? findNodeHandle(inputRef.current) : null
  const getKeyboardHandle = () => firstKeyboardKeyFocus.current ? findNodeHandle(firstKeyboardKeyFocus.current) : null
  const getHotHandle = (id?: string | null) => getHandleFromMap(hotRefs, id)
  const getResultHandle = (key?: string | null) => getHandleFromMap(resultRefs, key)
  const getResultKey = useCallback((item: LX.Music.MusicInfoOnline) => `${item.source}_${item.id}`, [])
  const bindHotRef = (id: string) => (node: FocusNode) => { hotRefs.current[id] = node }
  const bindResultRef = (key: string, syncFirstResult = false) => (node: FocusNode) => {
    resultRefs.current[key] = node
    if (syncFirstResult && node && firstResultFocus.ref.current !== node) {
      firstResultFocus.ref.current = node as any
      queueFocusRefresh()
    }
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
  const firstHotHandle = getHotHandle(hotWords[0]) ?? undefined
  const lastHotHandle = getHotHandle(hotWords[hotWords.length - 1]) ?? firstHotHandle
  const searchButtonHandle = searchButtonFocus.getNodeHandle() ?? undefined
  const firstResultHandle = firstResultFocus.getNodeHandle() ?? undefined
  const keyboardHandle = getKeyboardHandle() ?? undefined

  return (
    <TVAppleScaffold image={musicInfo.pic}>
      <TVTopTabs items={createTVTabs(componentId)} activeId="search" nextFocusDown={getInputHandle() ?? searchButtonHandle} />
      <View style={styles.root}>
        <TVGlassPanel style={styles.leftPanel}>
          <TVText variant="pageTitle" style={styles.pageTitle}>{tvText.searchTitle}</TVText>
          <View style={styles.inputRow}>
            <TVTextInput ref={inputRef} value={text} onChangeText={setText} placeholder={tvText.searchPlaceholder} placeholderTextColor={tvColors.dimText} style={styles.input} nextFocusRight={searchButtonHandle} nextFocusDown={firstHotHandle} onSubmitEditing={() => { void handleSearch() }} />
            <TVButton ref={searchButtonFocus.ref as any} label={loading ? tvText.searching : tvText.search} onPress={() => { void handleSearch() }} hasTVPreferredFocus nextFocusLeft={getInputHandle() ?? undefined} nextFocusRight={firstResultHandle} nextFocusDown={firstHotHandle} />
          </View>
          <TVText variant="cardTitle" style={styles.blockTitle}>{tvText.hotSearch}</TVText>
          <View style={styles.hotWrap}>
            {hotWords.map((word, index) => (
              <Focusable key={word} ref={bindHotRef(word) as any} style={styles.hotItem} onPress={() => { void handleSearch(1, word) }} nextFocusLeft={getHotHandle(hotWords[index - 1]) ?? undefined} nextFocusRight={getHotHandle(hotWords[index + 1]) ?? firstResultHandle} nextFocusUp={getInputHandle() ?? searchButtonHandle} nextFocusDown={keyboardHandle}>
                <TVText variant="body">{word}</TVText>
              </Focusable>
            ))}
          </View>
          <TVSearchKeyboard firstKeyRef={firstKeyboardKeyFocus} onFirstKeyReady={queueFocusRefresh} onKeyPress={handleKeyboardKey} onBackspace={() => { setText(value => value.slice(0, -1)) }} onClear={() => { setText('') }} onSubmit={() => { void handleSearch() }} nextFocusUp={lastHotHandle} nextFocusRight={firstResultHandle} />
        </TVGlassPanel>
        <TVGlassPanel style={styles.resultPanel}>
          <View style={styles.resultHeader}>
            <View>
              <TVText variant="sectionTitle">{tvText.searchResult}</TVText>
              <TVText variant="caption" style={styles.line}>{loading ? tvText.searching : `${results.length} ${tvText.songs}${pageInfo.total ? ` / \u5171 ${pageInfo.total}` : ''}${pageInfo.page ? ` / \u7b2c ${pageInfo.page}/${pageInfo.maxPage || pageInfo.page} \u9875` : ''}`}</TVText>
            </View>
          </View>
          {error ? <TVText variant="caption" color={tvColors.warn} style={styles.error}>{error}</TVText> : null}
          <FlatList
            ref={listRef}
            data={results}
            keyExtractor={getResultKey}
            showsVerticalScrollIndicator={false}
            removeClippedSubviews={false}
            contentContainerStyle={styles.resultContent}
            ListEmptyComponent={!loading && !error ? <TVText variant="meta">{tvText.emptySearchHint}</TVText> : null}
            ListFooterComponent={hasMore ? <View style={styles.footer}><TVButton ref={loadMoreFocus.ref as any} label={loadingMore ? tvText.loading : tvText.loadMore} tone="dark" onFocus={() => { listRef.current?.scrollToEnd({ animated: true }) }} onPress={() => { void handleLoadMore() }} /></View> : null}
            renderItem={({ item, index }) => {
              const itemKey = getResultKey(item)
              const prevKey = results[index - 1] ? getResultKey(results[index - 1]) : null
              const nextKey = results[index + 1] ? getResultKey(results[index + 1]) : null
              return <TVMusicRow ref={bindResultRef(itemKey, index === 0) as any} hasTVPreferredFocus={index === 0 && !!results.length} index={index} title={item.name} subtitle={getMusicSubtitle(item)} meta={item.interval} onFocus={() => { handleResultFocus(index) }} onPress={() => { void handleOpenPlayer(item, index) }} nextFocusLeft={searchButtonHandle} nextFocusUp={index === 0 ? searchButtonHandle : (getResultHandle(prevKey) ?? undefined)} nextFocusDown={getResultHandle(nextKey) ?? (hasMore && index === results.length - 1 ? loadMoreFocus.getNodeHandle() ?? undefined : undefined)} />
            }}
          />
        </TVGlassPanel>
      </View>
    </TVAppleScaffold>
  )
}

const styles: Record<string, ViewStyle | TextStyle | any> = {
  root: { flex: 1, flexDirection: 'row', gap: tvSize(24) },
  leftPanel: { width: tvSize(420), paddingHorizontal: tvSize(30), paddingVertical: tvSize(18) },
  pageTitle: { fontSize: tvFont(34), lineHeight: tvFont(40) },
  inputRow: { flexDirection: 'row', gap: tvSize(12), marginTop: tvSize(12) },
  input: { flex: 1, minHeight: tvSize(46), color: tvColors.text, backgroundColor: 'rgba(255,255,255,0.10)', borderRadius: tvSize(20), paddingHorizontal: tvSize(16), fontSize: tvFont(17), borderWidth: 1, borderColor: tvColors.border },
  blockTitle: { marginTop: tvSize(12), fontSize: tvFont(20) },
  hotWrap: { flexDirection: 'row', flexWrap: 'wrap', gap: tvSize(8), marginTop: tvSize(8), marginBottom: tvSize(12) },
  hotItem: { minHeight: tvSize(32), borderRadius: 999, paddingHorizontal: tvSize(13), alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(255,255,255,0.10)', borderWidth: 1, borderColor: tvColors.border },
  resultPanel: { flex: 1, paddingHorizontal: tvSize(30), paddingVertical: tvSize(26), backgroundColor: 'rgba(10,13,21,0.96)' },
  resultHeader: { flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: tvSize(18) },
  resultContent: { paddingBottom: tvSize(20) },
  footer: { alignItems: 'center', paddingVertical: tvSize(18) },
  line: { marginTop: tvSize(8) },
  error: { marginBottom: tvSize(12) },
}

export default memo(TVSearch)
