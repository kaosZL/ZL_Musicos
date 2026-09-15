# 本地改动台账

记录本 fork **相对上游 `kaosZL/ZL_Musicos` 的全部改动**。

用途：上游更新时用来判断冲突风险；万一改动需要重做，照这份清单重新应用即可。
**每次改代码后都要更新这份文件。**

---

## 状态说明

- ✅ 已完成并推送
- 🚧 进行中
- 📋 已规划未开始

---

## ✅ 功能一：歌单导入（链接 / 文本 / 文件）

**目标**：在 TV 端导入歌单，**来源不限格式** ——
歌单链接、纯文本清单、洛雪导出文件、压缩包 / crx，
只要是能记录歌曲信息的文件都尽量识别。

### 已确认的设计决策（2026-09-15）

| 决策点 | 结论 |
|---|---|
| 支持的内容形态 | 三层全做：歌单链接 / 歌名+歌手清单 / 洛雪原生文件与压缩包 |
| 歌名清单匹配策略 | **只保留高置信度匹配**，宁可少几首不要错歌；导入后显示成功/跳过数量 |
| 歌单入口 | **方案 A**：Home 页新增「我的歌单」横向区块 |

### 核心设计：按内容嗅探，不按后缀名判断

```
上传文件 / 粘贴文本
   └─ 嗅探字节内容
        ├─ ZIP / CRX（PK\x03\x04）→ 解压 → 内部文件递归嗅探
        ├─ JSON（playListPart_v2 / playListPart）→ 洛雪原生格式，直接读
        └─ 纯文本 → 逐行判断
              ├─ 是 URL → 识别平台 → 拉取原歌单
              └─ 是「歌名 - 歌手」→ 搜索匹配，只留高置信度
   └─ 统一成 LX.List.MyListInfo → 写入洛雪
```

### 零新增依赖（关键 —— 不动 `package.json`，避免上游冲突）

| 能力 | 实现方式 |
|---|---|
| 接收上传文件 | NanoHTTPD 的 `session.parseBody()`，非 multipart 时原始 body 落在 `files["postData"]` |
| 解压 ZIP / CRX / GZIP | Java 标准库 `java.util.zip.ZipInputStream` / `GZIPInputStream`（CRX 是「签名头 + ZIP」，扫 `PK\x03\x04` 定位起点即可） |
| base64 解码 | `android.util.Base64` |
| 文本 / JSON 解析 | 纯 JS |

### 复用已有能力

| 需要的能力 | 上游现成实现 |
|---|---|
| 拉取歌单全量歌曲 | `src/core/songlist.ts` → `getListDetailAll(source, id)` |
| 创建本地歌单 | `src/core/list.ts` → `createList({ name, id, list, source, sourceListId })` |
| 刷新 Home 歌单区块 | 不需要额外调用：`createList` → `listEvent.list_create` 内部已调 `updateUserList()` → `setUserList()` → `emit('mylistUpdated')`，`useMyList()` 订阅该事件后自动重渲染 |
| 链接/ID → 数字 ID | 各平台 SDK 的 `listDetailLink` 正则，`getListDetail` 内部自动识别 |
| 高置信度搜索匹配 | `src/utils/musicSdk/index.js` → `findMusic({ name, singer })` |
| TV 端输入通道 | `LanImportServer.java` 的 `onLanAction(action, payload)` 回调 |

---

## ✅ 已完成

### 2026-09-15 · 功能一全部代码落地

#### 新增文件（不产生冲突，重做时直接复制回来）

| 文件 | 作用 |
|---|---|
| `src/screens/TV/songlistImport.ts` | **核心解析/落库逻辑**。导出 `importSonglist(rawText, options)`。三层路径：① `parseLxListFile()` 解析洛雪原生 JSON（`playListPart`/`playListPart_v2`/`playList`/`playList_v2`/`allData`/`allData_v2`/`defautlList`）；② `splitInput()` 拆出链接与「歌名 - 歌手」行，`importFromLinks()` 按域名判定平台后拉全量；③ `matchSongs()` 并发 3 逐首 `findMusic` 匹配（上限 300 行）。最后 `createListsFromParsed()` 建列表（内部已触发 `mylistUpdated`，Home 自动刷新）。 |
| `android/app/src/main/java/cn/toside/music/mobile/utils/SonglistImportPayload.java` | 原生层预处理 `/api/songlist` 载荷：base64 解码 → 按内容嗅探（gzip 魔数 / zip·crx 的 `PK\x03\x04`）→ 递归展开 → 文本合并。带预算上限（40 个条目 / 单条目 2MB / 总量 6MB / 递归 3 层），UTF-8 失败回退 GBK。静态方法 `expand(String rawPayload)`。 |

