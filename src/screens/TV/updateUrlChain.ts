/**
 * 更新包下载的镜像候选链（从 update.ts 抽出的纯逻辑，便于单测）。
 * 输入清单给的 URL（可能已带镜像前缀），产出依次尝试的下载候选：
 * 原始 URL → GitHub 原链 → 各镜像前缀。
 */

export const GITHUB_DOWNLOAD_MIRRORS = ['https://ghfast.top/', 'https://gh-proxy.com/']

/** 正式 APK 体积均在 15MB+；低于 1MB 必为镜像站报错 HTML 页或半截坏包 */
export const MIN_VALID_APK_BYTES = 1024 * 1024

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

/** 校验 RNFS.downloadFile 落盘结果：RNFS 对 HTTP 403/404/502 不会 reject，必须显式校验状态码与体积 */
export const validateDownloadedApk = (
  statusCode: number,
  bytesWritten: number,
  expectedSize = 0,
): { ok: true } | { ok: false, reason: string } => {
  if (statusCode !== 200) return { ok: false, reason: `DOWNLOAD_HTTP_${statusCode}` }
  if (!Number.isFinite(bytesWritten) || bytesWritten < MIN_VALID_APK_BYTES) {
    return { ok: false, reason: `DOWNLOAD_TOO_SMALL_${bytesWritten}` }
  }
  if (expectedSize > 0 && bytesWritten < Math.floor(expectedSize * 0.9)) {
    return { ok: false, reason: `DOWNLOAD_TRUNCATED_${bytesWritten}` }
  }
  return { ok: true }
}
