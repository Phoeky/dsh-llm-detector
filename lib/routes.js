/**
 * 同源 HTTP 路由，供左侧边的检测页面使用。
 *
 * 鉴权：路由只绑定在 DSH 自己的 webServer 上；每次启动生成一个随机 token，
 * 通过 `/bootstrap` 下发给同源的插件页面，写操作（开始/取消）必须回传。
 * 模型地址与密钥不会出现在任何响应里。
 */
import { randomBytes } from 'node:crypto'

const BASE = '/api/llm-detector'
const ADMIN_HEADER = 'x-llm-detector-token'

const json = (res, status, value) => {
  const body = JSON.stringify(value)
  res.statusCode = status
  res.setHeader('Content-Type', 'application/json; charset=utf-8')
  res.setHeader('Cache-Control', 'no-store')
  res.end(body)
}

const readBody = (req) => new Promise((resolve, reject) => {
  let text = ''
  req.on('data', (chunk) => {
    text += chunk
    if (text.length > 64_000) {
      reject(new Error('请求体过大'))
      req.destroy()
    }
  })
  req.on('end', () => {
    if (!text.trim()) return resolve({})
    try { resolve(JSON.parse(text)) } catch { reject(new Error('请求体不是有效 JSON')) }
  })
  req.on('error', reject)
})

export function registerRoutes(ctx, runner) {
  const token = randomBytes(24).toString('hex')

  const register = (path, handler) => {
    const dispose = ctx.webServer.register({ kind: 'exact', path: BASE + path, handler })
    ctx.effect(() => () => dispose(), `dsh-llm-detector: ${path}`)
  }

  register('/bootstrap', async (_req, res) => {
    try {
      const providers = await runner.listProviders()
      let reference = null
      let referenceError = ''
      try { reference = await runner.reference() } catch (error) {
        referenceError = error instanceof Error ? error.message : String(error)
      }
      json(res, 200, {
        token,
        providers: providers.providers,
        default: runner.defaultSelection(),
        reference,
        referenceError,
        running: runner.running ? runner.snapshot()?.id : null,
      })
    } catch (error) {
      json(res, 500, { error: error instanceof Error ? error.message : String(error) })
    }
  })

  register('/models', async (req, res) => {
    const provider = new URL(req.url, 'http://localhost').searchParams.get('provider') ?? ''
    try {
      const listed = await runner.listProviders(provider)
      json(res, 200, listed)
    } catch (error) {
      json(res, 400, { error: error instanceof Error ? error.message : String(error) })
    }
  })

  register('/start', async (req, res) => {
    if (req.headers[ADMIN_HEADER] !== token) return json(res, 403, { error: '缺少或错误的操作令牌' })
    try {
      const body = await readBody(req)
      const { id } = await runner.start(body)
      json(res, 200, { id, snapshot: runner.snapshot(id) })
    } catch (error) {
      json(res, 400, { error: error instanceof Error ? error.message : String(error) })
    }
  })

  register('/job', async (req, res) => {
    try {
      const id = new URL(req.url, 'http://localhost').searchParams.get('id') ?? undefined
      const snapshot = runner.snapshot(id)
      if (!snapshot) return json(res, 404, { error: '没有这个检测作业' })
      json(res, 200, snapshot)
    } catch (error) {
      json(res, 500, { error: error instanceof Error ? error.message : String(error) })
    }
  })

  register('/cancel', async (req, res) => {
    if (req.headers[ADMIN_HEADER] !== token) return json(res, 403, { error: '缺少或错误的操作令牌' })
    try {
      const body = await readBody(req)
      const ok = runner.cancel(body.id)
      json(res, ok ? 200 : 404, { ok, snapshot: runner.snapshot(body.id) })
    } catch (error) {
      json(res, 400, { error: error instanceof Error ? error.message : String(error) })
    }
  })

  register('/retry', async (req, res) => {
    if (req.headers[ADMIN_HEADER] !== token) return json(res, 403, { error: '缺少或错误的操作令牌' })
    try {
      const body = await readBody(req)
      const result = await runner.retrySample(body.id, Number(body.round), Number(body.index))
      json(res, 200, { ...result, snapshot: runner.snapshot(body.id) })
    } catch (error) {
      json(res, 400, { error: error instanceof Error ? error.message : String(error) })
    }
  })
}