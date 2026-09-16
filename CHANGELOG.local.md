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
| 9 | 一个弹窗的按钮里立刻弹下一个弹窗（管理菜单 → 删除确认）时，焦点会停在上一个弹窗的位置，**很容易误按到「删除」** | `TVDialog` 的 effect 只看 `visible`，而连续弹窗时 `visible` 一直是 `true` | `TVDialog` 新增 `resetKey`（`TVDialogHost` 传 `request`），弹窗内容变化时重置焦点到第一个按钮 |
| 10 | **按遥控器 MENU 键会抛 `ReferenceError`**（上游 bug） | `TVRemoteFocusController.tsx` 用了 `focusPreferredTVTarget()` 但**没有 import**（函数在 `tvFocusManager.ts` 里有正常导出）。Metro 打包不做类型检查，所以一直没暴露 | import 列表补上 `focusPreferredTVTarget` |
| 11 | 空态卡片提示用户「到设置页点手机扫码导入」，但**按 OK 毫无反应** —— 是个死胡同 | 空态 `Focusable` 只写了 `onFocus`，没有 `onPress` | 空态卡片加 `onPress` → `pushTVSettingsScreen(componentId)`；文案改为「按 OK 直接打开『手机扫码导入』…」 |

> **已知限制（未改，但已在手机页明确提示）**：局域网导入服务的按键/事件监听挂在设置页组件上，
> 手机页操作时电视必须停在「手机扫码导入」（显示二维码）界面。彻底解决需要把监听提升到 App 级
> 并重构 `apiSource` 等设置页私有状态，风险大于收益，暂不做。

#### 改动文件

| 文件 | 改了什么 |
|---|---|
| `src/components/TV/TVPosterCard.tsx` | 新增 `coverFallback`，新增 `musicGlyph` 样式（56 号字音符），默认行为不变 |
| `src/components/TV/TVDialog.tsx` | 新增可选 `resetKey`，`useEffect` 依赖由 `[visible]` 改为 `[visible, resetKey]`；`TVDialogHost` 把 `request` 传进去 |
| `src/components/TV/TVRemoteFocusController.tsx` | import 补上漏掉的 `focusPreferredTVTarget`（修 MENU 键 ReferenceError） |
| `src/screens/TV/Home.tsx` | ① 我的歌单卡片传 `coverFallback="music"`、`meta` 改「长按 OK 管理」、新增 `onLongPress`；② 空态卡片新增 `onPress` → 跳设置页；③ 新增 `handleManageSonglist` / `handleRemoveSonglist`（`showTVDialog` + `confirmDialog` + `tipDialog`）；④ 结果提示移出空态分支、常显；⑤ 模块级 `lastSonglistResultCache` 让结果跨挂载保留；⑥ 新增 `import { removeUserList }`、`showTVDialog`、`confirmDialog`、`tipDialog`、`pushTVSettingsScreen` |
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

### 2026-09-15 · 修复「从我的歌单选一首歌，播完就跳到不相干的歌」（播放队列）

**现象**：在某张导入的歌单里按 OK 选一首歌 → 这首放完**不回歌单的下一首**，
而是播一些不相干的歌；播放列表页显示的内容也和正在放的对不上，按 OK 更乱。

**根因（两处，互相放大）**

1. `Detail.tsx` 歌曲行按 OK 走的是 `handleSinglePlay` —— 它把这一首**追加到共享的临时列表
   （TEMP）末尾**，再 `playList(TEMP, 末尾下标)`。于是「当前播放队列」= 之前 TEMP 里
   所有的残留（搜索页单曲播放、在线歌单试听…）+ 这一首。列表循环模式下这首在末尾，
   播完 `nextIndex` 回绕到 0 —— 正好是那些**残留的旧歌**，看起来就是「它自己找的歌」。
2. 播放列表页（`Queue.tsx`）**写死读 `LIST_IDS.TEMP`**；而「播放全部」走的是
   `playList(歌单id, index)`（`playerListId` = 歌单自己的 id），两边根本不是同一个列表
   → 队列页显示的和实际播放的、以及按 OK 播的都可能是另一份歌。

**修法（把 TV 端所有播放入口统一到 TEMP 这一条队列）**

- 详情页**短按 OK = 从这首开始播整张歌单**：`setTempList(歌单id, 整张歌单)` +
  `playList(LIST_IDS.TEMP, index)`。这样 `playerListId` 恒为 TEMP，队列页显示的就是
  你正在听的这张歌单；同时 `tempListMeta.id` 仍记着歌单出处，不破坏上游
  「同源同步 / 重新拉取」的判定（`SonglistDetail/listAction.ts` 就是这么做的）。
- 长按 OK 保留原「单曲追加」能力（`handleSinglePlay`），列表上方加一行操作提示说明两者区别。
- 队列页顶部提示补「队列来自歌单：「xxx」」，一眼能确认队列对不对。

**已知限制**：队列是 TEMP 里的**副本** —— 在队列页删歌/清空只影响队列，不会动你的歌单；
反过来在歌单里加删歌也不会自动改到已经在播的队列上（下次播放才生效）。

| 文件 | 改了什么 |
|---|---|
| `src/screens/TV/Detail.tsx` | ① `handlePlay` 的 `userlist` 分支改走 TEMP（`setTempList` + `playList(LIST_IDS.TEMP)`）；② 歌曲行 `onPress` 由 `handleSinglePlay` 改为 `handlePlay(index)`，新增 `onLongPress` = 单曲追加；③ 列表上方加操作提示 + `listHint` 样式 |
| `src/screens/TV/Queue.tsx` | 顶部提示补「队列来自歌单：「xxx」」（`useMyList()` + `listState.tempListMeta.id`） |
| `src/screens/TV/labels.ts` | 新增 `detailPlayHint` / `queueFromSonglist` |

