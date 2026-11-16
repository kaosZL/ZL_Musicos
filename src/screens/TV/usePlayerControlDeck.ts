/**
 * 播放页控制舱（v1.9.25 收口重构）：控制栏显隐、焦点计数、按键路由、
 * 直控门控、返回键拦截、切歌锁存、全屏歌词、内容位移动画——全部收拢于此。
 * Player.tsx 只做视图组合，不再持有任何交互状态机。
 *
 * ── 按键语义总表（唯一权威，改动须同步 docs/DEVELOPMENT.md）────────────────
 * │ 状态            │ 左/右             │ OK              │ 上/下/菜单    │ 返回          │
 * │ 全屏歌词        │ ——               │ 退出            │ ——          │ 退出全屏      │
 * │ 栏隐藏·歌词焦点 │ 直控切歌(松键)    │ 暂停/播放+呼出栏 │ 呼出+聚焦播放 │ 退页(z=10)    │
 * │ 栏可见·歌词焦点 │ 跳焦上/下一首按钮 │ 暂停/播放       │ 聚焦播放键   │ 收栏          │
 * │ 栏可见·按钮焦点 │ 按钮 explicit 导航│ 按钮自身(按下)   │ 引擎移动     │ 收栏(清计数)  │
 * ─────────────────────────────────────────────────────────────────────
 * 媒体键（playPause/next/previous 等）在任何状态都直达播放核心。
 */
import { useCallback, useEffect, useRef, useState } from 'react'
import { Animated } from 'react-native'
import { registerTVBack } from '@/components/TV/tvBackManager'
import { focusTVTargetByRef } from '@/components/TV/tvFocusManager'
import { useTVFocusRef } from '@/components/TV/useTVFocusRef'
import { useTVRemoteActions } from '@/utils/hooks/useTVRemoteActions'
import { debugLog, onTVRemoteEvent } from '@/utils/nativeModules/utils'
import { tvSize } from '@/theme/tv'
import { shouldDirectControlHandleKey } from './playerDirectControlGate'

interface DeckOptions {
  componentId: string
  /** 有歌可操作（musicInfo.id 非空） */
  canPlay: boolean
  isPlay: boolean
  /** 歌曲 id 变化时驱动切歌锁存 */
  musicId: string | null | undefined
  playFocus: ReturnType<typeof useTVFocusRef>
  onTogglePlay: () => void
  onPrev: () => void
  onNext: () => void
}

