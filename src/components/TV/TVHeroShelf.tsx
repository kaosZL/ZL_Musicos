import { memo, type PropsWithChildren } from 'react'
import { View, type ImageStyle, type TextStyle, type ViewStyle } from 'react-native'
import Image from '@/components/common/Image'
import TVText from './TVText'
import { tvColors, tvFont, tvSize, tvTokens } from '@/theme/tv'

interface Props {
  kicker?: string
  title: string
  subtitle?: string
  image?: string | null
  style?: ViewStyle | ViewStyle[]
}

const TVHeroShelf = ({ kicker, title, subtitle, image, style, children }: PropsWithChildren<Props>) => (
  <View style={[styles.root, style]}>
    <View style={styles.copy}>
      {kicker ? <TVText variant="caption" style={styles.kicker}>{kicker}</TVText> : null}
      <TVText variant="pageTitle" style={styles.title} numberOfLines={2}>{title}</TVText>
      {subtitle ? <TVText variant="body" style={styles.subtitle} numberOfLines={2}>{subtitle}</TVText> : null}
      <View style={styles.actions}>{children}</View>
    </View>
    <View style={styles.coverWrap}>
      {image ? <Image url={image} resizeMode="cover" style={styles.cover as ImageStyle} /> : <TVText variant="pageTitle" style={styles.placeholder}>?</TVText>}
    </View>
  </View>
)

const styles: Record<string, ViewStyle | TextStyle | ImageStyle> = {
  root: {
    minHeight: tvSize(300),
    borderRadius: tvTokens.radiusXl,
    padding: tvSize(32),
    flexDirection: 'row',
    overflow: 'hidden',
    backgroundColor: 'rgba(255,255,255,0.075)',
    borderWidth: 1,
    borderColor: tvColors.border,
  },
  copy: {
    flex: 1,
    justifyContent: 'center',
    paddingRight: tvSize(30),
  },
  kicker: {
    color: tvColors.primaryHigh,
    fontWeight: '900',
    letterSpacing: 1.2,
  },
  title: {
    marginTop: tvSize(10),
    fontSize: tvTokens.heroTitle,
    lineHeight: tvFont(66),
  },
  subtitle: {
    marginTop: tvSize(12),
    color: tvColors.subtext,
    lineHeight: tvFont(29),
  },
  actions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: tvSize(14),
    marginTop: tvSize(28),
  },
  coverWrap: {
    width: tvSize(276),
    height: tvSize(276),
    borderRadius: tvSize(36),
    overflow: 'hidden',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(145,164,196,0.18)',
  },
  cover: {
    width: '100%',
    height: '100%',
  },
  placeholder: {
    fontSize: tvFont(110),
  },
}

export default memo(TVHeroShelf)