---

### 2026-09-16 · 修「长按 OK 弹窗闪一下就消失」+ 我的歌单搬到顶部 Tab + 电视端改名 + 换应用图标

**① 弹窗闪退（用户：按下 enter 键会闪一下，看不清内容就消失了）**

根因不在弹窗的显示，而在**遥控器连发事件**：Android 长按是靠按键 repeat 识别的，
而 **repeat 事件的 `eventKeyAction` 仍然是 0（ACTION_DOWN），只有 `repeatCount > 0` 能区分**
（原生侧见 `MainActivity.java` 发 `event.getAction()` / `event.getRepeatCount()`）。
`TVDialog` 的遥控监听只判断了 `eventKeyAction !== 0`，于是：

```
长按 OK：DOWN(rc=0) → DOWN(rc=1) ← 这一刻弹出菜单
                    → DOWN(rc=2) ← 手指还没松，弹窗把它当成"又按了一次确定"
                    → 立刻执行第一个按钮（取消）→ 菜单关闭 → 用户看到"闪一下"
```

修法：弹窗忽略 `repeatCount > 0` 的事件，再加一道「打开后 350ms 内忽略 select」双保险
（只拦 select，左右切按钮与返回键不受影响）。

**② 「我的歌单」从 Home 区块改为顶部 Tab**

用户要求挪到「推荐 / 排行榜」那一排。现在顶部 tab 顺序为
**推荐 · 排行榜 · 我的歌单 · 搜索 · 播放列表 · 设置**，点进去是独立的「我的歌单」页。
Home 页原横向区块（含空态卡）整体移除，Hero 的「下」键改指**第一张推荐歌单卡**，
焦点链重排后无悬空。

**③ 电视端可直接改名（新增）**

原来只能去手机扫码页改名，电视上按 OK 没任何编辑入口。现在长按 OK 的菜单是
**[取消] [改名] [删除]**，「改名」进入屏上键盘（项目自带 `TVSearchKeyboard`）输入。
**限制**：屏上键盘只有英文/数字，**中文名仍需去手机扫码页改**，页面上已明确提示。

**④ 应用图标 / TV banner 换成指定照片**

- 5 档密度 `ic_launcher.png` / `ic_launcher_round.png` / `ic_launcher_foreground.png` 全部替换，
  `ic_launcher_foreground.png` 为**整幅铺满**（launcher 会裁掉外圈，可见区只有中间 66%）。
- **关键**：Android TV 桌面显示的是 `drawable-xhdpi/tv_banner.png`（640×360，manifest 里的
  `android:banner`），**不是 ic_launcher** —— 只换图标在电视上是看不到变化的，banner 必须一起换。
- `ic_launcher_background.xml` 底色 `#01041C` → `#0D0D10`（贴近照片暗部）。
- 裁切以人脸为中心（源图 1260×1678，人脸在画面偏上，直接取几何中心会裁到胸口）。

| 文件 | 改了什么 |
|---|---|
| `src/components/TV/TVDialog.tsx` | 遥控监听加 `repeatCount > 0` 拦截 + `visibleAtRef` 350ms select 防抖窗口 |
| `src/screens/TV/MyList.tsx` | **新增文件** —— 「我的歌单」独立页（tab 页），卡片 OK=打开、长按 OK=管理菜单，空态卡 OK 直达扫码页；导入结果提示也搬到这里 |
| `src/screens/TV/Rename.tsx` | **新增文件** —— 电视端改名屏（屏上键盘 + 保存/取消），保存走 `updateUserList([{...原条目, name}])` 保留 `locationUpdateTime` 等字段 |
| `src/screens/TV/Home.tsx` | 删掉整个「我的歌单」区块及只服务它的 state/ref/订阅/模块缓存；Hero「下」改指第一张推荐卡 |
| `src/screens/TV/utils.ts` | `createTVTabs` 在「排行榜」之后插入「我的歌单」 |
| `src/components/TV/TVTopTabs.tsx` | tab 水平内边距 `tvSize(20)` → `tvSize(16)`，给 6 个 tab 留宽度（焦点逻辑未动） |
| `src/navigation/screenNames.ts` / `navigation.ts` / `registerScreens.tsx` / `src/screens/index.ts` | 注册并导出 `TVMyList` / `TVRename` 两个新屏 |
| `src/screens/TV/labels.ts` | 新增 myListHint / rename 相关文案（沿用 `\uXXXX` 转义写法） |
| `android/app/src/main/res/mipmap-*/` 15 个 PNG + `drawable-xhdpi/tv_banner.png` + `values/ic_launcher_background.xml` | 换成照片 |

**验证方式**：QA 用同一串遥控事件分别跑旧/新判定函数，**旧逻辑成功复现了闪退、新逻辑通过**；
新页面导航链路逐环核对无断链；tsc 改动文件 0 新增 error、eslint 改动文件全绿。

**④ 的后续修正（第二次改，见 commit `b493236`）：桌面显示效果与图标本身对齐**

第一版以人脸为中心、放得比较大，**但 Android 自适应图标（API 26+）会裁掉外圈、只保留中间约 66%**，
于是桌面上实际看到的是一张「怼脸」近景，跟图标文件本身的「整头 + 颈肩」根本不是一回事。

改法（关键思路）：**别去猜 launcher 怎么裁，直接把「想要看到的构图」做成中央 66% 的内容。**

```
先用 V = 1000×1000 按目标构图取景（人脸居中，含发顶留白 / 下巴 / 颈部 / 一点肩）
再以 S = V / 0.66 ≈ 1515 建画布，四周用照片自身的模糊放大版补底（避免出现硬边）
把照片 1:1 落在画布中心
    ├─ ic_launcher / ic_launcher_round = 画布中心 V        ← launcher 方图/圆图直接用
    └─ ic_launcher_foreground          = 整张画布 S        ← launcher 裁掉外圈后剩下的正好是 V
```

