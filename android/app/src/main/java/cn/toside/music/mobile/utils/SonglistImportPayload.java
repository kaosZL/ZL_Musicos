package cn.toside.music.mobile.utils;

import android.util.Base64;

import org.json.JSONObject;

import java.io.ByteArrayInputStream;
import java.io.ByteArrayOutputStream;
import java.io.Closeable;
import java.io.InputStream;
import java.nio.charset.Charset;
import java.nio.charset.StandardCharsets;
import java.util.Locale;
import java.util.zip.GZIPInputStream;
import java.util.zip.ZipEntry;
import java.util.zip.ZipInputStream;

/**
 * Songlist import payload pre-processor.
 *
 * The phone page posts a JSON object to {@code /api/songlist}. Besides plain text it may carry a
 * file: text files are sent as-is in {@code fileText} while binary containers (zip / crx / gzip)
 * are sent as base64 in {@code fileBase64}.
 *
 * This class expands such a payload on the native side: containers are opened with the Java
 * standard library and every text-ish entry inside is concatenated into a single text block, which
 * is then handed to the JS layer for the actual playlist parsing.
 *
 * Why the native side: decompression needs a real zip/gzip implementation. Doing it here keeps the
 * project at zero new npm dependencies, and {@code package.json} is one of the files upstream
 * touches most often, so leaving it untouched keeps future upstream syncs conflict-free.
 */
public class SonglistImportPayload {

  /** Upper bound of archive entries inspected, so a weird file cannot stall the server thread. */
  private static final int MAX_ARCHIVE_ENTRIES = 40;
  /** Upper bound of bytes read from a single archive entry. */
  private static final int MAX_ENTRY_BYTES = 2 * 1024 * 1024;
  /** Upper bound of bytes collected in total for one import request. */
  private static final int MAX_TOTAL_BYTES = 6 * 1024 * 1024;
  /** How far into the file we look for the ZIP magic (a CRX2 header can be a few KB long). */
  private static final int ZIP_SCAN_BYTES = 64 * 1024;
  /** Nested containers (zip in gzip in ...) are unwrapped up to this depth. */
  private static final int MAX_DEPTH = 3;

  private SonglistImportPayload() {
  }

  /**
   * Expands a raw {@code /api/songlist} payload into a payload whose {@code text} field holds all
   * text collected from the request (pasted text + uploaded file content).
   *
   * Returns the original payload unchanged when it is not a JSON object, so an unexpected request
   * body degrades gracefully instead of failing the whole import.
   */
  public static String expand(String rawPayload) {
    if (rawPayload == null || rawPayload.isEmpty()) return rawPayload;

    JSONObject input;
    try {
      input = new JSONObject(rawPayload);
    } catch (Exception e) {
      return rawPayload;
    }

    StringBuilder collected = new StringBuilder();
    appendBlock(collected, input.optString("text", ""));
    appendBlock(collected, input.optString("fileText", ""));

    byte[] fileBytes = decodeBase64(input.optString("fileBase64", ""));
    if (fileBytes != null && fileBytes.length > 0) {
      appendBlock(collected, bytesToText(fileBytes, 0, new Budget()));
    }

    try {
      JSONObject output = new JSONObject();
      output.put("text", collected.toString());
      output.put("listName", input.optString("listName", ""));
      output.put("fileName", input.optString("fileName", ""));
      return output.toString();
    } catch (Exception e) {
      return rawPayload;
    }
  }

  /** Per-request budget, so parallel requests cannot exhaust memory collectively. */
  private static final class Budget {
    int entries;
    int bytes;
  }

  /**
   * Recursively turns raw bytes into text: gzip is inflated, zip/crx is unpacked and each text
   * entry inside is processed again, anything else is decoded as text when it looks like text.
   */
  private static String bytesToText(byte[] data, int depth, Budget budget) {
    if (data == null || data.length == 0) return "";
    if (depth > MAX_DEPTH || budget.bytes >= MAX_TOTAL_BYTES) return "";

    if (isGzip(data)) {
      byte[] inflated = inflateGzip(data, MAX_TOTAL_BYTES - budget.bytes);
      if (inflated.length == 0) return "";
      budget.bytes += inflated.length;
      return bytesToText(inflated, depth + 1, budget);
    }

    int zipStart = findZipStart(data);
    if (zipStart >= 0) return readArchive(data, zipStart, depth, budget);

    if (!looksLikeText(data)) return "";
    budget.bytes += data.length;
    return decodeText(data);
  }

