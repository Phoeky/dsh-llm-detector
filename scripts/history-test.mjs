/**
 * 历史记录存储与 runner/tool 集成的离线测试（不调用真实模型）。
 *
 * 覆盖：
 * 1. 落盘持久化与重启重新加载
 * 2. 超出 maxEntries 上限时按时间倒序裁剪
 * 3. 损坏 JSON 自动容错
 * 4. 筛选过滤（provider、query、limit）
 * 5. runner 完成作业自动写入历史，失败样本重试后自动更新历史
 * 6. llm_fingerprint 工具 action=detect (source=tool) 与 action=history
 * 7. 删除单条与清空历史
 *
 * 用法：node scripts/history-test.mjs
 */
import assert from 'node:assert/strict'
import { mkdtemp, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { createHistoryStore } from '../lib/history.js'
import { createRunner } from '../lib/runner.js'
import { apply } from '../index.js'

const sleep = (ms) => new Promise(resolve => setTimeout(resolve, ms))

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
  return output.join(', ')
}

const tempDir = await mkdtemp(join(tmpdir(), 'dsh-llm-detector-history-'))

try {
  // 1. 基础持久化、重新加载、容量上限与过滤
  const fileA = join(tempDir, 'store-a.json')
  const store1 = createHistoryStore({ filePath: fileA, maxEntries: 3 })
  for (let i = 1; i <= 4; i++) {
    await store1.save({
      id: `job-${i}`,
      source: i % 2 === 0 ? 'tool' : 'panel',
      status: 'complete',
      provider: i <= 2 ? 'alpha' : 'beta',
      model: `model-${i}`,
      created_at: i * 1000,
      finished_at: i * 1000 + 500,
      options: { rounds: 1, parallel: 3, reasoningEffort: i === 4 ? 'high' : '' },
      summary: {
        rounds: 1,
        valid_rounds: 1,
        top_candidate: `cand-${i}`,
        top_candidate_name: `Candidate ${i}`,
        top_candidate_rounds: 1,
        mean_probability: '0.812300',
        tied: false,
      },
      rounds: [],
      notes: [],
    })
  }
  // 模拟进程重启：用新实例读取同一个文件
  const store2 = createHistoryStore({ filePath: fileA, maxEntries: 3 })
  const listed = await store2.list()
  assert.equal(listed.allTotal, 3, '应只保留最新 3 条记录')
  assert.deepEqual(listed.items.map(item => item.id), ['job-4', 'job-3', 'job-2'])
  assert.equal(listed.items[0].reasoning_effort, 'high')
  assert.equal(listed.items[0].source, 'tool')

  const filteredByProvider = await store2.list({ provider: 'beta' })
  assert.equal(filteredByProvider.total, 2)
  assert.deepEqual(filteredByProvider.items.map(item => item.id), ['job-4', 'job-3'])

  const filteredByQuery = await store2.list({ q: 'candidate 3' })
  assert.equal(filteredByQuery.total, 1)
  assert.equal(filteredByQuery.items[0].id, 'job-3')

  const limited = await store2.list({ limit: 2 })
  assert.equal(limited.items.length, 2)
  assert.equal(limited.total, 3)

  const detail = await store2.get('job-4')
  assert.equal(detail?.id, 'job-4')
  assert.equal(await store2.remove('job-3'), true)
  assert.equal(await store2.remove('job-3'), false)
  assert.equal(await store2.count(), 2)
  assert.deepEqual(await store2.clear(), { cleared: 2 })
  assert.equal(await store2.count(), 0)

  // 2. 损坏文件自动容错
  const badFile = join(tempDir, 'corrupt.json')
  await writeFile(badFile, '{not-valid-json', 'utf8')
  const badStore = createHistoryStore({ filePath: badFile })
  assert.equal(await badStore.count(), 0, '损坏文件应降级为空历史')

  // 3. runner 集成：检测自动入库 + 重试样本后同步更新历史
  const fileB = join(tempDir, 'runner-history.json')
  const runnerHistory = createHistoryStore({ filePath: fileB })
  let call = 0
  let failSecond = true
  const llm = {
    listProviders: () => [{ id: 'mock', name: 'Mock' }],
    listModels: async () => [{ id: 'mock-model', name: 'Mock model' }],
    async *stream() {
      call++
      if (call === 2 && failSecond) {
        yield { type: 'finish', reason: { kind: 'error', failure: { message: '模拟失败', code: 'mock' } } }
        return
      }
      yield { type: 'text-delta', index: 0, text: modelLikeNumbers(call * 73) }
      yield { type: 'finish', reason: { kind: 'stop' } }
    },
  }
  const runner = createRunner({ llm, get: () => undefined }, { history: runnerHistory })
  const started = await runner.start({ provider: 'mock', model: 'mock-model', rounds: 1, samples_per_round: 3, parallel: 1 })
  for (let i = 0; i < 100; i++) {
    await sleep(30)
    if (runner.snapshot(started.id)?.status !== 'running') break
  }
  const savedBeforeRetry = await runner.getHistory(started.id)
  assert.ok(savedBeforeRetry, '作业完成后应自动保存到历史')
  assert.equal(savedBeforeRetry.rounds[0].used_outputs, 2)

  failSecond = false
  await runner.retrySample(started.id, 1, 2)
  for (let i = 0; i < 100; i++) {
    await sleep(30)
    if (!runner.snapshot(started.id)?.retry) break
  }
  const savedAfterRetry = await runner.getHistory(started.id)
  assert.equal(savedAfterRetry.rounds[0].used_outputs, 3, '重试完成后历史记录应同步更新')
  runner.dispose()

  // 4. 插件工具 action=detect (source=tool) 与 action=history
  process.env.DSH_LLM_DETECTOR_HISTORY_FILE = join(tempDir, 'tool-history.json')
  const registeredTools = []
  const provided = new Map()
  const effects = []
  const toolCtx = {
    llm: {
      listProviders: () => [{ id: 'mock', name: 'Mock' }],
      listModels: async () => [{ id: 'mock-model', name: 'Mock model' }],
      async *stream() {
        yield { type: 'text-delta', index: 0, text: modelLikeNumbers(101) }
        yield { type: 'finish', reason: { kind: 'stop' } }
      },
    },
    tools: { register: (t) => registeredTools.push(t) },
    provide(k, v) { provided.set(k, v); toolCtx[k] = v },
    get(k) { return provided.get(k) },
    effect(fn) { effects.push(fn()) },
  }
  apply(toolCtx)
  const tool = registeredTools[0]
  const detectOut = await tool.execute({ action: 'detect', provider: 'mock', model: 'mock-model', rounds: 1, samples_per_round: 1 }, {})
  assert.equal(detectOut.status, 'complete')

  const historyOut = await tool.execute({ action: 'history', limit: 5 }, {})
  assert.equal(historyOut.action, 'history')
  assert.equal(historyOut.history.length, 1)
  assert.equal(historyOut.history[0].source, 'tool')
  assert.equal(historyOut.history[0].id, detectOut.job_id)
  const rendered = tool.output.render({}, historyOut)
  assert.match(rendered[0].text, /最近 1 条检测历史/)

  for (const dispose of effects.reverse()) {
    if (typeof dispose === 'function') dispose()
  }
  console.log('HISTORY TEST PASS')
} finally {
  await rm(tempDir, { recursive: true, force: true })
}
