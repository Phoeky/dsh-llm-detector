/**
 * 轮次进行中重试的离线测试（假 llm，不调用真实模型）。
 *
 * 场景：一轮 3 条样本并行发送；第 2 条立刻失败，第 3 条延迟 3 秒才返回。
 * 在第 3 条还在跑的时候重试第 2 条——旧实现会拒绝，新实现应接受，
 * 并在整轮结束时得到 3/3 有效样本。
 */
import { createRunner } from '../lib/runner.js'

const sleep = (ms) => new Promise(resolve => setTimeout(resolve, ms))

function numbers(seed, length = 300) {
  let state = seed >>> 0
  const random = () => {
    state = (state * 1664525 + 1013904223) >>> 0
    return state / 0x100000000
  }
  const out = []
  while (out.length < length) {
    let value = 1 + Math.floor(random() * 355)
    const previous = out[out.length - 1]
    for (let attempt = 0; attempt < 24 && previous !== undefined && Math.abs(value - previous) <= 20; attempt++) {
      if (random() < 0.1) break
      value = 1 + Math.floor(random() * 355)
    }
    out.push(value)
  }
  return out.join(', ')
}

let call = 0
const llm = {
  listProviders: () => [{ id: 'mock', name: 'Mock' }],
  listModels: async () => [{ id: 'mock-model', name: 'Mock model' }],
  async *stream() {
    call++
    const index = call
    // 第 1 条：异常截断且只给出少量数字，评分时应被拒绝
    if (index === 1) {
      yield { type: 'text-delta', index: 0, text: '1, 2, 3, 4, 5, 6, 7, 8, 9, 10' }
      yield { type: 'finish', reason: { kind: 'max-tokens' } }
      return
    }
    // 第 2 条：直接失败，测试里会重试
    if (index === 2) {
      yield { type: 'finish', reason: { kind: 'error', failure: { message: '模拟第 2 条失败', code: 'mock' } } }
      return
    }
    // 第 3 条：延迟 3 秒，让轮次在重试发生时仍在采样
    if (index === 3) await sleep(3000)
    yield { type: 'text-delta', index: 0, text: numbers(index * 61) }
    yield { type: 'finish', reason: { kind: 'stop' } }
  },
}
const runner = createRunner({ llm, get: () => undefined })

const { id } = await runner.start({ provider: 'mock', model: 'mock-model', rounds: 1, samples_per_round: 3, parallel: 3 })
console.log('job started', id)
await sleep(900)

const job = runner.jobs.get(id)
const live = job?.liveRound
console.log('live round exists:', Boolean(live), 'status:', job?.status)
if (!live) {
  console.error('FAIL: 轮次进行中时应暴露 liveRound')
  process.exit(1)
}
const failed = live.samples.findIndex(sample => sample.state === 'failed')
console.log('failed sample index:', failed + 1, 'states:', live.samples.map(s => s.state).join(','))
if (failed < 0) {
  console.error('FAIL: 预期有失败样本')
  process.exit(1)
}

const retry = await runner.retrySample(id, 1, failed + 1)
console.log('retry accepted while round running:', retry.ok)

for (let i = 0; i < 200; i++) {
  await sleep(100)
  const snap = runner.snapshot(id)
  if (snap.status !== 'running') break
}
const snap = runner.snapshot(id)
const round = snap.rounds[0]
console.log('final:', JSON.stringify({
  status: snap.status,
  used: round?.used_outputs,
  states: round?.samples.map(s => s.state),
  decision: round?.decision,
}))
const ok = snap.status === 'complete'
  && round?.used_outputs === 2
  && round.samples[0].state === 'truncated'
  && round.samples[1].state === 'complete'
  && round.samples[2].state === 'complete'
  && round.diagnostics[1].parsed_numbers > 0
if (!ok) console.error('期望：截断样本被拒、重试样本被接受（used=2）')
console.log(ok ? 'LIVE RETRY TEST PASS' : 'LIVE RETRY TEST FAIL')
process.exit(ok ? 0 : 1)