import { popToRoot } from '@/navigation'
import { pushTVHistoryScreen, pushTVMyListScreen, pushTVQueueScreen, pushTVSearchScreen, pushTVSettingsScreen } from '@/navigation/navigation'
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

/**
 * 顶部导航 tab。currentId 传当前屏自己的 tab id：按当前屏的 tab 时 no-op，
 * 否则会把同屏再压一层，返回键要多按一次（Queue 页按「播放列表」实测复现）
 */
export const createTVTabs = (componentId: string, currentId?: string): TVTabItem[] => [
  { id: 'home', label: tvText.recommend, onPress: () => { if (currentId === 'home') return; void popToRoot(componentId) } },
  { id: 'new', label: tvText.charts, onPress: () => { if (currentId === 'new') return; pushTVHistoryScreen(componentId) } },
  { id: 'mylist', label: tvText.mySongLists, onPress: () => { if (currentId === 'mylist') return; pushTVMyListScreen(componentId) } },
  { id: 'search', label: tvText.search, onPress: () => { if (currentId === 'search') return; pushTVSearchScreen(componentId) } },
  { id: 'queue', label: '播放列表', onPress: () => { if (currentId === 'queue') return; pushTVQueueScreen(componentId) } },
  { id: 'settings', label: tvText.settings, onPress: () => { if (currentId === 'settings') return; pushTVSettingsScreen(componentId) } },
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
