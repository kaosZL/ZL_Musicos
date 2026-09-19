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
  | {
    type: 'userlist'
    id: string
    title: string
    subtitle?: string
    source?: LX.OnlineSource
    userlist: LX.List.UserListInfo
  }