#### 修改的上游文件（冲突时按这里重做）

| 文件 | 改了哪一段 | 冲突风险 |
|---|---|---|
| `android/gradle.properties` | `reactNativeArchitectures` 由 `arm64-v8a,x86_64` 改为 `arm64-v8a,armeabi-v7a,x86_64`：补编 32 位 ARM，修复 32 位电视/盒子上 `UnsatisfiedLinkError: libquickbase64.so not found` 崩溃（quick-base64 等自编 C++ 库原先没有 v7a 版本）。副作用：构建时间约多 3-5 分钟、universal 包体积变大。 | 低 |
| `android/app/build.gradle` | `applicationVariants` 里的 `outputFileName` 加 `-lulu` 标记：产物变为 `zl-music-v1.9.5-lulu-universal.apk`，与上游官方的 `zl-music-v1.9.5-universal.apk` 区分开（曾因同名误装官方包）。**签名、versionCode、applicationId、构建逻辑一律未动。** | 低 |
| `.github/workflows/build-apk.yml` | ① `on.push.branches` 加 `lulu`（原为 `[master, dev]`）；② 顶部加 `permissions: contents: write`；③ 末尾新增「Publish APK to Release」步骤（仅 `lulu` 分支执行，用 runner 自带的 `gh` CLI 把 universal 包发到固定 tag `apk-lulu`）。**原有构建步骤一律未动。** | 低 |
| `android/.../utils/LanImportServer.java` | `serve()` 的 POST 分支里，在 `/api/activate` 之后追加一个 `if ("/api/songlist".equals(uri))` 块：调用 `SonglistImportPayload.expand(payload)` 后 `notify("songlist", ...)`。原三个路由未动。<br>**后续追加**：① 新增静态字段 `songlistsJson` 与 `setSonglists(String)`（对齐原有 `setSources`）；② 新增 `GET /api/songlists` 返回歌单快照；③ 新增 `POST /api/songlist-rename` → `notify("songlist-rename", payload)`；④ `json()` 的 MIME 加 `; charset=utf-8`（否则中文被 US-ASCII 编码成 `?`）。 | 低 |
| `android/.../utils/UtilsModule.java` | 在 `pushLanSources` 之后追加 `@ReactMethod pushLanSonglists(String, Promise)`，转调 `LanImportServer.setSonglists`。原方法未动。 | 低 |
| `src/utils/nativeModules/utils.ts` | 末尾追加 `pushLanSonglists(songlistsJson)` 包装。`pushLanSources` 及原有导出未动。 | 低 |
| `src/components/TV/TVTopTabs.tsx` | 新增 `readyNodeRef`，把 `onActiveTabReady()` 改为**节点真正变化时才通知**（修上游的重渲染死循环）。ref 本身仍是内联函数，未改结构。 | 中 |
| `src/components/TV/TVSearchKeyboard.tsx` | 新增 `firstKeyNodeRef`，把 `onFirstKeyReady()` 改为**节点真正变化时才通知**（同类死循环）。 | 中 |
| `android/app/src/main/assets/lan_input.html` | ① `<title>` 改「ZL-Music 导入」；② 新增「导入歌单」section（`slText` / `slFile` / `slName` / `doImportSonglist` / `songlistMsg`）；③ 新增 JS：`doImportSonglist` / `showSonglistMsg` / `bufferToBase64` / `sniffKind` / `decodeTextSmart`；④ 样式加 `.hint` 与 file input。<br>**后续追加**：⑤ 新增「歌单改名」section（`slList` / `loadSonglists` / `saveSonglists` / `renameMsg` / `slOriginal` 快照比对）。原有音源导入逻辑未动。 | 低 |
| `src/screens/TV/labels.ts` | 末尾追加 8 个文案键：`mySonglists` / `mySonglistsDesc` / `emptyMySonglists` / `emptyMySonglistsHint` / `importingSonglist` / `importSonglist` / `importSonglistTip` / `userList`。 | 低 |
| `src/screens/TV/types.ts` | `TVDetailPayload` 联合类型追加 `userlist` 分支。 | 低 |
| `src/screens/TV/Settings.tsx` | ① 新增 `import { importSonglist } from './songlistImport'`；② 新增 state `lanMessageOk`；③ `handleLanSourceEvent` 追加 `else if (action === 'songlist')` 分支；④ `handleOpenLanImport` 重置 `lanMessageOk`；⑤ 二维码下方提示文案改一句 + 新增 `lanMessage` 展示行。<br>**后续追加**：⑥ 新增 `useMyList()` 取用户歌单、`userSonglists`；⑦ 新增 `pushLanSonglistsSnapshot()`（与 `pushLanSourcesSnapshot` 一并改为 `useCallback`）；⑧ `handleLanSourceEvent` 追加 `else if (action === 'songlist-rename')` 分支，调 `core/list.ts` 的 `updateUserList`；⑨ `useEffect` 依赖改为两个快照回调；⑩ 顺手删掉未使用的 `tvFont` 导入。 | **高** |
| `src/screens/TV/Detail.tsx` | ① `heroMeta` 的兜底分支改为「我的歌单」文案；② `useEffect` 的 loader 抽成 async `load()`，新增 `payload.type === 'userlist'` 分支走 `getListMusics(payload.id)`；③ `handlePlay` 新增 `userlist` 分支走 `playList(payload.id, index)`。 | **高** |
| `src/screens/TV/Home.tsx` | ① 新增 `useMyList` 取用户歌单；② 新增 `myListFocus` / `sectionOffsetRef.mySonglists` / `bindMyCardRef` / `scrollToMySonglists` / `handleMySonglistFocusChange` / `openMySonglist`；③ Hero 按钮 `nextFocusDown` 改为 `heroNextDownHandle`（优先「我的歌单」首卡）；④ 新增「我的歌单」shelf（推荐歌单上方，含空态）；⑤ 推荐歌单卡片 `nextFocusUp` 改为镜像到「我的歌单」同序号卡片；⑥ **空态卡片改为可聚焦的 `Focusable`**（原先是个普通 View，遥控器够不到，一往下走就被滚出屏幕），并订阅 `songlistImportResult` 事件显示「上次导入结果」，方便直接在首页看到失败原因。<br>**后续追加**：⑦ `bindFirstCardRef` / `bindMyCardRef` 合并为 `getCardRefCallback(group, key, syncFirst)`，回调按 key 缓存（`cardRefCallbacks`）并对 `queueFocusRefresh` 按节点去重（`notifiedCardNodes`）——修上游遗留的重渲染死循环，顺带解决遥控器换焦点卡顿。 | 中高 |
| `src/event/appEvent.ts` | 新增一个具名事件方法 `songlistImportResult(result)`（`emit('songlistImportResult', result)`），用于设置页把导入结果广播给首页。纯追加，其余事件未动。 | 低 |

