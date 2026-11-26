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
    TVRemoteFocusController  每屏挂载的按键→引擎接线（方向键/select/menu；长按 OK=repeat 连发+550ms 兜底）
    tvBackManager.ts          ★ 返回键唯一分发器（z 级路由，见 §3）
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
    tvLan.ts                 手机互联会话全局单例（见 §8）
    tvPresetUserApi.ts       预置音源加载与失败兜底（见 §7）
    userApiWatchdog.ts       音源初始化 12s 超时看门狗与删源回退纯逻辑（见 §7）
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
遥控器按键（含返回键）
  → MainActivity.dispatchKeyEvent()   TV 构建下全部按键在此截获，不再交给安卓默认处理
      → UtilsEvent.sendTVRemoteEvent → JS onTVRemoteEvent 事件
        ├─ TVRemoteFocusController（每屏一个）: 方向键→moveTVFocus, select→按引擎聚焦目标
        ├─ tvBackManager（eventType='back'）: 返回键唯一分发器，按 z 级问询（见下表）
        ├─ 各屏 useTVRemoteActions（key UP 触发）：媒体键/呼出控制栏等
        └─ 播放页直控层（见 §6.3）
```

**返回键路由（v1.9.24 起，`tvBackManager.ts`）**：从高到低问询，谁先返回 `true` 谁消费；带 `componentId` 的条目只在该屏是活动屏时响应，被压栈的屏自动让路。只在按键**松开**且非长按连发时触发一次。

| z | 注册方 | 行为 |
|---|---|---|
| 300 | TVDialog | 关闭弹窗 |
| 200 | 设置页二维码弹层 | 收起弹层 |
| 100 | 播放页 | 退出全屏歌词 / 收起控制栏 |
| 10 | `useTVNavigationBack(componentId)` | 导航返回 |

无人消费则 `exitApp()`（首页是根屏，不注册导航返回）。**每个可返回的 TV 屏幕都必须调用 `useTVNavigationBack(componentId)`**，否则在该屏按返回会直接退出应用。TV 端**不要**再直接用 RN BackHandler 处理返回键（原生已截获，BackHandler 收不到）；`useBackHandler` 只对非 TV 构建生效，`Home.tsx` 里那条调用是历史遗留。

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
- 收起：**返回键**（`registerTVBack({ z: 100 })` 屏级拦截，状态经 ref 读取；优先级：全屏歌词 > 收起控制栏 > 交给导航返回。消费一次返回，再按才退页）
- 进播放页默认无控制栏

### 6.2 左右键语义（v1.9.21 规则）
- 控制栏**隐藏**（听歌模式）= 直控切歌（松键触发；长按 repeat 只记账防误触）
- 控制栏**呼出**（操作模式）= 焦点导航：歌词区按左/右跳焦上一首/下一首按钮，切歌必须 OK 确认
- 歌词区 Focusable 四向 nextFocus 动态化：隐藏态全自指（引擎让路），呼出态左右指按钮

### 6.3 直控层门控（防双触发与串键，全部条件都要过）
```ts
if (!isActiveScreen) return                       // 播放页压栈非活动屏不响应
if (dialogActive || fullscreenLyrics) return      // 弹窗/全屏歌词期间完全让路
if (controlFocusCountRef.current > 0) return      // 焦点在控制按钮上
if (isSeekKey && showControls) return             // 呼出态左右键不直控
if (Date.now() - controlFocusTimeRef.current < 500) return  // Issue #9 空窗守卫
```
- 全屏歌词期间持有一次 `setTVDialogActive(true)` 让焦点控制器让路；退出需收到进入全屏后的新一次 OK 按下→松开（防止长按进入后松开手指秒退），且 `useTVRemoteActions` 仅放行专用媒体键（`allowMediaDuringOverlay`）

### 6.4 其他要点
- 切歌锁存 pendingPlay：取新歌链接期间 isPlay 闪断，播放键图标维持播放态（8s 兜底）
- 专辑主色背景：原生 getDominantColor（HSV 分桶压暗）→ 双层 View + opacity 动画（**必须 useNativeDriver: true**，false 会逐帧卡 JS 线程丢按键）
- 排障：返回/呼出链路有 debugLog 埋点，手机页「运行日志」实时可见

## 7. 音源与音质

- 音源 = 洛雪 user API JS 脚本（预置野草/聚合 + 手机扫码导入）。脚本经 user-api-preload.js 沙箱运行，通过 `global.lx` 协议通信；初始化时**申报**各平台支持的 actions 与 qualitys（`global.lx.qualityList`）
- 音质设置键 `player.playQuality`（128k/320k/flac/flac24bit），设置页「播放」面板写入
- 取链链路：`getMusicUrl` → `getPlayQuality`（按歌逐首降档：目标档起沿 flac24bit→flac→320k 找「歌有 && 源支持」，否则 128k）→ `handleGetOnlineMusicUrl`（**同源降档双保险**：取链失败先降档重试再换源）→ 失败换源 `getOnlineOtherSourceMusicUrl`
- URL 有按 (musicInfo, quality) 维度的本地缓存（getStoreMusicUrl）
- 电视端启动（`core/init/index.ts`）：`ensureTVPresetUserApi()` **每次启动都加载第一个未被删除的预置源并设为当前音源**（lulu 原版设计，用户自选的音源不跨启动保留）。预置脚本打包在 `assets/script/`，**没有更新机制**，要跟进上游需手动替换文件
- 预置源初始化失败或超时（`status=false` 且 id 为 `tv_preset_*`）时，`tryNextTVPresetUserApiCandidate(failedId)` 自动切到下一个未删除的预置源；只有全部候选耗尽后才将 `global.lx.apiInitPromise` 落定为 `false` 并弹窗提示
- **初始化超时看门狗（v1.9.26，修复 [Issue #17](https://github.com/kaosZL/ZL_Musicos/issues/17)）**：`userApiWatchdog.ts` 在 `loadScript` 时启动 12 秒计时器；脚本异步抛错或未回报 `inited` 事件时，自动销毁卡死 QuickJS 线程、记录 `debugLog` 并走统一失败/预置源兜底链路，不再永久卡「加载中」。设置页与手机页已移除无实际实现的 `id=''` 伪「聚合音源」占位项，删源自动回退到下一个真实可用源

## 8. 局域网手机互联（LanImportServer）

NanoHTTPD，随机端口 + token 鉴权，`/api/` 前缀即 API。手机扫码（设置页出居中二维码 + 网址文本）打开 `lan_input.html`：导入音源脚本/链接、歌单链接/清单/洛雪文件、歌单新建（`/api/songlist-create`）/改名/删除/导出、**运行日志**（`/api/logs` 3s 轮询，环 200 条，logLock 同步）。JS 侧入口 `UtilsModule.debugLog(message)`。

**按键让路计数（v1.9.25）**：`setTVDialogActive` 为计数式获取/释放——TVDialog 与二维码弹层各持一份，任一关闭只释放自己的，焦点控制器在「还有遮挡层」期间持续让路。旧实现是布尔+二维码弹层逐按键重断言，弹窗关闭与重断言之间存在穿透窗口（实测「结果弹窗按 OK 后焦点卡住」）。

**手机互联会话全局单例（v1.9.25）**：`src/core/tvLan.ts`——服务启停、手机事件处理、三类快照（音源/歌单/同步）推送全部与组件生命周期解耦。二维码弹层只是「展示窗口」：收起弹层 / 退出设置页都**不断开**手机页；唯一断开方式 = 设置页长按「手机互联」按钮 → 确认 → `stopTvLanSession()`。设置页只负责生成/展示二维码与会话状态行。手机事件的结果反馈走全局 TVDialog + `app_event.songlistImportResult` 广播（不再依赖设置页局部 state）。

**数据同步（v1.9.25，老板拍板：全部操作集中在手机页）**：复用上游同步客户端（`src/plugins/sync/*`，启动自连见 `src/core/init/sync.ts`）。手机页「数据同步」区 = 唯一控制台：`/api/sync-config`（保存 host/连接码 + 连接或断开）、`/api/sync-status`（轮询状态快照，JS 侧 `pushLanSyncStatus` 推送）。**首次同步方式选择 TV 化**：`src/core/sync.ts` 的 `selectSyncMode` 在 TV 上不弹触屏版 SyncModeModal（遥控器不可操作），改为把 `pendingMode` 写进 sync store（`syncStatusUpdated` 广播）→ 手机页轮询看到后渲染选项 → `/api/sync-mode` 回传 → 走既有 `app_event.selectSyncMode` resolve；**60 秒未选自动 cancel**（防手机页已关、握手悬挂）。同步语义警示（lx 桌面版 issue #1543）：删除操作双向同步（含断开期间，按上次快照合并重连）；合并两选项仅排列顺序不同；覆盖会替换被覆盖方。

**歌单增删归属（v1.9.25 老板拍板）**：新建/删除歌单**只**在手机页做；电视端长按歌单卡片只跳「改名」（屏上键盘）。`lx_list.lxmc` 整包歌单备份（type=playList_v2，data 含试听列表/我的收藏条目）由 `songlistImport.ts` 对号入座：内置条目 `overwriteListMusics` 覆写对应列表、自建条目走 `createList` + **歌曲写入回读校验**（0 首补写一次，仍失败如实上报）——此前内置条目被当自建歌单导入造成数据污染（Issue #15）。

## 9. 应用内更新（零后端）

- 清单：`publish/tv-version.json`（**CI 在 master 发版后自动重写**，带 ghfast.top 镜像前缀，提交带 [skip ci] 防循环）
- 检查链：镜像前缀 ×2 → raw 直连 → jsDelivr → GitHub API releases/latest（`checkTVUpdate`）
- 下载链：`buildDownloadCandidates`（清单 URL → GitHub 原链 → 各镜像前缀，纯逻辑有单测）依次尝试；落盘后经 `validateDownloadedApk` 严格校验 `statusCode === 200` 与包体大小（≥1MB 且不低于清单体积的 90%），失败清理坏包继续换镜像
- Android < 7.0（SDK < 24，如 Android 5.1）：`UtilsModule.installApk` 将 APK 复制到应用外部缓存目录（API 19+ 免存储权限）再拉起 `file://` 安装，绕开私有 `CacheDir`（`0700`）外部安装器无权读取的问题
- 新版本（v1.9.23+）：Home 启动 6s 静默检查（24h 一次，仅检查成功后才写 `tv_update_last_check_at` 冷却时间；若已在设置页点「去更新」不再重复叠推）
- 旧版本（v1.9.13+）：设置页手动检查读同一清单——**清单内容即对旧版本的控制面**

## 10. 构建与发版

### 10.1 分支与版本纪律
- `dev` 开发、`master` 发版；老板实测通过才合 master（--no-ff merge + tag vX.Y.Z + Release）
- 首页右下角的版本标记（`vX.Y.Z · N`）**自动跟随 package.json**（`Home.tsx` 运行时读取 version / versionCode），正式版同样显示，无需手动维护或移除。每轮测试包 bump `versionCode`；开新版本周期时同时 bump `version`
- commit message 必须与 diff --stat 逐文件对账；**message 里任何位置出现 `[skip ci]` 字样都会静默跳过 CI**
- APK 全靠 GitHub Actions（本机无 SDK 别试本地构建）；artifact zip ≥15MB 在服务器上下载必截断，分发走 Release

### 10.2 CI 流水线（build-apk.yml）
1. Typecheck（**零错误门禁**，2026-11-14 类型债清零后升级）
2. 单测（npm test，纯逻辑）
3. Metro bundle + gradle assembleRelease（R8 混淆 debug 签名）
4. dev/master：artifact 上传；master：5 架构 APK 传 Release + 自动重写更新清单
- 遗留：lulu 分支触发与 apk-lulu 渠道已废弃删除，勿复活

### 10.3 发版 checklist
1. 确认 dev 上该版本的改动老板已实测通过（版本标记自动，无需额外提交）
2. 先 `git fetch` 并把本地 master 对齐 `origin/master`（上一次发版后 CI 机器人会直接向 master 提交更新清单），再 merge dev --no-ff（message 带「老板实测通过」）→ tag → push（推送断连用 代理 7897/直连 交替重试）；推完比对远端 sha，确认真的推上去了
3. API 建 Release（notes 中文，make_latest=true）→ 等 CI 绿 → 确认 5 APK + 清单已自动更新
4. 旧 Release 只保留最近 3 个（滚动删）

注意：每次向 master 推送都会触发 CI 重新构建，并覆盖上传当前版本 Release 里的 APK（纯文档改动也会）。

## 11. 血泪墙（改代码前必读）

| 坑 | 教训 |
|---|---|
| v1.9.16 黑屏 | Metro 不查类型，漏 import 实机才炸 → CI 类型门禁 |
| `[skip ci]` 字样 | message 说明文字里出现也会跳过整个 push 的构建 |
| 切片模拟渐变 | 半透明切片堆叠在电视大屏显形为「条条」→ 必须 512 级渐变 PNG |
| 不透明染色层 | 会把压暗层的矩形边界显形为「方块墙」→ 染色层必须半透明 |
| useNativeDriver:false 颜色动画 | 逐帧卡 JS 线程，遥控按键全在 JS 线程 → 丢按键 |
| 原生 onFocus 不可靠 | 部分电视引擎送焦点时原生事件不回调 → 副作用挂 onTVFocusChange |
| 返回键监听顺序 | v1.9.24 前返回键走系统 BackHandler（全局监听栈，依赖看不见的注册顺序），播放页「返回收栏」因此反复失效 → 现由原生截获、tvBackManager 按 z 级路由 |
| NaN/同引用 setState | React Object.is 短路；活数组要先快照 |
| 图标缓存 | 换图标后启动器缓存顽固，需断电重启电视 |
| workflow 凭证守护 | 写 .yml 用编辑工具（不用 bash 拼接），防 `${{ }}` 被改写 |
| 弹窗确认键变成取消 / 连环弹窗被吞 | TVDialog 必须先执行 `btn.onPress` 后通知 `onDismiss`（遥控与 Pressable 鼠标路径同步），且宿主 `onDismiss` 需通过 `resolveDismissedDialogRequest(prev, closing)` 判等，避免 `btn.onPress` 同步弹出的二级弹窗被旧 `onDismiss` 清成 null |
| 全屏弹层挡住按键 | 弹层打开期间焦点控制器让路，底下按钮的长按/OK 到不了 → 弹层内自带长按判定（repeat 连发立即触发 + 550ms 兜底计时器） |
| 音源脚本不上报初始化结果 | 异步抛错或不发 `inited` 会导致永久「加载中」→ v1.9.26 起 `loadScript` 自动挂载 12s 看门狗（超时销毁线程并走失败/预置源兜底） |
| `/api/logs` 手拼 JSON 遇换行崩盘 | `LanImportServer` 必须用 `JSONArray` 序列化运行日志，避免含 `\n` 的错误/堆栈弄坏整个手机日志控制台 |
| `TVMusicRow` 挂载清掉 `lazyMusicInfo` 封面 | 同步 `image` prop 的 `useEffect` 必须以 `pickInitialRowImage(image, lazyMusicInfo)` 为准，禁止直接 `setResolvedImage(image ?? null)` |

## 12. 修改守则

1. **动焦点系统前先跑 `npm test`**（引擎行为有回归单测），改完再跑
2. 新设置键：`src/config/defaultSetting.ts` 加默认值 + `src/types/app_setting.d.ts` 加类型
3. 新屏幕：registerScreens 注册 + navigation.ts 加 push 函数 + createTVTabs 挂 tab
4. 新原生方法：UtilsModule + src/utils/nativeModules/utils.ts 双侧同步；耗时操作放线程 + runOnUiThread
5. 视觉类 bug 定位：不要相信截图目测，用 PIL 逐行/逐列测像素色阶找边界
6. 改完自检三连：esbuild 单文件语法 → `npx tsc --noEmit`（零错误）→ `npm test`
7. **改了本文档描述的任何机制，必须同步更新本文档**（本条是本文档存在的原因）

---

*最后更新：2026-11-26（v1.9.26·249：14 项全仓 Bug 修复——连环弹窗、队列封面、去除幽灵源、播放页门控、音源 12s 看门狗、更新校验与 Android 5.x 安装、日志 JSON 转义及原生 QuickJS 清理）*
