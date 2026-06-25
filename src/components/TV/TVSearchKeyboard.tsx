import { memo, type ComponentProps } from 'react'
import { View, type TextStyle, type ViewStyle } from 'react-native'
import Focusable from './Focusable'
import TVText from './TVText'
import { tvColors, tvTokens } from '@/theme/tv'
import { tvText } from '@/screens/TV/labels'

interface Props {
  onKeyPress: (key: string) => void
  onBackspace: () => void
  onClear: () => void
  onSubmit: () => void
}

const rows = [
  ['\u5468', '\u9648', '\u6797', '\u738b', '\u5f20', '\u674e', '\u7231', '\u591c', '\u6d77'],
  ['\u4f60', '\u6211', '\u4ed6', '\u5979', '\u7684', '\u6b4c', '\u98ce', '\u96e8', '\u68a6'],
  ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H', 'I'],
  ['J', 'K', 'L', 'M', 'N', 'O', 'P', 'Q', 'R'],
]

const Key = ({ label, wide, onPress, ...props }: ComponentProps<typeof Focusable> & { label: string, wide?: boolean }) => (
  <Focusable style={[styles.key, wide ? styles.keyWide : null]} onPress={onPress} {...props}>
    <TVText variant="body" style={styles.keyText}>{label}</TVText>
  </Focusable>
)

const TVSearchKeyboard = ({ onKeyPress, onBackspace, onClear, onSubmit }: Props) => (
  <View style={styles.root}>
    {rows.map((row, rowIndex) => (
      <View key={rowIndex} style={styles.row}>
        {row.map(key => <Key key={key} label={key} onPress={() => { onKeyPress(key) }} />)}
      </View>
    ))}
    <View style={styles.row}>
      <Key label={tvText.space} wide onPress={() => { onKeyPress(' ') }} />
      <Key label={tvText.backspace} wide onPress={onBackspace} />
      <Key label={tvText.clear} wide onPress={onClear} />
      <Key label={tvText.search} wide onPress={onSubmit} />
    </View>
  </View>
)

const styles: Record<string, ViewStyle | TextStyle> = {
  root: { gap: 10 },
  row: { flexDirection: 'row', gap: 10 },
  key: { width: 56, height: 50, borderRadius: tvTokens.radius, backgroundColor: 'rgba(255,255,255,0.10)', borderWidth: 1, borderColor: tvColors.border, alignItems: 'center', justifyContent: 'center' },
  keyWide: { width: 124 },
  keyText: { fontWeight: '900' },
}

export default memo(TVSearchKeyboard)