#### 交互流程（已实现）

```
TV 设置页 →「手机扫码导入」→ 出二维码
   → 手机扫码打开页面
   → 可粘贴 歌单链接 / 「歌名 - 歌手」清单，也可选择文件（txt / json / lxmc / zip / crx）
   → POST /api/songlist
   → 原生层 base64 解码 + 解压展开成文本
   → JS 层三层解析 + 落库
   → 电视上实时显示进度与结果，Home 页「我的歌单」出现新歌单
   → 点进去看歌单详情（Detail 页 userlist 分支），可播放全部或单曲
```

#### 已知边界

- 歌名清单匹配有 300 行上限（`MAX_SEARCH_LINES`），超出部分计入「跳过」。
- 压缩包解压总量上限 6MB、单条目 2MB、最多 40 个条目、最多 3 层嵌套。
- 手机上「zip 里套 zip 里的歌单文件」也可以，但超过 3 层就不再往下钻。
- `findMusic` 要求歌名精确一致，因此「歌名只有部分相同」的条目会被判为低置信度而跳过——这是刻意设计。

### 2026-09-15 · 构建产物自动发布到 Release（免登录直链）

**动机**：Actions 的 Artifacts **必须登录 GitHub 才能下载**，而且 30 天自动过期。
迭代测试要反复装包，每次都要登录、过期了还得重新构建，太麻烦。

