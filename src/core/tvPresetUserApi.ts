import { Platform } from 'react-native'
import RNFS from 'react-native-fs'
import { loadScript } from '@/utils/nativeModules/userApi'
import { setUserApiStatus } from '@/core/userApi'
import { getCachedIsTV } from '@/utils/tvMode'
import { updateSetting } from '@/core/common'
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
  loadScript({
    id: candidate.id,
    name: candidate.name,
    description: 'Built-in TV preset source',
    version: 'preset',
    author: candidate.author,
    homepage: candidate.homepage,
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

  for (const [index, candidate] of TV_PRESET_USER_API_CANDIDATES.entries()) {
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
  const nextIndex = activeCandidateIndex + 1
  if (nextIndex >= TV_PRESET_USER_API_CANDIDATES.length) return false
  activeCandidateIndex = nextIndex
  const candidate = TV_PRESET_USER_API_CANDIDATES[nextIndex]
  await loadTVPresetUserApiCandidate(candidate)
  return true
}
