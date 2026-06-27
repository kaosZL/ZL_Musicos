import { memo, useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { ImageBackground, ScrollView, useWindowDimensions, View, type ImageStyle, type TextStyle, type ViewStyle } from 'react-native'
import Image, { defaultHeaders } from '@/components/common/Image'
import TVAppleScaffold from '@/components/TV/TVAppleScaffold'
import TVText from '@/components/TV/TVText'
import TVRoundControl from '@/components/TV/TVRoundControl'
import Focusable from '@/components/TV/Focusable'
import TVNowPlayingDock from '@/components/TV/TVNowPlayingDock'
import { tvColors } from '@/theme/tv'
import { useIsPlay, usePlayerMusicInfo, useProgress } from '@/store/player/hook'
import { playNext, playPrev, togglePlay } from '@/core/player/player'
import { useSettingValue } from '@/store/setting/hook'
import { updateSetting } from '@/core/common'
import { useTVFocusRef } from '@/components/TV/useTVFocusRef'
import { pushTVSettingsScreen } from '@/navigation/navigation'
import { useTVNavigationBack } from '@/utils/hooks/useTVNavigationBack'
import { useTVRemoteActions } from '@/utils/hooks/useTVRemoteActions'
import { useLrcPlay, useLrcSet } from '@/plugins/lyric'
import { MUSIC_TOGGLE_MODE, MUSIC_TOGGLE_MODE_LIST } from '@/config/constant'
import { tvText } from './labels'
import { getPlayModeName, getSourceName } from './utils'

const lyricMetaPattern = /^(作词|作曲|编曲|制作|制作人|制作统筹|制片人|监制|出品|出品人|发行|营销|推广|视频推广|推广策划|录音|混音|母带|和声|和音|音讯编辑|乐队总监|键盘手|PGM|弦乐|录音室|录音|混音|母带|吉他|贝斯|鼓|词|曲|OP|SP|ISRC|企划|统筹|鸣谢|版权|未经|未经许可|未经著作权人|封面设计|封面|设计|视觉|摄影|海报|文案|Cover|Cover Design|Artwork|Art Design|Design|Visual|Photography|Lyricist|Composer|Arranger|Producer|Mixing|Mastering).*[:：]?/i
const lyricCopyrightPattern = /(未经|著作权人|许可|翻唱|翻录|使用|版权|Cover Design|Artwork|Art Design)/i
const lyricPromotionPattern = /(听歌就在|联合出品|特别企划|音乐计划|星曜计划|鲸鱼向海|酷狗|QQ音乐|网易云音乐|抖音|快手|出品|发行|推广|营销|鸣谢)/i
const lyricCreditColonPattern = /^[\u4e00-\u9fa5A-Za-z0-9 ®@/、·.（）()&-]{1,16}[:：]\s*[\u4e00-\u9fa5A-Za-z0-9 ®@/、·.（）()&-]{1,40}$/

const getPlayModeIconName = (mode?: LX.AppSetting['player.togglePlayMethod']) => {
  switch (mode) {
    case MUSIC_TOGGLE_MODE.random:
      return 'list-random'
    case MUSIC_TOGGLE_MODE.list:
      return 'list-order'
    case MUSIC_TOGGLE_MODE.singleLoop:
      return 'single-loop'
    case MUSIC_TOGGLE_MODE.none:
      return 'single'
    case MUSIC_TOGGLE_MODE.listLoop:
    default:
      return 'list-loop'
  }
}

const isDisplayLyric = (text?: string | null) => {
  const value = text?.trim()
  if (!value) return false
  if (/^\[[^\]]+\]$/.test(value)) return false
  if (lyricMetaPattern.test(value)) return false
  if (lyricCopyrightPattern.test(value)) return false
  if (lyricPromotionPattern.test(value)) return false
  if (lyricCreditColonPattern.test(value)) return false
  if (/^[-–—_~·\s]+$/.test(value)) return false
  if (/^『.*』$/.test(value) && value.length > 12) return false
  if (/^[^-–—·]{1,40}\s*[-–—]\s*[^-–—]{1,30}$/.test(value)) return false
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
  const [showControls, setShowControls] = useState(true)
  const [focusToken, setFocusToken] = useState(0)
  const [hideKey, setHideKey] = useState(0)
  const hideDeadlineRef = useRef<number>(0)
  const controlFocusCountRef = useRef(0)
  const prevFocus = useTVFocusRef()
  const playFocus = useTVFocusRef()
  const nextFocus = useTVFocusRef()
  const modeFocus = useTVFocusRef()
  const lyricFocus = useTVFocusRef()
  const progressPercent = Math.max(0, Math.min(progress.progress * 100, 100))
  const sourceName = getSourceName(apiSource)
  const { width: screenWidth, height: screenHeight } = useWindowDimensions()

  const appleLayout = useMemo(() => {
    const scale = Math.min(screenWidth / 1144, screenHeight / 644)
    const offsetX = (screenWidth - 1144 * scale) / 2
    const offsetY = (screenHeight - 644 * scale) / 2
    const s = (value: number) => Math.round(value * scale)
    const coverSize = s(312)

    return {
      albumColumn: {
        left: offsetX + s(88),
        top: offsetY + s(102),
        width: coverSize,
      },
      coverStage: {
        width: coverSize,
        height: coverSize,
      },
      coverGlow: {
        width: coverSize + s(18),
        height: coverSize + s(18),
        borderRadius: s(13),
        left: -s(9),
        top: -s(9),
      },
      coverWrap: {
        width: coverSize,
        height: coverSize,
        borderRadius: s(8),
      },
      cover: {
        borderRadius: s(8),
      },
      songIdentity: {
        marginTop: s(14),
        width: coverSize,
      },
      songTitle: {
        fontSize: Math.max(15, s(19)),
        lineHeight: Math.max(20, s(24)),
      },
      metaRow: {
        marginTop: s(4),
        maxWidth: coverSize,
      },
      songMeta: {
        fontSize: Math.max(13, s(16)),
        lineHeight: Math.max(18, s(21)),
      },
      sourceMeta: {
        fontSize: Math.max(13, s(16)),
        lineHeight: Math.max(18, s(21)),
      },
      lyricColumn: {
        left: offsetX + s(501),
        right: Math.max(s(48), screenWidth - (offsetX + s(1100))),
        top: offsetY + s(188),
        height: s(250),
      },
      lyricContent: {
        paddingRight: s(18),
      },
      lyricTextActive: {
        fontSize: Math.max(34, s(44)),
        lineHeight: Math.max(42, s(54)),
      },
      lyricTextNear: {
        fontSize: Math.max(22, s(30)),
        lineHeight: Math.max(29, s(38)),
      },
      lyricTextFar: {
        fontSize: Math.max(19, s(26)),
        lineHeight: Math.max(26, s(34)),
      },
      translation: {
        fontSize: Math.max(14, s(18)),
      },
      dockOverlay: {
        left: offsetX + s(48),
        right: offsetX + s(48),
        top: offsetY + s(538),
        bottom: 0,
      },
      dockControls: {
        right: s(80),
        top: -s(26),
      },
      controlSmall: Math.max(34, s(42)),
      controlPrimary: Math.max(42, s(52)),
    }
  }, [screenHeight, screenWidth])

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
    previous: () => { if (musicInfo.id) void playPrev() },
    rewind: () => { if (musicInfo.id) void playPrev() },
    next: () => { if (musicInfo.id) void playNext() },
    fastForward: () => { if (musicInfo.id) void playNext() },
    stop: () => { if (musicInfo.id && isPlay) togglePlay() },
    down: () => { revealControls(); setFocusToken(t => t + 1) },
    up: () => { revealControls(); setFocusToken(t => t + 1) },
    menu: () => { pushTVSettingsScreen(componentId) },
  })

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
      activeDisplayLine,
      seekLine(1, 1),
      seekLine(1, 2),
      seekLine(1, 3),
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
      <View style={styles.playbackBackdrop}>
        {musicInfo.pic ? (
          <ImageBackground source={{ uri: musicInfo.pic, headers: defaultHeaders }} blurRadius={34} resizeMode="cover" style={styles.backdropImage}>
            <View style={styles.backdropImageScrim} />
          </ImageBackground>
        ) : null}
        <View style={styles.backdropDeepWash} />
        <View style={styles.backdropTopShade} />
        <View style={styles.backdropBottomShade} />
      </View>
      <View style={styles.root}>
        <View style={styles.nowPlayingArea}>
          <View style={[styles.albumColumn, appleLayout.albumColumn]}>
            <View style={[styles.coverStage, appleLayout.coverStage]}>
              <View style={[styles.coverGlow, appleLayout.coverGlow]} />
              <View style={[styles.coverWrap, appleLayout.coverWrap]}>
                <View style={[styles.cover, appleLayout.cover]}>
                  {musicInfo.pic ? <Image url={musicInfo.pic} resizeMode="cover" style={styles.coverImage as ImageStyle} /> : <TVText variant="pageTitle">zl</TVText>}
                </View>
              </View>
            </View>
            <View style={[styles.songIdentity, appleLayout.songIdentity]}>
              <TVText variant="pageTitle" style={[styles.songTitle, appleLayout.songTitle]} numberOfLines={2}>{musicInfo.name || tvText.welcome}</TVText>
              <View style={[styles.metaRow, appleLayout.metaRow]}>
                <TVText variant="body" style={[styles.songMeta, appleLayout.songMeta]} numberOfLines={1}>{musicInfo.id ? (musicInfo.singer || tvText.unknownSinger) : tvText.chooseMusicHint}</TVText>
                {musicInfo.id ? <View style={styles.metaDot} /> : null}
                {musicInfo.id ? <TVText variant="body" style={[styles.sourceMeta, appleLayout.sourceMeta]} numberOfLines={1}>{sourceName}</TVText> : null}
              </View>
            </View>
          </View>

          <View style={[styles.lyricColumn, appleLayout.lyricColumn]}>
            <Focusable
              key={`lyric_${hideKey}`} ref={lyricFocus.ref as any}
              style={styles.lyricStage}
              focusStyle={styles.lyricStageFocused}
              hasTVPreferredFocus={!showControls}
              onPress={() => { revealControls() }}
            >
              <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={[styles.lyricContent, appleLayout.lyricContent]} scrollEnabled={false}>
                {displayLyrics.map(item => (
                  <View key={item.key} style={[styles.lyricRow, item.active ? styles.lyricRowActive : null]}>
                    <TVText
                      variant={item.active ? 'pageTitle' : 'sectionTitle'}
                      style={[
                        styles.lyricText,
                        item.active
                          ? [styles.lyricTextActive, appleLayout.lyricTextActive]
                          : item.distance > 1
                            ? [styles.lyricTextFar, appleLayout.lyricTextFar]
                            : [styles.lyricTextNear, appleLayout.lyricTextNear],
                      ]}
                      numberOfLines={2}
                    >
                      {item.text}
                    </TVText>
                    {item.active && item.translation ? <TVText variant="body" style={[styles.translation, appleLayout.translation]} numberOfLines={1}>{item.translation}</TVText> : null}
                  </View>
                ))}
              </ScrollView>
            </Focusable>
          </View>
        </View>

        {showControls ? (
          <View style={[styles.dockOverlay, appleLayout.dockOverlay]}>
            <TVNowPlayingDock progressPercent={progressPercent} now={progress.nowPlayTimeStr || '00:00'} total={progress.maxPlayTimeStr || '00:00'} style={styles.dock} controlsStyle={appleLayout.dockControls}>
            <View style={styles.primaryControls}>
              <TVRoundControl ref={modeFocus.ref as any} label={getPlayModeName(playMode)} iconName={getPlayModeIconName(playMode)} size={appleLayout.controlSmall} onPress={togglePlayMode} onFocus={handleControlFocus} onBlur={handleControlBlur} accessibilityLabel={getPlayModeName(playMode)} nextFocusRight={prevFocus.getNodeHandle() ?? undefined} />
              <TVRoundControl ref={prevFocus.ref as any} label={tvText.controlPrev} iconName="prevMusic" size={appleLayout.controlSmall} onPress={() => { revealControls(); void playPrev() }} onFocus={handleControlFocus} onBlur={handleControlBlur} accessibilityLabel={tvText.controlPrev} nextFocusLeft={modeFocus.getNodeHandle() ?? undefined} nextFocusRight={playFocus.getNodeHandle() ?? undefined} />
              <TVRoundControl key={`play_${focusToken}`} ref={playFocus.ref as any} label={isPlay ? tvText.pause : tvText.playNow} iconName={isPlay ? 'pause' : 'play'} primary size={appleLayout.controlPrimary} onPress={handleTogglePlay} onFocus={handleControlFocus} onBlur={handleControlBlur} hasTVPreferredFocus nextFocusLeft={prevFocus.getNodeHandle() ?? undefined} nextFocusRight={nextFocus.getNodeHandle() ?? undefined} />
              <TVRoundControl ref={nextFocus.ref as any} label={tvText.controlNext} iconName="nextMusic" size={appleLayout.controlSmall} onPress={() => { revealControls(); void playNext() }} onFocus={handleControlFocus} onBlur={handleControlBlur} accessibilityLabel={tvText.controlNext} nextFocusLeft={playFocus.getNodeHandle() ?? undefined} />
            </View>
            </TVNowPlayingDock>
          </View>
        ) : null}
      </View>
    </TVAppleScaffold>
  )
}

