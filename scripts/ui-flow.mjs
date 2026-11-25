/**
 * 用与 UI 完全相同的 HTTP 路由走一遍用户流程：
 * bootstrap → models → start → 轮询 job → 输出摘要。
 *
 * 路由已接入 DSH connection.fetch 认证通道，脚本调用时需提供：
 * - DSH_COOKIE：浏览器会话 Cookie（如 `dsh-auth-xxx=...`），或
 * - DSH_CONNECT_TOKEN：DSH 启动连接令牌（自动请求 `/connect` 换取 Cookie）。
 */
const base = process.env.DSH_URL || 'http://127.0.0.1:11256'
const provider = process.argv[2] || 'codearts'
const model = process.argv[3] || 'deepseek-v4.1-flash-1017'

async function resolveCookie() {
  if (process.env.DSH_COOKIE) return process.env.DSH_COOKIE
  if (!process.env.DSH_CONNECT_TOKEN) return ''
  const res = await fetch(`${base}/connect?token=${encodeURIComponent(process.env.DSH_CONNECT_TOKEN)}`, {
    redirect: 'manual',
  })
  const setCookie = res.headers.get('set-cookie')
  if (!setCookie) {
    throw new Error(`/connect 换取会话失败：HTTP ${res.status}`)
  }
  return setCookie.split(';', 1)[0]
}

const cookie = await resolveCookie()
const authHeaders = cookie ? { Cookie: cookie } : {}

async function fetchJson(path, init = {}) {
  const res = await fetch(`${base}${path}`, {
    ...init,
    headers: { ...authHeaders, ...(init.headers || {}) },
  })
  if (res.status === 401 || res.status === 403) {
    throw new Error(`HTTP ${res.status}（${path}）：需要已认证的 DSH 会话，请设置 DSH_COOKIE 或 DSH_CONNECT_TOKEN`)
  }
  return res.json()
}

const boot = await fetchJson('/api/llm-detector/bootstrap')
console.log(`providers=${boot.providers.length} default=${boot.default?.provider}/${boot.default?.model} reference=${boot.reference?.models}`)
const token = boot.token

const listed = await fetchJson(`/api/llm-detector/models?provider=${encodeURIComponent(provider)}`)
console.log(`models of ${provider}: ${listed.models.length}; requested ${model} present=${listed.models.some(m => m.id === model)}`)

const started = await fetchJson('/api/llm-detector/start', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json', 'x-llm-detector-token': token },
  body: JSON.stringify({ provider, model, rounds: 1, parallel: 1, includeReplies: false }),
})
if (!started.id) {
  console.error('start failed:', started)
  process.exit(1)
}
console.log(`job=${started.id}`)

let snapshot
for (;;) {
  await new Promise(resolve => setTimeout(resolve, 2000))
  snapshot = await fetchJson(`/api/llm-detector/job?id=${started.id}`)
  const live = snapshot.samples.filter(s => s.round === (snapshot.current?.index ?? 1))
  process.stdout.write(`\rstatus=${snapshot.status} round=${snapshot.current?.index ?? '-'} samples=${live.map(s => `${s.state}:${s.count}`).join(' ')}   `)
  if (snapshot.status !== 'running') break
}
console.log('\n--- result ---')
console.log(JSON.stringify({
  status: snapshot.status,
  error: snapshot.error,
  summary: snapshot.summary,
  rounds: snapshot.rounds.map(round => ({
    index: round.index,
    prediction: round.prediction_name,
    probability: round.probability,
    used: round.used_outputs,
    top: round.top.slice(0, 3),
    samples: round.samples.map(s => ({ state: s.state, count: s.count, error: s.error, note: s.note })),
  })),
}, null, 2))
