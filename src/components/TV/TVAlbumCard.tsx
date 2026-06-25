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
  style?: ViewStyle | ViewStyle[]
}

const TVAlbumCard = forwardRef<any, Props>(({
  title,
  subtitle,
  meta,
  image,
  width = 214,
  height = 282,
  style,
  ...props
}, ref) => (
  <Focusable
    ref={ref}
    style={[styles.root, { width, minHeight: height }, style]}
    focusStyle={styles.focus}
    {...props}
  >
    <View style={styles.cover}>
      {image ? (
        <Image url={image} style={styles.image} />
      ) : (
        <View style={styles.fakeCover}>
          <TVText variant="pageTitle" color={tvColors.primaryHigh}>{title.slice(0, 1)}</TVText>
        </View>
      )}
      <View style={styles.coverShade} />
    </View>
    <View style={styles.body}>
      <TVText variant="cardTitle" numberOfLines={2}>{title}</TVText>
      {subtitle ? <TVText variant="caption" style={styles.subtitle} numberOfLines={1}>{subtitle}</TVText> : null}
      {meta ? <TVText variant="caption" color={tvColors.primaryHigh} style={styles.meta} numberOfLines={1}>{meta}</TVText> : null}
    </View>
  </Focusable>
))

const styles: Record<string, ViewStyle | any> = {
  root: {
    marginRight: 20,
    borderRadius: tvTokens.radiusLg,
    backgroundColor: tvColors.glass,
    borderWidth: 1,
    borderColor: tvColors.border,
    overflow: 'hidden',
  },
  focus: {
    backgroundColor: tvColors.glassHigh,
    borderColor: tvColors.primaryHigh,
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
  coverShade: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    height: 68,
    backgroundColor: 'rgba(0,0,0,0.18)',
  },
  body: {
    padding: 16,
  },
  subtitle: {
    marginTop: 8,
  },
  meta: {
    marginTop: 10,
  },
}

export default memo(TVAlbumCard)
