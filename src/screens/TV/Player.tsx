import { memo, useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { ScrollView, View, type ImageStyle, type TextStyle, type ViewStyle } from 'react-native'
import Image from '@/components/common/Image'
import TVAppleScaffold from '@/components/TV/TVAppleScaffold'
import TVText from '@/components/TV/TVText'
import TVButton from '@/components/TV/TVButton'
import TVRoundControl from '@/components/TV/TVRoundControl'
import Focusable from '@/components/TV/Focusable'
import TVNowPlayingDock from '@/components/TV/TVNowPlayingDock'
import { tvColors } from '@/theme/tv'
import { useIsPlay, usePlayerMusicInfo, useProgress } from '@/store/player/hook'
import { playNext, playPrev, togglePlay } from '@/core/player/player'
import { useSettingValue } from '@/store/setting/hook'
import { setApiSource } from '@/core/apiSource'
import apiSourceInfo from '@/utils/musicSdk/api-source-info'
import { updateSetting } from '@/core/common'
import { useUserApiList } from '@/store/userApi/hook'
import { TV_PRESET_USER_API_CANDIDATES } from '@/config/tvPresetUserApi'
import { useTVFocusRef } from '@/components/TV/useTVFocusRef'
import { pushTVQueueScreen, pushTVSettingsScreen } from '@/navigation/navigation'
import { useTVNavigationBack } from '@/utils/hooks/useTVNavigationBack'
import { useTVRemoteActions } from '@/utils/hooks/useTVRemoteActions'
import { useLrcPlay, useLrcSet } from '@/plugins/lyric'
import { MUSIC_TOGGLE_MODE, MUSIC_TOGGLE_MODE_LIST } from '@/config/constant'
import { dot, tvText } from './labels'
import { getPlayModeName, getSourceName } from './utils'
import { useTVFetchedMusicList } from './useTVFetchedMusicList'

const lyricMetaPattern = /^(作词|作曲|编曲|制作|制作人|制作统筹|制片人|监制|出品|出品人|发行|营销|推广|视频推广|推广策划|录音|混音|母带|和声|和音|音讯编辑|乐队总监|键盘手|PGM|弦乐|录音室|录音|混音|母带|吉他|贝斯|鼓|词|曲|OP|SP|ISRC|企划|统筹|鸣谢|版权|未经|未经许可|未经著作权人|封面设计|封面|设计|视觉|摄影|海报|文案|Cover|Cover Design|Artwork|Art Design|Design|Visual|Photography|Lyricist|Composer|Arranger|Producer|Mixing|Mastering).*[:：]?/i
const lyricCopyrightPattern = /(未经|著作权人|许可|翻唱|翻录|使用|版权|Cover Design|Artwork|Art Design)/i
const lyricCreditColonPattern = /^[\u4e00-\u9fa5A-Za-z0-9 ®@/、·.（）()&-]{1,16}[:：]\s*[\u4e00-\u9fa5A-Za-z0-9 ®@/、·.（）()&-]{1,40}$/

const isDisplayLyric = (text?: string | null) => {
  const value = text?.trim()
  if (!value) return false
  if (/^\[[^\]]+\]$/.test(value)) return false
  if (lyricMetaPattern.test(value)) return false
  if (lyricCopyrightPattern.test(value)) return false
  if (lyricCreditColonPattern.test(value)) return false
  if (/^[^-—–·]{1,40}\s*[-—–]\s*[^-—–]{1,30}$/.test(value)) return false
  return true
}

