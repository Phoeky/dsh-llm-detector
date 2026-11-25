# Changelog

本项目的所有重要变更记录在此。格式参考 [Keep a Changelog](https://keepachangelog.com/zh-CN/1.1.0/)，
版本号遵循 [语义化版本](https://semver.org/lang/zh-CN/)。

## [1.1.2] - 2026-11-25

### 安全与修复

- 将全部 `/api/llm-detector/*` HTTP 路由从 `ctx.webServer.register` 迁移至 DSH 的 `ctx.connection.fetch.register` 认证通道，在 0.2.2 及以下与 0.2.3+ 宿主中均自动受 Host / Origin / `Sec-Fetch-Site` 与浏览器会话 Cookie 校验保护，并明确限定 GET / POST 方法。
- `index.js` 改为按需注入 `connection` 服务（纯 headless 场景仍正常提供 `llm_fingerprint` 工具）。
- `client.js` 发起同源请求时显式携带 `credentials: 'same-origin'`；写操作令牌比对改用 `timingSafeEqual`。

### 测试与文档

- 新增离线路由与鉴权测试 `scripts/routes-test.mjs`。
- 更新 `scripts/ui-flow.mjs` 以支持通过 `DSH_COOKIE` 或 `DSH_CONNECT_TOKEN` 携带已认证会话。
- 同步更新中英文 README 中的扩展点说明与开发命令。

## [1.1.1] - 2026-11-24

### 修复

- **本轮采样期间即可重试失败样本**：不再要求整轮结束；重试会在本轮评分前完成，避免漏掉新证据。
- 修复重试样本在评分时文本为空、被误判为无效的问题（评分等待重试落地）。

### 变更

- 界面移除“出站网络”折叠卡（`lib/proxy.js` 与 `/api/llm-detector/proxy/*` 能力保留）。
- 新增英文 README（`README.en.md`），中英文档互链。

## [1.1.0] - 2026-11-23

### 新增

- **出站代理**：默认直连，可选“系统代理”或“手动代理”（http/https/socks5），并提供“测试连接”。
  代理作用于 DSH 进程内所有出站模型请求，切换后立即生效，选择会保存供下次启动沿用。
- 面板顶部新增 **在 GitHub 上点个 ⭐** 跳转链接。

### 实现说明

- 通过 Host 进程内替换 `globalThis.fetch` 并附加同主版本 undici 的 `ProxyAgent` 实现代理，
  切回直连时恢复原始 `fetch`；不改动任何 provider 配置或凭据。

## [1.0.0] - 2026-11-23

首个稳定版，发布到 npm（[`dsh-llm-detector`](https://www.npmjs.com/package/dsh-llm-detector)）
并创建 GitHub Release。

### 新增

- 可通过插件页输入包名 `dsh-llm-detector` 安装，无需先克隆仓库。
- README 重写为 GitHub 风格：徽章、界面预览、安装/使用说明、原理摘要、鸣谢与许可证。
- 界面示意图（中性深色主题）与 `CHANGELOG.md`。

### 包含此前全部能力

- 左侧边栏检测面板：渠道/模型/轮数/并发/思考强度、实时进度、取消、失败样本单独重试。
- 对话里的 `llm_fingerprint` 工具（`list` / `detect`）。
- 76 模型冻结参考库，闭集排名与校准置信度。

## [0.2.3] - 2026-11-23

### 新增

- 面板可选**思考强度**：通过 `llm.resolveModelInfo` 读取模型支持的档位（low/high/max 等），
  新增 `/api/llm-detector/model` 路由；不支持的模型保持渠道默认。

### 变更

- “两种使用方式”与“如何解读结果”默认收起，点开查看。
- 表单调整为 5 列（渠道、模型、轮数、并发、思考强度）。

## [0.2.2] - 2026-11-23

### 变更

- 面板文案优化：副标题、成本与闭集提示更明确。
- 新增“两种使用方式”卡片（含可复制的对话指令）与“如何解读结果”说明。
- 去掉结果区与页面上方重复的提示。

## [0.2.1] - 2026-11-23

### 新增

- 失败或被取消的样本可**单独重试**：沿用原提示词重新采样，成功后重算该轮排名与置信度。
- 新增 `/api/llm-detector/retry` 路由与 `scripts/retry-test.mjs` 离线测试。

### 变更

- 默认并发改为 3，面板默认展示提示词与原始回答（工具仍默认不附带）。
- 修复已评分轮次中样本编号恒为 0 的问题。

## [0.2.0] - 2026-11-23

### 新增

- 左侧边栏入口与检测面板（React 客户端，注册 `sidebar.panellist` 与 `main`）。
- 同源 `/api/llm-detector/*` 路由，UI 与模型工具共用 `lib/runner.js`。
- 实时样本状态、取消、串行轮询、双语界面、主题 token 样式与无障碍标签。

### 变更

- 异常截断（如 `max-tokens`）只给排名，不按完整样本展示校准置信度。
- 无有效样本时不再伪造序列检查结果。

## [0.1.0] - 2026-11-23

### 新增

- 首个版本：`llm_fingerprint` 工具，移植 lm-detector 的数字指纹算法与 76 模型参考库。
- 经 `ctx.llm.stream` 采样，支持宽松截断、多轮检测与离线评分脚本。