这样无论桌面按哪条路径取图，看到的都是同一个构图；`tv_banner`（640×360）保持用户已确认的版本不动。
5 档密度 15 个 PNG 全部重出（48/72/96/144/192、108/162/216/324/432），已逐项核对尺寸与 alpha 通道。

**出包后的最终核验（2026-09-16）**：CI 绿，下载 release APK（`sha256 c0a8a363…`，29,755,819 bytes）拆包核对 ——
32 位 `libquickbase64.so` 在、bundle 里新文案全在（utf-16 命中）、dex 里 4 条手机页路由全在。

> ⚠️ **踩坑记录**：一开始按 `'ic_launcher' in zip名称` 找图标，报「包内 ic_launcher* 条目 0 个」，
> 差点误判成图标没打进去。真因是**这个包开了资源路径压缩**（resource path shortening），
> `res/` 下的文件名被压成 `res/-0.png` / `res/o-.png` 这种两字符名，**按名字根本找不到**。
> 正确姿势是**不认名字、认「尺寸 + 构图指纹」**：扫 `res/*.png` 的 IHDR 拿尺寸，命中目标尺寸的
> 再解像素、跟本地文件比网格平均色。结果本地 4 个图标资源在包内**指纹差异全为 0**（像素级一致），
> 而旧包同尺寸条目差异 211~242（说明确实换过图了）。

**顺带发现（未修，历史遗留）**：`src/screens/TV/Player.tsx` 有个分支假设
`eventKeyAction === 2` 表示 REPEAT，但原生只发 0/1 —— 该分支是死代码。
`Focusable.tsx` 注册 `onLongPress` 的 effect 依赖数组里缺 `onLongPress`/`handleLongPress`，
当前被「onPress 是内联箭头、每次渲染都重跑 effect」掩盖，暂未触发问题。

---

## 🚧 修复：「歌单只能导入一个，要导第二个时没反应」（2026-09-16）

**现象**：导入第一个歌单成功之后，再想导入第二个时「没反应」。

**根因（两条，A 是直接原因）**

- **(A) 可达性缺陷〔直接原因〕**：`src/screens/TV/MyList.tsx` 原来按 `hasLists` 二选一渲染 ——
  没有歌单时渲染那张空态卡（`onPress` → 扫码设置页），**有歌单之后整张空态卡连同入口一起被卸载**，
  页面上只剩歌单卡 + 长按菜单，**再没有任何「导入歌单」入口**。
  该缺陷在旧的 Home「我的歌单」区块里就已经存在
  （`git show 425e890^:src/screens/TV/Home.tsx` 可查：有歌单时只渲染歌单卡、没有导入入口），
  commit `425e890` 把它搬到顶部 Tab 时一并带了过来。
- **(B) 功能性缺陷〔已用可运行实验逐条排除〕**：取证脚本（等价重写 + 真 HTTP 服务，未入库）跑了 4 组实验：
  ① JS 导入管道连导 4 次全部落地（`makeUniqueListId` 的 `__N` 兜底有效，`userListsAdd` 的静默 `return` 一次都没触发）；
  ② 原生 LAN 服务对连续 POST 完全无状态（4 次 POST = 4 次 notify；`start()` 提前返回、`stop→start` 都不影响投递）；
  ③ 订阅 effect 重订阅在真实时序下不漏事件，且任何时刻只有 1 个订阅者（无泄漏）；
  ④ 唯一确认存在的静默无响应场景见下方「已知未修」。
  → **LAN 服务 / 事件桥 / 静默去重 三者均已排除**。

**改了哪些文件**

| 文件 | 改了什么 |
|---|---|
| `src/screens/TV/MyList.tsx` | 「导入歌单」卡片改为**常驻**、固定在网格第一位（有歌单时文案 `importSonglist` / `importSonglistTip`，空态时沿用原空态文案）；不再按 `hasLists` 二选一。顺带解决「删光歌单后焦点悬空」。歌单卡副标题兜底 `importSonglist` → `songlist`，避免与入口卡撞文案 |
| `src/screens/TV/songlistImport.ts` | ① 删掉 `createListsFromParsed` 尾部多余的 `setUserList(userLists)`（`list_event.list_create` 内部已调，实测每次导入会多发一次 `mylistUpdated`）；② `createList` 后回读 `userLists`，把上游 `userListCreate` 的**静默 ID 撞车 `return`** 变成明确上报；③ `importSonglist` 尾部在 `outcome.ok === false` 时如实返回 `ok:false`（原来无论成败都返回 `ok:true`） |
| `src/screens/TV/Settings.tsx` | 订阅 effect 依赖收窄为 `[lanRunning]`，快照推送拆成两个独立 effect —— 避免导入成功后 `userSonglists` 变化引发 unsubscribe/resubscribe；重订阅之间的同步空窗里到达的桥事件会被直接丢掉 |

**已知未修（已确认存在，留作后续）**：电视端**不在**扫码页时（例如按 BACK 回到「我的歌单」，
但原生 LAN 服务仍在跑），手机提交依然会拿到 `{ok:true}`「已提交」，而 JS 侧没有订阅者 → 事件被丢弃，
电视毫无反应。原生 `UtilsEvent.sendLanSourceEvent` / `LanImportServer` 只 emit 不回放，
且 `stopServer()` 不清 `listener`。彻底修需要给导入加一条 ack 通道（新增原生路由），
或让手机页像改名/删除那样回读校验（`lan_input.html` 已有 `confirmApplied` 模式）。
本次未动，避免引入新原生路由 / 破坏「两个 Settings 实例共存」的场景。

**验证**：tsc 改动文件 0 新增 error、`error TS2304` 计数 = 0；eslint 改动文件与 HEAD 基线完全一致（0 新增）。

