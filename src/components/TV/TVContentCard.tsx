import { forwardRef, memo, type ComponentProps } from 'react'
import { View, type ViewStyle } from 'react-native'
import Image from '@/components/common/Image'
import { tvColors, tvTokens } from '@/theme/tv'
import Focusable from './Focusable'
import TVText from './TVText'

interface Props extends Omit<ComponentProps<typeof Focusable>, 'children'> {
  title: string
  subtitle?: string
  meta?: string
  image?: string | null
  width?: number
  height?: number
  accent?: boolean
  style?: ViewStyle | ViewStyle[]
}

const TVContentCard = forwardRef<any, Props>(({
  title,
  subtitle,
  meta,
  image,
  width = 218,
  height = 282,
  accent,
  style,
  ...props
}, ref) => {
  return (
    <Focusable
      ref={ref}
      style={[styles.root, { width, minHeight: height }, accent ? styles.accent : null, style]}
      focusStyle={styles.focus}
      {...props}
    >
      <View style={styles.cover}>
        {image ? (
          <Image url={image} style={styles.image} />
        ) : (
          <View style={styles.fakeCover}>
            <TVText variant="sectionTitle" style={styles.fakeCoverText}>{title.slice(0, 1)}</TVText>
          </View>
        )}
      </View>
      <View style={styles.body}>
        <TVText variant="cardTitle" numberOfLines={2}>{title}</TVText>
        {subtitle ? <TVText variant="caption" style={styles.subtitle} numberOfLines={1}>{subtitle}</TVText> : null}
        {meta ? <TVText variant="caption" style={styles.meta} numberOfLines={1}>{meta}</TVText> : null}
      </View>
    </Focusable>
  )
})

const styles: Record<string, ViewStyle | any> = {
  root: {
    borderRadius: tvTokens.radiusLg,
    backgroundColor: tvColors.glass,
    overflow: 'hidden',
    marginRight: 18,
    borderWidth: 1,
    borderColor: tvColors.border,
  },
  focus: {
    backgroundColor: tvColors.glassHigh,
    borderColor: tvColors.primaryHigh,
  },
  accent: {
    backgroundColor: tvColors.surfaceRed,
  },
  cover: {
    height: 174,
    backgroundColor: tvColors.bgWarm,
  },
  image: {
    width: '100%',
    height: '100%',
  },
  fakeCover: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: tvColors.surfaceRed,
  },
  fakeCoverText: {
    color: tvColors.primaryHigh,
    fontSize: 42,
  },
  body: {
    padding: 14,
  },
  subtitle: {
    marginTop: 8,
  },
  meta: {
    marginTop: 8,
    color: tvColors.primaryHigh,
  },
}

export default memo(TVContentCard)
