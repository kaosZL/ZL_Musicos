import { createContext } from 'react'
import { findNodeHandle } from 'react-native'
import type { ComponentRef } from 'react'
import type { Pressable } from 'react-native'
import { requestTVFocus } from '@/utils/nativeModules/utils'

type Direction = 'up' | 'down' | 'left' | 'right'

type FocusTargetRef = ComponentRef<typeof Pressable>

interface FocusTarget {
  id: number
  scopeId: string
  ref: FocusTargetRef | null
  preferred: boolean
  rect: FocusRect | null
  nextFocusUp?: number
  nextFocusDown?: number
  nextFocusLeft?: number
  nextFocusRight?: number
  onPress?: () => void
  onLongPress?: () => void
}

type FocusStateListener = (focused: boolean) => void

interface FocusRect {
  x: number
  y: number
  width: number
  height: number
}

export const TVFocusScopeContext = createContext('tv-root')
const targets = new Map<number, FocusTarget>()
const focusListeners = new Map<number, FocusStateListener>()
let activeTargetId: number | null = null
let activeScopeId: string | null = null
let fallbackTimer: ReturnType<typeof setTimeout> | null = null
let nextTargetId = 1

const centerX = (rect: FocusRect) => rect.x + rect.width / 2
const centerY = (rect: FocusRect) => rect.y + rect.height / 2
const getDirectionalThreshold = (from: FocusRect, to: FocusRect, direction: Direction) => {
  const primarySize = direction === 'up' || direction === 'down'
    ? Math.min(from.height, to.height)
    : Math.min(from.width, to.width)
  return Math.max(14, primarySize * 0.28)
}

const isVisibleRect = (rect: FocusRect | null): rect is FocusRect => {
  return !!rect && rect.width > 1 && rect.height > 1
}

const requestNativeFocus = (target: FocusTarget) => {
  const tag = target.ref ? findNodeHandle(target.ref) : null
  if (tag) requestTVFocus(tag)
  target.ref?.focus?.()
}

const emitFocusState = (id: number | null, focused: boolean) => {
  if (!id) return
  focusListeners.get(id)?.(focused)
}

const clearActiveTarget = () => {
  if (activeTargetId) emitFocusState(activeTargetId, false)
  activeTargetId = null
}

export const blurActiveTVTarget = clearActiveTarget

const setActiveTarget = (target: FocusTarget) => {
  if (activeTargetId && activeTargetId !== target.id) emitFocusState(activeTargetId, false)
  activeTargetId = target.id
  emitFocusState(target.id, true)
  requestNativeFocus(target)
}

const getScopedTargets = () => {
  const list = Array.from(targets.values())
  return activeScopeId ? list.filter(target => target.scopeId === activeScopeId) : list
}

const measureTarget = async(target: FocusTarget) => new Promise<FocusTarget | null>(resolve => {
  if (!target.ref?.measureInWindow) {
    resolve(null)
    return
  }

  target.ref.measureInWindow((x, y, width, height) => {
    target.rect = { x, y, width, height }
    resolve(isVisibleRect(target.rect) ? target : null)
  })
})

const measureTargets = async() => {
  const measured = await Promise.all(getScopedTargets().map(measureTarget))
  return measured.filter(Boolean) as FocusTarget[]
}

const getActiveTarget = (measured: FocusTarget[]) => {
  if (activeTargetId) {
    const active = measured.find(target => target.id === activeTargetId)
    if (active) return active
  }
  return measured.find(target => target.preferred) ?? measured[0] ?? null
}

const getNativeHandle = (target: FocusTarget) => target.ref ? findNodeHandle(target.ref) : null

const getExplicitNextFocusHandle = (target: FocusTarget, direction: Direction) => {
  switch (direction) {
    case 'up': return target.nextFocusUp
    case 'down': return target.nextFocusDown
    case 'left': return target.nextFocusLeft
    case 'right': return target.nextFocusRight
  }
}

const getExplicitNextTarget = (target: FocusTarget, measured: FocusTarget[], direction: Direction) => {
  const nextHandle = getExplicitNextFocusHandle(target, direction)
  if (!nextHandle) return null
  return measured.find(item => getNativeHandle(item) === nextHandle) ?? null
}

