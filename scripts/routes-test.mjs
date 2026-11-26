/**
 * 离线路由与鉴权测试：验证插件通过 `ctx.connection.fetch.register` 挂载路由，
 * 符合 DSH Fetch 路由校验规则，并在写操作、异常请求体、卸载和 headless 场景下表现正确。
 *
 * 用法：node scripts/routes-test.mjs
 */
import assert from 'node:assert/strict'
import { mkdtemp, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { apply } from '../index.js'

const tempDir = await mkdtemp(join(tmpdir(), 'dsh-llm-detector-routes-'))
process.env.DSH_LLM_DETECTOR_HISTORY_FILE = join(tempDir, 'history.json')

const ENDPOINT_SEGMENT = /^[A-Za-z0-9_$.-]+$/

function assertDshFetchRoute(route) {
  assert.ok(route.path.startsWith('/api/'), `路径必须以 /api/ 开头: ${route.path}`)
  const segments = route.path.slice('/api/'.length).split('/')
  assert.ok(
    segments.every(seg => seg !== '' && seg !== '.' && seg !== '..' && ENDPOINT_SEGMENT.test(seg)),
    `路径段不符合 DSH connection.fetch 约束: ${route.path}`,
  )
  assert.ok(Array.isArray(route.methods) && route.methods.length > 0, `必须声明 HTTP 方法: ${route.path}`)
  assert.equal(new Set(route.methods).size, route.methods.length, `HTTP 方法不能重复: ${route.path}`)
  assert.equal(route.requestBody, 'buffered', `应声明 buffered 请求体模式: ${route.path}`)
  assert.equal(typeof route.fetch, 'function', `fetch 处理器必须是函数: ${route.path}`)
}

function createMockContext({ withConnection = true } = {}) {
  const routes = new Map()
  const effects = []
  const registeredTools = []
  const injectedServices = []
  const provided = new Map()

  const llm = {
    listProviders: () => [{ id: 'mock', name: 'Mock' }],
    listModels: async () => [{ id: 'mock-model', name: 'Mock model' }],
    resolveModelInfo: async () => ({
      reasoning: { defaultEffort: 'low', efforts: [{ id: 'low', name: 'Low' }] },
    }),
    async *stream() {
      await new Promise(resolve => setTimeout(resolve, 200))
      yield { type: 'text-delta', index: 0, text: '1, 25, 50, 75, 100' }
      yield { type: 'finish', reason: { kind: 'stop' } }
    },
  }

  const ctx = {
    llm,
    tools: {
      register: (tool) => registeredTools.push(tool),
    },
    provide(key, value) {
      provided.set(key, value)
      ctx[key] = value
    },
    get(key) {
      return provided.get(key)
    },
    effect(fn) {
      const dispose = fn()
      effects.push(dispose)
      return () => {
        if (typeof dispose === 'function') dispose()
      }
    },
    inject(deps, callback) {
      injectedServices.push(deps)
      if (withConnection && deps.includes('connection')) {
        callback({
          ...ctx,
          connection: {
            fetch: {
              register(route) {
                assertDshFetchRoute(route)
                assert.ok(!routes.has(route.path), `重复注册路由: ${route.path}`)
                routes.set(route.path, route)
                return () => {
                  routes.delete(route.path)
                }
              },
            },
          },
        })
      }
    },
    disposeAll() {
      for (const dispose of effects.splice(0).reverse()) {
        if (typeof dispose === 'function') dispose()
      }
    },
  }

  return { ctx, routes, registeredTools, injectedServices }
}

// 1. 常规带 connection 的 Host 场景
const { ctx, routes, registeredTools, injectedServices } = createMockContext({ withConnection: true })
apply(ctx)

assert.equal(registeredTools.length, 1, '应注册 llm_fingerprint 工具')
assert.equal(registeredTools[0].name, 'llm_fingerprint')
assert.deepEqual(injectedServices, [['connection']], '应注入 connection 而非 webServer')

const expectedMethods = {
  '/api/llm-detector/bootstrap': ['GET'],
  '/api/llm-detector/models': ['GET'],
  '/api/llm-detector/model': ['GET'],
  '/api/llm-detector/start': ['POST'],
  '/api/llm-detector/job': ['GET'],
  '/api/llm-detector/cancel': ['POST'],
  '/api/llm-detector/proxy': ['GET'],
  '/api/llm-detector/proxy/apply': ['POST'],
  '/api/llm-detector/proxy/test': ['POST'],
  '/api/llm-detector/retry': ['POST'],
  '/api/llm-detector/history': ['GET'],
  '/api/llm-detector/history/item': ['GET'],
  '/api/llm-detector/history/delete': ['POST'],
  '/api/llm-detector/history/clear': ['POST'],
}
assert.equal(routes.size, Object.keys(expectedMethods).length, '应注册全部 14 条路由')
for (const [path, methods] of Object.entries(expectedMethods)) {
  const route = routes.get(path)
  assert.ok(route, `缺少路由: ${path}`)
  assert.deepEqual(route.methods, methods, `路由方法不匹配: ${path}`)
}

const callRoute = async (path, init = {}) => {
  const url = new URL(path, 'http://dsh.internal')
  const route = routes.get(url.pathname)
  assert.ok(route, `未找到路由: ${url.pathname}`)
  const method = (init.method || 'GET').toUpperCase()
  assert.ok(route.methods.includes(method), `方法 ${method} 不被 ${url.pathname} 允许`)
  return route.fetch(new Request(url, { ...init, method }))
}

// 2. GET /bootstrap /models /model /proxy
const bootRes = await callRoute('/api/llm-detector/bootstrap')
assert.equal(bootRes.status, 200)
assert.equal(bootRes.headers.get('cache-control'), 'no-store')
assert.match(bootRes.headers.get('content-type') || '', /application\/json/)
const boot = await bootRes.json()
assert.equal(typeof boot.token, 'string')
assert.ok(boot.token.length >= 32, '应下发随机操作令牌')
assert.equal(boot.providers.length, 1)

const modelsRes = await callRoute('/api/llm-detector/models?provider=mock')
assert.equal(modelsRes.status, 200)
assert.equal((await modelsRes.json()).models[0].id, 'mock-model')

const modelRes = await callRoute('/api/llm-detector/model?provider=mock&model=mock-model')
assert.equal(modelRes.status, 200)
assert.equal((await modelRes.json()).reasoning?.defaultEffort, 'low')

const proxyRes = await callRoute('/api/llm-detector/proxy')
assert.equal(proxyRes.status, 200)

// 3. 写操作缺少或错误令牌均应返回 403
for (const writePath of ['/api/llm-detector/start', '/api/llm-detector/cancel', '/api/llm-detector/retry', '/api/llm-detector/proxy/apply', '/api/llm-detector/proxy/test', '/api/llm-detector/history/delete', '/api/llm-detector/history/clear']) {
  const missing = await callRoute(writePath, { method: 'POST', body: '{}' })
  assert.equal(missing.status, 403, `${writePath} 缺少令牌应返回 403`)
  const wrong = await callRoute(writePath, {
    method: 'POST',
    headers: { 'x-llm-detector-token': 'invalid-token' },
    body: '{}',
  })
  assert.equal(wrong.status, 403, `${writePath} 错误令牌应返回 403`)
}

// 4. 非法 JSON、非对象 JSON、超长请求体应返回 400
const authHeaders = { 'Content-Type': 'application/json', 'x-llm-detector-token': boot.token }
const badJson = await callRoute('/api/llm-detector/start', { method: 'POST', headers: authHeaders, body: '{bad' })
assert.equal(badJson.status, 400)

const nonObj = await callRoute('/api/llm-detector/start', { method: 'POST', headers: authHeaders, body: '[1,2,3]' })
assert.equal(nonObj.status, 400)

const oversized = await callRoute('/api/llm-detector/start', {
  method: 'POST',
  headers: authHeaders,
  body: JSON.stringify({ pad: 'x'.repeat(70_000) }),
})
assert.equal(oversized.status, 400)

// 5. 合法写操作：启动作业 → 查询快照 → 取消作业
const startRes = await callRoute('/api/llm-detector/start', {
  method: 'POST',
  headers: authHeaders,
  body: JSON.stringify({ provider: 'mock', model: 'mock-model', rounds: 1, samples_per_round: 1, parallel: 1 }),
})
assert.equal(startRes.status, 200)
const started = await startRes.json()
assert.ok(started.id, '应返回作业 id')

const jobRes = await callRoute(`/api/llm-detector/job?id=${encodeURIComponent(started.id)}`)
assert.equal(jobRes.status, 200)
assert.equal((await jobRes.json()).id, started.id)

const cancelRes = await callRoute('/api/llm-detector/cancel', {
  method: 'POST',
  headers: authHeaders,
  body: JSON.stringify({ id: started.id }),
})
assert.equal(cancelRes.status, 200)
assert.equal((await cancelRes.json()).ok, true)

// 等待取消收尾，验证历史记录已落盘并可通过路由读取、删除、清空
for (let i = 0; i < 40; i++) {
  const snap = await (await callRoute(`/api/llm-detector/job?id=${encodeURIComponent(started.id)}`)).json()
  if (snap.status !== 'running' && snap.status !== 'cancelling') break
  await new Promise(resolve => setTimeout(resolve, 50))
}
const histListRes = await callRoute('/api/llm-detector/history')
assert.equal(histListRes.status, 200)
const histList = await histListRes.json()
assert.equal(histList.items.length, 1, '取消结束的作业应写入历史记录')
assert.equal(histList.items[0].id, started.id)
assert.equal(histList.items[0].source, 'panel')

const histItemMissing = await callRoute('/api/llm-detector/history/item')
assert.equal(histItemMissing.status, 400)
const histItemNotFound = await callRoute('/api/llm-detector/history/item?id=nonexistent')
assert.equal(histItemNotFound.status, 404)
const histItemRes = await callRoute(`/api/llm-detector/history/item?id=${encodeURIComponent(started.id)}`)
assert.equal(histItemRes.status, 200)
assert.equal((await histItemRes.json()).id, started.id)

const delNotFound = await callRoute('/api/llm-detector/history/delete', {
  method: 'POST',
  headers: authHeaders,
  body: JSON.stringify({ id: 'nonexistent' }),
})
assert.equal(delNotFound.status, 404)
const delRes = await callRoute('/api/llm-detector/history/delete', {
  method: 'POST',
  headers: authHeaders,
  body: JSON.stringify({ id: started.id }),
})
assert.equal(delRes.status, 200)
assert.equal((await delRes.json()).ok, true)
assert.equal((await (await callRoute('/api/llm-detector/history')).json()).items.length, 0)

const clearRes = await callRoute('/api/llm-detector/history/clear', {
  method: 'POST',
  headers: authHeaders,
  body: '{}',
})
assert.equal(clearRes.status, 200)
assert.equal((await clearRes.json()).ok, true)

// 6. 卸载清理所有已注册路由
ctx.disposeAll()
assert.equal(routes.size, 0, '插件卸载后应清理所有 Fetch 路由')

// 7. 无 connection 的 headless 场景仍能正常注册工具
const headless = createMockContext({ withConnection: false })
apply(headless.ctx)
assert.equal(headless.registeredTools.length, 1)
assert.equal(headless.routes.size, 0)
headless.ctx.disposeAll()
await rm(tempDir, { recursive: true, force: true })

console.log('ROUTES TEST PASS')
