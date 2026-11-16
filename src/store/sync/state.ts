
interface InitState {
  status: LX.Sync.Status
  serverName: string
  type: keyof LX.Sync.ModeTypes
  syncModeComponentId: string
  /** TV：待手机页选择的「首次同步方式」请求（null = 无待选） */
  pendingMode: { serverName: string, type: string } | null
}
const state: InitState = {
  status: {
    status: false,
    message: '',
  },
  serverName: '',
  type: 'list',
  syncModeComponentId: '',
  pendingMode: null,
}


export default state
