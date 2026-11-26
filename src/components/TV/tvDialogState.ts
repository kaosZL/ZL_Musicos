/**
 * 弹窗宿主关闭态纯逻辑（从 TVDialog.tsx 抽出以便零依赖单测）。
 * 当一级弹窗的按钮 onPress 同步打开二级弹窗（如设置页「删除使用中音源」/「开启更新提醒」）时，
 * 随后紧跟的旧弹窗 onDismiss 绝不能把已更新的 current 清成 null。
 */
export const resolveDismissedDialogRequest = <T>(current: T | null, closing: T | null): T | null => {
  return current === closing ? null : current
}