function TVPlayer({ componentId }: { componentId: string }) {
  const musicInfo = usePlayerMusicInfo()
  const isPlay = useIsPlay()
  const progress = useProgress()
  const lyricPlay = useLrcPlay()
  const lyricLines = useLrcSet()
  const apiSource = useSettingValue('common.apiSource')
  const playMode = useSettingValue('player.togglePlayMethod')
  const userApiList = useUserApiList()
  const fetchedMusicList = useTVFetchedMusicList()
  const [showControls, setShowControls] = useState(true)
  const [focusToken, setFocusToken] = useState(0)
  const [hideKey, setHideKey] = useState(0)
  const hideDeadlineRef = useRef<number>(0)
  const controlFocusCountRef = useRef(0)
  const prevFocus = useTVFocusRef()
  const playFocus = useTVFocusRef()
  const nextFocus = useTVFocusRef()
  const modeFocus = useTVFocusRef()
  const queueFocus = useTVFocusRef()
  const sourceFocus = useTVFocusRef()
  const settingsFocus = useTVFocusRef()
  const lyricFocus = useTVFocusRef()
  const progressPercent = Math.max(0, Math.min(progress.progress * 100, 100))

  useTVNavigationBack(componentId)

  const scheduleHideControls = useCallback(() => {
    hideDeadlineRef.current = Date.now() + 3000
  }, [])

  const revealControls = useCallback(() => {
    setShowControls(true)
    scheduleHideControls()
  }, [scheduleHideControls])

  const handleControlFocus = useCallback(() => {
    controlFocusCountRef.current += 1
    revealControls()
  }, [revealControls])

  const handleControlBlur = useCallback(() => {
    controlFocusCountRef.current = Math.max(0, controlFocusCountRef.current - 1)
    revealControls()
  }, [revealControls])

  useEffect(() => {
    if (!showControls) setHideKey(k => k + 1)
  }, [showControls])

  useEffect(() => {
    revealControls()
    const interval = setInterval(() => {
      if (controlFocusCountRef.current > 0) return
      if (Date.now() >= hideDeadlineRef.current) setShowControls(false)
    }, 500)
    return () => { clearInterval(interval) }
  }, [revealControls])

  useTVRemoteActions({
    playPause: () => { if (musicInfo.id) togglePlay() },
    select: () => { if (musicInfo.id) togglePlay() },
    left: () => { if (musicInfo.id) void playPrev() },
    right: () => { if (musicInfo.id) void playNext() },
    previous: () => { if (musicInfo.id) void playPrev() },
    rewind: () => { if (musicInfo.id) void playPrev() },
    next: () => { if (musicInfo.id) void playNext() },
    fastForward: () => { if (musicInfo.id) void playNext() },
    stop: () => { if (musicInfo.id && isPlay) togglePlay() },
    down: () => { revealControls(); setFocusToken(t => t + 1) },
    up: () => { revealControls(); setFocusToken(t => t + 1) },
    menu: () => { pushTVSettingsScreen(componentId) },
  })

  const nextSource = useMemo(() => {
    const builtinSources = ['', ...apiSourceInfo.filter(item => !item.disabled).map(item => item.id)]
    const presetSources = TV_PRESET_USER_API_CANDIDATES.map(item => item.id)
    const customSources = userApiList.map(item => item.id)
    const list = [...new Set([...builtinSources, ...presetSources, ...customSources])]
    if (!list.length) return ''
    const index = list.findIndex(item => item === apiSource)
    return list[(index + 1 + list.length) % list.length] ?? list[0]
  }, [apiSource, userApiList])

  const activeLyricIndex = lyricPlay.line >= 0 && lyricPlay.line < lyricLines.length ? lyricPlay.line : -1
  const fallbackLyric = isDisplayLyric(lyricPlay.text) ? lyricPlay.text.trim() : (musicInfo.id ? tvText.loading : tvText.chooseSongFirst)
  const displayLyrics = useMemo(() => {
    if (activeLyricIndex < 0 || !lyricLines.length) return [{ key: 'fallback', text: fallbackLyric, translation: '', active: true, distance: 0 }]

    const currentItem = lyricLines[activeLyricIndex]
    const seekLine = (direction: -1 | 1, step: number) => {
      let count = 0
      let index = activeLyricIndex
      while (index >= 0 && index < lyricLines.length) {
        index += direction
        const item = lyricLines[index]
        if (!item || !isDisplayLyric(item.text)) continue
        count += 1
        if (count === step) return { item, index }
      }
      return null
    }

    const activeDisplayLine = isDisplayLyric(currentItem?.text)
      ? { item: currentItem, index: activeLyricIndex }
      : seekLine(1, 1)

    const lines = [
      seekLine(-1, 3),
      seekLine(-1, 2),
      seekLine(-1, 1),
      activeDisplayLine,
      seekLine(1, 1),
      seekLine(1, 2),
    ].filter(Boolean) as Array<{ item: (typeof lyricLines)[number], index: number }>

    const nextLyrics = lines.map(({ item, index }) => ({
      key: `${index}_${item.text}`,
      text: item.text.trim(),
      translation: item.extendedLyrics.find(isDisplayLyric)?.trim() ?? '',
      active: index === activeDisplayLine?.index,
      distance: Math.min(Math.abs(index - activeLyricIndex), 3),
    })).filter((item, index, list) => item.text && list.findIndex(target => target.key === item.key) === index)

    return nextLyrics.length ? nextLyrics : [{ key: 'fallback', text: fallbackLyric, translation: '', active: true, distance: 0 }]
  }, [activeLyricIndex, fallbackLyric, lyricLines])

  const handleTogglePlay = useCallback(() => {
    if (!musicInfo.id) return
    revealControls()
    togglePlay()
  }, [musicInfo.id, revealControls])

  const togglePlayMode = useCallback(() => {
    revealControls()
    let index = MUSIC_TOGGLE_MODE_LIST.indexOf(playMode)
    if (++index >= MUSIC_TOGGLE_MODE_LIST.length) index = 0
    updateSetting({ 'player.togglePlayMethod': MUSIC_TOGGLE_MODE_LIST[index] })
  }, [playMode, revealControls])

  return (
    <TVAppleScaffold image={musicInfo.pic} immersive contentStyle={styles.scaffoldContent}>
      <View style={styles.root}>
        <View style={styles.nowPlayingArea}>
          <View style={styles.albumColumn}>
            <View style={styles.coverHalo} />
            <View style={styles.coverWrap}>
              <View style={styles.cover}>
                {musicInfo.pic ? <Image url={musicInfo.pic} resizeMode="cover" style={styles.coverImage as ImageStyle} /> : <TVText variant="pageTitle">zl</TVText>}
              </View>
            </View>
            <View style={styles.songIdentity}>
              <TVText variant="pageTitle" style={styles.songTitle} numberOfLines={2}>{musicInfo.name || tvText.welcome}</TVText>
              <TVText variant="body" style={styles.songMeta} numberOfLines={1}>{musicInfo.id ? `${musicInfo.singer || tvText.unknownSinger}${dot}${getSourceName(apiSource)}` : tvText.chooseMusicHint}</TVText>
            </View>
          </View>

          <Focusable
            key={`lyric_${hideKey}`} ref={lyricFocus.ref as any}
            style={styles.lyricStage}
            focusStyle={styles.lyricStageFocused}
            hasTVPreferredFocus={!showControls}
            onPress={() => { revealControls() }}
          >
            <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.lyricContent} scrollEnabled={false}>
              {displayLyrics.map(item => (
                <View key={item.key} style={[styles.lyricRow, item.active ? styles.lyricRowActive : null]}>
                  <TVText
                    variant={item.active ? 'pageTitle' : 'sectionTitle'}
                    style={[styles.lyricText, item.active ? styles.lyricTextActive : item.distance > 1 ? styles.lyricTextFar : styles.lyricTextNear]}
                    numberOfLines={2}
                  >
                    {item.text}
                  </TVText>
                  {item.active && item.translation ? <TVText variant="body" style={styles.translation} numberOfLines={1}>{item.translation}</TVText> : null}
                </View>
              ))}
            </ScrollView>
          </Focusable>
        </View>

        {showControls ? (
          <View style={styles.dockOverlay}>
            <TVNowPlayingDock progressPercent={progressPercent} now={progress.nowPlayTimeStr || '00:00'} total={progress.maxPlayTimeStr || '00:00'} style={styles.dock}>
            <View style={styles.primaryControls}>
              <TVRoundControl ref={prevFocus.ref as any} label="‹" size={44} onPress={() => { revealControls(); void playPrev() }} onFocus={handleControlFocus} onBlur={handleControlBlur} accessibilityLabel={tvText.controlPrev} nextFocusRight={playFocus.getNodeHandle() ?? undefined} />
              <TVRoundControl key={`play_${focusToken}`} ref={playFocus.ref as any} label={isPlay ? 'Ⅱ' : '▶'} primary size={58} onPress={handleTogglePlay} onFocus={handleControlFocus} onBlur={handleControlBlur} hasTVPreferredFocus nextFocusLeft={prevFocus.getNodeHandle() ?? undefined} nextFocusRight={nextFocus.getNodeHandle() ?? undefined} nextFocusDown={modeFocus.getNodeHandle() ?? undefined} />
              <TVRoundControl ref={nextFocus.ref as any} label="›" size={44} onPress={() => { revealControls(); void playNext() }} onFocus={handleControlFocus} onBlur={handleControlBlur} accessibilityLabel={tvText.controlNext} nextFocusLeft={playFocus.getNodeHandle() ?? undefined} nextFocusRight={modeFocus.getNodeHandle() ?? undefined} />
            </View>
            <View style={styles.secondaryControls}>
              <TVButton ref={modeFocus.ref as any} label={getPlayModeName(playMode)} tone={playMode === MUSIC_TOGGLE_MODE.random || playMode === MUSIC_TOGGLE_MODE.singleLoop || playMode === MUSIC_TOGGLE_MODE.listLoop ? 'primary' : 'ghost'} style={styles.pillButton} onPress={togglePlayMode} onFocus={handleControlFocus} onBlur={handleControlBlur} nextFocusUp={playFocus.getNodeHandle() ?? undefined} nextFocusRight={queueFocus.getNodeHandle() ?? undefined} />
              <TVButton ref={queueFocus.ref as any} label={`${tvText.playlist} ${fetchedMusicList.length}`} tone="ghost" style={styles.pillButton} onPress={() => { revealControls(); pushTVQueueScreen(componentId) }} onFocus={handleControlFocus} onBlur={handleControlBlur} nextFocusUp={playFocus.getNodeHandle() ?? undefined} nextFocusLeft={modeFocus.getNodeHandle() ?? undefined} nextFocusRight={sourceFocus.getNodeHandle() ?? undefined} />
              <TVButton ref={sourceFocus.ref as any} label={`${tvText.switchSource} ${getSourceName(apiSource)}`} tone="ghost" style={styles.sourceButton} onPress={() => {
                revealControls()
                if (!nextSource || nextSource === apiSource) return
                setApiSource(nextSource)
              }} onFocus={handleControlFocus} onBlur={handleControlBlur} nextFocusUp={playFocus.getNodeHandle() ?? undefined} nextFocusLeft={queueFocus.getNodeHandle() ?? undefined} nextFocusRight={settingsFocus.getNodeHandle() ?? undefined} />
              <TVButton ref={settingsFocus.ref as any} label={tvText.settings} tone="ghost" style={styles.pillButton} onPress={() => { revealControls(); pushTVSettingsScreen(componentId) }} onFocus={handleControlFocus} onBlur={handleControlBlur} nextFocusUp={playFocus.getNodeHandle() ?? undefined} nextFocusLeft={sourceFocus.getNodeHandle() ?? undefined} />
            </View>
            </TVNowPlayingDock>
          </View>
        ) : null}
      </View>
    </TVAppleScaffold>
  )
}

