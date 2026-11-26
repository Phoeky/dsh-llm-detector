window.__ModuleLoader__.load({
  id: 'dsh-llm-detector',
  factory(require) {
    const module = { exports: {} }
    const React = require('react')

    const PANEL_ID = 'llm-detector'
    const API = '/api/llm-detector'

    const DICTS = {
      'zh-CN': {
        tabLabel: '模型指纹',
        title: '模型指纹检测',
        subtitle: '让模型写一串“随机”整数，比较数值与序列分布，判断这个渠道背后最像参考库中的哪个模型。',
        provider: '渠道',
        model: '模型',
        rounds: '轮数',
        parallel: '并发',
        showReplies: '显示提示词与原始回答',
        start: '开始检测',
        running: '检测中…',
        cancel: '取消',
        rerun: '重新检测',
        loading: '正在读取 DSH 已注册的渠道…',
        noProvider: '当前没有可用的 provider。',
        cost: '每轮 3 次真实模型调用、每次约 300 个整数，默认并发 3，按渠道计费。遇到限流可在失败样本上单独重试。',
        closedSet: '排名只在参考库内比较：库外模型也会得到“最像”的候选，置信度不是身份证明。',
        usageTitle: '两种使用方式',
        usagePanel: '在本页选择渠道与模型，实时查看采样进度和候选排名。',
        usageChat: '也可以在对话里直接说“检测当前模型的指纹”，助手会调用 llm_fingerprint 工具完成同样的检测。',
        chatExample: '用 llm_fingerprint 检测当前模型',
        copy: '复制指令',
        copied: '已复制',
        howTitle: '如何解读结果',
        how1: '三条完整回答才提供校准置信度；部分有效样本只给排名。',
        how2: '异常截断的样本只参与排名；失败样本可单独重试补齐，无需整轮重跑。',
        how3: '置信度是参考库内的相对值，不覆盖库外模型，也不是渠道可信度的最终结论。',
        samples: '样本',
        candidates: '候选排名',
        confidence: '置信度',
        noConfidence: '未校准',
        round: '第 {n} 轮',
        used: '有效样本 {n}/{total}',
        truncatedNote: '有样本被截断采用：分布可能不完整，建议重测。',
        roundInProgress: '正在采样…',
        topCandidate: '最常见候选',
        validRounds: '可评分轮次',
        stateQueued: '排队',
        stateRequesting: '请求中',
        stateStreaming: '生成中',
        stateComplete: '完成',
        stateTruncated: '截断采用',
        stateFailed: '失败',
        stateCancelled: '已取消',
        sequence: '序列检查',
        modelLike: '像语言模型回答',
        notModelLike: '不像语言模型回答',
        usage: 'Token 用量',
        prompt: '提示词',
        reply: '回答',
        empty: '先选择渠道与模型，再点“开始检测”；也可以在对话里让助手检测。',
        refresh: '刷新',
        back: '返回对话',
        reference: '参考库',
        error: '出错了',
        partial: '只有部分有效样本，置信度不可用。',
        unscorable: '没有可评分的结果。',
        relativeConfidence: '参考库内相对置信度，非身份证明',
        scoreOnly: '排名分数（非概率）',
        noSequence: '没有有效样本，无法执行序列检查',
        tied: '多轮结果并列，没有多数候选',
        incomplete: '检测未完整结束，以下结果不完整',
        cancelled: '已取消',
        cancelling: '正在取消…',
        statusError: '检测失败',
        noModels: '该渠道没有可用模型',
        retry: '重试',
        retrying: '重试中…',
        retryHint: '沿用该样本的原提示词重新采样，成功后重算本轮排名。',
        effort: '思考强度',
        effortDefault: '模型默认',
        effortUnsupported: '该模型不区分思考强度，将使用渠道默认设置。',
        referenceUnavailable: '参考库不可用，无法开始检测',
        phasePreparing: '准备中',
        phaseScoring: '评分中',
        roundOf: '第 {n}/{total} 轮',
        starRepo: '在 GitHub 上点个 ⭐',
        network: '出站网络',
        networkDirect: '直连（默认）',
        networkSystem: '系统代理',
        networkManual: '手动代理',
        proxyMode: '代理方式',
        proxyUrl: '代理地址',
        proxyUrlHint: '例如 http://127.0.0.1:7897 或 socks5://127.0.0.1:1080',
        proxyApply: '应用',
        proxyTest: '测试连接',
        proxyTesting: '测试中…',
        proxyActive: '当前：{value}',
        proxyTestOk: '连接正常（HTTP {status}，{ms} ms）',
        proxyTestFail: '连接失败：{error}',
        proxyNote: '代理作用于 DSH 进程内所有出站模型请求，切换后立即生效；选择会保存，下次启动沿用。',
        history: '检测历史',
        historyCount: '历史 ({n})',
        historyEmpty: '暂无检测历史记录。完成一次检测后会自动保存在本机。',
        historySearch: '按渠道、模型或预测结果筛选…',
        historyNoMatch: '没有匹配的历史记录。',
        historyRefresh: '刷新',
        historyClear: '清空',
        historyClearConfirm: '确认清空？',
        historyDelete: '删除',
        historyLoading: '正在加载历史详情…',
        historyViewing: '正在查看历史记录',
        historyReuse: '填入表单',
        historyBackLive: '返回当前检测',
        historyClose: '退出历史视图',
        historySourcePanel: '面板',
        historySourceTool: '对话',
        historyStatusComplete: '完成',
        historyStatusCancelled: '已取消',
        historyStatusError: '失败',
        historyRounds: '{valid}/{total} 轮',
        historyReadonlyNote: '历史记录为归档快照；点击“填入表单”可用相同参数重新检测。',
      },
      en: {
        tabLabel: 'Model fingerprint',
        title: 'Model fingerprint detector',
        subtitle: 'Ask the model for “random” integers and compare the distribution with a closed reference bank.',
        provider: 'Provider',
        model: 'Model',
        rounds: 'Rounds',
        parallel: 'Parallel',
        showReplies: 'Show prompts and raw replies',
        start: 'Start detection',
        running: 'Detecting…',
        cancel: 'Cancel',
        rerun: 'Run again',
        loading: 'Loading registered DSH providers…',
        noProvider: 'No provider is registered.',
        cost: 'Each round makes 3 real model calls of about 300 integers, in parallel by default, billed by your provider. Retry a rate-limited sample on its own card.',
        closedSet: 'Ranking only compares models inside the reference bank: unlisted models still get a closest candidate, and confidence is not proof of identity.',
        usageTitle: 'Two ways to use it',
        usagePanel: 'Pick a provider and a model here to watch sampling and ranking live.',
        usageChat: 'Or tell the assistant in any conversation: “detect the current model’s fingerprint”. It calls the llm_fingerprint tool for the same check.',
        chatExample: 'Detect the current model with llm_fingerprint',
        copy: 'Copy prompt',
        copied: 'Copied',
        howTitle: 'How to read the result',
        how1: 'Calibrated confidence needs three complete replies; partial samples only produce a ranking.',
        how2: 'Abnormally truncated samples rank without calibrated confidence. Retry failed samples individually instead of re-running the whole round.',
        how3: 'Confidence is relative within the reference bank and does not cover unlisted models or prove a channel trustworthy.',
        samples: 'Samples',
        candidates: 'Candidates',
        confidence: 'Confidence',
        noConfidence: 'Uncalibrated',
        round: 'Round {n}',
        used: 'Valid samples {n}/{total}',
        truncatedNote: 'Some samples were accepted after truncation; the distribution may be incomplete. Consider re-running.',
        roundInProgress: 'Sampling…',
        topCandidate: 'Most frequent candidate',
        validRounds: 'Scored rounds',
        stateQueued: 'Queued',
        stateRequesting: 'Requesting',
        stateStreaming: 'Streaming',
        stateComplete: 'Complete',
        stateTruncated: 'Truncated',
        stateFailed: 'Failed',
        stateCancelled: 'Cancelled',
        sequence: 'Sequence check',
        modelLike: 'Looks like a language model',
        notModelLike: 'Does not look like a language model',
        usage: 'Token usage',
        prompt: 'Prompt',
        reply: 'Reply',
        empty: 'Pick a provider and a model to start, or ask the assistant in a conversation.',
        refresh: 'Refresh',
        back: 'Back to conversation',
        reference: 'Reference bank',
        error: 'Something went wrong',
        partial: 'Only some samples were valid; confidence is unavailable.',
        unscorable: 'No scorable result.',
        relativeConfidence: 'Relative confidence inside the reference bank, not proof of identity',
        scoreOnly: 'Ranking score (not a probability)',
        noSequence: 'No valid samples; sequence check unavailable',
        tied: 'Rounds are tied; no majority candidate',
        incomplete: 'The run did not finish; results below are incomplete',
        cancelled: 'Cancelled',
        cancelling: 'Cancelling…',
        statusError: 'Detection failed',
        noModels: 'This provider has no available models',
        retry: 'Retry',
        retrying: 'Retrying…',
        retryHint: 'Re-samples with the same prompt and recomputes this round.',
        effort: 'Reasoning effort',
        effortDefault: 'Model default',
        effortUnsupported: 'This model does not expose reasoning efforts; the provider default is used.',
        referenceUnavailable: 'Reference bank unavailable; detection is disabled',
        phasePreparing: 'Preparing',
        phaseScoring: 'Scoring',
        roundOf: 'Round {n}/{total}',
        starRepo: 'Star on GitHub',
        network: 'Outbound network',
        networkDirect: 'Direct (default)',
        networkSystem: 'System proxy',
        networkManual: 'Manual proxy',
        proxyMode: 'Proxy mode',
        proxyUrl: 'Proxy address',
        proxyUrlHint: 'For example http://127.0.0.1:7897 or socks5://127.0.0.1:1080',
        proxyApply: 'Apply',
        proxyTest: 'Test connection',
        proxyTesting: 'Testing…',
        proxyActive: 'Active: {value}',
        proxyTestOk: 'Reachable (HTTP {status}, {ms} ms)',
        proxyTestFail: 'Failed: {error}',
        proxyNote: 'Applies to every outbound model request in the DSH process and takes effect immediately; the choice is saved for next start.',
        history: 'History',
        historyCount: 'History ({n})',
        historyEmpty: 'No detection history yet. Completed runs are saved locally.',
        historySearch: 'Filter by provider, model, or candidate…',
        historyNoMatch: 'No matching history entries.',
        historyRefresh: 'Refresh',
        historyClear: 'Clear',
        historyClearConfirm: 'Confirm clear?',
        historyDelete: 'Delete',
        historyLoading: 'Loading history record…',
        historyViewing: 'Viewing history record',
        historyReuse: 'Fill form',
        historyBackLive: 'Back to current run',
        historyClose: 'Close history view',
        historySourcePanel: 'Panel',
        historySourceTool: 'Chat',
        historyStatusComplete: 'Complete',
        historyStatusCancelled: 'Cancelled',
        historyStatusError: 'Failed',
        historyRounds: '{valid}/{total} rd',
        historyReadonlyNote: 'Archived snapshot. Click “Fill form” to re-run with the same settings.',
      },
    }

    const pickDict = () => {
      const raw = (navigator.languages?.[0] || navigator.language || 'en').toLowerCase()
      return raw.startsWith('zh') ? DICTS['zh-CN'] : DICTS.en
    }

    function translate(locale, key, params) {
      let dict = DICTS.en
      try {
        const current = locale?.getLocale?.()?.id || locale?.getSnapshot?.()?.id
        if (current && String(current).toLowerCase().startsWith('zh')) dict = DICTS['zh-CN']
        else if (!current) dict = pickDict()
      } catch { dict = pickDict() }
      let text = dict[key] ?? DICTS.en[key] ?? key
      for (const [name, value] of Object.entries(params ?? {})) text = text.replace(`{${name}}`, String(value))
      return text
    }

    const css = `
.dfp-root{height:100%;overflow:auto;background:var(--dsw-alias-bg-base);color:var(--dsw-alias-label-primary);padding:24px 28px 40px;box-sizing:border-box}
.dfp-inner{max-width:880px;margin:0 auto;display:flex;flex-direction:column;gap:16px}
.dfp-head{display:flex;align-items:flex-start;justify-content:space-between;gap:16px}
.dfp-head-actions{display:flex;align-items:center;gap:8px;flex-shrink:0}
.dfp-star{text-decoration:none;white-space:nowrap}
.dfp-title{margin:0;font-size:20px;font-weight:650;letter-spacing:-.01em}
.dfp-sub{margin:6px 0 0;font-size:13px;line-height:1.6;color:var(--dsw-alias-label-secondary);max-width:620px}
.dfp-card{background:var(--dsw-alias-bg-layer-1);border:1px solid var(--dsw-alias-border-l1);border-radius:12px;padding:16px}
.dfp-form{display:grid;grid-template-columns:1.2fr 1.4fr 88px 88px 1fr;gap:12px}
.dfp-field{display:flex;flex-direction:column;gap:6px;min-width:0}
.dfp-field label{font-size:12px;color:var(--dsw-alias-label-secondary)}
.dfp-field select,.dfp-field input{width:100%;box-sizing:border-box;background:var(--dsw-alias-bg-layer-2);color:var(--dsw-alias-label-primary);border:1px solid var(--dsw-alias-border-l1);border-radius:8px;padding:8px 10px;font-size:13px;outline:none}
.dfp-field select:focus,.dfp-field input:focus{border-color:var(--dsw-alias-brand-primary)}
.dfp-actions{display:flex;align-items:center;gap:10px;margin-top:14px;flex-wrap:wrap}
.dfp-btn{border:1px solid var(--dsw-alias-border-l1);background:var(--dsw-alias-bg-layer-2);color:var(--dsw-alias-label-primary);border-radius:8px;padding:8px 16px;font-size:13px;cursor:pointer}
.dfp-btn:hover:not(:disabled){border-color:var(--dsw-alias-brand-primary)}
.dfp-btn:focus-visible,.dfp-field select:focus-visible,.dfp-details summary:focus-visible{outline:2px solid var(--dsw-alias-brand-primary);outline-offset:2px}
.dfp-btn:disabled{opacity:.5;cursor:default}
.dfp-primary{background:var(--dsw-alias-brand-primary);border-color:var(--dsw-alias-brand-primary);color:var(--dsw-alias-bg-base);font-weight:600}
.dfp-check{display:flex;align-items:center;gap:6px;font-size:12px;color:var(--dsw-alias-label-secondary)}
.dfp-note{font-size:12px;line-height:1.6;color:var(--dsw-alias-label-secondary);margin:0}
.dfp-usage-list{margin:0;padding-left:18px;font-size:13px;line-height:1.8;color:var(--dsw-alias-label-secondary)}
.dfp-chat-example{display:flex;align-items:center;gap:10px;margin-top:12px;flex-wrap:wrap}
.dfp-chat-example code{flex:1;min-width:220px;background:var(--dsw-alias-bg-layer-2);border:1px solid var(--dsw-alias-border-l1);border-radius:8px;padding:8px 10px;font-size:12px;color:var(--dsw-alias-label-primary);white-space:normal}
.dfp-how{margin-top:0;font-size:13px;color:var(--dsw-alias-label-secondary)}
.dfp-how>summary{cursor:pointer;font-weight:600;color:var(--dsw-alias-label-primary)}
.dfp-how[open]>summary{margin-bottom:10px}
.dfp-how summary:focus-visible{outline:2px solid var(--dsw-alias-brand-primary);outline-offset:2px}
.dfp-error{color:var(--dsw-alias-state-error-primary);font-size:13px;white-space:pre-wrap}
.dfp-result-top{display:flex;align-items:baseline;gap:12px;flex-wrap:wrap}
.dfp-prediction{font-size:22px;font-weight:650}
.dfp-prob{font-size:20px;font-weight:600;color:var(--dsw-alias-brand-primary)}
.dfp-meta{font-size:12px;color:var(--dsw-alias-label-secondary)}
.dfp-bar{height:4px;background:var(--dsw-alias-bg-layer-2);border-radius:2px;overflow:hidden;margin-top:10px}
.dfp-bar>span{display:block;height:100%;background:var(--dsw-alias-brand-primary)}
.dfp-round{border:1px solid var(--dsw-alias-border-l1);border-radius:12px;overflow:hidden;background:var(--dsw-alias-bg-layer-1)}
.dfp-round-head{display:flex;align-items:center;justify-content:space-between;gap:12px;padding:12px 16px;border-bottom:1px solid var(--dsw-alias-border-l1);flex-wrap:wrap}
.dfp-round-title{font-size:14px;font-weight:600}
.dfp-samples{display:grid;grid-template-columns:repeat(3,1fr);gap:10px;padding:14px 16px}
.dfp-sample{border:1px solid var(--dsw-alias-border-l1);border-radius:10px;padding:10px;background:var(--dsw-alias-bg-layer-2);min-width:0}
.dfp-sample-state{font-size:12px;font-weight:600;display:flex;justify-content:space-between;gap:8px}
.dfp-sample-count{font-size:12px;color:var(--dsw-alias-label-secondary);margin-top:6px}
.dfp-sample-error{font-size:12px;color:var(--dsw-alias-state-error-primary);margin-top:6px;white-space:pre-wrap;word-break:break-word}
.dfp-sample-text{font-size:11px;line-height:1.5;color:var(--dsw-alias-label-secondary);white-space:pre-wrap;word-break:break-word;max-height:150px;overflow:auto;margin-top:8px}
.dfp-ok{color:var(--dsw-alias-state-success-primary)}
.dfp-warn{color:var(--dsw-alias-state-warn-primary)}
.dfp-bad{color:var(--dsw-alias-state-error-primary)}
.dfp-candidates{padding:0 16px 16px;display:flex;flex-direction:column;gap:8px}
.dfp-candidate{display:grid;grid-template-columns:1fr auto;gap:6px 12px;align-items:center;font-size:13px}
.dfp-candidate-name{overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.dfp-candidate-prob{font-variant-numeric:tabular-nums;color:var(--dsw-alias-label-secondary)}
.dfp-candidate .dfp-bar{grid-column:1/-1;margin-top:0}
.dfp-section-title{font-size:12px;font-weight:600;color:var(--dsw-alias-label-secondary);text-transform:uppercase;letter-spacing:.04em;margin:0 0 10px}
.dfp-details{border-top:1px solid var(--dsw-alias-border-l1);padding:12px 16px;font-size:12px;color:var(--dsw-alias-label-secondary)}
.dfp-details summary{cursor:pointer}
.dfp-empty{padding:32px 16px;text-align:center;color:var(--dsw-alias-label-secondary);font-size:13px}
.dfp-spinner{display:inline-block;width:12px;height:12px;border:2px solid var(--dsw-alias-border-l2);border-top-color:var(--dsw-alias-brand-primary);border-radius:50%;animation:dfp-spin .8s linear infinite;vertical-align:-2px;margin-right:6px}
@keyframes dfp-spin{to{transform:rotate(360deg)}}
.dfp-history-banner{display:flex;align-items:center;justify-content:space-between;gap:12px;flex-wrap:wrap;border-color:var(--dsw-alias-brand-primary)}
.dfp-history-banner-info{display:flex;flex-direction:column;gap:4px;min-width:0}
.dfp-history-banner-title{font-size:13px;font-weight:600;display:flex;align-items:center;gap:8px;flex-wrap:wrap}
.dfp-history-banner-actions{display:flex;align-items:center;gap:8px;flex-wrap:wrap}
.dfp-history-head{display:flex;align-items:center;justify-content:space-between;gap:10px;flex-wrap:wrap;margin-bottom:12px}
.dfp-history-title{margin:0;font-size:15px;font-weight:600;display:flex;align-items:center;gap:8px}
.dfp-history-tools{display:flex;align-items:center;gap:8px;flex-wrap:wrap}
.dfp-history-search{background:var(--dsw-alias-bg-layer-2);color:var(--dsw-alias-label-primary);border:1px solid var(--dsw-alias-border-l1);border-radius:8px;padding:6px 10px;font-size:12px;width:210px;max-width:100%;outline:none;box-sizing:border-box}
.dfp-history-search:focus{border-color:var(--dsw-alias-brand-primary)}
.dfp-history-list{display:flex;flex-direction:column;gap:8px;max-height:420px;overflow:auto;padding-right:2px}
.dfp-history-item{display:flex;align-items:center;justify-content:space-between;gap:12px;padding:10px 12px;border:1px solid var(--dsw-alias-border-l1);border-radius:10px;background:var(--dsw-alias-bg-layer-2);cursor:pointer;text-align:left;width:100%;box-sizing:border-box;color:inherit;transition:border-color .15s ease}
.dfp-history-item:hover{border-color:var(--dsw-alias-brand-primary)}
.dfp-history-item.active{border-color:var(--dsw-alias-brand-primary);box-shadow:inset 3px 0 0 var(--dsw-alias-brand-primary)}
.dfp-history-main{display:flex;flex-direction:column;gap:4px;min-width:0;flex:1}
.dfp-history-row{display:flex;align-items:center;gap:6px;flex-wrap:wrap;min-width:0}
.dfp-history-target{font-size:13px;font-weight:600;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;max-width:100%}
.dfp-history-meta{font-size:12px;color:var(--dsw-alias-label-secondary);font-variant-numeric:tabular-nums;display:flex;align-items:center;gap:8px;flex-wrap:wrap}
.dfp-history-right{display:flex;align-items:center;gap:10px;flex-shrink:0}
.dfp-history-result{text-align:right;display:flex;flex-direction:column;gap:2px;min-width:0}
.dfp-history-pred{font-size:13px;font-weight:600;max-width:220px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.dfp-history-prob{font-size:12px;color:var(--dsw-alias-brand-primary);font-variant-numeric:tabular-nums;font-weight:600}
.dfp-tag{display:inline-flex;align-items:center;padding:1px 6px;border-radius:999px;font-size:11px;line-height:1.5;border:1px solid var(--dsw-alias-border-l1);color:var(--dsw-alias-label-secondary);background:var(--dsw-alias-bg-layer-1);white-space:nowrap}
.dfp-tag-ok{color:var(--dsw-alias-state-success-primary)}
.dfp-tag-warn{color:var(--dsw-alias-state-warn-primary)}
.dfp-tag-bad{color:var(--dsw-alias-state-error-primary)}
.dfp-btn-sm{padding:5px 10px;font-size:12px}
.dfp-btn-danger:hover:not(:disabled){border-color:var(--dsw-alias-state-error-primary);color:var(--dsw-alias-state-error-primary)}
@media (max-width:760px){.dfp-form{grid-template-columns:1fr 1fr}.dfp-samples{grid-template-columns:1fr}.dfp-root{padding:16px}.dfp-head-actions{flex-wrap:wrap}.dfp-history-item{flex-direction:column;align-items:stretch}.dfp-history-right{justify-content:space-between}.dfp-history-result{text-align:left}.dfp-history-search{width:100%}}
@media (max-width:480px){.dfp-form{grid-template-columns:1fr}.dfp-head{flex-direction:column}}
@media (prefers-reduced-motion:reduce){.dfp-spinner{animation:none}}
`

    const pct = (value) => {
      const number = Number(value)
      return Number.isFinite(number) && number > 0 ? `${(number * 100).toFixed(1)}%` : ''
    }

    const pad2 = (n) => String(n).padStart(2, '0')
    const formatTime = (ts) => {
      const value = Number(ts)
      if (!Number.isFinite(value) || value <= 0) return ''
      const d = new Date(value)
      if (Number.isNaN(d.getTime())) return ''
      return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())} ${pad2(d.getHours())}:${pad2(d.getMinutes())}`
    }

    function createApp(React, host, locale, layout) {
      const h = React.createElement
      const t = (key, params) => translate(locale, key, params)
      let token = ''

      const api = async (path, options = {}) => {
        const { write, ...fetchOptions } = options
        const response = await fetch(API + path, {
          credentials: 'same-origin',
          ...fetchOptions,
          headers: {
            Accept: 'application/json',
            ...(fetchOptions.body ? { 'Content-Type': 'application/json' } : {}),
            ...(write ? { 'x-llm-detector-token': token } : {}),
          },
        })
        const data = await response.json().catch(() => ({}))
        if (!response.ok) throw new Error(data.error || `HTTP ${response.status}`)
        return data
      }

      function Icon({ size }) {
        const px = typeof size === 'number' && size > 0 ? size : 16
        return h('svg', { width: px, height: px, viewBox: '0 0 16 16', fill: 'none', 'aria-hidden': 'true' },
          h('path', { d: 'M3 11c0-3 2.2-5.5 5-5.5s5 2.5 5 5.5', stroke: 'currentColor', strokeWidth: 1.2, strokeLinecap: 'round' }),
          h('path', { d: 'M5.4 11.6c0-1.8 1.2-3.1 2.6-3.1s2.6 1.3 2.6 3.1', stroke: 'currentColor', strokeWidth: 1.1, strokeLinecap: 'round' }),
          h('circle', { cx: 8, cy: 11.8, r: 1, fill: 'currentColor' }),
          h('path', { d: 'M2.5 13.6h11', stroke: 'currentColor', strokeWidth: 1.2, strokeLinecap: 'round' }))
      }

      function SampleCard({ sample, onRetry, retryDisabled }) {
        const stateKey = {
          queued: 'stateQueued',
          requesting: 'stateRequesting',
          streaming: 'stateStreaming',
          complete: 'stateComplete',
          truncated: 'stateTruncated',
          failed: 'stateFailed',
          cancelled: 'stateCancelled',
        }[sample.state] ?? 'stateQueued'
        const busy = sample.state === 'requesting' || sample.state === 'streaming'
        const tone = sample.state === 'failed' ? 'dfp-bad' : sample.state === 'complete' ? 'dfp-ok' : ''
        const retryable = sample.state === 'failed' || sample.state === 'cancelled'
        return h('div', { className: 'dfp-sample' },
          h('div', { className: `dfp-sample-state ${tone}` },
            h('span', null, `${sample.index}. ${t(stateKey)}`),
            busy ? h('span', { className: 'dfp-spinner', 'aria-hidden': 'true' }) : null),
          h('div', { className: 'dfp-sample-count' }, `${sample.count} / ${sample.expected_count}`),
          sample.error ? h('div', { className: 'dfp-sample-error' }, sample.error) : null,
          sample.note ? h('div', { className: 'dfp-sample-count' }, sample.note) : null,
          retryable && onRetry ? h('button', {
            className: 'dfp-btn',
            style: { marginTop: '8px', padding: '4px 12px', fontSize: '12px' },
            disabled: retryDisabled,
            title: t('retryHint'),
            onClick: () => onRetry(sample),
          }, t('retry')) : null,
          sample.prompt ? h('details', null,
            h('summary', { className: 'dfp-sample-count' }, t('prompt')),
            h('div', { className: 'dfp-sample-text' }, sample.prompt)) : null,
          sample.text ? h('details', null,
            h('summary', { className: 'dfp-sample-count' }, t('reply')),
            h('div', { className: 'dfp-sample-text' }, sample.text)) : null)
      }

      function RoundView({ round, onRetry, busy }) {
        const probability = pct(round.probability)
        const total = round.sample_total ?? round.samples.length
        const truncated = round.samples.filter(sample => sample.state === 'truncated').length
        return h('section', { className: 'dfp-round' },
          h('div', { className: 'dfp-round-head' },
            h('div', null,
              h('div', { className: 'dfp-round-title' }, `${t('round', { n: round.index })} · ${round.prediction_name || round.evidence_label}`),
              h('div', { className: 'dfp-meta' }, t('used', { n: round.used_outputs, total }))),
            h('div', { style: { textAlign: 'right' } },
              h('div', { className: 'dfp-prob' }, probability || t('noConfidence')),
              h('div', { className: 'dfp-meta' }, probability ? t('relativeConfidence') : t('scoreOnly')))),
          truncated ? h('p', { className: 'dfp-note dfp-warn', style: { padding: '10px 16px 0' } }, t('truncatedNote')) : null,
          h('div', { className: 'dfp-samples' }, round.samples.map(sample => h(SampleCard, {
            key: sample.id,
            sample,
            onRetry: onRetry ? (target) => onRetry(round.index, target) : null,
            retryDisabled: busy,
          }))),
          round.top.length ? h('div', { className: 'dfp-candidates' },
            h('p', { className: 'dfp-section-title' }, t('candidates')),
            round.top.map(item => h('div', { className: 'dfp-candidate', key: item.model },
              h('span', { className: 'dfp-candidate-name' }, item.display_name),
              h('span', { className: 'dfp-candidate-prob' }, pct(item.probability) || item.score),
              pct(item.probability) ? h('div', { className: 'dfp-bar' }, h('span', { style: { width: pct(item.probability) } })) : null))) : null,
          h('details', { className: 'dfp-details' },
            h('summary', null, t('sequence')),
            h('div', { style: { marginTop: '8px' } },
              round.sequence
                ? `${round.model_like ? t('modelLike') : t('notModelLike')} · lag-1 ${round.sequence.autocorrelation} · |Δ|≤20 ${round.sequence.small_step_share} · near ${round.sequence.nearby_pair_share}`
                : t('noSequence')),
            h('div', { style: { marginTop: '6px' } }, `${t('usage')}: in ${round.usage.inputTokens} / out ${round.usage.outputTokens}`),
            round.evidence_reason ? h('div', { style: { marginTop: '6px' } }, round.evidence_reason) : null))
      }

      function Panel() {
        const [loading, setLoading] = React.useState(true)
        const [providers, setProviders] = React.useState([])
        const [provider, setProvider] = React.useState('')
        const [models, setModels] = React.useState([])
        const [model, setModel] = React.useState('')
        const [modelsLoading, setModelsLoading] = React.useState(false)
        const [rounds, setRounds] = React.useState(1)
        const [parallel, setParallel] = React.useState(3)
        const [includeReplies, setIncludeReplies] = React.useState(true)
        const [effort, setEffort] = React.useState('')
        const [efforts, setEfforts] = React.useState([])
        const [defaultEffort, setDefaultEffort] = React.useState('')
        const [effortLoading, setEffortLoading] = React.useState(false)
        const [job, setJob] = React.useState(null)
        const [historyItems, setHistoryItems] = React.useState([])
        const [historyTotal, setHistoryTotal] = React.useState(0)
        const [historyLoading, setHistoryLoading] = React.useState(false)
        const [historyLoadingId, setHistoryLoadingId] = React.useState('')
        const [historyQuery, setHistoryQuery] = React.useState('')
        const [viewedHistory, setViewedHistory] = React.useState(null)
        const [confirmClear, setConfirmClear] = React.useState(false)
        const [error, setError] = React.useState('')
        const [reference, setReference] = React.useState(null)
        const [referenceError, setReferenceError] = React.useState('')
        const [localeTick, setLocaleTick] = React.useState(0)
        const [copied, setCopied] = React.useState(false)
        const copyTimer = React.useRef(null)
        const clearTimer = React.useRef(null)
        const pendingSelect = React.useRef(null)
        const historySectionRef = React.useRef(null)
        const resultSectionRef = React.useRef(null)
        React.useEffect(() => () => {
          clearTimeout(copyTimer.current)
          clearTimeout(clearTimer.current)
        }, [])

        const refreshHistory = React.useCallback(async () => {
          setHistoryLoading(true)
          try {
            const listed = await api('/history?limit=100')
            setHistoryItems(listed.items ?? [])
            setHistoryTotal(listed.allTotal ?? listed.total ?? (listed.items?.length ?? 0))
          } catch (cause) {
            setError(cause.message)
          } finally {
            setHistoryLoading(false)
          }
        }, [])
        const copyChatPrompt = async () => {
          try {
            await navigator.clipboard.writeText(t('chatExample'))
            setCopied(true)
            clearTimeout(copyTimer.current)
            copyTimer.current = setTimeout(() => setCopied(false), 1600)
          } catch { /* 剪贴板不可用时保持原样，用户可手动选择文本 */ }
        }

        React.useEffect(() => {
          if (!locale?.subscribe) return undefined
          return locale.subscribe(() => setLocaleTick(value => value + 1))
        }, [])

        React.useEffect(() => {
          let alive = true
          ;(async () => {
            try {
              const boot = await api('/bootstrap')
              if (!alive) return
              token = boot.token
              setProviders(boot.providers)
              setReference(boot.reference)
              setReferenceError(boot.referenceError || '')
              if (boot.history) {
                setHistoryItems(boot.history.items ?? [])
                setHistoryTotal(boot.history.allTotal ?? boot.history.total ?? (boot.history.items?.length ?? 0))
              }
              const preferred = boot.default?.provider && boot.providers.some(p => p.id === boot.default.provider)
                ? boot.default.provider
                : boot.providers[0]?.id ?? ''
              if (preferred && boot.default?.provider === preferred && boot.default?.model) {
                pendingSelect.current = { provider: preferred, model: boot.default.model, effort: '' }
              }
              setProvider(preferred)
              if (boot.running) {
                const snap = await api(`/job?id=${encodeURIComponent(boot.running)}`)
                if (alive) setJob(snap)
              }
            } catch (cause) {
              if (alive) setError(cause.message)
            } finally {
              if (alive) setLoading(false)
            }
          })()
          return () => { alive = false }
        }, [])

        React.useEffect(() => {
          if (!provider) {
            setModels([])
            setModel('')
            return
          }
          let alive = true
          setModelsLoading(true)
          // 切换 provider 立刻清空旧模型，禁止用“新 provider + 旧 model”开始。
          setModels([])
          setModel('')
          ;(async () => {
            try {
              const listed = await api(`/models?provider=${encodeURIComponent(provider)}`)
              if (!alive) return
              setModels(listed.models)
              const wanted = pendingSelect.current && pendingSelect.current.provider === provider
                ? pendingSelect.current.model
                : ''
              const matched = wanted && listed.models.some(item => item.id === wanted)
              setModel(matched ? wanted : (listed.models[0]?.id ?? ''))
              if (!matched && pendingSelect.current?.provider === provider) {
                pendingSelect.current = null
              }
              setError('')
            } catch (cause) {
              if (alive) {
                setModels([])
                setModel('')
                setError(cause.message)
              }
            } finally {
              if (alive) setModelsLoading(false)
            }
          })()
          return () => { alive = false }
        }, [provider])

        React.useEffect(() => {
          if (!provider || !model) {
            setEfforts([])
            setDefaultEffort('')
            setEffort('')
            return
          }
          let alive = true
          setEffortLoading(true)
          ;(async () => {
            try {
              const info = await api(`/model?provider=${encodeURIComponent(provider)}&model=${encodeURIComponent(model)}`)
              if (!alive) return
              const list = info.reasoning?.efforts ?? []
              setEfforts(list)
              setDefaultEffort(info.reasoning?.defaultEffort ?? '')
              const pendingEffort = pendingSelect.current
                && pendingSelect.current.provider === provider
                && pendingSelect.current.model === model
                ? pendingSelect.current.effort
                : null
              if (pendingEffort !== null) {
                pendingSelect.current = null
                setEffort(pendingEffort && list.some(item => item.id === pendingEffort) ? pendingEffort : '')
              } else {
                setEffort(current => list.some(item => item.id === current) ? current : '')
              }
            } catch {
              if (!alive) return
              // 取不到能力信息时退回“不指定”，检测本身仍按渠道默认执行。
              setEfforts([])
              setDefaultEffort('')
              setEffort('')
            } finally {
              if (alive) setEffortLoading(false)
            }
          })()
          return () => { alive = false }
        }, [provider, model])

        const running = job?.status === 'running' || job?.status === 'cancelling'
        const retrying = Boolean(job?.retry)
        const busy = running || retrying
        React.useEffect(() => {
          if (!busy || !job?.id) return undefined
          let alive = true
          let timer
          // 串行轮询：上一次响应落地后再排下一次，避免旧快照覆盖新状态。
          const tick = async () => {
            try {
              const snap = await api(`/job?id=${encodeURIComponent(job.id)}`)
              if (!alive) return
              setJob(snap)
              if (snap.status === 'running' || snap.status === 'cancelling' || snap.retry) timer = setTimeout(tick, 1000)
            } catch (cause) {
              if (!alive) return
              setError(cause.message)
              timer = setTimeout(tick, 2500)
            }
          }
          tick()
          return () => { alive = false; clearTimeout(timer) }
        }, [busy, job?.id, job?.retry])

        const prevBusy = React.useRef(false)
        React.useEffect(() => {
          if (prevBusy.current && !busy && job?.id) {
            refreshHistory()
            setViewedHistory(current => (current && current.id === job.id ? job : current))
          }
          prevBusy.current = busy
        }, [busy, job, refreshHistory])

        const [pendingAction, setPendingAction] = React.useState(false)
        const start = async () => {
          if (pendingAction || busy || modelsLoading || !provider || !model) return
          if (!models.some(item => item.id === model)) {
            setError(t('model') + ': ' + model)
            return
          }
          setPendingAction(true)
          setViewedHistory(null)
          setError('')
          try {
            const result = await api('/start', {
              method: 'POST',
              write: true,
              body: JSON.stringify({ provider, model, rounds, parallel, includeReplies, reasoning_effort: effort }),
            })
            if (result.snapshot) setJob(result.snapshot)
            else if (result.id) setJob(await api(`/job?id=${encodeURIComponent(result.id)}`))
          } catch (cause) { setError(cause.message) }
          finally { setPendingAction(false) }
        }

        const openHistoryEntry = async (id) => {
          if (!id || historyLoadingId) return
          setHistoryLoadingId(id)
          setError('')
          try {
            const entry = await api(`/history/item?id=${encodeURIComponent(id)}`)
            setViewedHistory(entry)
            resultSectionRef.current?.scrollIntoView?.({ behavior: 'smooth', block: 'start' })
          } catch (cause) {
            setError(cause.message)
          } finally {
            setHistoryLoadingId('')
          }
        }

        const deleteHistoryEntry = async (id, event) => {
          event?.stopPropagation?.()
          if (!id || pendingAction) return
          setPendingAction(true)
          setError('')
          try {
            await api('/history/delete', {
              method: 'POST',
              write: true,
              body: JSON.stringify({ id }),
            })
            setHistoryItems(prev => prev.filter(item => item.id !== id))
            setHistoryTotal(prev => Math.max(0, prev - 1))
            setViewedHistory(current => (current && current.id === id ? null : current))
          } catch (cause) {
            setError(cause.message)
          } finally {
            setPendingAction(false)
          }
        }

        const clearAllHistory = async () => {
          if (pendingAction || !historyItems.length) return
          if (!confirmClear) {
            setConfirmClear(true)
            clearTimeout(clearTimer.current)
            clearTimer.current = setTimeout(() => setConfirmClear(false), 3000)
            return
          }
          clearTimeout(clearTimer.current)
          setConfirmClear(false)
          setPendingAction(true)
          setError('')
          try {
            await api('/history/clear', { method: 'POST', write: true, body: '{}' })
            setHistoryItems([])
            setHistoryTotal(0)
            setViewedHistory(null)
          } catch (cause) {
            setError(cause.message)
          } finally {
            setPendingAction(false)
          }
        }

        const reuseHistoryConfig = (entry) => {
          if (!entry || running || pendingAction) return
          const opts = entry.options ?? {}
          if (opts.rounds) setRounds(Math.max(1, Math.min(3, Number(opts.rounds) || 1)))
          if (opts.parallel) setParallel(Math.max(1, Math.min(3, Number(opts.parallel) || 3)))
          if (typeof opts.includeReplies === 'boolean') setIncludeReplies(opts.includeReplies)
          const targetProvider = entry.provider
          const targetModel = entry.model
          const targetEffort = opts.reasoningEffort ?? ''
          if (targetProvider && providers.some(p => p.id === targetProvider)) {
            pendingSelect.current = { provider: targetProvider, model: targetModel, effort: targetEffort }
            if (targetProvider === provider) {
              if (targetModel && models.some(item => item.id === targetModel)) {
                setModel(targetModel)
                if (targetModel === model) {
                  pendingSelect.current = null
                  setEffort(targetEffort && efforts.some(item => item.id === targetEffort) ? targetEffort : '')
                }
              } else {
                pendingSelect.current = null
              }
            } else {
              setProvider(targetProvider)
            }
          }
        }
        const cancel = async () => {
          if (pendingAction) return
          setPendingAction(true)
          try {
            const result = await api('/cancel', { method: 'POST', write: true, body: JSON.stringify({ id: job?.id }) })
            if (result.snapshot) setJob(result.snapshot)
          } catch (cause) { setError(cause.message) }
          finally { setPendingAction(false) }
        }

        const retrySample = async (roundIndex, sample) => {
          if (pendingAction || busy || !job?.id) return
          setPendingAction(true)
          setViewedHistory(current => (current && current.id === job.id ? null : current))
          setError('')
          try {
            const result = await api('/retry', {
              method: 'POST',
              write: true,
              body: JSON.stringify({ id: job.id, round: roundIndex, index: sample.index }),
            })
            if (result.snapshot) setJob(result.snapshot)
          } catch (cause) { setError(cause.message) }
          finally { setPendingAction(false) }
        }

        const isViewingHistory = Boolean(viewedHistory)
        const displayJob = viewedHistory ?? job
        const displayRunning = !isViewingHistory && running
        const canRetryDisplay = Boolean(displayJob && job && displayJob.id === job.id)
        const activeRound = displayJob?.current?.index ?? (displayJob?.rounds?.length ?? 0) + 1
        const currentSamples = (displayJob?.samples ?? []).filter(sample => sample.round === activeRound)
        const unfinished = displayRunning || (displayJob && displayJob.current && displayJob.current.phase !== 'scored' && currentSamples.length > 0)
        const placeholderCount = displayJob?.current?.challenges?.length ?? displayJob?.options?.samplesPerRound ?? 3
        const displaySamples = currentSamples.length
          ? currentSamples
          : Array.from({ length: placeholderCount }, (_, index) => ({
              id: `pending-${index}`,
              index: index + 1,
              state: 'queued',
              count: 0,
              expected_count: displayJob?.current?.challenges?.[index]?.expected_count ?? 0,
            }))
        const normalizedQuery = historyQuery.trim().toLowerCase()
        const filteredHistory = normalizedQuery
          ? historyItems.filter(item => [
              item.provider,
              item.model,
              item.top_candidate_name,
              item.top_candidate,
              item.status,
              item.source,
            ].join(' ').toLowerCase().includes(normalizedQuery))
          : historyItems

        return h('div', { className: 'dfp-root', 'data-locale-tick': localeTick },
          h('style', null, css),
          h('div', { className: 'dfp-inner' },
            h('div', { className: 'dfp-head' },
              h('div', null,
                h('h1', { className: 'dfp-title' }, t('title')),
                h('p', { className: 'dfp-sub' }, t('subtitle'))),
              h('div', { className: 'dfp-head-actions' },
                h('button', {
                  className: 'dfp-btn',
                  onClick: () => historySectionRef.current?.scrollIntoView?.({ behavior: 'smooth', block: 'start' }),
                }, t('historyCount', { n: historyTotal })),
                h('a', {
                  className: 'dfp-btn dfp-star',
                  href: 'https://github.com/Phoeky/dsh-llm-detector',
                  target: '_blank',
                  rel: 'noreferrer noopener',
                  title: t('starRepo'),
                }, t('starRepo')),
                h('button', { className: 'dfp-btn', onClick: () => layout?.selectPanel?.(null) }, t('back')))),
            h('div', { className: 'dfp-card' },
              loading ? h('div', { className: 'dfp-empty' }, t('loading')) : h(React.Fragment, null,
                h('div', { className: 'dfp-form' },
                  h('div', { className: 'dfp-field' },
                    h('label', { htmlFor: 'dfp-provider' }, t('provider')),
                    h('select', {
                      id: 'dfp-provider',
                      value: provider,
                      disabled: running || pendingAction,
                      onChange: event => setProvider(event.target.value),
                    }, providers.map(item => h('option', { key: item.id, value: item.id }, `${item.name} (${item.id})`)))),
                  h('div', { className: 'dfp-field' },
                    h('label', { htmlFor: 'dfp-model' }, t('model')),
                    h('select', {
                      id: 'dfp-model',
                      value: model,
                      disabled: running || pendingAction || modelsLoading || !models.length,
                      onChange: event => setModel(event.target.value),
                    }, models.map(item => h('option', { key: item.id, value: item.id }, item.id)))),
                  h('div', { className: 'dfp-field' },
                    h('label', { htmlFor: 'dfp-rounds' }, t('rounds')),
                    h('select', { id: 'dfp-rounds', value: rounds, disabled: running || pendingAction, onChange: event => setRounds(Number(event.target.value)) },
                      [1, 2, 3].map(n => h('option', { key: n, value: n }, n)))),
                  h('div', { className: 'dfp-field' },
                    h('label', { htmlFor: 'dfp-parallel' }, t('parallel')),
                    h('select', { id: 'dfp-parallel', value: parallel, disabled: running || pendingAction, onChange: event => setParallel(Number(event.target.value)) },
                      [1, 2, 3].map(n => h('option', { key: n, value: n }, n)))),
                  h('div', { className: 'dfp-field' },
                    h('label', { htmlFor: 'dfp-effort' }, t('effort')),
                    h('select', {
                      id: 'dfp-effort',
                      value: effort,
                      disabled: running || pendingAction || effortLoading || !efforts.length,
                      title: efforts.length ? '' : t('effortUnsupported'),
                      onChange: event => setEffort(event.target.value),
                    }, [
                      h('option', { key: '', value: '' }, defaultEffort ? `${t('effortDefault')} (${defaultEffort})` : t('effortDefault')),
                      ...efforts.filter(item => item.id !== defaultEffort).map(item =>
                        h('option', { key: item.id, value: item.id }, item.name || item.id)),
                    ]))),
                h('div', { className: 'dfp-actions' },
                  h('button', {
                    className: 'dfp-btn dfp-primary',
                    disabled: running || pendingAction || modelsLoading || !provider || !model || !models.some(item => item.id === model) || !reference || retrying,
                    onClick: start,
                  }, running ? t('running') : job ? t('rerun') : t('start')),
                  running ? h('button', { className: 'dfp-btn', disabled: pendingAction || job?.status === 'cancelling', onClick: cancel },
                    job?.status === 'cancelling' ? t('cancelling') : t('cancel')) : null,
                  h('label', { className: 'dfp-check' },
                    h('input', {
                      type: 'checkbox',
                      checked: includeReplies,
                      disabled: running || pendingAction,
                      onChange: event => setIncludeReplies(event.target.checked),
                    }),
                    t('showReplies'))),
                !loading && !providers.length ? h('p', { className: 'dfp-note dfp-warn' }, t('noProvider')) : null,
                !loading && provider && !modelsLoading && !models.length ? h('p', { className: 'dfp-note' }, t('noModels')) : null,
                h('p', { className: 'dfp-note', style: { marginTop: '12px' } }, t('cost')),
                reference ? h('p', { className: 'dfp-note' }, `${t('reference')}: ${reference.models} models · ${reference.built_at}`)
                  : h('p', { className: 'dfp-note dfp-warn' }, `${t('referenceUnavailable')}${referenceError ? ` · ${referenceError}` : ''}`))),
            h('details', { className: 'dfp-card dfp-how' },
              h('summary', null, t('usageTitle')),
              h('ul', { className: 'dfp-usage-list' },
                h('li', null, t('usagePanel')),
                h('li', null, t('usageChat'))),
              h('div', { className: 'dfp-chat-example' },
                h('code', null, t('chatExample')),
                h('button', { className: 'dfp-btn', onClick: copyChatPrompt }, copied ? t('copied') : t('copy')))),
            h('details', { className: 'dfp-card dfp-how' },
              h('summary', null, t('howTitle')),
              h('ul', { className: 'dfp-usage-list' },
                h('li', null, t('how1')),
                h('li', null, t('how2')),
                h('li', null, t('how3')))),
            error ? h('div', { className: 'dfp-card dfp-error', role: 'alert' }, `${t('error')}: ${error}`) : null,
            h('div', { ref: resultSectionRef, style: { display: 'flex', flexDirection: 'column', gap: '16px' } },
              isViewingHistory ? h('div', { className: 'dfp-card dfp-history-banner', role: 'status' },
                h('div', { className: 'dfp-history-banner-info' },
                  h('div', { className: 'dfp-history-banner-title' },
                    h('span', null, t('historyViewing')),
                    h('span', { className: 'dfp-tag' }, viewedHistory.source === 'tool' ? t('historySourceTool') : t('historySourcePanel')),
                    formatTime(viewedHistory.finished_at || viewedHistory.created_at)
                      ? h('span', { className: 'dfp-meta' }, formatTime(viewedHistory.finished_at || viewedHistory.created_at))
                      : null),
                  h('div', { className: 'dfp-meta' }, t('historyReadonlyNote'))),
                h('div', { className: 'dfp-history-banner-actions' },
                  h('button', {
                    className: 'dfp-btn dfp-btn-sm',
                    disabled: running || pendingAction,
                    onClick: () => reuseHistoryConfig(viewedHistory),
                  }, t('historyReuse')),
                  h('button', {
                    className: 'dfp-btn dfp-btn-sm',
                    onClick: () => setViewedHistory(null),
                  }, job ? t('historyBackLive') : t('historyClose')))) : null,
              displayJob && displayJob.status !== 'running' && displayJob.status !== 'cancelling' && displayJob.status !== 'complete'
                ? h('div', { className: 'dfp-card dfp-warn', role: 'status' },
                    `${displayJob.status === 'cancelled' ? t('cancelled') : t('statusError')} · ${t('incomplete')}${displayJob.error ? ` · ${displayJob.error}` : ''}`)
                : null,
              displayRunning ? h('div', { className: 'dfp-card', role: 'status', 'aria-live': 'polite', 'aria-busy': 'true' },
                h('div', { className: 'dfp-result-top' },
                  h('span', { className: 'dfp-prediction' }, `${displayJob.provider}/${displayJob.model}`)),
                h('div', { className: 'dfp-meta' }, `${displayJob.status === 'cancelling' ? t('cancelling') : t('running')} ${t('validRounds')} ${displayJob.summary.valid_rounds}`))
              : displayJob?.summary?.valid_rounds ? h('div', { className: 'dfp-card' },
                h('div', { className: 'dfp-result-top' },
                  h('span', { className: 'dfp-prediction' }, displayJob.summary.top_candidate_name),
                  displayJob.summary.mean_probability ? h('span', { className: 'dfp-prob' }, pct(displayJob.summary.mean_probability)) : null),
                h('div', { className: 'dfp-meta' },
                  `${displayJob.provider}/${displayJob.model} · ${t('topCandidate')} ${displayJob.summary.top_candidate_rounds}/${displayJob.summary.rounds} · ${t('validRounds')} ${displayJob.summary.valid_rounds}`),
                h('div', { className: 'dfp-meta' }, displayJob.summary.mean_probability ? t('relativeConfidence') : t('scoreOnly')),
                displayJob.summary.tied ? h('div', { className: 'dfp-meta dfp-warn' }, t('tied')) : null,
                displayJob.summary.uncalibrated_rounds ? h('div', { className: 'dfp-meta' }, `${t('noConfidence')}: ${displayJob.summary.uncalibrated_rounds}`) : null) : null,
              unfinished ? h('section', { className: 'dfp-round', 'aria-busy': displayRunning ? 'true' : 'false' },
                h('div', { className: 'dfp-round-head' },
                  h('div', { className: 'dfp-round-title' },
                    `${t('roundOf', { n: activeRound, total: displayJob?.options?.rounds ?? 1 })} · ${displayJob?.current?.phase === 'scoring' ? t('phaseScoring') : displayRunning ? t('roundInProgress') : t('incomplete')}`),
                  displayRunning ? h('span', { className: 'dfp-spinner', 'aria-hidden': 'true' }) : null),
                h('div', { className: 'dfp-samples' }, displaySamples.map(sample => h(SampleCard, {
                  key: sample.id,
                  sample,
                  onRetry: canRetryDisplay ? (target) => retrySample(activeRound, target) : null,
                  retryDisabled: busy || pendingAction,
                })))) : null,
              (displayJob?.rounds ?? []).map(round => h(RoundView, {
                key: round.index,
                round,
                onRetry: canRetryDisplay ? retrySample : null,
                busy: busy || pendingAction,
              })),
              displayJob && !displayRunning && !displayJob.summary?.valid_rounds ? h('div', { className: 'dfp-card dfp-empty' }, displayJob.error || t('unscorable')) : null,
              !displayJob && !loading ? h('div', { className: 'dfp-card dfp-empty' }, t('empty')) : null),
            h('section', { className: 'dfp-card', ref: historySectionRef, 'aria-label': t('history') },
              h('div', { className: 'dfp-history-head' },
                h('h2', { className: 'dfp-history-title' },
                  h('span', null, t('history')),
                  h('span', { className: 'dfp-tag' }, String(historyTotal))),
                h('div', { className: 'dfp-history-tools' },
                  h('input', {
                    type: 'search',
                    className: 'dfp-history-search',
                    value: historyQuery,
                    placeholder: t('historySearch'),
                    'aria-label': t('historySearch'),
                    onChange: event => setHistoryQuery(event.target.value),
                  }),
                  h('button', {
                    className: 'dfp-btn dfp-btn-sm',
                    disabled: historyLoading,
                    onClick: refreshHistory,
                  }, t('historyRefresh')),
                  historyItems.length ? h('button', {
                    className: 'dfp-btn dfp-btn-sm dfp-btn-danger',
                    disabled: pendingAction,
                    onClick: clearAllHistory,
                  }, confirmClear ? t('historyClearConfirm') : t('historyClear')) : null)),
              !historyItems.length
                ? h('div', { className: 'dfp-empty', style: { padding: '20px 12px' } }, t('historyEmpty'))
                : !filteredHistory.length
                  ? h('div', { className: 'dfp-empty', style: { padding: '20px 12px' } }, t('historyNoMatch'))
                  : h('div', { className: 'dfp-history-list' }, filteredHistory.map(item => {
                      const active = viewedHistory?.id === item.id
                      const statusKey = item.status === 'complete'
                        ? 'historyStatusComplete'
                        : item.status === 'cancelled'
                          ? 'historyStatusCancelled'
                          : 'historyStatusError'
                      const statusCls = item.status === 'complete'
                        ? 'dfp-tag-ok'
                        : item.status === 'cancelled'
                          ? 'dfp-tag-warn'
                          : 'dfp-tag-bad'
                      const prob = pct(item.mean_probability)
                      const ts = formatTime(item.finished_at || item.created_at)
                      return h('div', {
                        key: item.id,
                        role: 'button',
                        tabIndex: 0,
                        className: `dfp-history-item${active ? ' active' : ''}`,
                        onClick: () => openHistoryEntry(item.id),
                        onKeyDown: (event) => {
                          if (event.key === 'Enter' || event.key === ' ') {
                            event.preventDefault()
                            openHistoryEntry(item.id)
                          }
                        },
                      },
                        h('div', { className: 'dfp-history-main' },
                          h('div', { className: 'dfp-history-row' },
                            h('span', { className: 'dfp-history-target', title: `${item.provider}/${item.model}` }, `${item.provider}/${item.model}`),
                            h('span', { className: `dfp-tag ${statusCls}` }, t(statusKey)),
                            h('span', { className: 'dfp-tag' }, item.source === 'tool' ? t('historySourceTool') : t('historySourcePanel'))),
                          h('div', { className: 'dfp-history-meta' },
                            ts ? h('span', null, ts) : null,
                            h('span', null, t('historyRounds', { valid: item.valid_rounds, total: item.rounds })),
                            item.reasoning_effort ? h('span', null, `${t('effort')}: ${item.reasoning_effort}`) : null)),
                        h('div', { className: 'dfp-history-right' },
                          h('div', { className: 'dfp-history-result' },
                            historyLoadingId === item.id
                              ? h('span', { className: 'dfp-meta' }, t('historyLoading'))
                              : h(React.Fragment, null,
                                  h('span', {
                                    className: 'dfp-history-pred',
                                    title: item.top_candidate_name || item.error || t('unscorable'),
                                  }, item.top_candidate_name || (item.status === 'complete' ? t('unscorable') : (item.error || t(statusKey)))),
                                  item.top_candidate_name
                                    ? h('span', { className: prob ? 'dfp-history-prob' : 'dfp-meta' }, prob || t('noConfidence'))
                                    : null)),
                          h('button', {
                            type: 'button',
                            className: 'dfp-btn dfp-btn-sm dfp-btn-danger',
                            disabled: pendingAction,
                            onClick: (event) => deleteHistoryEntry(item.id, event),
                          }, t('historyDelete'))))
                    }))),
            h('p', { className: 'dfp-note' }, t('closedSet')),
            // 前两条 notes（闭集、成本）已在页面上方说明，这里只保留本次检测特有的提示。
            (displayJob?.notes ?? []).slice(2).map((note, index) => h('p', { className: 'dfp-note', key: index }, note))))
      }

      return { Icon, Panel }
    }

    function apply(ctx) {
      const locale = ctx.get('locale')
      const layout = ctx.get('layout')
      const { Icon, Panel } = createApp(React, null, locale, layout)

      ctx.effect(() => {
        const disposers = []
        try {
          disposers.push(ctx.slots.inject('sidebar.panellist', () => ctx.slots.register({
            name: 'sidebar.panellist',
            id: PANEL_ID,
            order: 40,
            label: () => translate(locale, 'tabLabel'),
          }, Icon)))
        } catch (error) { console.error('[dsh-llm-detector] sidebar entry failed', error) }
        try {
          disposers.push(ctx.slots.inject('main', () => ctx.slots.register({
            name: 'main',
            key: PANEL_ID,
          }, Panel)))
        } catch (error) { console.error('[dsh-llm-detector] main panel failed', error) }
        return () => { for (const dispose of disposers.splice(0)) dispose() }
      }, 'dsh-llm-detector: panel')
    }

    module.exports = { apply, inject: ['slots'], name: 'dsh-llm-detector' }
    return module.exports
  },
})