// 관리자 화면 스크린샷(모바일 390 / 데스크탑 1280) — 대시보드·음원 관리(목록·편집 창)·사용자 관리
//   1) npm run dev (3000)
//   2) GLOBAL_MODULES="$(npm root -g)" node scripts/e2e/admin-audit.mjs
// 운영 DB를 쓰므로 쓰기 요청은 가로채서 막는다. 결과: scripts/e2e/out/admin-*.png
import { createRequire } from 'module'
import { execFileSync } from 'child_process'
import { mkdirSync } from 'fs'
import { join, dirname } from 'path'
import { fileURLToPath } from 'url'

const require = createRequire(import.meta.url)
const here = dirname(fileURLToPath(import.meta.url))
const { chromium } = require(join(process.env.GLOBAL_MODULES || '', 'playwright'))

const BASE = process.env.BASE_URL || 'http://localhost:3000'
const OUT = join(here, 'out')
mkdirSync(OUT, { recursive: true })
const QUERY = process.argv.find(a => a.startsWith('--q='))?.slice(4) || '박화요비'

const raw = execFileSync('node', [join(here, 'make-token.js')], { cwd: join(here, '..', '..') }).toString()
const token = (raw.match(/eyJ[\w-]+\.[\w-]+\.[\w-]+/) || [])[0]
if (!token) throw new Error('토큰을 못 만들었어요')

async function shoot(browser, name, viewport) {
    const mobile = viewport.width < 640
    const context = await browser.newContext({ viewport, hasTouch: mobile, isMobile: mobile })
    await context.addInitScript(t => localStorage.setItem('dibe2_token', t), token)
    await context.route('**/api/**', route => {
        const req = route.request()
        if (req.method() !== 'GET') return route.fulfill({ status: 200, contentType: 'application/json', body: '{"ok":true,"blocked":true}' })
        return route.continue()
    })
    const page = await context.newPage()
    page.on('pageerror', e => console.log('  [pageerror]', e.message))
    const snap = async (label, full = true) => {
        const file = join(OUT, `admin-${name}-${label}.png`)
        await page.screenshot({ path: file, fullPage: full })
        console.log('  ', file)
    }
    const menu = async (label) => {
        // 모바일은 헤더 아래 탭, 데스크탑은 사이드바
        await page.click(mobile ? `header nav button:has-text("${label}")` : `nav a:has-text("${label}")`)
        await page.waitForTimeout(1500)
    }

    await page.goto(`${BASE}/admin`, { waitUntil: 'load' })
    await page.waitForTimeout(4000)
    await snap('1-dashboard')

    await menu('사용자 관리')
    await snap('2-users')

    await menu('음원 관리')
    await page.fill('input[placeholder="음원 검색"]', QUERY)
    await page.click('button:has-text("검색") >> nth=0')
    await page.waitForTimeout(2500)
    await snap('3-music')

    // 모바일 목록은 줄을 누르면 편집 창, 데스크탑 카드는 "수정" 버튼
    await page.click(mobile ? 'ul li button.text-left >> nth=0' : 'button:has-text("수정") >> nth=0')
    await page.waitForTimeout(800)
    await snap('4-edit', false)
    await page.click('button:has-text("검색") >> visible=true >> nth=-1').catch(() => {})
    await page.waitForTimeout(4000)
    await snap('5-edit-yt', false)

    await context.close()
}

const browser = await chromium.launch()
try {
    await shoot(browser, 'm', { width: 390, height: 844 })
    await shoot(browser, 'd', { width: 1280, height: 900 })
} finally {
    await browser.close()
}
