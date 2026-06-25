import { forwardRef, memo, type ComponentProps } from 'react'
import { View, type ImageStyle, type TextStyle, type ViewStyle } from 'react-native'
import Image from '@/components/common/Image'
import Focusable from './Focusable'
import TVText from './TVText'
import { tvColors, tvTokens } from '@/theme/tv'

interface Props extends Omit<ComponentProps<typeof Focusable>, 'children'> {
  title: string
  subtitle?: string
  meta?: string
  image?: string | null
  size?: 'hero' | 'large' | 'medium' | 'wide'
  tint?: string
}

const sizes = {
  hero: { width: 390, height: 220 },
  large: { width: 250, height: 250 },
  medium: { width: 210, height: 210 },
  wide: { width: 330, height: 186 },
}

const TVPosterCard = forwardRef<any, Props>(({ title, subtitle, meta, image, size = 'medium', tint = tvColors.primary, style, ...props }, ref) => {
  const cardSize = sizes[size]
  return (
    <Focusable ref={ref} style={[styles.root, { width: cardSize.width }, typeof style === 'function' ? null : style]} focusStyle={styles.focus} {...props}>
      <View style={[styles.art, cardSize, { backgroundColor: tint }]}>
        {image ? <Image url={image} style={styles.image as ImageStyle} resizeMode="cover" /> : null}
        <View style={styles.artOverlay} />
        {!image ? <TVText variant="pageTitle" style={styles.placeholder}>{title.slice(0, 1)}</TVText> : null}
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
    padding: 8,
  },
  focus: {
    backgroundColor: 'rgba(255,255,255,0.08)',
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
  placeholder: {
    fontSize: 74,
    color: 'rgba(255,255,255,0.88)',
  },
  title: {
    marginTop: 14,
    fontSize: 21,
  },
  subtitle: {
    marginTop: 5,
    color: tvColors.subtext,
  },
  meta: {
    marginTop: 3,
    color: tvColors.dimText,
  },
}

export default memo(TVPosterCard)
