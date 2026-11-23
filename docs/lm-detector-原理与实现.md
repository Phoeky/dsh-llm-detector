# LM Fingerpoint Detector 原理与实现整理

> 项目：<https://github.com/Ikaleio/lm-detector>（MIT）
> 在线站：<https://lm.ikale.io>，文档：<https://lm.ikale.io/docs>
> 本文基于仓库 `main`（2026-11-23 的提交，参考库含 76 个模型）与官方原理文档、源码整理。

---

## 0. 一句话概括

让模型“凭第一反应”写几百个 1–355 的整数，把它写出的“随机数”当成指纹：每个模型偏好的数值、区间和末位分布相对稳定，把这些分布与参考库比对，就能给出“这更像哪个模型”的排名；再用一个可选的**分词器探测**从 API 返回的 token 用量反推上游用的是哪套分词器，作为旁证。

它**不是**身份认证：结果是“参考库内的闭集排序”，库外模型也会得到“最像”的候选。

---

## 1. 要解决的问题与定位

- 中转站 / 第三方 API 常声称提供某个模型，实际接的是另一个模型。
- 常规手段（问知识、看风格）容易被提示词、系统提示、路由参数影响；而这个任务**与语义无关**，只反映模型在“随机取值”上的偏好。
- 三个入口共用同一套算法：
  - 网页（纯前端，可手动粘贴或直连 API）
  - CLI `fpd`（Ink 终端界面，多轮、JSON、图片模式）
  - SDK（TypeScript / Rust / Go / Python，可离线评分或在线检测）

---

## 2. 总体架构

```
             ┌──────────────┐   ┌──────────────┐   ┌──────────────┐
             │  web/ (React)│   │ cli/ (Ink)   │   │ sdk/ 四语言  │
             └──────┬───────┘   └──────┬───────┘   └──────┬───────┘
                    └──────────────┬───┴──────────────────┘
                                   ▼
                        shared/  共享算法（无 React 依赖）
        挑战生成 · 请求/流式解析 · 特征 · 排名器 · 校准 · 分词器探测
                                   │
                 ┌─────────────────┼──────────────────┐
                 ▼                 ▼                  ▼
          data/ 参考库        offline/ 离线重训      worker|api/ 代理
     unified_reference.jsonl   fit/callibrate       /api/proxy
     unified_bank.json         shared_detector.bin
     shared_detector.bin
     enrollment-suite.json
     tokenizer_bank.json
```

关键工程约束：

- `shared/` 不依赖 React、浏览器存储或外层研究目录，网页、CLI 和 TS SDK 共用。
- 网页**只做检测和只读浏览**，不做入库；采样/入库/重训都在 CLI + `offline/`。
- `shared/` 里有两条采样路径：`detection.ts`（网页）与 `detect-request.ts`/`detect-run.ts`（CLI、TS SDK），评分都收敛到 `shared-detector.ts`。

---

# 第一部分：原理

## 3. 挑战（challenge）的设计

代码：`shared/challenge-browser.js`

每轮生成 **3 道**挑战：

| 维度 | 取值 | 说明 |
|---|---|---|
| 数量 | 292–332 中**不重复**抽取 | 避免三道题长度相同 |
| 语言 | 中文 / 英文 / 日文 / 韩文 / 法文，每道独立随机 | 用 `crypto.getRandomValues` 生成 |
| 措辞 | 每种语言多组等价模板随机组合 | opening + request + rules + ending + separator + start |
| 取值 | 1–355（含端点） | 355 是特征维度，也是“可感知”的取值粒度 |

规则部分明确要求：

- 每个位置**单独**凭第一反应选；
- 不要从 1 开始数、不要连续递增/递减、不要等差/循环/重复区块等规则化模式；
- 必须由当前语言模型直接完成，**禁止调用或借助任何工具**（Python、代码执行器、计算器、搜索、API、外部随机数生成器），也不要先写代码；
- 允许重复值，写出后不要回头排序、去重或替换。

为什么要这样设计：

1. **去掉语义**：答案不依赖知识、语言理解或推理，模型只能暴露自己的取值先验；
2. **禁止工具**：否则测到的是程序随机数（均匀分布），不是模型偏好；
3. **多语言与多措辞**：让“提示词造成的整体偏移”成为可被建模的干扰，而不是模型身份特征；
4. **三道题**：单条样本噪声较大，三条才能做置信度校准；同时保留“部分样本只排名”的退化模式。

参考库另用一套**固定的 36 道**挑战（`data/enrollment-suite.json`）：12 种提示环境 × 3 道，数量 218–333，环境差别在于是否附加系统提示词或用户前缀。这样“环境”可以作为可留出的分组。

## 4. 解析与有效性

代码：`shared/fingerprint-core.js` 的 `parseNumbers`

- 用 `/\d+/g` 扫描回答，取出**最长的一段** 1–355 整数；
- 中间出现字母（`\p{L}`）会打断一段序列；
- 越界整数被丢弃，不打断序列。

