package cn.toside.music.mobile.utils;

import androidx.annotation.Nullable;

import com.facebook.react.bridge.Arguments;
import com.facebook.react.bridge.ReactApplicationContext;
import com.facebook.react.bridge.WritableMap;
import com.facebook.react.modules.core.DeviceEventManagerModule;

public class UtilsEvent {
  public static final String SCREEN_STATE = "screen-state";
  public static final String SCREEN_SIZE_CHANGED = "screen-size-changed";
  public static final String TV_REMOTE_EVENT = "tv-remote-event";

  private static ReactApplicationContext sharedReactContext;

  private final ReactApplicationContext reactContext;
  UtilsEvent(ReactApplicationContext reactContext) {
    this.reactContext = reactContext;
    sharedReactContext = reactContext;
  }

  public void sendEvent(String eventName, @Nullable WritableMap params) {
    reactContext
      .getJSModule(DeviceEventManagerModule.RCTDeviceEventEmitter.class)
      .emit(eventName, params);
  }

  public static void sendTVRemoteEvent(String eventType, int eventKeyAction, int repeatCount, int keyCode) {
    if (sharedReactContext == null || !sharedReactContext.hasActiveCatalystInstance()) return;

    WritableMap params = Arguments.createMap();
    params.putString("eventType", eventType);
    params.putInt("eventKeyAction", eventKeyAction);
    params.putInt("repeatCount", repeatCount);
    params.putInt("keyCode", keyCode);

    sharedReactContext
      .getJSModule(DeviceEventManagerModule.RCTDeviceEventEmitter.class)
      .emit(TV_REMOTE_EVENT, params);
  }
}
