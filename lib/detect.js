/**
 * 通过 DSH 的 `ctx.llm` 服务采集一条回答，并按数字指纹评分。
 *
 * 与 lm-detector 的在线检测保持同一取样语义：流式接收，收到要求数量的完整
 * 整数即停止（宽松截断）；有效数字不足、拒答或未正常结束的样本被拒绝。
 */
import { parseNumbers } from './fingerprint.js'
import { analyze } from './detector.js'

/** 单条请求的总时限。 */
const SAMPLE_TIMEOUT_MS = 240_000
/** 每条回答的输出上限。推理模型的思考 token 也计入这里，留足余量。 */
export const SAMPLE_MAX_TOKENS = 8192

const minimumNumbers = (expected) => Math.max(80, Math.ceil(expected * 0.55))

/**
 * 把一次 `llm.stream` 调用收成纯文本。
 *
 * @param {object} params
 * @param {any} params.llm DSH 的 llm 服务
 * @param {string} params.provider
 * @param {string} params.model
 * @param {string} params.prompt
 * @param {number} params.expectedCount 挑战要求的整数个数
 * @param {AbortSignal} [params.signal]
 * @param {string} [params.reasoningEffort]
 * @param {number} [params.maxTokens]
 * @param {(text:string)=>void} [params.onText]
 * @returns {Promise<{text:string, capped:boolean, state:'complete'|'truncated', finish:any, usage:any, note?:string}>}
 */
export async function sampleOnce({ llm, provider, model, prompt, expectedCount, signal, reasoningEffort, maxTokens = SAMPLE_MAX_TOKENS, onText }) {
  const controller = new AbortController()
  const timeout = AbortSignal.timeout(SAMPLE_TIMEOUT_MS)
  const combined = signal
    ? AbortSignal.any([signal, timeout, controller.signal])
    : AbortSignal.any([timeout, controller.signal])

  let text = ''
  let finish
  let usage
  let capped = false
  let cappedAt = 0
  let error

  try {
    for await (const chunk of llm.stream({
      provider,
      model,
      messages: [{ role: 'user', content: [{ type: 'text', text: prompt }] }],
      ...(reasoningEffort ? { reasoningEffort } : {}),
      maxTokens,
      signal: combined,
    })) {
      if (chunk.type === 'text-delta') {
        text += chunk.text
        onText?.(text)
        if (!capped) {
          // 末尾的数字可能还没写完（例如 3 会变成 355），只统计完整整数。
          const numbers = parseNumbers(text.replace(/\d+$/, ''))
          if (numbers.length >= expectedCount) {
            capped = true
            cappedAt = numbers.length
            controller.abort()
          }
        }
      } else if (chunk.type === 'usage') {
        usage = chunk.usage
      } else if (chunk.type === 'finish') {
        finish = chunk.reason
      }
    }
  } catch (cause) {
    if (capped) {
      // 截断后的取消是预期行为；用法报告可能来不及到达，忽略。
    } else if (signal?.aborted) {
      throw new Error('检测已取消')
    } else if (timeout.aborted) {
      throw new Error(`请求超时（${SAMPLE_TIMEOUT_MS / 1000} 秒）`)
    } else if (cause?.name === 'AbortError') {
      throw new Error('请求被中断')
    } else {
      error = cause instanceof Error ? cause.message : String(cause)
    }
  }

  if (capped) {
    const numbers = parseNumbers(text)
    return {
      text: numbers.slice(0, expectedCount).join(', '),
      capped: true,
      state: 'truncated',
      finish,
      usage,
      note: `收到 ${cappedAt} 个有效整数后停止（要求 ${expectedCount}）`,
    }
  }
  if (error) throw new Error(error)
  if (finish?.kind === 'error') throw new Error(finish.failure?.message || '上游返回错误')
  if (finish?.kind === 'aborted') throw new Error('上游中止了请求')
  if (finish?.kind !== 'stop') {
    return { text, capped: false, state: 'truncated', finish, usage, note: `输出未正常结束：${finish?.kind ?? '未知'}` }
  }
  const count = parseNumbers(text).length
  if (count < minimumNumbers(expectedCount)) {
    throw new Error(`有效数字不足：${count}，至少需要 ${minimumNumbers(expectedCount)}`)
  }
  return { text, capped: false, state: 'complete', finish, usage }
}

/**
 * 跑一轮：并发/串行采样 `challenges`，再评分。
 *
 * @param {object} params
 * @param {any} params.llm
 * @param {string} params.provider
 * @param {string} params.model
 * @param {{id:string,expected_count:number,prompt:string}[]} params.challenges
 * @param {AbortSignal} [params.signal]
 * @param {string} [params.reasoningEffort]
 * @param {number} [params.parallel]
 * @param {(index:number, state:string)=>void} [params.onSample]
 * @param {(round:any)=>void} [params.onRound]
 * @returns {Promise<any>}
 */
export async function runRound({ llm, provider, model, challenges, signal, reasoningEffort, parallel = 1, onSample, onRound, detector, models }) {
  const samples = challenges.map(challenge => ({
    challenge,
    state: 'queued',
    text: '',
    count: 0,
    expectedCount: challenge.expected_count,
  }))
  const run = async (index) => {
    const sample = samples[index]
    if (signal?.aborted) {
      sample.state = 'cancelled'
      sample.error = '已取消'
      onSample?.(index, sample.state)
      return
    }
    sample.state = 'requesting'
    onSample?.(index, sample.state)
    try {
      const result = await sampleOnce({
        llm,
        provider,
        model,
        prompt: challenges[index].prompt,
        expectedCount: challenges[index].expected_count,
        reasoningEffort,
        signal,
        onText: () => { sample.state = 'streaming'; onSample?.(index, sample.state) },
      })
      sample.text = result.text
      sample.count = parseNumbers(result.text).length
      sample.state = result.state === 'complete' ? 'complete' : 'truncated'
      sample.finish = result.finish
      sample.usage = result.usage
      if (result.note) sample.note = result.note
    } catch (cause) {
      sample.state = 'failed'
      sample.error = cause instanceof Error ? cause.message : String(cause)
    }
    onSample?.(index, sample.state)
  }

  let next = 0
  const worker = async () => {
    while (!signal?.aborted && next < samples.length) {
      const index = next++
      await run(index)
    }
  }
  await Promise.all(Array.from({ length: Math.max(1, Math.min(parallel, samples.length)) }, worker))

  const outputs = samples.map(sample =>
    (sample.state === 'complete' || sample.state === 'truncated')
      ? { text: sample.text, expected_count: sample.expectedCount }
      : { text: '', expected_count: sample.expectedCount })
  const analysis = analyze(outputs, detector, models, { allowPartial: true })
  const round = { index: null, samples, analysis, startedAt: Date.now(), finishedAt: Date.now() }
  onRound?.(round)
  return round
}