有效性阈值：

```
有效整数数 ≥ max(80, ceil(期望数量 × 0.55))
```

低于阈值视为拒答/严重截断，不参与评分（`analyzeSharedOutputs` 的 diagnostics 会记录每条样本的 `parsed_numbers`、`minimum_numbers`、`accepted`）。

## 5. 特征：一个回答变成两块（共 429 维）

代码：`shared/fingerprint-core.js`、`shared/positional.ts`

### 5.1 数值分布：355 维 Hellinger 嵌入

对 355 个取值的计数 `c_i` 做平滑（α = 0.5）后开平方：

```
φ_i = sqrt((c_i + α) / (Σc_j + 355α)),  α = 0.5
```

这样特征向量的欧氏距离与 Hellinger 距离成正比，适合做线性判别与余弦相似度。

### 5.2 位置与末位：74 维

- 序列均分 4 段，每段统计 16 个取值区间（每桶先验 0.5，开平方归一化）；
- 末位数字 0–9 的分布（同样平滑后开平方）；
- `4 × 16 + 10 = 74` 维。

### 5.3 位置核（仅位置判别头使用）：102 维

`positionKernel`：

- 24 个数值 RBF 中心（1 到 355 均匀分布，σ = 20）；
- 10 个末位指示；
- 每个特征乘 3 个相对位置多项式基 `t`、`P2(t)`、`P3(t)`（t 从 -1 到 1），按序列长度取平均；
- `(24 + 10) × 3 = 102` 维。

含义：某类数字更常出现在开头、中间还是结尾。

### 5.4 序列特征（仅位置判别头使用）：220 维

`sequenceFeatures`：

| 子块 | 维数 | 内容 |
|---|---:|---|
| 滞后统计 | 48 | 8 个滞后（1,2,3,5,8,13,21,34）× 6 个量：lag 相关、平均 |Δ|/355、上升比例、相等比例、|Δ|≤5、|Δ|≤20 |
| 值域转移 | 64 | 8 个取值区间的转移矩阵，去掉边际（中心化） |
| 末位转移 | 100 | 末位 0–9 的转移矩阵，去掉边际 |
| 涨跌形态 | 5 | 符号延续、差值相等、末位相同、z 步长 >1、>2 |
| 短窗覆盖 | 3 | 窗口 4/8/16 内不同值桶的覆盖率 |

合计 `48 + 64 + 100 + 5 + 3 = 220` 维。

### 5.5 两块基础特征的拼接

数值分布与位置/末位分别标准化、单位化，按权重 `0.75 : 0.25` 拼接（代码里对每块先乘 `sqrt(weight)`）。这个 429 维向量是频率排名与近邻、中心方法共用的“基础特征”。

## 6. 语言模型回答检查（反程序生成）

代码：`shared/shared-detector.ts` 的 `sequenceShape`

排名之前，先看相邻数字的变化方式。参考库中的 LLM 回答通常：

- 相邻数字的 **lag-1 自相关明显为负**（在相距很远的数值间来回跳）；
- **相差不超过 20 的相邻步较少**；
- 并且在**间隔 1/2/3 个位置**的数对中，相近数对也很少（有些模型刻意避免附近取值，lag-1 信号弱）。

对每条有效回答计算三个指标，在有效回答之间取**中位数**：

| 指标 | 界限 | 说明 |
|---|---|---|
| lag-1 自相关 | −0.23 | 高于该值说明“太平滑” |
| 相邻小步占比（\|Δ\|≤20） | 5% | 高于该值 |
| 1–3 位内相近数对占比 | 7% | 高于该值 |

**只有三个中位数都超出界限**时才判定“不像语言模型回答”，不给排名和置信度（`decision = 'not_model'`）。前两个界限来自参考库按环境分组的三条回答组的 99.5% 分位。

这只是一个**序列形态筛选**：通过检查也不等于确认由 LLM 生成。

## 7. 排名器：两组分数各一半

代码：`shared/shared-detector.ts` 的 `rankSharedNumbers`、`offline/train.ts` 的 `fitRanker`

最终排名分数：

```
s = 0.5 · z(f) + 0.5 · z(q)
f = 0.5 · z(LDA128) + 0.25 · z(kNN7) + 0.25 · z(去干扰中心)
```

其中 `z(·)` 表示在候选模型之间标准化。

### 7.1 频率分数 f 的三项

**(a) LDA（前 128 个整数）**

- 只取每条回答的**前 128 个整数**，提取 355 + 74 维基础特征；
- 用训练好的判别权重 `lda_weights / lda_bias`（收缩 0.05、等类协方差）投影；
- 每条回答得到一组判别值，在候选间 z 标准化，多条回答取平均。

用前缀而不是全长，是为了降低长序列后段漂移和截断差异的影响。

**(b) 近邻 kNN7**

- 对每个候选模型，取与该模型参考回答最近的 **7 个平方距离**的平均；
- 对多条回答取**中位数**，再取负（距离越小分越高）并 z 标准化。

