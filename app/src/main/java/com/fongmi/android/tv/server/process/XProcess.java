package com.fongmi.android.tv.server.process;

import android.text.TextUtils;

import com.fongmi.android.tv.App;
import com.google.gson.JsonArray;
import com.google.gson.JsonObject;
import com.github.catvod.utils.Asset;

import java.io.BufferedReader;
import java.io.File;
import java.io.FileInputStream;
import java.io.FileOutputStream;
import java.io.InputStream;
import java.io.InputStreamReader;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.List;
import java.util.Map;

import fi.iki.elonen.NanoHTTPD.IHTTPSession;
import fi.iki.elonen.NanoHTTPD.Response;

/**
 * 小景扩展：网盘 Cookie 管理（/cookie）+ 背景主题（/wallpaper）
 * Cookie 写入 4 目录 × 2 文件名（兼容 Guard 系 jar 的两套读取约定）
 * 背景支持 6 款内置预设（assets/bg/*.jpg）+ 自定义上传
 */
public class XProcess implements Process {

    private static final Map<String, String> COOKIE_FILES = new HashMap<String, String>() {{
        put("baidu", "baidu.txt");
        put("quark", "quark_cookie.txt");
        put("uc", "uc_cookie.txt");
        put("tianyi", "cloud189.txt");
        put("pan123", "cloud123.txt");
        put("bili", "bili_cookie.txt");
        put("aliyun", ".aliyun");
        put("diy", "diy_cookie.txt");
    }};

    private static final Map<String, String> WALLPAPERS = new HashMap<String, String>() {{
        put("starry", "深空星河");
        put("aurora", "极光之夜");
        put("nebula", "暗紫星云");
        put("midnight", "极简暗黑");
        put("grid", "科技网格");
        put("dawn", "曙光蓝调");
    }};

    @Override
    public boolean isRequest(IHTTPSession session, String url) {
        return url.startsWith("/cookie") || url.startsWith("/wallpaper");
    }

    @Override
    public Response doResponse(IHTTPSession session, String url, Map<String, String> files) {
        Map<String, String> params = session.getParms();
        if (url.startsWith("/cookie")) {
            return session.getMethod() == fi.iki.elonen.NanoHTTPD.Method.POST ? cookiePost(params.get("type"), params.get("content")) : cookieGet(params);
        }
        if (url.startsWith("/wallpaper/preset/")) return wallpaperPreset(url.substring("/wallpaper/preset/".length()));
        if (session.getMethod() == fi.iki.elonen.NanoHTTPD.Method.POST) return wallpaperPost(params, files);
        return wallpaperGet();
    }

    /* ═══════════ Cookie ═══════════ */

    private List<File> cookieDirs() {
        List<File> dirs = new ArrayList<>();
        try {
            File ext = new File(android.os.Environment.getExternalStorageDirectory().getAbsolutePath(), "TVBox");
            dirs.add(ext);
        } catch (Throwable ignored) {
        }
        dirs.add(new File("/sdcard/TVBox"));
        try {
            File ext = App.get().getExternalFilesDir(null);
            if (ext != null) dirs.add(new File(ext, "TVBox"));
        } catch (Throwable ignored) {
        }
        dirs.add(new File(App.get().getFilesDir(), "TVBox"));
        // 兼容 CatVodSpider-maintainable 系（TV 目录约定）
        dirs.add(new File(App.get().getFilesDir(), "TV"));
        return dirs;
    }

    private Response cookieGet(Map<String, String> params) {
        String type = params == null ? null : params.get("type");
        String fn = type == null ? null : COOKIE_FILES.get(type);
        JsonObject info = new JsonObject();
        info.addProperty("type", type == null ? "" : type);
        if (fn == null) {
            info.addProperty("content", "");
            return ok(info.toString());
        }
        info.addProperty("file", fn);
        String found = "";
        for (File dir : cookieDirs()) {
            // 优先读点前缀版本（PanBaidu 播放读取的约定文件），回退普通名
            File f = new File(dir, "." + fn);
            if (!f.exists()) f = new File(dir, fn);
            if (!f.exists()) continue;
            String text = readFile(f);
            if (!text.isEmpty()) {
                found = text;
                break;
            }
        }
        info.addProperty("content", found);
        return ok(info.toString());
    }

    private Response cookiePost(String type, String content) {
        String fn = type == null ? null : COOKIE_FILES.get(type);
        if (fn == null) return fi.iki.elonen.NanoHTTPD.newFixedLengthResponse(Response.Status.OK, "text/plain", "unknown type");
        String trimmed = content == null ? "" : content.trim();
        try {
            int written = 0;
            for (File dir : cookieDirs()) {
                try {
                    if (!dir.exists()) dir.mkdirs();
                    // Guard 系 jar 两套约定：配置中心读 baidu.txt，PanBaidu 播放读 .baidu.txt（自动加点前缀），两份都写
                    String[] names = {fn, "." + fn};
                    for (String name : names) {
                        File f = new File(dir, name);
                        if (trimmed.isEmpty()) {
                            if (f.exists()) f.delete();
                        } else {
                            FileOutputStream fos = new FileOutputStream(f, false);
                            fos.write(trimmed.getBytes("UTF-8"));
                            fos.close();
                            written++;
                        }
                    }
                } catch (Throwable ignored) {
                }
            }
            JsonObject obj = new JsonObject();
            obj.addProperty("code", 0);
            obj.addProperty("written", written);
            return ok(obj.toString());
        } catch (Throwable th) {
            return error(th.getMessage());
        }
    }