  private static String readArchive(byte[] data, int start, int depth, Budget budget) {
    StringBuilder sb = new StringBuilder();
    ZipInputStream zin = null;
    try {
      zin = new ZipInputStream(new ByteArrayInputStream(data, start, data.length - start));
      byte[] buf = new byte[8192];
      ZipEntry entry;
      while ((entry = zin.getNextEntry()) != null) {
        if (budget.entries >= MAX_ARCHIVE_ENTRIES || budget.bytes >= MAX_TOTAL_BYTES) break;
        if (entry.isDirectory() || !isInterestingEntry(entry.getName())) continue;
        budget.entries++;

        ByteArrayOutputStream out = new ByteArrayOutputStream();
        int read;
        int entryBytes = 0;
        while ((read = zin.read(buf)) > 0) {
          out.write(buf, 0, read);
          entryBytes += read;
          if (entryBytes >= MAX_ENTRY_BYTES) break;
        }
        if (out.size() == 0) continue;
        appendBlock(sb, bytesToText(out.toByteArray(), depth + 1, budget));
      }
    } catch (Throwable ignored) {
      // A damaged archive should still yield whatever was parsed before the failure.
    } finally {
      closeQuietly(zin);
    }
    return sb.toString();
  }

  private static boolean isInterestingEntry(String name) {
    if (name == null) return false;
    String lower = name.toLowerCase(Locale.ROOT);
    if (lower.contains("__macosx/")) return false;
    return lower.endsWith(".json")
        || lower.endsWith(".txt")
        || lower.endsWith(".lxmc")
        || lower.endsWith(".csv")
        || lower.endsWith(".bin")
        || lower.endsWith(".m3u")
        || lower.endsWith(".m3u8")
        || lower.endsWith(".lst");
  }

  private static boolean isGzip(byte[] data) {
    return data.length > 2 && (data[0] & 0xff) == 0x1f && (data[1] & 0xff) == 0x8b;
  }

  private static int findZipStart(byte[] data) {
    int limit = Math.min(data.length - 3, ZIP_SCAN_BYTES);
    for (int i = 0; i < limit; i++) {
      if ((data[i] & 0xff) == 0x50 && (data[i + 1] & 0xff) == 0x4b
          && (data[i + 2] & 0xff) == 0x03 && (data[i + 3] & 0xff) == 0x04) {
        return i;
      }
    }
    return -1;
  }

  private static byte[] inflateGzip(byte[] data, int limit) {
    InputStream in = null;
    try {
      in = new GZIPInputStream(new ByteArrayInputStream(data));
      return readAll(in, limit);
    } catch (Throwable e) {
      return new byte[0];
    } finally {
      closeQuietly(in);
    }
  }

  private static byte[] readAll(InputStream in, int limit) {
    ByteArrayOutputStream out = new ByteArrayOutputStream();
    byte[] buf = new byte[8192];
    int read;
    int total = 0;
    try {
      while ((read = in.read(buf)) > 0) {
        out.write(buf, 0, read);
        total += read;
        if (total >= limit) break;
      }
    } catch (Throwable ignored) {
      // Return what was read so far.
    }
    return out.toByteArray();
  }

  /** Crude binary probe: NUL bytes or too many control characters mean "not text". */
  private static boolean looksLikeText(byte[] data) {
    int limit = Math.min(data.length, 4096);
    if (limit == 0) return false;
    int suspicious = 0;
    for (int i = 0; i < limit; i++) {
      int b = data[i] & 0xff;
      if (b == 0) return false;
      if (b < 0x09 || (b > 0x0d && b < 0x20)) suspicious++;
    }
    return suspicious * 10 <= limit;
  }

  private static String decodeText(byte[] data) {
    String text = new String(data, StandardCharsets.UTF_8);
    if (countReplacementChars(text) > 2) {
      try {
        String fallback = new String(data, Charset.forName("GBK"));
        if (countReplacementChars(fallback) <= 2) return fallback;
      } catch (Throwable ignored) {
        // GBK is not available on this runtime, keep the UTF-8 result.
      }
    }
    return text;
  }

  private static int countReplacementChars(String text) {
    int count = 0;
    for (int i = 0; i < text.length(); i++) {
      if (text.charAt(i) == '\uFFFD') count++;
    }
    return count;
  }

  private static byte[] decodeBase64(String value) {
    if (value == null || value.isEmpty()) return null;
    String data = value.trim();
    int comma = data.indexOf(',');
    if (data.startsWith("data:") && comma > 0) data = data.substring(comma + 1);
    data = data.trim();
    if (data.isEmpty()) return null;
    try {
      return Base64.decode(data, Base64.DEFAULT);
    } catch (Throwable e) {
      return null;
    }
  }

  private static void appendBlock(StringBuilder sb, String block) {
    if (block == null) return;
    String trimmed = block.trim();
    if (trimmed.isEmpty()) return;
    if (sb.length() > 0) sb.append('\n');
    sb.append(trimmed);
  }

  private static void closeQuietly(Closeable closeable) {
    if (closeable == null) return;
    try {
      closeable.close();
    } catch (Throwable ignored) {
      // Nothing useful to do.
    }
  }
}
