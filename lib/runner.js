/**
 * 检测作业的编排：UI 与模型工具共用这一份实现。
 *
 * - 作业只存在于本进程；页面通过轮询拿快照。
 * - 取消、超时、单条样本失败都留在样本记录里，不丢失整轮结果。
 * - 同时只允许一个作业，避免 UI 与工具同时打同一批渠道。
 */
import { randomUUID } from 'node:crypto'
import { generateChallenges } from './challenge.js'
import { loadData } from './data.js'
import { runRound, sampleOnce } from './detect.js'
import { analyze } from './detector.js'
import { parseNumbers } from './fingerprint.js'

export const MAX_ROUNDS = 3
export const MAX_SAMPLES = 3

const MAX_TEXT_CHARS = 12_000

export const notesFor = (defaultSelection, samples) => [
  '结果是参考库内的闭集排序：库外模型也会得到一个“最像”的候选，置信度不是身份证明。',
  '每次检测会真实调用模型：每轮 3 次、每次约 300 个整数的输出，按所用渠道计费。',
  'DSH 的 provider 适配层可能注入系统提示或改写请求，结果可能因此偏离参考库的采样条件。',
  defaultSelection ? '未指定 provider/model，已使用 DSH 当前默认模型。' : '',
  samples < 3 ? '本次每轮不足 3 条回答，只给排名、没有校准置信度。' : '',
].filter(Boolean)

const topResults = (results, count = 5) => results.slice(0, count).map(item => ({
  model: item.model,
  display_name: item.display_name,
  family_name: item.family_name,
  score: item.score.toFixed(6),
  probability: item.probability === null || item.probability === undefined ? '' : item.probability.toFixed(6),
}))

const sampleView = (sample, includeReplies) => ({
  id: sample.challenge.id,
  index: sample.index ?? 0,
  round: sample.round ?? 1,
  expected_count: sample.expectedCount,
  state: sample.state,
  count: sample.count ?? 0,
  completion: sample.completion ?? (sample.state === 'complete' ? 'complete' : sample.state === 'truncated' ? 'abnormal' : ''),
  error: sample.error ?? '',
  note: sample.note ?? '',
  started_at: sample.startedAt ?? 0,
  finished_at: sample.finishedAt ?? 0,
  ...(includeReplies
    ? {
        prompt: sample.challenge.prompt,
        text: (sample.text ?? '').slice(0, MAX_TEXT_CHARS),
      }
    : {}),
})

export const roundSummary = (round, includeReplies = false) => {
  const analysis = round.analysis
  const complete = round.samples.filter(sample => sample.state === 'complete' || sample.state === 'truncated').length
  const abnormal = round.samples.filter(sample => sample.state === 'truncated').length
  // 异常截断（例如 max-tokens）与“收满要求数量后停止”不同：它可能丢掉尾部
  // 分布，因此只给排名，不把这一轮当作三条完整样本来展示校准置信度。
  const confidenceDegraded = abnormal > 0 && analysis.used_outputs === 3
  return {
    index: round.index,
    prediction: analysis.prediction || '',
    prediction_name: analysis.prediction_name || '',
    family_name: analysis.family_prediction_name || '',
    probability: confidenceDegraded || analysis.probability === null || analysis.probability === undefined
      ? ''
      : analysis.probability.toFixed(6),
    confidence_status: confidenceDegraded ? 'degraded_by_truncation' : analysis.probability_status ?? '',
    abnormal_samples: abnormal,
    decision: analysis.decision ?? 'ranked',
    evidence_label: analysis.evidence?.label ?? '',
    evidence_reason: confidenceDegraded
      ? `${abnormal} 条样本异常截断，分布可能不完整；仅给出排名，校准置信度不可用。`
      : analysis.evidence?.reason ?? '',
    model_like: analysis.sequence?.model_like ?? null,
    sequence: analysis.sequence
      ? {
          autocorrelation: Number(analysis.sequence.autocorrelation.toFixed(4)),
          small_step_share: Number(analysis.sequence.small_step_share.toFixed(4)),
          nearby_pair_share: Number(analysis.sequence.nearby_pair_share.toFixed(4)),
        }
      : null,
    used_outputs: analysis.used_outputs,
    top: topResults(analysis.results),
    diagnostics: analysis.diagnostics.map(d => ({
      index: d.index + 1,
      parsed_numbers: d.parsed_numbers,
      minimum_numbers: d.minimum_numbers,
      accepted: d.accepted,
    })),
    samples: round.samples.map((sample, index) => sampleView({ ...sample, index: index + 1, round: round.index }, includeReplies)),
    sample_total: round.samples.length,
    complete_samples: complete,
    usage: round.samples.reduce((total, sample) => ({
      inputTokens: total.inputTokens + (sample.usage?.inputTokens ?? 0),
      outputTokens: total.outputTokens + (sample.usage?.outputTokens ?? 0),
    }), { inputTokens: 0, outputTokens: 0 }),
    started_at: round.startedAt ?? 0,
    finished_at: round.finishedAt ?? 0,
  }
}

