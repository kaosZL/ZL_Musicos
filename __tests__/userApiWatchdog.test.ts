import { test, eq } from './harness'
import { createUserApiInitWatchdog, parseUserApiScriptMeta, pickFallbackApiSource } from '../src/core/userApiWatchdog'
import { resolveDismissedDialogRequest } from '../src/components/TV/tvDialogState'

// 使用可控假时钟测试音源初始化看门狗的所有竞态（零延迟、确定性）
const createFakeClock = () => {
  let nextId = 1
  const timers = new Map<number, { fn: () => void, ms: number }>()
  return {
    timers,
    setTimer(fn: () => void, ms: number) {
      const id = nextId++
      timers.set(id, { fn, ms })
      return id
    },
    clearTimer(handle: unknown) {
      timers.delete(handle as number)
    },
    fireAll() {
      const entries = [...timers.entries()]
      for (const [id, item] of entries) {
        if (!timers.has(id)) continue
        timers.delete(id)
        item.fn()
      }
    },
  }
}

test('音源看门狗：脚本静默卡死无回报 → 超时触发一次失败回调', () => {
  const clock = createFakeClock()
  const wd = createUserApiInitWatchdog({ timeoutMs: 12_000, setTimer: clock.setTimer, clearTimer: clock.clearTimer })
  const timedOut: string[] = []
  wd.start({ id: 'tv_preset_juhe', name: '聚合API' }, info => timedOut.push(info.id))
  eq(wd.isPending('tv_preset_juhe'), true)
  clock.fireAll()
  eq(timedOut, ['tv_preset_juhe'])
  eq(wd.isPending(), false)
})

test('音源看门狗：超时前正常 settle → 取消计时器且不再触发超时', () => {
  const clock = createFakeClock()
  const wd = createUserApiInitWatchdog({ timeoutMs: 12_000, setTimer: clock.setTimer, clearTimer: clock.clearTimer })
  const timedOut: string[] = []
  wd.start({ id: 'user_api_1', name: '自定义源' }, info => timedOut.push(info.id))
  eq(wd.settle('user_api_1'), true)
  eq(wd.isPending(), false)
  eq(clock.timers.size, 0)
  clock.fireAll()
  eq(timedOut, [])
})

test('音源看门狗：中途切换音源 B → 自动作废源 A 的计时器，只监控源 B', () => {
  const clock = createFakeClock()
  const wd = createUserApiInitWatchdog({ timeoutMs: 12_000, setTimer: clock.setTimer, clearTimer: clock.clearTimer })
  const timedOut: string[] = []
  wd.start({ id: 'tv_preset_juhe', name: '聚合' }, info => timedOut.push(info.id))
  wd.start({ id: 'tv_preset_grass', name: '野草' }, info => timedOut.push(info.id))
  eq(clock.timers.size, 1)
  eq(wd.settle('tv_preset_juhe'), false) // 旧源晚到回报不能取消新源看门狗
  eq(wd.isPending('tv_preset_grass'), true)
  clock.fireAll()
  eq(timedOut, ['tv_preset_grass'])
})

test('音源看门狗：destroy/cancel 彻底取消在途超时', () => {
  const clock = createFakeClock()
  const wd = createUserApiInitWatchdog({ timeoutMs: 12_000, setTimer: clock.setTimer, clearTimer: clock.clearTimer })
  const timedOut: string[] = []
  wd.start({ id: 'user_api_1', name: '源1' }, info => timedOut.push(info.id))
  wd.cancel()
  eq(wd.isPending(), false)
  clock.fireAll()
  eq(timedOut, [])
})

test('脚本头解析：正确提取 @name / @version / @author，缺失回退默认值', () => {
  const script = '/**\n * @name 野草🌾\n * @version 1\n */\nconsole.log(1)'
  eq(parseUserApiScriptMeta(script, { name: '野草', author: 'pdone' }), {
    name: '野草🌾',
    version: '1',
    author: 'pdone',
  })
  eq(parseUserApiScriptMeta('console.log(1)', { name: '默认源', author: 'anon' }), {
    name: '默认源',
    version: '1',
    author: 'anon',
  })
})

test('删源回退：优先切剩余用户音源 → 未删除预置源 → 无可用返回空串', () => {
  eq(pickFallbackApiSource({
    excludeId: 'user_api_1',
    userApiIds: ['user_api_1', 'user_api_2'],
    presetIds: ['tv_preset_juhe', 'tv_preset_grass'],
    removedSources: [],
    builtinIds: [],
  }), 'user_api_2')

  eq(pickFallbackApiSource({
    excludeId: 'user_api_1',
    userApiIds: ['user_api_1'],
    presetIds: ['tv_preset_juhe', 'tv_preset_grass'],
    removedSources: ['tv_preset_juhe'],
    builtinIds: [],
  }), 'tv_preset_grass')

  eq(pickFallbackApiSource({
    excludeId: 'tv_preset_grass',
    userApiIds: [],
    presetIds: ['tv_preset_juhe', 'tv_preset_grass'],
    removedSources: ['tv_preset_juhe', 'tv_preset_grass'],
    builtinIds: [],
  }), '')
})

test('连环弹窗仲裁：btn.onPress 同步弹出新弹窗时，旧弹窗 onDismiss 不得清空新弹窗', () => {
  const dialogA = { title: '菜单' }
  const dialogB = { title: '二次确认' }
  eq(resolveDismissedDialogRequest(dialogA, dialogA), null)
  eq(resolveDismissedDialogRequest(dialogB, dialogA), dialogB)
})
