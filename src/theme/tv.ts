import { Dimensions, PixelRatio } from 'react-native'

const TV_BASE_WIDTH = 1280
const TV_BASE_HEIGHT = 720
const TV_UHD_EDGE = 3000

export const getTVLayoutMetrics = (width: number, height: number, pixelRatio = PixelRatio.get()) => {
  const longEdge = Math.max(width, height)
  const shortEdge = Math.min(width, height)
  const physicalLongEdge = longEdge * pixelRatio
  const physicalShortEdge = shortEdge * pixelRatio
  const logicalScale = Math.min(width / TV_BASE_WIDTH, height / TV_BASE_HEIGHT)
  const isUhd = longEdge >= TV_UHD_EDGE || physicalLongEdge >= TV_UHD_EDGE || physicalShortEdge >= 1700
  const minScale = shortEdge < 650 ? 0.9 : 1
  const maxScale = isUhd ? 1.4 : 1.2
  const scale = Math.max(minScale, Math.min(logicalScale, maxScale))
  const fontScale = Math.max(minScale, Math.min(scale, isUhd ? 1.32 : 1.16))

  return {
    width,
    height,
    pixelRatio,
    isUhd,
    scale,
    fontScale,
  }
}

const initialWindow = Dimensions.get('window')
export const tvMetrics = getTVLayoutMetrics(initialWindow.width, initialWindow.height)
export const tvSize = (value: number) => Math.round(value * tvMetrics.scale)
export const tvFont = (value: number) => Math.round(value * tvMetrics.fontScale)

export const tvColors = {
  bg: '#0a0d15',
  bgDeep: '#060810',
  bgWarm: '#111827',
  bgElevated: 'rgba(22,26,36,0.82)',
  surface: 'rgba(255,255,255,0.065)',
  surfaceHigh: 'rgba(255,255,255,0.14)',
  surfaceWarm: 'rgba(145,164,196,0.13)',
  surfaceRed: 'rgba(138,173,255,0.14)',
  glass: 'rgba(255,255,255,0.082)',
  glassHigh: 'rgba(255,255,255,0.15)',
  text: '#f7f8fb',
  subtext: '#c4c9d4',
  dimText: '#7d8493',
  primary: '#8aadff',
  primaryHigh: '#d8e6ff',
  primarySoft: 'rgba(138,173,255,0.20)',
  blue: '#6ea8ff',
  purple: '#b8a6ff',
  orange: '#f1c36d',
  green: '#77d9a8',
  danger: '#ff6b6b',
  warn: '#f1c36d',
  muted: '#646b78',
  border: 'rgba(255,255,255,0.16)',
  line: 'rgba(255,255,255,0.12)',
  overlay: 'rgba(4,6,12,0.62)',
  lyricDim: 'rgba(247,248,251,0.38)',
  lyricActive: '#ffffff',
} as const

export const tvTokens = {
  radius: tvSize(22),
  radiusLg: tvSize(30),
  radiusXl: tvSize(38),
  radiusPill: 999,
  gap: tvSize(22),
  cardPad: tvSize(22),
  pagePadX: tvSize(68),
  pagePadY: tvSize(34),
  title: tvFont(44),
  subtitle: tvFont(21),
  body: tvFont(19),
  caption: tvFont(15),
  nav: tvFont(20),
  cardTitle: tvFont(22),
  heroTitle: tvFont(56),
  railTitle: tvFont(28),
  focusScale: 1.06,
} as const