const getCandidateScore = (from: FocusRect, to: FocusRect, direction: Direction) => {
  const fromX = centerX(from)
  const fromY = centerY(from)
  const toX = centerX(to)
  const toY = centerY(to)
  const dx = toX - fromX
  const dy = toY - fromY
  const sameColumnPenalty = Math.abs(dx)
  const sameRowPenalty = Math.abs(dy)
  const minDistance = getDirectionalThreshold(from, to, direction)

  switch (direction) {
    case 'up':
      if (dy >= -minDistance) return null
      return Math.abs(dy) * 1000 + sameColumnPenalty
    case 'down':
      if (dy <= minDistance) return null
      return Math.abs(dy) * 1000 + sameColumnPenalty
    case 'left':
      if (dx >= -minDistance) return null
      return Math.abs(dx) * 1000 + sameRowPenalty
    case 'right':
      if (dx <= minDistance) return null
      return Math.abs(dx) * 1000 + sameRowPenalty
  }
}

/**
 * 两个矩形在垂直方向是否有重叠（用于左右移动判定「同一排」）。
 */
const hasVerticalOverlap = (from: FocusRect, to: FocusRect) =>
  Math.min(from.y + from.height, to.y + to.height) > Math.max(from.y, to.y)

/**
 * 两个矩形在水平方向是否有重叠（用于上下移动判定「同一列」）。
 */
const hasHorizontalOverlap = (from: FocusRect, to: FocusRect) =>
  Math.min(from.x + from.width, to.x + to.width) > Math.max(from.x, to.x)

/**
 * 从候选里挑出「同排 / 同列」的那些。
 *
 * 为什么需要这一步：getCandidateScore 里主轴差 ×1000、副轴差 ×1，
 * 于是「副轴偏离」的权重几乎为 0 —— 只要在主轴方向上近 1px（1000 分），
 * 就足以压过一个副轴偏离几百像素的候选。
 * 典型翻车现场：顶部导航条（tab）与下方内容卡片在水平方向上落在同一段 x 区间时，
 * 从卡片按「右」会被导航条抢走（导航条水平上近几像素，竖直上偏了三五百像素），
 * 反之从导航条按「左」也会跳到下方卡片上。用户表现就是「遥控器选不中那张卡」。
 * 这里先只看「有重叠」的候选（同一排 / 同一列），没有重叠候选时才退回原来的全局打分。
 */
const getSameBandCandidates = (from: FocusRect, candidates: Array<{ target: FocusTarget, score: number }>, direction: Direction) => {
  const horizontalMove = direction === 'left' || direction === 'right'
  const inBand = candidates.filter(({ target }) => {
    if (!target.rect) return false
    return horizontalMove ? hasVerticalOverlap(from, target.rect) : hasHorizontalOverlap(from, target.rect)
  })
  return inBand.length ? inBand : candidates
}

export const setActiveTVFocusScope = (scopeId: string) => {
  if (activeScopeId !== scopeId) {
    clearActiveTarget()
    activeScopeId = scopeId
  }
  scheduleTVInitialFocus()
}

export const clearActiveTVFocusScope = (scopeId: string) => {
  if (activeScopeId === scopeId) {
    clearActiveTarget()
    activeScopeId = null
  }
}

export const isActiveTVFocusScope = (scopeId: string) => activeScopeId === scopeId

export const registerTVFocusTarget = (scopeId: string, ref: FocusTargetRef | null, preferred: boolean, onPress?: () => void) => {
  const id = nextTargetId++
  targets.set(id, { id, scopeId, ref, preferred, rect: null, onPress })

  if (preferred && (!activeScopeId || activeScopeId === scopeId)) scheduleTVInitialFocus()

  return id
}

export const updateTVFocusTarget = (id: number, patch: Partial<Omit<FocusTarget, 'id'>>) => {
  const target = targets.get(id)
  if (!target) return
  targets.set(id, { ...target, ...patch })
}

export const unregisterTVFocusTarget = (id: number) => {
  if (activeTargetId === id) emitFocusState(id, false)
  focusListeners.delete(id)
  targets.delete(id)
  if (activeTargetId === id) activeTargetId = null
}

