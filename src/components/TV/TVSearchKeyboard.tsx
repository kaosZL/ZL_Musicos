import { forwardRef, memo, useMemo, useRef, type ComponentProps, type ComponentRef } from 'react'
import { View, findNodeHandle, type TextStyle, type ViewStyle } from 'react-native'
import Focusable from './Focusable'
import TVText from './TVText'
import { tvColors } from '@/theme/tv'
import { tvText } from '@/screens/TV/labels'

interface Props {
  onKeyPress: (key: string) => void
  onBackspace: () => void
  onClear: () => void
  onSubmit: () => void
  firstKeyRef?: React.MutableRefObject<ComponentRef<typeof Focusable> | null>
  onFirstKeyReady?: () => void
  nextFocusUp?: number
  nextFocusRight?: number
}

const rows = [
  ['Q', 'W', 'E', 'R', 'T', 'Y', 'U', 'I', 'O', 'P'],
  ['A', 'S', 'D', 'F', 'G', 'H', 'J', 'K', 'L'],
  ['Z', 'X', 'C', 'V', 'B', 'N', 'M'],
]

const Key = forwardRef<ComponentRef<typeof Focusable>, ComponentProps<typeof Focusable> & { label: string, wide?: boolean }>(({ label, wide, onPress, ...props }, ref) => (
  <Focusable ref={ref} style={[styles.key, wide ? styles.keyWide : null]} onPress={onPress} {...props}>
    <TVText variant="body" style={styles.keyText}>{label}</TVText>
  </Focusable>
))

const TVSearchKeyboard = ({ onKeyPress, onBackspace, onClear, onSubmit, firstKeyRef, onFirstKeyReady, nextFocusUp, nextFocusRight }: Props) => {
  const keyRows = useMemo(() => [...rows, [tvText.space, tvText.backspace, tvText.clear, tvText.search]], [])
  const keyRefs = useRef<Record<string, ComponentRef<typeof Focusable> | null>>({})
  const getKeyId = (rowIndex: number, colIndex: number) => `${rowIndex}_${colIndex}`
  const getKeyHandle = (rowIndex: number, colIndex: number, clampColumn = false) => {
    const row = keyRows[rowIndex]
    if (!row) return null
    if (colIndex < 0) return null
    const targetColumn = clampColumn ? Math.min(colIndex, row.length - 1) : colIndex
    if (targetColumn >= row.length) return null
    const node = keyRefs.current[getKeyId(rowIndex, targetColumn)]
    return node ? findNodeHandle(node) : null
  }
  const bindKeyRef = (rowIndex: number, colIndex: number) => (node: ComponentRef<typeof Focusable> | null) => {
    keyRefs.current[getKeyId(rowIndex, colIndex)] = node
    if (rowIndex === 0 && colIndex === 0 && firstKeyRef) {
      firstKeyRef.current = node
      if (node) onFirstKeyReady?.()
    }
  }
  const getKeyPress = (label: string) => {
    switch (label) {
      case tvText.space: return () => { onKeyPress(' ') }
      case tvText.backspace: return onBackspace
      case tvText.clear: return onClear
      case tvText.search: return onSubmit
      default: return () => { onKeyPress(label) }
    }
  }

  return (
    <View style={styles.root}>
      {keyRows.map((row, rowIndex) => (
        <View key={rowIndex} style={styles.row}>
          {row.map((key, colIndex) => (
            <Key
              key={key}
              ref={bindKeyRef(rowIndex, colIndex) as any}
              label={key}
              wide={rowIndex === keyRows.length - 1}
              onPress={getKeyPress(key)}
              nextFocusLeft={getKeyHandle(rowIndex, colIndex - 1) ?? getKeyHandle(rowIndex, colIndex) ?? undefined}
              nextFocusRight={getKeyHandle(rowIndex, colIndex + 1) ?? nextFocusRight ?? getKeyHandle(rowIndex, colIndex) ?? undefined}
              nextFocusUp={getKeyHandle(rowIndex - 1, colIndex, true) ?? nextFocusUp ?? getKeyHandle(rowIndex, colIndex) ?? undefined}
              nextFocusDown={getKeyHandle(rowIndex + 1, colIndex, true) ?? getKeyHandle(rowIndex, colIndex) ?? undefined}
            />
          ))}
        </View>
      ))}
    </View>
  )
}

const styles: Record<string, ViewStyle | TextStyle> = {
  root: { gap: 5 },
  row: { flexDirection: 'row', gap: 4 },
  key: { width: 32, height: 30, borderRadius: 15, backgroundColor: 'rgba(255,255,255,0.10)', borderWidth: 1, borderColor: tvColors.border, alignItems: 'center', justifyContent: 'center' },
  keyWide: { width: 82 },
  keyText: { fontWeight: '900', fontSize: 15 },
}

export default memo(TVSearchKeyboard)
