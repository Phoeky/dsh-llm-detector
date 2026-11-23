# dsh-llm-detector

让 DSH 中注册的模型写一串“随机”整数，检测这个渠道背后实际是哪个模型。

> 移植自 [Ikaleio/lm-detector](https://github.com/Ikaleio/lm-detector)（MIT）的数字指纹算法与参考库。
> 本插件把请求接到 DeepSeek Harness 的 `ctx.llm` 服务上，因此检测的是本机真实配置的
> provider 路由、认证和适配层，而不是另填的 Base URL 与 API Key。

## 原理

语言模型写出的“随机数”并不均匀：每个模型偏好的数值、区间、末位和跳变方式相对稳定。

1. **挑战**：让模型凭第一反应写约 300 个 1–355（含端点）的整数；禁止工具、代码、从 1 数、
   等差/循环等规则化模式。每轮 3 道，长度在 292–332 中不重复抽取，语言在中/英/日/韩/法间
   独立随机，措辞由多组等价模板组合。
2. **特征**：355 维数值分布（Hellinger 嵌入）+ 74 维位置/末位 + 102 维位置核 + 220 维序列
   统计；两块基础特征按 0.75 : 0.25 拼接。
3. **序列检查**：lag-1 自相关、相邻小步占比、1–3 位内相近数对占比，三项中位数都超出界限
   时判为“不像语言模型回答”，不排名。
4. **排名**：`s = 0.5·z(频率分数) + 0.5·z(位置/顺序判别)`；频率分数由前 128 个整数的 LDA、
   最近 7 个参考回答的平方距离、以及投影掉“提示环境”低维偏移后的模型中心余弦相似度组成。
5. **置信度**：参考库内的温度 softmax。校准在离线训练时经 78 折环境留出拟合，嵌套留出
   验收通过才写入冻结检测器；不匹配时只给排名、不给置信度。

参考库当前是 **76 个模型、2812 条参考样本**，以冻结的 `data/detector.bin`（约 5.3 MB）
+ `data/models.json` 分发。

## 安装

DSH 从本地目录安装插件：

- **Plugins → Add plugin** 选择本目录；或
- 用 `plugin_manager` 工具执行 `install_bundle`，目标填本目录的绝对路径。

安装后新会话即可使用。插件不写 profile 的配置文件，也不保存任何密钥或地址。

## 使用

模型面向的工具是 `llm_fingerprint`：

```text
action: list
```

列出 DSH 已注册的 provider；传入 `provider` 时再列出它的模型目录。

```text
action: detect
provider: deepseek        # 省略则用 DSH 当前默认模型
model: deepseek-v4-pro    # 省略同上
rounds: 1                 # 1–3，每轮 3 次调用
samples_per_round: 3      # 1–3；少于 3 条时只排名、没有校准置信度
```

返回每轮的第一候选、前 5 个候选、置信度、序列检查、样本诊断与 token 用量，以及跨轮的
“最常见候选”。

也可以直接在对话里说：“用 llm_fingerprint 检测当前模型”。

## 成本与耗时

每次 `detect` 默认发生 **3 次真实模型调用**，每次输出约 300 个整数（通常 400–1200
tokens）。串行发送，单条最长 240 秒。按所用渠道正常计费。

## 局限

- 结果是**参考库内的闭集排序**：库外模型也会得到一个“最像”的候选，置信度不是身份证明。
- 参考库用裸 API 的文字提示词采集；DSH 的适配层可能注入系统提示或改写请求，结果可能偏离。
- 同源、蒸馏或共用分词器的模型指纹天然接近，可能互相混淆。
- 本版本不含分词器探测（对照 API 的 token 计数反推上游分词器）；该能力可后续加入。
- 图片模式未实现。

## 数据与许可

- 算法与参考数据来自 [Ikaleio/lm-detector](https://github.com/Ikaleio/lm-detector)，MIT，
  Copyright (c) 2026 xqy2006；上游许可证文本见 `data/LM-DETECTOR-LICENSE`，修改说明见
  `NOTICE`。
- 本插件自身以 MIT 发布，见 `LICENSE`。

## 开发

```sh
node --version         # Node ^22.19 或 >=24
node --check index.js  # 语法检查
```

`scripts/build-data.mjs` 从 lm-detector 的 `unified_bank.json` 与 `shared_detector.bin`
重新生成 `data/models.json` 与 `data/detector.bin`：把 bank 放到仓库根的 `data-bank.json`，
把冻结检测器放到 `data/upstream/shared_detector.bin`（两者都不提交）。

`scripts/smoke.mjs` 做离线检查：编解码往返、合成回答的排名、均匀随机数被序列检查拒绝。