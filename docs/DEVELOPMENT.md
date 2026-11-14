# ZL_Musicos 开发文档

> 本文档是本仓库的**权威开发指南**。目标：任何人（或任何 AI 会话）只靠本文档 + 代码就能安全开发，不依赖某个人对代码的私人记忆。改了架构必须同步更新本文档——这是硬性纪律。

---

## 1. 项目是什么

安卓 **电视** 音乐播放器（TV 优先，手机界面代码保留但基本不维护），支持洛雪生态的 JS 用户音源（user API）。

谱系：`lyswhut/lx-music-mobile`（上游）→ `pdone/lx-music-mobile-lulu`（TV 魔改）→ **kaosZL/ZL_Musicos**（本仓库，深度 TV 化）。
**与上游已不可合并**（分叉过大），上游的安全修复需定向 cherry-pick，平时不追上游。

技术栈：React Native **0.73** + TypeScript + react-native-navigation（RNN，**非** react-navigation）+ MobX 式自研 store + NanoHTTPD（安卓原生局域网服务）。

## 2. 目录地图

```text
src/
  components/TV/           TV 组件体系（最重要的目录）
    tvFocusManager.ts        ★ 自研焦点引擎（见 §4）
    Focusable.tsx            焦点包装组件（Pressable + 引擎注册，见 §5）
    TVRemoteFocusController  每屏挂载的按键→引擎接线（方向键/select/menu）
    TVDialog.tsx             全局弹窗（打开时接管按键，setTVDialogActive）
    TVAppleScaffold          屏幕脚手架：模糊背景 + 渐变压暗（TVFadeOverlay）
    TVKeepScreenOn           播放保活（跟随 isPlay 持有 FLAG_KEEP_SCREEN_ON）
  screens/TV/               各 TV 屏幕
    Player.tsx               播放页（最复杂，见 §6）
    update.ts                应用内更新（检查/下载/安装，见 §9）
    updateUrlChain.ts        下载镜像候选链（纯逻辑，有单测）
    lyricFilter.ts           歌词行展示过滤（纯逻辑，有单测）
    Settings.tsx             设置页（音源管理/音质/更新）
  core/
    player/player.ts         播放核心（切歌/取链/换源）
    music/utils.ts           取链与音质降档（getPlayQuality 等，见 §7）
    userApi                  user API 脚本装载
  navigation/                RNN 屏幕注册（registerScreens）与跳转（navigation.ts）
  store/                     各状态域（setting/player/list/userApi）
android/
  .../MainActivity.java       ★ 遥控按键全量截获（见 §3）
  .../utils/UtilsModule.java  原生桥（debugLog/取主色/安装 APK 等）
  .../utils/LanImportServer.java  局域网手机导入服务（NanoHTTPD，见 §8）
  app/src/main/assets/
    lan_input.html             手机扫码打开的导入页
    script/                    预置音源脚本 + user-api-preload.js（脚本运行时）
publish/tv-version.json     ★ 应用内更新清单（CI 自动维护，旧版本 App 读它）
__tests__/                  零依赖单测（esbuild 打包 + node 跑，npm test）
.github/workflows/build-apk.yml  CI（类型零错误门禁 + 单测 + 出包 + 上传 Release + 维护更新清单）
```

## 3. 按键链路（全仓库最重要的一张图）

```text
遥控器按键
  → MainActivity.dispatchKeyEvent()
      非返回键（方向/OK/菜单/媒体键）→ UtilsEvent.sendTVRemoteEvent → JS onTVRemoteEvent 事件
        ├─ TVRemoteFocusController（每屏一个）: 方向键→moveTVFocus, select→按引擎聚焦目标
        ├─ 各屏 useTVRemoteActions（key UP 触发）：媒体键/呼出控制栏等
        └─ 播放页直控层（见 §6.3）
  → 返回键【不走上面链路！】→ Android 原生 onBackPressed → RN BackHandler（逆序调用，
     后注册先问）→ 无人消费则 RNN pop
```

**关键不变量**：Android 原生焦点系统（FocusFinder）完全不在链路里。所有焦点决策都在 JS 引擎。这是历史决策（09-06 原生优先重构翻车回滚的教训），**不要试图拆掉 JS 引擎**。

## 4. 自研焦点引擎（tvFocusManager.ts）

全局单例。注册表 `targets: Map<id, FocusTarget>`，每个 FocusTarget 带 rect（懒测量）。

**移动决策顺序**（moveTVFocus）：
1. 测量当前 scope 内全部目标（measureInWindow 异步回调）
2. 活动目标无 rect（未挂载）→ 回退 preferred 目标
3. **显式 nextFocus\*（上下左右）优先**——`getExplicitNextTarget` 按 findNodeHandle 匹配
4. 空间打分 `getCandidateScore`：主轴距离 ×1000 + 副轴距离 ×1（主轴 = 移动方向轴）
5. **同排优先 `getSameBandCandidates`**：左右移动时只在「与活动目标有垂直重叠」的候选里选（上下移动则看水平重叠）；同排无候选才回退全局打分。防「顶部导航条抢走内容区焦点」类 bug（有回归单测）
6. **合并排队**：测量在途时新按键只记最新方向，当前移动完成后接着执行（长按连发不丢步，Issue #11 修复）

