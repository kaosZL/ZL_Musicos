import { memo, useEffect, useRef, useState, type ComponentRef } from 'react'
import { BackHandler, View, findNodeHandle, type ViewStyle } from 'react-native'
import TVButton from './TVButton'
import TVText from './TVText'
import { onTVRemoteEvent, requestTVFocus } from '@/utils/nativeModules/utils'
import { setTVDialogActive } from './tvFocusManager'
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
  // 弹窗完全自主处理按键（控制器通过 isTVDialogActive() 让路）：
  // 视觉焦点用 React state 直接驱动（forceFocused → Focusable 强制高亮），
  // 不依赖 requestTVFocus 的原生回调——React 渲染 100% 可靠。
  // 左右键切按钮、OK 执行动作、返回关闭。
  const buttonRefs = useRef<Array<ComponentRef<typeof TVButton> | null>>([])
  const [focusedIdx, setFocusedIdx] = useState(0)
  const buttonsRef = useRef(buttons)
  buttonsRef.current = buttons
  const onDismissRef = useRef(onDismiss)
  onDismissRef.current = onDismiss

  const moveFocus = (delta: number) => {
    const total = buttonsRef.current.length
    const next = Math.max(0, Math.min(total - 1, focusedIdx + delta))
    setFocusedIdx(next)
    // 也尝试原生焦点（保持引擎同步，但不依赖它做视觉）
    const node = buttonRefs.current[next]
    const handle = node ? findNodeHandle(node) : null
    if (handle) requestTVFocus(handle)
  }

  useEffect(() => {
    if (!visible) return
    setTVDialogActive(true)
    setFocusedIdx(0)

    const unsub = onTVRemoteEvent(({ eventType, eventKeyAction }) => {
      if (eventKeyAction !== 0) return
      if (eventType === 'left') {
        moveFocus(-1)
      } else if (eventType === 'right') {
        moveFocus(1)
      } else if (eventType === 'select') {
        const btn = buttonsRef.current[focusedIdx]
        if (btn) {
          onDismissRef.current?.()
          btn.onPress?.()
        }
      }
    })

    const backSub = BackHandler.addEventListener('hardwareBackPress', () => {
      onDismissRef.current?.()
      return true
    })

    return () => {
      setTVDialogActive(false)
      unsub()
      backSub.remove()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [visible])

  if (!visible) return null
  return (
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
              forceFocused={index === focusedIdx}
              focusStyle={styles.buttonFocus}
              onPress={() => {
                onDismissRef.current?.()
                button.onPress?.()
              }}
            />
          ))}
        </View>
      </View>
    </View>
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
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(2,3,8,0.72)',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 999,
    elevation: 24,
  },
  card: {
    width: tvSize(620),
    maxWidth: '86%',
    backgroundColor: 'rgba(18,20,30,0.98)',
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
