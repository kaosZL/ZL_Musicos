/**
 * 播放页 Apple Music TV 版式（从 Player.tsx 抽出的纯数学，有单测）。
 * 设计基准 1144×644（等比缩放，offsetX/Y 居中），度量由 getTVLayoutMetrics
 * （theme/tv）在外层算好注入——本模块不依赖 react-native。
 */

export interface PlayerLayoutMetrics {
  scale: number
}

export interface PlayerLayout {
  albumColumn: { left: number, top: number, width: number }
  coverStage: { width: number, height: number }
  coverGlow: { width: number, height: number, borderRadius: number, left: number, top: number }
  coverWrap: { width: number, height: number, borderRadius: number }
  cover: { borderRadius: number }
  songIdentity: { marginTop: number, width: number }
  songTitle: { fontSize: number, lineHeight: number }
  metaRow: { marginTop: number, maxWidth: number }
  songMeta: { fontSize: number, lineHeight: number }
  sourceMeta: { fontSize: number, lineHeight: number }
  lyricColumn: { left: number, right: number, top: number, height: number }
  lyricContent: { paddingRight: number }
  lyricTextActive: { fontSize: number, lineHeight: number }
  lyricTextNear: { fontSize: number, lineHeight: number }
  lyricTextFar: { fontSize: number, lineHeight: number }
  translation: { fontSize: number }
  dockOverlay: { left: number, right: number, top: number, bottom: number }
  dockControls: { right: number, top: number }
  controlSmall: number
  controlPrimary: number
  backdropBlur: number
  backdropInsetX: number
  backdropInsetY: number
  edgeInset: number
}

export const buildPlayerLayout = (screenWidth: number, screenHeight: number, metrics: PlayerLayoutMetrics): PlayerLayout => {
  const rawScale = Math.min(screenWidth / 1144, screenHeight / 644)
  const scale = Math.max(0.92, Math.min(rawScale, metrics.scale * (1.22 / 1.2)))
  const offsetX = (screenWidth - 1144 * scale) / 2
  const offsetY = (screenHeight - 644 * scale) / 2
  const s = (value: number) => Math.round(value * scale)
  const coverSize = s(312)

  return {
    albumColumn: {
      left: offsetX + s(88),
      top: offsetY + s(102),
      width: coverSize,
    },
    coverStage: {
      width: coverSize,
      height: coverSize,
    },
    coverGlow: {
      width: coverSize + s(18),
      height: coverSize + s(18),
      borderRadius: s(13),
      left: -s(9),
      top: -s(9),
    },
    coverWrap: {
      width: coverSize,
      height: coverSize,
      borderRadius: s(8),
    },
    cover: {
      borderRadius: s(8),
    },
    songIdentity: {
      marginTop: s(14),
      width: coverSize,
    },
    songTitle: {
      fontSize: Math.max(15, s(19)),
      lineHeight: Math.max(20, s(24)),
    },
    metaRow: {
      marginTop: s(4),
      maxWidth: coverSize,
    },
    songMeta: {
      fontSize: Math.max(13, s(16)),
      lineHeight: Math.max(18, s(21)),
    },
    sourceMeta: {
      fontSize: Math.max(13, s(16)),
      lineHeight: Math.max(18, s(21)),
    },
    lyricColumn: {
      left: offsetX + s(501),
      right: Math.max(s(48), screenWidth - (offsetX + s(1100))),
      // 垂直方向与封面对齐（v1.9.24 实机反馈）：顶边=封面顶边、底边=封面底边，
      // 高亮行在区域内垂直居中（样式层本就 justifyContent:center）
      top: offsetY + s(102),
      height: coverSize,
    },
    lyricContent: {
      paddingRight: s(18),
    },
    lyricTextActive: {
      fontSize: Math.max(34, s(44)),
      lineHeight: Math.max(42, s(54)),
    },
    lyricTextNear: {
      fontSize: Math.max(22, s(30)),
      lineHeight: Math.max(29, s(38)),
    },
    lyricTextFar: {
      fontSize: Math.max(19, s(26)),
      lineHeight: Math.max(26, s(34)),
    },
    translation: {
      fontSize: Math.max(14, s(18)),
    },
    dockOverlay: {
      left: offsetX + s(48),
      right: offsetX + s(48),
      top: offsetY + s(538),
      bottom: 0,
    },
    dockControls: {
      right: s(80),
      top: -s(26),
    },
    controlSmall: Math.max(34, s(42)),
    controlPrimary: Math.max(42, s(52)),
    backdropBlur: 34,
    backdropInsetX: s(160),
    backdropInsetY: s(130),
    edgeInset: Math.max(0, offsetX),
  }
}
