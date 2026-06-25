# ZL-Music TV

基于 [lx-music-mobile 1.8.4](https://github.com/lyswhut/lx-music-mobile) 二次开发的 Android TV 音乐播放器，TV 端 UI 采用 Apple TV Music / tvOS 风格高仿（深色沉浸背景、货架式卡片、焦点放大、毛玻璃面板）。

> 本项目不内置任何音源，仅作为学习用途的聚合播放前端；不商用、不分发版权素材。请自行遵守当地法律法规。

## 功能特性

- **首页**：大 Hero 横幅、今日推荐、推荐歌单货架横滑。
- **排行榜**：热歌榜等榜单列表，点击进入榜单详情页。
- **搜索**：顶部搜索框 + 电视键盘 + 热门热词，支持多音源切换（酷我 / 酷狗 / QQ音乐 / 网易云 / 咪咕 / 用户 API），右侧实时展示搜索结果。
- **播放页**：大封面 + 模糊背景 + 歌词流，底部自动隐藏的播放控制条（播放/暂停、上一首、下一首、随机、单曲循环、列表循环、切源）。OK 键暂停/播放，左右键上/下一首。
- **设置**：API 设置、音源切换、播放模式。
- **遥控器适配**：方向键焦点导航、返回键正常、焦点居中滚动。

## 目录结构

```
src/
├─ screens/TV/        # TV 端页面：Home / Search / Player / Detail / History / Settings / Queue
├─ components/TV/     # TV 端组件：TVAppleScaffold / TVTopTabs / TVShelf / TVPosterCard
│                     #            TVMusicRow / TVGlassPanel / Focusable / TVText ...
├─ theme/tv.ts        # TV 设计 token（深色配色、圆角、焦点缩放）
└─ navigation/        # TV 导航注册（pushTVPlayerScreen 等）
scripts/
├─ tv-build.cjs       # 打包 APK
├─ tv-install.cjs     # 安装到设备
└─ tv-launch.cjs      # 启动应用
```

## 环境要求

- Node.js 20
- JDK 17
- Android SDK（API 29 / Android 10 为目标）
- Python（NDK 构建依赖）

## 安装依赖

```bash
npm install
```

## 构建 APK

```bash
npm run tv:assemble        # 等价于 node scripts/tv-build.cjs
```

产物路径：

```
android/app/build/outputs/apk/debug/lx-music-mobile-v1.8.4-x86.apk      # 模拟器(夜神/x86)
android/app/build/outputs/apk/debug/lx-music-mobile-v1.8.4-arm64-v8a.apk # 真机(64位)
android/app/build/outputs/apk/debug/lx-music-mobile-v1.8.4-universal.apk # 通用
```

## 安装到夜神模拟器调试

应用包名：`cn.toside.music.mobile`，主 Activity：`cn.toside.music.mobile.MainActivity`。

```bash
# 1. 连接夜神（默认端口 62001）
"D:\Program Files\Nox\bin\nox_adb.exe" connect 127.0.0.1:62001

# 2. 安装
"D:\Program Files\Nox\bin\nox_adb.exe" -s 127.0.0.1:62001 install -r android\app\build\outputs\apk\debug\lx-music-mobile-v1.8.4-x86.apk

# 3. 启动
"D:\Program Files\Nox\bin\nox_adb.exe" -s 127.0.0.1:62001 shell am start -n cn.toside.music.mobile/.MainActivity
```

或使用脚本：

```bash
npm run tv:deploy    # 安装并启动（自动选择已连接设备）
```

## 查看日志

```bash
# 只看应用日志与错误
"D:\Program Files\Nox\bin\nox_adb.exe" -s 127.0.0.1:62001 logcat *:E ReactNativeJS:V ReactNative:V
```

## 代码检查

```bash
npm run tv:lint
# 或只检查 TV 范围
npx eslint src/screens/TV src/components/TV --ext .tsx,.ts
```

## TV 焦点开发约定

- 使用 `src/components/TV/Focusable.tsx` 包裹可聚焦元素，通过 `hasTVPreferredFocus`、`nextFocusUp/Down/Left/Right` 控制焦点流转。
- 列表行统一用 `TVMusicRow`，已处理 `width: 100%` 撑满与无封面时的标题可见性。
- 原生按键映射在 `android/app/src/main/java/cn/toside/music/mobile/MainActivity.java`：`select(OK/ENTER)`、`left/right/up/down`、`playPause/next/previous/menu`。

## 致谢

- [lx-music-mobile](https://github.com/lyswhut/lx-music-mobile) — 原始移动端项目。
- Apple TV Music / tvOS — TV 端视觉与交互参考（仅复刻布局/比例/动效，不使用官方品牌资产）。

## License

沿用原项目协议，详见 LICENSE。