export const summarize = (rounds) => {
  const ranked = rounds.filter(round => round.analysis?.results?.length)
  const counts = new Map()
  for (const round of ranked) {
    const id = round.analysis.prediction
    counts.set(id, (counts.get(id) ?? 0) + 1)
  }
  const ordered = [...counts.entries()].sort((a, b) => b[1] - a[1])
  const top = ordered[0]
  const tied = ordered.length > 1 && ordered[1][1] === top?.[1]
  // 总概率必须与总候选是同一个统计对象：只汇总“该候选获胜”的轮次，
  // 而不是把其他候选第一名的概率平均到它头上。
  const topRounds = ranked.filter(round => round.analysis.prediction === top?.[0])
  const probabilities = topRounds
    .map(round => round.analysis.probability)
    .filter(value => typeof value === 'number')
  return {
    rounds: rounds.length,
    valid_rounds: ranked.length,
    top_candidate: top?.[0] ?? '',
    top_candidate_name: topRounds[0]?.analysis.prediction_name ?? '',
    top_candidate_rounds: top?.[1] ?? 0,
    tied,
    mean_probability: probabilities.length
      ? (probabilities.reduce((a, b) => a + b, 0) / probabilities.length).toFixed(6)
      : '',
    probability_rounds: probabilities.length,
    uncalibrated_rounds: ranked.length - ranked.filter(round => typeof round.analysis.probability === 'number').length,
  }
}

export const listProviders = async (llm, onlyProvider) => {
  const providers = llm.listProviders()
  if (onlyProvider) {
    const known = providers.find(provider => provider.id === onlyProvider)
    if (!known) {
      throw new Error(`未注册的 provider：${onlyProvider}。可用：${providers.map(p => p.id).join(', ') || '（无）'}`)
    }
    const models = await llm.listModels(onlyProvider)
    return {
      providers: [{ id: known.id, name: known.name }],
      models: models.map(model => ({ provider: onlyProvider, id: model.id, name: model.name })),
    }
  }
  return {
    providers: providers.map(provider => ({ id: provider.id, name: provider.name })),
    models: [],
  }
}

const clamp = (value, min, max, fallback) => {
  const number = Number(value)
  if (!Number.isFinite(number)) return fallback
  return Math.max(min, Math.min(max, Math.floor(number)))
}

