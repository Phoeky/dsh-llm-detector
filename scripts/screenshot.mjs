/**
 * 用本机 Chrome 的 headless CDP 渲染真实 DSH 页面并截图（README 用）。
 *
 * - 临时 user-data-dir，不读取用户浏览器资料；
 * - 只访问本机 DSH GUI（默认 127.0.0.1:11256）；
 * - 步骤：首页 → 点击侧边栏“模型指纹” → 面板；可选启动一次真实检测并等结果。
 *
 * 用法：
 *   node scripts/screenshot.mjs --probe
 *   node scripts/screenshot.mjs --detect     # 触发一次真实检测（3 次调用）
 */
import { spawn } from 'node:child_process'
import { mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = join(dirname(fileURLToPath(import.meta.url)), '..')
const outDir = join(root, 'docs', 'screenshots')
const BASE = process.env.DSH_URL || 'http://127.0.0.1:11256'
const PORT = 9333
const CHROME = process.env.CHROME_PATH
  || 'C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe'

const args = new Set(process.argv.slice(2))
const probe = args.has('--probe')
const detect = args.has('--detect')

const sleep = (ms) => new Promise(resolve => setTimeout(resolve, ms))

async function launch() {
  const profile = await mkdtemp(join(tmpdir(), 'dsh-shot-'))
  const child = spawn(CHROME, [
    '--headless=new',
    '--disable-gpu',
    '--hide-scrollbars',
    '--no-first-run',
    '--no-default-browser-check',
    '--disable-extensions',
    `--user-data-dir=${profile}`,
    `--remote-debugging-port=${PORT}`,
    '--window-size=1440,900',
    'about:blank',
  ], { stdio: 'ignore' })
  return { child, profile }
}

async function target() {
  for (let i = 0; i < 60; i++) {
    try {
      const list = await (await fetch(`http://127.0.0.1:${PORT}/json/list`)).json()
      const page = list.find(item => item.type === 'page')
      if (page?.webSocketDebuggerUrl) return page.webSocketDebuggerUrl
    } catch { /* 浏览器还没起来 */ }
    await sleep(250)
  }
  throw new Error('无法连接到 Chrome 调试端口')
}

function connect(url) {
  const ws = new WebSocket(url)
  let seq = 0
  const pending = new Map()
  const events = []
  ws.addEventListener('message', (event) => {
    const message = JSON.parse(event.data)
    if (message.id && pending.has(message.id)) {
      const { resolve, reject } = pending.get(message.id)
      pending.delete(message.id)
      if (message.error) reject(new Error(message.error.message))
      else resolve(message.result)
    } else if (message.method) {
      events.push(message)
    }
  })
  const ready = new Promise((resolve, reject) => {
    ws.addEventListener('open', () => resolve())
    ws.addEventListener('error', reject)
  })
  const send = async (method, params = {}) => {
    await ready
    const id = ++seq
    return new Promise((resolve, reject) => {
      pending.set(id, { resolve, reject })
      ws.send(JSON.stringify({ id, method, params }))
    })
  }
  return { ws, send, events }
}

async function evaluate(cdp, expression) {
  const result = await cdp.send('Runtime.evaluate', {
    expression,
    returnByValue: true,
    awaitPromise: true,
    userGesture: true,
  })
  if (result.exceptionDetails) throw new Error(result.exceptionDetails.text || 'evaluate failed')
  return result.result?.value
}

async function shot(cdp, name) {
  const { data } = await cdp.send('Page.captureScreenshot', { format: 'png', captureBeyondViewport: false })
  const file = join(outDir, name)
  await writeFile(file, Buffer.from(data, 'base64'))
  console.log(`saved ${name}`)
}

const CLICK_BY_TEXT = (labels) => `(() => {
  const wanted = ${JSON.stringify(labels)};
  const nodes = [...document.querySelectorAll('button, [role="button"], a, [role="tab"], li')];
  for (const node of nodes) {
    const text = ((node.innerText || node.textContent || '') + ' ' + (node.getAttribute('aria-label') || '') + ' ' + (node.getAttribute('title') || '')).trim();
    if (wanted.some(label => text.includes(label))) {
      node.click();
      return 'clicked:' + text.slice(0, 60);
    }
  }
  return 'not-found';
})()`

const { child, profile } = await launch()
let cdp
try {
  cdp = connect(await target())
  await cdp.send('Page.enable')
  await cdp.send('Runtime.enable')
  await cdp.send('Emulation.setDeviceMetricsOverride', {
    width: 1440, height: 900, deviceScaleFactor: 2, mobile: false,
  })
  await cdp.send('Page.navigate', { url: BASE })
  await sleep(9000)

  if (probe) {
    const info = await evaluate(cdp, `(() => ({
      title: document.title,
      buttons: [...document.querySelectorAll('button, [role="button"]')]
        .map(n => ((n.innerText || '').trim() + '|' + (n.getAttribute('aria-label') || '') + '|' + (n.getAttribute('title') || '')).trim())
        .filter(Boolean).slice(0, 60),
    }))()`)
    console.log(JSON.stringify(info, null, 2))
  } else {
    await mkdir(outDir, { recursive: true })
    await shot(cdp, 'panel-1-empty.png')
    console.log(await evaluate(cdp, CLICK_BY_TEXT(['模型指纹', 'Model fingerprint'])))
    await sleep(1500)
    await shot(cdp, 'panel-2-form.png')

    if (detect) {
      console.log(await evaluate(cdp, CLICK_BY_TEXT(['开始检测', 'Start detection'])))
      await sleep(4000)
      await shot(cdp, 'panel-3-progress.png')
      for (let i = 0; i < 90; i++) {
        await sleep(2000)
        const done = await evaluate(cdp, `document.body.innerText.includes('候选排名')`)
        if (done) break
      }
      await sleep(1500)
      await shot(cdp, 'panel-4-result.png')
    }
  }
} finally {
  try { cdp?.ws.close() } catch {}
  try { child.kill() } catch {}
  await sleep(500)
  await rm(profile, { recursive: true, force: true }).catch(() => {})
}