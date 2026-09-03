import { Platform } from 'react-native'
import RNFS from 'react-native-fs'
import { loadScript } from '@/utils/nativeModules/userApi'
import { setUserApiStatus } from '@/core/userApi'
import { getCachedIsTV } from '@/utils/tvMode'
import { updateSetting } from '@/core/common'
import settingState from '@/store/setting/state'
import { TV_PRESET_USER_API_CANDIDATES } from '@/config/tvPresetUserApi'

export type TVPresetUserApiCandidate = typeof TV_PRESET_USER_API_CANDIDATES[number]
let activeCandidateIndex = -1

const createPendingApiInit = () => {
  if (!global.lx.apiInitPromise[1]) return
  global.lx.apiInitPromise[0] = new Promise(resolve => {
    global.lx.apiInitPromise[1] = false
    global.lx.apiInitPromise[2] = (result: boolean) => {
      global.lx.apiInitPromise[1] = true
      resolve(result)
    }
  })
}

export const loadTVPresetUserApiCandidate = async(candidate: TVPresetUserApiCandidate) => {
  const script = await RNFS.readFileAssets(candidate.assetPath, 'utf8')
  if (!script.trim()) throw new Error(`tv preset user api script is empty: ${candidate.id}`)

  createPendingApiInit()
  setUserApiStatus(false, 'initing')
  // 解析脚本头部元信息，与用户导入路径保持一致（不再写死 version='preset'）
  const header = /^\/\*[\S|\s]+?\*\//.exec(script)?.[0] ?? ''
  const parsedName = /@name\s*(.+)/.exec(header)?.[1]?.trim()
  const parsedVersion = /@version\s*(\S+)/.exec(header)?.[1]?.trim()
  const parsedAuthor = /@author\s*(.+)/.exec(header)?.[1]?.trim()
  loadScript({
    id: candidate.id,
    name: parsedName || candidate.name,
    version: parsedVersion || '1',
    author: parsedAuthor || candidate.author,
    allowShowUpdateAlert: false,
    script,
  })
  updateSetting({ 'common.apiSource': candidate.id })
  global.state_event.apiSourceUpdated(candidate.id)
  console.log(`TV preset user api loaded: ${candidate.name}`)
  return true
}

export const ensureTVPresetUserApi = async() => {
  if (!getCachedIsTV()) return false
  if (Platform.OS !== 'android') return false

  const removedSources = settingState.setting['common.tvRemovedSources'] ?? []
  for (const [index, candidate] of TV_PRESET_USER_API_CANDIDATES.entries()) {
    if (removedSources.includes(candidate.id)) continue
    try {
      activeCandidateIndex = index
      await loadTVPresetUserApiCandidate(candidate)
      return true
    } catch (error) {
      console.log(`TV preset user api failed: ${candidate.id}`, error)
    }
  }
  return false
}

export const tryNextTVPresetUserApiCandidate = async() => {
  if (!getCachedIsTV()) return false
  const removedSources = settingState.setting['common.tvRemovedSources'] ?? []
  let nextIndex = activeCandidateIndex + 1
  while (nextIndex < TV_PRESET_USER_API_CANDIDATES.length && removedSources.includes(TV_PRESET_USER_API_CANDIDATES[nextIndex].id)) nextIndex++
  if (nextIndex >= TV_PRESET_USER_API_CANDIDATES.length) return false
  activeCandidateIndex = nextIndex
  const candidate = TV_PRESET_USER_API_CANDIDATES[nextIndex]
  await loadTVPresetUserApiCandidate(candidate)
  return true
}