**(c) 去干扰中心（nuisance-Hellinger / ordered-block）**

- 建库时用各环境的均值偏移做 SVD，估计**至多 2 维**的干扰子空间（`nuisance_basis`）；
- 评分时先把标准化特征投影掉该子空间，再与各模型中心做余弦相似度；
- 位置分段特征还会与**各环境下的模型模板**比较（`environment_centroids`），取最大值作为“最匹配环境”的模板分；
- 模板分与去干扰中心分各 0.5 合成。

含义：同一模型在不同系统提示/前缀下分布会整体偏移，这个低维子空间把偏移吸收掉，剩下的才是身份信息。

### 7.2 位置/顺序判别分数 q

用 4 块特征共 **751 维**（355 + 74 + 102 + 220），块权重为 `[0.6, 0.15, 0.125, 0.125]`，每块标准化、单位化后乘 `sqrt(weight)` 拼接。

- 收缩系数 **0.5** 的 LDA（非等类协方差，`fitDiscriminant(..., 0.5, false)`）；
- 每条回答的判别值先在候选间 z 标准化，再对多条回答取平均。

### 7.3 融合与训练约束

- `blend = { frequency: 0.5, positional: 0.5 }`（代码中为常量）；
- 两组分数的权重和 LDA 收缩系数，按参考库的**环境留一交叉验证**选定，固定评估集不参与选择；
- 排名分数必须全部有限，否则报错重试。

## 8. 置信度校准

代码：`shared/shared-detector.ts` 的 `calibrateRanking`、`offline/math.ts` 的 `fitTemperature`、`offline/calibrate.ts`

置信度是**参考库内的温度 softmax**：

```
p_k = exp(τ·s_k) / Σ_j exp(τ·s_j)
```

- 只有三条回答都有效、且 `shared_detector.bin` 中的校准与当前检测器匹配时才计算；
- τ 由 `fpd retrain` 离线拟合；
- 校准是闭集概率：所有候选合计 100%，**不包含库外模型**，也不是“确实是该模型”的概率。

### 校准流程（`offline/calibrate.ts`）

1. 先逐一留出 12 种环境，再两两留出，共 **78 次**重新拟合排名器；
2. 用留出结果拟合温度 τ（对 `scores × τ` 做 softmax，最小化多分类 NLL；NLL 对正温度是凸的，二分求解，范围 [0.001, 1000]）；
3. 再做**嵌套留出**：外层留出的环境，在每一折内层排名器和温度拟合中都必须排除；
4. 验收门限：
   - 嵌套留出的二元 NLL **低于常数基线**；
   - 嵌套 AUC **大于 0.75**；
5. 通过才原子替换 `shared_detector.bin`；失败则保留旧参数，提示重训不生效。

### 绑定关系（防止数据/参数错配）

- `shared_detector.bin` 里记录 `bank_built_at`、`model_ids`、`response_counts`，与 `unified_bank.json` 一致才允许评分（`supportsSharedDetector`）；
- 检测器记录 `source_reference_sha256`（参考库哈希）与 `base_sha256`（rankener 文件哈希）；
- 校准头再绑定这两个哈希和模型 ID 列表；任何一项不匹配，只给排名、不给置信度；
- 不一致时 `fpd` 直接报错，要求先 `fpd retrain --data-dir DIR`。

## 9. 为什么这套指纹有效（机制解释）

1. **LLM 的“随机”不是均匀随机**：它们有稳定的数值偏好（常见数字、区间、末位、起始段），且同一模型在不同温度/提示下偏好结构相对稳定；
2. **环境偏移是低维的**：系统提示、用户前缀、推理强度主要造成整体平移，SVD 估出的 ≤2 维子空间足以吸收；
3. **顺序信息有区分度**：模型在“跳多远”“是否避免相近值”“末位转移”上差异明显，程序随机数/排序/打乱会破坏这些统计；
4. **闭集 + 校准**：只回答“在库内更像谁”，并用留出环境校准概率，避免把“库外模型”硬说成某个已知模型。

## 10. 分词器探测（可选，默认关闭）

代码：`shared/tokenizer-bank.ts`、`tokenizer-usage.ts`、`tokenizer-posterior.ts`、`tokenizer-probe.ts`

### 10.1 要测什么

不同模型家族用不同分词器（把文本切成 token 的规则）。接口在 `usage` 里报告的**输入 token 数**可以作为旁证：它反映上游计算 token 的方式，与模型“怎么回答”无关。

### 10.2 差分计数

每个请求只含一条用户消息：

```
固定前缀 P + 测试文本 t_j + 固定后缀 S
```

实际取值：`P = "Reply with OK.\n<<<\n"`，`S = "\n>>>"`。前缀以非空白开头、后缀以非空白结尾，聊天模板裁掉首尾空白也不影响计数。

对照请求只发 `P + S`。取差值：

```
x_j − x_0 = count(P t_j S) − count(P S)
```

