/**
 * 单样本重试的离线测试（用假 llm，不调用真实模型）。
 *
 * 场景：一轮 3 条样本，其中第 2 条第一次采样网络失败；轮次结束后重试该样本，
 * 第二次成功，该轮 used_outputs 应从 2 变为 3，排名重新计算。
 */
import { createRunner } from '../lib/runner.js'

/** 生成确定性的“像模型”序列，避免序列检查拒绝。 */
function modelLikeNumbers(seed, length = 300) {
  let state = seed >>> 0
  const random = () => {
    state = (state * 1664525 + 1013904223) >>> 0
    return state / 0x100000000
  }
  const output = []
  while (output.length < length) {
    let value = 1 + Math.floor(random() * 355)
    const previous = output[output.length - 1]
    for (let attempt = 0; attempt < 24 && previous !== undefined && Math.abs(value - previous) <= 20; attempt++) {
      if (random() < 0.1) break
      value = 1 + Math.floor(random() * 355)
    }
    output.push(value)
  }
  return output
}

let call = 0
let failNextSecondSample = true
const llm = {
  listProviders: () => [{ id: 'mock', name: 'Mock' }],
  listModels: async () => [{ id: 'mock-model', name: 'Mock model' }],
  async *stream() {
    call++
    // 第 2 次调用（即第 2 条样本）第一次失败，其余成功。
    if (call === 2 && failNextSecondSample) {
      yield { type: 'finish', reason: { kind: 'error', failure: { message: '模拟网络失败', code: 'mock' } } }
      return
    }
    const text = modelLikeNumbers(call * 97).join(', ')
    yield { type: 'text-delta', index: 0, text }
    yield { type: 'finish', reason: { kind: 'stop' } }
  },
}
const ctx = { llm, get: () => undefined }
const runner = createRunner(ctx)

const view = await runner.execute({ provider: 'mock', model: 'mock-model', rounds: 1, samples_per_round: 3 })
const jobId = view.job_id
let snap = runner.snapshot(jobId)
console.log('initial:', snap.rounds[0].samples.map(s => `${s.index}:${s.state}`).join(' '), 'used=', snap.rounds[0].used_outputs)
if (snap.rounds[0].used_outputs !== 2) {
  console.error('预期首次只有 2 条有效样本')
  process.exit(1)
}
const failed = snap.rounds[0].samples.find(s => s.state === 'failed')
if (!failed) {
  console.error('预期有 1 条失败样本')
  process.exit(1)
}

// 不允许重试成功样本
let rejected = false
try { await runner.retrySample(jobId, 1, 1) } catch { rejected = true }
console.log('retrying a complete sample rejected:', rejected)

failNextSecondSample = false
await runner.retrySample(jobId, 1, failed.index)
for (let i = 0; i < 100 && runner.snapshot(jobId).retry; i++) await new Promise(r => setTimeout(r, 20))
snap = runner.snapshot(jobId)
console.log('after retry:', snap.rounds[0].samples.map(s => `${s.index}:${s.state}`).join(' '), 'used=', snap.rounds[0].used_outputs)
console.log('decision:', snap.rounds[0].decision, 'prediction:', snap.rounds[0].prediction, 'probability:', snap.rounds[0].probability)

const ok = snap.rounds[0].used_outputs === 3 && snap.rounds[0].samples.every(s => s.state === 'complete') && rejected
console.log(ok ? 'RETRY TEST PASS' : 'RETRY TEST FAIL')
process.exit(ok ? 0 : 1)