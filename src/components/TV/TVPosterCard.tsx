import { forwardRef, memo, useCallback, useState, type ComponentProps } from 'react'
import { View, type ImageStyle, type TextStyle, type ViewStyle } from 'react-native'
import Image from '@/components/common/Image'
import Focusable from './Focusable'
import TVText from './TVText'
import { tvColors, tvFont, tvSize, tvTokens } from '@/theme/tv'

interface Props extends Omit<ComponentProps<typeof Focusable>, 'children'> {
  title: string
  subtitle?: string
  meta?: string
  image?: string | null
  size?: 'hero' | 'large' | 'medium' | 'wide'
  tint?: string
  /**
   * 没有封面图时的兜底视觉：
   * - letter（默认，推荐位沿用上游行为）：把歌单名首字放大当封面
   * - music：统一显示音符。用户自建歌单名往往很短（例如叫「q」），
   *   放大单个字母会出现一个莫名其妙的大字，改用统一音符更干净，也不会随名字变形
   */
  coverFallback?: 'letter' | 'music'
}

const sizes = {
  hero: { width: tvSize(390), height: tvSize(220) },
  large: { width: tvSize(250), height: tvSize(250) },
  medium: { width: tvSize(210), height: tvSize(210) },
  wide: { width: tvSize(330), height: tvSize(186) },
}

const TVPosterCard = forwardRef<any, Props>(({ title, subtitle, meta, image, size = 'medium', tint = tvColors.primary, coverFallback = 'letter', style, onTVFocusChange, ...props }, ref) => {
  const cardSize = sizes[size]
  const [focused, setFocused] = useState(false)
  const handleFocusChange = useCallback((nextFocused: boolean) => {
    setFocused(nextFocused)
    onTVFocusChange?.(nextFocused)
  }, [onTVFocusChange])

  return (
    <Focusable ref={ref} style={[styles.root, { width: cardSize.width }, typeof style === 'function' ? null : style]} focusStyle={styles.focus} onTVFocusChange={handleFocusChange} {...props}>
      <View style={[styles.art, cardSize, { backgroundColor: tint }]}>
        {image ? <Image url={image} style={styles.image as ImageStyle} resizeMode="cover" /> : null}
        <View style={styles.artOverlay} />
        {!image
          ? coverFallback === 'music'
            ? <TVText style={styles.musicGlyph}>♪</TVText>
            : <TVText variant="pageTitle" style={styles.placeholder}>{title.slice(0, 1)}</TVText>
          : null}
        {focused ? <View pointerEvents="none" style={styles.artFocusRing} /> : null}
      </View>
      <TVText variant="cardTitle" style={styles.title} numberOfLines={1}>{title}</TVText>
      {subtitle ? <TVText variant="caption" style={styles.subtitle} numberOfLines={1}>{subtitle}</TVText> : null}
      {meta ? <TVText variant="caption" style={styles.meta} numberOfLines={1}>{meta}</TVText> : null}
    </Focusable>
  )
})

const styles: Record<string, ViewStyle | TextStyle> = {
  root: {
    borderRadius: tvTokens.radiusLg,
    padding: tvSize(8),
  },
  focus: {
    backgroundColor: 'transparent',
    borderColor: 'transparent',
    shadowOpacity: 0,
    elevation: 0,
  },
  art: {
    borderRadius: tvTokens.radiusLg,
    overflow: 'hidden',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.14)',
  },
  image: {
    width: '100%',
    height: '100%',
  },
  artOverlay: {
    position: 'absolute',
    left: 0,
    right: 0,
    top: 0,
    bottom: 0,
    backgroundColor: 'rgba(0,0,0,0.12)',
  },
  artFocusRing: {
    position: 'absolute',
    left: 0,
    right: 0,
    top: 0,
    bottom: 0,
    borderRadius: tvTokens.radiusLg,
    borderWidth: tvSize(3),
    borderColor: tvColors.primaryHigh,
  },
  placeholder: {
    fontSize: tvFont(74),
    color: 'rgba(255,255,255,0.88)',
  },
  musicGlyph: {
    fontSize: tvFont(56),
    fontWeight: '900',
    color: 'rgba(255,255,255,0.6)',
  },
  title: {
    marginTop: tvSize(14),
    fontSize: tvFont(21),
  },
  subtitle: {
    marginTop: tvSize(5),
    color: tvColors.subtext,
  },
  meta: {
    marginTop: tvSize(3),
    color: tvColors.dimText,
  },
}

export default memo(TVPosterCard)
