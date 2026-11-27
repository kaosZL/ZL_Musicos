/**
 * 播放页直控门控（纯函数，有单测）——守卫规则在此一目了然：
 * ① isActiveScreen：非活动屏（压在导航栈底）不响应
 * ② dialogActive / fullscreenLyrics：弹窗或全屏歌词期间完全让路
 * ③ focusOnControl：焦点在控制按钮上时不直控（v1.9.23 播放键双触发）
 * ④ seek 键在呼出态不直控（v1.9.21 老板拍板：操作模式切歌须 OK 确认）
 * ⑤ 500ms 空窗守卫：控制按钮刚失焦的瞬间不让直控抢答（Issue #9 双触发）
 */
export interface DirectControlGateInput {
  canPlay: boolean
  focusOnControl: boolean
  isSeekKey: boolean
  controlsVisible: boolean
  msSinceControlFocus: number
  isActiveScreen?: boolean
  dialogActive?: boolean
  fullscreenLyrics?: boolean
}

export const shouldDirectControlHandleKey = (input: DirectControlGateInput): boolean => {
  if (input.isActiveScreen === false) return false
  if (input.dialogActive) return false
  if (input.fullscreenLyrics) return false
  if (!input.canPlay) return false
  if (input.focusOnControl) return false
  if (input.isSeekKey && input.controlsVisible) return false
  if (input.msSinceControlFocus < 500) return false
  return true
}
