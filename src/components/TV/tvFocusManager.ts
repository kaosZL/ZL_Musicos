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
}

interface FocusRect {
  x: number
  y: number
  width: number
  height: number
}

export const TVFocusScopeContext = createContext('tv-root')
const targets = new Map<number, FocusTarget>()
let activeTargetId: number | null = null
let activeScopeId: string | null = null
let fallbackTimer: ReturnType<typeof setTimeout> | null = null
let nextTargetId = 1

const centerX = (rect: FocusRect) => rect.x + rect.width / 2
const centerY = (rect: FocusRect) => rect.y + rect.height / 2

const isVisibleRect = (rect: FocusRect | null): rect is FocusRect => {
  return !!rect && rect.width > 1 && rect.height > 1
}

const requestNativeFocus = (target: FocusTarget) => {
  const tag = target.ref ? findNodeHandle(target.ref) : null
  if (tag) requestTVFocus(tag)
  target.ref?.focus?.()
}

const setActiveTarget = (target: FocusTarget) => {
  activeTargetId = target.id
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

  switch (direction) {
    case 'up':
      if (dy >= -2) return null
      return Math.abs(dy) * 1000 + sameColumnPenalty
    case 'down':
      if (dy <= 2) return null
      return Math.abs(dy) * 1000 + sameColumnPenalty
    case 'left':
      if (dx >= -2) return null
      return Math.abs(dx) * 1000 + sameRowPenalty
    case 'right':
      if (dx <= 2) return null
      return Math.abs(dx) * 1000 + sameRowPenalty
  }
}

export const setActiveTVFocusScope = (scopeId: string) => {
  if (activeScopeId !== scopeId) {
    activeScopeId = scopeId
    activeTargetId = null
  }
  scheduleTVInitialFocus()
}

export const clearActiveTVFocusScope = (scopeId: string) => {
  if (activeScopeId === scopeId) {
    activeScopeId = null
    activeTargetId = null
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
  targets.delete(id)
  if (activeTargetId === id) activeTargetId = null
}

export const notifyTVTargetFocused = (id: number) => {
  activeTargetId = id
}

export const focusPreferredTVTarget = async() => {
  const measured = await measureTargets()
  const target = measured.find(item => item.preferred) ?? measured[0]
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

  let best: { target: FocusTarget, score: number } | null = null
  for (const target of measured) {
    if (target.id === active.id || !target.rect) continue
    const score = getCandidateScore(active.rect, target.rect, direction)
    if (score == null) continue
    if (!best || score < best.score) best = { target, score }
  }

  if (!best) return false
  setActiveTarget(best.target)
  return true
}

export const pressActiveTVTarget = () => {
  const active = activeTargetId ? targets.get(activeTargetId) : null
  if (activeScopeId && active?.scopeId !== activeScopeId) return
  active?.onPress?.()
}
