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

  /** 未指定端口时使用。 */
  private static final int DEFAULT_PORT = 9527;
  /** 请求端口被占用时，向后顺延尝试的端口个数（9527 / 9528 / ...）。 */
  private static final int PORT_RETRY_COUNT = 5;

  private LanImportServer(int port) {
    super(port);
  }

  /**
   * 实例是否真的绑定成功并在监听。
   *
   * NanoHTTPD 在 bind 失败时不会清空 myServerSocket，而未绑定的 ServerSocket 其
   * getLocalPort() 返回 -1，所以「端口 > 0」就是「确实在监听」。
   */
  private boolean isListening() {
    return getListeningPort() > 0;
  }

  /**
   * 启动局域网服务；若已有实例在监听则复用，并且【无论复用与否都刷新 listener】。
   *
   * 旧实现有三个问题，合起来会让用户看到「按了『手机扫码导入』没反应」，而且只能重启 App 恢复：
   *   1. {@code if (instance != null) return;} —— 提前返回时不会刷新 listener，
   *      留下「服务活着、监听者却是旧组件」的半死状态；
   *   2. 先把 instance 赋成新对象、再调 start()：一旦 bind 抛异常，instance 已经被污染成
   *      非 null 的半死实例，之后每次 start() 都在第 1 步静默早退，
   *      getServerPort() 恒为 -1（二维码会编出 http://ip:-1），而报错只写进 JS 侧看不见的提示；
   *   3. 端口被占用时没有任何兜底。
   *
   * @return 实际监听的端口
   */
  public static synchronized int start(int port, Context context, LanListener lanListener) throws java.io.IOException {
    appContext = context.getApplicationContext();
    // 无论复用还是新建都要刷新：原生服务是单例，JS 侧的组件却会被反复创建/销毁
    listener = lanListener;

    if (instance != null && instance.isListening()) {
      return instance.getListeningPort();
    }
    if (instance != null) {
      // 上一轮留下的、并没有真正在监听的实例：清掉，别让它把后续所有 start() 都堵死
      try {
        instance.stop();
      } catch (Throwable ignored) {
        // 已经坏掉了，停不掉也无所谓，下面会直接丢弃引用
      }
      instance = null;
    }

    int requested = port > 0 ? port : DEFAULT_PORT;
    java.io.IOException lastError = null;
    for (int i = 0; i < PORT_RETRY_COUNT; i++) {
      int candidate = requested + i;
      LanImportServer server = new LanImportServer(candidate);
      try {
        server.start(NanoHTTPD.SOCKET_READ_TIMEOUT, false);
      } catch (java.io.IOException e) {
        lastError = e;
        try {
          server.stop();
        } catch (Throwable ignored) {
          // 没起来，清理失败可以忽略
        }
        continue;
      }
      pageHtml = null;
      instance = server;
      return candidate;
    }

    // 所有候选端口都失败：明确失败，让 JS 侧弹提示，而不是留一个坏实例装成成功
    instance = null;
    throw lastError != null ? lastError : new java.io.IOException("LAN import server could not bind any port");
  }

  public static synchronized void stopServer() {
    if (instance != null) {
      try {
        instance.stop();
      } catch (Throwable ignored) {
        // 停服异常也要把静态状态清干净，否则下次 start() 会被堵住
      }
      instance = null;
    }
    // 服务都停了就不该再有投递；下次 start() 会重新设置 listener
    listener = null;
  }

  public static synchronized int getServerPort() {
    if (instance == null || !instance.isListening()) return 0;
    return instance.getListeningPort();
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

  /**
   * NanoHTTPD 2.3.1 按 Content-Type 里的 charset 解码 POST body（页面端所有请求都带 charset=utf-8，
   * 中文可无损通过）。之前这里曾「一律按 ISO-8859-1 重解码」，反而把已正确的中文破坏成一串问号
   * （晴天 → ??，每个汉字变一个问号）。现在只在字符串里出现 Latin-1 高位区字符（U+0080–U+00FF，
   * UTF-8 被误解成 ISO-8859-1 的典型乱码特征）且重解码不产生替换符时才修复。
   */
  private static String ensureUtf8(String payload) {
    if (payload == null || payload.isEmpty()) return payload;
    boolean hasLatin1High = false;
    for (int i = 0; i < payload.length(); i++) {
      char c = payload.charAt(i);
      // 已含 Latin-1 之外的多字节字符（如中文）→ 解码本来就正确，不动。
      // 这一步很关键：否则「é + 中文」这类混合内容会被误判成乱码，
      // 重解码时中文被 ISO-8859-1 编码成 '?' 反而被毁掉（09-19 审查发现）
      if (c >= 0x100) return payload;
      if (c >= 0x80) hasLatin1High = true;
    }
    if (!hasLatin1High) return payload;
    try {
      String repaired = new String(payload.getBytes("ISO-8859-1"), StandardCharsets.UTF_8);
      if (repaired.indexOf('\uFFFD') < 0) return repaired;
    } catch (Exception ignored) {
      // 保持原样
    }
    return payload;
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
      payload = ensureUtf8(payload);
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
      if ("/api/songlist-remove".equals(uri)) {
        // 歌单删除：纯 JSON（{ids:[...]}），不需要解压展开
        notify("songlist-remove", payload);
        return json("{\"ok\":true,\"message\":\"已提交\"}");
      }
    }
    return newFixedLengthResponse(Response.Status.NOT_FOUND, "text/plain", "Not Found");
  }
}
