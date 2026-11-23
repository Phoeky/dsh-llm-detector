/**
 * 从 lm-detector 的冻结数据生成 dsh-llm-detector 的运行时数据。
 *
 * 输入（不提交到仓库）：
 *   ../data-bank.json        lm-detector 的 data/unified_bank.json（约 15 MB）
 *   ../data/shared_detector.bin
 * 输出：
 *   data/models.json         参考库模型元数据（id/display_name/family/response_count）
 *   data/detector.bin        冻结的排名器与校准参数（原样复制）
 *
 * 用法：node scripts/build-data.mjs
 */
import { copyFile, mkdir, readFile, writeFile } from 'node:fs/promises'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { decodeDetector } from '../lib/codec.js'

const here = dirname(fileURLToPath(import.meta.url))
const root = join(here, '..')
const out = join(root, 'data')

await mkdir(out, { recursive: true })

const bank = JSON.parse(await readFile(join(root, 'data-bank.json'), 'utf8'))
if (bank.schema !== 'robust-number-fingerprint-bank') throw new Error(`unexpected bank schema: ${bank.schema}`)

const models = bank.models.map(model => ({
  id: model.id,
  display_name: model.display_name ?? model.id,
  family: model.family ?? 'other',
  family_name: model.family_name ?? '其他',
  response_count: model.response_count,
}))
await writeFile(join(out, 'models.json'), JSON.stringify({
  schema: 'dsh-llm-detector-models-v1',
  bank_built_at: bank.built_at,
  bank_schema: bank.schema,
  models,
}, null, 2) + '\n')

await copyFile(join(out, 'upstream', 'shared_detector.bin'), join(out, 'detector.bin'))

const detector = decodeDetector(new Uint8Array(await readFile(join(out, 'detector.bin'))))
console.log(JSON.stringify({
  models: models.length,
  detector_schema: detector.schema,
  detector_models: detector.model_ids.length,
  calibration_tau: detector.calibration?.tau ?? null,
  lda_dim: detector.ranker.lda_weights[0].length,
  positional_dim: detector.ranker.positional.weights[0].length,
  references: detector.ranker.references.map(r => r.length).reduce((a, b) => a + b, 0),
  environment_sets: detector.ranker.bank.ordered_blocks.environment_centroids.length,
  bank_built_at: detector.bank_built_at,
  models_json_built_at: bank.built_at,
}, null, 2))