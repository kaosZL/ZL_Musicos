import { test, eq } from './harness'
import { buildDownloadCandidates } from '../src/screens/TV/updateUrlChain'

const GH = 'https://github.com/kaosZL/ZL_Musicos/releases/download/v1.9.23/ZL-Musicos-v1.9.23-arm64-v8a.apk'

test('GitHub 直链：补各镜像前缀', () => {
  eq(buildDownloadCandidates(GH), [GH, 'https://ghfast.top/' + GH, 'https://gh-proxy.com/' + GH])
})

test('已带镜像前缀的清单链接：补原链与其他镜像（ghfast 重复项被去重）', () => {
  const mirrored = 'https://ghfast.top/' + GH
  eq(buildDownloadCandidates(mirrored), [
    mirrored,
    GH,
    'https://gh-proxy.com/' + GH,
  ])
})

test('候选去重', () => {
  const mirrored = 'https://gh-proxy.com/' + GH
  const list = buildDownloadCandidates(mirrored)
  eq(new Set(list).size, list.length, '候选链不应有重复')
})

test('与 GitHub 无关的 URL：原样单候选', () => {
  const url = 'https://example.com/app.apk'
  eq(buildDownloadCandidates(url), [url])
})
