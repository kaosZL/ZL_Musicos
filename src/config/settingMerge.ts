/**
 * 纯逻辑配置合并器（零 React Native 依赖，供 setting.ts 复用与单测覆盖）。
 *
 * 历史坑（v1.9.26 实测发现）：上游 mergeSetting 只允许 string/boolean/number/null，
 * 直接把 Array 值（如 common.tvRemovedSources: string[]）静默跳过——导致删除预置音源后
 * updateSetting 与启动 initSetting 都无效、音源删除后仍然存在。
 * 这里放行「原始类型数组」（字符串/数字/布尔数组），做内容等值比较并浅拷贝写入。
 */

const primitiveType = ['string', 'boolean', 'number']

export const isPrimitiveSettingValue = (val: unknown): boolean =>
  val === null || primitiveType.includes(typeof val)

export const isPrimitiveSettingArray = (val: unknown): val is Array<string | number | boolean | null> =>
  Array.isArray(val) && val.every(isPrimitiveSettingValue)

const isSamePrimitiveArray = (
  a: ReadonlyArray<string | number | boolean | null>,
  b: ReadonlyArray<string | number | boolean | null>,
): boolean => {
  if (a.length !== b.length) return false
  for (let i = 0; i < a.length; i++) {
    if (a[i] !== b[i]) return false
  }
  return true
}

export const mergeSettingValues = <T extends Record<string, any>>(
  originSetting: T,
  targetSetting?: Partial<T> | null,
): {
  setting: T
  updatedSettingKeys: Array<keyof T>
  updatedSetting: Partial<T>
} => {
  const originSettingCopy: T = { ...originSetting }
  const updatedSettingKeys: Array<keyof T> = []
  const updatedSetting: Partial<T> = {}

  if (targetSetting) {
    const originKeys = Object.keys(originSettingCopy)
    const targetKeys = Object.keys(targetSetting)
    const keysToCheck = (originKeys.length > targetKeys.length ? targetKeys : originKeys) as Array<keyof T>

    for (const key of keysToCheck) {
      const originValue = originSettingCopy[key]
      if (originValue === undefined) continue
      const targetValue: unknown = targetSetting[key]
      if (targetValue === undefined) continue

      if (isPrimitiveSettingArray(originValue)) {
        if (!isPrimitiveSettingArray(targetValue)) continue
        if (isSamePrimitiveArray(originValue, targetValue)) continue
        const copied = [...targetValue]
        updatedSettingKeys.push(key)
        updatedSetting[key] = copied as T[keyof T]
        originSettingCopy[key] = copied as T[keyof T]
        continue
      }

      if (!isPrimitiveSettingValue(targetValue) || targetValue == originValue) continue
      updatedSettingKeys.push(key)
      updatedSetting[key] = targetValue as T[keyof T]
      originSettingCopy[key] = targetValue as T[keyof T]
    }
  }

  return {
    setting: originSettingCopy,
    updatedSettingKeys,
    updatedSetting,
  }
}
