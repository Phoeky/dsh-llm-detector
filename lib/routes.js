/**
 * 经 DSH `connection.fetch` 注册的认证 HTTP 路由，供左侧边的检测页面使用。
 *
 * 鉴权：全部路由通过 `ctx.connection.fetch.register` 挂载在 DSH 的 `/api` 认证通道下，
 * 自动受 Host / Origin / Sec-Fetch-Site 与浏览器会话 Cookie 校验保护；
 * 同时每次启动生成随机令牌，通过 `/bootstrap` 下发给页面，写操作必须回传。
 * 模型地址与密钥不会出现在任何响应里。
 */
import { randomBytes, timingSafeEqual } from 'node:crypto'
import { applyProxyMode, save, status as proxyStatus, systemStatus, testProxy } from './proxy.js'

const BASE = '/api/llm-detector'
const ADMIN_HEADER = 'x-llm-detector-token'
const MAX_BODY_BYTES = 64_000

const json = (status, value) => new Response(JSON.stringify(value), {
  status,
  headers: {
    'Content-Type': 'application/json; charset=utf-8',
    'Cache-Control': 'no-store',
  },
})

const readBody = async (request) => {
  const declared = request.headers.get('content-length')
  if (declared !== null && Number(declared) > MAX_BODY_BYTES) {
    throw new Error('请求体过大')
  }
  const text = await request.text()
  if (Buffer.byteLength(text, 'utf8') > MAX_BODY_BYTES) {
    throw new Error('请求体过大')
  }
  if (!text.trim()) return {}
  let parsed
  try {
    parsed = JSON.parse(text)
  } catch {
    throw new Error('请求体不是有效 JSON')
  }
  if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
    throw new Error('请求体必须是 JSON 对象')
  }
  return parsed
}

export function registerRoutes(ctx, runner) {
  const token = randomBytes(24).toString('hex')
  const tokenBuf = Buffer.from(token, 'utf8')

  const hasValidToken = (request) => {
    const actual = request.headers.get(ADMIN_HEADER)
    if (typeof actual !== 'string') return false
    const actualBuf = Buffer.from(actual, 'utf8')
    return actualBuf.length === tokenBuf.length && timingSafeEqual(actualBuf, tokenBuf)
  }

  const register = (path, methods, handler) => {
    ctx.effect(() => ctx.connection.fetch.register({
      path: BASE + path,
      methods,
      requestBody: 'buffered',
      fetch: handler,
    }), `dsh-llm-detector: ${path}`)
  }

  register('/bootstrap', ['GET'], async () => {
    try {
      const providers = await runner.listProviders()
      let reference = null
      let referenceError = ''
      try { reference = await runner.reference() } catch (error) {
        referenceError = error instanceof Error ? error.message : String(error)
      }
      let proxy = null
      try { proxy = { ...proxyStatus(), system: await systemStatus() } } catch { proxy = null }
      return json(200, {
        token,
        providers: providers.providers,
        default: runner.defaultSelection(),
        reference,
        referenceError,
        proxy,
        running: runner.running ? runner.snapshot()?.id : null,
      })
    } catch (error) {
      return json(500, { error: error instanceof Error ? error.message : String(error) })
    }
  })

  register('/models', ['GET'], async (request) => {
    const provider = new URL(request.url).searchParams.get('provider') ?? ''
    try {
      const listed = await runner.listProviders(provider)
      return json(200, listed)
    } catch (error) {
      return json(400, { error: error instanceof Error ? error.message : String(error) })
    }
  })

  register('/model', ['GET'], async (request) => {
    try {
      const url = new URL(request.url)
      const info = await runner.modelInfo(
        url.searchParams.get('provider') ?? '',
        url.searchParams.get('model') ?? '',
      )
      return json(200, info)
    } catch (error) {
      return json(400, { error: error instanceof Error ? error.message : String(error) })
    }
  })

  register('/start', ['POST'], async (request) => {
    if (!hasValidToken(request)) return json(403, { error: '缺少或错误的操作令牌' })
    try {
      const body = await readBody(request)
      const { id } = await runner.start(body)
      return json(200, { id, snapshot: runner.snapshot(id) })
    } catch (error) {
      return json(400, { error: error instanceof Error ? error.message : String(error) })
    }
  })

  register('/job', ['GET'], async (request) => {
    try {
      const id = new URL(request.url).searchParams.get('id') ?? undefined
      const snapshot = runner.snapshot(id)
      if (!snapshot) return json(404, { error: '没有这个检测作业' })
      return json(200, snapshot)
    } catch (error) {
      return json(500, { error: error instanceof Error ? error.message : String(error) })
    }
  })

  register('/cancel', ['POST'], async (request) => {
    if (!hasValidToken(request)) return json(403, { error: '缺少或错误的操作令牌' })
    try {
      const body = await readBody(request)
      const ok = runner.cancel(body.id)
      return json(ok ? 200 : 404, { ok, snapshot: runner.snapshot(body.id) })
    } catch (error) {
      return json(400, { error: error instanceof Error ? error.message : String(error) })
    }
  })

  register('/proxy', ['GET'], async () => {
    try {
      return json(200, { ...proxyStatus(), system: await systemStatus() })
    } catch (error) {
      return json(500, { error: error instanceof Error ? error.message : String(error) })
    }
  })

  register('/proxy/apply', ['POST'], async (request) => {
    if (!hasValidToken(request)) return json(403, { error: '缺少或错误的操作令牌' })
    try {
      const body = await readBody(request)
      const next = await applyProxyMode(body.mode, body.url)
      if (!next.error) await save()
      return json(next.error ? 400 : 200, { ...next, system: await systemStatus() })
    } catch (error) {
      return json(400, { error: error instanceof Error ? error.message : String(error) })
    }
  })

  register('/proxy/test', ['POST'], async (request) => {
    if (!hasValidToken(request)) return json(403, { error: '缺少或错误的操作令牌' })
    try {
      const body = await readBody(request).catch(() => ({}))
      return json(200, await testProxy(body.url))
    } catch (error) {
      return json(400, { error: error instanceof Error ? error.message : String(error) })
    }
  })

  register('/retry', ['POST'], async (request) => {
    if (!hasValidToken(request)) return json(403, { error: '缺少或错误的操作令牌' })
    try {
      const body = await readBody(request)
      const result = await runner.retrySample(body.id, Number(body.round), Number(body.index))
      return json(200, { ...result, snapshot: runner.snapshot(body.id) })
    } catch (error) {
      return json(400, { error: error instanceof Error ? error.message : String(error) })
    }
  })
}