---

### 2026-09-16 · 续查：推翻 (A) 为「用户实际障碍」，定位到生命周期黑洞 + 结果反馈不可见

**用户澄清**（问：第二次想导入时在哪个界面操作的？）：
① 第二次是在**「设置」页**按「手机扫码导入」做的，不是「我的歌单」页；
② **连第一次的导入结果提示都没看到**。

→ 前面判定的 **(A)「我的歌单页入口不可达」不是用户的实际障碍**（它仍是真实缺陷，已修并保留），
真正的问题是 **③ 结果反馈根本看不见** + **④ 离开设置页后原生服务还在跑、JS 订阅却没了，
手机提交被黑洞吞掉、而手机仍显示「已提交」**。

**修正后的根因（全部用可运行实验取证，未入库）**

1. **生命周期黑洞〔本次真正主因〕**：`LanImportServer` 是原生单例，而 `Settings.tsx`
   **卸载时没有任何 cleanup 去停它**。于是「按 BACK 离开设置页 / 切到别的 tab」之后：
   JS 侧订阅被移除，原生服务仍在监听，手机页面还开着 → 再提交一次，
   手机拿到 `{ok:true}`「已提交」，电视侧却**没有任何人接事件**（原生只 emit、不回放）
   → 用户看到的正是「要导第二个时没反应」。
   **实验 E5**：旧代码在「离开设置页后再提交」这一步得到 `NOTIFIED-BUT-DROPPED` 且手机回
   `{ok:true}` → 黑洞命中；按本修复（卸载即停服）改后命中 **0 次**。
2. **结果反馈不可见**：`setLanMessage` 渲染在右栏 ScrollView 的**最下方**，导入结束时**不会自动滚过去**
   （只有成功打开二维码时才 `scrollToEnd`）。于是「已导入 N 个歌单 / 导入失败」用户根本看不到
   —— 连第一次的结果都看不到，与用户描述完全吻合。
3. **启动失败被吞成「没反应」**：旧 `LanImportServer.start()` 开头是 `if (instance != null) return;`
   ——「上一次留下的、其实并没有在监听的半死实例」会把之后**每一次** start() 静默堵死；
   此时 `getServerPort()` 恒返回 `-1`（二维码会编成 `http://ip:-1`），失败信息只写进 JS 侧看不见的
   `setLanMessage`。另外端口被占用（`BindException`）时**没有任何兜底**。**实验 E6** 确认。

**改了哪些文件（本轮）**

| 文件 | 改了什么 |
|---|---|
| `android/.../utils/LanImportServer.java` | ① `start()` 由 `void` 改为返回**实际监听的端口**；② **无论复用还是新建都刷新 listener**（修「提前 return 不刷新、留下半死监听者」）；③ 先判活实例再复用，死的先 `stop()` 再丢弃引用（不再污染 `instance`）；④ 端口被占用时**向后顺延重试**最多 `PORT_RETRY_COUNT=5` 个端口；⑤ 全部失败时 `instance=null` 并**抛异常**（让 JS 能弹窗，而不是装作成功）；⑥ 新增 `isListening()`（`getListeningPort() > 0`）；⑦ `stopServer()` 额外清空 `listener`；⑧ `getServerPort()` 对死实例返回 `0`（不再吐 `-1`） |
| `android/.../utils/UtilsModule.java` | `startLanImportServer` 改用 `start()` 返回的端口，`actualPort <= 0` 时 `reject`；resolve 的 `port` 用实际端口 |
| `src/screens/TV/Settings.tsx` | ① **订阅 effect 改为「挂载即订阅」+ 卸载时停服**（cleanup 里 `stopLanImportServer()`），并用模块级 `lanSessionOwner` token 保证同一时刻只有一个实例「拥有」会话（避免「设置页里再 push 一个设置页」同一件事被处理两遍）；② `handleOpenLanImport` 在 `await` 二维码**之前**就接管会话（消除「二维码还没渲染出来时手机就提交」的窗口）；③ 新增本页独立 `TVDialog`，把成功/失败/改名/删除结果**弹窗**，不再只靠角落文案；④ 结果文案移到按钮**上方**带边框的框里；⑤ 启动失败弹 `lanStartFailed`；⑥ 保留上一轮的订阅拆分 + 两个快照 effect |
| `src/screens/TV/labels.ts` | 新增 `lanStartFailed`（「扫码页启动失败」） |
| `src/screens/TV/songlistImport.ts` | （沿用上一轮）ID 撞车显式上报、删冗余 `setUserList`、`ok:false` 如实返回 |
| `src/screens/TV/MyList.tsx` | （沿用上一轮）「导入歌单」入口常驻、固定网格第一位 |

**为什么用本页自己的 `TVDialog`，而不是全局 `tipDialog`**：全局 `showTVDialog` 只投给「最后挂载的
`TVDialogHost`」，而各屏 pop 时它的 cleanup 会把 `activeListener` 置 null 且**不再重注册** →
全局弹窗有可能静默失效，用户又变成「啥也没看到」。本页自己弹最稳。

**复现步骤（修复前）**：设置页 →「手机扫码导入」→ 出二维码 → 手机扫码导入第一个歌单 → 成功 →
在电视上按 BACK 离开设置页（原生服务仍在跑）→ 手机页面**不关**，再提交第二个歌单 →
手机显示「已提交」，**电视毫无反应**。

**验证**：tsc 改动文件 0 新增 error、`error TS2304` 计数 = 0；eslint 改动文件与 HEAD 基线完全一致
（均 10 条既有 rule 违规，行号仅因新增代码位移）。Java 侧本机不可编译，逐行核对签名 / 异常 / 返回值。

