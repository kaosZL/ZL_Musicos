import { test, eq } from './harness'
import { shouldDirectControlHandleKey } from '../src/screens/TV/playerDirectControlGate'

// 直控门控回归表——每条规则对应一个真实历史 bug（v1.9.25 收口重构时固化）
const base = {
  canPlay: true,
  focusOnControl: false,
  isSeekKey: false,
  controlsVisible: false,
  msSinceControlFocus: 60_000,
}

test('常规直控：栏隐藏、焦点在歌词 → 放行', () => {
  eq(shouldDirectControlHandleKey(base), true)
})

test('v1.9.23 播放键双触发：焦点在控制按钮上 → 拒绝（按钮自己处理）', () => {
  eq(shouldDirectControlHandleKey({ ...base, focusOnControl: true }), false)
})

test('v1.9.21 规则：控制栏呼出时左右键不直控切歌（须 OK 确认）', () => {
  eq(shouldDirectControlHandleKey({ ...base, isSeekKey: true, controlsVisible: true }), false)
})

test('呼出态 OK 直控仍放行（暂停/播放快捷键两态保留）', () => {
  eq(shouldDirectControlHandleKey({ ...base, isSeekKey: false, controlsVisible: true }), true)
})

test('Issue #9 空窗守卫：控制按钮失焦后 500ms 内直控不抢答', () => {
  eq(shouldDirectControlHandleKey({ ...base, msSinceControlFocus: 300 }), false)
  eq(shouldDirectControlHandleKey({ ...base, msSinceControlFocus: 600 }), true)
})

test('无歌可操作 → 全部拒绝', () => {
  eq(shouldDirectControlHandleKey({ ...base, canPlay: false }), false)
  eq(shouldDirectControlHandleKey({ ...base, canPlay: false, isSeekKey: true, controlsVisible: true }), false)
})
