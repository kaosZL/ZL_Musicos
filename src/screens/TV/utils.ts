import { popToRoot } from '@/navigation'
import { pushTVHistoryScreen, pushTVSearchScreen, pushTVSettingsScreen } from '@/navigation/navigation'
import type { TVTabItem } from '@/components/TV/TVTopTabs'
import { dot, tvText } from './labels'

type TVMusicLike = Partial<LX.Music.MusicInfo> & Partial<LX.Player.MusicInfo>

const emptyMusicInfo: TVMusicLike = {}

const sourceNames: Record<string, string> = {
  kw: tvText.kuwo,
  kg: tvText.kugou,
  tx: tvText.qqMusic,
  wy: tvText.netease,
  mg: tvText.migu,
  local: tvText.local,
  tv_preset_juhe: tvText.aggregateSource,
  tv_preset_huibq: `Huibq${dot}${tvText.source}`,
  tv_preset_grass: `Grass${dot}${tvText.source}`,
  tv_preset_flower: `Flower${dot}${tvText.source}`,
}

export const createTVTabs = (componentId: string): TVTabItem[] => [
  { id: 'home', label: tvText.recommend, onPress: () => { void popToRoot(componentId) } },
  { id: 'new', label: tvText.charts, onPress: () => { pushTVHistoryScreen(componentId) } },
  { id: 'search', label: tvText.search, onPress: () => { pushTVSearchScreen(componentId) } },
  { id: 'settings', label: tvText.settings, onPress: () => { pushTVSettingsScreen(componentId) } },
]

export const normalizeMusicInfo = (musicInfo?: LX.Player.PlayMusic | LX.Player.MusicInfo | LX.Music.MusicInfo | null) => {
  if (!musicInfo) return emptyMusicInfo
  return ('progress' in musicInfo ? musicInfo.metadata.musicInfo : musicInfo) as TVMusicLike
}

export const getAlbumName = (musicInfo?: TVMusicLike | null) => musicInfo?.meta?.albumName ?? musicInfo?.album ?? ''

export const getMusicSubtitle = (musicInfo?: TVMusicLike | null) => {
  const singer = musicInfo?.singer ?? tvText.unknownSinger
  const album = getAlbumName(musicInfo)
  const source = getSourceName(musicInfo?.source)
  return album ? `${singer}${dot}${album}` : `${singer}${dot}${source}`
}

export const getSourceName = (source?: string | null) => source ? sourceNames[source] ?? source.toUpperCase() : tvText.aggregateSource

export const getPlayModeName = (mode?: LX.AppSetting['player.togglePlayMethod']) => {
  switch (mode) {
    case 'random': return tvText.random
    case 'singleLoop': return tvText.singleLoop
    case 'listLoop': return tvText.listLoop
    case 'list': return tvText.orderPlay
    case 'none': return tvText.stopAfterPlay
    default: return tvText.listLoop
  }
}

export const getModeLabel = (mode?: LX.AppSetting['player.togglePlayMethod']) => getPlayModeName(mode)

export const getMusicImage = (music?: TVMusicLike | null) => {
  if (!music) return null
  const imageInfo = music as TVMusicLike & { pic?: string | null, img?: string | null }
  return imageInfo.pic ?? imageInfo.img ?? imageInfo.meta?.picUrl ?? null
}