**后续修正（QA 回归①，2026-09-16）**：`handleCloseLanImport` 原来**无条件** `stopLanImportServer()`，
非 owner 实例点「关闭二维码」会把 owner 还在用的服务停掉（owner 页面上二维码仍挂着、服务却已死 =
假存活）。已把**停服也纳入 owner 判定**（只有 owner 才真的停），与卸载 cleanup 的守卫语义一致；
非 owner 仅复位自己的 `lanRunning/qrImage`。QA 提的回归②③（结果弹窗宿主不可见 / 两个 TVDialog
重复消费按键）本轮只记录不修，见下方「待办 / 可选」。

**已知限制（未改）**：两个 `Settings` 实例共存时靠 `lanSessionOwner` token 只让一个实例处理事件。
彻底按 App 级单例重构（把监听提升到 App、`apiSource` 等私有状态外提）风险大于收益，仍不做。

---

## 🚧 修复：「两个都叫『导入歌单』的选项」+「导入进来的歌单遥控器选不中」（2026-09-16）

**用户原话**：我的歌单下面有两个选择 一个是导入歌单 另一个是导入歌单，
但是现在我导入歌单遥控器不能选择，也就是没办法播放我导入的歌曲了。

**根因（两条，均已用可运行实验取证；脚本在仓库外 `evidence-mylist-focus/`）**

- **(一) 撞名**：`songlistImport.ts` 的 `defaultListName()` 生成 `导入歌单 MM-DD HH:mm`，
  与常驻入口卡的标题 `tvText.importSonglist`（「导入歌单」）**同前缀**；海报卡宽 210、`numberOfLines={1}`，
  截断后开头正是「导入歌单」→ 两张卡肉眼分不清。
  可走到 `defaultListName()` 的路径共 3 条（手机页歌单名留空是常见前提，`lan_input.html` 明写「选填」）：
  ① 纯文本清单且无 `nameHint`（`songlistImport.ts:440`，`name: nameHint || defaultListName()`）；
  ② 洛雪原生文件里 `name` 为空且无 `nameHint`（`createListsFromParsed` 的
  `(nameHint && items.length===1 ? nameHint : item.name) || defaultListName()`，`:290`）；
  ③ 链接导入拿到平台名时**不会**走到（`name` 取自平台歌单名）。

- **(二) 焦点〔本次真正主因〕**：`MyList` 的入口卡宽 460、与歌单卡**同一排**，把歌单卡整体推到屏幕右侧
  「顶部导航条(tab)」正下方。`tvFocusManager.getCandidateScore` 里主轴差 ×1000、**副轴差 ×1**，
  于是顶部 tab 凭「水平上近 3px」就能压过同一排、竖直完全对齐的歌单卡：
  - 1280x720dp(scale 1.0)：入口卡 `--右-->` 落到 tab0「推荐」（328385 分）而不是同排海报卡（353000 分）
    —— 两者中心水平距离只差 25px（tab0 dx=328、海报1 dx=353），谁近谁赢。
  - **「四方向一步都到不了任何歌单卡」这一点，我与 QA 两套模型一致。**
    但「多步绕行后是否**完全**不可达」，两模型**有分歧**，如实并列、不单方面下结论：
    - **我的（工程师）模型**：存在一条 **2 步绕行** —— 从 tab2 按左到 tab1、再从 tab1 按左落到海报卡
      （中间被迫停在导航条上，用户几乎不可能发现）。
    - **QA 的模型**：判为**不可达**。两者差异**只在唯一一个建模假设**上 ——
      「各路 tab 是否共用同一个 `nextFocusDown`」：QA 认为卡片区不在 tab 的 down 链上，
      从 tab 按「下」到不了卡片，于是 2 步绕行的中间那一跳断裂。
    - 共识：**不存在「自然地一步到达」**（用户实际表现就是到不了）；分歧仅限「绕行是否存在」这一条。
      **不要单方面写成「完全不可达」，也不要写成「只剩绕路」。**
    - 本修复（同带优先）**不依赖**这条绕行是否存在 —— 它让「一步直达」在任何情况下都成立，绕行争议自然消失。
  - 反向同样错：tab「排行榜」`--左-->` 落到海报卡，而不是相邻的 tab。
  - 全量扫描（640~2600dp × 密度 1/2 × 歌单数 n）：**按 n 分窗口看**（`focus_geometry_sim.js` 实验 I）：
    `n=1` **76 组，窗口 800~1550dp**；`n=2` 56 组，窗口 1000~1550dp；**`n≥3` 0 组**。
    「只导入一个」时最惨 —— 窗口低到 800dp，把 **960x540dp 也罩住了**
    （960x540dp = 1920x1080 物理 @ 密度 2，是 Android TV 最常见的逻辑分辨率）。
    这也解释了用户为什么「只导入一个就中招」：n=1 时入口卡与唯一那张歌单卡同排 → 下键为空、右键被 tab 抢走
    → 一步都到不了。
    注：数字是**修正建模后**的（换行判定补上换行前的 gap + tab 按钮补上 `Focusable` 基础 `borderWidth:2`）；
    早先漏建这两项时量到 62 组 / 990~1290dp，偏小 —— tab 变宽后 tab0 整体左移、抢焦范围更大。
  用户表现：想把焦点移到导入的歌单卡 → 焦点跳到顶部导航条 → 再按 OK 就跳到「推荐/排行榜」等别的页面
  → 即「遥控器不能选择、没办法播放导入的歌曲」。

**改了哪些文件**

