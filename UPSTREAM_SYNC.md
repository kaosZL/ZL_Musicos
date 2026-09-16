# 上游同步手册

本仓库是 [kaosZL/ZL_Musicos](https://github.com/kaosZL/ZL_Musicos) 的 fork，在此之上加入自己的功能。
这份文档规定**如何跟随上游更新**，以及**哪些东西绝对不能改**。

---

## 一、为什么需要这套规矩

上游仓库的实际活跃度（2026-09-15 实测）：

| 指标 | 数值 |
|---|---|
| 建仓时间 | 2026-06-25 |
| 最新版本 | v1.9.5（2026-09-15 发布） |
| 最近一次推送 | 2026-09-15 09:07（当天） |
| 近一周提交数 | 25+ 次，几乎每天都有 |
| 分支模型 | `dev` 开发 → `master` 发布 |
| tag | v1.8.4-tv ~ v1.9.5，共 10 个 |

上游**更新极快，而且改动高度集中在 TV 端**（最近的提交几乎全是 `fix(tv):` 焦点系统、
弹窗、搜索页音源 Tab、排行榜筛选）。

而我们计划新增的功能，恰好也要动 `src/screens/TV/` 下的文件。
**如果结构不设计好，每次上游更新都会撞车。**

---

## 二、分支模型（两层）

```
上游 kaosZL/master  ──merge──▶  你的 master（只同步，不写代码）
                                        │
                                        └──merge──▶  lulu（你的改动全在这里）
                                                          │
                                                          └──push──▶ Actions 出 APK
```

| 分支 | 职责 | 规则 |
|---|---|---|
| `master` | 镜像上游 | **永远不要在这里提交自己的代码**，保证每次都能 `--ff-only` 快进 |
| `lulu` | 功能分支 | 所有自己的改动都在这里；出包也推这个分支 |

远程配置：

| 名称 | 地址 | 权限 |
|---|---|---|
| `origin` | `git@github.com:soren1985/ZL_Musicos.git` | 读写（自己的 fork，走 SSH） |
| `upstream` | `git@github.com:kaosZL/ZL_Musicos.git` | 只读（别人的仓库，走 SSH） |

> 用 SSH 而不是 HTTPS：本机 `PortableGit` 的 HTTPS remote helper 在受限环境下会
> 报 `remote helper 'https' aborted session`，而 git 调 `ssh.exe` 是通的。

---

## 三、同步上游（上游更新后执行）

```bash
git fetch upstream

# 1) 先把 master 快进到上游最新
git checkout master
git merge --ff-only upstream/master     # 必须成功快进；若报错说明 master 被污染了
git push origin master

# 2) 再把 master 合进功能分支，冲突只可能在这一步出现
git checkout lulu
git merge master
git push origin lulu                    # 推送后自动触发构建
```

### 如果 `git fetch upstream` 之后没有 `upstream/master` 这个引用

某些受限/沙箱环境下 `.git/refs/remotes/` 的写入会被干扰，导致远程追踪分支不落地。
这时绕过它，直接让 fetch 结果落到 `FETCH_HEAD`：

```bash
git fetch upstream master
git checkout master
git merge --ff-only FETCH_HEAD
git push origin master
```

效果一样，只是不依赖远程追踪分支。

### 如果 `lulu` 的冲突解不动

我们的改动很"薄"，所以放弃重来是最省事的策略：

```bash
git checkout lulu
git reset --hard master                 # 丢弃所有本地改动
# 然后照 CHANGELOG.local.md 的台账，把改动重新应用一遍
```

> 这也是为什么必须维护 `CHANGELOG.local.md` —— 它是重做改动的唯一依据。

---

## 四、改动红线（踩了就会天天冲突）

1. **能加新文件就别改老文件。** 必须改时，改动尽量集中在一处、尽量追加而非重写。
2. **不要全文件格式化。** 跑一次 Prettier / ESLint 会制造上千行 diff，之后每次同步都是灾难。
3. **不要改 `package.json` 里的依赖版本。** 上游升级依赖时必冲突。
4. **不要改 `version` / `versionCode`。** 上游每次发版都 bump 这两个字段。
5. **不要动 `android/app/src/main/res/mipmap-*` 和 `drawable*` 图标资源。** 上游 v1.9.4 刚换过全套图标。
6. **不要改 `.github/workflows/build-apk.yml` 的构建步骤**，除非确实必要。

---

## 五、签名：一条不能碰的红线 ⚠️

`android/app/build.gradle` 里，release 构建的签名配置是：

```groovy
storeFile file('debug.keystore')
```

而这个 `android/app/debug.keystore` **是被提交进 git 仓库的**
（`.gitignore` 里有 `*.keystore` 但紧跟一行 `!debug.keystore` 例外）。

这意味着一个非常重要的好事：

> **官方发布的 APK 和你的 APK 用的是同一把签名钥匙，
> 所以你的包可以直接覆盖安装官方版，歌单和设置都不会丢。**

**但前提是：不要动签名配置。**

一旦你换了 keystore、或改了 `signingConfigs`，签名就与官方版本不一致，
以后安装任何新版都必须先卸载旧版，**歌单、收藏、播放历史会全部丢失**。

同时注意 `applicationId` 是 `cn.toside.music.mobile`，与官方完全一致 ——
这也是"能覆盖安装"的前提，所以**不要改包名**。

---

## 六、出包

- 推送 `lulu` 分支 → Actions 自动构建
- 也可以去 `https://github.com/soren1985/ZL_Musicos/actions` 手动点 **Run workflow**
- **fork 仓库的 Actions 默认是关闭的**，第一次要去
  `Settings → Actions → General → 选中 "I understand my workflows, go ahead and enable them"`
  才会跑。
- 产物路径：`android/app/build/outputs/apk/release/*.apk`
- Artifact 保留 30 天，**过期就没了，要下趁早**

---

## 七、日常检查上游有没有更新

```bash
git fetch upstream
git log --oneline HEAD..upstream/master     # 有新提交就会列出来
```

上游的 commit message 是中文且写得很具体（例如
`fix: 排行榜焦点跳跃（Tab下键直达音源行）`），扫一眼就知道改了什么。

**重点盯这几个文件**：`src/screens/TV/Settings.tsx`、`src/screens/TV/Detail.tsx`、
`src/screens/TV/Home.tsx`、`src/screens/TV/Search.tsx` —— 它们是我们要改的，
也是上游改得最勤的。如果上游动了它们，同步时要格外留意。
