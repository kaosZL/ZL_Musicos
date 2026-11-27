import { type InitParams, onScriptAction, sendAction, type ResponseParams, type UpdateInfoParams, type RequestParams } from '@/utils/nativeModules/userApi'
import { destroyUserApi, log, setUserApiList, setUserApiStatus } from '@/core/userApi'
import settingState from '@/store/setting/state'
import BackgroundTimer from 'react-native-background-timer'
import { fetchData } from './request'
import { getUserApiList } from '@/utils/data'
import { confirmDialog, openUrl, tipDialog } from '@/utils/tools'
import { getCachedIsTV } from '@/utils/tvMode'
import { tryNextTVPresetUserApiCandidate } from '@/core/tvPresetUserApi'
import { setUserApiInitTimeoutHandler, USER_API_INIT_TIMEOUT_MS, userApiInitWatchdog } from '@/core/userApiWatchdog'
import { debugLog } from '@/utils/nativeModules/utils'


export default async(setting: LX.AppSetting) => {
  const userApiRequestMap = new Map<string, { resolve: (value: ResponseParams['result']) => void, reject: (error: Error) => void, timeout: number }>()
  const scriptRequestMap = new Map<string, { request: Promise<any>, abort: () => void }>()

  const cancelRequest = (requestKey: string, message: string) => {
    const target = scriptRequestMap.get(requestKey)
    if (!target) return
    scriptRequestMap.delete(requestKey)
    target.abort()
  }
  const sendScriptRequest = (requestKey: string, url: string, options: RequestParams['options']) => {
    let req = fetchData(url, options)
    req.request.then(response => {
      // console.log(response)
      sendAction('response', {
        error: null,
        requestKey,
        response,
      })
    }).catch(err => {
      sendAction('response', {
        error: err.message,
        requestKey,
        response: null,
      })
    }).finally(() => {
      scriptRequestMap.delete(requestKey)
    })
    scriptRequestMap.set(requestKey, req)
  }
  const sendUserApiRequest = async(data: LX.UserApi.UserApiRequestParams) => {
    const handleApiUpdate = () => {
      const target = userApiRequestMap.get(data.requestKey)
      if (!target) return
      userApiRequestMap.delete(data.requestKey)
      BackgroundTimer.clearTimeout(target.timeout)
      target.reject(new Error('request failed'))
    }
    const requestPromise = new Promise<ResponseParams['result']>((resolve, reject) => {
      userApiRequestMap.set(data.requestKey, {
        resolve,
        reject,
        timeout: BackgroundTimer.setTimeout(() => {
          const target = userApiRequestMap.get(data.requestKey)
          if (!target) return
          userApiRequestMap.delete(data.requestKey)
          target.reject(new Error('request timeout'))
        }, 20_000),
      })
      sendAction('request', data)
    }).finally(() => {
      global.state_event.off('apiSourceUpdated', handleApiUpdate)
    })
    global.state_event.on('apiSourceUpdated', handleApiUpdate)
    return requestPromise
  }
  const handleUserApiResponse = ({ status, result, requestKey, errorMessage }: ResponseParams) => {
    const target = userApiRequestMap.get(requestKey)
    if (!target) return
    userApiRequestMap.delete(requestKey)
    BackgroundTimer.clearTimeout(target.timeout)
    if (status) target.resolve(result)
    else target.reject(new Error(errorMessage ?? 'failed'))
  }
  const handleStateChange = ({ status, errorMessage, info }: InitParams) => {
    // console.log(status, message, info)
    if (!info || info.id !== settingState.setting['common.apiSource']) return
    userApiInitWatchdog.settle(info.id)
    setUserApiStatus(status, errorMessage)
    if (status) {
      debugLog(`[音源] 初始化成功: ${info.name} (${info.id})`)
      if (info.sources) {
        let apis: any = {}
        let qualitys: LX.QualityList = {}
        for (const [source, { actions, type, qualitys: sourceQualitys }] of Object.entries(info.sources)) {
          if (type != 'music') continue
          apis[source as LX.Source] = {}
          for (const action of actions) {
            switch (action) {
              case 'musicUrl':
                apis[source].getMusicUrl = (songInfo: LX.Music.MusicInfo, type: LX.Quality) => {
                  const requestKey = `request__${Math.random().toString().substring(2)}`
                  return {
                    canceleFn() {
                      // userApiRequestCancel(requestKey)
                    },
                    promise: sendUserApiRequest({
                      requestKey,
                      data: {
                        source,
                        action: 'musicUrl',
                        info: {
                          type,
                          musicInfo: songInfo,
                        },
                      },
                      // eslint-disable-next-line @typescript-eslint/promise-function-async
                    }).then(res => {
                      // console.log(res)
                      return { type, url: res.data.url }
                    }).catch(err => {
                      console.log(err.message)
                      throw err
                    }),
                  }
                }
                break
              case 'lyric':
                apis[source].getLyric = (songInfo: LX.Music.MusicInfo) => {
                  const requestKey = `request__${Math.random().toString().substring(2)}`
                  return {
                    canceleFn() {
                      // userApiRequestCancel(requestKey)
                    },
                    promise: sendUserApiRequest({
                      requestKey,
                      data: {
                        source,
                        action: 'lyric',
                        info: {
                          type,
                          musicInfo: songInfo,
                        },
                      },
                      // eslint-disable-next-line @typescript-eslint/promise-function-async
                    }).then(res => {
                      // console.log(res)
                      return res.data
                    }).catch(async err => {
                      console.log(err.message)
                      return Promise.reject(err)
                    }),
                  }
                }
                break
              case 'pic':
                apis[source].getPic = (songInfo: LX.Music.MusicInfo) => {
                  const requestKey = `request__${Math.random().toString().substring(2)}`
                  return {
                    canceleFn() {
                      // userApiRequestCancel(requestKey)
                    },
                    promise: sendUserApiRequest({
                      requestKey,
                      data: {
                        source,
                        action: 'pic',
                        info: {
                          type,
                          musicInfo: songInfo,
                        },
                      },
                      // eslint-disable-next-line @typescript-eslint/promise-function-async
                    }).then(res => {
                      // console.log(res)
                      return res.data
                    }).catch(async err => {
                      console.log(err.message)
                      return Promise.reject(err)
                    }),
                  }
                }
                break
              default:
                break
            }
          }
          qualitys[source as LX.Source] = sourceQualitys
        }
        global.lx.qualityList = qualitys
        global.lx.apis = apis
        global.state_event.apiSourceUpdated(settingState.setting['common.apiSource'])
      }
      if (!global.lx.apiInitPromise[1]) global.lx.apiInitPromise[2](true)
    } else {
      debugLog(`[音源] 初始化失败: ${info.name} (${info.id}) - ${errorMessage || '未知原因'}`)
      if (getCachedIsTV() && /^tv_preset_/.test(info.id)) {
        // 先尝试自动切换到下一个内置预置源；只有全部候选都耗尽后才落定 apiInitPromise(false) 并明确弹窗告知
        void tryNextTVPresetUserApiCandidate(info.id).then(switched => {
          if (switched) {
            debugLog(`[音源] 预置源 ${info.name} 失效，已自动尝试下一个预置源`)
            return
          }
          if (!global.lx.apiInitPromise[1]) global.lx.apiInitPromise[2](false)
          void tipDialog({
            title: '内置音源不可用',
            message: `${global.i18n.t('user_api__init_failed_alert', { name: info.name })}\n${errorMessage || '接口无响应'}\n\n可前往「设置 → 手机扫码导入」导入其他可用音源。`,
            btnText: global.i18n.t('ok'),
          })
        }).catch(() => {
          if (!global.lx.apiInitPromise[1]) global.lx.apiInitPromise[2](false)
          if (errorMessage) {
            void tipDialog({
              title: '内置音源不可用',
              message: `${global.i18n.t('user_api__init_failed_alert', { name: info.name })}\n${errorMessage}`,
              btnText: global.i18n.t('ok'),
            })
          }
        })
      } else {
        if (!global.lx.apiInitPromise[1]) global.lx.apiInitPromise[2](false)
        if (errorMessage) {
          void tipDialog({
            message: `${global.i18n.t('user_api__init_failed_alert', { name: info.name })}\n${errorMessage}`,
            // selection: true,
            btnText: global.i18n.t('ok'),
          })
        }
      }
    }
  }

  // 初始化看门狗超时回调（Issue #17）：脚本异步抛错或未回报 init 事件时，销毁卡死线程并走统一失败/兜底链路
  setUserApiInitTimeoutHandler((timedOut) => {
    if (timedOut.id !== settingState.setting['common.apiSource']) return
    const sec = Math.round(USER_API_INIT_TIMEOUT_MS / 1000)
    debugLog(`[音源] 初始化超时(${sec}s): ${timedOut.name} (${timedOut.id})`)
    destroyUserApi()
    handleStateChange({
      status: false,
      errorMessage: `初始化超时（${sec}秒内未收到音源响应，接口可能已失效或网络不通）`,
      info: {
        id: timedOut.id,
        name: timedOut.name,
        description: '',
        author: '',
        homepage: '',
        version: '',
        allowShowUpdateAlert: false,
      },
    })
  })
  const showUpdateAlert = ({ name, log, updateUrl }: UpdateInfoParams) => {
    if (updateUrl) {
      void confirmDialog({
        message: `${global.i18n.t('user_api_update_alert', { name })}\n${log}`,
        // selection: true,
        // showCancel: true,
        confirmButtonText: global.i18n.t('user_api_update_alert_open_url'),
        cancelButtonText: global.i18n.t('close'),
      }).then(confirm => {
        if (!confirm) return
        setTimeout(() => {
          void openUrl(updateUrl)
        }, 300)
      })
    } else {
      void tipDialog({
        message: `${global.i18n.t('user_api_update_alert', { name })}\n${log}`,
        // selection: true,
        btnText: global.i18n.t('ok'),
      })
    }
  }

  onScriptAction((event) => {
    // console.log('script actuon: ', event)
    switch (event.action) {
      case 'init':
        if ((event as unknown as { errorMessage?: string }).errorMessage) event.data.errorMessage = (event as unknown as { errorMessage: string }).errorMessage
        handleStateChange(event.data)
        break
      case 'response':
        handleUserApiResponse(event.data)
        break
      case 'request':
        sendScriptRequest(event.data.requestKey, event.data.url, event.data.options)
        break
      case 'cancelRequest':
        cancelRequest(event.data, 'request canceled')
        break
      case 'showUpdateAlert':
        showUpdateAlert(event.data)
        break
      case 'log':
        switch ((event as unknown as { type: keyof typeof log }).type) {
          case 'log':
          case 'info':
            log.info((event as unknown as { log: string }).log)
            break
          case 'error':
            log.error((event as unknown as { log: string }).log)
            break
          case 'warn':
            log.warn((event as unknown as { log: string }).log)
            break
          default:
            break
        }
        break
      default:
        break
    }
  })

  setUserApiList(await getUserApiList())
}
