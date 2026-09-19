import { memo, useRef, useState, type ComponentRef } from 'react'
import { View, findNodeHandle, type TextStyle, type ViewStyle } from 'react-native'
import TVAppleScaffold from '@/components/TV/TVAppleScaffold'
import TVText from '@/components/TV/TVText'
import TVButton from '@/components/TV/TVButton'
import TVGlassPanel from '@/components/TV/TVGlassPanel'
import TVSearchKeyboard from '@/components/TV/TVSearchKeyboard'
import type Focusable from '@/components/TV/Focusable'
import { tvColors, tvFont, tvSize } from '@/theme/tv'
import { pop } from '@/navigation'
import { useMyList } from '@/store/list/hook'
import { updateUserList } from '@/core/list'
import { usePlayerMusicInfo } from '@/store/player/hook'
import { tipDialog } from '@/utils/tools'
import { useTVFocusRef } from '@/components/TV/useTVFocusRef'
import { useTVFocusRefresh } from '@/components/TV/useTVFocusRefresh'
import { useTVNavigationBack } from '@/utils/hooks/useTVNavigationBack'
import { tvText } from './labels'

type FocusNode = ComponentRef<typeof Focusable> | null
// 与手机端改名的 maxlength 对齐
const NAME_MAX_LENGTH = 40

interface Props {
  componentId: string
  id: string
  name: string
}

function TVRename({ componentId, id, name }: Props) {
  const musicInfo = usePlayerMusicInfo()
  const allLists = useMyList()
  const [text, setText] = useState(name)
  const [saving, setSaving] = useState(false)
  const saveFocus = useTVFocusRef()
  const cancelFocus = useTVFocusRef()
  const firstKeyboardKeyFocus = useRef<FocusNode>(null)
  const keyboardRefresh = useTVFocusRefresh()

  useTVNavigationBack(componentId)

  const getKeyboardHandle = () => firstKeyboardKeyFocus.current ? findNodeHandle(firstKeyboardKeyFocus.current) : null
  const getSaveHandle = () => saveFocus.getNodeHandle()
  const getCancelHandle = () => cancelFocus.getNodeHandle()

  const handleKeyPress = (key: string) => {
    setText(value => (value.length >= NAME_MAX_LENGTH ? value : `${value}${key}`))
  }
  const handleBackspace = () => { setText(value => value.slice(0, -1)) }
  const handleClear = () => { setText('') }

  const handleSave = async() => {
    if (saving) return
    const trimmed = text.trim()
    if (!trimmed) {
      await tipDialog({ title: tvText.renameTitle, message: tvText.renameEmpty, btnText: tvText.knowIt })
      return
    }
    // 用本地列表里的原条目补全其余字段（locationUpdateTime 等），只覆盖 name。
    // 若改名瞬间该歌单已被删除（找不到原条目），不要拿残缺对象写库，直接提示并返回。
    const target = allLists.find(list => list.id === id)
    if (!target) {
      await tipDialog({ title: tvText.renameTitle, message: tvText.songlistMissing, btnText: tvText.knowIt })
      await pop(componentId)
      return
    }
    setSaving(true)
    try {
      const base = target as LX.List.UserListInfo
      await updateUserList([{ ...base, name: trimmed }])
      await tipDialog({ title: tvText.renameDone, message: trimmed, btnText: tvText.knowIt })
      await pop(componentId)
    } catch (err: unknown) {
      setSaving(false)
      await tipDialog({ title: tvText.renameFailed, message: err instanceof Error ? err.message : '', btnText: tvText.knowIt })
    }
  }

  return (
    <TVAppleScaffold image={musicInfo.pic}>
      <View style={styles.root}>
        <TVGlassPanel style={styles.panel}>
          <TVText variant="pageTitle">{tvText.renameTitle}</TVText>
          <TVText variant="body" style={styles.originalLine}>{`${tvText.renameOriginal}：${name}`}</TVText>
          <View style={styles.inputBox}>
            <TVText variant="pageTitle" color={text ? tvColors.text : tvColors.dimText} style={styles.inputText} numberOfLines={1}>{text || tvText.renameNew}</TVText>
            <View style={styles.caret} />
          </View>
          <TVText variant="caption" color={tvColors.dimText} style={styles.keyboardHint}>{tvText.renameKeyboardHint}</TVText>
          <View style={styles.actions}>
            <TVButton ref={saveFocus.ref as any} label={saving ? tvText.loading : tvText.renameSave} tone="primary" hasTVPreferredFocus onPress={() => { void handleSave() }} nextFocusDown={getKeyboardHandle() ?? undefined} nextFocusRight={getCancelHandle() ?? undefined} />
            <TVButton ref={cancelFocus.ref as any} label={tvText.cancelAction} tone="dark" onPress={() => { void pop(componentId) }} nextFocusLeft={getSaveHandle() ?? undefined} nextFocusDown={getKeyboardHandle() ?? undefined} />
          </View>
          <TVText variant="caption" color={tvColors.subtext} style={styles.inputHint}>{tvText.renameInputHint}</TVText>
          <TVSearchKeyboard
            firstKeyRef={firstKeyboardKeyFocus}
            onFirstKeyReady={keyboardRefresh}
            onKeyPress={handleKeyPress}
            onBackspace={handleBackspace}
            onClear={handleClear}
            onSubmit={() => { void handleSave() }}
            nextFocusUp={getSaveHandle() ?? undefined}
          />
        </TVGlassPanel>
      </View>
    </TVAppleScaffold>
  )
}

const styles: Record<string, ViewStyle | TextStyle | any> = {
  root: { flex: 1, alignItems: 'center' },
  panel: { width: tvSize(820), padding: tvSize(34) },
  originalLine: { marginTop: tvSize(12), color: tvColors.subtext },
  inputBox: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: tvSize(18),
    marginBottom: tvSize(12),
    minHeight: tvSize(64),
    paddingHorizontal: tvSize(18),
    borderRadius: tvSize(18),
    backgroundColor: 'rgba(255,255,255,0.08)',
    borderWidth: 1,
    borderColor: tvColors.border,
  },
  inputText: { flex: 1, fontSize: tvFont(34), lineHeight: tvFont(42) },
  caret: { width: tvSize(3), height: tvSize(38), marginLeft: tvSize(4), backgroundColor: tvColors.primaryHigh, borderRadius: tvSize(2) },
  keyboardHint: { marginBottom: tvSize(18) },
  actions: { flexDirection: 'row', gap: tvSize(14), marginBottom: tvSize(14) },
  inputHint: { marginBottom: tvSize(14) },
}

export default memo(TVRename)
