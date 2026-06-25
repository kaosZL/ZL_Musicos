import { getCachedIsTV } from '@/utils/tvMode'
import { Navigation } from 'react-native-navigation'
// import { InteractionManager } from 'react-native'

import {
  HOME_SCREEN,
  PLAY_DETAIL_SCREEN,
  SONGLIST_DETAIL_SCREEN,
  COMMENT_SCREEN,
  TV_HOME_SCREEN,
  TV_PLAYER_SCREEN,
  TV_SEARCH_SCREEN,
  TV_QUEUE_SCREEN,
  TV_HISTORY_SCREEN,
  TV_SETTINGS_SCREEN,
  TV_DETAIL_SCREEN,
  PACT_MODAL,
  SYNC_MODE_MODAL,
} from './screenNames'

import themeState from '@/store/theme/state'
import { NAV_SHEAR_NATIVE_IDS } from '@/config/constant'
import { getStatusBarStyle } from './utils'
import { windowSizeTools } from '@/utils/windowSizeTools'
import { type ListInfoItem } from '@/store/songlist/state'
import type { TVDetailPayload } from '@/screens/TV/types'

const TV_BACKGROUND_COLOR = '#060810'
const TV_PUSH_ANIMATION = {
  content: {
    alpha: {
      from: 0,
      to: 1,
      duration: 220,
    },
    translationY: {
      from: 16,
      to: 0,
      duration: 220,
    },
  },
  element: {
    alpha: {
      from: 0,
      duration: 220,
    },
  },
}

const TV_POP_ANIMATION = {
  content: {
    alpha: {
      from: 1,
      to: 0,
      duration: 160,
    },
    translationY: {
      from: 0,
      to: 12,
      duration: 160,
    },
  },
}

