/**
 * 运行时数据：冻结检测器 + 参考库模型清单。
 *
 * 两个文件都随插件分发（`data/`），首次使用时读取并缓存。
 */
import { readFile } from 'node:fs/promises'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { decodeDetector } from './codec.js'

const dataDir = join(dirname(fileURLToPath(import.meta.url)), '..', 'data')

/** @type {Promise<{detector:any, models:any[], builtAt:string, detectorBytes:number}>|undefined} */
let cache

/** 读取并解码 `data/detector.bin` 与 `data/models.json`。 */
export async function loadData() {
  cache ??= (async () => {
    const [detectorBytes, modelsRaw] = await Promise.all([
      readFile(join(dataDir, 'detector.bin')),
      readFile(join(dataDir, 'models.json'), 'utf8'),
    ])
    const doc = JSON.parse(modelsRaw)
    if (doc.schema !== 'dsh-llm-detector-models-v1') throw new Error(`未知的模型清单格式：${doc.schema}`)
    const detector = decodeDetector(new Uint8Array(detectorBytes))
    return {
      detector,
      models: doc.models,
      builtAt: doc.bank_built_at,
      detectorBytes: detectorBytes.byteLength,
    }
  })()
  return cache
}