聊天模板、注入的系统提示、特殊 token 等隐藏内容在差值中抵消。

字段读取：

- Chat Completions：`prompt_tokens`（含缓存）；
- Responses：`input_tokens`；
- Messages：`input_tokens + cache_creation_input_tokens + cache_read_input_tokens`；
- 流式：Chat Completions 加 `stream_options.include_usage`；Messages 读 `message_start` / `message_delta`；Responses 读 `response.completed`；
- 后续事件里 `null` 字段不覆盖已读计数；读到协议终止事件且已有用量就立即结束读取。

### 10.3 分词器库

`data/tokenizer_bank.json` 由归档工具 `llm-tokenizer-fingerprint` 离线生成：

```
290 个开源分词器 → 280 条候选文本逐一算差值
  → 计数完全相同的归为一类 → 同谱系仅少数文本不同的再合并
  → 62 类 → 贪心挑选 72 条测试文本（尽量让每两类被 3 条文本区分）
```

- 类内成员在个别文本上的不同计数保留为 `alternatives`，判定时任一取值都算吻合；
- 72 条文本覆盖中日韩、印度诸文字、东南亚、西里尔、阿拉伯、希伯来、希腊、亚美尼亚、格鲁吉亚、拉丁、代码、空白、符号、emoji、结构化文本；
- 另有厂商型号映射 `api_models`（8 条，其中 2 条 `class: null` 表示厂商未公开分词器）。

### 10.4 后验：三类假设

| 假设 | 先验 | 含义 |
|---|---:|---|
| 已收录的某一类 | 0.8 | 上游就是该类分词器，偏差只来自少见测量误差 |
| 与某类相近的未收录分词器 | 0.1 | 相当一部分文本的计数与该类不同（衍生/扩展版本） |
| 与所有类都无关的分词器 | 0.1 | 每条文本差值服从所有类的平滑分布 |

单条文本的残差 r（实测差值与该类最近允许取值之差）用**带下限的两段离散拉普拉斯混合**：

```
ℓ(r) = log( (1−ρ)·g_{0.02}(r) + ρ·g_{0.85}(r) + 1e−6 )
g_p(r) = ((1−p)/(1+p)) · p^{|r|}
```

- 窄段（p = 0.02）对应精确吻合，宽段（p = 0.85）吸收偶发偏差，下限让一次异常最多扣有限证据；
- 污染率 ρ 在一组取值上求边缘：已收录类 0.02/0.06/0.15（权重 0.4/0.4/0.2），相近类 0.2/0.4/0.7（0.3/0.4/0.3）；
- 隐藏内容长度在对照请求附近 **±3 token** 的窗口上求边缘；
- 对照请求本身直接观测隐藏内容，用固定污染率，避免“漂移的 overhead 被当成未收录证据”。

### 10.5 自适应挑选测试文本

每一批挑选“最能分开还分不清的候选”的文本。每个候选类提供两个原子：

- “恰好是该类”，权重 = 该类后验；
- “该类的未收录近亲”，权重 = 该近亲后验；
- 另外还有“无关分词器”原子；每一类自成一组，近亲与无关分词器同属“未收录”组。

准则（成对 Bhattacharyya 上界）：

```
F(S) = Σ_{a<b, g(a)≠g(b)} sqrt(ŵ_a ŵ_b) · (1 − Π_{j∈S} BC_j(a,b))
```

- `BC_j(a,b)` 是两个原子在文本 j 上预测分布的重叠程度，重叠越大越分不开；
- 该量是 MAP 错误率的上界，且**单调次模**，所以逐条贪心选择保证不差于最优批次的 `1 − 1/e`；
- 计数精确时退化为等价类边切割（EC²）；
- 第一个回答之前所有类等权，只用“恰好是该类”原子；之后只取后验最高的 **24 类** + 无关分词器参与规划。

停止条件（任一）：

1. 至少回答 4 条后，排名第一类的 `exact` 后验或“未收录”总后验达到 **99%**；
2. 最佳批次对上界的改进小于 **1e−4**；
3. 达到测试文本上限（默认 20 条）。

最后再发一次对照请求；两次计数不同说明上游有长度可变的隐藏内容，结果带上提示（`baseline_drift = true`）。

### 10.6 判定与核对

| 判定 | 条件 | 报告的概率 |
|---|---|---|
| `exact` 完全一致 | 某类后验 ≥ “未收录”总和 | 恰好是该类的概率 |
| `related` 接近已收录的类 | 某类近亲后验 ≥ 无关分词器后验 | 是该类近亲的概率 |
| `unknown` 未收录 | 其余情况 | 任一未收录分词器的概率 |

与所填模型核对：

- 模型名去掉供应商前缀和 `:tag` 后缀；
- 先按厂商型号映射（`api_models`）匹配：厂商公开了分词器时，**只算 `exact`**，未收录近亲不算吻合；
- 否则按类的别名匹配：开源谱系可能有重训练变体，`exact + related` 都算；
- 映射为 `null`（厂商未公开）时用“未收录”的后验；
- 概率 ≥ 0.9 为一致，≤ 0.1 为不一致，其余为“还不能确定”。