export async function pushHomeScreen() {
  const theme = themeState.theme

  if (getCachedIsTV()) {
    return Navigation.setRoot({
      root: {
        stack: {
          children: [{
            component: {
              name: TV_HOME_SCREEN,
              options: {
                topBar: {
                  visible: false,
                  height: 0,
                  drawBehind: false,
                },
                statusBar: {
                  drawBehind: true,
                  visible: false,
                  style: getStatusBarStyle(theme.isDark),
                  backgroundColor: 'transparent',
                },
                navigationBar: {
                  backgroundColor: TV_BACKGROUND_COLOR,
                },
                layout: {
                  componentBackgroundColor: TV_BACKGROUND_COLOR,
                },
              },
            },
          }],
        },
      },
    })
  }

  return Navigation.setRoot({
    root: {
      stack: {
        children: [{
          component: {
            name: HOME_SCREEN,
            options: {
              topBar: {
                visible: false,
                height: 0,
                drawBehind: false,
              },
              statusBar: {
                drawBehind: true,
                visible: true,
                style: getStatusBarStyle(theme.isDark),
                backgroundColor: 'transparent',
              },
              navigationBar: {
                // visible: false,
                backgroundColor: theme['c-content-background'],
              },
              layout: {
                componentBackgroundColor: theme['c-content-background'],
              },
            },
          },
        }],
      },
    },
  })
}
export function pushPlayDetailScreen(componentId: string, skipAnimation = false) {
  /*
    Navigation.setDefaultOptions({
      topBar: {
        background: {
          color: '#039893',
        },
        title: {
          color: 'white',
        },
        backButton: {
          title: '', // Remove previous screen name from back button
          color: 'white',
        },
        buttonColor: 'white',
      },
      statusBar: {
        style: 'light',
      },
      layout: {
        orientation: ['portrait'],
      },
      bottomTabs: {
        titleDisplayMode: 'alwaysShow',
      },
      bottomTab: {
        textColor: 'gray',
        selectedTextColor: 'black',
        iconColor: 'gray',
        selectedIconColor: 'black',
      },
    })
  */
  requestAnimationFrame(() => {
    const theme = themeState.theme

    void Navigation.push(componentId, {
      component: {
        name: PLAY_DETAIL_SCREEN,
        options: {
          topBar: {
            visible: false,
            height: 0,
            drawBehind: false,
          },
          statusBar: {
            drawBehind: true,
            visible: true,
            style: getStatusBarStyle(theme.isDark),
            backgroundColor: 'transparent',
          },
          navigationBar: {
            // visible: false,
            backgroundColor: theme['c-content-background'],
          },
          layout: {
            componentBackgroundColor: theme['c-content-background'],
          },
          animations: {
            push: skipAnimation ? {} : {
              sharedElementTransitions: [
                {
                  fromId: NAV_SHEAR_NATIVE_IDS.playDetail_pic,
                  toId: NAV_SHEAR_NATIVE_IDS.playDetail_pic,
                  interpolation: { type: 'spring' },
                },
              ],
              elementTransitions: [
                {
                  id: NAV_SHEAR_NATIVE_IDS.playDetail_header,
                  alpha: {
                    from: 0, // We don't declare 'to' value as that is the element's current alpha value, here we're essentially animating from 0 to 1
                    duration: 300,
                  },
                  translationY: {
                    from: -32, // Animate translationY from 16dp to 0dp
                    duration: 300,
                  },
                },
                {
                  id: NAV_SHEAR_NATIVE_IDS.playDetail_player,
                  alpha: {
                    from: 0, // We don't declare 'to' value as that is the element's current alpha value, here we're essentially animating from 0 to 1
                    duration: 300,
                  },
                  translationY: {
                    from: 32, // Animate translationY from 16dp to 0dp
                    duration: 300,
                  },
                },
              ],
              // content: {
              //   translationX: {
              //     from: windowSizeTools.getSize().width,
              //     to: 0,
              //     duration: 300,
              //   },
              // },
            },
            pop: {
              content: {
                translationX: {
                  from: 0,
                  to: windowSizeTools.getSize().width,
                  duration: 300,
                },
              },
            },
          },
        },
      },
    })
  })
}
export function pushSonglistDetailScreen(componentId: string, info: ListInfoItem) {
  const theme = themeState.theme

  requestAnimationFrame(() => {
    void Navigation.push(componentId, {
      component: {
        name: SONGLIST_DETAIL_SCREEN,
        passProps: {
          info,
        },
        options: {
          topBar: {
            visible: false,
            height: 0,
            drawBehind: false,
          },
          statusBar: {
            drawBehind: true,
            visible: true,
            style: getStatusBarStyle(theme.isDark),
            backgroundColor: 'transparent',
          },
          navigationBar: {
            // visible: false,
            backgroundColor: theme['c-content-background'],
          },
          layout: {
            componentBackgroundColor: theme['c-content-background'],
          },
          animations: {
            push: {
              sharedElementTransitions: [
                {
                  fromId: `${NAV_SHEAR_NATIVE_IDS.songlistDetail_pic}_from_${info.id}`,
                  toId: `${NAV_SHEAR_NATIVE_IDS.songlistDetail_pic}_to_${info.id}`,
                  interpolation: { type: 'spring' },
                },
              ],
              elementTransitions: [
                {
                  id: NAV_SHEAR_NATIVE_IDS.songlistDetail_title,
                  alpha: {
                    from: 0, // We don't declare 'to' value as that is the element's current alpha value, here we're essentially animating from 0 to 1
                    duration: 300,
                  },
                  translationX: {
                    from: 16, // Animate translationX from 16dp to 0dp
                    duration: 300,
                  },
                },
              ],
              // content: {
              //   scaleX: {
              //     from: 1.2,
              //     to: 1,
              //     duration: 200,
              //   },
              //   scaleY: {
              //     from: 1.2,
              //     to: 1,
              //     duration: 200,
              //   },
              // },
            },
          },
        },
      },
    })
  })
}
export function pushCommentScreen(componentId: string, musicInfo: LX.Music.MusicInfo) {
  const theme = themeState.theme

  requestAnimationFrame(() => {
    void Navigation.push(componentId, {
      component: {
        name: COMMENT_SCREEN,
        passProps: {
          musicInfo,
        },
        options: {
          topBar: {
            visible: false,
            height: 0,
            drawBehind: false,
          },
          statusBar: {
            drawBehind: true,
            visible: true,
            style: getStatusBarStyle(theme.isDark),
            backgroundColor: 'transparent',
          },
          navigationBar: {
            // visible: false,
            backgroundColor: theme['c-content-background'],
          },
          layout: {
            componentBackgroundColor: theme['c-content-background'],
          },
        },
      },
    })
  })
}
export function showPactModal() {
  const theme = themeState.theme

  void Navigation.showModal({
    stack: {
      children: [{
        component: {
          name: PACT_MODAL,
          options: {
            topBar: {
              visible: false,
              height: 0,
              drawBehind: false,
            },
            statusBar: {
              drawBehind: true,
              visible: true,
              style: getStatusBarStyle(theme.isDark),
              backgroundColor: 'transparent',
            },
            navigationBar: {
              backgroundColor: theme['c-content-background'],
            },
            layout: {
              componentBackgroundColor: 'rgba(0,0,0,0.5)',
            },
          },
        },
      }],
    },
  })
}

export function showSyncModeModal() {
  const theme = themeState.theme

  void Navigation.showModal({
    stack: {
      children: [{
        component: {
          name: SYNC_MODE_MODAL,
          options: {
            topBar: {
              visible: false,
              height: 0,
              drawBehind: false,
            },
            statusBar: {
              drawBehind: true,
              visible: true,
              style: getStatusBarStyle(theme.isDark),
              backgroundColor: 'transparent',
            },
            navigationBar: {
              backgroundColor: theme['c-content-background'],
            },
            layout: {
              componentBackgroundColor: 'rgba(0,0,0,0.5)',
            },
          },
        },
      }],
    },
  })
}

