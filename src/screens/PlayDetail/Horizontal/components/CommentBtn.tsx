import Btn from './Btn'
import { navigations } from '@/navigation'
import commonState from '@/store/common/state'
import playerState from '@/store/player/state'


export default () => {
  const handleShowCommentScreen = () => {
    // PlayMusic = MusicInfo | ListItem 联合类型；评论页只接受在线 MusicInfo（手机版遗留页面，TV 构建不触达）
    navigations.pushCommentScreen(commonState.componentIds.playDetail!, playerState.playMusicInfo.musicInfo! as LX.Music.MusicInfo)
  }

  return <Btn icon="comment" onPress={handleShowCommentScreen} />
}
