/**
 * 出站代理：直连 / 系统代理 / 手动代理。
 *
 * DSH 的模型请求经各 provider 适配器用 Node 的全局 `fetch` 发出，插件拿不到
 * 单次请求的 socket 选项。因此这里在 Host 进程内替换 `globalThis.fetch`：
 * 启用代理时把它转交给 profile 里 undici 的 `fetch`，并附上 `ProxyAgent`；
 * 切回直连时恢复原始 `fetch`。无论哪种模式，调用方看到的都是同一个 fetch。
 */
import { execFile } from 'node:child_process'
import { existsSync, readFileSync, readdirSync } from 'node:fs'
import { mkdir, readFile, writeFile } from 'node:fs/promises'
import { dirname, join } from 'node:path'
import { pathToFileURL } from 'node:url'
import { promisify } from 'node:util'

const run = promisify(execFile)

const CONFIG_DIR = join(process.env.DSH_HOME || process.env.DSH_PROFILE_DIR || process.cwd(), 'llm-detector')
const CONFIG_FILE = join(CONFIG_DIR, 'proxy.json')

/** @type {{mode:'direct'|'system'|'manual', url:string, active:string, error:string}} */
const state = { mode: 'direct', url: '', active: '', error: '' }

let originalFetch = globalThis.fetch
let undiciModule
let applied = false

const normalize = (value) => {
  const text = String(value ?? '').trim()
  if (!text) return ''
  const withScheme = /^[a-z][a-z0-9+.-]*:\/\//i.test(text) ? text : `http://${text}`
  let url
  try { url = new URL(withScheme) } catch { throw new Error('代理地址格式不正确，示例：http://127.0.0.1:7897') }
  if (!['http:', 'https:', 'socks:', 'socks5:'].includes(url.protocol)) {
    throw new Error('代理地址只支持 http、https、socks5')
  }
  if (!url.hostname || !url.port) throw new Error('代理地址需要包含主机与端口，示例：http://127.0.0.1:7897')
  return url.href.replace(/\/$/, '')
}

/**
 * 找一个与 Node 内置 fetch 同主版本的 undici。
 *
 * 内置 fetch 接受 `dispatcher`，但只认同版本的 dispatcher 接口；跨主版本会报
 * `invalid onRequestStart method`。因此优先选主版本与 `process.versions.undici`
 * 一致的副本，找不到时再退化到任意可用的副本（此时警告可能不兼容）。
 */
async function loadUndici() {
  if (undiciModule) return undiciModule
  const nativeMajor = String(process.versions.undici || '').split('.')[0]
  // Host 进程的 cwd 就是当前 profile 目录（argv 里通常也带），从这里找 node_modules。
  const bases = [
    process.env.DSH_PROFILE_DIR,
    process.cwd(),
    ...process.argv.filter(a => typeof a === 'string' && a.includes('.dsh')),
    process.env.USERPROFILE && join(process.env.USERPROFILE, '.dsh', 'profiles', process.env.DSH_PROFILE || 'desktop'),
    process.env.HOME && join(process.env.HOME, '.dsh', 'profiles', process.env.DSH_PROFILE || 'desktop'),
  ].filter(Boolean)
  const dirs = []
  for (const base of bases) {
    const modules = join(base, 'node_modules')
    dirs.push(join(modules, 'undici'))
    try {
      for (const entry of readdirSync(modules, { withFileTypes: true })) {
        if (!entry.isDirectory() || entry.name.startsWith('.')) continue
        dirs.push(join(modules, entry.name, 'node_modules', 'undici'))
      }
    } catch { /* 目录不可读 */ }
  }
  const found = []
  for (const dir of new Set(dirs)) {
    const manifest = join(dir, 'package.json')
    const entry = join(dir, 'index.js')
    if (!existsSync(manifest) || !existsSync(entry)) continue
    try {
      const { version } = JSON.parse(readFileSync(manifest, 'utf8'))
      found.push({ entry, version, major: String(version).split('.')[0] })
    } catch { /* 跳过损坏的副本 */ }
  }
  found.sort((a, b) => Number(b.major === nativeMajor) - Number(a.major === nativeMajor))
  for (const candidate of found) {
    try {
      const mod = await import(pathToFileURL(candidate.entry).href)
      if (typeof mod.ProxyAgent !== 'function') continue
      undiciModule = mod
      return mod
    } catch { /* 试下一个 */ }
  }
  throw new Error(`无法在当前 profile 中加载 undici（需要与 Node ${nativeMajor}.x 同主版本）`)
}