### 10.7 与排名的关系

- 探测与第一轮取样**并行**，每轮样本完成即评分，**不等待探测**；
- 探测结果单独显示，**不进入**排名和置信度；
- 默认多发约 12 个请求，最多 `max-probes + 2`（默认 22）；
- 局限：很多模型共用同一种分词器；中转站可能用 tiktoken 在本地估算用量（会测成 o200k_base/cl100k_base）；上游不报用量或改了计数就无法探测。

---

# 第二部分：实现

## 11. 仓库结构与职责

| 目录 | 职责 |
|---|---|
| `shared/` | 挑战生成、请求/流式解析、特征、排名器、校准、分词器探测；无 React 依赖 |
| `web/` | React + shadcn/ui + Tailwind 的检测站与只读参考库；HashRouter；纯前端评分 |
| `cli/` | `fpd`（Bun + Ink）：检测、分词器探测、采样、入库、重训 |
| `offline/` | 离线建库/重训/校准（TypeScript，Node 或 Bun 工作线程） |
| `sdk/` | TS / Rust / Go / Python SDK 与跨语言一致性测试数据 |
| `data/` | 参考样本、派生库、冻结检测器、固定挑战、分词器库 |
| `worker/`、`api/` | 代理实现与同源入口（Vercel / Cloudflare Pages / Vite dev 共用） |
| `docs/` | Fumadocs 文档站 |

`shared/` 模块表（官方文档版）：

| 模块 | 职责 |
|---|---|
| `challenge-browser.js` | 检测挑战生成 |
| `completion-request.ts`、`completion.ts`、`detection.ts` | 请求体、响应解析、网页检测流程 |
| `detect-request.ts`、`detect-run.ts` | CLI 与 TS SDK 的在线检测：地址、单次采样、整轮评分 |
| `fingerprint-core.js` | 数字特征与基础评分 |
| `shared-detector.ts` | 冻结的排名器与置信度校准 |
| `detector-codec.ts` | `shared_detector.bin` 的编解码 |
| `builder.ts` | 从参考样本离线建库（拒绝评估标记样本） |
| `positional.ts` | 位置核与序列特征、位置判别头 |
| `tokenizer-*.ts` | 分词器库校验、用量读取、后验与探测流程 |
| `cache-dir.ts` | CLI 更新检查与 SDK 参考数据的缓存目录 |
| `sample-distribution.ts` | 标记最小有效数字 ≥200 的异常样本（只提示，不参与评分） |
| `privacy.ts`、`types.ts` | 脱敏与公共类型 |

## 12. 数据文件

| 文件 | 内容 |
|---|---|
| `data/unified_reference.jsonl` | 参考批次，每行一个 version 1 批次：模型、渠道、请求参数 + `samples` 数组 |
| `data/unified_bank.json` | 由参考批次派生的统计库（模型清单、计数、干扰基、模板中心、历史校准） |
| `data/shared_detector.bin` | 冻结的排名器 + 校准参数（二进制，JSON 头 + float32）；用 SHA-256 绑定参考数据 |
| `data/enrollment-suite.json` | 36 道固定采样挑战（12 环境 × 3），是采样输入，不是参考回答 |
| `data/tokenizer_bank.json` | 分词器探测：测试文本、每类计数、厂商型号映射 |
| `data/collections/` | 采样请求、尝试与来源核验记录，不参与评分，不复制到网页公开数据 |

实测规模（本次拉取的 `main` 数据）：

- 参考库：**76 个模型，2812 条训练行**（76 × 12 环境 × 3 = 2736 条进入固定评估面板，其余是带额外条件/前缀变体的记录）；
- 干扰子空间：`complete_environments = 3`、`nuisance_rank = 2`；
- 分词器库：**62 类 / 72 条测试文本**，源 290 个分词器、280 条候选文本，生成于 2026-09-30。

批次格式要点：

- 批次：`schema_version`、`id`、`purpose`（必须为 `reference`）、`created_at`、`model{id,family,family_name,display_name?}`、`source{channel,endpoint}`、`request{model,format,stream,reasoning_effort,response_models,...}`、`plan{suite_sha256,challenge_ids}`；
- 每条 sample：`id`、`challenge_id`、`condition`、`prompt`、`expected_count`、`attempt`、时间、`actual_channel`、`response_model`、`text`、`completion`（`complete`/`truncated`/`unknown`）、`usage`、`note`、`evidence_path`；
- 不保存重复模型标签、`strict_valid`、派生数字统计；算法用 `condition` 作干扰分组；
- `parseReference` 拒绝评估批次（`test_set_id` / `purpose != reference`）进入参考库。

## 13. 在线检测实现

### 13.1 请求与协议

代码：`shared/completion-request.ts`、`detect-request.ts`、`detection.ts`

