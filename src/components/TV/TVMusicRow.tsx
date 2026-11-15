import { forwardRef, memo, useCallback, useEffect, useRef, useState, type ComponentProps } from 'react'
import { View, type ImageStyle, type ViewStyle } from 'react-native'
import Image from '@/components/common/Image'
import { getPicUrl } from '@/core/music/online'
import { tvColors, tvSize } from '@/theme/tv'
import Focusable from './Focusable'
import TVText from './TVText'

interface Props extends Omit<ComponentProps<typeof Focusable>, 'children'> {
  index?: number
  title: string
  subtitle?: string
  meta?: string
  badge?: string
  image?: string | null
  active?: boolean
  lazyMusicInfo?: LX.Music.MusicInfoOnline | null
  style?: ViewStyle | ViewStyle[]
}

const TVMusicRow = forwardRef<any, Props>(({
  index,
  title,
  subtitle,
  meta,
  badge,
  image,
  active,
  lazyMusicInfo,
  style,
  ...props
}, ref) => {
  const showArt = image !== undefined || lazyMusicInfo !== undefined
  const [resolvedImage, setResolvedImage] = useState<string | null>(image ?? null)
  const loadedRef = useRef(false)

  useEffect(() => { setResolvedImage(image ?? null) }, [image])

  const handleRowFocus = useCallback((event: Parameters<NonNullable<ComponentProps<typeof Focusable>['onFocus']>>[0]) => {
    if (!loadedRef.current && lazyMusicInfo && !resolvedImage) {
      loadedRef.current = true
      void getPicUrl({ musicInfo: lazyMusicInfo, isRefresh: false, allowToggleSource: false }).then((url) => {
        if (url) setResolvedImage(url)
      }).catch(() => {})
    }
    const onFocus = props.onFocus as ((e: typeof event) => void) | undefined
    onFocus?.(event)
  }, [lazyMusicInfo, resolvedImage, props])

  return (
    <Focusable
      ref={ref}
      style={[styles.root, active ? styles.active : null, style]}
      focusStyle={styles.focus}
      {...props}
      onFocus={handleRowFocus}
    >
      <View style={styles.indexBox}>
        <TVText variant="body" color={active ? tvColors.primaryHigh : tvColors.dimText}>
          {typeof index === 'number' ? String(index + 1).padStart(2, '0') : '\u266b'}
        </TVText>
      </View>
      {showArt ? (
        <View style={styles.art}>
          {resolvedImage ? <Image url={resolvedImage} resizeMode="cover" style={styles.artImage as ImageStyle} /> : <TVText variant="body" style={styles.artPlaceholder}>{title.slice(0, 1)}</TVText>}
        </View>
      ) : null}
      <View style={styles.info}>
        <TVText variant="cardTitle" numberOfLines={1}>{title}</TVText>
        {subtitle ? <TVText variant="caption" style={styles.subtitle} numberOfLines={1}>{subtitle}</TVText> : null}
      </View>
      <View style={styles.meta}>
        {badge ? <TVText variant="caption" color={tvColors.primaryHigh} numberOfLines={1}>{badge}</TVText> : null}
        {meta ? <TVText variant="caption" style={styles.metaText} numberOfLines={1}>{meta}</TVText> : null}
      </View>
    </Focusable>
  )
})

const styles: Record<string, ViewStyle | any> = {
  root: {
    // 行高确定化（v1.9.25 实测反馈「焦点框跨行错位」）：minHeight 会被内容撑高，
    // 实际行高与队列页 ITEM_SIZE 不一致 → scrollToOffset 落点偏移、焦点框跨行。
    // 固定高度（内容垂直居中），与 ITEM_SIZE = tvSize(78) 严格一致
    height: tvSize(78),
    borderRadius: tvSize(18),
    paddingHorizontal: tvSize(18),
    paddingVertical: tvSize(11),
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'stretch',
    width: '100%',
    backgroundColor: 'rgba(20,24,36,0.55)',
    borderWidth: 2,
    borderColor: 'transparent',
  },
  // 焦点态单层化：去 elevation/阴影（电视上渲染成硬边灰块），描边+微放大即可
  focus: {
    backgroundColor: tvColors.glassHigh,
    borderColor: tvColors.primaryHigh,
    transform: [{ scale: 1.01 }],
  },
  active: {
    backgroundColor: tvColors.surfaceRed,
  },
  indexBox: {
    width: tvSize(50),
  },
  art: {
    width: tvSize(58),
    height: tvSize(58),
    borderRadius: tvSize(14),
    overflow: 'hidden',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: tvSize(16),
    backgroundColor: tvColors.surfaceWarm,
    borderWidth: 1,
    borderColor: tvColors.line,
  },
  artImage: {
    width: '100%',
    height: '100%',
  },
  artPlaceholder: {
    color: tvColors.primaryHigh,
    fontWeight: '900',
  },
  info: {
    flex: 1,
    minWidth: 0,
    paddingRight: tvSize(12),
  },
  subtitle: {
    marginTop: tvSize(6),
  },
  meta: {
    minWidth: tvSize(86),
    alignItems: 'flex-end',
  },
  metaText: {
    marginTop: tvSize(4),
  },
}

export default memo(TVMusicRow)
