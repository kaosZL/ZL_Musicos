import { memo, useEffect, useRef, useState, type ComponentRef } from 'react'
import { Modal, View, findNodeHandle, type ViewStyle } from 'react-native'
import TVButton from './TVButton'
import { onTVRemoteEvent, requestTVFocus } from '@/utils/nativeModules/utils'
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
  // 弹窗内焦点自主保障：Modal 内焦点引擎的几何测量不可靠，
  // 左右键直接按索引移动焦点（requestTVFocus），OK 走现有按钮激活链路
  const buttonRefs = useRef<Array<ComponentRef<typeof TVButton> | null>>([])
  const focusedIndexRef = useRef(0)
  const buttonsRef = useRef(buttons)
  buttonsRef.current = buttons
  const [, setReady] = useState(false)
  useEffect(() => { setReady(true) }, [])
  const getButtonHandle = (index: number) => {
    const node = buttonRefs.current[index]
    return node ? findNodeHandle(node) : null
  }
  const focusButton = (index: number) => {
    const total = buttonsRef.current.length
    const next = Math.max(0, Math.min(total - 1, index))
    focusedIndexRef.current = next
    const handle = getButtonHandle(next)
    if (handle) requestTVFocus(handle)
  }
  useEffect(() => {
    if (!visible) return
    focusedIndexRef.current = 0
    const timer = setTimeout(() => { focusButton(0) }, 80)
    const unsubscribe = onTVRemoteEvent(({ eventType, eventKeyAction }) => {
      if (eventKeyAction !== 0) return
      if (eventType === 'left') focusButton(focusedIndexRef.current - 1)
      else if (eventType === 'right') focusButton(focusedIndexRef.current + 1)
    })
    return () => { clearTimeout(timer); unsubscribe() }
  }, [visible])
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
              focusStyle={styles.buttonFocus}
              onTVFocusChange={focused => { if (focused) focusedIndexRef.current = index }}
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
  buttonFocus: {
    backgroundColor: 'rgba(255,255,255,0.24)',
    borderColor: '#FFFFFF',
    shadowColor: '#FFFFFF',
    shadowOpacity: 0.9,
    shadowRadius: tvSize(20),
    shadowOffset: { width: 0, height: tvSize(3) },
    elevation: 12,
    transform: [{ scale: 1.05 }],
  },
}

export default TVDialog
