package cn.toside.music.mobile.utils;

import android.content.Context;

import java.io.ByteArrayOutputStream;
import java.io.InputStream;
import java.nio.charset.StandardCharsets;
import java.util.HashMap;
import java.util.Map;

import fi.iki.elonen.NanoHTTPD;

/**
 * 局域网音源导入服务：电视端起一个小型 HTTP 服务，
 * 手机扫二维码后在同一局域网内打开页面，粘贴音源链接/脚本推送到电视。
 */
public class LanImportServer extends NanoHTTPD {
  public interface LanListener {
    void onLanAction(String action, String payload);
  }

  private static volatile LanImportServer instance;
  private static volatile String sourcesJson = "{\"sources\":[]}";
  private static volatile String songlistsJson = "{\"lists\":[]}";
  private static volatile LanListener listener;
  private static volatile byte[] pageHtml;
  private static volatile Context appContext;

  private LanImportServer(int port) {
    super(port);
  }

  public static synchronized void start(int port, Context context, LanListener lanListener) throws java.io.IOException {
    if (instance != null) return;
    appContext = context.getApplicationContext();
    listener = lanListener;
    pageHtml = null;
    instance = new LanImportServer(port);
    instance.start(NanoHTTPD.SOCKET_READ_TIMEOUT, false);
  }

  public static synchronized void stopServer() {
    if (instance != null) {
      instance.stop();
      instance = null;
    }
  }

  public static synchronized int getServerPort() {
    return instance == null ? 0 : instance.getListeningPort();
  }

  public static void setSources(String json) {
    sourcesJson = (json == null || json.isEmpty()) ? "{\"sources\":[]}" : json;
  }

  /**
   * 电视端「我的歌单」快照，供手机页读取后改名。
   * 歌单名多为中文，必须由 JS 侧以 UTF-8 序列化后原样保存。
   */
  public static void setSonglists(String json) {
    songlistsJson = (json == null || json.isEmpty()) ? "{\"lists\":[]}" : json;
  }

  private static byte[] getPage() {
    if (pageHtml == null) {
      try {
        InputStream in = appContext.getAssets().open("lan_input.html");
        ByteArrayOutputStream out = new ByteArrayOutputStream();
        byte[] buf = new byte[4096];
        int n;
        while ((n = in.read(buf)) > 0) out.write(buf, 0, n);
        in.close();
        pageHtml = out.toByteArray();
      } catch (Exception e) {
        pageHtml = "<html><body><h1>ZL-Music</h1><p>page load failed</p></body></html>".getBytes(StandardCharsets.UTF_8);
      }
    }
    return pageHtml;
  }

  private static Response json(String json) {
    // 必须显式声明 charset：NanoHTTPD 在 MIME 未带 charset 时按 US-ASCII 编码字符串，
    // 中文歌单名 / 中文提示会被替换成「?」，所以这里统一用 UTF-8。
    return newFixedLengthResponse(Response.Status.OK, "application/json; charset=utf-8", json);
  }

  private static void notify(String action, String payload) {
    LanListener lanListener = listener;
    if (lanListener != null) lanListener.onLanAction(action, payload == null ? "" : payload);
  }

  @Override
  public Response serve(IHTTPSession session) {
    Method method = session.getMethod();
    String uri = session.getUri();
    if (Method.GET.equals(method) && ("/".equals(uri) || "/index.html".equals(uri))) {
      return newFixedLengthResponse(Response.Status.OK, "text/html; charset=utf-8", new String(getPage(), StandardCharsets.UTF_8));
    }
    if (Method.GET.equals(method) && "/api/sources".equals(uri)) {
      return json(sourcesJson);
    }
    // 手机页读取电视上「我的歌单」列表，用于改名
    if (Method.GET.equals(method) && "/api/songlists".equals(uri)) {
      return json(songlistsJson);
    }
    if (Method.POST.equals(method)) {
      Map<String, String> body = new HashMap<>();
      try {
        session.parseBody(body);
      } catch (Exception e) {
        return json("{\"ok\":false,\"message\":\"请求解析失败\"}");
      }
      String payload = body.get("postData");
      if ("/api/import".equals(uri)) {
        notify("import", payload);
        return json("{\"ok\":true,\"message\":\"已提交，电视正在导入\"}");
      }
      if ("/api/remove".equals(uri)) {
        notify("remove", payload);
        return json("{\"ok\":true,\"message\":\"已提交\"}");
      }
      if ("/api/activate".equals(uri)) {
        notify("activate", payload);
        return json("{\"ok\":true,\"message\":\"已提交\"}");
      }
      if ("/api/songlist".equals(uri)) {
        // 歌单导入：载荷里可能带 zip/crx/gzip 的 base64，先展开成文本再交给 JS 解析
        notify("songlist", SonglistImportPayload.expand(payload));
        return json("{\"ok\":true,\"message\":\"已提交\"}");
      }
      if ("/api/songlist-rename".equals(uri)) {
        // 歌单改名：纯 JSON（{renames:[{id,name}]}），不需要解压展开
        notify("songlist-rename", payload);
        return json("{\"ok\":true,\"message\":\"已提交\"}");
      }
    }
    return newFixedLengthResponse(Response.Status.NOT_FOUND, "text/plain", "Not Found");
  }
}