export const pushTVPlayerScreen = (componentId: string) => {
  const theme = themeState.theme
  void Navigation.push(componentId, {
    component: {
      name: TV_PLAYER_SCREEN,
      options: {
        topBar: {
          visible: false,
          height: 0,
          drawBehind: false,
        },
        statusBar: {
          drawBehind: true,
          visible: false,
          style: getStatusBarStyle(theme.isDark),
        },
        navigationBar: {
          backgroundColor: TV_BACKGROUND_COLOR,
        },
        layout: {
          componentBackgroundColor: TV_BACKGROUND_COLOR,
        },
        animations: {
          push: TV_PUSH_ANIMATION,
          pop: TV_POP_ANIMATION,
        },
      },
    },
  })
}

export const pushTVSearchScreen = (componentId: string) => {
  const theme = themeState.theme
  void Navigation.push(componentId, {
    component: {
      name: TV_SEARCH_SCREEN,
      options: {
        topBar: {
          visible: false,
          height: 0,
          drawBehind: false,
        },
        statusBar: {
          drawBehind: true,
          visible: false,
          style: getStatusBarStyle(theme.isDark),
        },
        navigationBar: {
          backgroundColor: TV_BACKGROUND_COLOR,
        },
        layout: {
          componentBackgroundColor: TV_BACKGROUND_COLOR,
        },
        animations: {
          push: TV_PUSH_ANIMATION,
          pop: TV_POP_ANIMATION,
        },
      },
    },
  })
}

export const pushTVQueueScreen = (componentId: string) => {
  const theme = themeState.theme
  void Navigation.push(componentId, {
    component: {
      name: TV_QUEUE_SCREEN,
      options: {
        topBar: {
          visible: false,
          height: 0,
          drawBehind: false,
        },
        statusBar: {
          drawBehind: true,
          visible: false,
          style: getStatusBarStyle(theme.isDark),
        },
        navigationBar: {
          backgroundColor: TV_BACKGROUND_COLOR,
        },
        layout: {
          componentBackgroundColor: TV_BACKGROUND_COLOR,
        },
        animations: {
          push: TV_PUSH_ANIMATION,
          pop: TV_POP_ANIMATION,
        },
      },
    },
  })
}

export const pushTVHistoryScreen = (componentId: string) => {
  const theme = themeState.theme
  void Navigation.push(componentId, {
    component: {
      name: TV_HISTORY_SCREEN,
      options: {
        topBar: {
          visible: false,
          height: 0,
          drawBehind: false,
        },
        statusBar: {
          drawBehind: true,
          visible: false,
          style: getStatusBarStyle(theme.isDark),
        },
        navigationBar: {
          backgroundColor: TV_BACKGROUND_COLOR,
        },
        layout: {
          componentBackgroundColor: TV_BACKGROUND_COLOR,
        },
        animations: {
          push: TV_PUSH_ANIMATION,
          pop: TV_POP_ANIMATION,
        },
      },
    },
  })
}

export const pushTVSettingsScreen = (componentId: string) => {
  const theme = themeState.theme
  void Navigation.push(componentId, {
    component: {
      name: TV_SETTINGS_SCREEN,
      options: {
        topBar: {
          visible: false,
          height: 0,
          drawBehind: false,
        },
        statusBar: {
          drawBehind: true,
          visible: false,
          style: getStatusBarStyle(theme.isDark),
        },
        navigationBar: {
          backgroundColor: TV_BACKGROUND_COLOR,
        },
        layout: {
          componentBackgroundColor: TV_BACKGROUND_COLOR,
        },
        animations: {
          push: TV_PUSH_ANIMATION,
          pop: TV_POP_ANIMATION,
        },
      },
    },
  })
}

export const pushTVDetailScreen = (componentId: string, payload: TVDetailPayload) => {
  const theme = themeState.theme
  void Navigation.push(componentId, {
    component: {
      name: TV_DETAIL_SCREEN,
      passProps: {
        payload,
      },
      options: {
        topBar: {
          visible: false,
          height: 0,
          drawBehind: false,
        },
        statusBar: {
          drawBehind: true,
          visible: false,
          style: getStatusBarStyle(theme.isDark),
        },
        navigationBar: {
          backgroundColor: TV_BACKGROUND_COLOR,
        },
        layout: {
          componentBackgroundColor: TV_BACKGROUND_COLOR,
        },
        animations: {
          push: TV_PUSH_ANIMATION,
          pop: TV_POP_ANIMATION,
        },
      },
    },
  })
}
