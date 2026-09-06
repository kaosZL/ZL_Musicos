import { memo, useEffect, useRef, useState, type ComponentRef } from 'react'
import { Modal, View, findNodeHandle, type ViewStyle } from 'react-native'
import TVButton from './TVButton'
import TVText from './TVText'
import { tvColors, tvSize } from '@/theme/tv'

export interface TVDialogButtonConfig {
  label: string
  tone?: 'primary' | 'dark' | 'ghost' | 'danger'
  onPress?: () => void
}

export interface TVDialogRequest {
  title: string
  message?: string
  buttons: TVDialogButtonConfig[]
  onDismiss?: () => void
}

type TVDialogListener = (request: TVDialogRequest | null) => void

let activeListener: TVDialogListener | null = null

/** 注册全局弹窗监听（由 TVDialogHost 挂载） */
export const setTVDialogListener = (listener: TVDialogListener | null) => {
  activeListener = listener
}

/** 全局弹出 TV 风格弹窗（同一时间只保留最后一个） */
export const showTVDialog = (request: TVDialogRequest) => {
  activeListener?.(request)
}

interface TVDialogProps {
  visible: boolean
  title: string
  message?: string
  buttons: TVDialogButtonConfig[]
  onDismiss?: () => void
}

const TVDialog = ({ visible, title, message, buttons, onDismiss }: TVDialogProps) => {
  // 弹窗按钮显式左右接线：Modal 内几何焦点搜索不可靠，用确定的 nextFocus 保证左右移动可控
  const buttonRefs = useRef<Array<ComponentRef<typeof TVButton> | null>>([])
  const [, setReady] = useState(false)
  useEffect(() => { setReady(true) }, [])
  const getButtonHandle = (index: number) => {
    const node = buttonRefs.current[index]
    return node ? findNodeHandle(node) : null
  }
  return (
  <Modal transparent visible={visible} animationType="fade" onRequestClose={() => { onDismiss?.() }}>
    <View style={styles.backdrop}>
      <View style={styles.card}>
        <TVText variant="cardTitle" style={styles.title}>{title}</TVText>
        {message ? <TVText variant="caption" color={tvColors.subtext} style={styles.message}>{message}</TVText> : null}
        <View style={styles.buttonRow}>
          {buttons.map((button, index) => (
            <TVButton
              key={`${button.label}_${index}`}
              ref={(node: ComponentRef<typeof TVButton> | null) => { buttonRefs.current[index] = node }}
              label={button.label}
              tone={button.tone ?? (index === 0 ? 'dark' : 'primary')}
              hasTVPreferredFocus={index === 0}
              nextFocusLeft={index > 0 ? getButtonHandle(index - 1) ?? undefined : undefined}
              nextFocusRight={index < buttons.length - 1 ? getButtonHandle(index + 1) ?? undefined : undefined}
              onPress={() => {
                onDismiss?.()
                button.onPress?.()
              }}
            />
          ))}
        </View>
      </View>
    </View>
  </Modal>
  )
}

/** 挂在 TVAppleScaffold 根部，承接全局弹窗 */
export const TVDialogHost = memo(() => {
  const [request, setRequest] = useState<TVDialogRequest | null>(null)

  useEffect(() => {
    setTVDialogListener(setRequest)
    return () => {
      if (activeListener === setRequest) activeListener = null
    }
  }, [])

  return (
    <TVDialog
      visible={!!request}
      title={request?.title ?? ''}
      message={request?.message}
      buttons={request?.buttons ?? []}
      onDismiss={() => {
        setRequest(null)
        request?.onDismiss?.()
      }}
    />
  )
})

const styles: Record<string, ViewStyle> = {
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(2,3,8,0.62)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  card: {
    width: tvSize(620),
    maxWidth: '86%',
    backgroundColor: 'rgba(18,20,30,0.96)',
    borderRadius: tvSize(28),
    borderWidth: 1,
    borderColor: tvColors.border,
    paddingTop: tvSize(30),
    paddingBottom: tvSize(24),
    paddingHorizontal: tvSize(30),
  },
  title: {
    marginBottom: tvSize(8),
  },
  message: {
    marginBottom: tvSize(14),
    lineHeight: tvSize(24),
  },
  buttonRow: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    flexWrap: 'wrap',
    gap: tvSize(12),
    marginTop: tvSize(8),
  },
}

export default TVDialog