const styles: Record<string, ViewStyle | TextStyle | ImageStyle | any> = {
  scaffoldContent: { overflow: 'hidden', paddingHorizontal: 76, paddingTop: 14, paddingBottom: 14 },
  root: { flex: 1 },
  nowPlayingArea: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: 58, minHeight: 0, paddingBottom: 120 },
  dockOverlay: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    zIndex: 30,
    elevation: 30,
    paddingTop: 40,
    paddingBottom: 18,
    paddingHorizontal: 28,
    backgroundColor: 'rgba(4,7,14,0.0)',
  },
  dockScrimTop: {
    position: 'absolute',
    left: 0,
    right: 0,
    top: 0,
    height: 70,
    backgroundColor: 'rgba(4,7,14,0.55)',
  },
  albumColumn: { width: 390, justifyContent: 'center' },
  coverHalo: { position: 'absolute', width: 302, height: 302, borderRadius: 151, left: 10, top: 12, backgroundColor: 'rgba(220,229,244,0.08)' },
  coverWrap: { width: 282, height: 282, borderRadius: 40, padding: 1, backgroundColor: 'rgba(255,255,255,0.20)', shadowColor: '#000000', shadowOpacity: 0.54, shadowRadius: 58, elevation: 26 },
  cover: { flex: 1, borderRadius: 41, overflow: 'hidden', alignItems: 'center', justifyContent: 'center', backgroundColor: tvColors.surfaceWarm },
  coverImage: { width: '100%', height: '100%' },
  songIdentity: { marginTop: 14, width: 366 },
  songTitle: { marginTop: 0, fontSize: 31, lineHeight: 37, fontWeight: '900' },
  songMeta: { marginTop: 5, color: 'rgba(247,248,251,0.62)', lineHeight: 23 },
  lyricStage: { flex: 1, justifyContent: 'center', minHeight: 0, paddingTop: 8 },
  lyricStageFocused: { backgroundColor: 'transparent', borderWidth: 0, shadowOpacity: 0, elevation: 0, transform: [{ scale: 1 }] },
  lyricContent: { flexGrow: 1, justifyContent: 'center', paddingRight: 10, paddingTop: 4, paddingBottom: 8 },
  lyricRow: { marginVertical: 1, opacity: 0.66 },
  lyricRowActive: { opacity: 1, marginVertical: 10 },
  lyricText: { textAlign: 'left' },
  lyricTextActive: { color: tvColors.lyricActive, fontSize: 48, lineHeight: 58, letterSpacing: 0.1, textShadowColor: 'rgba(0,0,0,0.45)', textShadowRadius: 20 },
  lyricTextNear: { color: 'rgba(247,248,251,0.46)', fontSize: 25, lineHeight: 33 },
  lyricTextFar: { color: 'rgba(247,248,251,0.20)', fontSize: 21, lineHeight: 29 },
  translation: { marginTop: 6, color: tvColors.primaryHigh, fontSize: 18 },
  dock: { paddingHorizontal: 2, paddingBottom: 0, marginTop: 4 },
  primaryControls: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 14 },
  secondaryControls: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, marginTop: 6 },
  pillButton: { minHeight: 34, paddingHorizontal: 17, paddingVertical: 7 },
  sourceButton: { minHeight: 34, minWidth: 142, paddingHorizontal: 17, paddingVertical: 7 },
}

export default memo(TVPlayer)
