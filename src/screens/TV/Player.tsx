import { memo, useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Animated, ImageBackground, ScrollView, useWindowDimensions, View, type ImageStyle, type TextStyle, type ViewStyle } from 'react-native'
import Image, { defaultHeaders } from '@/components/common/Image'
import TVAppleScaffold from '@/components/TV/TVAppleScaffold'
import TVText from '@/components/TV/TVText'
import TVRoundControl from '@/components/TV/TVRoundControl'
import Focusable from '@/components/TV/Focusable'
import TVNowPlayingDock from '@/components/TV/TVNowPlayingDock'
import TVFadeOverlay from '@/components/TV/TVFadeOverlay'
import { getTVLayoutMetrics, tvColors, tvSize } from '@/theme/tv'
import { useIsPlay, usePlayerMusicInfo, useProgress } from '@/store/player/hook'
import { playNext, playPrev, togglePlay } from '@/core/player/player'
import { useSettingValue } from '@/store/setting/hook'
import { updateSetting } from '@/core/common'
import { useTVFocusRef } from '@/components/TV/useTVFocusRef'
import { useTVNavigationBack } from '@/utils/hooks/useTVNavigationBack'
import { getDominantColor } from '@/utils/nativeModules/utils'
import { useLrcPlay, useLrcSet } from '@/plugins/lyric'
import { MUSIC_TOGGLE_MODE, MUSIC_TOGGLE_MODE_LIST } from '@/config/constant'
import { tvText } from './labels'
import { getPlayModeName, getSourceName } from './utils'
import { isDisplayLyric } from './lyricFilter'
import { buildLyricWindow } from './playerLyrics'
import { buildPlayerLayout } from './playerLayout'
import { usePlayerControlDeck } from './usePlayerControlDeck'

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


