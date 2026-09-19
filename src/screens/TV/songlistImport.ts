import { createList } from '@/core/list'
import { getListDetail, getListDetailAll } from '@/core/songlist'
import { userLists } from '@/utils/listManage'
import { deduplicationList, filterMusicList, fixNewMusicInfoQuality, toNewMusicInfo } from '@/utils'
import { findMusic } from '@/utils/musicSdk'
import { getSourceName } from './utils'
import { tvText } from './labels'

/**
 * TV 端「导入歌单」的解析与落库逻辑。
 *
 * 输入是手机页面提交（经局域网服务）过来的一段文本：可能是歌单链接、洛雪导出的歌单文件、
 * 压缩包里解出来的歌单文件，也可能是「歌名 - 歌手」逐行清单。
 *
 * 设计原则：按内容判断，不按后缀名判断。三条路径依次尝试：
 *   1. 洛雪原生歌单文件（JSON，playListPart / playList_v2 / allData 等）—— 最准，100% 还原
 *   2. 歌单链接（网易云 / QQ音乐 / 酷狗 / 酷我 / 咪咕）—— 走各平台 SDK 拉全量歌曲
 *   3. 纯文本逐行 —— 切成「歌名 + 歌手」后逐首搜索匹配
 *
 * 关于搜索匹配：复用 SDK 自带的 findMusic，它本身就要求「歌名完全一致且歌手命中」，
 * 天然满足「只保留高置信度、宁可少几首也不要错歌」的策略。匹配不到的会统计进 skipped。
 */

export interface TVSonglistImportOutcome {
  ok: boolean
  message: string
  listNames: string[]
  addedCount: number
  skippedCount: number
}

interface ParsedList {
  name: string
  id?: string
  source?: LX.OnlineSource
  sourceListId?: string
  list: LX.Music.MusicInfo[]
}

/** 「歌名+歌手」清单需要逐首搜索，成本较高，这里设一个上限避免一次导入把接口打爆 */
const MAX_SEARCH_LINES = 300
/** 搜索匹配的并发度，太高容易被平台限流 */
const SEARCH_CONCURRENCY = 3

const URL_RXP = /https?:\/\/[^\s"'<>）)】\]，,]+/gi
const LINE_SPLITTERS = [' - ', ' – ', ' – ', ' — ', ' -', '- ', '\t', '｜', '|', '／', '/', '、', '，', ',', '·']
const INDEX_PREFIX_RXP = /^\s*[(（\[]?\d{1,3}[)）\]]?\s*[.、,，)）:：]\s*/

const SOURCE_HOST_RULES: Array<{ source: LX.OnlineSource, host: RegExp }> = [
  { source: 'wy', host: /(^|\.)music\.163\.com$|(^|\.)163cn\.tv$|(^|\.)music\.126\.net$/ },
  { source: 'tx', host: /(^|\.)y\.qq\.com$|(^|\.)c\.y\.qq\.com$|(^|\.)i\.y\.qq\.com$/ },
  { source: 'kg', host: /(^|\.)kugou\.com$/ },
  { source: 'kw', host: /(^|\.)kuwo\.cn$/ },
  { source: 'mg', host: /(^|\.)music\.migu\.cn$|(^|\.)migu\.cn$/ },
]

// findMusic 来自 .js 模块，这里显式收窄签名，避免类型推断带来的不确定性
const runFindMusic = findMusic as unknown as (info: {
  name: string
  singer?: string
  albumName?: string
  interval?: string
  source?: LX.OnlineSource
}) => Promise<any[]>

const pad2 = (value: number) => (value < 10 ? `0${value}` : `${value}`)

/**
 * 没给歌单名时的自动命名。
 *
 * 以前叫「导入歌单 MM-DD HH:mm」，而「我的歌单」页里常驻的导入入口卡标题也是「导入歌单」，
 * 于是海报卡被截断成「导入歌单…」后与入口卡几乎无法区分（用户报「有两个都叫导入歌单的选项」）。
 * 现在用「歌单」前缀 + 时间，和入口卡彻底区分开；文案复用 labels.ts 的键，不硬编码中文。
 */
const defaultListName = () => {
  const now = new Date()
  return `${tvText.songlist} ${pad2(now.getMonth() + 1)}-${pad2(now.getDate())} ${pad2(now.getHours())}:${pad2(now.getMinutes())}`
}

const normalizeText = (raw: string) => (raw ?? '').replace(/^\uFEFF/, '').replace(/\r\n?/g, '\n').trim()

