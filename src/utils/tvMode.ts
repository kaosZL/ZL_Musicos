import { Platform } from 'react-native'
import { isTVDevice } from '@/utils/nativeModules/utils'

let resolved = false
let cachedIsTV = false

export function getCachedIsTV(): boolean {
  return cachedIsTV
}

export function isTVResolved(): boolean {
  return resolved
}

export async function resolveIsTV(): Promise<boolean> {
  if (resolved) return cachedIsTV
  try {
    cachedIsTV = await isTVDevice()
  } catch {
    cachedIsTV = Platform.isTV ?? false
  }
  resolved = true
  return cachedIsTV
}
