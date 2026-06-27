import { memo, type PropsWithChildren } from 'react'
import { ImageBackground, View, type ViewStyle } from 'react-native'
import { defaultHeaders } from '@/components/common/Image'
import { tvColors, tvTokens } from '@/theme/tv'

interface Props {
  image?: string | null
  immersive?: boolean
  style?: ViewStyle | ViewStyle[]
  contentStyle?: ViewStyle | ViewStyle[]
}

const TVAppleScaffold = ({ image, immersive, style, contentStyle, children }: PropsWithChildren<Props>) => (
  <View style={[styles.root, style]}>
    {image ? (
      <ImageBackground source={{ uri: image, headers: defaultHeaders }} blurRadius={immersive ? 58 : 48} resizeMode="cover" style={[styles.ambientImage, immersive ? styles.immersiveAmbientImage : null]}>
        <View style={[styles.ambientScrim, immersive ? styles.immersiveAmbientScrim : null]} />
      </ImageBackground>
    ) : null}
    <View style={[styles.baseWash, image ? styles.imageBaseWash : null, immersive && image ? styles.immersiveBaseWash : null]} />
    <View style={[styles.softWash, image ? styles.imageSoftWash : null]} />
    <View style={[styles.vignette, image ? styles.imageVignette : null, immersive && image ? styles.immersiveVignette : null]} />
    <View style={styles.topShade} />
    <View style={[styles.bottomShade, immersive ? styles.immersiveBottomShade : null]} />
    <View style={[styles.content, contentStyle]}>{children}</View>
  </View>
)

const styles: Record<string, ViewStyle> = {
  root: {
    flex: 1,
    backgroundColor: tvColors.bgDeep,
  },
  ambientImage: {
    position: 'absolute',
    left: -150,
    right: -150,
    top: -150,
    bottom: -150,
    opacity: 0.68,
  },
  immersiveAmbientImage: {
    opacity: 0.66,
  },
  ambientScrim: {
    flex: 1,
    backgroundColor: 'rgba(4,5,10,0.54)',
  },
  immersiveAmbientScrim: {
    backgroundColor: 'rgba(4,5,10,0.58)',
  },
  baseWash: {
    position: 'absolute',
    left: 0,
    right: 0,
    top: 0,
    bottom: 0,
    backgroundColor: 'rgba(6,7,12,0.92)',
  },
  imageBaseWash: {
    backgroundColor: 'rgba(5,6,10,0.46)',
  },
  immersiveBaseWash: {
    backgroundColor: 'rgba(5,6,10,0.34)',
  },
  softWash: {
    position: 'absolute',
    left: 0,
    right: 0,
    top: 0,
    bottom: 0,
    backgroundColor: 'rgba(255,255,255,0.018)',
  },
  imageSoftWash: {
    backgroundColor: 'rgba(255,255,255,0.032)',
  },
  vignette: {
    position: 'absolute',
    left: 0,
    right: 0,
    top: 0,
    bottom: 0,
    backgroundColor: 'rgba(1,2,5,0.44)',
  },
  imageVignette: {
    backgroundColor: 'rgba(1,2,5,0.25)',
  },
  immersiveVignette: {
    backgroundColor: 'rgba(1,2,5,0.24)',
  },
  topShade: {
    position: 'absolute',
    left: 0,
    right: 0,
    top: 0,
    height: 180,
    backgroundColor: 'rgba(1,2,5,0.36)',
  },
  bottomShade: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    height: 260,
    backgroundColor: 'rgba(1,2,5,0.44)',
  },
  immersiveBottomShade: {
    height: 310,
    backgroundColor: 'rgba(1,2,5,0.46)',
  },
  content: {
    flex: 1,
    paddingHorizontal: tvTokens.pagePadX,
    paddingVertical: tvTokens.pagePadY,
  },
}

export default memo(TVAppleScaffold)
