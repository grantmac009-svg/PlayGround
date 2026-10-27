import { createRequire } from 'node:module'
import { existsSync, mkdirSync, readFileSync, statSync } from 'node:fs'
import { homedir } from 'node:os'
import { join } from 'node:path'

const EXIT_SCRIPT = 1
const EXIT_INFRA = 75
const startedAt = Date.now()

const step = message => console.log(`[capture.mjs +${((Date.now() - startedAt) / 1000).toFixed(2)}s] ${message}`)

const url = process.env.CAPTURE_URL
const output = process.env.CAPTURE_DIR
if (!url || !output) {
  console.error('capture.sh: CAPTURE_URL and CAPTURE_DIR are required.')
  process.exit(EXIT_SCRIPT)
}
try {
  const parsed = new URL(url)
  if (!/^https?:$/.test(parsed.protocol)) throw new Error('unsupported protocol')
} catch {
  console.error(`capture.sh: CAPTURE_URL is not a valid http(s) URL: ${url}`)
  process.exit(EXIT_SCRIPT)
}

try {
  mkdirSync(output, { recursive: true })
} catch (error) {
  console.error(`capture.sh: cannot create CAPTURE_DIR ${output}: ${error.message}`)
  process.exit(EXIT_SCRIPT)
}
step(`target=${url}`)
step(`output=${output}`)

const runtimeRoot = process.env.OMGITHUB_PLAYRIGHT_ROOT || join(homedir(), '.local/share/omgithub-playwright')

const transient = error => {
  throw Object.assign(error instanceof Error ? error : new Error(String(error)), { exitCode: EXIT_INFRA })
}

const scriptFailure = error => {
  throw Object.assign(error instanceof Error ? error : new Error(String(error)), { exitCode: EXIT_SCRIPT })
}

let browser
try {
  if (process.platform === 'linux' && !process.env.DISPLAY) {
    try {
      process.env.DISPLAY = ':' + readFileSync(join(runtimeRoot, 'display'), 'utf8').trim()
    } catch (error) {
      transient(new Error(`no X display available for the browser: ${error.message}`))
    }
    step(`DISPLAY=${process.env.DISPLAY}`)
  }

  let chromium
  try {
    const require = createRequire(join(runtimeRoot, 'package.json'))
    chromium = require('playwright').chromium
  } catch (error) {
    transient(new Error(`playwright is unavailable: ${error.message}`))
  }

  let config = {}
  try {
    config = JSON.parse(readFileSync(join(runtimeRoot, 'linux.json'), 'utf8'))
  } catch {
    step('linux.json missing; using default chromium launch options')
  }
  const launchOptions = { timeout: 30000, ...(config.browser?.launchOptions || {}) }
  if (config.browser?.browserName) launchOptions.channel = launchOptions.channel || config.browser.browserName

  step('launching browser')
  browser = await chromium.launch(launchOptions).catch(transient)
  step('browser launched')

  const readySelector = process.env.CAPTURE_READY_SELECTOR || 'body'
  const viewports = [
    ['desktop', 1440, 900],
    ['mobile', 390, 844]
  ]

  for (const [name, width, height] of viewports) {
    step(`opening ${name} viewport ${width}x${height}`)
    const page = await browser.newPage({ viewport: { width, height } }).catch(transient)
    page.setDefaultTimeout(30000)
    page.on('pageerror', error => console.error(`[pageerror:${name}] ${error.message}`))

    step(`navigating ${name} to ${url}`)
    const response = await page.goto(url, { waitUntil: 'load', timeout: 45000 }).catch(transient)
    const status = response ? response.status() : 0
    if (!response || !response.ok()) {
      const temporary = !response || status === 408 || status === 429 || status >= 500
      const error = new Error(`HTTP ${status || 'unknown'} loading preview at ${url}`)
      if (temporary) transient(error)
      scriptFailure(error)
    }
    step(`${name} loaded (HTTP ${status})`)

    await page.locator(readySelector).first().waitFor({ state: 'visible', timeout: 20000 }).catch(transient)
    await page.waitForFunction(() => document.fonts.status === 'loaded', null, { timeout: 10000 })
      .catch(() => step('font loading did not settle; continuing'))

    const rendered = await page.waitForFunction(() => {
      const target = document.querySelector('#stage') || document.body
      const rect = target.getBoundingClientRect()
      return rect.width > 40 && rect.height > 40 && document.body.innerText.trim().length > 0
    }, null, { timeout: 15000 }).then(() => true).catch(() => false)
    if (!rendered) {
      await page.close().catch(() => {})
      scriptFailure(new Error(`page did not render visible content at ${url}`))
    }
    step(`${name} content rendered`)

    const autoStart = await (async () => {
      if (process.env.CAPTURE_AUTO_START === 'false') return 'disabled'
      const selector = process.env.CAPTURE_START_SELECTOR || 'button, [role="button"]'
      const matches = []
      for (const control of await page.locator(selector).all()) {
        if (!await control.isVisible().catch(() => false)) continue
        if (!await control.isEnabled().catch(() => false)) continue
        const label = await control.evaluate(element =>
          (element.getAttribute('aria-label') || element.textContent || '').trim()
        ).catch(() => '')
        if (/^(?:start|play)(?:\s+(?:game|now))?$/i.test(label)) matches.push(control)
      }
      if (matches.length !== 1) return matches.length ? 'ambiguous' : 'not-found'
      try {
        await matches[0].click({ timeout: 2000, noWaitAfter: true })
        return 'clicked'
      } catch {
        return 'not-actionable'
      }
    })()
    step(`auto-start ${autoStart}`)

    await page.waitForTimeout(1000)
    const file = join(output, `final-${name}.png`)
    step(`screenshot ${file}`)
    await page.screenshot({ path: file, timeout: 30000 }).catch(error => {
      if (error.name === 'TimeoutError' || !browser.isConnected()) transient(error)
      scriptFailure(error)
    })
    await page.close().catch(() => {})
  }

  for (const name of ['final-desktop.png', 'final-mobile.png']) {
    const file = join(output, name)
    if (!existsSync(file) || statSync(file).size < 24 ||
        readFileSync(file).subarray(0, 8).toString('hex') !== '89504e470d0a1a0a') {
      scriptFailure(new Error(`capture did not produce a PNG: ${name}`))
    }
  }
  step('verified final-desktop.png and final-mobile.png')
} catch (error) {
  console.error(`[capture.mjs] ${error.message}`)
  if (error.stack) console.error(error.stack)
  process.exitCode = error.exitCode || EXIT_SCRIPT
} finally {
  if (browser) {
    await browser.close().catch(error => {
      console.error(`[capture.mjs] browser close failed: ${error.message}`)
      process.exitCode ||= EXIT_INFRA
    })
    step('browser closed')
  }
}
