/**
 * dsh-llm-detector —— 检测 DeepSeek Harness 中注册的模型指纹。
 *
 * 原理：让模型凭第一反应写约 300 个 1–355 的整数，把数值分布、位置分段与
 * 序列形态与参考库比对，给出“最像哪个模型”的闭集排名。算法与参考库来自
 * Ikaleio/lm-detector（MIT）；本插件的差别是：请求经 DSH 的 `ctx.llm` 发出，
 * 因此检测的是本机实际配置的路由、认证与适配层。
 *
 * 提供三个动作：
 * - `list`：列出已注册的 provider/model；
 * - `detect`：对指定（或默认）模型采样并评分；
 * - `history`：查询最近的检测历史记录。
 */
import { createHistoryStore } from './lib/history.js'
import { createRunner, MAX_ROUNDS, MAX_SAMPLES } from './lib/runner.js'
import { registerRoutes } from './lib/routes.js'
import { applyProxyMode, disposeProxy, loadSaved } from './lib/proxy.js'

export const name = 'dsh-llm-detector'
export const inject = ['tools', 'llm']

export function apply(ctx) {
  const history = createHistoryStore()
  const runner = createRunner(ctx, { history })
  ctx.provide('llmDetector', runner)
  ctx.effect(() => () => runner.dispose(), 'dsh-llm-detector: runner')

  // 恢复上次选择的出站代理；卸载插件时还原进程原始 fetch。
  ctx.effect(() => {
    loadSaved()
      .then(saved => applyProxyMode(saved.mode, saved.url))
      .catch(() => {})
    return () => disposeProxy()
  }, 'dsh-llm-detector: proxy')
  const tool = {
    name: 'llm_fingerprint',
    description: 'Detect which model a DeepSeek Harness provider route is actually served by, using a number-fingerprint challenge: the model writes about 300 integers from 1 to 355, and its distribution is compared with a closed reference bank. Use action=list to list registered providers and their models. Use action=history to read recent persisted detection results. Use action=detect to sample and rank; every detect makes 3 real model calls per round (more tokens than a chat turn) and returns a calibrated ranking, not an identity proof.',
    parameters: {
      type: 'object',
      additionalProperties: false,
      properties: {
        action: {
          type: 'string',
          enum: ['detect', 'list', 'history'],
          description: 'detect (default): sample the model and rank candidates. list: list registered providers, or models of the given provider. history: list recent detection history entries.',
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
          description: 'Include prompts and raw replies in the structured result (each reply is bounded); default false. The sidebar panel shows them by default.',
        },
        limit: {
          type: 'integer',
          description: 'Maximum number of history entries to return when action=history (1–50, default 10).',
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
                evidence_reason: { type: 'string' },
                confidence_status: { type: 'string' },
                abnormal_samples: { type: 'integer' },
                sample_total: { type: 'integer' },
                complete_samples: { type: 'integer' },
                started_at: { type: 'integer' },
                finished_at: { type: 'integer' },
                model_like: { type: 'string' },
                sequence: { type: 'string' },
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
                      id: { type: 'string' },
                      index: { type: 'integer' },
                      round: { type: 'integer' },
                      expected_count: { type: 'integer' },
                      state: { type: 'string' },
                      count: { type: 'integer' },
                      completion: { type: 'string' },
                      error: { type: 'string' },
                      note: { type: 'string' },
                      started_at: { type: 'integer' },
                      finished_at: { type: 'integer' },
                      prompt: { type: 'string' },
                      text: { type: 'string' },
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
              tied: { type: 'boolean' },
              probability_rounds: { type: 'integer' },
              uncalibrated_rounds: { type: 'integer' },
            },
          },
          notes: { type: 'array', items: { type: 'string' } },
          history: {
            type: 'array',
            items: {
              type: 'object',
              additionalProperties: false,
              properties: {
                id: { type: 'string' },
                source: { type: 'string' },
                status: { type: 'string' },
                provider: { type: 'string' },
                model: { type: 'string' },
                used_default: { type: 'boolean' },
                created_at: { type: 'integer' },
                started_at: { type: 'integer' },
                finished_at: { type: 'integer' },
                error: { type: 'string' },
                reasoning_effort: { type: 'string' },
                rounds: { type: 'integer' },
                valid_rounds: { type: 'integer' },
                top_candidate: { type: 'string' },
                top_candidate_name: { type: 'string' },
                top_candidate_rounds: { type: 'integer' },
                mean_probability: { type: 'string' },
                tied: { type: 'boolean' },
              },
            },
          },
          history_total: { type: 'integer' },
          job_id: { type: 'string' },
          status: { type: 'string' },
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
        if (value.action === 'history') {
          const items = value.history ?? []
          if (!items.length) {
            return [{ type: 'text', text: '暂无模型指纹检测历史记录。' }]
          }
          const lines = items.map((item, idx) => {
            const ts = item.finished_at || item.created_at
            const timeText = ts ? new Date(ts).toLocaleString() : ''
            const prob = item.mean_probability ? ` ${(Number(item.mean_probability) * 100).toFixed(1)}%` : ''
            const result = item.top_candidate_name
              ? `${item.top_candidate_name}${prob} (${item.valid_rounds}/${item.rounds} 轮)`
              : (item.error || item.status)
            const src = item.source === 'tool' ? '对话' : '面板'
            return `${idx + 1}. [${timeText}] ${item.provider}/${item.model} → ${result}（${src}）`
          })
          return [{ type: 'text', text: `最近 ${items.length} 条检测历史（共 ${value.history_total ?? items.length} 条）：\n${lines.join('\n')}` }]
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
      const runner = ctx.llmDetector
      const action = args.action ?? 'detect'
      if (action === 'list') {
        const listed = await runner.listProviders(args.provider)
        return {
          action: 'list',
          provider: args.provider ?? '',
          model: '',
          used_default: false,
          ...listed,
          models: listed.models,
          notes: [],
          job_id: '',
          status: 'complete',
        }
      }
      if (action === 'history') {
        const limit = Math.max(1, Math.min(50, Math.floor(Number(args.limit) || 10)))
        const listed = await runner.listHistory({ provider: args.provider ?? '', limit })
        return {
          action: 'history',
          provider: args.provider ?? '',
          model: '',
          used_default: false,
          history: listed.items.map(item => ({
            ...item,
            started_at: item.started_at ?? 0,
            finished_at: item.finished_at ?? 0,
          })),
          history_total: listed.total,
          notes: [],
          job_id: '',
          status: 'complete',
        }
      }
      return runner.execute({ ...args, source: 'tool', include_replies: args.include_replies ?? false, signal: exec.signal })
    },
  }

  ctx.tools.register(tool)

  // 左侧边页面通过 DSH 的 connection.fetch 认证路由调用同一个 runner；
  // 没有 connection 的 profile（例如纯 headless）仍可使用模型工具。
  if (typeof ctx.inject === 'function') {
    ctx.inject(['connection'], (connCtx) => {
      if (typeof connCtx.connection?.fetch?.register === 'function') {
        registerRoutes(connCtx, runner)
      }
    })
  }
}
