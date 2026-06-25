// @flow

import { Navigation } from 'react-native-navigation'

import {
  Home,
  PlayDetail,
  SonglistDetail,
  Comment,
  TVHome,
  TVPlayer,
  TVSearch,
  TVQueue,
  TVHistory,
  TVSettings,
  TVDetail,
} from '@/screens'
import { Provider } from '@/store/Provider'

import {
  HOME_SCREEN,
  PLAY_DETAIL_SCREEN,
  SONGLIST_DETAIL_SCREEN,
  COMMENT_SCREEN,
  VERSION_MODAL,
  PACT_MODAL,
  SYNC_MODE_MODAL,
  TV_HOME_SCREEN,
  TV_PLAYER_SCREEN,
  TV_SEARCH_SCREEN,
  TV_QUEUE_SCREEN,
  TV_HISTORY_SCREEN,
  TV_SETTINGS_SCREEN,
  TV_DETAIL_SCREEN,
} from './screenNames'
import VersionModal from './components/VersionModal'
import PactModal from './components/PactModal'
import SyncModeModal from './components/SyncModeModal'

function WrappedComponent(Component: any) {
  return function inject(props: Record<string, any>) {
    const EnhancedComponent = () => (
      <Provider>
        <Component
          {...props}
        />
      </Provider>
    )

    return <EnhancedComponent />
  }
}

export default () => {
  Navigation.registerComponent(HOME_SCREEN, () => WrappedComponent(Home))
  Navigation.registerComponent(PLAY_DETAIL_SCREEN, () => WrappedComponent(PlayDetail))
  Navigation.registerComponent(SONGLIST_DETAIL_SCREEN, () => WrappedComponent(SonglistDetail))
  Navigation.registerComponent(COMMENT_SCREEN, () => WrappedComponent(Comment))
  Navigation.registerComponent(VERSION_MODAL, () => WrappedComponent(VersionModal))
  Navigation.registerComponent(PACT_MODAL, () => WrappedComponent(PactModal))
  Navigation.registerComponent(SYNC_MODE_MODAL, () => WrappedComponent(SyncModeModal))
  Navigation.registerComponent(TV_HOME_SCREEN, () => WrappedComponent(TVHome))
  Navigation.registerComponent(TV_PLAYER_SCREEN, () => WrappedComponent(TVPlayer))
  Navigation.registerComponent(TV_SEARCH_SCREEN, () => WrappedComponent(TVSearch))
  Navigation.registerComponent(TV_QUEUE_SCREEN, () => WrappedComponent(TVQueue))
  Navigation.registerComponent(TV_HISTORY_SCREEN, () => WrappedComponent(TVHistory))
  Navigation.registerComponent(TV_SETTINGS_SCREEN, () => WrappedComponent(TVSettings))
  Navigation.registerComponent(TV_DETAIL_SCREEN, () => WrappedComponent(TVDetail))

  console.info('All screens have been registered...')
}
