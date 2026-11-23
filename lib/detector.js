/**
 * 冻结检测器上的排名、置信度与结果判定。
 *
 * 移植自 Ikaleio/lm-detector 的 `shared/shared-detector.ts`（MIT，见 NOTICE）。
 * 与参考实现相比只去掉了对完整 `unified_bank.json` 的依赖：模型展示信息改为
 * 由 `data/models.json` 提供，编排逻辑保持一致。
 */
import { countNumbers, hellingerFeature, orderedBlockFeature, parseNumbers } from './fingerprint.js'
import { positionalDecision } from './positional.js'

const dot = (a, b) => a.reduce((sum, x, i) => sum + x * b[i], 0)
const mean = (a) => a.reduce((sum, x) => sum + x, 0) / a.length
const norm = (a) => {
  const n = Math.max(Math.sqrt(dot(a, a)), 1e-12)
  return a.map(x => x / n)
}
const z = (a) => {
  const m = mean(a)
  const s = Math.max(Math.sqrt(mean(a.map(x => (x - m) ** 2))), 1e-12)
  return a.map(x => (x - m) / s)
}
const columnMean = (a) => a[0].map((_, i) => mean(a.map(r => r[i])))
const median = (a) => {
  const v = [...a].sort((x, y) => x - y)
  const i = Math.floor(v.length / 2)
  return v.length % 2 ? v[i] : (v[i - 1] + v[i]) / 2
}
const blocks = (n) => [hellingerFeature(countNumbers(n)), orderedBlockFeature(n)]
const transform = (b, p) => b.flatMap((v, j) =>
  norm(v.map((x, i) => (x - p[j].mean[i]) / p[j].scale[i])).map(x => x * Math.sqrt(j === 0 ? 0.75 : 0.25)))
const centered = (v, p) => v.map((x, i) => (x - p.feature_mean[i]) / p.feature_scale[i])
const subtract = (v, b) => {
  const coefficients = b.map(row => dot(v, row))
  return v.map((x, i) => x - b.reduce((sum, row, j) => sum + coefficients[j] * row[i], 0))
}

const referenceNorms = new WeakMap()
function nearest(x, references) {
  let norms = referenceNorms.get(references)
  if (!norms) {
    norms = references.map(r => dot(r, r))
    referenceNorms.set(references, norms)
  }
  const xx = dot(x, x)
  return mean(references
    .map((r, i) => Math.max(0, xx + norms[i] - 2 * dot(x, r)))
    .sort((a, b) => a - b)
    .slice(0, 7))
}

function baseline(b, bank) {
  const h = bank.hellinger
  const o = bank.ordered_blocks
  const hUnit = norm(subtract(centered(b[0], h), h.nuisance_basis))
  const marginal = h.centroids.map(row => dot(hUnit, row))
  const oCentered = centered(b[1], o)
  const raw = norm(oCentered)
  const projected = norm(subtract(oCentered, o.nuisance_basis))
  const templates = o.centroids.map((_, i) => Math.max(...o.environment_centroids.map(rows => dot(raw, rows[i]))))
  const nuisance = o.centroids.map(row => dot(projected, row))
  const tz = z(templates)
  const nz = z(nuisance)
  const ordered = z(tz.map((v, i) => 0.5 * v + 0.5 * nz[i]))
  const mz = z(marginal)
  return mz.map((v, i) => 0.5 * v + 0.5 * ordered[i])
}

/** 参考库与检测器是否互相匹配（用模型清单的 ID 与样本数做绑定）。 */
export function supportsDetector(models, artifact) {
  return artifact.schema === 'shared-detector-v2'
    && models.length === artifact.model_ids.length
    && models.every((m, i) => m.id === artifact.model_ids[i] && m.response_count === artifact.response_counts[i])
}

/**
 * 置信度：参考库内的温度 softmax。校准与检测器绑定不匹配时返回 null。
 * @param {number[]} ranking @param {any} artifact @returns {number[]|null}
 */
export function calibrateRanking(ranking, artifact) {
  const head = artifact.calibration
  const binding = head?.binding
  if (!head || !binding || head.schema !== 'shared-confidence-v2' || head.method !== 'ranking-temperature'
    || !Number.isFinite(head.tau) || head.tau < 0.001 || head.tau > 1000
    || binding.base_sha256 !== artifact.base_sha256
    || binding.reference_sha256 !== artifact.source_reference_sha256
    || binding.model_ids.length !== ranking.length || ranking.length !== artifact.model_ids.length
    || !ranking.every(Number.isFinite)
    || !binding.model_ids.every((id, i) => id === artifact.model_ids[i])) return null
  const logits = ranking.map(score => head.tau * score)
  const maximum = Math.max(...logits)
  const weights = logits.map(value => Math.exp(value - maximum))
  const sum = weights.reduce((a, b) => a + b, 0)
  return weights.map(value => value / sum)
}

