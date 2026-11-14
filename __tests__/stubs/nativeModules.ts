/**
 * @/utils/nativeModules/utils 桩（单测专用）：tvFocusManager 只用到 requestTVFocus，
 * 记录调用供断言。
 */
export const requestTVFocusCalls: number[] = []
export const requestTVFocus = (tag: number) => {
  requestTVFocusCalls.push(tag)
}
