import { memo } from 'react'
import { ImageBackground, View, type ImageStyle, type TextStyle, type ViewStyle } from 'react-native'
import Image from '@/components/common/Image'
import TVText from './TVText'
import { tvColors, tvTokens } from '@/theme/tv'

interface Props {
  image?: string | null
  title: string
}

const TVPlaybackBackdrop = ({ image, title }: Props) => (
  <View style={styles.root}>
    {image ? (
      <ImageBackground source={{ uri: image }} blurRadius={42} style={styles.backdrop} resizeMode="cover">
        <View style={styles.scrim} />
      </ImageBackground>
    ) : null}
    <View style={styles.coverShadow}>
      {image ? <Image url={image} style={styles.cover as ImageStyle} resizeMode="cover" /> : <TVText variant="pageTitle" style={styles.placeholder}>{title.slice(0, 1) || '?'}</TVText>}
    </View>
  </View>
)

const styles: Record<string, ViewStyle | ImageStyle | TextStyle> = {
  root: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  backdrop: {
    position: 'absolute',
    left: -120,
    right: -120,
    top: -120,
    bottom: -120,
    opacity: 0.36,
  },
  scrim: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.48)',
  },
  coverShadow: {
    width: 410,
    height: 410,
    borderRadius: tvTokens.radiusXl,
    overflow: 'hidden',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: tvColors.surfaceWarm,
    shadowColor: '#000',
    shadowOpacity: 0.62,
    shadowRadius: 42,
    elevation: 24,
  },
  cover: {
    width: '100%',
    height: '100%',
  },
  placeholder: {
    fontSize: 130,
  },
}

export default memo(TVPlaybackBackdrop)
