import type { BoardItem } from '@/store/leaderboard/state'
import type { ListInfoItem } from '@/store/songlist/state'

export type TVDetailPayload =
  | {
    type: 'board'
    id: string
    source: LX.OnlineSource
    title: string
    subtitle?: string
    board: BoardItem
  }
  | {
    type: 'songlist'
    id: string
    source: LX.OnlineSource
    title: string
    subtitle?: string
    songlist: ListInfoItem
  }
