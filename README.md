<img width="100%" src="https://capsule-render.vercel.app/api?type=waving&color=0:111113,100:1F1F23&height=100&section=header" />

<h1 align="center">ZL-Music TV</h1>

<p align="center"><em>电视大屏听歌 · 遥控器优先 · 洛雪生态</em></p>

<div align="center">

![Platform](https://img.shields.io/badge/platform-Android_TV-111113?style=flat-square)
![Built with](https://img.shields.io/badge/React_Native_%2B_TypeScript-111113?style=flat-square)
![License](https://img.shields.io/badge/license-Apache--2.0-111113?style=flat-square)
![Release](https://img.shields.io/github/v/release/kaosZL/ZL_Musicos?style=flat-square)
![Stars](https://img.shields.io/github/stars/kaosZL/ZL_Musicos?style=flat-square)

[![⬇️ Releases 下载](https://img.shields.io/badge/⬇️_Releases_下载-1F6FEB?style=for-the-badge)](https://github.com/kaosZL/ZL_Musicos/releases)
[![⚙️ CI 构建版](https://img.shields.io/badge/⚙️_CI_构建版-6E7681?style=for-the-badge)](https://github.com/kaosZL/ZL_Musicos/actions)

`arm64-v8a` 大多数电视/盒子 · `universal` 不确定就选它 · `x86_64` 模拟器 · [📋 FAQ](FAQ.md) · [📋 更新日志](https://github.com/kaosZL/ZL_Musicos/releases)

</div>

---

## ✨ 核心亮点

**📱 手机扫码导音源** — 电视端出二维码，手机同网扫码粘贴链接即导入，告别遥控器输 URL

**🎮 遥控器优先** — 方向键导航、OK 播放、长按呼出菜单，全程不碰鼠标

**🖥 4K 等比适配** — 1080p 观感基准，任意密度 4K 下比例完全一致，只更清晰

**🔍 拼音搜索联想** — 输入 `zjl`、`qt` 直接联想热门歌手和歌曲，全拼匹配自动纠偏

> ⚠️ 本项目仅用于学习、研究与个人设备体验，不内置任何版权音乐资源，不提供付费分发服务；如有权利问题请联系处理或删除相关内容。

---

## 🖼 界面预览

<table>
  <tr>
    <td width="25%" align="center"><sub><b>首页</b></sub><br/><img src="docs/screenshots/首页.png" alt="首页"/></td>
    <td width="25%" align="center"><sub><b>沉浸模式</b></sub><br/><img src="docs/screenshots/首页2.png" alt="沉浸模式"/></td>
    <td width="25%" align="center"><sub><b>排行榜</b></sub><br/><img src="docs/screenshots/排行榜.png" alt="排行榜"/></td>
    <td width="25%" align="center"><sub><b>搜索</b></sub><br/><img src="docs/screenshots/搜索界面.png" alt="搜索界面"/></td>
  </tr>
  <tr>
    <td width="25%" align="center"><sub><b>播放页</b></sub><br/><img src="docs/screenshots/播放详情页.png" alt="播放详情页"/></td>
    <td width="25%" align="center"><sub><b>播放列表</b></sub><br/><img src="docs/screenshots/播放列表.png" alt="播放列表"/></td>
    <td width="25%" align="center"><sub><b>设置</b></sub><br/><img src="docs/screenshots/设置.png" alt="设置"/></td>
    <td width="25%"></td>
  </tr>
</table>

---

## 🎮 遥控器操作

| 按键 | 行为 |
| --- | --- |
| 方向键 | 移动焦点 |
| OK / Enter | 打开当前项、播放歌曲或触发按钮 |
| **长按 OK**（音源列表） | 呼出音源操作菜单（删除 / 更新提醒） |
| Back | 返回上一页 |
| Play/Pause | 播放页暂停或继续 |
| Previous / Rewind | 播放上一首 |
| Next / Fast Forward | 播放下一首 |
| Menu | 播放页呼出/收起控制条，其他页面无动作 |

---

<details>
<summary><b>🌟 全部特性（点击展开）</b></summary>

- 播放页 Apple Music TV 风格沉浸式布局：左侧封面、右侧歌词、底部进度条、右下角圆形控制。
- 完整音源管理：设置页长按 OK 呼出音源操作菜单，所有音源（用户导入 / 预置 / 内置）均可删除；删除正在使用的音源自动回退聚合音源，当前歌曲播完为止。
- TV 风格统一弹窗：全部弹窗（操作菜单、删除确认、更新提醒、系统提示）使用统一的毛玻璃卡片风格，与整体 UI 一致。
- 切后台自动暂停：TV 端切到后台（Home / 其他应用）自动暂停播放，切回不自动恢复；手机端保持后台播放特性。
- 手机扫码导入详情：设置 → 音源面板 → 「手机扫码导入」，支持粘贴音源脚本链接（如 `https://cdn.jsdelivr.net/gh/pdone/lx-music-source@main/grass/latest.js`）或脚本内容；手机页还支持删除、切换已装音源。
- 拼音词典内置 204 位热门华语歌手 + 221 首经典歌曲，全拼（`zhoujielun`）或首字母（`zjl`、`qt`）即出「猜你想搜」联想标签。
- APK 体积优化：release 混淆构建 + 架构精简，包体积从 180MB 降至约 55MB（-69%）。

</details>

## 🛠 构建与开发

<details>
<summary><b>点击展开</b></summary>

**环境要求**：Node.js 20+ / npm 8.5+ / JDK 17 / Android SDK / Gradle / Android TV、盒子或模拟器

**本地构建**：

```bash
npm install
npm run tv:assemble
```

构建产物位于（v1.8.8，三种架构）：

```text
android/app/build/outputs/apk/release/zl-music-v1.8.8-arm64-v8a.apk
android/app/build/outputs/apk/release/zl-music-v1.8.8-x86_64.apk
android/app/build/outputs/apk/release/zl-music-v1.8.8-universal.apk
```

应用包名：`cn.toside.music.mobile`

**代码检查**：

```bash
npm run tv:lint
```

**ADB 模拟遥控器**：

```bash
npm run tv:remote -- up
npm run tv:remote -- right right ok
npm run tv:remote -- back
adb shell input keyevent 82   # 模拟 Menu 键
adb connect 127.0.0.1:62001
adb -s 127.0.0.1:62001 install -r android/app/build/outputs/apk/release/zl-music-v1.8.8-x86_64.apk
```

**CI 云构建**：每次 push 到 master / dev 自动构建 release APK（R8 混淆 + debug 签名，可直接安装），[Actions](https://github.com/kaosZL/ZL_Musicos/actions) 页面最新成功构建底部 Artifacts 下载。

**目录结构**：

```text
src/
  components/TV/      TV 端基础组件（焦点、卡片、按钮、面板、TVDialog 统一弹窗）
  screens/TV/         TV 首页、排行榜、搜索、设置（扫码导入+音源管理）、播放页、队列页
  config/hotArtists.ts  热门歌手拼音词典（搜索联想）
  config/hotSongs.ts    热门歌曲拼音词典（搜索联想）
  theme/tv.ts         TV 设计 token + 全分辨率等比缩放
android/
  app/src/main/java/.../utils/LanImportServer.java   局域网扫码导入服务（NanoHTTPD）
  app/src/main/assets/lan_input.html                 手机端导入页
  app/src/main/assets/script/                        预置音源脚本
.github/workflows/build-apk.yml    CI 云构建（push 自动出 APK）
docs/screenshots/     README 使用的 TV 截图
```

</details>

## 📦 适配设备

- 全部分辨率等比适配，已在 75 寸 4K Android TV（FF 75S595C Ultra，3840x2160 / 4GB+64GB）实测。
- `arm64-v8a`：大多数 64 位 Android TV / 盒子；`universal`：不确定设备架构时使用；`x86_64`：模拟器。

## 🙌 致谢

- [lx-music-mobile](https://github.com/lyswhut/lx-music-mobile)：原始移动端项目。
- Apple Music TV / tvOS：TV 端布局、比例和沉浸式播放页的视觉参考。
- Codex：本仓库 TV 端开发、调试、打包、截图巡检和 README 整理的主要协作者。

沿用原项目协议，详见 [LICENSE](LICENSE)。

## 🐍 贡献贪吃蛇

<picture>
  <source media="(prefers-color-scheme: dark)" srcset="https://raw.githubusercontent.com/kaosZL/kaosZL/output/github-contribution-grid-snake-dark.svg" />
  <source media="(prefers-color-scheme: light)" srcset="https://raw.githubusercontent.com/kaosZL/kaosZL/output/github-contribution-grid-snake.svg" />
  <img width="100%" alt="contribution snake" src="https://raw.githubusercontent.com/kaosZL/kaosZL/output/github-contribution-grid-snake.svg" />
</picture>

<img width="100%" src="https://capsule-render.vercel.app/api?type=waving&color=0:111113,100:1F1F23&height=60&section=footer" />
