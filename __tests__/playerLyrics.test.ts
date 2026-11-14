import { test, eq, ok } from './harness'
import { buildLyricWindow } from '../src/screens/TV/playerLyrics'

const line = (text: string, translation?: string) => ({ text, extendedLyrics: translation ? [translation] : [] })

test('无歌词/索引无效时返回兜底行', () => {
  eq(buildLyricWindow([], -1, '加载中…')[0].text, '加载中…')
  eq(buildLyricWindow([line('a')], 5, '加载中…')[0].text, '加载中…')
})

test('窗口 = 已唱 2 行 + 当前行 + 未唱 2 行', () => {
  const lines = [line('一'), line('二'), line('三'), line('四'), line('五'), line('六'), line('七')]
  const rows = buildLyricWindow(lines, 3, '')  // 当前行 = index 3「四」
  eq(rows.map(r => r.text), ['二', '三', '四', '五', '六'], '当前行上下各取 2 条可显示行')
  eq(rows.find(r => r.active)?.text, '四', 'index 3 应为高亮行')
})

test('杂行（元数据/版权）被跳过，不占窗口位', () => {
  const lines = [line('作词：某人'), line('一'), line('二'), line('未经许可翻唱必究'), line('三'), line('四'), line('五')]
  const rows = buildLyricWindow(lines, 4, '')  // 当前行=「三」(index 4)
  eq(rows.map(r => r.text), ['一', '二', '三', '四', '五'], '杂行应被剔除，窗口仍取满 5 行')
})

test('当前行本身是杂行时，向前借最近的可显示行', () => {
  const lines = [line('一'), line('二'), line('作词：某人'), line('三'), line('四')]
  const rows = buildLyricWindow(lines, 2, '')
  eq(rows.find(r => r.active)?.text, '三', '高亮应顺延到下一条可显示行')
})

test('重复行按 key 去重', () => {
  const lines = [line('啦啦'), line('啦啦'), line('啦啦')]
  const rows = buildLyricWindow(lines, 1, '')
  eq(new Set(rows.map(r => r.key)).size, rows.length)
})

test('翻译取自 extendedLyrics 中第一条可显示行', () => {
  const lines = [line('hello', '你好'), line('world', '世界')]
  const rows = buildLyricWindow(lines, 0, '')
  eq(rows.find(r => r.text === 'hello')?.translation, '你好')
  eq(rows.find(r => r.text === 'world')?.translation, '世界')
})

test('窗口取不满时不硬凑（短歌词）', () => {
  const rows = buildLyricWindow([line('唯一一句')], 0, '')
  eq(rows.map(r => r.text), ['唯一一句'])
  ok(rows[0].active)
})
