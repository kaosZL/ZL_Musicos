package cn.toside.music.mobile;

import android.view.KeyEvent;

import com.reactnativenavigation.NavigationActivity;

import cn.toside.music.mobile.utils.UtilsEvent;

public class MainActivity extends NavigationActivity {

  @Override
  public boolean dispatchKeyEvent(KeyEvent event) {
    dispatchTVRemoteEvent(event);
    return super.dispatchKeyEvent(event);
  }

  private void dispatchTVRemoteEvent(KeyEvent event) {
    String eventType;
    switch (event.getKeyCode()) {
      case KeyEvent.KEYCODE_MEDIA_PLAY_PAUSE:
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
        eventType = "down";
        break;
      case KeyEvent.KEYCODE_DPAD_UP:
        eventType = "up";
        break;
      case KeyEvent.KEYCODE_DPAD_LEFT:
        eventType = "left";
        break;
      case KeyEvent.KEYCODE_DPAD_RIGHT:
        eventType = "right";
        break;
      case KeyEvent.KEYCODE_DPAD_CENTER:
      case KeyEvent.KEYCODE_ENTER:
        eventType = "select";
        break;
      case KeyEvent.KEYCODE_MENU:
        eventType = "menu";
        break;
      default:
        return;
    }

    UtilsEvent.sendTVRemoteEvent(
      eventType,
      event.getAction(),
      event.getRepeatCount(),
      event.getKeyCode()
    );
  }

}
