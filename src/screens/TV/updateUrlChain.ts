/**
 * 更新包下载的镜像候选链（从 update.ts 抽出的纯逻辑，便于单测）。
 * 输入清单给的 URL（可能已带镜像前缀），产出依次尝试的下载候选：
 * 原始 URL → GitHub 原链 → 各镜像前缀。
 */

export const GITHUB_DOWNLOAD_MIRRORS = ['https://ghfast.top/', 'https://gh-proxy.com/']

export const buildDownloadCandidates = (url: string, mirrors: string[] = GITHUB_DOWNLOAD_MIRRORS): string[] => {
  const candidates = [url]
  const ghIdx = url.indexOf('https://github.com/')
  if (ghIdx > 0) {
    // 清单 URL 已带镜像前缀：补 GitHub 原链与其他镜像前缀
    const origin = url.slice(ghIdx)
    candidates.push(origin)
    for (const mirror of mirrors) candidates.push(mirror + origin)
  } else if (ghIdx === 0) {
    for (const mirror of mirrors) candidates.push(mirror + url)
  }
  return [...new Set(candidates)]
}
