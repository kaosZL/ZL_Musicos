package cn.toside.music.mobile.utils;

import cn.toside.music.mobile.BuildConfig;

import android.annotation.SuppressLint;
import android.app.Activity;
import android.content.BroadcastReceiver;
import android.content.Context;
import android.content.Intent;
import android.content.IntentFilter;
import android.graphics.Rect;
import android.net.Uri;
import android.net.wifi.WifiInfo;
import android.net.wifi.WifiManager;
import android.app.UiModeManager;
import android.os.Build;
import android.util.Log;
import android.view.Window;
import android.view.WindowManager;
import android.view.View;

import androidx.core.app.LocaleManagerCompat;
import androidx.core.content.FileProvider;
import androidx.core.os.LocaleListCompat;

import com.facebook.react.bridge.Arguments;
import com.facebook.react.bridge.Promise;
import com.facebook.react.bridge.ReactApplicationContext;
import com.facebook.react.bridge.ReactContextBaseJavaModule;
import com.facebook.react.bridge.ReactMethod;
import com.facebook.react.bridge.WritableArray;
import com.facebook.react.bridge.WritableMap;
import com.facebook.react.bridge.WritableNativeArray;
import com.facebook.react.uimanager.NativeViewHierarchyManager;
import com.facebook.react.uimanager.UIBlock;
import com.facebook.react.uimanager.UIManagerModule;

import java.io.File;
import java.util.Locale;
import java.util.Objects;

import android.graphics.Bitmap;
import android.graphics.Color;
import android.util.Base64;
import java.io.ByteArrayOutputStream;
import com.google.zxing.BarcodeFormat;
import com.google.zxing.common.BitMatrix;
import com.google.zxing.qrcode.QRCodeWriter;

public class UtilsModule extends ReactContextBaseJavaModule {
  private final ReactApplicationContext reactContext;

  private int listenerCount = 0;

  UtilsEvent utilsEvent;

  UtilsModule(ReactApplicationContext reactContext) {
    super(reactContext);
    this.reactContext = reactContext;
    utilsEvent = new UtilsEvent(reactContext);
    registerScreenBroadcastReceiver();
  }

  @Override
  public String getName() {
    return "UtilsModule";
  }

  /**
   * 取图片主色（播放页动态背景用）：下载图片 → 缩到 32px 采样 → 按亮度分桶取最饱和桶的均值。
   * 返回 "#RRGGBB"；任何失败 resolve null（调用方兜底用默认色）。
   */
  @ReactMethod
  public void getDominantColor(String imageUrl, Promise promise) {
    new Thread(() -> {
      try {
        java.net.URL url = new java.net.URL(imageUrl);
        java.net.HttpURLConnection conn = (java.net.HttpURLConnection) url.openConnection();
        conn.setConnectTimeout(6000);
        conn.setReadTimeout(8000);
        conn.setRequestProperty("User-Agent", "Mozilla/5.0");
        int code = conn.getResponseCode();
        if (code != 200) { promise.resolve(null); return; }
        java.io.ByteArrayOutputStream bos = new java.io.ByteArrayOutputStream();
        java.io.InputStream in = conn.getInputStream();
        byte[] buf = new byte[8192];
        int n;
        while ((n = in.read(buf)) > 0) bos.write(buf, 0, n);
        in.close();
        android.graphics.Bitmap full = android.graphics.BitmapFactory.decodeByteArray(bos.toByteArray(), 0, bos.size());
        if (full == null) { promise.resolve(null); return; }
        android.graphics.Bitmap bmp = android.graphics.Bitmap.createScaledBitmap(full, 32, 32, true);
        if (bmp != full) full.recycle();
        // HSV 分桶：跳过近黑/近白，取「饱和度×数量」加权最高的桶
        int[] best = {0, 0, 0};
        long bestScore = -1;
        java.util.Map<Integer, int[]> buckets = new java.util.HashMap<>();
        float[] hsv = new float[3];
        for (int y = 0; y < 32; y++) {
          for (int x = 0; x < 32; x++) {
            int c = bmp.getPixel(x, y);
            android.graphics.Color.colorToHSV(c, hsv);
            if (hsv[2] < 0.18f || hsv[2] > 0.95f || hsv[1] < 0.15f) continue;
            int key = (int) (hueBucket(hsv[0]) * 100);
            int[] agg = buckets.get(key);
            if (agg == null) { agg = new int[]{0, 0, 0, 0}; buckets.put(key, agg); }
            agg[0] += android.graphics.Color.red(c);
            agg[1] += android.graphics.Color.green(c);
            agg[2] += android.graphics.Color.blue(c);
            agg[3] += 1;
          }
        }
        bmp.recycle();
        for (int[] agg : buckets.values()) {
          long score = (long) agg[3] * (agg[3] > 4 ? 2 : 1);
          if (score > bestScore) { bestScore = score; best = agg; }
        }
        if (best[3] == 0) { promise.resolve(null); return; }
        int r = best[0] / best[3], g = best[1] / best[3], b = best[2] / best[3];
        // 压暗到适合做背景的亮度（V 上限 0.45）
        android.graphics.Color.RGBToHSV(r, g, b, hsv);
        hsv[1] = Math.min(hsv[1] * 0.85f, 0.75f);
        hsv[2] = Math.min(hsv[2], 0.45f);
        int out = android.graphics.Color.HSVtoColor(hsv);
        promise.resolve(String.format("#%06X", 0xFFFFFF & out));
      } catch (Exception e) {
        promise.resolve(null);
      }
    }).start();
  }