`.github/workflows/build-apk.yml` 追加两处：

- 顶部 `permissions: contents: write` —— 否则 `GITHUB_TOKEN` 没有创建 Release 的权限
- 末尾「Publish APK to Release」步骤，限定 `if: github.ref == 'refs/heads/lulu'`，
  用 runner 预装的 `gh` CLI（**不引入任何第三方 action**）：
  挑出 `*universal*.apk` → 统一改名成 `ZL_Musicos-lulu.apk` → 创建/更新 tag 为 `apk-lulu` 的 Release
  → `gh release upload --clobber` 覆盖上传

**固定下载直链**（免登录、不过期，每次构建自动更新）：

```
https://github.com/soren1985/ZL_Musicos/releases/download/apk-lulu/ZL_Musicos-lulu.apk
```

**前置条件**：仓库 `Settings → Actions → General → Workflow permissions` 需为
「Read and write permissions」。若为只读，workflow 里声明的 `contents: write` 会被降级，
该步骤会报权限错误（但**不影响**前面的 APK 构建与 Artifacts 上传）。

---

### 2026-09-15 · 修复遥控器切换焦点卡顿（**上游原有 bug**）

**现象**：遥控器在卡片/图标之间移动时明显发滞（越多人反馈"切换图标慢"）。

**根因：三处 ref 回调引发「每帧一次的重渲染死循环」**（全部是上游原有写法，不是本次功能引入的）：

React 在每次提交时，如果 `ref` 的身份变了，会先以 `null`、再以节点调用它。
上游多处把 ref 写成**内联箭头函数 / 每次渲染新建的工厂函数**，于是：

```
渲染 → 新建 ref 回调（身份变了）
     → React 先 ref(null) 再 ref(node)
     → 回调内部的「节点已变化」判断恒为真 → 调 queueFocusRefresh()
     → setTick → 再渲染 → 回到第一行
```

`useTVFocusRefresh` 又用 `requestAnimationFrame` 限流，所以循环稳定跑在**每秒 60 次**。
首页有 30 多张卡片，每帧都要整棵树重渲染 + 上百次 `findNodeHandle` + 每张卡
`updateTVFocusTarget` 重建对象，JS 线程被占满 → 按键处理排在后面 → 手感卡顿。
它影响的是**所有 TV 页面**（只要有顶部 tab 或搜索键盘）。

**修复：两件事都做 —— 让回调身份稳定，并对「就绪通知」按节点去重。**

| 文件 | 改动 |
|---|---|
| `src/screens/TV/Home.tsx` | `bindFirstCardRef` / `bindMyCardRef` 合并为 `getCardRefCallback(group, key, syncFirst)`，按 key 缓存回调（`cardRefCallbacks`），并对 `queueFocusRefresh` 按节点去重（`notifiedCardNodes`）。30 多张卡的 ref 不再每次渲染都换身份。 |
| `src/components/TV/TVTopTabs.tsx` | 内联 ref 保留，但 `onActiveTabReady()` 改为「节点真正变化时」才通知（`readyNodeRef` 去重）。此组件被 Home / Detail / History / Queue 共用，是影响面最大的一处。 |
| `src/components/TV/TVSearchKeyboard.tsx` | 同上，`onFirstKeyReady()` 按节点去重（`firstKeyNodeRef`）。原先在搜索页输入时也会空转重渲染。 |

> 关键点：**不能**只在回调里比较 `refs.current[key] !== node`。因为 React 的
> detach 会先把 `refs.current[key]` 置成 `null`，再 attach 时永远"看起来变了"。
> 必须用**独立的一份记录**（只记 attach 过的节点、忽略 detach 的 `null`）来判重。

---

### 2026-09-15 · 功能二：歌单重命名（手机页操作）

**动机**：导入的歌单名来自平台（如「我喜欢的音乐」），用户想自己改。
**为什么放在手机页**：电视遥控器只能输入英文 + 数字，**打不了中文**，
而歌单名基本都是中文。局域网手机页是现成的输入通道，直接复用最省事。

**不新增任何依赖，复用已验证的局域网通道：**

