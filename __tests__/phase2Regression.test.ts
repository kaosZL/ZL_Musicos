import { test, eq } from './harness'
import { mergeSettingValues } from '../src/config/settingMerge'
import { resolveInitialDialogButtonIndex } from '../src/components/TV/tvDialogState'
import {
  parseKgBoardCovers,
  parseKwBoardCovers,
  parseMgBoardCovers,
  parseTxBoardCovers,
  parseWyBoardCovers,
} from '../src/core/boardCoverParser'

test('配置合并：允许保存原始类型数组（如 common.tvRemovedSources）并浅拷贝隔离', () => {
  const origin = {
    'common.apiSource': 'tv_preset_juhe',
    'common.tvRemovedSources': [] as string[],
    'player.isAutoSkipOnError': true,
  }
  const inputArr = ['tv_preset_juhe']
  const res = mergeSettingValues(origin, { 'common.tvRemovedSources': inputArr })
  eq(res.updatedSettingKeys, ['common.tvRemovedSources'])
  eq(res.setting['common.tvRemovedSources'], ['tv_preset_juhe'])
  // 浅拷贝隔离：外部变更不得污染合并结果
  inputArr.push('mutated')
  eq(res.setting['common.tvRemovedSources'], ['tv_preset_juhe'])
})

test('配置合并：数组元素相同时跳过更新，启动恢复时正常还原已删除预置源', () => {
  const origin = {
    'common.tvRemovedSources': ['tv_preset_juhe'],
    'common.apiSource': 'tv_preset_grass',
  }
  const same = mergeSettingValues(origin, { 'common.tvRemovedSources': ['tv_preset_juhe'] })
  eq(same.updatedSettingKeys, [])
  eq(same.updatedSetting, {})

  const restored = mergeSettingValues(
    { 'common.tvRemovedSources': [] as string[], 'common.apiSource': 'tv_preset_juhe' },
    { 'common.tvRemovedSources': ['tv_preset_juhe', 'tv_preset_grass'] },
  )
  eq(restored.updatedSettingKeys, ['common.tvRemovedSources'])
  eq(restored.setting['common.tvRemovedSources'], ['tv_preset_juhe', 'tv_preset_grass'])
})

test('配置合并：拒绝非法类型（非原始数组、数组与原始值错配）', () => {
  const origin = {
    'common.tvRemovedSources': [] as unknown[],
    'common.apiSource': 'tv_preset_juhe',
  }
  const bad1 = mergeSettingValues(origin, { 'common.tvRemovedSources': [{ id: 'bad' }] })
  eq(bad1.updatedSettingKeys, [])

  const bad2 = mergeSettingValues(origin, {
    'common.tvRemovedSources': 'not-an-array' as unknown as unknown[],
    'common.apiSource': ['wrong'] as unknown as string,
  })
  eq(bad2.updatedSettingKeys, [])
  eq(bad2.setting['common.apiSource'], 'tv_preset_juhe')
})

test('弹窗初始焦点：autoFocus > tone=primary > 索引 0', () => {
  // 二次删除确认弹窗：[取消(dark), 删除(danger, autoFocus: true)] → 默认焦在删除
  eq(resolveInitialDialogButtonIndex([
    { tone: 'dark' },
    { tone: 'danger', autoFocus: true },
  ]), 1)

  // 普通确认弹窗：[取消(dark), 确定(primary)] → 默认焦在确定
  eq(resolveInitialDialogButtonIndex([
    { tone: 'dark' },
    { tone: 'primary' },
  ]), 1)

  // 一级操作菜单：无 autoFocus 且无 primary → 安全落焦第 0 项（取消）
  eq(resolveInitialDialogButtonIndex([
    { tone: 'dark' },
    { tone: 'ghost' },
    { tone: 'danger' },
  ]), 0)

  // autoFocus 优先级高于 tone=primary
  eq(resolveInitialDialogButtonIndex([
    { tone: 'primary' },
    { tone: 'danger', autoFocus: true },
  ]), 1)

  eq(resolveInitialDialogButtonIndex([]), 0)
})

test('榜单封面解析：KW / KG / TX / WY / MG 五平台提取正确并容错异常数据', () => {
  eq(parseKwBoardCovers({
    child: [
      { sourceid: '93', pic: 'http://img3.kwcdn.kuwo.cn/a.png' },
      { sourceid: '16', pic: '', pic2: '//img2.kwcdn.kuwo.cn/b.png' },
      { sourceid: '17', pic: 'not-a-url' },
    ],
  }), {
    93: 'http://img3.kwcdn.kuwo.cn/a.png',
    16: 'https://img2.kwcdn.kuwo.cn/b.png',
  })

  eq(parseKgBoardCovers({
    data: {
      info: [
        { rankid: 8888, imgurl: 'http://imge.kugou.com/mcommon/{size}/cover.png' },
        { rankid: 6666, imgurl: '', banner7url: 'http://imge.kugou.com/{size}/b.png' },
      ],
    },
  }), {
    8888: 'http://imge.kugou.com/mcommon/400/cover.png',
    6666: 'http://imge.kugou.com/400/b.png',
  })

  eq(parseTxBoardCovers({
    data: {
      topList: [
        { id: 26, picUrl: 'http://y.gtimg.cn/music/photo_new/hot.jpg' },
      ],
    },
  }), {
    26: 'http://y.gtimg.cn/music/photo_new/hot.jpg',
  })

  eq(parseWyBoardCovers({
    list: [
      { id: 19723756, coverImgUrl: 'https://p2.music.126.net/up.jpg' },
    ],
  }), {
    19723756: 'https://p2.music.126.net/up.jpg',
  })

  eq(parseMgBoardCovers({
    data: {
      contents: [
        {
          contents: [
            { rankId: '76557745', imageUrl: 'https://d.musicapp.migu.cn/a.webp' },
            { rankId: '76557745', imageUrl: 'https://d.musicapp.migu.cn/dup.webp' },
          ],
        },
      ],
    },
  }), {
    76557745: 'https://d.musicapp.migu.cn/a.webp',
  })

  // 异常入参均安全返回空对象
  eq(parseKwBoardCovers(null), {})
  eq(parseKgBoardCovers({}), {})
  eq(parseTxBoardCovers(undefined), {})
  eq(parseWyBoardCovers({ list: 'bad' }), {})
  eq(parseMgBoardCovers({ data: {} }), {})
})
