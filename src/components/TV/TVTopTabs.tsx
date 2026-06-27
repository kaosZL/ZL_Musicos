import { forwardRef, memo, useRef, type ComponentProps, type ComponentRef, type MutableRefObject } from 'react'
import { View, findNodeHandle, type TextStyle, type ViewStyle } from 'react-native'
import Focusable from './Focusable'
import TVText from './TVText'
import { tvColors, tvTokens } from '@/theme/tv'

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

const TabButton = forwardRef<any, ComponentProps<typeof Focusable> & { item: TVTabItem, active: boolean }>(({ item, active, ...props }, ref) => (
  <Focusable ref={ref} style={[styles.tab, active ? styles.tabActive : null]} focusStyle={styles.tabFocus} onPress={item.onPress} {...props}>
    <TVText variant="body" style={[styles.tabText, active ? styles.tabTextActive : null]}>{item.label}</TVText>
  </Focusable>
))

type TabNode = ComponentRef<typeof Focusable> | null

const TVTopTabs = ({ items, activeId, subtitle, hasTVPreferredFocus, nextFocusDown, activeTabRef, onActiveTabReady }: Props) => {
  const tabRefs = useRef<Record<string, TabNode>>({})
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
                if (node) onActiveTabReady?.()
              }
            }}
            item={item}
            active={item.id === activeId}
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
    minHeight: 74,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 28,
    marginBottom: 26,
  },
  brandWrap: {
    minWidth: 240,
  },
  subtitle: {
    marginTop: 4,
    color: tvColors.dimText,
  },
  tabs: {
    flex: 1,
    flexDirection: 'row',
    justifyContent: 'flex-end',
    alignItems: 'center',
    gap: 8,
  },
  tab: {
    minHeight: 48,
    paddingHorizontal: 20,
    borderRadius: tvTokens.radiusPill,
    alignItems: 'center',
    justifyContent: 'center',
  },
  tabActive: {
    backgroundColor: 'rgba(255,255,255,0.16)',
  },
  tabFocus: {
    backgroundColor: 'rgba(255,255,255,0.24)',
  },
  tabText: {
    color: tvColors.subtext,
    fontSize: tvTokens.nav,
    fontWeight: '700',
  },
  tabTextActive: {
    color: tvColors.text,
    fontWeight: '900',
  },
}

export default memo(TVTopTabs)