| 文件 | 改了什么 |
|---|---|
| `src/screens/TV/MyList.tsx` | 「导入歌单」入口**保持与歌单卡同排的方形卡**（宽度沿用 460），只把外观改成**虚线边框 + ＋ 号**，与方形歌单卡一眼可分（对**已存在**的旧歌单同样生效）。**刻意不改网格布局** —— 理由见下方「为什么最终不改布局」。**另：给本页 `ScrollView` 补上「聚焦即滚动」**（详见下方「补充：MyList 聚焦即滚动」） |
| `src/components/TV/tvFocusManager.ts` | `moveTVFocus` 新增**同排/同列优先**（`getSameBandCandidates`）：存在与当前目标在「垂直(左右移动)／水平(上下移动)方向有重叠」的候选时，只在它们当中挑，否则退回原打分。安全性质：**同带为空时行为与原来逐字一致**，因此不会让任何原本能移动的按键变成没反应，只会在「跨带抢焦」时改选同一排的目标。**这是焦点问题的唯一必需修复**（`focus_geometry_sim.js` 实验 L：现状引擎 112 组不可达 → 同带优先 0 组） |
| `src/screens/TV/songlistImport.ts` | `defaultListName()` 的 `导入歌单` 前缀改为复用 `tvText.songlist`（「歌单」），自动命名不再与入口卡同前缀 |

**为什么最终【不】把入口改成「独占整行的横幅」（原方案被否）**

一度把入口做成整行横幅（歌单卡回到下一行），焦点上确实也成立。但复核时发现它有**净副作用**：

- 当时 `MyList` 的 `ScrollView` **没有 ref、也没有任何 `scrollTo`**（`MyList.tsx:141`）——
  与 Home / Settings / Detail 都不同，它**没有「聚焦即滚动」**。任何掉到屏幕外的卡片，
  遥控器能聚焦但用户「看不见」（尤其歌单标题）。
  → **该缺口已在本次一并补上**（见下方「补充：MyList 聚焦即滚动」）；补上之后再评价横幅，
  这一条不再是反对理由，但下面两条仍然成立（引擎修复已足够、横幅纯属多余的布局位移）。
- 在 960x540dp 实测垂直预算（`focus_geometry_sim.js` 实验 J）：
  原布局歌单卡标题底边 = 502.6（可见；卡底 552.8 仅溢出 12.8）；
  **横幅布局标题底边 = 615.6 → 掉出屏幕**，封面也只剩 59% 可见。横幅白白多占一整行 ≈ 113px。
- 而焦点问题**根本不需要改布局**：实验 L 全宽扫描证明「同带优先」单独就能全救回来（112 → 0）。
  原理：入口卡与歌单卡同排，`alignItems:'stretch'` 让两者 y 区间**完全相同** → 同带候选恒包含歌单卡
  → 规则必然在「同排」里挑 → 顶部 tab 再也抢不走。

结论：**焦点交给引擎修、布局保持不动**；撞名交给「改名 + 虚线＋号」。三项修复互相独立，任一项单独都成立。

**影响面（改了公共文件，说明清楚）**：`tvFocusManager.ts` 全项目共用，`moveTVFocus` 只被
`TVRemoteFocusController` 的方向键路径调用。两条安全性质：
① **显式 `nextFocus*` 在几何打分之前就短路返回**（`moveTVFocus` 里 `getExplicitNextTarget` 先于候选打分），
带 `nextFocus*` 的控件完全不受影响；② 同带候选为空时 `getSameBandCandidates` **逐字退回原逻辑**，
所以**不会让任何原本能移动的按键变成「没反应」**，只在「同一排/同一列本来就有邻居、却被别的带抢走」时改选。

模拟（`focus_engine_fix_sim.js` 实验二 B）登记的 **11 处**行为变化要**打折看**：其中 **9 处是合成场景**，
与真机可聚焦结构对不上 —— Home 的「品牌区」在真机上是个**不可聚焦的普通 View**，真实 Settings 各控件带
**显式 `nextFocus*`**（走不到几何打分），这两块的「变化」真机上本来就不会发生；真正对应真机的是 **2 处**
（「顶栏 + 内容首卡在左」的同型场景：`card4 →右` 由 tab0 改为同排 `card5`、`card5 →左` 反之）。
此外 **MyList 现状布局自身也有同类真实变化**（实验二 C：1280x720dp 入口卡 `→右` 由 tab0 改为同排海报卡、
tab「排行榜」`→左` 由海报卡改为相邻 tab；960x540dp 入口卡 `→右` 亦然）。

**回归风险**：模拟里 11 处**全部**是「旧选择与起点跨带（无重叠）」的抢焦，方向都是「改到同一排/列的邻居」，
未出现「原本正确却被改坏」的情形（0 处）。**仍无法真机逐屏回归**；若 QA 发现某屏手感变化，
单独回退这一处即可（另两处修复不依赖它）。

**验证**（全部落盘在仓库外 `evidence-mylist-focus/`，UTF-8 可读；含本轮补「聚焦即滚动」后的**重跑**）：
- **tsc**（改动后重跑）：全量 **14 条 error，与 HEAD 基线逐条一致**；我改的 3 个文件 **0 条**；**`error TS2304` = 0**（`tsc_after.txt`）。
- **eslint**（改动后重跑）：用「去掉路径 + 行列号」的归一化比较，改后 11 条 = 基线 11 条，**规则多重集完全相同 → 0 新增**；
  `MyList.tsx` / `tvFocusManager.ts` 两侧都是 **0 problem**，9 条违规全在 `songlistImport.ts` 且均为既有
  （`eslint_diff2.txt` + `eslint_cmp_final.txt`）。
  （注：`run_eslint2.js` 直接用 unix 格式时会把行列号留在文件名后面造成假「新增」，**以 `fix_eslint_compare.js`
  的归一化结果为准**；另外本轮最初 3 条 `no-multi-spaces`（对齐行内注释）是**真新增**，已改为单空格消除。）