```
手机页「歌单改名」
  → GET  /api/songlists        读电视推送的歌单快照（原生层缓存）
  → 手机编辑名称（手机键盘，支持中文）
  → POST /api/songlist-rename  { renames: [{ id, name }] }
  → 原生 notify("songlist-rename", payload)
  → JS: core/list.ts updateUserList([{ ...原条目, name }])
  → list_update → setUserList → emit('mylistUpdated') → 首页自动刷新
```

**实现要点**：

| 点 | 说明 |
|---|---|
| 只提交改动项 | 手机页保存时用 `slOriginal` 快照比对，未改名的条目不发 |
| 补全其余字段 | JS 端用本地 `userSonglists` 里的原条目展开后再覆盖 `name`，保住 `locationUpdateTime` 等字段（`listEvent.list_update` 的 `updateList()` 会读这些字段） |
| 快照推送时机 | 设置页打开扫码面板时、以及 `userSonglists` 变化时（`useCallback` + `useEffect`） |
| 中文不乱码 | `LanImportServer.json()` 的 MIME 由 `application/json` 改为 `application/json; charset=utf-8`。NanoHTTPD 在 MIME 无 charset 时按 **US-ASCII** 编码字符串，会把中文变成「?」（顺带修好了原有 `/api/sources` 与中文错误提示的乱码） |

---

### 2026-09-15 · 歌单卡片视觉 + 管理入口（按反馈修复）

**用户反馈的原话**：① 重命名到底绑在遥控器哪个键上？② 看看还有没有别的没想到的问题；
③ 导入的歌单名叫 `q`，界面上就冒出一个挺大的 `q` 字样。

#### 问题清单与修法

| # | 问题 | 根因 | 修法 |
|---|---|---|---|
| 1 | 卡片上一个巨大的单字母（名字叫 `q` 就是个大 `q`） | `TVPosterCard` 无封面时用 `title.slice(0,1)` 以 **74 号字**当封面兜底 | 组件新增 `coverFallback?: 'letter' \| 'music'`（默认 `letter`，推荐位行为不变）；「我的歌单」传 `'music'`，封面统一显示音符 ♪，不再随名字变形 |
| 2 | 重命名在电视上没有入口、也没有任何提示，用户完全不知道要扫码 | 功能只做在手机页，电视端文案没提 | 新增**遥控器长按 OK = 歌单管理**（弹窗给出「改名要用手机」的说明 + 删除入口）；卡片 `meta` 显示「长按 OK 管理」；设置页二维码下方文案补上「也能给已导入的歌单改名、删除」+「改名必须在手机上做」 |
| 3 | **导入第二个歌单后，首页再也看不到导入结果** | 结果提示只写在「一个歌单都没有」的空态卡片里 | 结果提示移出空态分支，改为「我的歌单」区块下常显一行；同时加模块级缓存 `lastSonglistResultCache`，首页切走再回来（组件重挂载、state 重置）也能看到上次结果 |
| 4 | **导入错了的歌单删不掉** | TV 端和手机页都没有删除入口 | ① 首页长按 OK → 删除（带二次确认）；② 手机页每个歌单加「删除这个歌单」按钮 → 新增 `POST /api/songlist-remove` → `songlist-remove` 事件 → `removeUserList` |
| 5 | 同一个歌单导入两次会得到两张同名卡片，分不清 | 落库时不去重名 | `createListsFromParsed` 重名时自动加序号：`车载歌单` → `车载歌单 (2)` |
| 6 | 手机页「已提交」其实可能什么都没发生 | 电视端切到别的页面后，`手机扫码导入`的事件监听就不在了（监听挂在设置页组件里） | 手机页提交后**回读快照核对**：核对不上就明确提示「请确认电视停在显示二维码的界面」，且**保留用户刚输入的改名内容**便于重试；删除同理 |
| 7 | 手机页删除已不存在的歌单，电视端仍回「已删除」 | 手机页拿到的是上一次推送的快照 | 删前用本地 `userSonglists` 过滤，全部不存在则提示「电视上已经没有这些歌单了，请重新读取」 |
| 8 | 歌单名可以无限长，卡片和详情标题会被撑爆 | 手机页输入框没有长度限制 | 输入框加 `maxlength=40` |