  private static int hueBucket(float hue) {
    // 12° 一桶共 30 桶；hue ∈ [0,360)
    return (int) (hue / 12f) % 30;
  }

  @ReactMethod
  public void isTVDevice(Promise promise) {
    try {
      if (BuildConfig.IS_TV_BUILD) {
        promise.resolve(true);
        return;
      }
      UiModeManager uiModeManager = (UiModeManager) reactContext.getSystemService(Context.UI_MODE_SERVICE);
      boolean isTV = uiModeManager != null && uiModeManager.getCurrentModeType() == android.content.res.Configuration.UI_MODE_TYPE_TELEVISION;
      promise.resolve(isTV);
    } catch (Exception e) {
      promise.resolve(false);
    }
  }

  @ReactMethod
  public void requestTVFocus(int reactTag) {
    UIManagerModule uiManager = reactContext.getNativeModule(UIManagerModule.class);
    if (uiManager == null) return;

    uiManager.addUIBlock(new UIBlock() {
      @Override
      public void execute(NativeViewHierarchyManager nativeViewHierarchyManager) {
        try {
          View view = nativeViewHierarchyManager.resolveView(reactTag);
          view.setFocusable(true);
          view.setFocusableInTouchMode(true);
          view.requestFocus();
        } catch (Exception e) {
          Log.w("Utils", "requestTVFocus failed: " + reactTag, e);
        }
      }
    });
  }


  @ReactMethod
  public void addListener(String eventName) {
    if (listenerCount == 0) {
      // Set up any upstream listeners or background tasks as necessary
    }

    listenerCount += 1;
  }

  @ReactMethod
  public void removeListeners(Integer count) {
    listenerCount -= count;
    if (listenerCount == 0) {
      // Remove upstream listeners, stop unnecessary background tasks
    }
  }

  private void registerScreenBroadcastReceiver() {
    final IntentFilter theFilter = new IntentFilter();
    /** System Defined Broadcast */
    theFilter.addAction(Intent.ACTION_SCREEN_ON);
    theFilter.addAction(Intent.ACTION_SCREEN_OFF);

    BroadcastReceiver screenOnOffReceiver = new BroadcastReceiver() {
      @Override
      public void onReceive(Context context, Intent intent) {
        String strAction = intent.getAction();

        WritableMap params = Arguments.createMap();

        switch (Objects.requireNonNull(strAction)) {
          case Intent.ACTION_SCREEN_OFF:

            params.putString("state", "OFF");
            utilsEvent.sendEvent(utilsEvent.SCREEN_STATE, params);
            break;
          case Intent.ACTION_SCREEN_ON:
            params.putString("state", "ON");
            utilsEvent.sendEvent(utilsEvent.SCREEN_STATE, params);
            break;
        }
      }
    };

    reactContext.registerReceiver(screenOnOffReceiver, theFilter);
  }

