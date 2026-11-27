/**
 * 排行榜官方封面解析器（纯函数，零 React Native 依赖，供 boardCovers.ts 与单测共用）。
 * 各平台官方榜单接口均返回真实榜单封面（飙升榜/热歌榜/新歌榜等），
 * 按 bangid 映射到可直接渲染的封面 URL。
 */

const normalizeCoverUrl = (url: unknown): string => {
  if (typeof url !== 'string') return ''
  const trimmed = url.trim()
  if (!trimmed) return ''
  if (trimmed.startsWith('//')) return `https:${trimmed}`
  if (!/^https?:\/\//i.test(trimmed)) return ''
  return trimmed
}

export const parseKwBoardCovers = (body: any): Record<string, string> => {
  const result: Record<string, string> = {}
  const list = Array.isArray(body?.child) ? body.child : []
  for (const item of list) {
    const bangid = item?.sourceid != null ? String(item.sourceid).trim() : ''
    const pic = normalizeCoverUrl(item?.pic || item?.pic2 || item?.pic5)
    if (bangid && pic) result[bangid] = pic
  }
  return result
}

export const parseKgBoardCovers = (body: any): Record<string, string> => {
  const result: Record<string, string> = {}
  const list = Array.isArray(body?.data?.info) ? body.data.info : []
  for (const item of list) {
    const bangid = item?.rankid != null ? String(item.rankid).trim() : ''
    const raw = item?.imgurl || item?.banner7url || item?.album_img_9 || ''
    const pic = normalizeCoverUrl(typeof raw === 'string' ? raw.replace(/\{size\}/g, '400') : '')
    if (bangid && pic) result[bangid] = pic
  }
  return result
}

export const parseTxBoardCovers = (body: any): Record<string, string> => {
  const result: Record<string, string> = {}
  const list = Array.isArray(body?.data?.topList) ? body.data.topList : []
  for (const item of list) {
    const bangid = item?.id != null ? String(item.id).trim() : ''
    const pic = normalizeCoverUrl(item?.picUrl)
    if (bangid && pic) result[bangid] = pic
  }
  return result
}

export const parseWyBoardCovers = (body: any): Record<string, string> => {
  const result: Record<string, string> = {}
  const list = Array.isArray(body?.list) ? body.list : []
  for (const item of list) {
    const bangid = item?.id != null ? String(item.id).trim() : ''
    const pic = normalizeCoverUrl(item?.coverImgUrl)
    if (bangid && pic) result[bangid] = pic
  }
  return result
}

export const parseMgBoardCovers = (body: any): Record<string, string> => {
  const result: Record<string, string> = {}
  const walk = (nodes: any) => {
    if (!Array.isArray(nodes)) return
    for (const item of nodes) {
      const bangid = item?.rankId != null ? String(item.rankId).trim() : ''
      const pic = normalizeCoverUrl(item?.imageUrl || item?.picUrl)
      if (bangid && pic && !result[bangid]) result[bangid] = pic
      if (Array.isArray(item?.contents)) walk(item.contents)
    }
  }
  walk(body?.data?.contents)
  return result
}