export const notifyTVTargetFocused = (id: number) => {
  if (activeTargetId && activeTargetId !== id) emitFocusState(activeTargetId, false)
  activeTargetId = id
  emitFocusState(id, true)
}

export const subscribeTVTargetFocusState = (id: number, listener: FocusStateListener) => {
  focusListeners.set(id, listener)
  listener(activeTargetId === id)
  return () => {
    if (focusListeners.get(id) === listener) focusListeners.delete(id)
  }
}

export const focusPreferredTVTarget = async() => {
  const measured = await measureTargets()
  // 取最后一个 preferred 目标（最近注册的——弹窗按钮比页面按钮晚注册，
  // 这样弹窗打开时初始焦点落在弹窗按钮而非背景按钮）
  let target: FocusTarget | null = null
  for (const t of measured) {
    if (t.preferred) target = t
  }
  if (!target) target = measured[0]
  if (!target) return false
  setActiveTarget(target)
  return true
}

export const scheduleTVInitialFocus = () => {
  if (fallbackTimer) clearTimeout(fallbackTimer)
  fallbackTimer = setTimeout(() => {
    fallbackTimer = null
    void focusPreferredTVTarget()
  }, 260)
}

export const moveTVFocus = async(direction: Direction) => {
  const measured = await measureTargets()
  const active = getActiveTarget(measured)
  if (!active?.rect) {
    const preferred = measured.find(target => target.preferred) ?? measured[0]
    if (!preferred) return false
    setActiveTarget(preferred)
    return true
  }

  const explicitTarget = getExplicitNextTarget(active, measured, direction)
  if (explicitTarget) {
    setActiveTarget(explicitTarget)
    return true
  }

  const candidates: Array<{ target: FocusTarget, score: number }> = []
  for (const target of measured) {
    if (target.id === active.id || !target.rect) continue
    const score = getCandidateScore(active.rect, target.rect, direction)
    if (score == null) continue
    candidates.push({ target, score })
  }
  if (!candidates.length) return false

  // 同排（左右移动）/ 同列（上下移动）优先，避免顶部导航条抢走同一排的卡片，详见 getSameBandCandidates
  const pool = getSameBandCandidates(active.rect, candidates, direction)

  let best: { target: FocusTarget, score: number } | null = null
  for (const candidate of pool) {
    if (!best || candidate.score < best.score) best = candidate
  }

  if (!best) return false
  setActiveTarget(best.target)
  return true
}

/** 按组件 ref 直接聚焦某个目标（测量后 setActiveTarget）。
 * 供页面里「程序性移动焦点」的场景使用（如详情页从操作按钮下键进列表首行）。
 * 旧做法靠 preferred 翻转+重调度间接实现，初始焦点改为仅挂载时调度后不再可用（09-22）。 */
export const focusTVTargetByRef = async(ref: FocusTargetRef | null) => {
  if (!ref) return false
  const measured = await measureTargets()
  const handle = findNodeHandle(ref)
  const target = measured.find(item => getNativeHandle(item) === handle) ?? null
  if (!target) return false
  setActiveTarget(target)
  return true
}

export const pressActiveTVTarget = () => {
  const active = activeTargetId ? targets.get(activeTargetId) : null
  if (activeScopeId && active?.scopeId !== activeScopeId) return
  active?.onPress?.()
}

/** 当前聚焦目标是否具备长按能力 */
export const activeTargetHasLongPress = () => {
  const active = activeTargetId ? targets.get(activeTargetId) : null
  if (activeScopeId && active?.scopeId !== activeScopeId) return false
  return !!active?.onLongPress
}

/** 触发当前聚焦目标的长按动作 */
export const longPressActiveTVTarget = () => {
  const active = activeTargetId ? targets.get(activeTargetId) : null
  if (activeScopeId && active?.scopeId !== activeScopeId) return
  active?.onLongPress?.()
}

/** 弹窗激活标记：弹窗打开时控制器让路，弹窗自己处理按键 */
let tvDialogActive = false
export const setTVDialogActive = (active: boolean) => { tvDialogActive = active }
export const isTVDialogActive = () => tvDialogActive