- **几何可达性** `focus_geometry_sim.js`：A~H 档位 / 临界宽度 / 抢焦排名；I 按 n 分窗口（76 / 56 / 0 组）；
  **L 证明「同带优先」把 112 组不可达清成 0 组**；J 垂直预算（横幅在 960x540 会把标题顶出屏幕）；
  K tab 宽度敏感度（k≥0.95 都抢焦 —— 不是某个刀刃参数）；
  **N 复刻 `revealCardRow` 实际实现**（详见下方「补充：MyList 聚焦即滚动」）。（`out_geometry_clean.txt`）
- **BFS / 影响面** `focus_engine_fix_sim.js`：实验二 A（现状要 2 步绕导航条）、B（其它界面形态影响清单）、
  C（修复后入口卡 `→右` 直达同排歌单卡）。（`out_engine_fix_clean.txt`）
- **限制**：本机无电视/盒子，**无法真机逐屏回归**；以上均为等价模型模拟。

---

### 补充：MyList 补上「聚焦即滚动」（2026-09-16）

**动机（比「横幅会把卡片推出屏幕」更严重）**：本页 `ScrollView` 原先没有任何滚动管理。
只要歌单 **≥2 张**（网格 `flexWrap` 会换到第二排），**第二排及之后的卡片整张在屏幕外**，
但焦点引擎用 `measureInWindow` 仍量得到（rect 只是 y 越界）→ 焦点能移过去、用户却看不见。
这与用户报的「遥控器不能选择」是**同一类用户可见症状**，且本页设计上就该支持 960x540
（`getTVLayoutMetrics` 为 shortEdge<650 保留 `minScale = 0.9`）。

**实现（镜像 `Home.tsx` 的做法，但多一步 —— 因为 Home 每屏只有一排 `shelf`）**

- `ScrollView` 加 `ref` + `onScroll`（写 `scrollYRef`）+ `onLayout`（写 `viewportHRef`）+ `scrollEventThrottle={16}`。
- `TVGlassPanel` 只透传 `style`/`accent`、**不接受 `onLayout`**，故外套一层透明 `View`
  （ScrollView 直接子节点，其 `onLayout.y` 即相对滚动内容）取 `panelTopRef`。
- 入口卡与每张歌单卡各加 `onLayout`（`recordCardBox` 记 `{y,height}`，去重后写 ref，**不触发重渲染**）
  与 `onFocus`（`revealCardRow`）。入口卡与歌单卡用**不同的 key**（`IMPORT_CARD_KEY` / `mylist_${id}`），
  但它们同排（`alignItems:'stretch'`）→ 记录到的 y/height 相同 → 滚到同一位置，**不会互相弹跳**。
- `revealCardRow`：把「被聚焦那张卡所在的**整排**」滚进视野，且**只滚最小距离**；该排已完整可见时**纯 no-op**。
  注意：**不是**像 Home 那样滚到「面板顶」—— MyList 是多排网格，只滚到面板顶时在 960x540 仍有 5 张卡在屏外（实验 M 实测）。
- **红线**：未新增内联 `ref` 回调（仍走 `getCardRefCallback`）；`onFocus`/`onScroll`/`onLayout` 内联箭头
  只写 ref、不 `setState`（`revealCardRow` 用 `useCallback([])` 稳定）→ **无每帧重渲染**；
  `scrollTo` 只在焦点事件里调用；**未改动 `tvFocusManager.ts`**；`firstCardFocus` 语义未变（入口卡仍 `syncFirst`）。

**验收（实验 N，复刻 `revealCardRow` 实际实现；独立 / 顺向 / 逆向三种聚焦顺序）**

| 档位 | 视口 | 6 张卡 / 3 排 | 1 张卡 |
|---|---|---|---|
| 960x540dp (scale0.9) | 388.8px | 三种顺序下**每一排都完整露出 ✓** | **会滚 54.2px**（见下注） |
| 1280x720dp (scale1.0) | 552px | 每一排都完整露出 ✓ | **纯 no-op ✓**（内容不超高） |
| 1920x1080dp (scale1.2) | 878.4px | 每一排都完整露出 ✓ | **纯 no-op ✓** |

> **960x540dp「1 张卡会滚 54px」的诚实说明**：该档视口只有 388.8px，而**内容本身就高约 493px**
> （页头 122 + 面板内边距 + 单排卡片 ≈285 + 底部留白），即**现状下这张卡的底部本就被裁掉约 43px**。
> 要让「被聚焦的卡完整可见」，滚动是**必需**的 —— 所以这不是回归，而是把原本被裁掉的部分露出来。
> 1280x720 / 1920x1080 两档内容放得下，`revealCardRow` 全程 no-op，外观与现状**完全一致**。
> 若产品坚持「1 张卡在任何档位都不得滚动」，唯一办法是「只有一排时跳过 reveal」——
> 但那会让 960x540 的这张卡**继续被裁**，与「聚焦即完整可见」相冲突；本实现选择后者。

---

## 📋 待办 / 可选

- [x] ~~歌单重命名~~ —— 已做（手机页「歌单改名」+ 电视端改名屏，见上）。
- [x] ~~歌单删除~~ —— 已做（首页长按 OK + 手机页删除按钮，见上）。
- [ ] 歌单**排序**仍未暴露（手机页 / 电视端都还没有拖排序入口）。
- [ ] 局域网歌单导入加 **ack / 回读校验**（增强项）：本轮已让「离开设置页 → 立即停服」，
      手机再提交会**连接失败（诚实报错）**而不是假成功；但若手机在电视卸载的**那一瞬**刚好提交、
      或电视侧业务处理期间出错，仍缺一条端到端 ack。手机页已有 `confirmApplied` 模式可复用。