- 三种协议：`chat_completions`、`responses`、`messages`；
- 请求体：
  - Chat Completions：`messages` + `max_tokens: 8192` + `stream`；流式时加 `stream_options.include_usage`；
  - Responses：`input` + `max_output_tokens: 8192` + `store: false`；
  - Messages：`max_tokens: 8192`（该 API 要求）+ `system`；
- 推理强度：
  - Responses → `reasoning.effort`；
  - Chat Completions → `reasoning_effort`（华为云 MaaS `openpangu-*` 且 `effort: none` 时发 `chat_template_kwargs: {thinking: false}`）；
  - Messages → `thinking: {type:"adaptive"}` + `output_config.effort`（`none` 时 `thinking: {type:"disabled"}`）；
- 服务等级：Messages 用 `speed` + `anthropic-beta: fast-mode-2026-02-01`，其他用 `service_tier`；`default` 不发送；
- 端点补全：只写主机名时用 `/v1`；已带端点则沿用；`--api` 与端点末尾不匹配时报错；
- 图片模式：提示词画成灰度 PNG（宽、字号、行距、边距、深浅每次随机），Chat Completions 用 `image_url`、Responses 用 `input_image`（`detail: "auto"`）、Messages 用 base64 `image` 块；图片后只附一句多语言通用说明。

### 13.2 流式解析与截断

代码：`shared/completion.ts`、`shared/detect-request.ts`

- SSE 按 `\r\n\r\n | \n\n | \r\r` 分帧，取 `data:` 行拼接后解析 JSON；
- 三种协议的增量字段分别处理（`delta.content`、`content_block_delta`、`response.output_text.delta`）；
- 宽松模式（默认）：流式收到要求数量的**完整**整数就停止解析并标 `Capped`；末尾可能是未完成的数字（如 `3` 会变成 `355`），所以计数时先去掉末尾连续数字；JSON 响应超量时在收到后裁剪；
- 严格模式（`--strict`）：不发数量上限，要求上游自然完整结束，3 条都成功才评分；
- 完成度判定：`finish_reason`/`stop_reason`/`status` 决定 `complete` / `truncated` / `unknown`；
- 截断后仍短暂读取以获取 `usage`（`USAGE_GRACE_MS`），但不再改变已接受的文本；
- 超时：SSE 只对**第一个非空数据块**计时（收到头部不算），之后不再有时限；JSON 模式整包计时；CLI 默认 120 s，`shared` 里 `COMPLETION_TIMEOUT_MS = 250000` 用于网页/通用请求；
- 取消：`AbortSignal` 组合，取消前收到的样本保留。

### 13.3 轮次编排

代码：`shared/detect-run.ts`、`cli/detect-run.ts`

- 每轮生成 `count` 道挑战（默认 3），`parallel` 个 worker 并发取样（1–3）；
- 每轮**等全部样本结束**（包括失败）才评分，再进入下一轮；轮间不重试；
- 评分：`scoreRound` → `analyzeSharedOutputs(bank, detector, {allowPartial: !strict})`；
- 结果分支：
  - 3/3 有效 + 序列检查通过 → `Calibrated ranking`（有置信度）或 `Uncalibrated ranking`（校准不匹配，只有排名）；
  - 1–2 条有效且非严格 → `partial` 排名（无置信度）；
  - 0 条有效 / 严格不齐 → `unscorable`；
  - 序列检查失败 → `not_model`（不排名）；
- 分词器探测在第一轮旁启动，取 `parallel > 1 ? 4 : 1` 并发；`runDetection` 在最后一轮后**等待探测结束**再退出（结果已最终，探测被取消也保留结果）。

### 13.4 结果对象

`Analysis` 关键字段：

- `prediction` / `prediction_name`、`family_prediction_name`；
- `results[]`：每个候选的 `score`、`probability`（闭集概率）；
- `probability_status`：`reference_calibrated` / `unavailable`；
- `decision`：`partial` / `unscorable` / `not_model` / 正常（无该字段）；
- `diagnostics[]`：每条样本的解析数、最小值、是否接受、越界数；
- `sequence`：三项序列指标与 `model_like`；
- `calibration`：方法、τ、校准哈希。

`--output` 保存全部轮次、请求设置、挑战、收到的文本和结果（不含凭据）；`--input` 可离线重算（严格模式会拒绝 `truncated` / `unknown` 样本）。

## 14. 评分代码映射（函数级）

