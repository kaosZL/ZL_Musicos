/**
 * 弹窗宿主关闭态与默认焦点纯逻辑（从 TVDialog.tsx 抽出以便零依赖单测）。
 */

export interface TVDialogFocusCandidate {
  tone?: 'primary' | 'dark' | 'ghost' | 'danger'
  autoFocus?: boolean
}

/**
 * 当一级弹窗的按钮 onPress 同步打开二级弹窗（如设置页「删除使用中音源」/「开启更新提醒」）时，
 * 随后紧跟的旧弹窗 onDismiss 绝不能把已更新的 current 清成 null。
 */
export const resolveDismissedDialogRequest = <T>(current: T | null, closing: T | null): T | null => {
  return current === closing ? null : current
}

/**
 * 计算弹窗默认聚焦按钮索引：
 * 1. 显式 autoFocus=true 优先（用于二次确认框里的 danger 删除/清空主操作，保持警示色同时符合 OK=确认 肌肉记忆）
 * 2. 否则选第一个 tone='primary' 主按钮
 * 3. 否则回退第一个按钮（一级菜单保持聚焦「取消」防误操作）
 */
export const resolveInitialDialogButtonIndex = (buttons: readonly TVDialogFocusCandidate[]): number => {
  const autoIdx = buttons.findIndex(btn => btn.autoFocus)
  if (autoIdx >= 0) return autoIdx
  const primaryIdx = buttons.findIndex(btn => btn.tone === 'primary')
  return primaryIdx >= 0 ? primaryIdx : 0
}