- [ ] **（回归②，QA 发现）结果弹窗的宿主可能在被压在栈下的不可见页面上，用户看不到即时弹窗。**
      触发：设置页 #A 开二维码（owner=A）→ 电视上按「我的歌单」Tab（RNN push，A **不卸载**）→ 手机提交。
      **数据不丢**（歌单真的导入了，`MyList` 的 `songlistImportResult` 订阅 + `lastSonglistResultCache`
      会在「我的歌单」页显示「上次导入结果：…」），**丢的只是即时弹窗**（弹窗挂在与 owner 同一实例的
      `Settings` 上，而该页此刻不可见）。
      建议：结果弹窗改由「永远可见的宿主」来弹 —— 即去修全局 `showTVDialog`（其 `activeListener` 在
      页面 pop 的 cleanup 里被置 null 且**不再重注册**，所以有时静默失效）。修它能一并解决回归③。
- [ ] **（回归③，QA 发现）两个 `TVDialog` 同时可见时，一次按键会被消费两次。**
      两层机制：① 每个 `TVDialog` 实例各自订阅 `onTVRemoteEvent`、互不知情，两个都 visible 时
      一次 `select` 会让两边按钮都触发（`src/components/TV/TVDialog.tsx:73-96`）；
      ② `setTVDialogActive` 是**单一全局布尔、不是引用计数**，`TVRemoteFocusController` 靠它让路
      （`src/theme/tvFocusManager.ts:279-281`、`TVRemoteFocusController.tsx:37`）→ **关掉一个弹窗会把
      标记置 false，即使另一个还开着**，背景焦点引擎随即恢复处理按键。
      可达场景：电视上正开着音源长按菜单时，手机恰好提交（本页也会弹结果弹窗）。
      建议：把 `setTVDialogActive` 改成**引用计数**。
- [ ] **（残余，本轮修复的边界）owner 关闭 / 离开时会把服务停掉；若此时栈下还压着另一个
      「二维码仍挂着」的设置页，就会出现「下层页二维码看起来正常、服务其实已停」的假存活。**
      触发：A 开二维码 → push B → B 开二维码（owner 变 B，两页共用同一端口）→ B 关二维码 / 返回。
      影响有限（下层页不可见；回到它时再按一次「手机扫码导入」会重新起服务且二维码一致），
      彻底修需要在 `lanSessionOwner` 之外再维护「还有几个页面自称在跑」的引用计数。
- [ ] 导入时若匹配上的歌曲过少，可考虑在电视上给一个「是否仍要保留」的确认弹窗。
- [ ] `TVNavBar.tsx` 的 ref 也是内联箭头（`ref={(node) => { refs.current[index] = node }}`），
      不过它没有「就绪回调」，不会造成死循环，只是每次渲染多一次 detach/attach，暂未改动。
- [ ] 其余 TV 屏（Detail / History / Queue）若仍觉卡顿，可检查是否还有同类内联 ref + 就绪回调的组合。
- [ ] 定时任务：自动检测上游新提交并提醒（尚未确认要做）。
- [ ] **（本轮新发现，未修）顶部 tab 会「就地再 push 一个同名屏」**：`createTVTabs`（`src/screens/TV/utils.ts:23`）
      里每个 tab 的 `onPress` 都是 `Navigation.push`。在「我的歌单」页再点一次「我的歌单」tab 会 push
      出第二个 `MyList` 实例（新 `componentId` / 新 scopeId），旧实例不卸载、其 Focusable 仍在焦点注册表里。
      属「作用域脱管」的温床（`getActiveTarget` 找不到 activeTargetId 时会退化到 `measured.find(preferred)`）。
      建议：当前 tab 的 onPress 改成 no-op（或 `popTo`）。
- [ ] **（本轮新发现，未修）从歌单卡按「上」会落到最左边的 tab「推荐」**，而不是当前 tab「我的歌单」；
      在「推荐」上按 OK 会 `popToRoot` 回首页。原因：卡片与顶部 tab 在水平方向有重叠，所以「同排/同列优先」
      不会改动这一步（它属于「上下移动时水平重叠 = 同一列」的正常判定）。同时 tab 自身没有
      `nextFocusLeft/Right` 之外的显式边，几何上最近的 tab 是 推荐。要改需给卡片的 `nextFocusUp` 显式指向当前 tab。
- [x] ~~**（本轮发现）`MyList` 的 `ScrollView` 没有「聚焦即滚动」**~~ —— **本轮已补**
      （见上「补充：MyList 聚焦即滚动」）。原缺口：`MyList.tsx` 的 `ScrollView` 既无 `ref` 也无 `scrollTo`，
      与 Home（`contentScrollRef` + `scrollTo`）、Settings（两栏 ref）、Detail/History/Queue（FlatList `scrollToOffset`）
      都不一致 → 960x540dp 上「只要歌单 ≥2 个，第二行卡片就整张在屏幕外」。现按 Home 模式补上，
      并**多一步**「露整排」以适配本页的多排 `flexWrap` 网格。
- [ ] **（本轮核实，未修）`TVPosterCard` 的封面在卡片里右偏约 10px 并溢出父容器**：
      `styles.root` 有 `padding: tvSize(8)`、`Focusable` 基础样式有 `borderWidth: 2`，而 `styles.art` 用
      固定的 `cardSize`（210）作为宽高 → 内容盒只有 190，art 从 `x+10` 开始、到 `x+220` 结束，
      比 root 的边框盒（`x..x+210`）右侧多出 10px。实测 `measureInWindow` 量的是 root，导航不受影响；
      纯粹是「聚焦边框与封面错开 10px」的观感问题。`styles.root` 加 `alignItems: 'center'` 即可对齐
      （公共组件，影响 Home/Detail/Queue，本轮未动）。

---

## 维护约定

1. 每完成一项改动，就在「已完成」区加一条，写明：日期、文件、改了什么、是新增还是修改。
2. 新增的文件单独列出 —— 它们不会产生冲突，重做时直接复制回来即可。
3. 修改了上游文件的地方，尽量写清"改了哪一段"，方便重做。