> **已知限制（未改，但已在手机页明确提示）**：局域网导入服务的按键/事件监听挂在设置页组件上，
> 手机页操作时电视必须停在「手机扫码导入」（显示二维码）界面。彻底解决需要把监听提升到 App 级
> 并重构 `apiSource` 等设置页私有状态，风险大于收益，暂不做。

#### 改动文件

| 文件 | 改了什么 |
|---|---|
| `src/components/TV/TVPosterCard.tsx` | 新增 `coverFallback`，新增 `musicGlyph` 样式（56 号字音符），默认行为不变 |
| `src/screens/TV/Home.tsx` | ① 我的歌单卡片传 `coverFallback="music"`、`meta` 改「长按 OK 管理」、新增 `onLongPress`；② 新增 `handleManageSonglist` / `handleRemoveSonglist`（`showTVDialog` + `confirmDialog` + `tipDialog`）；③ 结果提示移出空态分支、常显；④ 模块级 `lastSonglistResultCache` 让结果跨挂载保留；⑤ 新增 `import { removeUserList }`、`showTVDialog`、`confirmDialog`、`tipDialog` |
| `src/screens/TV/Settings.tsx` | ① import 加 `removeUserList`；② `handleLanSourceEvent` 新增 `songlist-remove` 分支（含快照过期校验）；③ 二维码下方提示补「改名、删除」说明 |
| `src/screens/TV/labels.ts` | 新增 `lastImportResult` / `managingSonglist` / `longPressManage` / `renameSonglistNeedPhone` / `deleteSonglist` / `deleteSonglistConfirm` / `deleteSonglistDone` / `deleteSonglistFailed` / `cancelAction` / `knowIt`；改写 `mySonglistsDesc` / `emptyMySonglistsHint` |
| `src/screens/TV/songlistImport.ts` | `createListsFromParsed` 增加重名去重（`usedNames` + 序号后缀） |
| `android/.../utils/LanImportServer.java` | 新增 `POST /api/songlist-remove` 路由 → `notify("songlist-remove", payload)` |
| `android/.../assets/lan_input.html` | ① 「歌单改名」区块改名「歌单改名 / 删除」，补删除说明；② `loadSonglists` 拆成 `fetchSonglists` + `renderSonglists`（顺带修掉「重新读取时列表渲染逻辑重复」）；③ 每个歌单加「删除这个歌单」按钮 + `removeSonglist()`；④ 新增 `confirmApplied()` 提交后回读核对；⑤ 两个名称输入框加 `maxlength=40` |

**遥控器按键映射（本次确立）**

| 操作 | 遥控器 | 说明 |
|---|---|---|
| 打开歌单 | 短按 OK | 原行为 |
| 歌单管理 | **长按 OK** | 弹窗：改名说明 + 删除歌单 |
| 改名（实际输入） | 手机 | 电视遥控器打不了中文，手机页「歌单改名 / 删除」 |
| 删除歌单 | 长按 OK → 删除，或手机页删除按钮 | 都带二次确认 |

---

## 📋 待办 / 可选

- [x] ~~歌单重命名~~ —— 已做（手机页「歌单改名」，见上）。
- [x] ~~歌单删除~~ —— 已做（首页长按 OK + 手机页删除按钮，见上）。
- [ ] 歌单**排序**仍未暴露（手机页 / 电视端都还没有拖排序入口）。
- [ ] 导入时若匹配上的歌曲过少，可考虑在电视上给一个「是否仍要保留」的确认弹窗。
- [ ] `TVNavBar.tsx` 的 ref 也是内联箭头（`ref={(node) => { refs.current[index] = node }}`），
      不过它没有「就绪回调」，不会造成死循环，只是每次渲染多一次 detach/attach，暂未改动。
- [ ] 其余 TV 屏（Detail / History / Queue）若仍觉卡顿，可检查是否还有同类内联 ref + 就绪回调的组合。
- [ ] 定时任务：自动检测上游新提交并提醒（尚未确认要做）。

---

## 维护约定

1. 每完成一项改动，就在「已完成」区加一条，写明：日期、文件、改了什么、是新增还是修改。
2. 新增的文件单独列出 —— 它们不会产生冲突，重做时直接复制回来即可。
3. 修改了上游文件的地方，尽量写清"改了哪一段"，方便重做。