| 环节 | 文件 | 函数/常量 |
|---|---|---|
| 常量 | `shared/fingerprint-core.js` | `VALUE_MIN=1`、`VALUE_MAX=355`、`ALPHA=0.5` |
| 解析 | `fingerprint-core.js` | `parseNumbers`、`countNumbers` |
| 数值特征 | `fingerprint-core.js` | `hellingerFeature`、`orderedBlockFeature` |
| 基础评分 | `fingerprint-core.js` | `robustScoreCounts`、`robustScoreNumbers`、`orderedBlockScores` |
| 位置核/序列 | `shared/positional.ts` | `positionKernel`、`sequenceFeatures`、`positionalDecision`、`POSITIONAL_WEIGHTS` |
| 排名 | `shared/shared-detector.ts` | `rankSharedNumbers`、`nearest`、`baseline`、`transform` |
| 序列检查 | `shared-detector.ts` | `sequenceShape`、`nearbyPairShare`、`SEQUENCE_LIMITS` |
| 置信度 | `shared-detector.ts` | `calibrateRanking` |
| 入口判定 | `shared-detector.ts` | `analyzeSharedOutputs`、`supportsSharedDetector` |
| 建库 | `shared/builder.ts` | `prepareReferenceRows`、`fitRobustBank`、`buildBank` |
| 训练 | `offline/train.ts` | `fitRanker`、`prepareTrainingRows` |
| 数学 | `offline/math.ts` | `fitTransform`、`fitDiscriminant`、`fitTemperature`、`softmax` |
| 校准 | `offline/calibrate.ts` | `calibrate`、`binaryMetrics` |
| 重训主流程 | `offline/retrain.ts` | `retrain`（校验 → 训练 → 78 折校准 → 冻结 → 原子写） |
| 编码 | `shared/detector-codec.ts` | `encodeDetector`、`decodeDetector` |
| 分词器后验 | `shared/tokenizer-posterior.ts` | `tokenizerPosterior`、`nextProbes`、`tokenizerVerdict`、`probingDone` |
| 分词器探测 | `shared/tokenizer-probe.ts` | `probeTokenizer`、`probeBody` |
| 用量读取 | `shared/tokenizer-usage.ts` | `readUsage`、`inputTokens` |

## 15. 二进制检测器格式

`data/shared_detector.bin`（`shared/detector-codec.ts`）：

```
u32 头长度（小端） | UTF-8 JSON 头 | 0–3 字节对齐填充 | float32 数值区
```

- JSON 头里每个纯数字数组被替换为 `{"$f32": offset, "n": length}`；
- 标量保留完整精度；
- float 字节**按位置分组**（先所有第 1 字节，再所有第 2 字节……），比交错排列更容易被 zstd 压缩；每个 float 小端；
- 解码时按头里的偏移与长度还原成数组。

## 16. 离线流水线：采样 → 入库 → 重训

代码：`cli/sampling.ts`、`cli/enrollment.ts`、`cli/retrain-command.ts`、`offline/*`

### 16.1 采样 `fpd sample`

- 固定 36 道挑战；`--count` 可缩小计划；默认并发 3；每题累计尝试上限 `--max-attempts`（默认 3）；
- 回答达到 500 个整数即截断读取（防止循环），记录为 `truncated` 并正常采用；
- 目录结构：`manifest.json`（冻结设置与计划）、`attempts/`、`trace/`（真实请求与原始响应）、`selections/`（手工选择）、`attempts.jsonl`、`result.json`；
- 可续采（`--resume`）、单题覆写提示词/推理强度（带 `note`）、显式采用截断回答（`--adopt qid:attempt --take N`）；
- 渠道（channel）表示采集路径，不是模型家族：`codex-subscription`、`kimi-code-subscription`、`openrouter/anthropic`、`openrouter/google-vertex/us` 等；固定 OpenRouter 供应商时核对回报的供应商名；
- 返回模型必须在 `--response-model` 别名列表内。

### 16.2 入库 `fpd enroll`

- 重新解析原始响应，校验请求/文本/型号/批次哈希/正式库哈希；
- 去重后重建 `unified_reference.jsonl` 与 `unified_bank.json`；
- 写入用锁 + 可恢复事务，收据与备份在目标目录 `.enrollments/`；
- 随 CLI 安装的参考库只读；入库不会自动重训，入库后检测会因库/检测器不匹配而报错，直到 `fpd retrain`。

### 16.3 重训 `fpd retrain`

1. 校验参考库与指纹库哈希一致；
2. 在 `.training/<时间戳>-<uuid>/` 下保存计划、**冻结源码**（对每个源文件算 SHA-256）与旧检测器备份；
3. 拟合排名器（`fitRanker`）→ `fit/ranker.json`；
4. 78 折环境留出校准（`calibrate`）→ `plan.json`、`fold-*.json`、`metrics.json`、`oof.jsonl`、`calibration.json`、`completion.json`；
5. 若验收通过，检查训练代码/候选参数/校准文件/各折文件哈希均未变化，再原子替换 `shared_detector.bin`；
6. 任何一步失败都保留原参数，并输出证据目录。

实现细节：`offline/` 直接用 Node 或 Bun 运行 TypeScript，数值库 `ml-matrix` 随 CLI 打包，**不需要 Python**；工作线程负责训练，主线程负责目录锁续期与取消。

## 17. 网页与 SDK 的实现差异

**网页 `web/`**