**焦点仲裁**：`setActiveTarget` 是唯一改 `activeTargetId` 的入口（显式移动/程序聚焦共用）；`focusPreferredTVTarget` 只兜底不抢活焦点（防 FlatList 滚动抢焦点，09-22 教训）；preferred 调度统一走 `scheduleTVInitialFocus`（260ms 去抖）。

**scope**：每屏一个 componentId 作为 scope（TVRemoteFocusController appear 时 setActiveTVFocusScope），弹窗目标注册在同 scope 靠「最后注册的 preferred 优先」压过页面目标。

## 5. Focusable 组件（引擎与 UI 的粘合）

三处焦点表示需要保持同步，这是全仓库 bug 密度最高的地方：

| 表示 | 谁写 | 谁读 |
|---|---|---|
| 引擎 activeTargetId | setActiveTarget | TVRemoteFocusController（按键分发） |
| React `focused` state | subscribeTVTargetFocusState（引擎路径）/ 原生 onFocus（Pressable） | 高亮样式 |
| 原生视图焦点 | requestNativeFocus（ref.focus()） | 安卓无障碍/滚动 |

**铁律（v1.9.23 双触发修复的教训）**：计数类副作用（如播放页 controlFocusCountRef）必须挂 `onTVFocusChange`——它双路触发（引擎/原生）且内部 focusedRef 去重；**不要**只挂原生 onFocus（部分电视引擎送焦点时原生事件不回调）。

Pressable 的 TV 焦点属性（hasTVPreferredFocus/nextFocus*）在 RN 0.73 类型里缺失但运行时有效，组件内整体断言（`tvFocusProps as unknown as PressableProps`）。

## 6. 播放页（Player.tsx + 模块群）

v1.9.25 收口重构后，Player.tsx 只做视图组合，交互逻辑分驻四个模块（都有单测）：

```text
usePlayerControlDeck.ts   控制舱 hook：控制栏显隐/焦点计数/按键路由/返回键拦截(z=100)/
                           切歌锁存/全屏歌词/内容再平衡——文件头有「按键语义总表」（唯一权威）
playerDirectControlGate.ts 直控门控纯函数（三个历史 bug 的守卫规则，回归测试覆盖）
playerLayout.ts           版式纯数学（跨屏幕恒定版式，metrics 注入）
playerLyrics.ts           歌词窗口纯逻辑（已唱2+当前+未唱2，杂行过滤）
```

### 6.1 控制栏显隐（v1.9.24 规则，老板拍板）
- **不自动隐藏**：呼出后常驻
- 呼出：上/下/菜单键（revealControls + focusPlayAfterReveal 轮询重试聚焦播放键，500ms 上限）
- 收起：**返回键**（BackHandler 挂载时注册一次 + showControlsRef 读状态；消费一次返回，再按才退页）
- 进播放页默认无控制栏

### 6.2 左右键语义（v1.9.21 规则）
- 控制栏**隐藏**（听歌模式）= 直控切歌（松键触发；长按 repeat 只记账防误触）
- 控制栏**呼出**（操作模式）= 焦点导航：歌词区按左/右跳焦上一首/下一首按钮，切歌必须 OK 确认
- 歌词区 Focusable 四向 nextFocus 动态化：隐藏态全自指（引擎让路），呼出态左右指按钮

### 6.3 直控层门控（防双触发，全部条件都要过）
```ts
if (controlFocusCountRef.current > 0) return      // 焦点在控制按钮上
if (isSeekKey && showControls) return             // 呼出态左右键不直控
if (Date.now() - controlFocusTimeRef.current < 500) return  // Issue #9 空窗守卫
```

### 6.4 其他要点
- 切歌锁存 pendingPlay：取新歌链接期间 isPlay 闪断，播放键图标维持播放态（8s 兜底）
- 专辑主色背景：原生 getDominantColor（HSV 分桶压暗）→ 双层 View + opacity 动画（**必须 useNativeDriver: true**，false 会逐帧卡 JS 线程丢按键）
- 排障：返回/呼出链路有 debugLog 埋点，手机页「运行日志」实时可见

## 7. 音源与音质

- 音源 = 洛雪 user API JS 脚本（预置野草/聚合 + 手机扫码导入）。脚本经 user-api-preload.js 沙箱运行，通过 `global.lx` 协议通信；初始化时**申报**各平台支持的 actions 与 qualitys（`global.lx.qualityList`）
- 音质设置键 `player.playQuality`（128k/320k/flac/flac24bit），设置页「播放」面板写入
- 取链链路：`getMusicUrl` → `getPlayQuality`（按歌逐首降档：目标档起沿 flac24bit→flac→320k 找「歌有 && 源支持」，否则 128k）→ `handleGetOnlineMusicUrl`（**同源降档双保险**：取链失败先降档重试再换源）→ 失败换源 `getOnlineOtherSourceMusicUrl`
- URL 有按 (musicInfo, quality) 维度的本地缓存（getStoreMusicUrl）

