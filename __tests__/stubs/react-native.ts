/**
 * react-native 桩（单测专用）：tvFocusManager 只用到 findNodeHandle。
 * 桩实现读取假 ref 上的 __tag，保证每个假目标有独立句柄。
 */
export const findNodeHandle = (ref: unknown): number | null => {
  const tag = (ref as { __tag?: number } | null)?.__tag
  return tag ?? null
}
