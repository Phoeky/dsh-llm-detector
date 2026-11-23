/**
 * 用与 UI 完全相同的 HTTP 路由走一遍用户流程：
 * bootstrap → models → start → 轮询 job → 输出摘要。
 * 与页面的差别只是没有浏览器渲染；请求、鉴权与作业编排是同一份。
 */
const base = process.env.DSH_URL || 'http://127.0.0.1:11256'
const provider = process.argv[2] || 'codearts'
const model = process.argv[3] || 'deepseek-v4.1-flash-1017'

const boot = await (await fetch(`${base}/api/llm-detector/bootstrap`)).json()
console.log(`providers=${boot.providers.length} default=${boot.default?.provider}/${boot.default?.model} reference=${boot.reference?.models}`)
const token = boot.token

const listed = await (await fetch(`${base}/api/llm-detector/models?provider=${encodeURIComponent(provider)}`)).json()
console.log(`models of ${provider}: ${listed.models.length}; requested ${model} present=${listed.models.some(m => m.id === model)}`)

const started = await (await fetch(`${base}/api/llm-detector/start`, {
  method: 'POST',
  headers: { 'Content-Type': 'application/json', 'x-llm-detector-token': token },
  body: JSON.stringify({ provider, model, rounds: 1, parallel: 1, includeReplies: false }),
})).json()
if (!started.id) {
  console.error('start failed:', started)
  process.exit(1)
}
console.log(`job=${started.id}`)

let snapshot
for (;;) {
  await new Promise(resolve => setTimeout(resolve, 2000))
  snapshot = await (await fetch(`${base}/api/llm-detector/job?id=${started.id}`)).json()
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