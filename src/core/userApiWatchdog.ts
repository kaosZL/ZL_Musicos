/**
 * 音源初始化超时看门狗与纯逻辑辅助（v1.9.26，修复 Issue #17 永久「加载中」缺陷）。
 *
 * 背景：预置/第三方音源脚本若在异步请求回调里抛错、或压根不调用 lx.send('inited')，
 * 原生 QuickJS.evaluate 已返回成功，App 侧收不到任何失败事件——状态永久停在「加载中」，
 * apiInitPromise 永不 resolve，预置源自动切换兜底也永不触发。
 * 本模块保持零 React Native 依赖，供单测直接覆盖所有时序与竞态场景。
 */

export const USER_API_INIT_TIMEOUT_MS = 12_000

export interface WatchdogApiMeta {
  id: string
  name: string
}

interface TimerOps {
  timeoutMs?: number
  setTimer?: (fn: () => void, ms: number) => unknown
  clearTimer?: (handle: unknown) => void
}

export const createUserApiInitWatchdog = (ops: TimerOps = {}) => {
  const timeoutMs = ops.timeoutMs ?? USER_API_INIT_TIMEOUT_MS
  const setTimer = ops.setTimer ?? ((fn, ms) => setTimeout(fn, ms))
  const clearTimer = ops.clearTimer ?? ((handle) => { clearTimeout(handle as ReturnType<typeof setTimeout>) })

  let seq = 0
  let timer: unknown = null
  let pending: { seq: number, info: WatchdogApiMeta } | null = null

  const clearCurrent = () => {
    if (timer != null) {
      clearTimer(timer)
      timer = null
    }
    pending = null
  }

  return {
    /** 启动一轮新的初始化看门狗；会自动作废上一轮未完成的计时器 */
    start(info: WatchdogApiMeta, onTimeout: (meta: WatchdogApiMeta) => void): number {
      clearCurrent()
      const mySeq = ++seq
      pending = { seq: mySeq, info }
      timer = setTimer(() => {
        if (!pending || pending.seq !== mySeq) return
        const timedOut = pending.info
        clearCurrent()
        onTimeout(timedOut)
      }, timeoutMs)
      return mySeq
    },

    /** 收到初始化成功/失败事件时取消看门狗；返回是否确实消费了一个待定任务 */
    settle(id?: string): boolean {
      if (!pending) return false
      if (id != null && pending.info.id !== id) return false
      clearCurrent()
      return true
    },

    /** 销毁脚本或切走非脚本源时彻底取消 */
    cancel() {
      seq += 1
      clearCurrent()
    },

    isPending(id?: string): boolean {
      if (!pending) return false
      return id == null ? true : pending.info.id === id
    },
  }
}

/** 共享的音源脚本头注释解析（保证启动自动加载与设置页手动切换拿到一致的 @version） */
export const parseUserApiScriptMeta = (
  script: string,
  fallback: { name: string, author: string, version?: string },
) => {
  const header = /^\/\*[\S|\s]+?\*\//.exec(script)?.[0] ?? ''
  const parsedName = /@name\s*(.+)/.exec(header)?.[1]?.trim()
  const parsedVersion = /@version\s*(\S+)/.exec(header)?.[1]?.trim()
  const parsedAuthor = /@author\s*(.+)/.exec(header)?.[1]?.trim()
  return {
    name: parsedName || fallback.name,
    version: parsedVersion || fallback.version || '1',
    author: parsedAuthor || fallback.author,
  }
}

/** 删除正在使用的音源时挑选下一个真实可用的回退源（无可用源时才返回 ''） */
export const pickFallbackApiSource = (params: {
  excludeId: string
  userApiIds: readonly string[]
  presetIds: readonly string[]
  removedSources: readonly string[]
  builtinIds: readonly string[]
}): string => {
  const { excludeId, userApiIds, presetIds, removedSources, builtinIds } = params
  const nextUser = userApiIds.find(id => id && id !== excludeId)
  if (nextUser) return nextUser
  const nextPreset = presetIds.find(id => id && id !== excludeId && !removedSources.includes(id))
  if (nextPreset) return nextPreset
  const nextBuiltin = builtinIds.find(id => id && id !== excludeId && !removedSources.includes(id))
  if (nextBuiltin) return nextBuiltin
  return ''
}

export const userApiInitWatchdog = createUserApiInitWatchdog()

let timeoutHandler: ((info: WatchdogApiMeta) => void) | null = null

export const setUserApiInitTimeoutHandler = (handler: ((info: WatchdogApiMeta) => void) | null) => {
  timeoutHandler = handler
}

export const armUserApiInitWatchdog = (info: WatchdogApiMeta) => {
  userApiInitWatchdog.start(info, (timedOut) => {
    timeoutHandler?.(timedOut)
  })
}
