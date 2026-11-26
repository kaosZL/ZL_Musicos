// import { setUserApi as setUserApiAction } from '@renderer/utils/ipc'
import musicSdk from '@/utils/musicSdk'
// import apiSourceInfo from '@renderer/utils/musicSdk/api-source-info'
import { updateSetting } from './common'
import settingState from '@/store/setting/state'
import { destroyUserApi, setUserApi, setUserApiStatus } from './userApi'
import apiSourceInfo from '@/utils/musicSdk/api-source-info'
import { TV_PRESET_USER_API_CANDIDATES } from '@/config/tvPresetUserApi'
import { state as userApiState } from '@/store/userApi/state'
import { pickFallbackApiSource } from '@/core/userApiWatchdog'


export const resolveFallbackApiSource = (excludeId: string, removedSourcesOverride?: readonly string[]): string => {
  const removedSources = removedSourcesOverride ?? settingState.setting['common.tvRemovedSources'] ?? []
  return pickFallbackApiSource({
    excludeId,
    userApiIds: userApiState.list.map(item => item.id),
    presetIds: TV_PRESET_USER_API_CANDIDATES.map(item => item.id),
    removedSources,
    builtinIds: apiSourceInfo.filter(item => !item.disabled).map(item => item.id),
  })
}


export const setApiSource = (apiId: string) => {
  if (global.lx.apiInitPromise[1]) {
    global.lx.apiInitPromise[0] = new Promise(resolve => {
      global.lx.apiInitPromise[1] = false
      global.lx.apiInitPromise[2] = (result: boolean) => {
        global.lx.apiInitPromise[1] = true
        resolve(result)
      }
    })
  }
  if (/^user_api/.test(apiId) || TV_PRESET_USER_API_CANDIDATES.some(item => item.id === apiId)) {
    setUserApi(apiId).catch(err => {
      if (!global.lx.apiInitPromise[1]) global.lx.apiInitPromise[2](false)
      console.log(err)
      let api = apiSourceInfo.find(api => !api.disabled)
      if (!api) return
      if (api.id != settingState.setting['common.apiSource']) setApiSource(api.id)
    })
  } else {
    // @ts-expect-error
    const support = musicSdk.supportQuality[apiId]
    global.lx.qualityList = support ?? {}
    destroyUserApi()
    if (!support) setUserApiStatus(false, '')
    if (!global.lx.apiInitPromise[1]) global.lx.apiInitPromise[2](Boolean(apiId && support))
    // apiSource.value = apiId
    // void setUserApiAction(apiId)
  }

  if (apiId != settingState.setting['common.apiSource']) {
    updateSetting({ 'common.apiSource': apiId })
    requestAnimationFrame(() => {
      global.state_event.apiSourceUpdated(apiId)
    })
  }
}