- 纯前端：挑战生成、特征、排名都在浏览器完成；参考库以 zstd 静态分段 + 清单下发（构建时 `scripts/sync-data.ts` 校验、脱敏、压缩）；
- 支持手动粘贴（无 API Key）和 API 直连（四种连接方式：自动/直连/本站代理/自建 Worker）；
- 结果区按排名列出候选与置信度；第一候选 < 75% 提示“置信度不足”；
- 可导出 PNG（不含密钥、地址、模型 ID、回复正文）与 JSON；样本库页面可浏览/筛选/导出 JSONL（导出前脱敏）。

**SDK `sdk/`**

- 四语言同功能：离线评分 `analyze`、生成挑战、在线单轮检测；
- 不做分词器探测和图片模式，也不做多轮（需要时自行循环）；
- 安装包不带数据：首次 `loadDetector()` 下载约 3.6 MB 压缩参考数据并缓存，数据更新无需升级 SDK；
- 四种语言用共享测试数据做一致性检查（`bun run sdk:check`）。

## 18. 关键设计取舍

| 取舍 | 理由 |
|---|---|
| 固定 1–355、约 300 个数 | 维度可控（355 桶），足够暴露分布差异，又不至于让模型跑飞 |
| 只用数字，不看语义 | 规避知识/风格/提示词内容差异，降低“演技”空间 |
| 多语言、多模板挑战 | 把提示词差异变成可建模的干扰，而非噪声 |
| 三条回答 | 校准与稳定性；同时支持 1–2 条的“只排名”降级 |
| 环境留出（12 环境 × 3） | 校准/选参必须泛化到未见提示环境，防止过拟合 |
| 闭集 + 温度 softmax | 概率可解释为“库内相对可信度”，明确不覆盖库外 |
| 分词器探测独立 | 两种证据（输出偏好 vs token 计数）不混在一起，避免互相污染 |
| 只读参考库 | 网页不能写入，防止污染正式数据 |

## 19. 局限与正确用法

- 结果是**参考库内的封闭集合排序**；库外模型也会得到“最像”的候选；
- 排名分数和置信度**都不是身份证明**；同名结果只能作为支持证据；
- 某些模型的指纹天然接近（例如同源/蒸馏/同分词器家族），可能互相混淆；
- 中转站可能间歇性替换模型，单次检测无法可靠发现；
- 参考库用文字提示词采集，**图片模式**结果可能偏离文字模式；
- 分词器探测：共用分词器很常见；本地 tiktoken 估算会测成 `o200k_base`/`cl100k_base`；上游不报用量、改计数则无法探测；
- 建议：固定请求参数（推理强度、服务等级、流式/非流式）、重复多轮、结合其他证据（响应头、错误格式、延迟、计费）一起判断。

## 20. 复现/使用速查

```bash
# CLI 检测（3 轮，保存报告，含分词器探测）
npx lmfpd@latest -b https://api.example.com/v1 -k sk-xxx -m gpt-6-astra -a cc -n 3 --tokenizer --output result.json

# 离线重算
npx lmfpd@latest --input result.json --json

# 采样 → 入库 → 重训（维护参考库）
fpd sample --baseurl https://openrouter.ai/api/v1 --api cc --model provider/model \
  --label my-model --family my-family --family-name 'My Family' \
  --channel openrouter/provider-route --response-model provider/returned-model \
  --output-dir ./my-run
fpd enroll ./my-run --data-dir ./reference-data --dry-run
fpd enroll ./my-run --data-dir ./reference-data
fpd retrain --data-dir ./reference-data
```

```ts
// SDK：离线评分
import { loadDetector } from 'lmfpd-sdk'
const detector = await loadDetector()
const analysis = detector.analyze([
  { text: reply1, expected_count: 300 },
  { text: reply2, expected_count: 311 },
  { text: reply3, expected_count: 296 },
])
console.log(analysis.decision, analysis.prediction, analysis.probability)
```

---

## 附：本地源码位置

本文核对过的源码位于工作目录下的 `repo/`（sparse checkout：`shared/`、`offline/`、`cli/`、`docs/content/docs/development|principles`）：

- `repo/shared/fingerprint-core.js`
- `repo/shared/shared-detector.ts`
- `repo/shared/positional.ts`
- `repo/shared/builder.ts`
- `repo/shared/challenge-browser.js`
- `repo/shared/completion.ts`、`repo/shared/detect-request.ts`、`repo/shared/detect-run.ts`
- `repo/shared/detector-codec.ts`
- `repo/shared/tokenizer-posterior.ts`、`repo/shared/tokenizer-probe.ts`、`repo/shared/tokenizer-usage.ts`、`repo/shared/tokenizer-bank.ts`
- `repo/offline/train.ts`、`repo/offline/calibrate.ts`、`repo/offline/math.ts`、`repo/offline/retrain.ts`

参考数据（已下载到工作目录，仅供查阅）：

- `data-bank.json`（`unified_bank.json`，15.3 MB，76 模型 / 2812 样本）
- `tokenizer-bank.json`（`tokenizer_bank.json`，62 类 / 72 文本）