export const usePlayerControlDeck = ({ componentId, canPlay, isPlay, musicId, playFocus, onTogglePlay, onPrev, onNext }: DeckOptions) => {
  // 回调 ref 化：调用方可传内联函数，deck 的按键订阅不因回调身份变化而重建
  const callbacksRef = useRef({ onTogglePlay, onPrev, onNext })
  useEffect(() => { callbacksRef.current = { onTogglePlay, onPrev, onNext } })
  // ── 控制栏显隐（v1.9.24 老板拍板）：不自动隐藏——呼出后常驻，按返回键收起 ──
  const [controlsVisible, setControlsVisible] = useState(false)
  const [hideKey, setHideKey] = useState(0)
  const controlFocusCountRef = useRef(0)
  const controlFocusTimeRef = useRef(0)
  const holdFiredRef = useRef({ left: false, right: false })

  const revealControls = useCallback(() => {
    debugLog('呼出控制栏')
    setControlsVisible(true)
  }, [])

  const handleControlFocusChange = useCallback((focused: boolean) => {
    // 计数挂 onTVFocusChange（引擎/原生双路触发、Focusable 内部去重）——
    // 只挂原生 onFocus 时引擎送焦点可能不回调，计数归零引发直控双触发（v1.9.23 教训）
    if (focused) {
      controlFocusCountRef.current += 1
      controlFocusTimeRef.current = Date.now()
      revealControls()
    } else {
      controlFocusCountRef.current = Math.max(0, controlFocusCountRef.current - 1)
      revealControls()
    }
  }, [revealControls])

  useEffect(() => {
    if (!controlsVisible) setHideKey(k => k + 1)
  }, [controlsVisible])

  // ── 全屏歌词 ──
  const [fullscreenLyrics, setFullscreenLyrics] = useState(false)
  useEffect(() => {
    if (!fullscreenLyrics) return
    return onTVRemoteEvent(({ eventType, eventKeyAction, repeatCount }) => {
      if (eventType === 'select' && eventKeyAction === 1 && repeatCount === 0) setFullscreenLyrics(false)
    })
  }, [fullscreenLyrics])

  // ── 返回键（统一管线 z=100 屏级拦截，单处理器单优先级）：
  //    全屏歌词 > 收起控制栏 > 交给导航返回（z=10） ──
  const controlsVisibleRef = useRef(controlsVisible)
  useEffect(() => { controlsVisibleRef.current = controlsVisible }, [controlsVisible])
  const fullscreenLyricsRef = useRef(fullscreenLyrics)
  useEffect(() => { fullscreenLyricsRef.current = fullscreenLyrics }, [fullscreenLyrics])
  useEffect(() => {
    return registerTVBack({
      z: 100,
      componentId,
      handler: () => {
        if (fullscreenLyricsRef.current) {
          debugLog('back键: 退出全屏歌词')
          setFullscreenLyrics(false)
          return true
        }
        debugLog(`back键: controlsVisible=${controlsVisibleRef.current} 焦点计数=${controlFocusCountRef.current}`)
        if (!controlsVisibleRef.current) {
          debugLog('back键: 控制栏已隐藏 → 交给导航返回')
          return false
        }
        setControlsVisible(false)
        controlFocusCountRef.current = 0
        debugLog('back键: 收起控制栏')
        return true
      },
    })
  }, [componentId])

  // ── 内容再平衡（Issue #13）：控制栏隐藏时封面/歌词整体下移约半栏高度 ──
  const contentShiftAnim = useRef(new Animated.Value(0)).current
  useEffect(() => {
    Animated.timing(contentShiftAnim, { toValue: controlsVisible ? 0 : tvSize(56), duration: 280, useNativeDriver: true }).start()
  }, [controlsVisible, contentShiftAnim])

  // ── 呼出后聚焦播放键：dock 渲染完成前 ref 为空，500ms 内轮询重试 ──
  const focusPlayAfterReveal = useCallback(() => {
    if (controlFocusCountRef.current > 0) return
    let tries = 0
    const tick = () => {
      if (controlFocusCountRef.current > 0) return
      if (playFocus.ref.current) {
        void focusTVTargetByRef(playFocus.ref.current)
        return
      }
      if (++tries > 10) return
      setTimeout(tick, 50)
    }
    requestAnimationFrame(tick)
  }, [playFocus.ref])

  // ── 媒体键 + 呼出键（key UP，活动屏限定）──
  useTVRemoteActions({
    playPause: () => { if (canPlay) callbacksRef.current.onTogglePlay() },
    previous: () => { if (canPlay) callbacksRef.current.onPrev() },
    rewind: () => { if (canPlay) callbacksRef.current.onPrev() },
    next: () => { if (canPlay) callbacksRef.current.onNext() },
    fastForward: () => { if (canPlay) callbacksRef.current.onNext() },
    stop: () => { if (canPlay && isPlay) callbacksRef.current.onTogglePlay() },
    down: () => { revealControls(); focusPlayAfterReveal() },
    up: () => { revealControls(); focusPlayAfterReveal() },
    menu: () => { revealControls(); focusPlayAfterReveal() },
  }, componentId)

  // ── 直控层：OK=暂停/播放（松键）、左右=切歌（松键、长按只记账防误触）──
  const canPlayRef = useRef(canPlay)
  useEffect(() => { canPlayRef.current = canPlay }, [canPlay])
  const controlsVisibleRefForGate = useRef(controlsVisible)
  useEffect(() => { controlsVisibleRefForGate.current = controlsVisible }, [controlsVisible])
  useEffect(() => {
    return onTVRemoteEvent(({ eventType, eventKeyAction, repeatCount }) => {
      const isSeekKey = eventType === 'left' || eventType === 'right'
      const isSelectKey = eventType === 'select'
      if (!isSeekKey && !isSelectKey) return
      if (!shouldDirectControlHandleKey({
        canPlay: canPlayRef.current,
        focusOnControl: controlFocusCountRef.current > 0,
        isSeekKey,
        controlsVisible: controlsVisibleRefForGate.current,
        msSinceControlFocus: Date.now() - controlFocusTimeRef.current,
      })) return
      if (isSelectKey) {
        if (eventKeyAction === 1) callbacksRef.current.onTogglePlay()
        return
      }
      const dir = eventType === 'left' ? 'left' : 'right'
      if (eventKeyAction === 0 && (repeatCount ?? 0) > 0) {
        holdFiredRef.current[dir] = true
      } else if (eventKeyAction === 0) {
        holdFiredRef.current[dir] = false
      } else if (eventKeyAction === 1) {
        if (holdFiredRef.current[dir]) {
          holdFiredRef.current[dir] = false
          return
        }
        if (eventType === 'left') callbacksRef.current.onPrev()
        else callbacksRef.current.onNext()
      }
    })
  }, [])

  // ── 切歌锁存（v1.9.21）：取新歌链接期间 isPlay 闪断，播放键图标维持播放态 ──
  const lastPlayingAtRef = useRef(0)
  const pendingPlayRef = useRef(false)
  const [pendingPlay, setPendingPlay] = useState(false)
  const prevMusicIdRef = useRef(musicId)
  useEffect(() => {
    if (!isPlay) return
    lastPlayingAtRef.current = Date.now()
    if (pendingPlayRef.current) {
      pendingPlayRef.current = false
      setPendingPlay(false)
    }
  }, [isPlay])
  useEffect(() => {
    if (musicId === prevMusicIdRef.current) return
    prevMusicIdRef.current = musicId
    if (!musicId) return
    if (Date.now() - lastPlayingAtRef.current > 5000) return
    pendingPlayRef.current = true
    setPendingPlay(true)
    const timer = setTimeout(() => {
      pendingPlayRef.current = false
      setPendingPlay(false)
    }, 8000)
    return () => clearTimeout(timer)
  }, [musicId])
  const showAsPlaying = isPlay || pendingPlay

  return {
    controlsVisible,
    hideKey,
    revealControls,
    handleControlFocusChange,
    fullscreenLyrics,
    setFullscreenLyrics,
    contentShiftAnim,
    showAsPlaying,
  }
}
