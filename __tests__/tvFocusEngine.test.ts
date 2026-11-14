import { test, eq, ok } from './harness'
import {
  clearActiveTVFocusScope,
  focusPreferredTVTarget,
  focusTVTargetByRef,
  moveTVFocus,
  registerTVFocusTarget,
  setActiveTVFocusScope,
  subscribeTVTargetFocusState,
  unregisterTVFocusTarget,
  updateTVFocusTarget,
} from '../src/components/TV/tvFocusManager'

let nextTag = 100

/** 造假焦点目标：独立句柄 + 同步 measure 回调（引擎的 measureInWindow 是异步回调，测试桩同步给值） */
const makeTarget = (scope: string, x: number, y: number, w = 100, h = 50, preferred = false) => {
  const ref = {
    __tag: nextTag++,
    measureInWindow(cb: (a: number, b: number, c: number, d: number) => void) { cb(x, y, w, h) },
    focus() { },
  } as any
  const id = registerTVFocusTarget(scope, ref, preferred)
  const states: boolean[] = []
  subscribeTVTargetFocusState(id, focused => { states.push(focused) })
  return { id, ref, states, focused: () => states[states.length - 1] === true }
}

const cleanup = (scope: string, ids: number[]) => {
  for (const id of ids) unregisterTVFocusTarget(id)
  clearActiveTVFocusScope(scope)
}

test('方向移动：纵向逐个下移', async() => {
  const scope = 'engine-t1'
  setActiveTVFocusScope(scope)
  const a = makeTarget(scope, 0, 0)
  const b = makeTarget(scope, 0, 100)
  const c = makeTarget(scope, 0, 200)
  await focusTVTargetByRef(a.ref)
  ok(await moveTVFocus('down'), '应有下移候选')
  ok(b.focused() && !a.focused(), '焦点应移到 b')
  ok(await moveTVFocus('down'), 'b 下还应能到 c')
  ok(c.focused(), '焦点应到 c')
  cleanup(scope, [a.id, b.id, c.id])
})

test('同排优先：副轴远离的候选不抢焦点（顶部导航条抢焦点类 bug 的回归测试）', async() => {
  const scope = 'engine-t2'
  setActiveTVFocusScope(scope)
  // active 在 (0,100)；A 在右侧但另一排（更近的主轴距离）；B 在右侧同排（更远的主轴距离）
  const active = makeTarget(scope, 0, 100)
  const farRow = makeTarget(scope, 300, 0)     // y∈[0,50]，与 active 无垂直重叠
  const sameRow = makeTarget(scope, 400, 100)  // y∈[100,150]，同排
  await focusTVTargetByRef(active.ref)
  ok(await moveTVFocus('right'))
  ok(sameRow.focused(), '同排候选应胜出')
  ok(!farRow.focused(), '另一排候选不应抢焦点')
  cleanup(scope, [active.id, farRow.id, sameRow.id])
})

test('显式 nextFocus 优先于空间打分', async() => {
  const scope = 'engine-t3'
  setActiveTVFocusScope(scope)
  const active = makeTarget(scope, 0, 0)
  const explicit = makeTarget(scope, 900, 500) // 空间上很远
  const nearer = makeTarget(scope, 150, 0)     // 空间上更近
  await focusTVTargetByRef(active.ref)
  updateTVFocusTarget(active.id, { nextFocusRight: explicit.ref.__tag })
  ok(await moveTVFocus('right'))
  ok(explicit.focused() && !nearer.focused(), '显式目标应优先')
  cleanup(scope, [active.id, explicit.id, nearer.id])
})

test('无候选时移动失败且焦点保持', async() => {
  const scope = 'engine-t4'
  setActiveTVFocusScope(scope)
  const alone = makeTarget(scope, 0, 0)
  await focusTVTargetByRef(alone.ref)
  eq(await moveTVFocus('right'), false, '右侧无候选应返回 false')
  ok(alone.focused(), '焦点保持不变')
  cleanup(scope, [alone.id])
})

test('preferred 兜底：无活动焦点时聚焦 preferred 目标', async() => {
  const scope = 'engine-t5'
  setActiveTVFocusScope(scope)
  const normal = makeTarget(scope, 0, 0)
  const preferred = makeTarget(scope, 0, 200, 100, 50, true)
  ok(await focusPreferredTVTarget())
  ok(preferred.focused() && !normal.focused())
  cleanup(scope, [normal.id, preferred.id])
})

test('活动目标卸载后回退到 preferred', async() => {
  const scope = 'engine-t6'
  setActiveTVFocusScope(scope)
  const preferred = makeTarget(scope, 0, 200, 100, 50, true)
  const temp = makeTarget(scope, 0, 0)
  await focusTVTargetByRef(temp.ref)
  ok(temp.focused())
  unregisterTVFocusTarget(temp.id) // 模拟聚焦目标随控制栏卸载
  ok(await focusPreferredTVTarget())
  ok(preferred.focused(), '应回退到 preferred')
  cleanup(scope, [preferred.id])
})

test('合并排队：测量在途时连发按键只记最新方向（长按连发不丢步）', async() => {
  const scope = 'engine-t7'
  setActiveTVFocusScope(scope)
  const a = makeTarget(scope, 0, 0)
  const b = makeTarget(scope, 0, 100)
  const c = makeTarget(scope, 0, 200)
  const d = makeTarget(scope, 0, 300)
  await focusTVTargetByRef(a.ref)
  // 不 await 连发三次下：第一次在途，后两次只保留最新方向 → 净效果前进两步
  void moveTVFocus('down')
  void moveTVFocus('down')
  void moveTVFocus('down')
  await new Promise(resolve => setTimeout(resolve, 100))
  ok(c.focused(), `合并排队后焦点应在 c（实际 ${a.focused() ? 'a' : b.focused() ? 'b' : c.focused() ? 'c' : d.focused() ? 'd' : '无'}）`)
  ok(!d.focused(), '第三次连发应被合并掉，不应到 d')
  cleanup(scope, [a.id, b.id, c.id, d.id])
})
