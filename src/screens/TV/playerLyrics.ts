/**
 * 播放页歌词窗口构建（从 Player.tsx 抽出的纯逻辑，有单测）。
 *
 * 窗口规则（v1.9.24 实机调优）：已唱 2 行 + 当前行 + 未唱 2 行——
 * 当前行被已唱行垫到区域中部垂直居中，上方能看到 1-2 句唱过的歌词。
 * 行过滤复用 lyricFilter.isDisplayLyric（剔除元数据/版权/宣传杂行）。
 */
import { isDisplayLyric } from './lyricFilter'

export interface LyricSourceLine {
  text: string
  extendedLyrics: string[]
}

export interface DisplayLyricRow {
  key: string
  text: string
  translation: string
  active: boolean
  distance: number
}

export const buildLyricWindow = (
  lyricLines: LyricSourceLine[],
  activeIndex: number,
  fallbackText: string,
): DisplayLyricRow[] => {
  const fallback: DisplayLyricRow[] = [{ key: 'fallback', text: fallbackText, translation: '', active: true, distance: 0 }]

  if (activeIndex < 0 || activeIndex >= lyricLines.length || !lyricLines.length) return fallback

  /** 沿 direction 跳过杂行找第 step 条可显示歌词 */
  const seekLine = (direction: -1 | 1, step: number): { item: LyricSourceLine, index: number } | null => {
    let count = 0
    let index = activeIndex
    while (index >= 0 && index < lyricLines.length) {
      index += direction
      const item = lyricLines[index]
      if (!item || !isDisplayLyric(item.text)) continue
      count += 1
      if (count === step) return { item, index }
    }
    return null
  }

  const currentItem = lyricLines[activeIndex]
  const activeDisplayLine = isDisplayLyric(currentItem?.text)
    ? { item: currentItem, index: activeIndex }
    : seekLine(1, 1)

  const lines = [
    seekLine(-1, 2),
    seekLine(-1, 1),
    activeDisplayLine,
    seekLine(1, 1),
    seekLine(1, 2),
  ].filter(Boolean) as Array<{ item: LyricSourceLine, index: number }>

  const rows = lines.map(({ item, index }) => ({
    key: `${index}_${item.text}`,
    text: item.text.trim(),
    translation: item.extendedLyrics.find(isDisplayLyric)?.trim() ?? '',
    active: index === activeDisplayLine?.index,
    distance: Math.min(Math.abs(index - activeIndex), 3),
  })).filter((item, index, list) => item.text && list.findIndex(target => target.key === item.key) === index)

  return rows.length ? rows : fallback
}
