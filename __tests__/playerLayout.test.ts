import { test, eq, ok } from './harness'
import { buildPlayerLayout } from '../src/screens/TV/playerLayout'

test('1080p：封面方形、版式居中、底栏贴底', () => {
  const l = buildPlayerLayout(1920, 1080, { scale: 1 })
  eq(l.coverStage.width, l.coverStage.height, '封面应为正方形')
  ok(l.albumColumn.left > 0 && l.albumColumn.top > 0, '封面不在屏幕原点')
  ok(l.lyricColumn.top === l.albumColumn.top, '歌词顶边与封面对齐（v1.9.24 规则）')
  eq(l.lyricColumn.height, l.coverStage.height, '歌词高度与封面同高')
  ok(l.dockOverlay.top > l.lyricColumn.top, '底栏在歌词区下方')
  eq(l.dockOverlay.bottom, 0, '底栏贴到屏幕底')
  ok(l.controlPrimary > l.controlSmall, '播放键比其他键大')
})

test('720p 与 1080p 产出恒定版式（等比适配 = 比例一致只更清晰，README 卖点）', () => {
  const a = buildPlayerLayout(1920, 1080, { scale: 1 })
  const b = buildPlayerLayout(1280, 720, { scale: 1 })
  eq(b.coverStage.width, a.coverStage.width, '封面尺寸跨屏幕恒定（metrics.scale 封顶生效）')
  eq(b.controlSmall, a.controlSmall)
  // offsetY 随屏幕居中偏移，但版式内部相对位置恒定
  eq(b.dockOverlay.top - b.lyricColumn.top, a.dockOverlay.top - a.lyricColumn.top, '底栏相对歌词区的距离恒定')
})

test('scale 下限 0.92 保护（超宽屏不无限缩小）', () => {
  const l = buildPlayerLayout(3840, 500, { scale: 1 })
  const raw = Math.min(3840 / 1144, 500 / 644)
  ok(raw < 0.92, '该尺寸裸缩放确实低于下限')
  ok(l.controlSmall >= 34, '控制键字号守住下限')
})

test('edgeInset 不为负（内容不出屏）', () => {
  const wide = buildPlayerLayout(2000, 800, { scale: 1 })
  eq(wide.edgeInset, Math.max(0, (2000 - 1144 * Math.min(2000 / 1144, 800 / 644, 1 * 1.22 / 1.2)) / 2))
})
