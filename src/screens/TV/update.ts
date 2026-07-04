import { version as currentVersion } from '../../../package.json'
import { APP_PROVIDER_NAME } from '@/config/constant'
import { compareVer } from '@/utils'
import { downloadFile, stopDownload, temporaryDirectoryPath } from '@/utils/fs'
import { getSupportedAbis, installApk } from '@/utils/nativeModules/utils'
import { httpFetch } from '@/utils/request'

const TV_UPDATE_MANIFEST_URLS = [
  'https://raw.githubusercontent.com/kaosZL/ZL_Musicos/master/publish/tv-version.json',
  'https://cdn.jsdelivr.net/gh/kaosZL/ZL_Musicos@master/publish/tv-version.json',
]
const GITHUB_RELEASE_LATEST_URL = 'https://api.github.com/repos/kaosZL/ZL_Musicos/releases/latest'
const GITHUB_RELEASE_URL_PREFIX = 'https://github.com/kaosZL/ZL_Musicos/releases/tag/'
const APK_ABIS = ['arm64-v8a', 'armeabi-v7a', 'x86_64', 'x86', 'universal'] as const
export const TV_CURRENT_VERSION = currentVersion

type TVUpdateAbi = typeof APK_ABIS[number]

interface RemoteAsset {
  abi: TVUpdateAbi
  name: string
  url: string
  size: number
}

interface RemoteVersionInfo {
  version: string
  tagName: string
  releaseUrl: string
  body: string
  assets: RemoteAsset[]
}

interface TVUpdateManifestAsset {
  abi?: string
  name: string
  url?: string
  browser_download_url?: string
  size?: number
}

interface TVUpdateManifest {
  version?: string
  tagName?: string
  tag_name?: string
  releaseUrl?: string
  html_url?: string
  body?: string
  assets?: TVUpdateManifestAsset[]
}

interface GitHubReleaseAsset {
  name: string
  browser_download_url: string
  size?: number
}

interface GitHubRelease {
  tag_name: string
  name?: string
  body?: string
  html_url?: string
  assets?: GitHubReleaseAsset[]
}

export interface TVUpdateInfo {
  currentVersion: string
  version: string
  tagName: string
  releaseUrl: string
  body: string
  asset: RemoteAsset
  supportedAbis: string[]
}

export interface TVUpdateCheckResult {
  hasUpdate: boolean
  info: TVUpdateInfo | null
}

let downloadJobId: number | null = null
let downloadedApkPath: string | null = null

const normalizeVersion = (source: string) => {
  const match = /(\d+(?:\.\d+){1,3})/.exec(source)
  if (!match) throw new Error('INVALID_VERSION')
  return match[1]
}

const normalizeAbi = (asset: Pick<TVUpdateManifestAsset, 'abi' | 'name'>): TVUpdateAbi | null => {
  const abi = asset.abi?.toLowerCase()
  if (abi && APK_ABIS.includes(abi as TVUpdateAbi)) return abi as TVUpdateAbi

  const lowerName = asset.name.toLowerCase()
  for (const item of APK_ABIS) {
    if (lowerName.endsWith(`-${item}.apk`)) return item
  }
  return null
}

const requestJson = async(url: string, accept = 'application/json') => {
  const resp = await httpFetch(url, {
    method: 'get',
    timeout: 15000,
    headers: { Accept: accept },
  }).promise

  if (!resp.ok || resp.statusCode !== 200) throw new Error(`REQUEST_FAILED_${resp.statusCode}`)
  return resp.body
}

const normalizeAssets = (assets: TVUpdateManifestAsset[] = []) => {
  return assets
    .map(asset => {
      const abi = normalizeAbi(asset)
      const url = asset.url ?? asset.browser_download_url
      if (!abi || !url) return null
      return {
        abi,
        name: asset.name,
        url,
        size: asset.size ?? 0,
      }
    })
    .filter((asset): asset is RemoteAsset => !!asset)
}