  @ReactMethod
  public void exitApp() {
    // https://github.com/wumke/react-native-exit-app/blob/master/android/src/main/java/com/github/wumke/RNExitApp/RNExitAppModule.java
    // android.os.Process.killProcess(android.os.Process.myPid());

    // https://stackoverflow.com/questions/6330200/how-to-quit-android-application-programmatically
    Activity currentActivity = reactContext.getCurrentActivity();
    Log.d("Utils", "Exit app...");
    if (currentActivity == null) {
      Log.d("Utils", "killProcess");
      android.os.Process.killProcess(android.os.Process.myPid());
    } else {
      currentActivity.finishAndRemoveTask();
      System.exit(0);
    }
  }

  @ReactMethod
  public void getSupportedAbis(Promise promise) {
    // https://github.com/react-native-device-info/react-native-device-info/blob/ff8f672cb08fa39a887567d6e23e2f08778e8340/android/src/main/java/com/learnium/RNDeviceInfo/RNDeviceModule.java#L877
    WritableArray array = new WritableNativeArray();
    for (String abi : Build.SUPPORTED_ABIS) {
      array.pushString(abi);
    }
    promise.resolve(array);
  }

  @ReactMethod
  public void installApk(String filePath, String fileProviderAuthority, Promise promise) {
    // https://github.com/mikehardy/react-native-update-apk/blob/master/android/src/main/java/net/mikehardy/rnupdateapk/RNUpdateAPK.java
    File file = new File(filePath);
    if (!file.exists()) {
      Log.e("Utils", "installApk: file doe snot exist '" + filePath + "'");
      // FIXME this should take a promise and fail it
      promise.reject("Utils", "installApk: file doe snot exist '" + filePath + "'");
      return;
    }

    if (Build.VERSION.SDK_INT >= 24) {
      // API24 and up has a package installer that can handle FileProvider content:// URIs
      Uri contentUri;
      try {
        contentUri = FileProvider.getUriForFile(getReactApplicationContext(), fileProviderAuthority, file);
      } catch (Exception e) {
        // FIXME should be a Promise.reject really
        Log.e("Utils", "installApk exception with authority name '" + fileProviderAuthority + "'", e);
        promise.reject("Utils", "installApk exception with authority name '" + fileProviderAuthority + "'");
        return;
        // throw e;
      }
      Intent installApp = new Intent(Intent.ACTION_INSTALL_PACKAGE);
      installApp.addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION);
      installApp.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
      installApp.setData(contentUri);
      installApp.putExtra(Intent.EXTRA_INSTALLER_PACKAGE_NAME, reactContext.getApplicationInfo().packageName);
      reactContext.startActivity(installApp);
      promise.resolve(null);
    } else {
      // Old APIs do not handle content:// URIs, so use an old file:// style
      String cmd = "chmod 777 " + file;
      try {
        Runtime.getRuntime().exec(cmd);
      } catch (Exception e) {
        // e.printStackTrace();
        Log.e("Utils", "installApk exception : " + e.getMessage(), e);
        promise.reject("Utils", e.getMessage());
      }
      Intent intent = new Intent(Intent.ACTION_VIEW);
      intent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
      intent.setDataAndType(Uri.parse("file://" + file), "application/vnd.android.package-archive");
      reactContext.startActivity(intent);
      promise.resolve(null);
    }
  }

  @ReactMethod
  public void screenkeepAwake() {
    // https://github.com/corbt/react-native-keep-awake/blob/master/android/src/main/java/com/corbt/keepawake/KCKeepAwake.java
    final Activity activity = getCurrentActivity();

    if (activity != null) {
      activity.runOnUiThread(() -> {
        activity.getWindow().addFlags(WindowManager.LayoutParams.FLAG_KEEP_SCREEN_ON);
      });
    }
  }

  @ReactMethod
  public void screenUnkeepAwake() {
    // https://github.com/corbt/react-native-keep-awake/blob/master/android/src/main/java/com/corbt/keepawake/KCKeepAwake.java
    final Activity activity = getCurrentActivity();

    if (activity != null) {
      activity.runOnUiThread(() -> {
        activity.getWindow().clearFlags(WindowManager.LayoutParams.FLAG_KEEP_SCREEN_ON);
      });
    }
  }

  /**
   Gets the device's WiFi interface IP address
   @return device's WiFi IP if connected to WiFi, else '0.0.0.0'
   */
  @ReactMethod
  public void getWIFIIPV4Address(final Promise promise) throws Exception {
    // https://github.com/pusherman/react-native-network-info/blob/master/android/src/main/java/com/pusherman/networkinfo/RNNetworkInfo.java
    WifiManager wifi = (WifiManager) reactContext.getApplicationContext().getSystemService(Context.WIFI_SERVICE);
    new Thread(new Runnable() {
      public void run() {
        try {
          WifiInfo info = wifi.getConnectionInfo();
          int ipAddress = info.getIpAddress();
          @SuppressLint("DefaultLocale") String stringip = String.format("%d.%d.%d.%d", (ipAddress & 0xff), (ipAddress >> 8 & 0xff),
            (ipAddress >> 16 & 0xff), (ipAddress >> 24 & 0xff));
          promise.resolve(stringip);
        }catch (Exception e) {
          promise.resolve(null);
        }
      }
    }).start();
  }

  // https://stackoverflow.com/a/26117646
  @ReactMethod
  public void getDeviceName(final Promise promise) {
    String manufacturer = Build.MANUFACTURER;
    String model = Build.MODEL;
    if (model.startsWith(manufacturer)) {
      promise.resolve(capitalize(model));
    } else {
      promise.resolve(capitalize(manufacturer) + " " + model);
    }
  }
  private String capitalize(String s) {
    if (s == null || s.isEmpty()) {
      return "";
    }
    char first = s.charAt(0);
    if (Character.isUpperCase(first)) {
      return s;
    } else {
      return Character.toUpperCase(first) + s.substring(1);
    }
  }

  @ReactMethod
  public void isNotificationsEnabled(final Promise promise) {
    new Thread(() -> {
      boolean enabled = NotificationPermissionUtil.isNotificationsEnabled(
        reactContext.getApplicationContext());
      promise.resolve(enabled);
    }).start();
  }

  @ReactMethod
  public void openNotificationPermissionActivity(Promise promise) {
    new Thread(() -> {
      boolean result = NotificationPermissionUtil.openNotificationPermissionActivity(
        reactContext.getApplicationContext());
      promise.resolve(result);
    }).start();
  }

  @ReactMethod
  public void shareText(String shareTitle, String title, String text) {
    Intent shareIntent = new Intent(Intent.ACTION_SEND);
    shareIntent.setType("text/plain");
    shareIntent.putExtra(Intent.EXTRA_TEXT,text);
    shareIntent.putExtra(Intent.EXTRA_SUBJECT, title);
    Objects.requireNonNull(reactContext.getCurrentActivity()).startActivity(Intent.createChooser(shareIntent, shareTitle));
  }

  // https://stackoverflow.com/questions/73463341/in-per-app-language-how-to-get-app-locale-in-api-33-if-system-locale-is-diffe
  @ReactMethod
  public void getSystemLocales(Promise promise) {
    Locale locale = null;
    if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU) {
      LocaleListCompat list = LocaleManagerCompat.getSystemLocales(reactContext);
      if (!list.isEmpty()) {
        locale = list.get(0);
      } else {
        promise.resolve(null);
        return;
      }
    } else {
      locale = Locale.getDefault();
    }
    if (locale == null) {
      promise.resolve("");
      return;
    }

    // Format to values like zh_cn / en_us
    String language = locale.getLanguage(); // zh, en
    String country = locale.getCountry();   // CN, US
    String localeStr;

    if (!country.isEmpty()) {
      localeStr = language.toLowerCase() + "_" + country.toLowerCase();
    } else {
      localeStr = language.toLowerCase();
    }

    promise.resolve(localeStr);
  }

  // https://github.com/Anthonyzou/react-native-full-screen/blob/master/android/src/main/java/com/rn/full/screen/FullScreen.java
  //  @ReactMethod
  //  public void onFullScreen() {
  //    UiThreadUtil.runOnUiThread(() -> {
  //      Activity currentActivity = reactContext.getCurrentActivity();
  //      if (currentActivity == null) return;
  //      currentActivity.getWindow().getDecorView().setSystemUiVisibility(
  //        View.SYSTEM_UI_FLAG_LAYOUT_STABLE
  //          | View.SYSTEM_UI_FLAG_LAYOUT_HIDE_NAVIGATION
  //          | View.SYSTEM_UI_FLAG_LAYOUT_FULLSCREEN
  //          | View.SYSTEM_UI_FLAG_HIDE_NAVIGATION // hide nav bar
  //          | View.SYSTEM_UI_FLAG_FULLSCREEN // hide status bar
  //          | View.SYSTEM_UI_FLAG_IMMERSIVE
  //      );
  //    });
  //  }
  //  @ReactMethod
  //  public void offFullScreen() {
  //    UiThreadUtil.runOnUiThread(() -> {
  //      Activity currentActivity = reactContext.getCurrentActivity();
  //      if (currentActivity == null) return;
  //      currentActivity.getWindow().getDecorView().setSystemUiVisibility(
  //        View.SYSTEM_UI_FLAG_LAYOUT_STABLE
  //          | View.SYSTEM_UI_FLAG_LAYOUT_HIDE_NAVIGATION
  //          | View.SYSTEM_UI_FLAG_LAYOUT_FULLSCREEN
  //      );
  //    });
  //  }

  @ReactMethod
  public void getWindowSize(Promise promise) {
    WritableMap params = Arguments.createMap();

    Activity currentActivity = reactContext.getCurrentActivity();
    if (currentActivity == null) {
      params.putInt("width", 0);
      params.putInt("height", 0);
      promise.resolve(params);
      return;
    }
    // 鑾峰彇褰撳墠搴旂敤鍙敤鍖哄煙澶у皬
    Window window = currentActivity.getWindow();
    Rect rect = new Rect();
    window.getDecorView().getWindowVisibleDisplayFrame(rect);
    // View decorView = window.getDecorView();
    // int width = decorView.getMeasuredWidth();
    // int height = decorView.getMeasuredHeight();
    params.putInt("width", rect.width());
    params.putInt("height", rect.height());
    promise.resolve(params);
  }

  @ReactMethod
  public void isIgnoringBatteryOptimization(Promise promise) {
    new Thread(() -> {
      boolean result = BatteryOptimizationUtil.isIgnoringBatteryOptimization(
        reactContext.getApplicationContext(),
        reactContext.getPackageName()
      );
      promise.resolve(result);
    }).start();
  }

  @ReactMethod
  public void requestIgnoreBatteryOptimization(Promise promise) {
    new Thread(() -> {
      try {
        boolean result = BatteryOptimizationUtil.requestIgnoreBatteryOptimization(
          reactContext.getApplicationContext(),
          reactContext.getPackageName()
        );
        promise.resolve(result);
      } catch (Exception e) {
        promise.reject("ERROR", e);
      }
    }).start();
  }

  @ReactMethod
  public void startLanImportServer(int port, Promise promise) {
    try {
      // start() 现在返回【实际监听】的端口（请求端口被占用时会向后顺延），
      // 并且失败时会把内部状态复位后抛异常 —— 不会再出现「半死实例把后续启动全堵死」。
      int actualPort = LanImportServer.start(port > 0 ? port : 9527, reactContext.getApplicationContext(), (action, payload) ->
        utilsEvent.sendLanSourceEvent(action, payload));
      if (actualPort <= 0) {
        promise.reject("LAN_SERVER_ERROR", "局域网服务没能监听任何端口，请重试");
        return;
      }
      String ip = getLanIp();
      if (ip == null || ip.isEmpty() || "0.0.0.0".equals(ip)) {
        // 没有可用网络时 getLanIp 兜底返回 0.0.0.0：不拒掉的话二维码会编出一个死链接，
        // 用户扫码毫无反应还没有任何提示
        LanImportServer.stopServer();
        promise.reject("LAN_SERVER_ERROR", "电视当前没有可用的网络连接，请检查 WiFi 后重试");
        return;
      }
      WritableMap params = Arguments.createMap();
      params.putString("ip", ip);
      params.putInt("port", actualPort);
      params.putString("token", LanImportServer.getAuthToken());
      promise.resolve(params);
    } catch (Exception e) {
      promise.reject("LAN_SERVER_ERROR", e);
    }
  }

  @ReactMethod
  public void stopLanImportServer(Promise promise) {
    LanImportServer.stopServer();
    promise.resolve(null);
  }

  @ReactMethod
  public void pushLanSources(String sourcesJson, Promise promise) {
    LanImportServer.setSources(sourcesJson);
    promise.resolve(null);
  }

  @ReactMethod
  public void pushLanSonglists(String songlistsJson, Promise promise) {
    LanImportServer.setSonglists(songlistsJson);
    promise.resolve(null);
  }

  @ReactMethod
  public void pushLanSonglistExport(String json, Promise promise) {
    LanImportServer.setSonglistExport(json);
    promise.resolve(null);
  }

  @ReactMethod
  public void generateQRCodeBase64(String text, int size, Promise promise) {
    try {
      BitMatrix matrix = new QRCodeWriter()
        .encode(text, BarcodeFormat.QR_CODE, size, size);
      Bitmap bmp = Bitmap.createBitmap(size, size, Bitmap.Config.RGB_565);
      int[] pixels = new int[size * size];
      for (int x = 0; x < size; x++) {
        for (int y = 0; y < size; y++) {
          pixels[y * size + x] = matrix.get(x, y) ? Color.BLACK : Color.WHITE;
        }
      }
      bmp.setPixels(pixels, 0, size, 0, 0, size, size);
      ByteArrayOutputStream out = new ByteArrayOutputStream();
      bmp.compress(Bitmap.CompressFormat.PNG, 100, out);
      bmp.recycle();
      promise.resolve("data:image/png;base64," + Base64.encodeToString(out.toByteArray(), Base64.NO_WRAP));
    } catch (Exception e) {
      promise.reject("QR_ERROR", e);
    }
  }

  private String getLanIp() {
    try {
      WifiManager wifiManager = (WifiManager) reactContext.getApplicationContext().getSystemService(Context.WIFI_SERVICE);
      WifiInfo wifiInfo = wifiManager == null ? null : wifiManager.getConnectionInfo();
      int ip = wifiInfo == null ? 0 : wifiInfo.getIpAddress();
      if (ip != 0) {
        return (ip & 0xff) + "." + ((ip >> 8) & 0xff) + "." + ((ip >> 16) & 0xff) + "." + ((ip >> 24) & 0xff);
      }
    } catch (Exception ignored) {
    }
    try {
      java.util.Enumeration<java.net.NetworkInterface> interfaces = java.net.NetworkInterface.getNetworkInterfaces();
      while (interfaces.hasMoreElements()) {
        java.net.NetworkInterface networkInterface = interfaces.nextElement();
        java.util.Enumeration<java.net.InetAddress> addresses = networkInterface.getInetAddresses();
        while (addresses.hasMoreElements()) {
          java.net.InetAddress address = addresses.nextElement();
          if (!address.isLoopbackAddress() && address instanceof java.net.Inet4Address) {
            return address.getHostAddress();
          }
        }
      }
    } catch (Exception ignored) {
    }
    return "0.0.0.0";
  }
}

