# AI视频工坊 · 可自由编辑的个人网站

真人AI视频生成工具的展示型网站。**全站内容（页面、文章、图片、视频、音频）都通过 `content.js` 一个文件驱动**，内置可视化后台，无需懂代码即可增删改任何内容，发布到 GitHub Pages 后全球可访问，完全免费。

## 目录结构

```
ai-video-site/
├── index.html      # 前台首页（所有页面在此渲染，地址形如 #/cases）
├── admin.html      # 可视化内容管理后台
├── content.js      # ★ 全站内容数据（唯一需要维护的内容文件）
├── css/style.css   # 样式
├── js/app.js       # 前台渲染引擎
├── js/admin.js     # 后台逻辑
└── media/          # 后台上传的图片/视频/音频存放处
```

## 一、部署到 GitHub Pages（约10分钟，零费用）

### 第1步：注册/登录 GitHub
打开 https://github.com → Sign up（已有账号直接登录）。

### 第2步：创建仓库
1. 右上角 **+** → **New repository**
2. Repository name 填 `my-ai-video-site`（任意，英文）
3. 选择 **Public**（免费版 Pages 需要公开仓库）
4. 不要勾选 "Add a README" → **Create repository**

### 第3步：上传网站文件
1. 在新仓库页面点 **uploading an existing file**
2. 把本文件夹里的所有文件拖进去（index.html、admin.html、content.js、css、js、media 文件夹及内部文件）
3. 点 **Commit changes**

> 也可以用 git 命令行：`git clone` 仓库 → 复制文件进去 → `git add . && git commit -m "init" && git push`

### 第4步：开启 GitHub Pages
1. 仓库页面 **Settings** → 左侧 **Pages**
2. Source 选 **Deploy from a branch**，Branch 选 `main` / `(root)` → **Save**
3. 等待1~2分钟，顶部会显示访问地址：
   `https://你的用户名.github.io/my-ai-video-site/`

### 第5步：生成 Token（让后台能一键发布）
1. GitHub → 头像 → **Settings** → **Developer settings** → **Personal access tokens** → **Tokens (classic)** → **Generate new token (classic)**
2. Note 填 `网站发布`，Expiration 选 `No expiration`（或定期换）
3. 勾选 **repo** 权限 → **Generate token** → **立即复制**（ghp_ 开头，只显示一次）

## 二、日常更新内容（最常用的方式）

1. 打开你的网站地址 + `/admin.html`
   例：`https://你的用户名.github.io/my-ai-video-site/admin.html`
2. 在「发布与备份」页填入 用户名 / 仓库名 / 分支(main) / Token → 保存配置
3. 之后所有操作都是可视化点选：
   - **新建页面**：页面管理 → ＋新建页面（自动出现在导航栏）
   - **加内容**：选页面 → ＋添加区块 → 选「图文文章/卡片/图片画廊/视频集/音频列表/步骤/价格/FAQ」等
   - **传媒体**：点 📁上传 按钮，图片视频音频直接传到仓库，自动填入地址
   - **调整顺序/删除**：每个页面和区块都有 ⬆️⬇️ 上移下移、🗑 删除
4. 改完点顶部 **🚀 发布到GitHub** → 1分钟后网站自动更新

## 三、三种保存方式说明

| 方式 | 效果 | 用途 |
|---|---|---|
| 💾 保存并预览 | 仅本机浏览器可见 | 改完先看效果 |
| ⬇️ 导出 content.js | 下载文件 | 手动替换仓库里的 content.js（Token失效时的备用通道） |
| 🚀 发布到GitHub | 正式上线，所有人可见 | 日常发布 |

## 四、常见问题

- **视频太大传不了？** 单文件别超20MB。大视频先传B站/视频平台，把分享嵌入链接粘贴到视频区块的地址栏即可。
- **后台改了没生效？** GitHub Pages 有1~2分钟缓存；浏览器再按 Ctrl+F5 强制刷新。
- **Token 安全吗？** 只保存在你本机浏览器的 localStorage，不会写进仓库和网站代码。
- **想换网站名/联系方式？** 后台「站点设置」页直接改。
- **想绑自己的域名？** 仓库 Settings → Pages → Custom domain 填入域名，并在域名服务商加 CNAME 记录指向 `你的用户名.github.io`。

## 五、合规提醒

发布 AI 生成内容需遵守各平台标识要求；不得克隆未授权的他人形象/声音；医疗、金融类内容注意宣传红线。内容责任由发布者承担。