export function createRunner(ctx) {
  /** @type {Map<string, any>} */
  const jobs = new Map()
  let currentId = null

  const selection = (args) => {
    let provider = args.provider
    let model = args.model
    if (!provider || !model) {
      const current = ctx.get('agentDefaultModel')?.currentSelection?.()
      provider ||= current?.provider
      model ||= current?.model
    }
    if (!provider || !model) {
      throw new Error('未指定 provider/model，且当前 DSH 没有默认模型选择。请先选择 provider 和模型。')
    }
    return { provider, model, usedDefault: !args.provider || !args.model }
  }

  const referenceInfo = (data) => ({
    models: data.models.length,
    built_at: data.builtAt,
    detector_bytes: data.detectorBytes,
    calibration_tau: data.detector.calibration?.tau === undefined
      ? ''
      : String(data.detector.calibration.tau),
  })

  const snapshot = (job) => ({
    id: job.id,
    status: job.status,
    provider: job.provider,
    model: job.model,
    used_default: job.usedDefault,
    created_at: job.createdAt,
    started_at: job.startedAt ?? null,
    finished_at: job.finishedAt ?? null,
    error: job.error ?? '',
    options: job.options,
    reference: job.reference ?? null,
    current: job.current ?? null,
    retry: job.retry ?? null,
    samples: job.samples ?? [],
    rounds: job.rounds.map(round => roundSummary(round, job.options.includeReplies)),
    summary: summarize(job.rounds),
    notes: notesFor(job.usedDefault, job.options.samplesPerRound),
  })

  const viewOf = (job) => {
    const snap = snapshot(job)
    return {
      action: 'detect',
      provider: snap.provider,
      model: snap.model,
      used_default: snap.used_default,
      reference: snap.reference ?? { models: 0, built_at: '', detector_bytes: 0, calibration_tau: '' },
      rounds: snap.rounds,
      summary: snap.summary,
      notes: snap.notes,
      job_id: snap.id,
      status: snap.status,
    }
  }

  function prepare(args) {
    const { provider, model, usedDefault } = selection(args)
    const llm = ctx.llm
    const available = llm.listProviders()
    if (!available.some(item => item.id === provider)) {
      throw new Error(`未注册的 provider：${provider}。可用：${available.map(p => p.id).join(', ') || '（无）'}`)
    }
    const options = {
      rounds: clamp(args.rounds, 1, MAX_ROUNDS, 1),
      samplesPerRound: clamp(args.samples_per_round ?? args.samplesPerRound, 1, MAX_SAMPLES, 3),
      parallel: clamp(args.parallel, 1, 3, 3),
      reasoningEffort: args.reasoning_effort ?? args.reasoningEffort ?? '',
      includeReplies: args.include_replies ?? args.includeReplies ?? true,
    }
    const job = {
      id: randomUUID(),
      provider,
      model,
      usedDefault,
      createdAt: Date.now(),
      status: 'running',
      options,
      rounds: [],
      samples: [],
      current: null,
      controller: new AbortController(),
    }
    jobs.set(job.id, job)
    currentId = job.id
    const finished = [...jobs.values()].filter(item => item !== job && item.status !== 'running' && item.status !== 'cancelling')
    for (const stale of finished.slice(0, Math.max(0, finished.length - 4))) jobs.delete(stale.id)
    return job
  }

  const syncSampleView = (job, sample, roundIndex, index) => {
    const value = sampleView({ ...sample, index: index + 1, round: roundIndex }, job.options.includeReplies)
    const existing = job.samples.findIndex(item => item.round === roundIndex && item.index === index + 1)
    if (existing >= 0) job.samples[existing] = value
    else job.samples.push(value)
  }

  async function execute(args, existingJob) {
    // 同步校验与建作业在 prepare 中完成；之后的拒绝都会落成作业的 error 状态。
    const job = existingJob ?? prepare(args)
    const { provider, model } = job
    const { options } = job
    const llm = ctx.llm
    const signal = args.signal ? AbortSignal.any([args.signal, job.controller.signal]) : job.controller.signal

    const pushSample = (sample, index) => {
      syncSampleView(job, sample, job.current?.index ?? 1, index)
    }

    try {
      // 参考库读取也纳入收尾：失败不能留下永远 running 的作业。
      const data = await loadData()
      job.data = data
      job.reference = referenceInfo(data)
      job.startedAt = Date.now()
      for (let index = 0; index < options.rounds; index++) {
        if (signal.aborted) throw new Error('检测已取消')
        const challenges = generateChallenges(options.samplesPerRound)
        job.current = {
          index: index + 1,
          phase: 'sampling',
          challenges: challenges.map(challenge => ({ id: challenge.id, expected_count: challenge.expected_count })),
        }
        const round = await runRound({
          llm,
          provider,
          model,
          challenges,
          signal,
          reasoningEffort: options.reasoningEffort,
          parallel: options.parallel,
          includeReplies: options.includeReplies,
          detector: data.detector,
          models: data.models,
          onSample: pushSample,
          onRound: () => { if (job.current) job.current.phase = 'scoring' },
        })
        if (signal.aborted) throw new Error('检测已取消')
        round.index = index + 1
        job.rounds.push(round)
        job.current = { index: index + 1, phase: 'scored' }
      }
      if (signal.aborted) throw new Error('检测已取消')
      job.status = 'complete'
    } catch (error) {
      job.status = job.controller.signal.aborted || signal.aborted ? 'cancelled' : 'error'
      job.error = error instanceof Error ? error.message : String(error)
      if (job.current && job.current.phase !== 'scored') job.current.phase = 'stopped'
      for (const sample of job.samples) {
        if (sample.state === 'queued' || sample.state === 'requesting' || sample.state === 'streaming') {
          sample.state = 'cancelled'
          sample.error ||= '检测已停止'
        }
      }
    } finally {
      job.finishedAt = Date.now()
    }
    const view = viewOf(job)
    // 工具输出 schema 只接受字符串/数字等基础类型：可空字段用字符串承载。
    view.rounds = view.rounds.map(round => ({
      ...round,
      model_like: round.model_like === null ? '' : String(round.model_like),
      sequence: round.sequence ? JSON.stringify(round.sequence) : '',
    }))
    return view
  }

  /**
   * 重试某轮里失败/被取消的单条样本。
   *
   * 沿用该样本原来的挑战（同一提示词与期望数量），这样重试只是补采缺失证据，
   * 不改变这一轮的取样条件；成功后重新计算该轮排名与置信度。
   */
  async function retrySample(id, roundIndex, sampleNumber) {
    const job = jobs.get(id ?? currentId)
    if (!job) throw new Error('没有这个检测作业')
    if (job.status === 'running' || job.status === 'cancelling') {
      throw new Error('这一轮还在采样，等它结束后再重试失败样本。')
    }
    if (job.retry) throw new Error('已有一个样本在重试中。')
    const round = job.rounds.find(item => item.index === roundIndex)
    if (!round) throw new Error('该轮尚未评分，暂时不能单独重试；请先等这一轮结束。')
    const sample = round.samples[sampleNumber - 1]
    if (!sample) throw new Error(`该轮没有第 ${sampleNumber} 条样本。`)
    if (sample.state !== 'failed' && sample.state !== 'cancelled') {
      throw new Error('只有失败或被取消的样本需要重试。')
    }
    const data = job.data ?? await loadData()
    job.data = data
    const controller = new AbortController()
    job.retry = { round: roundIndex, index: sampleNumber }
    job.retryController = controller

    const pending = (async () => {
      let lastEmit = 0
      try {
        sample.state = 'requesting'
        sample.error = ''
        sample.note = ''
        sample.text = ''
        sample.count = 0
        sample.startedAt = Date.now()
        sample.finishedAt = null
        syncSampleView(job, sample, roundIndex, sampleNumber - 1)
        const result = await sampleOnce({
          llm: ctx.llm,
          provider: job.provider,
          model: job.model,
          prompt: sample.challenge.prompt,
          expectedCount: sample.expectedCount,
          reasoningEffort: job.options.reasoningEffort,
          signal: controller.signal,
          onText: (text) => {
            sample.state = 'streaming'
            sample.text = text
            sample.count = parseNumbers(text.replace(/\d+$/, '')).length
            const now = Date.now()
            if (now - lastEmit > 150) {
              lastEmit = now
              syncSampleView(job, sample, roundIndex, sampleNumber - 1)
            }
          },
        })
        sample.text = result.text
        sample.count = parseNumbers(result.text).length
        sample.state = result.state
        sample.completion = result.completion ?? 'complete'
        sample.finish = result.finish
        sample.usage = result.usage
        sample.note = result.note ?? ''
      } catch (error) {
        sample.state = controller.signal.aborted ? 'cancelled' : 'failed'
        sample.error = error instanceof Error ? error.message : String(error)
      } finally {
        sample.finishedAt = Date.now()
        syncSampleView(job, sample, roundIndex, sampleNumber - 1)
        // 无论成功失败都重评：成功时把新证据并入该轮，失败时保持该样本不计入。
        const outputs = round.samples.map(item =>
          (item.state === 'complete' || item.state === 'truncated')
            ? { text: item.text, expected_count: item.expectedCount }
            : { text: '', expected_count: item.expectedCount })
        try {
          round.analysis = analyze(outputs, data.detector, data.models, { allowPartial: true })
          round.finishedAt = Date.now()
        } catch (error) {
          job.error = error instanceof Error ? error.message : String(error)
        }
        job.retry = null
        job.retryController = null
      }
    })()
    pending.catch(() => {})
    return { ok: true, round: roundIndex, index: sampleNumber }
  }

  return {
    jobs,
    get currentId() { return currentId },
    get running() {
      return [...jobs.values()].some(job =>
        job.status === 'running' || job.status === 'cancelling' || Boolean(job.retry))
    },
    listProviders: (onlyProvider) => listProviders(ctx.llm, onlyProvider),
    defaultSelection() {
      const current = ctx.get('agentDefaultModel')?.currentSelection?.()
      return current ? { provider: current.provider, model: current.model } : null
    },
    async reference() {
      return referenceInfo(await loadData())
    },
    async start(args) {
      if (this.running) throw new Error('已有一个检测在进行中，请先等待或取消。')
      // 同步完成参数校验与建作业；前置异常直接由路由返回 400，不吞掉。
      const job = prepare(args)
      const pending = execute(args, job)
      pending.catch(() => {})
      return { id: job.id }
    },
    snapshot(id) {
      const job = jobs.get(id ?? currentId)
      return job ? snapshot(job) : null
    },
    cancel(id) {
      const job = jobs.get(id ?? currentId)
      if (!job) return false
      job.controller.abort()
      job.retryController?.abort()
      if (job.status === 'running') {
        // 保持占用运行锁，直到 execute 的 finally 真正收尾，避免取消后立刻并发第二个作业。
        job.status = 'cancelling'
        job.error = '正在取消…'
      }
      return true
    },
    retrySample,
    execute,
    viewOf,
    dispose() {
      for (const job of jobs.values()) {
        job.controller.abort()
        job.retryController?.abort()
      }
      jobs.clear()
    },
  }
}