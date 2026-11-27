import { storageDataPrefix, storageDataPrefixOld } from '@/config/constant'
import defaultSetting from '@/config/defaultSetting'
import { mergeSettingValues } from '@/config/settingMerge'
import { getData, removeData, saveData } from '@/plugins/storage'
import migrateSetting from './migrateSetting'
import settingState from '@/store/setting/state'
import { migrateMetaData, migrateListData } from './migrate'
import { exitApp, tipDialog } from '@/utils/tools'

// 业务相关工具方法

export const updateSetting = (setting?: Partial<LX.AppSetting> | null, isInit: boolean = false) => {
  let originSetting: LX.AppSetting
  if (isInit) {
    originSetting = { ...defaultSetting }
  } else originSetting = settingState.setting

  const result = mergeSettingValues(originSetting, setting)

  result.setting.version = defaultSetting.version

  return result
}

export const initSetting = async() => {
  let setting: Partial<LX.AppSetting> | null = await getData(storageDataPrefix.setting)


  // try migrate setting before v1
  if (!setting) {
    const config = await getData<{ setting?: any }>(storageDataPrefixOld.setting)
    if (config != null) {
      setting = migrateSetting(config)
      try {
        await migrateListData()
        await migrateMetaData()
      } catch (err: any) {
        void tipDialog({
          title: '数据迁移失败 (Failed to migrate data)',
          message: `请截图并在 GitHub 反馈。为了防止数据丢失，应用将停止运行。错误信息：\n${(err.stack ?? err.message) as string}`,
          btnText: 'Exit',
          bgClose: false,
        }).then(() => {
          exitApp()
        })
        throw err
      }
      await removeData(storageDataPrefixOld.setting)
    }
  }

  // console.log(setting)
  const updatedSetting = updateSetting(setting, true)
  void saveData(storageDataPrefix.setting, updatedSetting.setting)

  return updatedSetting
}
