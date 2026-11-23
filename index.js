/**
 * dsh-llm-detector —— 检测 DeepSeek Harness 中注册的模型指纹。
 *
 * 原理：让模型凭第一反应写约 300 个 1–355 的整数，把数值分布、位置分段与
 * 序列形态与参考库比对，给出“最像哪个模型”的闭集排名。算法与参考库来自
 * Ikaleio/lm-detector（MIT）；本插件的差别是：请求经 DSH 的 `ctx.llm` 发出，
 * 因此检测的是本机实际配置的路由、认证与适配层。
 *
 * 提供两个动作：
 * - `list`：列出已注册的 provider/model；
 * - `detect`：对指定（或默认）模型采样并评分。
 */
import { generateChallenges } from './lib/challenge.js'
import { loadData } from './lib/data.js'
import { runRound } from './lib/detect.js'

export const name = 'dsh-llm-detector'
export const inject = ['tools', 'llm']

const MAX_ROUNDS = 3
const MAX_SAMPLES = 3

const notesFor = (defaultSelection, samples) => [
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

const roundSummary = (round) => {
  const analysis = round.analysis
  return {
    index: round.index,
    prediction: analysis.prediction || '',
    prediction_name: analysis.prediction_name || '',
    family_name: analysis.family_prediction_name || '',
    probability: analysis.probability === null || analysis.probability === undefined
      ? ''
      : analysis.probability.toFixed(6),
    decision: analysis.decision ?? 'ranked',
    evidence_label: analysis.evidence?.label ?? '',
    model_like: analysis.sequence?.model_like ?? true,
    sequence: analysis.sequence
      ? {
          autocorrelation: Number(analysis.sequence.autocorrelation.toFixed(4)),
          small_step_share: Number(analysis.sequence.small_step_share.toFixed(4)),
          nearby_pair_share: Number(analysis.sequence.nearby_pair_share.toFixed(4)),
        }
      : { autocorrelation: 0, small_step_share: 0, nearby_pair_share: 0 },
    used_outputs: analysis.used_outputs,
    top: topResults(analysis.results),
    diagnostics: analysis.diagnostics.map(d => ({
      index: d.index + 1,
      parsed_numbers: d.parsed_numbers,
      minimum_numbers: d.minimum_numbers,
      accepted: d.accepted,
    })),
    samples: round.samples.map(sample => ({
      challenge: sample.challenge.id,
      expected_count: sample.expectedCount,
      state: sample.state,
      count: sample.count,
      ...(sample.error ? { error: sample.error } : {}),
      ...(sample.note ? { note: sample.note } : {}),
    })),
    usage: round.samples.reduce((total, sample) => ({
      inputTokens: total.inputTokens + (sample.usage?.inputTokens ?? 0),
      outputTokens: total.outputTokens + (sample.usage?.outputTokens ?? 0),
    }), { inputTokens: 0, outputTokens: 0 }),
  }
}

const summarize = (rounds) => {
  const ranked = rounds.filter(round => round.analysis?.results?.length)
  const counts = new Map()
  for (const round of ranked) {
    const id = round.analysis.prediction
    counts.set(id, (counts.get(id) ?? 0) + 1)
  }
  const top = [...counts.entries()].sort((a, b) => b[1] - a[1])[0]
  const probabilities = ranked
    .map(round => round.analysis.probability)
    .filter(value => typeof value === 'number')
  return {
    rounds: rounds.length,
    valid_rounds: ranked.length,
    top_candidate: top?.[0] ?? '',
    top_candidate_name: ranked.find(round => round.analysis.prediction === top?.[0])?.analysis.prediction_name ?? '',
    top_candidate_rounds: top?.[1] ?? 0,
    mean_probability: probabilities.length
      ? (probabilities.reduce((a, b) => a + b, 0) / probabilities.length).toFixed(6)
      : '',
  }
}

const listProviders = async (llm, onlyProvider) => {
  const providers = llm.listProviders()
  if (onlyProvider) {
    const known = providers.find(provider => provider.id === onlyProvider)
    if (!known) {
      throw new Error(`未注册的 provider：${onlyProvider}。可用：${providers.map(p => p.id).join(', ') || '（无）'}`)
    }
    const models = await llm.listModels(onlyProvider)
    return {
      providers: [known],
      models: models.map(model => ({ provider: onlyProvider, id: model.id, name: model.name })),
    }
  }
  return {
    providers: providers.map(provider => ({ id: provider.id, name: provider.name })),
    models: [],
  }
}

const resolveSelection = (ctx, args) => {
  let provider = args.provider
  let model = args.model
  if (!provider || !model) {
    const selection = ctx.get('agentDefaultModel')?.currentSelection?.()
    provider ||= selection?.provider
    model ||= selection?.model
  }
  if (!provider || !model) {
    throw new Error('未指定 provider/model，且当前 DSH 没有默认模型选择。请先运行 action=list 查看可用的 provider，再显式传入。')
  }
  return { provider, model, usedDefault: !args.provider || !args.model }
}

export function apply(ctx) {
  const tool = {
    name: 'llm_fingerprint',
    description: 'Detect which model a DeepSeek Harness provider route is actually served by, using a number-fingerprint challenge: the model writes about 300 integers from 1 to 355, and its distribution is compared with a closed reference bank. Use action=list to list registered providers and their models. Use action=detect to sample and rank; every detect makes 3 real model calls per round (more tokens than a chat turn) and returns a calibrated ranking, not an identity proof.',
    parameters: {
      type: 'object',
      additionalProperties: false,
      properties: {
        action: {
          type: 'string',
          enum: ['detect', 'list'],
          description: 'detect (default): sample the model and rank candidates. list: list registered providers, or models of the given provider.',
        },
        provider: {
          type: 'string',
          description: 'Provider route, such as deepseek. Omit to use the DSH default model selection.',
        },
        model: {
          type: 'string',
          description: 'Exact model id as the provider knows it. Omit with provider to use the DSH default model selection.',
        },
        rounds: {
          type: 'integer',
          description: `Sequential detection rounds, 1–${MAX_ROUNDS}; default 1. Each round samples 3 replies.`,
        },
        samples_per_round: {
          type: 'integer',
          description: `Replies per round, 1–${MAX_SAMPLES}; default 3. Fewer than 3 replies rank without calibrated confidence.`,
        },
        reasoning_effort: {
          type: 'string',
          description: 'Optional reasoning effort passed to the provider for each sample; omit to use the provider default.',
        },
        include_replies: {
          type: 'boolean',
          description: 'Include truncated raw replies in the result (bounded to the first 200 characters each); default false.',
        },
      },
      required: ['action'],
    },
    output: {
      schema: {
        type: 'object',
        additionalProperties: false,
        properties: {
          action: { type: 'string' },
          provider: { type: 'string' },
          model: { type: 'string' },
          used_default: { type: 'boolean' },
          providers: {
            type: 'array',
            items: {
              type: 'object',
              additionalProperties: false,
              properties: {
                id: { type: 'string' },
                name: { type: 'string' },
              },
            },
          },
          models: {
            type: 'array',
            items: {
              type: 'object',
              additionalProperties: false,
              properties: {
                provider: { type: 'string' },
                id: { type: 'string' },
                name: { type: 'string' },
              },
            },
          },
          reference: {
            type: 'object',
            additionalProperties: false,
            properties: {
              models: { type: 'integer' },
              built_at: { type: 'string' },
              detector_bytes: { type: 'integer' },
              calibration_tau: { type: 'string' },
            },
          },
          rounds: {
            type: 'array',
            items: {
              type: 'object',
              additionalProperties: false,
              properties: {
                index: { type: 'integer' },
                prediction: { type: 'string' },
                prediction_name: { type: 'string' },
                family_name: { type: 'string' },
                probability: { type: 'string' },
                decision: { type: 'string' },
                evidence_label: { type: 'string' },
                model_like: { type: 'boolean' },
                sequence: {
                  type: 'object',
                  additionalProperties: false,
                  properties: {
                    autocorrelation: { type: 'number' },
                    small_step_share: { type: 'number' },
                    nearby_pair_share: { type: 'number' },
                  },
                },
                used_outputs: { type: 'integer' },
                top: {
                  type: 'array',
                  items: {
                    type: 'object',
                    additionalProperties: false,
                    properties: {
                      model: { type: 'string' },
                      display_name: { type: 'string' },
                      family_name: { type: 'string' },
                      score: { type: 'string' },
                      probability: { type: 'string' },
                    },
                  },
                },
                diagnostics: {
                  type: 'array',
                  items: {
                    type: 'object',
                    additionalProperties: false,
                    properties: {
                      index: { type: 'integer' },
                      parsed_numbers: { type: 'integer' },
                      minimum_numbers: { type: 'integer' },
                      accepted: { type: 'boolean' },
                    },
                  },
                },
                samples: {
                  type: 'array',
                  items: {
                    type: 'object',
                    additionalProperties: false,
                    properties: {
                      challenge: { type: 'string' },
                      expected_count: { type: 'integer' },
                      state: { type: 'string' },
                      count: { type: 'integer' },
                      error: { type: 'string' },
                      note: { type: 'string' },
                    },
                  },
                },
                usage: {
                  type: 'object',
                  additionalProperties: false,
                  properties: {
                    inputTokens: { type: 'integer' },
                    outputTokens: { type: 'integer' },
                  },
                },
                replies: { type: 'array', items: { type: 'string' } },
              },
            },
          },
          summary: {
            type: 'object',
            additionalProperties: false,
            properties: {
              rounds: { type: 'integer' },
              valid_rounds: { type: 'integer' },
              top_candidate: { type: 'string' },
              top_candidate_name: { type: 'string' },
              top_candidate_rounds: { type: 'integer' },
              mean_probability: { type: 'string' },
            },
          },
          notes: { type: 'array', items: { type: 'string' } },
        },
      },
      render(_args, value) {
        if (value.action === 'list') {
          const lines = value.providers.map(provider => `- ${provider.id} (${provider.name})`)
          if (value.models.length) {
            lines.push('', `Models of ${value.provider}:`, ...value.models.map(model => `- ${model.id} — ${model.name}`))
          }
          return [{ type: 'text', text: `Registered providers:\n${lines.join('\n')}` }]
        }
        const lines = value.rounds.map(round => {
          const probability = round.probability === ''
            ? '无置信度'
            : `置信度 ${(Number(round.probability) * 100).toFixed(1)}%`
          const head = `第 ${round.index} 轮：${round.prediction_name || round.evidence_label}（${probability}，有效样本 ${round.used_outputs}/3）`
          const top = round.top.length
            ? `  候选：${round.top.map(item => `${item.display_name}${item.probability ? ` ${(Number(item.probability) * 100).toFixed(1)}%` : ''}`).join(' · ')}`
            : ''
          const samples = round.samples.map((sample, index) => {
            const detail = sample.error
              ? `失败：${sample.error}`
              : `${sample.state} ${sample.count}/${sample.expected_count}`
            return `  样本${index + 1}：${detail}`
          })
          return [head, top, ...samples].filter(Boolean).join('\n')
        })
        const summary = value.summary.valid_rounds
          ? `最常见候选：${value.summary.top_candidate_name}（${value.summary.top_candidate_rounds}/${value.summary.rounds} 轮）`
          : '没有可评分的轮次。'
        const notes = value.notes.map(note => `注意：${note}`)
        return [{
          type: 'text',
          text: [`${value.provider}/${value.model} 的数字指纹检测：`, ...lines, summary, ...notes].join('\n'),
        }]
      },
    },
    timeoutMs: 900_000,
    async execute(args, exec) {
      const action = args.action ?? 'detect'
      const llm = ctx.llm
      if (action === 'list') {
        const listed = await listProviders(llm, args.provider)
        return {
          action: 'list',
          provider: args.provider ?? '',
          model: '',
          used_default: false,
          ...listed,
          models: listed.models,
          notes: [],
        }
      }

      const { provider, model, usedDefault } = resolveSelection(ctx, args)
      const available = llm.listProviders()
      if (!available.some(item => item.id === provider)) {
        throw new Error(`未注册的 provider：${provider}。可用：${available.map(p => p.id).join(', ') || '（无）'}`)
      }
      const rounds = Math.max(1, Math.min(MAX_ROUNDS, args.rounds ?? 1))
      const samples = Math.max(1, Math.min(MAX_SAMPLES, args.samples_per_round ?? 3))
      const data = await loadData()
      const collected = []
      const signal = exec.signal
      for (let index = 0; index < rounds; index++) {
        if (signal?.aborted) throw new Error('检测已取消')
        const challenges = generateChallenges(samples)
        const round = await runRound({
          llm,
          provider,
          model,
          challenges,
          signal,
          reasoningEffort: args.reasoning_effort,
          parallel: 1,
          detector: data.detector,
          models: data.models,
        })
        round.index = index + 1
        collected.push(round)
      }

      const roundsOut = collected.map(round => {
        const out = roundSummary(round)
        if (args.include_replies) {
          out.replies = round.samples.map(sample => sample.text.slice(0, 200))
        }
        return out
      })
      return {
        action: 'detect',
        provider,
        model,
        used_default: usedDefault,
        reference: {
          models: data.models.length,
          built_at: data.builtAt,
          detector_bytes: data.detectorBytes,
          calibration_tau: data.detector.calibration?.tau === undefined
            ? ''
            : String(data.detector.calibration.tau),
        },
        rounds: roundsOut,
        summary: summarize(collected),
        notes: notesFor(usedDefault, samples),
      }
    },
  }

  ctx.tools.register(tool)
}