import { memo, useEffect, useRef, useState } from 'react'
import { BackHandler, Pressable, Text, View, type TextStyle, type ViewStyle } from 'react-native'
import { onTVRemoteEvent, requestTVFocus } from '@/utils/nativeModules/utils'
import { setTVDialogActive } from './tvFocusManager'
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

export const setTVDialogListener = (listener: TVDialogListener | null) => {
  activeListener = listener
}

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

// 纯 Pressable 弹窗按钮：不用 Focusable/TVButton/引擎，React state → 条件样式 → 渲染，100% 可靠
const getToneStyle = (tone?: string): ViewStyle => {
  switch (tone) {
    case 'danger': return { backgroundColor: 'rgba(241,195,109,0.14)', borderColor: 'rgba(241,195,109,0.36)' }
    case 'primary': return { backgroundColor: 'rgba(255,255,255,0.12)', borderColor: 'rgba(255,255,255,0.2)' }
    default: return { backgroundColor: 'rgba(255,255,255,0.08)', borderColor: 'rgba(255,255,255,0.15)' }
  }
}

const TVDialog = ({ visible, title, message, buttons, onDismiss }: TVDialogProps) => {
  const [focusedIdx, setFocusedIdx] = useState(0)
  const focusedIdxRef = useRef(0)
  const buttonsRef = useRef(buttons)
  buttonsRef.current = buttons
  const onDismissRef = useRef(onDismiss)
  onDismissRef.current = onDismiss

  useEffect(() => {
    if (!visible) return
    setTVDialogActive(true)
    setFocusedIdx(0)
    focusedIdxRef.current = 0

    const unsub = onTVRemoteEvent(({ eventType, eventKeyAction }) => {
      if (eventKeyAction !== 0) return
      if (eventType === 'left' || eventType === 'right') {
        const delta = eventType === 'left' ? -1 : 1
        const total = buttonsRef.current.length
        const next = Math.max(0, Math.min(total - 1, focusedIdxRef.current + delta))
        focusedIdxRef.current = next
        setFocusedIdx(next)
      } else if (eventType === 'select') {
        const btn = buttonsRef.current[focusedIdxRef.current]
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
  }, [visible])

  if (!visible) return null
  return (
    <View style={styles.backdrop}>
      <View style={styles.card}>
        <TVText variant="cardTitle" style={styles.title}>{title}</TVText>
        {message ? <TVText variant="caption" color={tvColors.subtext} style={styles.message}>{message}</TVText> : null}
        <View style={styles.buttonRow}>
          {buttons.map((button, index) => (
            <Pressable
              key={`${button.label}_${index}`}
              onPress={() => {
                onDismissRef.current?.()
                button.onPress?.()
              }}
              style={[
                styles.btnBase,
                getToneStyle(button.tone),
                index === focusedIdx && styles.btnFocused,
              ]}
            >
              <Text style={styles.btnText} numberOfLines={1}>{button.label}</Text>
            </Pressable>
          ))}
        </View>
      </View>
    </View>
  )
}

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

const styles: Record<string, ViewStyle | TextStyle> = {
  backdrop: {
    position: 'absolute',
    top: 0, left: 0, right: 0, bottom: 0,
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
  title: { marginBottom: tvSize(8) },
  message: { marginBottom: tvSize(14), lineHeight: tvSize(24) },
  buttonRow: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    flexWrap: 'wrap',
    gap: tvSize(12),
    marginTop: tvSize(8),
  },
  btnBase: {
    minHeight: tvSize(54),
    paddingHorizontal: tvSize(26),
    paddingVertical: tvSize(14),
    borderRadius: tvSize(28),
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
  },
  btnFocused: {
    backgroundColor: 'rgba(255,255,255,0.28)',
    borderColor: '#FFFFFF',
    shadowColor: '#FFFFFF',
    shadowOpacity: 0.9,
    shadowRadius: tvSize(20),
    shadowOffset: { width: 0, height: tvSize(3) },
    elevation: 12,
    transform: [{ scale: 1.06 }],
  },
  btnText: {
    fontWeight: '900',
    fontSize: tvSize(18),
    color: '#FFFFFF',
  },
}

export default TVDialog
