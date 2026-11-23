/**
 * 数字指纹的基础特征。
 *
 * 移植自 Ikaleio/lm-detector 的 `shared/fingerprint-core.js`（MIT，见 NOTICE）。
 * 只保留推理需要的部分：解析、计数、Hellinger 嵌入、位置/末位块。
 */

export const VALUE_MIN = 1
export const VALUE_MAX = 355
export const DIMENSION = VALUE_MAX - VALUE_MIN + 1
export const ALPHA = 0.5

/**
 * 取出文本中最长的一段 1–355 整数。字母会打断一段序列。
 * @param {unknown} text @returns {number[]}
 */
export function parseNumbers(text) {
  /** @type {number[][]} */
  const runs = []
  /** @type {number[]} */
  let current = []
  let previousEnd = 0
  for (const match of String(text).matchAll(/\d+/g)) {
    const separator = String(text).slice(previousEnd, match.index)
    const value = Number(match[0])
    if (current.length && /\p{L}/u.test(separator)) {
      runs.push(current)
      current = []
    }
    if (value >= VALUE_MIN && value <= VALUE_MAX) current.push(value)
    previousEnd = match.index + match[0].length
  }
  if (current.length) runs.push(current)
  return runs.reduce((best, run) => (run.length > best.length ? run : best), [])
}

/** @param {number[]} numbers @returns {number[]} 355 个取值的计数 */
export function countNumbers(numbers) {
  const counts = Array(DIMENSION).fill(0)
  numbers.forEach((number) => { counts[number - VALUE_MIN] += 1 })
  return counts
}

/**
 * Hellinger 嵌入：平滑后开平方，欧氏距离与 Hellinger 距离成正比。
 * @param {number[]} counts @returns {number[]}
 */
export function hellingerFeature(counts) {
  const total = counts.reduce((sum, value) => sum + value, 0) + ALPHA * DIMENSION
  return counts.map((value) => Math.sqrt((value + ALPHA) / total))
}

/** @param {number[]} values @returns {number[][]} 均分为 4 段 */
function splitIntoFour(values) {
  const base = Math.floor(values.length / 4)
  const remainder = values.length % 4
  /** @type {number[][]} */
  const chunks = []
  let start = 0
  for (let index = 0; index < 4; index += 1) {
    const size = base + (index < remainder ? 1 : 0)
    chunks.push(values.slice(start, start + size))
    start += size
  }
  return chunks
}

/**
 * 位置/末位块：4 段 × 16 个取值区间 + 末位 0–9，共 74 维。
 * @param {number[]} numbers @returns {number[]}
 */
export function orderedBlockFeature(numbers) {
  /** @type {number[]} */
  const pieces = []
  for (const chunk of splitIntoFour(numbers)) {
    const bins = Array(16).fill(0.5)
    for (const value of chunk) {
      const index = Math.min(15, Math.floor(((value - 1) / 355) * 16))
      bins[index] += 1
    }
    const total = bins.reduce((sum, value) => sum + value, 0)
    pieces.push(...bins.map((value) => Math.sqrt(value / total)))
  }
  const lastDigits = Array(10).fill(0.5)
  numbers.forEach((value) => { lastDigits[value % 10] += 1 })
  const lastTotal = lastDigits.reduce((sum, value) => sum + value, 0)
  pieces.push(...lastDigits.map((value) => Math.sqrt(value / lastTotal)))
  return pieces
}