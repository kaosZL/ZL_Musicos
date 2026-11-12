package cn.toside.music.mobile;

import android.view.KeyEvent;

import com.reactnativenavigation.NavigationActivity;

import cn.toside.music.mobile.utils.UtilsEvent;

public class MainActivity extends NavigationActivity {

  @Override
  public boolean dispatchKeyEvent(KeyEvent event) {
    boolean isTVRemoteEvent = dispatchTVRemoteEvent(event);
    if (BuildConfig.IS_TV_BUILD && isTVRemoteEvent && isHandledTVRemoteKey(event.getKeyCode())) {
      return true;
    }
    return super.dispatchKeyEvent(event);
  }

  private boolean dispatchTVRemoteEvent(KeyEvent event) {
    String eventType;
    switch (event.getKeyCode()) {
      case KeyEvent.KEYCODE_MEDIA_PLAY_PAUSE:
      case KeyEvent.KEYCODE_BUTTON_START:
        eventType = "playPause";
        break;
      case KeyEvent.KEYCODE_MEDIA_REWIND:
        eventType = "rewind";
        break;
      case KeyEvent.KEYCODE_MEDIA_FAST_FORWARD:
        eventType = "fastForward";
        break;
      case KeyEvent.KEYCODE_MEDIA_STOP:
        eventType = "stop";
        break;
      case KeyEvent.KEYCODE_MEDIA_NEXT:
        eventType = "next";
        break;
      case KeyEvent.KEYCODE_MEDIA_PREVIOUS:
        eventType = "previous";
        break;
      case KeyEvent.KEYCODE_DPAD_DOWN:
      case KeyEvent.KEYCODE_SYSTEM_NAVIGATION_DOWN:
      case KeyEvent.KEYCODE_NUMPAD_2:
        eventType = "down";
        break;
      case KeyEvent.KEYCODE_DPAD_UP:
      case KeyEvent.KEYCODE_SYSTEM_NAVIGATION_UP:
      case KeyEvent.KEYCODE_NUMPAD_8:
        eventType = "up";
        break;
      case KeyEvent.KEYCODE_DPAD_LEFT:
      case KeyEvent.KEYCODE_SYSTEM_NAVIGATION_LEFT:
      case KeyEvent.KEYCODE_NUMPAD_4:
        eventType = "left";
        break;
      case KeyEvent.KEYCODE_DPAD_RIGHT:
      case KeyEvent.KEYCODE_SYSTEM_NAVIGATION_RIGHT:
      case KeyEvent.KEYCODE_NUMPAD_6:
        eventType = "right";
        break;
      case KeyEvent.KEYCODE_DPAD_CENTER:
      case KeyEvent.KEYCODE_ENTER:
      case KeyEvent.KEYCODE_NUMPAD_ENTER:
      case KeyEvent.KEYCODE_BUTTON_A:
      case KeyEvent.KEYCODE_BUTTON_SELECT:
        eventType = "select";
        break;
      case KeyEvent.KEYCODE_MENU:
        eventType = "menu";
        break;
      case KeyEvent.KEYCODE_BACK:
        // 返回键纳入统一管线（v1.9.24）：此前唯一走系统 BackHandler 的键——
        // 全局监听器栈（LIFO+按引用去重）依赖不可见的注册顺序，是播放页
        // 「返回键收栏」系列时序 bug 的共同根源。现在与其他遥控键同路径交 JS 路由
        eventType = "back";
        break;
      default:
        return false;
    }

    UtilsEvent.sendTVRemoteEvent(
      eventType,
      event.getAction(),
      event.getRepeatCount(),
      event.getKeyCode()
    );
    return true;
  }

  private boolean isHandledTVRemoteKey(int keyCode) {
    switch (keyCode) {
      case KeyEvent.KEYCODE_DPAD_DOWN:
      case KeyEvent.KEYCODE_SYSTEM_NAVIGATION_DOWN:
      case KeyEvent.KEYCODE_NUMPAD_2:
      case KeyEvent.KEYCODE_DPAD_UP:
      case KeyEvent.KEYCODE_SYSTEM_NAVIGATION_UP:
      case KeyEvent.KEYCODE_NUMPAD_8:
      case KeyEvent.KEYCODE_DPAD_LEFT:
      case KeyEvent.KEYCODE_SYSTEM_NAVIGATION_LEFT:
      case KeyEvent.KEYCODE_NUMPAD_4:
      case KeyEvent.KEYCODE_DPAD_RIGHT:
      case KeyEvent.KEYCODE_SYSTEM_NAVIGATION_RIGHT:
      case KeyEvent.KEYCODE_NUMPAD_6:
      case KeyEvent.KEYCODE_DPAD_CENTER:
      case KeyEvent.KEYCODE_ENTER:
      case KeyEvent.KEYCODE_NUMPAD_ENTER:
      case KeyEvent.KEYCODE_BUTTON_A:
      case KeyEvent.KEYCODE_BUTTON_SELECT:
      case KeyEvent.KEYCODE_MENU:
      case KeyEvent.KEYCODE_BACK:
        return true;
      default:
        return false;
    }
  }

}
