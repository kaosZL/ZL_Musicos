import { memo, type PropsWithChildren } from 'react'
import { View, type ViewStyle } from 'react-native'
import Image from '@/components/common/Image'
import { tvColors, tvTokens } from '@/theme/tv'
import TVText from './TVText'

interface Props {
  kicker: string
  title: string
  subtitle?: string
  image?: string | null
  style?: ViewStyle | ViewStyle[]
}

const TVHeroBanner = ({ kicker, title, subtitle, image, style, children }: PropsWithChildren<Props>) => (
  <View style={[styles.root, style]}>
    <View style={styles.redGlow} />
    <View style={styles.info}>
      <TVText variant="caption" color={tvColors.primaryHigh}>{kicker}</TVText>
      <TVText variant="pageTitle" style={styles.title} numberOfLines={2}>{title}</TVText>
      {subtitle ? <TVText variant="meta" style={styles.subtitle} numberOfLines={2}>{subtitle}</TVText> : null}
      {children ? <View style={styles.actions}>{children}</View> : null}
    </View>
    <View style={styles.posterStack}>
      <View style={styles.posterShadow} />
      <View style={styles.poster}>
        {image ? <Image url={image} style={styles.image} /> : <TVText variant="pageTitle" color={tvColors.primaryHigh}>音乐</TVText>}
      </View>
    </View>
  </View>
)

const styles: Record<string, ViewStyle | any> = {
  root: {
    minHeight: 286,
    borderRadius: tvTokens.radiusLg,
    backgroundColor: tvColors.bgElevated,
    borderWidth: 1,
    borderColor: tvColors.border,
    padding: 26,
    flexDirection: 'row',
    overflow: 'hidden',
  },
  redGlow: {
    position: 'absolute',
    width: 520,
    height: 520,
    borderRadius: 260,
    backgroundColor: 'rgba(236,45,56,0.20)',
    right: -130,
    top: -180,
  },
  info: {
    flex: 1,
    justifyContent: 'center',
    paddingRight: 32,
  },
  title: {
    marginTop: 12,
    fontSize: tvTokens.heroTitle,
    lineHeight: 58,
  },
  subtitle: {
    marginTop: 14,
    lineHeight: 25,
  },
  actions: {
    flexDirection: 'row',
    gap: 14,
    marginTop: 28,
  },
  posterStack: {
    width: 238,
    alignItems: 'center',
    justifyContent: 'center',
  },
  posterShadow: {
    position: 'absolute',
    width: 220,
    height: 220,
    borderRadius: 30,
    backgroundColor: 'rgba(236,45,56,0.18)',
    transform: [{ rotate: '8deg' }],
  },
  poster: {
    width: 206,
    height: 206,
    borderRadius: 26,
    overflow: 'hidden',
    backgroundColor: tvColors.bgWarm,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: tvColors.line,
  },
  image: {
    width: '100%',
    height: '100%',
  },
}

export default memo(TVHeroBanner)