const makeUniqueListId = (base?: string) => {
  const stem = base && base.length <= 48 ? base : `tv_import_${Date.now()}`
  let id = stem
  let index = 1
  while (userLists.some(list => list.id === id)) {
    id = `${stem}__${index}`
    index += 1
  }
  return id
}

const resolveSourceFromUrl = (url: string): LX.OnlineSource | null => {
  let host = ''
  try {
    host = new URL(url).hostname.toLowerCase()
  } catch {
    return null
  }
  for (const rule of SOURCE_HOST_RULES) {
    if (rule.host.test(host)) return rule.source
  }
  return null
}

/** 从链接里尽力抠出数字 ID，作为 SDK 解析失败时的兜底 */
const extractListId = (url: string) => {
  const byQuery = /[?&]id=(\d+)/.exec(url)
  if (byQuery) return byQuery[1]
  const byPath = /\/(?:playlist|playlist_detail|songlist|special|toplist)\/(\d+)/.exec(url)
  if (byPath) return byPath[1]
  const byHtml = /\/(\d+)\.html/.exec(url)
  if (byHtml) return byHtml[1]
  return ''
}

const normalizeMusicItems = (items: any[], legacy: boolean): LX.Music.MusicInfo[] => {
  const mapped = items.map(item => (legacy ? toNewMusicInfo(item) : item) as LX.Music.MusicInfo)
  return filterMusicList(mapped).map(item => fixNewMusicInfoQuality(item))
}

const toParsedList = (raw: any, legacy: boolean): ParsedList | null => {
  if (!raw || typeof raw !== 'object') return null
  const list = Array.isArray(raw.list) ? raw.list : []
  if (!list.length) return null
  return {
    name: typeof raw.name === 'string' ? raw.name.trim() : '',
    id: typeof raw.id === 'string' ? raw.id : undefined,
    source: raw.source as LX.OnlineSource | undefined,
    sourceListId: typeof raw.sourceListId === 'string' ? raw.sourceListId : undefined,
    list: normalizeMusicItems(list, legacy),
  }
}

const collectParsedLists = (raw: any, legacy: boolean): ParsedList[] => {
  const items = Array.isArray(raw) ? raw : [raw]
  const result: ParsedList[] = []
  for (const item of items) {
    const parsed = toParsedList(item, legacy)
    if (parsed) result.push(parsed)
  }
  return result
}

/**
 * 尝试把文本当成洛雪原生歌单文件解析。
 * 覆盖导出格式：playListPart(_v2) / playList(_v2) / allData(_v2) / defautlList。
 */
const parseLxListFile = (text: string): ParsedList[] | null => {
  const trimmed = text.trim()
  if (!trimmed.startsWith('{') && !trimmed.startsWith('[')) return null

  let data: any
  try {
    data = JSON.parse(trimmed)
  } catch {
    return null
  }
  if (!data || typeof data !== 'object') return null

  const type = typeof data.type === 'string' ? data.type : ''
  const legacy = !type.endsWith('_v2')
  let lists: ParsedList[] = []

  switch (type) {
    case 'playListPart':
    case 'playListPart_v2':
    case 'playList':
    case 'playList_v2':
      lists = collectParsedLists(data.data, legacy)
      break
    case 'allData':
    case 'allData_v2':
      lists = collectParsedLists(data.playList ?? data.playlist ?? data.data, legacy)
      break
    case 'defautlList':
      lists = collectParsedLists(data.data ?? data, legacy)
      break
    default:
      return null
  }
  return lists.length ? lists : null
}

const extractUrls = (line: string) => {
  const matched = line.match(URL_RXP)
  return matched ? matched : []
}

const parseSongLine = (line: string): { name: string, singer: string } | null => {
  const text = line.trim().replace(INDEX_PREFIX_RXP, '').trim()
  if (!text) return null
  for (const separator of LINE_SPLITTERS) {
    const index = text.indexOf(separator)
    if (index <= 0) continue
    const name = text.slice(0, index).trim()
    const singer = text.slice(index + separator.length).trim()
    if (name && singer) return { name, singer }
  }
  return { name: text, singer: '' }
}

const splitInput = (text: string) => {
  const links: string[] = []
  const songs: Array<{ name: string, singer: string }> = []
  for (const rawLine of text.split('\n')) {
    const line = rawLine.trim()
    if (!line) continue
    if (line.startsWith('#') || line.startsWith('//')) continue
    const urls = extractUrls(line)
    if (urls.length) {
      for (const url of urls) {
        if (!links.includes(url)) links.push(url)
      }
      const rest = line.replace(URL_RXP, '').replace(/[\s:：,，、|]+/g, '')
      if (!rest) continue
    }
    const song = parseSongLine(line)
    if (song) songs.push(song)
  }
  return { links, songs }
}