const normalizeManifest = (manifest: TVUpdateManifest): RemoteVersionInfo => {
  const tagName = manifest.tagName ?? manifest.tag_name ?? ''
  const version = manifest.version ?? normalizeVersion(tagName)
  const assets = normalizeAssets(manifest.assets)
  if (!assets.length) throw new Error('NO_APK_ASSET')

  return {
    version,
    tagName,
    releaseUrl: manifest.releaseUrl ?? manifest.html_url ?? `${GITHUB_RELEASE_URL_PREFIX}${tagName}`,
    body: manifest.body ?? '',
    assets,
  }
}

const normalizeGitHubRelease = (release: GitHubRelease): RemoteVersionInfo => {
  const version = normalizeVersion(release.tag_name ?? release.name ?? '')
  const assets = normalizeAssets(release.assets)
  if (!assets.length) throw new Error('NO_APK_ASSET')

  return {
    version,
    tagName: release.tag_name,
    releaseUrl: release.html_url ?? `${GITHUB_RELEASE_URL_PREFIX}${release.tag_name}`,
    body: release.body ?? '',
    assets,
  }
}

const getRemoteVersionInfo = async() => {
  let lastError: unknown
  for (const url of TV_UPDATE_MANIFEST_URLS) {
    try {
      return normalizeManifest(await requestJson(url))
    } catch (err: unknown) {
      lastError = err
    }
  }

  try {
    return normalizeGitHubRelease(await requestJson(GITHUB_RELEASE_LATEST_URL, 'application/vnd.github+json'))
  } catch (err: unknown) {
    throw err ?? lastError
  }
}

const pickAsset = (assets: RemoteAsset[], supportedAbis: string[]) => {
  for (const abi of supportedAbis) {
    const matched = assets.find(asset => asset.abi === abi)
    if (matched) return matched
  }

  return assets.find(asset => asset.abi === 'universal') ?? assets[0] ?? null
}

const getDeviceAbis = async() => {
  const supportedAbis = await getSupportedAbis() as string[]
  const normalized = supportedAbis.filter(abi => APK_ABIS.includes(abi as TVUpdateAbi))
  return normalized.length ? normalized : ['universal']
}

export const checkTVUpdate = async(): Promise<TVUpdateCheckResult> => {
  const remoteInfo = await getRemoteVersionInfo()
  if (compareVer(currentVersion, remoteInfo.version) >= 0) {
    return {
      hasUpdate: false,
      info: null,
    }
  }

  const supportedAbis = await getDeviceAbis()
  const selectedAsset = pickAsset(remoteInfo.assets, supportedAbis)
  if (!selectedAsset) throw new Error('NO_APK_ASSET')

  return {
    hasUpdate: true,
    info: {
      currentVersion,
      version: remoteInfo.version,
      tagName: remoteInfo.tagName,
      releaseUrl: remoteInfo.releaseUrl,
      body: remoteInfo.body,
      asset: selectedAsset,
      supportedAbis,
    },
  }
}

export const getDownloadedTVUpdatePath = () => downloadedApkPath

export const downloadTVUpdate = async(info: TVUpdateInfo, onProgress: (total: number, current: number) => void) => {
  if (downloadJobId) stopDownload(downloadJobId)

  const safeVersion = info.version.replace(/[^0-9a-z.-]/gi, '_')
  const savePath = `${temporaryDirectoryPath}/zl-music-tv-v${safeVersion}-${info.asset.abi}.apk`
  const { jobId, promise } = downloadFile(info.asset.url, savePath, {
    progressInterval: 500,
    connectionTimeout: 20000,
    readTimeout: 45000,
    begin({ contentLength }) {
      onProgress(contentLength, 0)
    },
    progress({ contentLength, bytesWritten }) {
      onProgress(contentLength, bytesWritten)
    },
  })

  downloadJobId = jobId
  await promise
  downloadedApkPath = savePath
  return savePath
}

export const installTVUpdate = async(filePath = downloadedApkPath) => {
  if (!filePath) throw new Error('APK_NOT_DOWNLOADED')
  await installApk(filePath, APP_PROVIDER_NAME)
}
