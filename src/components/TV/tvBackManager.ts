import { onTVRemoteEvent } from '@/utils/nativeModules/utils'
import { exitApp } from '@/utils/tools'
import { isActiveTVFocusScope } from './tvFocusManager'

// TV 返回键统一路由（v1.9.24 返回键收栏三连修的根治方案）。
// 背景：全 App 遥控按键里只有返回键原本走系统 BackHandler——那是全局监听器栈
// （LIFO + 按引用去重），被压在栈底的屏的监听器全部存活，行为取决于看不见的
// 注册顺序（v1.9.21~24 三轮「返回键收栏失效」的共同根源）。
// 方案：MainActivity 把 KEYCODE_BACK 纳入原生截获管线（eventType='back'），
// 本模块作为唯一分发器按优先级问询：弹窗 > 弹层 > 屏级拦截 > 导航返回；
// 无人消费时退出应用（对齐旧 BackHandler 兜底语义）。
export interface TVBackEntry {
  z: number // 300=TVDialog 弹窗 200=全屏弹层 100=屏级拦截（播放页控制栏等） 10=导航返回
  componentId?: string // 传入则仅当该屏是活动屏时才响应（被压栈的屏自动让路）
  handler: () => boolean // 返回 true = 已消费，停止问询
}

const entries = new Set<TVBackEntry>()
let started = false

export const registerTVBack = (entry: TVBackEntry) => {
  entries.add(entry)
  return () => {
    entries.delete(entry)
  }
}

export const startTVBackRouter = () => {
  if (started) return
  started = true
  onTVRemoteEvent(({ eventType, eventKeyAction, repeatCount }) => {
    if (eventType !== 'back') return
    // 只在松开（action=1）且非长按连发时触发一次，与 useTVRemoteActions 同约定
    if (eventKeyAction !== 1 || repeatCount > 0) return
    const list = [...entries].sort((a, b) => b.z - a.z)
    for (const entry of list) {
      if (entry.componentId && !isActiveTVFocusScope(entry.componentId)) continue
      if (entry.handler()) return
    }
    // 无消费者：走 RN 默认返回语义（= 旧的 BackHandler 全链兜底）——
    // RNN 有栈则原生弹栈，根屏则结束应用，与改造前行为完全一致
    exitApp()
  })
}
