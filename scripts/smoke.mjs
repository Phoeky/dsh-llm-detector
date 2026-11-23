/**
 * 离线冒烟测试：不调用任何模型。
 *
 * 1. 编解码往返：detector.bin 解码 → 编码 → 再解码，参数一致。
 * 2. 特征管道：从参考库某模型的 355 维计数生成“像语言模型”的序列，评分后
 *    检查排名里是否出现该模型。
 * 3. 序列检查：均匀随机数应被判为“不像语言模型回答”。
 *
 * 用法：node scripts/smoke.mjs
 */
import { readFile } from 'node:fs/promises'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { decodeDetector, encodeDetector } from '../lib/codec.js'
import { analyze } from '../lib/detector.js'

const root = join(dirname(fileURLToPath(import.meta.url)), '..')
const detector = decodeDetector(new Uint8Array(await readFile(join(root, 'data', 'detector.bin'))))
const models = JSON.parse(await readFile(join(root, 'data', 'models.json'), 'utf8')).models
const bank = JSON.parse(await readFile(join(root, 'data', 'upstream', 'unified_bank.json'), 'utf8'))

const roundtrip = decodeDetector(encodeDetector(detector))
const same = roundtrip.model_ids.join(',') === detector.model_ids.join(',')
  && roundtrip.ranker.lda_weights.every((row, i) => row.every((v, j) => v === detector.ranker.lda_weights[i][j]))
console.log('codec roundtrip:', same ? 'ok' : 'MISMATCH')

/** 按模型的 355 维计数抽 300 个数，并倾向于避开与上一个数相差 ≤20 的值。 */
function sampleModelLike(counts, length, seed) {
  const values = []
  for (let v = 0; v < counts.length; v++) values.push(...Array(counts[v]).fill(v + 1))
  if (!values.length) throw new Error('empty counts')
  let state = seed >>> 0
  const random = () => {
    state = (state * 1664525 + 1013904223) >>> 0
    return state / 0x100000000
  }
  const output = []
  while (output.length < length) {
    let value = values[Math.floor(random() * values.length)]
    const previous = output[output.length - 1]
    for (let attempt = 0; attempt < 24 && previous !== undefined && Math.abs(value - previous) <= 20; attempt++) {
      if (random() < 0.15) break
      value = values[Math.floor(random() * values.length)]
    }
    output.push(value)
  }
  return output
}

const target = 'gpt-6-astra'
const index = models.findIndex(model => model.id === target)
const counts = bank.models[index].counts
const replies = [1, 2, 3].map(seed => sampleModelLike(counts, 300, seed).join(', '))
const outputs = replies.map(text => ({ text, expected_count: 300 }))
const analysis = analyze(outputs, detector, models)

console.log('sequence:', JSON.stringify(analysis.sequence))
console.log('prediction:', analysis.prediction, 'probability:', analysis.probability)
console.log('top5:', analysis.results.slice(0, 5).map(r => `${r.model}:${r.score.toFixed(3)}`).join(' '))
const position = analysis.results.findIndex(r => r.model === target)
console.log(`target ${target} rank: ${position >= 0 ? position + 1 : 'not ranked'}`)

const uniform = (seed) => {
  let state = seed >>> 0
  return Array.from({ length: 300 }, () => {
    state = (state * 1664525 + 1013904223) >>> 0
    return 1 + (state % 355)
  }).join(', ')
}
const randomAnalysis = analyze([1, 2, 3].map(seed => ({ text: uniform(seed), expected_count: 300 })), detector, models)
console.log('uniform decision:', randomAnalysis.decision, 'model_like:', randomAnalysis.sequence?.model_like)

if (!same) process.exitCode = 1
if (analysis.results.length === 0) process.exitCode = 1
if (randomAnalysis.decision !== 'not_model') {
  console.error('uniform numbers should be rejected by the sequence check')
  process.exitCode = 1
}