/**
 * 排名分数：`s = 0.5·z(f) + 0.5·z(q)`。
 * f = 0.5·LDA(前 128 个数) + 0.25·kNN7 + 0.25·去干扰中心；q 为位置/顺序判别头。
 * @param {number[][]} numbers @param {any} artifact @returns {number[]}
 */
export function rankSharedNumbers(numbers, artifact) {
  const a = artifact.ranker
  const full = numbers.map(blocks)
  const ax = full.map(b => transform(b, a.full_params))
  const lda = numbers.map(n => {
    const x = transform(blocks(n.slice(0, 128)), a.head_params)
    return z(a.lda_weights.map((row, i) => dot(row, x) + a.lda_bias[i]))
  })
  const l = z(columnMean(lda))
  const near = z(a.references.map(ref => median(ax.map(x => -nearest(x, ref)))))
  const base = z(columnMean(full.map(b => baseline(b, a.bank))))
  const frequency = z(l.map((x, i) => 0.5 * x + 0.25 * near[i] + 0.25 * base[i]))
  const positional = z(columnMean(numbers.map(n => z(positionalDecision(n, a.positional)))))
  const ranking = frequency.map((x, i) => a.blend.frequency * x + a.blend.positional * positional[i])
  if (!ranking.every(Number.isFinite)) throw new Error('排名计算产生无效数值')
  return ranking
}

// 相邻数字的界限取自参考库按环境分组的三条回答组上的 99.5% 分位。
const SEQUENCE_LIMITS = { autocorrelation: -0.23, small_step_share: 0.05, nearby_pair_share: 0.07 }

function nearbyPairShare(numbers) {
  let close = 0
  let pairs = 0
  for (let lag = 1; lag <= 3; lag++) {
    for (let i = lag; i < numbers.length; i++) {
      if (Math.abs(numbers[i] - numbers[i - lag]) <= 20) close++
      pairs++
    }
  }
  return close / pairs
}

function sequenceShape(numbers) {
  const shapes = numbers.map(n => {
    const m = mean(n)
    const variance = mean(n.map(x => (x - m) ** 2))
    const steps = n.slice(1).map((x, i) => x - n[i])
    return {
      autocorrelation: variance ? mean(steps.map((_, i) => (n[i + 1] - m) * (n[i] - m))) / variance : 1,
      small_step_share: mean(steps.map(d => (Math.abs(d) <= 20 ? 1 : 0))),
    }
  })
  const autocorrelation = median(shapes.map(s => s.autocorrelation))
  const smallStepShare = median(shapes.map(s => s.small_step_share))
  return {
    autocorrelation,
    small_step_share: smallStepShare,
    nearby_pair_share: median(numbers.map(nearbyPairShare)),
    model_like: autocorrelation <= SEQUENCE_LIMITS.autocorrelation
      || smallStepShare <= SEQUENCE_LIMITS.small_step_share
      || median(numbers.map(nearbyPairShare)) <= SEQUENCE_LIMITS.nearby_pair_share,
  }
}

const byId = (models) => new Map(models.map(m => [m.id, m]))

/**
 * 对一到三条回答评分。
 *
 * @param {{text:string, expected_count:number}[]} outputs
 * @param {any} artifact 冻结检测器
 * @param {any[]} models `data/models.json` 的模型清单
 * @param {{allowPartial?:boolean}} [options]
 * @returns {any}
 */
