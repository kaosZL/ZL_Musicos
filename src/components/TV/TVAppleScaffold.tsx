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
    {immersive && image ? (
      <ImageBackground source={{ uri: image, headers: defaultHeaders }} blurRadius={56} resizeMode="cover" style={styles.ambientImage}>
        <View style={styles.ambientScrim} />
      </ImageBackground>
    ) : null}
    <View style={[styles.baseWash, immersive && image ? styles.immersiveBaseWash : null]} />
    <View style={[styles.vignette, immersive && image ? styles.immersiveVignette : null]} />
    {immersive ? <View style={styles.immersiveGlowSky} /> : null}
    {immersive ? <View style={styles.immersiveGlowPearl} /> : null}
    {!immersive ? <View style={styles.glowSky} /> : null}
    {!immersive ? <View style={styles.glowSlate} /> : null}
    {!immersive ? <View style={styles.glowPearl} /> : null}
    <View style={styles.bottomShade} />
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
    left: -120,
    right: -120,
    top: -120,
    bottom: -120,
    opacity: 0.64,
  },
  ambientScrim: {
    flex: 1,
    backgroundColor: 'rgba(4,7,14,0.44)',
  },
  baseWash: {
    position: 'absolute',
    left: 0,
    right: 0,
    top: 0,
    bottom: 0,
    backgroundColor: 'rgba(8,10,16,0.72)',
  },
  immersiveBaseWash: {
    backgroundColor: 'rgba(7,10,18,0.34)',
  },
  vignette: {
    position: 'absolute',
    left: 0,
    right: 0,
    top: 0,
    bottom: 0,
    backgroundColor: 'rgba(3,5,10,0.42)',
  },
  immersiveVignette: {
    backgroundColor: 'rgba(2,4,9,0.24)',
  },
  immersiveGlowSky: {
    position: 'absolute',
    width: 900,
    height: 520,
    borderRadius: 450,
    backgroundColor: 'rgba(126,154,216,0.13)',
    left: -320,
    top: -220,
  },
  immersiveGlowPearl: {
    position: 'absolute',
    width: 680,
    height: 440,
    borderRadius: 340,
    backgroundColor: 'rgba(218,226,238,0.07)',
    right: -230,
    top: 120,
  },
  glowSky: {
    position: 'absolute',
    width: 780,
    height: 390,
    borderRadius: 390,
    backgroundColor: 'rgba(139,164,210,0.115)',
    left: -310,
    top: -170,
  },
  glowSlate: {
    position: 'absolute',
    width: 920,
    height: 520,
    borderRadius: 460,
    backgroundColor: 'rgba(92,103,124,0.105)',
    right: -420,
    bottom: -300,
  },
  glowPearl: {
    position: 'absolute',
    width: 560,
    height: 360,
    borderRadius: 280,
    backgroundColor: 'rgba(214,222,235,0.045)',
    right: 290,
    top: 84,
  },
  bottomShade: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    height: 260,
    backgroundColor: 'rgba(2,3,8,0.35)',
  },
  content: {
    flex: 1,
    paddingHorizontal: tvTokens.pagePadX,
    paddingVertical: tvTokens.pagePadY,
  },
}

export default memo(TVAppleScaffold)