const matchOneSong = async(song: { name: string, singer: string }): Promise<LX.Music.MusicInfo | null> => {
  const pick = (results: any[] | null | undefined) => {
    if (!results || !results.length) return null
    const first = results[0]
    if (!first || typeof first !== 'object') return null
    return toNewMusicInfo(first)
  }
  try {
    const forward = pick(await runFindMusic({ name: song.name, singer: song.singer }))
    if (forward) return forward
    // 「歌手 - 歌名」这种反着写的清单也很常见，命中不了再试一次反向匹配
    if (song.singer) {
      return pick(await runFindMusic({ name: song.singer, singer: song.name }))
    }
  } catch {
    // 单个搜索失败不影响整体导入
  }
  return null
}

const matchSongs = async(
  songs: Array<{ name: string, singer: string }>,
  onProgress?: (message: string) => void,
) => {
  const matched: LX.Music.MusicInfo[] = []
  let skipped = 0
  let cursor = 0
  const total = songs.length

  const worker = async() => {
    while (cursor < total) {
      const index = cursor
      cursor += 1
      const result = await matchOneSong(songs[index])
      if (result) matched.push(result)
      else skipped += 1
      if (onProgress && (index + 1) % 5 === 0) {
        onProgress(`正在匹配歌曲 ${index + 1}/${total}…`)
      }
    }
  }

  await Promise.all(Array.from({ length: Math.min(SEARCH_CONCURRENCY, total) }, worker))
  return { matched, skipped }
}

const createListsFromParsed = async(
  items: ParsedList[],
  nameHint: string | undefined,
  onProgress?: (message: string) => void,
): Promise<TVSonglistImportOutcome> => {
  const createdNames: string[] = []
  // 被 userListCreate 静默跳过的歌单名（ID 撞车时上游是 `return`，既不抛错也不返回信号）。
  // 不能让它变成「提示导入成功、实际啥也没发生」，所以这里显式记下来并如实上报。
  const skippedNames: string[] = []
  let added = 0
  // 重名兜底：同一个歌单被导入两次会生成两张同名卡片，用户根本分不出哪张是哪张，
  // 这里在重名时自动补「(2)」「(3)」序号
  const usedNames = new Set(userLists.map(list => list.name))
  const uniqueName = (raw: string) => {
    if (!usedNames.has(raw)) {
      usedNames.add(raw)
      return raw
    }
    let index = 2
    while (usedNames.has(`${raw} (${index})`)) index += 1
    const next = `${raw} (${index})`
    usedNames.add(next)
    return next
  }

  for (const item of items) {
    const list = deduplicationList(item.list)
    if (!list.length) continue
    const name = uniqueName((nameHint && items.length === 1 ? nameHint : item.name) || defaultListName())
    const id = makeUniqueListId(item.id)
    onProgress?.(`正在写入歌单「${name}」…`)
    await createList({
      name,
      id,
      list,
      source: item.source,
      sourceListId: item.sourceListId,
    })
    // createList → list_create → userListCreate 会写进 userLists（同一个活数组）。
    // 万一 ID 仍然撞车，上游会静默 return：这里回读一次，避免把「没写进去」报成成功。
    if (!userLists.some(entry => entry.id === id)) {
      skippedNames.push(name)
      continue
    }
    createdNames.push(name)
    added += list.length
  }

  // 注意：这里【不需要】再调一次 setUserList(userLists)。
  // createList → createUserList → list_event.list_create → updateUserList() 内部已经
  // setUserList(userLists) 了（见 src/event/listEvent.ts）。原来那句是多余的一次
  // mylistUpdated 广播，会让「我的歌单」多渲染一次、并让设置页的快照 effect 多重跑一次。

  if (!createdNames.length) {
    return {
      ok: false,
      message: skippedNames.length
        ? `导入失败：歌单「${skippedNames.join('、')}」与已有歌单 ID 冲突，没有写入`
        : '文件里没有解析到歌曲',
      listNames: [],
      addedCount: 0,
      skippedCount: 0,
    }
  }

  const parts = [`已导入 ${createdNames.length} 个歌单，共 ${added} 首`]
  if (skippedNames.length) parts.push(`另有 ${skippedNames.length} 个因 ID 冲突被跳过（${skippedNames.join('、')}）`)
  return {
    ok: true,
    message: parts.join('，'),
    listNames: createdNames,
    addedCount: added,
    skippedCount: 0,
  }
}

