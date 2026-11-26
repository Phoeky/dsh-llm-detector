/**
 * 检测历史持久化存储。
 *
 * - 将每次结束（完成/取消/失败）的检测快照保存在本机 JSON 文件中，跨重启保留。
 * - 同时支持纯内存模式（`persist: false` 或 `filePath: null`），供离线测试隔离使用。
 * - 全部写操作通过内部串行队列排队，采用临时文件 + rename 原子落盘，避免并发写损坏。
 */
import { mkdir, readFile, rename, unlink, writeFile } from 'node:fs/promises'
import { dirname, join } from 'node:path'

export const MAX_HISTORY_ENTRIES = 100
const SCHEMA_VERSION = 1

export function defaultHistoryPath() {
  if (process.env.DSH_LLM_DETECTOR_HISTORY_FILE) {
    return process.env.DSH_LLM_DETECTOR_HISTORY_FILE
  }
  const base = process.env.DSH_HOME || process.env.DSH_PROFILE_DIR || process.cwd()
  return join(base, 'llm-detector', 'history.json')
}

/** 从完整作业快照中提取用于列表展示的轻量摘要。 */
export function summarizeEntry(entry) {
  const summary = entry?.summary ?? {}
  const options = entry?.options ?? {}
  return {
    id: String(entry?.id ?? ''),
    source: entry?.source === 'tool' ? 'tool' : 'panel',
    status: String(entry?.status ?? 'complete'),
    provider: String(entry?.provider ?? ''),
    model: String(entry?.model ?? ''),
    used_default: Boolean(entry?.used_default),
    created_at: Number(entry?.created_at ?? 0) || 0,
    started_at: entry?.started_at ? Number(entry.started_at) : null,
    finished_at: entry?.finished_at ? Number(entry.finished_at) : null,
    error: String(entry?.error ?? ''),
    reasoning_effort: String(options.reasoningEffort ?? options.reasoning_effort ?? ''),
    rounds: Number(summary.rounds ?? options.rounds ?? entry?.rounds?.length ?? 0) || 0,
    valid_rounds: Number(summary.valid_rounds ?? 0) || 0,
    top_candidate: String(summary.top_candidate ?? ''),
    top_candidate_name: String(summary.top_candidate_name ?? ''),
    top_candidate_rounds: Number(summary.top_candidate_rounds ?? 0) || 0,
    mean_probability: String(summary.mean_probability ?? ''),
    tied: Boolean(summary.tied),
  }
}

const sortTimestamp = (entry) => Number(entry?.finished_at || entry?.created_at || 0) || 0

const clone = (value) => JSON.parse(JSON.stringify(value))

function isValidEntry(entry) {
  return Boolean(entry && typeof entry === 'object' && typeof entry.id === 'string' && entry.id.trim())
}

/**
 * 创建历史记录存储。
 *
 * @param {{ filePath?: string | null, persist?: boolean, maxEntries?: number }} [options]
 */
export function createHistoryStore(options = {}) {
  const persist = options.persist !== false && options.filePath !== null
  const filePath = persist ? (options.filePath || defaultHistoryPath()) : null
  const maxEntries = Math.max(1, Math.floor(Number(options.maxEntries) || MAX_HISTORY_ENTRIES))

  /** @type {any[] | null} */
  let entries = null
  /** 串行化磁盘读写，避免并发写入覆盖。 */
  let chain = Promise.resolve()

  const serialize = (task) => {
    const next = chain.then(task, task)
    chain = next.then(() => undefined, () => undefined)
    return next
  }

  async function ensureLoaded() {
    if (entries !== null) return entries
    if (!persist || !filePath) {
      entries = []
      return entries
    }
    try {
      const raw = await readFile(filePath, 'utf8')
      const parsed = JSON.parse(raw)
      const list = Array.isArray(parsed)
        ? parsed
        : (parsed && typeof parsed === 'object' && Array.isArray(parsed.entries) ? parsed.entries : [])
      entries = list
        .filter(isValidEntry)
        .sort((a, b) => sortTimestamp(b) - sortTimestamp(a))
        .slice(0, maxEntries)
    } catch {
      // 文件尚不存在或已损坏时降级为空历史，不阻塞插件运行。
      entries = []
    }
    return entries
  }

  async function flush() {
    if (!persist || !filePath) return
    const payload = JSON.stringify({ version: SCHEMA_VERSION, entries: entries ?? [] }, null, 2)
    await mkdir(dirname(filePath), { recursive: true })
    const tmpPath = `${filePath}.${process.pid}.${Date.now()}.${Math.random().toString(16).slice(2, 8)}.tmp`
    try {
      await writeFile(tmpPath, payload, 'utf8')
      await rename(tmpPath, filePath)
    } catch {
      // 某些文件系统（如 Windows 杀毒短暂占用）rename 可能失败，回退直接覆盖并清理临时文件。
      await unlink(tmpPath).catch(() => {})
      await writeFile(filePath, payload, 'utf8')
    }
  }

  return {
    filePath,
    persist,
    maxEntries,

    async save(snapshot) {
      if (!isValidEntry(snapshot)) return null
      return serialize(async () => {
        const list = await ensureLoaded()
        const saved = clone(snapshot)
        saved.source = saved.source === 'tool' ? 'tool' : 'panel'
        const idx = list.findIndex(item => item.id === saved.id)
        if (idx >= 0) list[idx] = saved
        else list.unshift(saved)
        list.sort((a, b) => sortTimestamp(b) - sortTimestamp(a))
        if (list.length > maxEntries) list.length = maxEntries
        await flush()
        return summarizeEntry(saved)
      })
    },

    async list(filter = {}) {
      return serialize(async () => {
        const list = await ensureLoaded()
        const provider = String(filter.provider ?? '').trim().toLowerCase()
        const query = String(filter.query ?? filter.q ?? '').trim().toLowerCase()
        const limitRaw = Number(filter.limit)
        const limit = Number.isFinite(limitRaw) && limitRaw > 0
          ? Math.min(maxEntries, Math.floor(limitRaw))
          : maxEntries

        let matched = list.map(summarizeEntry)
        if (provider) {
          matched = matched.filter(item => item.provider.toLowerCase() === provider)
        }
        if (query) {
          matched = matched.filter(item => {
            const haystack = [
              item.provider,
              item.model,
              item.top_candidate_name,
              item.top_candidate,
              item.status,
              item.source,
            ].join(' ').toLowerCase()
            return haystack.includes(query)
          })
        }
        return {
          items: matched.slice(0, limit),
          total: matched.length,
          allTotal: list.length,
        }
      })
    },

    async get(id) {
      const target = String(id ?? '').trim()
      if (!target) return null
      return serialize(async () => {
        const list = await ensureLoaded()
        const found = list.find(item => item.id === target)
        return found ? clone(found) : null
      })
    },

    async remove(id) {
      const target = String(id ?? '').trim()
      if (!target) return false
      return serialize(async () => {
        const list = await ensureLoaded()
        const idx = list.findIndex(item => item.id === target)
        if (idx < 0) return false
        list.splice(idx, 1)
        await flush()
        return true
      })
    },

    async clear() {
      return serialize(async () => {
        const list = await ensureLoaded()
        const cleared = list.length
        if (cleared > 0) {
          list.length = 0
          await flush()
        }
        return { cleared }
      })
    },

    async count() {
      return serialize(async () => (await ensureLoaded()).length)
    },
  }
}