## 8. 局域网手机互联（LanImportServer）

NanoHTTPD，随机端口 + token 鉴权，`/api/` 前缀即 API。手机扫码（设置页出居中二维码）打开 `lan_input.html`：导入音源脚本/链接、歌单链接/清单/洛雪文件、歌单改名删除导出、**运行日志**（`/api/logs` 3s 轮询，环 200 条，logLock 同步）。JS 侧入口 `UtilsModule.debugLog(message)`。

## 9. 应用内更新（零后端）

- 清单：`publish/tv-version.json`（**CI 在 master 发版后自动重写**，带 ghfast.top 镜像前缀，提交带 [skip ci] 防循环）
- 检查链：镜像前缀 ×2 → raw 直连 → jsDelivr → GitHub API releases/latest（`checkTVUpdate`）
- 下载链：`buildDownloadCandidates`（清单 URL → GitHub 原链 → 各镜像前缀，纯逻辑有单测）依次尝试
- 新版本（v1.9.23+）：Home 启动 6s 静默检查（24h 一次，storage 键 tv_update_last_check_at），发现新版 TVDialog 引导去设置页
- 旧版本（v1.9.13+）：设置页手动检查读同一清单——**清单内容即对旧版本的控制面**

## 10. 构建与发版

### 10.1 分支与版本纪律
- `dev` 开发、`master` 发版；老板实测通过才合 master（--no-ff merge + tag vX.Y.Z + Release）
- 测试包必 bump versionName + versionCode + 首页右下角角标（`vX.Y.Z · N`）；正式版移除角标（buildMark 块 + 样式一起删）
- commit message 必须与 diff --stat 逐文件对账；**message 里任何位置出现 `[skip ci]` 字样都会静默跳过 CI**
- APK 全靠 GitHub Actions（本机无 SDK 别试本地构建）；artifact zip ≥15MB 在服务器上下载必截断，分发走 Release

### 10.2 CI 流水线（build-apk.yml）
1. Typecheck（**零错误门禁**，2026-11-14 类型债清零后升级）
2. 单测（npm test，纯逻辑）
3. Metro bundle + gradle assembleRelease（R8 混淆 debug 签名）
4. dev/master：artifact 上传；master：5 架构 APK 传 Release + 自动重写更新清单
- 遗留：lulu 分支触发与 apk-lulu 渠道已废弃删除，勿复活

### 10.3 发版 checklist
1. dev 角标移除 commit → push
2. merge master --no-ff（message 带「老板实测通过」）→ tag → push（推送断连用 代理 7897/直连 交替重试）
3. API 建 Release（notes 中文，make_latest=true）→ 等 CI 绿 → 确认 5 APK + 清单已自动更新
4. 旧 Release 只保留最近 3 个（滚动删）

## 11. 血泪墙（改代码前必读）

| 坑 | 教训 |
|---|---|
| v1.9.16 黑屏 | Metro 不查类型，漏 import 实机才炸 → CI 类型门禁 |
| `[skip ci]` 字样 | message 说明文字里出现也会跳过整个 push 的构建 |
| 切片模拟渐变 | 半透明切片堆叠在电视大屏显形为「条条」→ 必须 512 级渐变 PNG |
| 不透明染色层 | 会把压暗层的矩形边界显形为「方块墙」→ 染色层必须半透明 |
| useNativeDriver:false 颜色动画 | 逐帧卡 JS 线程，遥控按键全在 JS 线程 → 丢按键 |
| 原生 onFocus 不可靠 | 部分电视引擎送焦点时原生事件不回调 → 副作用挂 onTVFocusChange |
| BackHandler 重注册 | 依赖状态的监听器反复注销/重注册有时序边界 → 注册一次 + ref |
| NaN/同引用 setState | React Object.is 短路；活数组要先快照 |
| 图标缓存 | 换图标后启动器缓存顽固，需断电重启电视 |
| workflow 凭证守护 | 写 .yml 用编辑工具（不用 bash 拼接），防 `${{ }}` 被改写 |

## 12. 修改守则

1. **动焦点系统前先跑 `npm test`**（引擎行为有回归单测），改完再跑
2. 新设置键：`src/config/defaultSetting.ts` 加默认值 + `src/types/app_setting.d.ts` 加类型
3. 新屏幕：registerScreens 注册 + navigation.ts 加 push 函数 + createTVTabs 挂 tab
4. 新原生方法：UtilsModule + src/utils/nativeModules/utils.ts 双侧同步；耗时操作放线程 + runOnUiThread
5. 视觉类 bug 定位：不要相信截图目测，用 PIL 逐行/逐列测像素色阶找边界
6. 改完自检三连：esbuild 单文件语法 → `npx tsc --noEmit`（零错误）→ `npm test`
7. **改了本文档描述的任何机制，必须同步更新本文档**（本条是本文档存在的原因）

---

*最后更新：2026-11-14（v1.9.24 开发周期）· 由类型清零/测试基建/文档化专项写入*
