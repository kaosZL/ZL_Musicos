import { useMemo } from 'react'
import { PixelRatio, useWindowDimensions } from 'react-native'
import { getTVLayoutMetrics } from '@/theme/tv'

export const useTVScale = () => {
  const { width, height } = useWindowDimensions()
  const pixelRatio = PixelRatio.get()
  return useMemo(() => {
    const metrics = getTVLayoutMetrics(width, height, pixelRatio)
    return {
      ...metrics,
      s: (value: number) => Math.round(value * metrics.scale),
      f: (value: number) => Math.round(value * metrics.fontScale),
    }
  }, [height, pixelRatio, width])
}
