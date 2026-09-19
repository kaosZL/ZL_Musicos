import { forwardRef, memo, useRef, type ComponentProps, type ComponentRef, type MutableRefObject } from 'react'
import { View, findNodeHandle, type TextStyle, type ViewStyle } from 'react-native'
import Focusable from './Focusable'
import TVText from './TVText'
import { blurActiveTVTarget } from './tvFocusManager'
import { tvColors, tvSize, tvTokens } from '@/theme/tv'

export interface TVTabItem {
  id: string
  label: string
  onPress: () => void
}

interface Props {
  items: TVTabItem[]
  activeId: string
  subtitle?: string
  hasTVPreferredFocus?: boolean
  nextFocusDown?: number
  activeTabRef?: MutableRefObject<ComponentRef<typeof Focusable> | null>
  onActiveTabReady?: () => void
}

const TabButton = forwardRef<any, ComponentProps<typeof Focusable> & { item: TVTabItem }>(({ item, ...props }, ref) => (
  <Focusable ref={ref} style={styles.tab} focusStyle={styles.tabFocus} onPress={() => {
    blurActiveTVTarget()
    item.onPress()
  }} {...props}>
    <TVText variant="body" style={styles.tabText}>{item.label}</TVText>
  </Focusable>
))

type TabNode = ComponentRef<typeof Focusable> | null

const TVTopTabs = ({ items, activeId, subtitle, hasTVPreferredFocus, nextFocusDown, activeTabRef, onActiveTabReady }: Props) => {
  const tabRefs = useRef<Record<string, TabNode>>({})
  // 已通知过 onActiveTabReady 的节点，用于去重。
  // 下面的 ref 是内联函数，React 每次提交都会先以 null、再以节点调用它；
  // 若无条件通知，onActiveTabReady（各屏传的都是 queueFocusRefresh）就会
  // setState → 再渲染 → 再通知，形成每帧一次的重渲染死循环，
  // 整个 TV 界面发滞、遥控器换焦点明显变慢。
  const readyNodeRef = useRef<TabNode>(null)
  const activeIndex = Math.max(0, items.findIndex(item => item.id === activeId))
  const getHandle = (index: number) => {
    const item = items[index]
    if (!item) return null
    const node = tabRefs.current[item.id]
    return node ? findNodeHandle(node) : null
  }

  return (
    <View style={styles.root}>
      <View style={styles.brandWrap}>
        <TVText variant="brand">ZL-Music</TVText>
        {subtitle ? <TVText variant="caption" style={styles.subtitle}>{subtitle}</TVText> : null}
      </View>
      <View style={styles.tabs}>
        {items.map((item, index) => (
          <TabButton
            key={item.id}
            ref={(node: TabNode) => {
              tabRefs.current[item.id] = node
              if (item.id === activeId && activeTabRef) {
                activeTabRef.current = node
                // 只在节点真正变化时通知一次，避免上面说明的重渲染死循环
                if (node && readyNodeRef.current !== node) {
                  readyNodeRef.current = node
                  onActiveTabReady?.()
                }
              }
            }}
            item={item}
            hasTVPreferredFocus={hasTVPreferredFocus && index === activeIndex}
            nextFocusLeft={getHandle(index - 1) ?? undefined}
            nextFocusRight={getHandle(index + 1) ?? undefined}
            nextFocusDown={nextFocusDown}
          />
        ))}
      </View>
    </View>
  )
}

const styles: Record<string, ViewStyle | TextStyle> = {
  root: {
    minHeight: tvSize(74),
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: tvSize(28),
    marginBottom: tvSize(26),
  },
  brandWrap: {
    minWidth: tvSize(240),
  },
  subtitle: {
    marginTop: tvSize(4),
    color: tvColors.dimText,
  },
  tabs: {
    flex: 1,
    flexDirection: 'row',
    justifyContent: 'flex-end',
    alignItems: 'center',
    gap: tvSize(8),
  },
  tab: {
    minHeight: tvSize(48),
    paddingHorizontal: tvSize(16),
    borderRadius: tvTokens.radiusPill,
    alignItems: 'center',
    justifyContent: 'center',
  },
  tabFocus: {
    backgroundColor: 'rgba(255,255,255,0.08)',
  },
  tabText: {
    color: tvColors.subtext,
    fontSize: tvTokens.nav,
    fontWeight: '700',
  },
}

export default memo(TVTopTabs)
