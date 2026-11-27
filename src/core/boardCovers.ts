import { httpFetch } from '@/utils/request'
import {
  parseKgBoardCovers,
  parseKwBoardCovers,
  parseMgBoardCovers,
  parseTxBoardCovers,
  parseWyBoardCovers,
} from './boardCoverParser'

/**
 * 排行榜官方封面拉取与会话级缓存（v1.9.26）：
 * 上游各平台 leaderboard.getBoards() 返回静态表不含封面图，这里按平台请求官方榜单元数据
 * 补齐每个榜单的真实封面（飙升榜/热歌榜/新歌榜等），静默容错不影响榜单列表展示。
 */
const coverCache: Partial<Record<LX.OnlineSource, Record<string, string>>> = {}
const inflight: Partial<Record<LX.OnlineSource, Promise<Record<string, string>>>> = {}

const fetchPlatformBoardCovers = async(source: LX.OnlineSource): Promise<Record<string, string>> => {
  switch (source) {
    case 'kw': {
      const resp = await httpFetch('http://qukudata.kuwo.cn/q.k?op=query&cont=tree&node=2&pn=0&rn=1000&fmt=json&level=2', {
        method: 'get',
        timeout: 8000,
      }).promise
      return resp.statusCode === 200 ? parseKwBoardCovers(resp.body) : {}
    }
    case 'kg': {
      const resp = await httpFetch('http://mobilecdnbj.kugou.com/api/v5/rank/list?version=9108&plat=0&showtype=2&parentid=0&apiver=6&area_code=1&withsong=1', {
        method: 'get',
        timeout: 8000,
      }).promise
      return resp.statusCode === 200 ? parseKgBoardCovers(resp.body) : {}
    }
    case 'tx': {
      const resp = await httpFetch('https://c.y.qq.com/v8/fcg-bin/fcg_myqq_toplist.fcg?g_tk=1928093487&inCharset=utf-8&outCharset=utf-8&notice=0&format=json&uin=0&needNewCode=1&platform=h5', {
        method: 'get',
        timeout: 8000,
      }).promise
      return resp.statusCode === 200 ? parseTxBoardCovers(resp.body) : {}
    }
    case 'wy': {
      const resp = await httpFetch('https://music.163.com/api/toplist', {
        method: 'get',
        timeout: 8000,
      }).promise
      return resp.statusCode === 200 ? parseWyBoardCovers(resp.body) : {}
    }
    case 'mg': {
      const resp = await httpFetch('https://app.c.nf.migu.cn/pc/bmw/rank/rank-index/v1.0', {
        method: 'get',
        timeout: 8000,
        headers: {
          Referer: 'https://app.c.nf.migu.cn/',
          channel: '0146921',
        },
      }).promise
      return resp.statusCode === 200 ? parseMgBoardCovers(resp.body) : {}
    }
    default:
      return {}
  }
}

export const getCachedBoardCovers = (source: LX.OnlineSource): Record<string, string> => {
  return coverCache[source] ?? {}
}

export const getCachedBoardCover = (source: LX.OnlineSource, bangid: string): string | null => {
  return coverCache[source]?.[String(bangid)] ?? null
}

export const getBoardCovers = async(source: LX.OnlineSource): Promise<Record<string, string>> => {
  if (coverCache[source]) return coverCache[source]!
  if (inflight[source]) return inflight[source]!

  const task = fetchPlatformBoardCovers(source)
    .then(map => {
      if (Object.keys(map).length > 0) coverCache[source] = map
      return map
    })
    .catch(() => ({}))
    .finally(() => {
      delete inflight[source]
    })

  inflight[source] = task
  return task
}
