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

## 🚧 功能一：歌单导入（链接 / 文本 / 文件）

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
| 清空 store 并广播刷新 | `src/core/list.ts` → `setUserList(userLists)`（触发 `mylistUpdated`） |
| 链接/ID → 数字 ID | 各平台 SDK 的 `listDetailLink` 正则，`getListDetail` 内部自动识别 |
| 高置信度搜索匹配 | `src/utils/musicSdk/index.js` → `findMusic({ name, singer })` |
| TV 端输入通道 | `LanImportServer.java` 的 `onLanAction(action, payload)` 回调 |

---

## ✅ 已完成

### 2026-09-15 · 功能一全部代码落地

#### 新增文件（不产生冲突，重做时直接复制回来）

| 文件 | 作用 |
|---|---|
| `src/screens/TV/songlistImport.ts` | **核心解析/落库逻辑**。导出 `importSonglist(rawText, options)`。三层路径：① `parseLxListFile()` 解析洛雪原生 JSON（`playListPart`/`playListPart_v2`/`playList`/`playList_v2`/`allData`/`allData_v2`/`defautlList`）；② `splitInput()` 拆出链接与「歌名 - 歌手」行，`importFromLinks()` 按域名判定平台后拉全量；③ `matchSongs()` 并发 3 逐首 `findMusic` 匹配（上限 300 行）。最后 `createListsFromParsed()` 建列表 + `setUserList(userLists)` 广播。 |
| `android/app/src/main/java/cn/toside/music/mobile/utils/SonglistImportPayload.java` | 原生层预处理 `/api/songlist` 载荷：base64 解码 → 按内容嗅探（gzip 魔数 / zip·crx 的 `PK\x03\x04`）→ 递归展开 → 文本合并。带预算上限（40 个条目 / 单条目 2MB / 总量 6MB / 递归 3 层），UTF-8 失败回退 GBK。静态方法 `expand(String rawPayload)`。 |

#### 修改的上游文件（冲突时按这里重做）

| 文件 | 改了哪一段 | 冲突风险 |
|---|---|---|
| `.github/workflows/build-apk.yml` | `on.push.branches` 加 `lulu`（原为 `[master, dev]`）。**构建步骤一律未动。** | 低 |
| `android/.../utils/LanImportServer.java` | `serve()` 的 POST 分支里，在 `/api/activate` 之后追加一个 `if ("/api/songlist".equals(uri))` 块：调用 `SonglistImportPayload.expand(payload)` 后 `notify("songlist", ...)`。原三个路由未动。 | 低 |
| `android/app/src/main/assets/lan_input.html` | ① `<title>` 改「ZL-Music 导入」；② 新增「导入歌单」section（`slText` / `slFile` / `slName` / `doImportSonglist` / `songlistMsg`）；③ 新增 JS：`doImportSonglist` / `showSonglistMsg` / `bufferToBase64` / `sniffKind` / `decodeTextSmart`；④ 样式加 `.hint` 与 file input。原有音源导入逻辑未动。 | 低 |
| `src/screens/TV/labels.ts` | 末尾追加 8 个文案键：`mySonglists` / `mySonglistsDesc` / `emptyMySonglists` / `emptyMySonglistsHint` / `importingSonglist` / `importSonglist` / `importSonglistTip` / `userList`。 | 低 |
| `src/screens/TV/types.ts` | `TVDetailPayload` 联合类型追加 `userlist` 分支。 | 低 |
| `src/screens/TV/Settings.tsx` | ① 新增 `import { importSonglist } from './songlistImport'`；② 新增 state `lanMessageOk`；③ `handleLanSourceEvent` 追加 `else if (action === 'songlist')` 分支；④ `handleOpenLanImport` 重置 `lanMessageOk`；⑤ 二维码下方提示文案改一句 + 新增 `lanMessage` 展示行。 | **高** |
| `src/screens/TV/Detail.tsx` | ① `heroMeta` 的兜底分支改为「我的歌单」文案；② `useEffect` 的 loader 抽成 async `load()`，新增 `payload.type === 'userlist'` 分支走 `getListMusics(payload.id)`；③ `handlePlay` 新增 `userlist` 分支走 `playList(payload.id, index)`。 | **高** |
| `src/screens/TV/Home.tsx` | ① 新增 `useMyList` 取用户歌单；② 新增 `myListFocus` / `sectionOffsetRef.mySonglists` / `bindMyCardRef` / `scrollToMySonglists` / `handleMySonglistFocusChange` / `openMySonglist`；③ Hero 按钮 `nextFocusDown` 改为 `heroNextDownHandle`（优先「我的歌单」首卡）；④ 新增「我的歌单」shelf（推荐歌单上方，含空态）；⑤ 推荐歌单卡片 `nextFocusUp` 改为镜像到「我的歌单」同序号卡片。 | 中高 |

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

---

## 📋 待办 / 可选

- [ ] 歌单管理（重命名 / 删除 / 排序）目前仍只有手机端设置页，TV 端未做。
- [ ] 导入时若匹配上的歌曲过少，可考虑在电视上给一个「是否仍要保留」的确认弹窗。
- [ ] 定时任务：自动检测上游新提交并提醒（尚未确认要做）。

---

## 维护约定

1. 每完成一项改动，就在「已完成」区加一条，写明：日期、文件、改了什么、是新增还是修改。
2. 新增的文件单独列出 —— 它们不会产生冲突，重做时直接复制回来即可。
3. 修改了上游文件的地方，尽量写清"改了哪一段"，方便重做。
