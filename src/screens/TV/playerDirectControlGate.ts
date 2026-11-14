/**
 * 播放页直控门控（纯函数，有单测）——三个历史 bug 的守卫规则在此一目了然：
 * ① focusOnControl：焦点在控制按钮上时不直控（v1.9.23 播放键双触发）
 * ② seek 键在呼出态不直控（v1.9.21 老板拍板：操作模式切歌须 OK 确认）
 * ③ 500ms 空窗守卫：控制按钮刚失焦的瞬间不让直控抢答（Issue #9 双触发）
 */
export interface DirectControlGateInput {
  canPlay: boolean
  focusOnControl: boolean
  isSeekKey: boolean
  controlsVisible: boolean
  msSinceControlFocus: number
}

export const shouldDirectControlHandleKey = (input: DirectControlGateInput): boolean => {
  if (!input.canPlay) return false
  if (input.focusOnControl) return false
  if (input.isSeekKey && input.controlsVisible) return false
  if (input.msSinceControlFocus < 500) return false
  return true
}