export function analyze(outputs, artifact, models, options = {}) {
  if (!supportsDetector(models, artifact)) {
    throw new Error('参考库与检测器不匹配；请更新插件数据后重试')
  }
  const parsed = outputs.map(o => parseNumbers(o.text))
  const diagnostics = outputs.map((o, index) => {
    const minimum = Math.max(80, Math.ceil((o.expected_count || 0) * 0.55))
    const raw = Array.from(o.text.matchAll(/-?\d+/g), m => Number(m[0]))
    return {
      index,
      parsed_numbers: parsed[index].length,
      minimum_numbers: minimum,
      accepted: parsed[index].length >= minimum,
      raw_out_of_range_count: raw.filter(n => n < 1 || n > 355).length,
    }
  })
  const used = diagnostics.filter(d => d.accepted).length
  const accepted = parsed.filter((_, i) => diagnostics[i].accepted)
  const sequence = used ? sequenceShape(accepted) : null
  const names = byId(models)
  const common = {
    probability: null,
    probability_status: 'unavailable',
    used_outputs: used,
    diagnostics,
    sequence,
    method: 'shared-detector-v2',
    model_version: { base_sha256: artifact.base_sha256 },
  }
  const notModel = {
    ...common,
    prediction: '',
    prediction_name: '不像语言模型回答',
    family_prediction_name: '',
    results: [],
    decision: 'not_model',
    evidence: {
      insufficient: true,
      label: '不像语言模型回答',
      reason: '相邻数字的变化方式与参考库中的语言模型回答不同，常见于程序生成、排序或打乱顺序的数字。未生成排名。',
      threshold: null,
      method: 'sequence-shape',
    },
  }
  if (options.allowPartial && used > 0 && used < 3 && outputs.length <= 3) {
    if (!sequence.model_like) return notModel
    const ranking = rankSharedNumbers(accepted, artifact)
    const order = artifact.model_ids.map((_, i) => i).sort((i, j) => ranking[j] - ranking[i])
    const results = order.map(i => ({
      model: artifact.model_ids[i],
      display_name: names.get(artifact.model_ids[i])?.display_name ?? artifact.model_ids[i],
      family: names.get(artifact.model_ids[i])?.family ?? 'other',
      family_name: names.get(artifact.model_ids[i])?.family_name ?? '其他',
      score: ranking[i],
      probability: null,
    }))
    const first = order[0]
    return {
      ...common,
      method: 'shared-ranker-partial-v1',
      decision: 'partial',
      prediction: results[0].model,
      prediction_name: results[0].display_name,
      family_prediction: names.get(artifact.model_ids[first])?.family,
      family_prediction_name: names.get(artifact.model_ids[first])?.family_name ?? '',
      results,
      ranking_score: ranking[first],
      calibration: null,
      evidence: {
        insufficient: true,
        label: '部分样本排名',
        reason: `使用 ${used}/3 条有效回答生成排名。补齐三条有效回答后才能计算置信度。`,
        threshold: null,
        method: 'partial-sample-ranking',
      },
    }
  }
  if (outputs.length !== 3 || used !== 3) {
    return {
      ...common,
      prediction: '',
      prediction_name: '暂不可评分',
      family_prediction_name: '',
      results: [],
      decision: 'unscorable',
      evidence: {
        insufficient: true,
        label: '需要三条完整回答',
        reason: `当前有 ${used}/${outputs.length} 条有效回答。请补齐原来的三条回答后重新检测。`,
        threshold: null,
        method: 'complete-three-answers',
      },
    }
  }
  if (!sequence.model_like) return notModel
  const ranking = rankSharedNumbers(parsed, artifact)
  const probabilities = calibrateRanking(ranking, artifact)
  const order = artifact.model_ids.map((_, i) => i).sort((i, j) => ranking[j] - ranking[i])
  const results = order.map(i => ({
    model: artifact.model_ids[i],
    display_name: names.get(artifact.model_ids[i])?.display_name ?? artifact.model_ids[i],
    family: names.get(artifact.model_ids[i])?.family ?? 'other',
    family_name: names.get(artifact.model_ids[i])?.family_name ?? '其他',
    score: ranking[i],
    probability: probabilities?.[i] ?? null,
  }))
  const first = order[0]
  return {
    ...common,
    prediction: results[0].model,
    prediction_name: results[0].display_name,
    family_prediction: names.get(artifact.model_ids[first])?.family,
    family_prediction_name: names.get(artifact.model_ids[first])?.family_name ?? '',
    results,
    ranking_score: ranking[first],
    probability: results[0].probability,
    probability_status: probabilities ? 'reference_calibrated' : 'unavailable',
    probability_scope: probabilities ? 'reference-closed-set' : null,
    calibration: probabilities
      ? {
          method: artifact.calibration.method,
          run: artifact.calibration.calibration_run,
          tau: artifact.calibration.tau,
          sha256: artifact.calibration_sha256 ?? null,
        }
      : null,
    evidence: {
      insufficient: true,
      label: probabilities ? '库内校准排名' : '未校准排名',
      reason: probabilities
        ? '置信度是参考库内的闭集相对概率，不包含库外模型。'
        : '校准参数与当前检测器不匹配，置信度不可用。候选顺序由排名分数决定。',
      threshold: null,
      method: probabilities ? 'reference-calibrated-ranking' : 'uncalibrated-ranking',
    },
  }
}