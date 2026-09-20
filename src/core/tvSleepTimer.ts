import { togglePlay } from '@/core/player/player'
import playerState from '@/store/player/state'

/**
 * TV 端定时关闭（睡眠定时，09-20 需求）。
 *
 * 两种模式：
 *   1. N 分钟后自动暂停（setSleepTimer）
 *   2. 播完当前这首就停（setStopAfterCurrent）：订阅 playerMusicInfoChanged，
 *      检测到「换歌」的瞬间暂停 —— 而不是等下一首播完，语义才是「播完当前这首」。
 *
 * 模块级单例：定时器不能挂在设置页组件上（页面切走就卸载），必须独立于组件生命周期。
 * 设置页每秒轮询 getSleepTimerState() 显示剩余时间。
 */

let timer: ReturnType<typeof setTimeout> | null = null
let deadline = 0
let stopAfterCurrent = false
let armedMusicId = ''
let musicInfoHandler: ((musicInfo: { id?: string | null }) => void) | null = null

const clearAll = () => {
  if (timer) {
    clearTimeout(timer)
    timer = null
  }
  deadline = 0
  stopAfterCurrent = false
  armedMusicId = ''
  if (musicInfoHandler) {
    global.state_event.off('playerMusicInfoChanged', musicInfoHandler as any)
    musicInfoHandler = null
  }
}

/** N 分钟后暂停播放 */
export const setSleepTimer = (minutes: number) => {
  clearAll()
  deadline = Date.now() + minutes * 60_000
  timer = setTimeout(() => {
    clearAll()
    void togglePlay()
  }, minutes * 60_000)
}

/** 播完当前这首就停 */
export const setStopAfterCurrent = () => {
  clearAll()
  stopAfterCurrent = true
  armedMusicId = (playerState.musicInfo as unknown as { id?: string | null })?.id ?? ''
  musicInfoHandler = (musicInfo) => {
    const nextId = musicInfo?.id ?? ''
    // 只在「换歌」时触发；同一首的元数据刷新（歌词加载等）不触发
    if (stopAfterCurrent && nextId && nextId !== armedMusicId) {
      clearAll()
      void togglePlay()
    }
  }
  global.state_event.on('playerMusicInfoChanged', musicInfoHandler as any)
}

export const clearSleepTimer = clearAll

export const getSleepTimerState = (): { deadline: number, stopAfterCurrent: boolean } => ({
  deadline,
  stopAfterCurrent,
})