function TVPlayer({ componentId }: { componentId: string }) {
  const musicInfo = usePlayerMusicInfo()
  const isPlay = useIsPlay()
  const progress = useProgress()
  const lyricPlay = useLrcPlay()
  const lyricLines = useLrcSet()
  const apiSource = useSettingValue('common.apiSource')
  const playMode = useSettingValue('player.togglePlayMethod')
  const prevFocus = useTVFocusRef()
  const playFocus = useTVFocusRef()
  const nextFocus = useTVFocusRef()
  const modeFocus = useTVFocusRef()
  const lyricFocus = useTVFocusRef()
  const progressPercent = Math.max(0, Math.min(progress.progress * 100, 100))
  // 控制舱（v1.9.25 收口重构）：控制栏显隐/焦点计数/按键路由/直控门控/返回键拦截/
  // 切歌锁存/全屏歌词/内容再平衡全部收拢在 usePlayerControlDeck，本组件只做视图组合。
  // 按键语义总表见 usePlayerControlDeck.ts 头部注释
  const {
    controlsVisible: showControls,
    hideKey,
    revealControls,
    handleControlFocusChange,
    fullscreenLyrics,
    setFullscreenLyrics,
    contentShiftAnim,
    showAsPlaying,
  } = usePlayerControlDeck({
    componentId,
    canPlay: !!musicInfo.id,
    isPlay,
    musicId: musicInfo.id,
    playFocus,
    onTogglePlay: () => { if (musicInfo.id) togglePlay() },
    onPrev: () => { void playPrev() },
    onNext: () => { void playNext() },
  })
  // 专辑主色动态背景（借鉴 zl-music-tv）：换歌时从封面取主色，动画过渡浸染背景
  const [dominant, setDominant] = useState<string | null>(null)
  const dominantAnim = useRef(new Animated.Value(0)).current
  useEffect(() => {
    let alive = true
    setDominant(null)
    if (!musicInfo.pic) return
    void getDominantColor(musicInfo.pic).then(color => {
      if (alive && color) setDominant(color)
    }).catch(() => { })
    return () => { alive = false }
  }, [musicInfo.pic])
  const prevColorRef = useRef<string | null>(null)
  useEffect(() => {
    if (!dominant) return
    prevColorRef.current = dominant
    dominantAnim.setValue(0)
    // opacity 走原生驱动：useNativeDriver:false 逐帧改背景色会在换歌后 1.2s 内
    // 卡 JS 线程（遥控按键全在 JS 线程分发，会丢按键——v1.9.21 实测按钮发钝）
    Animated.timing(dominantAnim, { toValue: 1, duration: 1200, useNativeDriver: true }).start()
  }, [dominant, dominantAnim])
  // 染色必须半透明：不透明平面会把顶部/底部的渐变遮罩带显形成「方块背景墙」（v1.9.20 首测反馈）
  const hexToRgba = (hex: string, alpha: number) => {
    const n = parseInt(hex.slice(1), 16)
    return `rgba(${(n >> 16) & 255},${(n >> 8) & 255},${n & 255},${alpha})`
  }
  const washFallback = 'rgba(3,4,8,0.34)'   // 原版 deepWash 基色
  const washTo = dominant ? hexToRgba(dominant, 0.55) : washFallback
  // 歌词区方向键路由：
  // 控制栏隐藏（听歌模式）——四向自指，引擎让路：左右=直控切歌、上下/菜单=呼出栏+聚焦播放键；
  // 否则歌词区与底部按钮行垂直重叠会被判「同排」，按左右键焦点会被抢进按钮行。
  // 控制栏呼出（操作模式）——左右键改为跳焦到上一首/下一首按钮（切歌需 OK 确认）
  const [selfHandleTick, setSelfHandleTick] = useState(0)
  useEffect(() => { setSelfHandleTick(t => t + 1) }, [showControls])
  void selfHandleTick // showControls 翻转/首挂载后各强制重渲染一次，让 nextFocus 拿到真实句柄（首帧 ref 未挂载为 null）
  const lyricSelfHandle = lyricFocus.getNodeHandle() ?? undefined
  const sourceName = getSourceName(apiSource)
  const { width: screenWidth, height: screenHeight } = useWindowDimensions()

  const appleLayout = useMemo(
    () => buildPlayerLayout(screenWidth, screenHeight, getTVLayoutMetrics(screenWidth, screenHeight)),
    [screenHeight, screenWidth],
  )

  useTVNavigationBack(componentId)

  const activeLyricIndex = lyricPlay.line >= 0 && lyricPlay.line < lyricLines.length ? lyricPlay.line : -1
  const fallbackLyric = isDisplayLyric(lyricPlay.text) ? lyricPlay.text.trim() : (musicInfo.id ? tvText.loading : tvText.chooseSongFirst)
  const displayLyrics = useMemo(
    () => buildLyricWindow(lyricLines, activeLyricIndex, fallbackLyric),
    [activeLyricIndex, fallbackLyric, lyricLines],
  )

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
          <ImageBackground source={{ uri: musicInfo.pic, headers: defaultHeaders }} blurRadius={appleLayout.backdropBlur} resizeMode="cover" style={[styles.backdropImage, { left: -appleLayout.backdropInsetX, right: -appleLayout.backdropInsetX, top: -appleLayout.backdropInsetY, bottom: -appleLayout.backdropInsetY }]}>
            <View style={styles.backdropImageScrim} />
          </ImageBackground>
        ) : null}
        <View style={styles.backdropDeepWash} />
        {dominant ? (
          <Animated.View style={[styles.backdropTintWash, { backgroundColor: hexToRgba(dominant, 0.32), opacity: dominantAnim }]} />
        ) : null}
        <TVFadeOverlay height={tvSize(170)} peak={0.32} direction="down" />
        <TVFadeOverlay height={tvSize(300)} peak={0.34} direction="up" />
      </View>
      <View style={styles.root}>
        <Animated.View style={[styles.nowPlayingArea, { transform: [{ translateY: contentShiftAnim }] }]}>
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
              onLongPress={() => { setFullscreenLyrics(true) }}
              nextFocusUp={lyricSelfHandle}
              nextFocusDown={lyricSelfHandle}
              nextFocusLeft={showControls ? prevFocus.getNodeHandle() ?? lyricSelfHandle : lyricSelfHandle}
              nextFocusRight={showControls ? nextFocus.getNodeHandle() ?? lyricSelfHandle : lyricSelfHandle}
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
        </Animated.View>

        {fullscreenLyrics ? (
          <View style={styles.fsLyricsRoot}>
            <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.fsLyricsContent}>
              {displayLyrics.map(item => (
                <TVText
                  key={item.key}
                  variant={item.active ? 'pageTitle' : 'body'}
                  style={item.active ? [styles.fsLyricActive, { textShadowColor: washTo }] : styles.fsLyricDim}
                  numberOfLines={2}
                >
                  {item.text}
                </TVText>
              ))}
            </ScrollView>
            <TVText variant="caption" color="rgba(247,248,251,0.35)" style={styles.fsLyricHint}>按 OK 或返回键退出全屏歌词</TVText>
          </View>
        ) : null}
        {showControls ? (
          <View style={[styles.dockOverlay, appleLayout.dockOverlay]}>
            <TVNowPlayingDock progressPercent={progressPercent} now={progress.nowPlayTimeStr || '00:00'} total={progress.maxPlayTimeStr || '00:00'} style={styles.dock} controlsStyle={appleLayout.dockControls}>
            <View style={styles.primaryControls}>
              <TVRoundControl ref={modeFocus.ref as any} label={getPlayModeName(playMode)} iconName={getPlayModeIconName(playMode)} size={appleLayout.controlSmall} onPress={togglePlayMode} onTVFocusChange={handleControlFocusChange} accessibilityLabel={getPlayModeName(playMode)} nextFocusRight={prevFocus.getNodeHandle() ?? undefined} />
              <TVRoundControl ref={prevFocus.ref as any} label={tvText.controlPrev} iconName="prevMusic" size={appleLayout.controlSmall} onPress={() => { revealControls(); void playPrev() }} onTVFocusChange={handleControlFocusChange} accessibilityLabel={tvText.controlPrev} nextFocusLeft={modeFocus.getNodeHandle() ?? undefined} nextFocusRight={playFocus.getNodeHandle() ?? undefined} />
              <TVRoundControl ref={playFocus.ref as any} label={showAsPlaying ? tvText.pause : tvText.playNow} iconName={showAsPlaying ? 'pause' : 'play'} primary size={appleLayout.controlPrimary} onPress={handleTogglePlay} onTVFocusChange={handleControlFocusChange} hasTVPreferredFocus nextFocusLeft={prevFocus.getNodeHandle() ?? undefined} nextFocusRight={nextFocus.getNodeHandle() ?? undefined} />
              <TVRoundControl ref={nextFocus.ref as any} label={tvText.controlNext} iconName="nextMusic" size={appleLayout.controlSmall} onPress={() => { revealControls(); void playNext() }} onTVFocusChange={handleControlFocusChange} accessibilityLabel={tvText.controlNext} nextFocusLeft={playFocus.getNodeHandle() ?? undefined} />
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
    left: -tvSize(66),
    right: -tvSize(66),
    top: -tvSize(20),
    bottom: -tvSize(18),
    overflow: 'visible',
  },
  backdropImage: {
    position: 'absolute',
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
  backdropTintWash: {
    position: 'absolute',
    left: 0,
    right: 0,
    top: 0,
    bottom: 0,
    backgroundColor: 'transparent',
  },
  nowPlayingArea: { flex: 1, minHeight: 0 },
  dockOverlay: {
    position: 'absolute',
    zIndex: 30,
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
  fsLyricsRoot: { position: 'absolute', left: 0, right: 0, top: 0, bottom: 0, zIndex: 40, elevation: 40, backgroundColor: 'rgba(4,5,9,0.96)', justifyContent: 'center', paddingHorizontal: tvSize(90) },
  fsLyricsContent: { flexGrow: 1, justifyContent: 'center', gap: tvSize(16), paddingVertical: tvSize(40) },
  fsLyricActive: { fontSize: tvSize(34), lineHeight: tvSize(46), fontWeight: '900', color: '#F5F5F7', textAlign: 'center', textShadowRadius: 24, textShadowOffset: { width: 0, height: 0 } },
  fsLyricDim: { fontSize: tvSize(20), lineHeight: tvSize(30), color: 'rgba(247,248,251,0.34)', textAlign: 'center' },
  fsLyricHint: { textAlign: 'center', paddingBottom: tvSize(26) },
  lyricTextActive: { color: tvColors.lyricActive, letterSpacing: 0, textShadowColor: 'rgba(0,0,0,0.50)', textShadowRadius: 24 },
  lyricTextNear: { color: 'rgba(247,248,251,0.31)' },
  lyricTextFar: { color: 'rgba(247,248,251,0.16)' },
  translation: { marginTop: 6, color: tvColors.primaryHigh },
  dock: { paddingHorizontal: 0, paddingBottom: 0, marginTop: 0 },
  primaryControls: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 24, marginTop: 18 },
}

export default memo(TVPlayer)
