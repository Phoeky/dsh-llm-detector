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
        referenceUnavailable: '参考库不可用，无法开始检测',
        phasePreparing: '准备中',
        phaseScoring: '评分中',
        roundOf: '第 {n}/{total} 轮',
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
        referenceUnavailable: 'Reference bank unavailable; detection is disabled',
        phasePreparing: 'Preparing',
        phaseScoring: 'Scoring',
        roundOf: 'Round {n}/{total}',
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
.dfp-title{margin:0;font-size:20px;font-weight:650;letter-spacing:-.01em}
.dfp-sub{margin:6px 0 0;font-size:13px;line-height:1.6;color:var(--dsw-alias-label-secondary);max-width:620px}
.dfp-card{background:var(--dsw-alias-bg-layer-1);border:1px solid var(--dsw-alias-border-l1);border-radius:12px;padding:16px}
.dfp-form{display:grid;grid-template-columns:1fr 1fr 96px 96px;gap:12px}
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
.dfp-how{margin-top:12px;font-size:13px;color:var(--dsw-alias-label-secondary)}
.dfp-how summary{cursor:pointer;font-weight:600;color:var(--dsw-alias-label-primary)}
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
@media (max-width:760px){.dfp-form{grid-template-columns:1fr 1fr}.dfp-samples{grid-template-columns:1fr}.dfp-root{padding:16px}}
@media (max-width:480px){.dfp-form{grid-template-columns:1fr}.dfp-head{flex-direction:column}}
@media (prefers-reduced-motion:reduce){.dfp-spinner{animation:none}}
`

    const pct = (value) => {
      const number = Number(value)
      return Number.isFinite(number) && number > 0 ? `${(number * 100).toFixed(1)}%` : ''
    }

    function createApp(React, host, locale, layout) {
      const h = React.createElement
      const t = (key, params) => translate(locale, key, params)
      let token = ''

      const api = async (path, options = {}) => {
        const response = await fetch(API + path, {
          ...options,
          headers: {
            Accept: 'application/json',
            ...(options.body ? { 'Content-Type': 'application/json' } : {}),
            ...(options.write ? { 'x-llm-detector-token': token } : {}),
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
        const [job, setJob] = React.useState(null)
        const [error, setError] = React.useState('')
        const [reference, setReference] = React.useState(null)
        const [referenceError, setReferenceError] = React.useState('')
        const [localeTick, setLocaleTick] = React.useState(0)
        const [copied, setCopied] = React.useState(false)
        const copyTimer = React.useRef(null)
        React.useEffect(() => () => clearTimeout(copyTimer.current), [])
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
              const preferred = boot.default?.provider && boot.providers.some(p => p.id === boot.default.provider)
                ? boot.default.provider
                : boot.providers[0]?.id ?? ''
              setProvider(preferred)
              if (boot.default?.model) setModel(boot.default.model)
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
              setModel(listed.models[0]?.id ?? '')
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

        const [pendingAction, setPendingAction] = React.useState(false)
        const start = async () => {
          if (pendingAction || busy || modelsLoading || !provider || !model) return
          if (!models.some(item => item.id === model)) {
            setError(t('model') + ': ' + model)
            return
          }
          setPendingAction(true)
          setError('')
          try {
            const result = await api('/start', {
              method: 'POST',
              write: true,
              body: JSON.stringify({ provider, model, rounds, parallel, includeReplies }),
            })
            if (result.snapshot) setJob(result.snapshot)
            else if (result.id) setJob(await api(`/job?id=${encodeURIComponent(result.id)}`))
          } catch (cause) { setError(cause.message) }
          finally { setPendingAction(false) }
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

        const activeRound = job?.current?.index ?? (job?.rounds?.length ?? 0) + 1
        const currentSamples = (job?.samples ?? []).filter(sample => sample.round === activeRound)
        const unfinished = running || (job && job.current && job.current.phase !== 'scored' && currentSamples.length > 0)
        const placeholderCount = job?.current?.challenges?.length ?? job?.options?.samplesPerRound ?? 3
        const displaySamples = currentSamples.length
          ? currentSamples
          : Array.from({ length: placeholderCount }, (_, index) => ({
              id: `pending-${index}`,
              index: index + 1,
              state: 'queued',
              count: 0,
              expected_count: job?.current?.challenges?.[index]?.expected_count ?? 0,
            }))

        return h('div', { className: 'dfp-root', 'data-locale-tick': localeTick },
          h('style', null, css),
          h('div', { className: 'dfp-inner' },
            h('div', { className: 'dfp-head' },
              h('div', null,
                h('h1', { className: 'dfp-title' }, t('title')),
                h('p', { className: 'dfp-sub' }, t('subtitle'))),
              h('button', { className: 'dfp-btn', onClick: () => layout?.selectPanel?.(null) }, t('back'))),
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
                      [1, 2, 3].map(n => h('option', { key: n, value: n }, n))))),
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
            h('div', { className: 'dfp-card' },
              h('p', { className: 'dfp-section-title' }, t('usageTitle')),
              h('ul', { className: 'dfp-usage-list' },
                h('li', null, t('usagePanel')),
                h('li', null, t('usageChat'))),
              h('div', { className: 'dfp-chat-example' },
                h('code', null, t('chatExample')),
                h('button', { className: 'dfp-btn', onClick: copyChatPrompt }, copied ? t('copied') : t('copy'))),
              h('details', { className: 'dfp-how' },
                h('summary', null, t('howTitle')),
                h('ul', { className: 'dfp-usage-list' },
                  h('li', null, t('how1')),
                  h('li', null, t('how2')),
                  h('li', null, t('how3'))))),
            error ? h('div', { className: 'dfp-card dfp-error', role: 'alert' }, `${t('error')}: ${error}`) : null,
            job && job.status !== 'running' && job.status !== 'cancelling' && job.status !== 'complete'
              ? h('div', { className: 'dfp-card dfp-warn', role: 'status' },
                  `${job.status === 'cancelled' ? t('cancelled') : t('statusError')} · ${t('incomplete')}${job.error ? ` · ${job.error}` : ''}`)
              : null,
            running ? h('div', { className: 'dfp-card', role: 'status', 'aria-live': 'polite', 'aria-busy': 'true' },
              h('div', { className: 'dfp-result-top' },
                h('span', { className: 'dfp-prediction' }, `${job.provider}/${job.model}`)),
              h('div', { className: 'dfp-meta' }, `${job.status === 'cancelling' ? t('cancelling') : t('running')} ${t('validRounds')} ${job.summary.valid_rounds}`))
            : job?.summary?.valid_rounds ? h('div', { className: 'dfp-card' },
              h('div', { className: 'dfp-result-top' },
                h('span', { className: 'dfp-prediction' }, job.summary.top_candidate_name),
                job.summary.mean_probability ? h('span', { className: 'dfp-prob' }, pct(job.summary.mean_probability)) : null),
              h('div', { className: 'dfp-meta' },
                `${job.provider}/${job.model} · ${t('topCandidate')} ${job.summary.top_candidate_rounds}/${job.summary.rounds} · ${t('validRounds')} ${job.summary.valid_rounds}`),
              h('div', { className: 'dfp-meta' }, job.summary.mean_probability ? t('relativeConfidence') : t('scoreOnly')),
              job.summary.tied ? h('div', { className: 'dfp-meta dfp-warn' }, t('tied')) : null,
              job.summary.uncalibrated_rounds ? h('div', { className: 'dfp-meta' }, `${t('noConfidence')}: ${job.summary.uncalibrated_rounds}`) : null) : null,
            unfinished ? h('section', { className: 'dfp-round', 'aria-busy': running ? 'true' : 'false' },
              h('div', { className: 'dfp-round-head' },
                h('div', { className: 'dfp-round-title' },
                  `${t('roundOf', { n: activeRound, total: job?.options?.rounds ?? 1 })} · ${job?.current?.phase === 'scoring' ? t('phaseScoring') : running ? t('roundInProgress') : t('incomplete')}`),
                running ? h('span', { className: 'dfp-spinner', 'aria-hidden': 'true' }) : null),
              h('div', { className: 'dfp-samples' }, displaySamples.map(sample => h(SampleCard, { key: sample.id, sample })))) : null,
            (job?.rounds ?? []).map(round => h(RoundView, {
              key: round.index,
              round,
              onRetry: retrySample,
              busy: busy || pendingAction,
            })),
            job && !running && !job.summary.valid_rounds ? h('div', { className: 'dfp-card dfp-empty' }, job.error || t('unscorable')) : null,
            !job && !loading ? h('div', { className: 'dfp-card dfp-empty' }, t('empty')) : null,
            h('p', { className: 'dfp-note' }, t('closedSet')),
            // 前两条 notes（闭集、成本）已在页面上方说明，这里只保留本次检测特有的提示。
            (job?.notes ?? []).slice(2).map((note, index) => h('p', { className: 'dfp-note', key: index }, note))))
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