    private String readFile(File f) {
        StringBuilder sb = new StringBuilder();
        try {
            BufferedReader br = new BufferedReader(new InputStreamReader(new FileInputStream(f), "UTF-8"));
            String line;
            while ((line = br.readLine()) != null) {
                if (sb.length() > 0) sb.append('\n');
                sb.append(line);
            }
            br.close();
        } catch (Throwable ignored) {
        }
        return sb.toString();
    }

    /* ═══════════ Wallpaper ═══════════ */

    private File wallpaperFile() {
        return new File(App.get().getFilesDir().getAbsolutePath() + "/wp");
    }

    private File wallpaperFile() {
        return new File(App.get().getFilesDir(), "wallpaper_cache");
    }

    private Response wallpaperGet() {
        try {
            JsonObject obj = new JsonObject();
            obj.addProperty("custom", wallpaperFile().exists());
            JsonArray arr = new JsonArray();
            for (Map.Entry<String, String> e : WALLPAPERS.entrySet()) {
                JsonObject p = new JsonObject();
                p.addProperty("id", e.getKey());
                p.addProperty("name", e.getValue());
                arr.add(p);
            }
            obj.add("presets", arr);
            return ok(obj.toString());
        } catch (Throwable th) {
            return ok("{\"custom\":false,\"presets\":[]}");
        }
    }

    private Response wallpaperPreset(String name) {
        if (name == null || !name.matches("[a-zA-Z0-9_.]+")) return notFound();
        String key = name.endsWith(".jpg") ? name.substring(0, name.length() - 4) : name;
        if (!WALLPAPERS.containsKey(key)) return notFound();
        try {
            InputStream is = Asset.open("bg/" + key + ".jpg");
            byte[] data = readAll(is);
            return fi.iki.elonen.NanoHTTPD.newFixedLengthResponse(Response.Status.OK, "image/jpeg", new java.io.ByteArrayInputStream(data), data.length);
        } catch (Throwable th) {
            return notFound();
        }
    }

    private Response wallpaperPost(Map<String, String> params, Map<String, String> files) {
        try {
            String action = params == null ? null : params.get("action");
            if ("reset".equals(action)) {
                applyWallpaper(null);
                return okText("OK");
            }
            String preset = params == null ? null : params.get("preset");
            if (preset != null && WALLPAPERS.containsKey(preset)) {
                applyWallpaper(Asset.open("bg/" + preset + ".jpg"));
                return okText("OK");
            }
            if (files != null) {
                for (String k : files.keySet()) {
                    if (k.startsWith("files-")) {
                        File tmp = new File(files.get(k));
                        if (tmp.exists()) {
                            applyWallpaper(new FileInputStream(tmp));
                            tmp.delete();
                        }
                        return okText("OK");
                    }
                }
            }
            return okText("no-op");
        } catch (Throwable th) {
            return error(th.getMessage());
        }
    }

    /**
     * 对接基座 CustomWallView 壁纸系统：
     * 写 filesDir/wallpaper_cache（自定义图片缓存），Setting 置为非内置图片模式，
     * 再通过 ConfigEvent.wall() 通知所有 Activity 即时刷新（JetStreamWallView 监听）。
     */
    private void applyWallpaper(InputStream is) {
        try {
            File wp = new File(App.get().getFilesDir(), "wallpaper_cache");
            if (is == null) {
                if (wp.exists()) wp.delete();
            } else {
                FileOutputStream fos = new FileOutputStream(wp, false);
                fos.write(readAll(is));
                fos.close();
                com.fongmi.android.tv.setting.Setting.putWall(0);
                com.fongmi.android.tv.setting.Setting.putWallType(0);
            }
            // leanback 端确保壁纸层可见（JetStreamWallpaper 在 leanback 变体，反射调用避免 main 模块依赖）
            try {
                Class.forName("com.fongmi.android.tv.ui.theme.JetStreamWallpaper")
                        .getMethod("setVisible", boolean.class).invoke(null, is != null);
            } catch (Throwable ignored) {
            }
            App.post(() -> com.fongmi.android.tv.event.ConfigEvent.wall());
        } catch (Throwable ignored) {
        }
    }

    /* ═══════════ Utils ═══════════ */

    private byte[] readAll(InputStream is) throws Exception {
        java.io.ByteArrayOutputStream bos = new java.io.ByteArrayOutputStream();
        byte[] buf = new byte[8192];
        int n;
        while ((n = is.read(buf)) > 0) bos.write(buf, 0, n);
        is.close();
        return bos.toByteArray();
    }

    private Response ok(String json) {
        return fi.iki.elonen.NanoHTTPD.newFixedLengthResponse(Response.Status.OK, "application/json", json);
    }

    private Response okText(String text) {
        return fi.iki.elonen.NanoHTTPD.newFixedLengthResponse(Response.Status.OK, "text/plain", text);
    }

    private Response notFound() {
        return fi.iki.elonen.NanoHTTPD.newFixedLengthResponse(Response.Status.NOT_FOUND, "text/plain", "not found");
    }

    private Response error(String msg) {
        return fi.iki.elonen.NanoHTTPD.newFixedLengthResponse(Response.Status.INTERNAL_ERROR, "text/plain", TextUtils.isEmpty(msg) ? "error" : msg);
    }
}
