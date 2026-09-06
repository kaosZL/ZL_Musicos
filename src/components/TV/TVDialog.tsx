import { memo, useEffect, useRef, useState, type ComponentRef } from 'react'
import { BackHandler, View, findNodeHandle, type ViewStyle } from 'react-native'
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
  // 不使用 Modal：独立原生窗口里焦点引擎的测量与移动都不可靠，
  // 且引擎 260ms 初始焦点调度会把焦点抢回背景里更早注册的首选按钮。
  // 改为同窗口的绝对定位覆盖层，焦点系统正常工作。
  // focusPreferredTVTarget 已改为取最后注册的 preferred 目标，
  // 弹窗按钮恢复 hasTVPreferredFocus 让引擎调度器直接聚焦弹窗第一个按钮
  const buttonRefs = useRef<Array<ComponentRef<typeof TVButton> | null>>([])
  const onDismissRef = useRef(onDismiss)
  onDismissRef.current = onDismiss
  const [, setReady] = useState(false)
  useEffect(() => { setReady(true) }, [])
  const getButtonHandle = (index: number) => {
    const node = buttonRefs.current[index]
    return node ? findNodeHandle(node) : null
  }
  useEffect(() => {
    if (!visible) return
    const sub = BackHandler.addEventListener('hardwareBackPress', () => { onDismissRef.current?.(); return true })
    return () => { sub.remove() }
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
              hasTVPreferredFocus={index === 0}
              focusStyle={styles.buttonFocus}
              nextFocusLeft={getButtonHandle(index > 0 ? index - 1 : index) ?? undefined}
              nextFocusRight={getButtonHandle(index < buttons.length - 1 ? index + 1 : index) ?? undefined}
              nextFocusUp={getButtonHandle(index) ?? undefined}
              nextFocusDown={getButtonHandle(index) ?? undefined}
              onPress={() => {
                onDismiss?.()
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
