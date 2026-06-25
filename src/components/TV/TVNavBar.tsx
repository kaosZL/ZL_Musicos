import { memo, useRef, type ComponentRef } from 'react'
import { View, findNodeHandle, type ViewStyle } from 'react-native'
import Focusable from './Focusable'
import TVText from './TVText'
import { tvColors, tvTokens } from '@/theme/tv'

export interface TVNavItem {
  id: string
  label: string
  onPress: () => void
}

interface Props {
  items: TVNavItem[]
  activeId?: string
  title?: string
  subtitle?: string
  hasTVPreferredFocus?: boolean
}

const TVNavBar = ({ items, activeId, title = 'ZL-Music', subtitle, hasTVPreferredFocus }: Props) => {
  const refs = useRef<Array<ComponentRef<typeof Focusable> | null>>([])
  const getHandle = (index: number) => {
    const node = refs.current[index]
    return node ? findNodeHandle(node) : null
  }

  return (
    <View style={styles.root}>
      <View style={styles.brand}>
        <TVText variant="brand">{title}</TVText>
        {subtitle ? <TVText variant="caption" style={styles.subtitle}>{subtitle}</TVText> : null}
      </View>
      <View style={styles.nav}>
        {items.map((item, index) => {
          const isActive = item.id === activeId
          return (
            <Focusable
              key={item.id}
              ref={(node) => {
                refs.current[index] = node
              }}
              style={[styles.navItem, isActive ? styles.active : null]}
              focusStyle={styles.focus}
              onPress={item.onPress}
              hasTVPreferredFocus={hasTVPreferredFocus && index === 0}
              nextFocusLeft={getHandle(index - 1) ?? undefined}
              nextFocusRight={getHandle(index + 1) ?? undefined}
            >
              <TVText
                variant="body"
                style={[styles.navText, isActive ? styles.activeText : null]}
                numberOfLines={1}
              >
                {item.label}
              </TVText>
            </Focusable>
          )
        })}
      </View>
    </View>
  )
}

const styles: Record<string, ViewStyle | any> = {
  root: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 26,
  },
  brand: {
    minWidth: 280,
  },
  subtitle: {
    marginTop: 6,
  },
  nav: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  navItem: {
    minWidth: 92,
    height: 52,
    borderRadius: tvTokens.radiusPill,
    paddingHorizontal: 20,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'transparent',
  },
  active: {
    backgroundColor: tvColors.primary,
  },
  focus: {
    backgroundColor: tvColors.primaryHigh,
  },
  navText: {
    color: tvColors.subtext,
    fontSize: tvTokens.nav,
    fontWeight: '900',
  },
  activeText: {
    color: tvColors.text,
  },
}

export default memo(TVNavBar)