/** Windows 注册表 / macOS scutil / 环境变量里的系统代理。 */
export async function systemProxy() {
  if (process.platform === 'win32') {
    try {
      const { stdout } = await run('reg', ['query', 'HKCU\\Software\\Microsoft\\Windows\\CurrentVersion\\Internet Settings'], { windowsHide: true })
      const enabled = /ProxyEnable\s+REG_DWORD\s+0x1/i.test(stdout)
      const server = /ProxyServer\s+REG_SZ\s+(.+)/i.exec(stdout)?.[1]?.trim() ?? ''
      if (!enabled || !server) return ''
      const map = new Map(server.split(';').filter(Boolean).map(part => {
        const [key, value] = part.includes('=') ? part.split('=') : ['http', part]
        return [key.trim().toLowerCase(), value.trim()]
      }))
      const address = map.get('https') || map.get('http') || server
      return normalize(address)
    } catch { return '' }
  }
  if (process.platform === 'darwin') {
    try {
      const { stdout } = await run('scutil', ['--proxy'])
      const host = /HTTPSProxy\s*:\s*(\S+)/.exec(stdout)?.[1]
      const port = /HTTPSPort\s*:\s*(\d+)/.exec(stdout)?.[1]
      return host && port ? normalize(`${host}:${port}`) : ''
    } catch { return '' }
  }
  const env = process.env.HTTPS_PROXY || process.env.https_proxy || process.env.HTTP_PROXY || process.env.http_proxy
  return env ? normalize(env) : ''
}

function restore() {
  if (applied) globalThis.fetch = originalFetch
  applied = false
}

async function applyProxy(url) {
  const undici = await loadUndici()
  const agent = new undici.ProxyAgent(url)
  // 仍用进程原始 fetch（内置 Response/Request 语义不变），只附加 dispatcher。
  globalThis.fetch = (input, init) => originalFetch(input, { ...init, dispatcher: agent })
  applied = true
}

/** 应用一个模式；返回状态对象（含失败原因，不抛错）。 */
export async function applyProxyMode(mode, rawUrl = '') {
  state.mode = ['direct', 'system', 'manual'].includes(mode) ? mode : 'direct'
  state.url = String(rawUrl ?? '').trim()
  state.error = ''
  state.active = ''
  try {
    restore()
    if (state.mode === 'direct') {
      // 直连：使用进程原始 fetch。
    } else if (state.mode === 'system') {
      const url = await systemProxy()
      if (!url) throw new Error('没有检测到系统代理；请改用手动代理，或在系统设置里启用代理')
      state.active = url
      await applyProxy(url)
    } else {
      const url = normalize(state.url)
      state.active = url
      await applyProxy(url)
    }
  } catch (error) {
    state.mode = 'direct'
    state.active = ''
    state.error = error instanceof Error ? error.message : String(error)
    restore()
  }
  return status()
}

export function status() {
  return {
    mode: state.mode,
    url: state.url,
    active: state.active,
    error: state.error,
    applied: applied,
    system: '',
  }
}

/** 当前系统代理（仅用于展示，不改变状态）。 */
export async function systemStatus() {
  try { return await systemProxy() } catch { return '' }
}

/** 用当前生效的 fetch 做一次连通性测试。 */
export async function testProxy(url = 'https://registry.npmjs.org/-/ping') {
  const target = String(url || '').trim() || 'https://registry.npmjs.org/-/ping'
  let parsed
  try { parsed = new URL(target) } catch { throw new Error('测试地址不是有效 URL') }
  if (!['http:', 'https:'].includes(parsed.protocol)) throw new Error('测试地址只支持 http/https')
  const started = Date.now()
  try {
    const response = await globalThis.fetch(parsed.href, {
      method: 'GET',
      signal: AbortSignal.timeout(15_000),
      headers: { 'user-agent': 'dsh-llm-detector-proxy-test' },
    })
    return { ok: true, status: response.status, ms: Date.now() - started, url: parsed.href }
  } catch (error) {
    return { ok: false, status: 0, ms: Date.now() - started, url: parsed.href, error: error instanceof Error ? error.message : String(error) }
  }
}

export async function loadSaved() {
  try {
    const saved = JSON.parse(await readFile(CONFIG_FILE, 'utf8'))
    if (saved && ['direct', 'system', 'manual'].includes(saved.mode)) {
      return { mode: saved.mode, url: String(saved.url ?? '') }
    }
  } catch { /* 没有保存过 */ }
  return { mode: 'direct', url: '' }
}

export async function save() {
  try {
    await mkdir(dirname(CONFIG_FILE), { recursive: true })
    await writeFile(CONFIG_FILE, JSON.stringify({ mode: state.mode, url: state.url, updated_at: new Date().toISOString() }, null, 2))
  } catch { /* 保存失败不影响本次代理 */ }
}

/** 进程退出或插件卸载时恢复直连，避免影响后续请求。 */
export function disposeProxy() {
  restore()
  state.mode = 'direct'
  state.active = ''
}