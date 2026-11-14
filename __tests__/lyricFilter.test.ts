import { test, eq } from './harness'
import { isDisplayLyric } from '../src/screens/TV/lyricFilter'

test('正常歌词行显示', () => {
  eq(isDisplayLyric('东区的咖啡座'), true)
  eq(isDisplayLyric(' 幽暗的沙发里 '), true, '首尾空白应容忍')
  eq(isDisplayLyric('La la la forever'), true)
})

test('空值与纯符号不显示', () => {
  eq(isDisplayLyric(undefined), false)
  eq(isDisplayLyric(''), false)
  eq(isDisplayLyric('   '), false)
  eq(isDisplayLyric('---'), false)
  eq(isDisplayLyric('· · ·'), false)
  eq(isDisplayLyric('~'), false)
})

test('时间轴行不显示', () => {
  eq(isDisplayLyric('[00:12.34]'), false)
  eq(isDisplayLyric('[ti:标题]'), false)
})

test('元数据行不显示（作词/作曲/制作等）', () => {
  eq(isDisplayLyric('作词：方文山'), false)
  eq(isDisplayLyric('作曲：周杰伦'), false)
  eq(isDisplayLyric('作词 : 某人'), false, '冒号前空格也应命中')
  eq(isDisplayLyric('Lyricist: someone'), false)
})

test('版权与宣传行不显示', () => {
  eq(isDisplayLyric('未经著作权人许可，不得翻唱'), false)
  eq(isDisplayLyric('本歌曲由酷狗音乐提供'), false)
  eq(isDisplayLyric('出品：某某唱片'), false)
})

test('「标签: 内容」型人员名单不显示', () => {
  eq(isDisplayLyric('混音：Alex'), false)
  eq(isDisplayLyric('录音室 : Light Studio'), false)
})