const styles: Record<string, ViewStyle | TextStyle | ImageStyle | any> = {
  scaffoldContent: { overflow: 'hidden', paddingHorizontal: 0, paddingTop: 0, paddingBottom: 0 },
  root: { flex: 1 },
  playbackBackdrop: {
    position: 'absolute',
    left: -66,
    right: -66,
    top: -20,
    bottom: -18,
    overflow: 'visible',
  },
  backdropImage: {
    position: 'absolute',
    left: -160,
    right: -160,
    top: -130,
    bottom: -130,
    opacity: 0.42,
  },
  backdropImageScrim: {
    flex: 1,
    backgroundColor: 'rgba(5,6,10,0.72)',
  },
  backdropDeepWash: {
    position: 'absolute',
    left: 0,
    right: 0,
    top: 0,
    bottom: 0,
    backgroundColor: 'rgba(3,4,8,0.34)',
  },
  backdropTopShade: {
    position: 'absolute',
    left: 0,
    right: 0,
    top: 0,
    height: 170,
    backgroundColor: 'rgba(1,2,6,0.35)',
  },
  backdropBottomShade: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    height: 260,
    backgroundColor: 'rgba(1,2,6,0.42)',
  },
  nowPlayingArea: { flex: 1, minHeight: 0 },
  dockOverlay: {
    position: 'absolute',
    zIndex: 30,
    elevation: 30,
    paddingTop: 4,
    paddingBottom: 0,
    paddingHorizontal: 0,
    borderRadius: 0,
    overflow: 'hidden',
    backgroundColor: 'transparent',
    borderWidth: 0,
    borderColor: 'transparent',
  },
  dockScrimTop: {
    position: 'absolute',
    left: 0,
    right: 0,
    top: 0,
    bottom: 0,
    backgroundColor: 'rgba(255,255,255,0.035)',
  },
  dockHeader: {
    minHeight: 42,
    marginBottom: 10,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 18,
  },
  dockTrackCopy: {
    flex: 1,
    minWidth: 0,
  },
  dockTrackTitle: {
    fontSize: 22,
    lineHeight: 28,
    fontWeight: '900',
  },
  dockTrackMeta: {
    marginTop: 3,
    color: 'rgba(216,230,255,0.72)',
    fontSize: 14,
  },
  dockStatePill: {
    minHeight: 32,
    paddingHorizontal: 12,
    borderRadius: 999,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: 'rgba(216,230,255,0.09)',
    borderWidth: 1,
    borderColor: 'rgba(216,230,255,0.16)',
  },
  dockStateText: { color: tvColors.primaryHigh, fontWeight: '800' },
  albumColumn: { position: 'absolute', justifyContent: 'center' },
  coverStage: { justifyContent: 'center' },
  coverGlow: {
    position: 'absolute',
    width: 280,
    height: 280,
    backgroundColor: 'rgba(255,255,255,0.055)',
  },
  recordDisc: {
    position: 'absolute',
    width: 184,
    height: 184,
    borderRadius: 92,
    right: 8,
    top: 54,
    backgroundColor: 'rgba(8,10,16,0.86)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.12)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  recordRingOuter: {
    position: 'absolute',
    width: 142,
    height: 142,
    borderRadius: 71,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.10)',
  },
  recordRingInner: {
    position: 'absolute',
    width: 92,
    height: 92,
    borderRadius: 46,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
  },
  recordCenter: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: 'rgba(216,230,255,0.18)',
    borderWidth: 1,
    borderColor: 'rgba(216,230,255,0.30)',
  },
  coverBackplate: {
    position: 'absolute',
    width: 250,
    height: 250,
    borderRadius: 42,
    left: -8,
    top: 34,
    backgroundColor: 'rgba(216,230,255,0.10)',
  },
  coverWrap: {
    padding: 1,
    backgroundColor: 'rgba(255,255,255,0.16)',
    shadowColor: '#000000',
    shadowOpacity: 0.62,
    shadowRadius: 34,
    shadowOffset: { width: 0, height: 18 },
    elevation: 28,
  },
  cover: { flex: 1, overflow: 'hidden', alignItems: 'center', justifyContent: 'center', backgroundColor: tvColors.surfaceWarm },
  coverImage: { width: '100%', height: '100%' },
  statusPill: {
    position: 'absolute',
    left: 22,
    bottom: 28,
    minHeight: 34,
    paddingHorizontal: 13,
    borderRadius: 999,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: 'rgba(6,8,14,0.58)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.16)',
  },
  levelMeter: { flexDirection: 'row', alignItems: 'flex-end', gap: 3, height: 16 },
  levelBar: { width: 4, borderRadius: 2, backgroundColor: tvColors.primaryHigh },
  levelBarLow: { height: 8 },
  levelBarMid: { height: 12 },
  levelBarTall: { height: 16 },
  levelBarIdle: { height: 5, backgroundColor: 'rgba(247,248,251,0.46)' },
  statusText: { color: tvColors.text, fontWeight: '800' },
  coverShelf: {
    width: 210,
    height: 30,
    marginTop: 12,
    marginLeft: 18,
    borderRadius: 999,
    backgroundColor: 'rgba(0,0,0,0.28)',
    transform: [{ scaleY: 0.5 }],
  },
  songIdentity: { alignItems: 'center' },
  songIdentityDimmed: { opacity: 0 },
  songTitle: { marginTop: 0, fontWeight: '800', textAlign: 'center' },
  metaRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8 },
  songMeta: { color: 'rgba(247,248,251,0.66)', flexShrink: 1, textAlign: 'center' },
  metaDot: { width: 5, height: 5, borderRadius: 3, backgroundColor: 'rgba(216,230,255,0.55)' },
  sourceMeta: { color: tvColors.primaryHigh },
  lyricColumn: { position: 'absolute', minWidth: 0, justifyContent: 'center' },
  lyricBackdrop: {
    position: 'absolute',
    left: -24,
    right: -24,
    top: 36,
    bottom: 36,
    borderRadius: 42,
    backgroundColor: 'rgba(4,6,12,0.26)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.075)',
  },
  lyricAccent: {
    position: 'absolute',
    left: -8,
    top: 52,
    width: 4,
    height: 122,
    borderRadius: 4,
    backgroundColor: 'rgba(216,230,255,0.55)',
  },
  lyricStage: { flex: 1, justifyContent: 'center', minHeight: 0, paddingTop: 0, paddingLeft: 0 },
  lyricStageFocused: { backgroundColor: 'transparent', borderWidth: 0, shadowOpacity: 0, elevation: 0, transform: [{ scale: 1 }] },
  lyricContent: { flexGrow: 1, justifyContent: 'center', paddingTop: 0, paddingBottom: 0 },
  lyricRow: { marginVertical: 3, opacity: 0.42 },
  lyricRowActive: { opacity: 1, marginVertical: 11 },
  lyricText: { textAlign: 'left' },
  lyricTextActive: { color: tvColors.lyricActive, letterSpacing: 0, textShadowColor: 'rgba(0,0,0,0.50)', textShadowRadius: 24 },
  lyricTextNear: { color: 'rgba(247,248,251,0.31)' },
  lyricTextFar: { color: 'rgba(247,248,251,0.16)' },
  translation: { marginTop: 6, color: tvColors.primaryHigh },
  dock: { paddingHorizontal: 0, paddingBottom: 0, marginTop: 0 },
  primaryControls: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 24, marginTop: 18 },
}

export default memo(TVPlayer)