const importFromLinks = async(
  links: string[],
  nameHint: string | undefined,
  onProgress?: (message: string) => void,
): Promise<{ items: ParsedList[], failed: number }> => {
  const items: ParsedList[] = []
  let failed = 0

  for (let i = 0; i < links.length; i++) {
    const url = links[i]
    const source = resolveSourceFromUrl(url)
    if (!source) {
      failed += 1
      continue
    }
    onProgress?.(`正在拉取歌单 ${i + 1}/${links.length}…`)
    let name = ''
    let list: LX.Music.MusicInfoOnline[] = []
    try {
      const detail = await getListDetail(url, source, 1)
      name = detail?.info?.name ?? ''
      list = (await getListDetailAll(source, url)) as LX.Music.MusicInfoOnline[]
    } catch {
      const fallbackId = extractListId(url)
      if (!fallbackId) {
        failed += 1
        continue
      }
      try {
        const detail = await getListDetail(fallbackId, source, 1)
        name = detail?.info?.name ?? ''
        list = (await getListDetailAll(source, fallbackId)) as LX.Music.MusicInfoOnline[]
      } catch {
        failed += 1
        continue
      }
    }
    if (!list.length) {
      failed += 1
      continue
    }
    items.push({
      name: name || `${getSourceName(source)} 歌单 ${items.length + 1}`,
      source,
      list: list as unknown as LX.Music.MusicInfo[],
    })
  }

  return { items, failed }
}

/**
 * 主入口：把一段文本 / 一个文件内容导入成 TV 端的「我的歌单」。
 *
 * @param rawText 手机页面提交的文本（已由原生层把压缩包内容展开并合并进来）
 * @param options.listName 用户指定的歌单名（可选）
 * @param options.fileName 上传的文件名，用于兜底命名（可选）
 * @param options.onProgress 进度回调，用于在电视上显示导入进展
 */
export const importSonglist = async(
  rawText: string,
  options?: { listName?: string, fileName?: string, onProgress?: (message: string) => void },
): Promise<TVSonglistImportOutcome> => {
  const text = normalizeText(rawText)
  const nameHint = options?.listName?.trim() || options?.fileName?.replace(/\.[^.]+$/, '').trim() || undefined
  const onProgress = options?.onProgress

  if (!text) {
    return { ok: false, message: '没有收到可导入的内容', listNames: [], addedCount: 0, skippedCount: 0 }
  }

  // 路径一：洛雪原生歌单文件，直接还原
  const lxLists = parseLxListFile(text)
  if (lxLists) return createListsFromParsed(lxLists, nameHint, onProgress)

  const { links, songs } = splitInput(text)
  const items: ParsedList[] = []
  const failedLinks = { count: 0 }

  if (links.length) {
    const result = await importFromLinks(links, nameHint, onProgress)
    items.push(...result.items)
    failedLinks.count = result.failed
  }

  let matchedCount = 0
  let skippedCount = 0
  if (songs.length) {
    const targets = songs.slice(0, MAX_SEARCH_LINES)
    const { matched, skipped } = await matchSongs(targets, onProgress)
    matchedCount = matched.length
    skippedCount = skipped + Math.max(0, songs.length - MAX_SEARCH_LINES)
    if (matched.length) {
      items.push({
        name: nameHint || defaultListName(),
        list: matched,
      })
    }
  }

  if (!items.length) {
    const parts: string[] = []
    if (links.length) parts.push(`${links.length} 个链接都没能拉到歌曲`)
    if (songs.length) parts.push(`${songs.length} 首歌都没匹配上`)
    return {
      ok: false,
      message: parts.length ? `导入失败：${parts.join('，')}` : '没识别出歌单链接或歌曲清单',
      listNames: [],
      addedCount: 0,
      skippedCount,
    }
  }

  const outcome = await createListsFromParsed(items, nameHint, onProgress)
  // 一个歌单都没落地时，必须如实返回 ok:false，否则「提示导入成功、电视上啥也没有」。
  if (!outcome.ok) {
    return {
      ok: false,
      message: outcome.message,
      listNames: [],
      addedCount: 0,
      skippedCount,
    }
  }
  const summaries: string[] = []
  if (outcome.listNames.length) summaries.push(`已导入 ${outcome.listNames.length} 个歌单`)
  if (matchedCount) summaries.push(`匹配到 ${matchedCount} 首`)
  if (skippedCount) summaries.push(`跳过 ${skippedCount} 首（未找到高置信度匹配）`)
  if (failedLinks.count) summaries.push(`${failedLinks.count} 个链接拉取失败`)
  return {
    ok: true,
    message: summaries.length ? summaries.join('，') : outcome.message,
    listNames: outcome.listNames,
    addedCount: outcome.addedCount,
    skippedCount,
  }
}
