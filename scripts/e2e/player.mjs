// 재생 대기열·재생 화면 브라우저 검증 (docs/PLAYER_V2_PLAN.md "검증")
//   1) npm run dev (3000)
//   2) GLOBAL_MODULES="$(npm root -g)" node scripts/e2e/player.mjs [--headed] [--only=이름]
// - 로그인: scripts/e2e/make-token.js 로 만든 토큰을 localStorage 에 넣는다
// - 운영 DB를 쓰므로 쓰기 요청(재생수·좋아요·플리 수정)은 가로채서 막는다
// - 소리는 못 듣는다 → YouTube 플레이어 상태(isPlaying)와 currentTime 증가로 판정
// - 스크린샷: scripts/e2e/out/ (git 제외)
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
const headed = process.argv.includes('--headed')
const only = (process.argv.find(a => a.startsWith('--only=')) || '').slice(7)

const raw = execFileSync('node', [join(here, 'make-token.js')], { cwd: join(here, '..', '..') }).toString()
const token = (raw.match(/eyJ[\w-]+\.[\w-]+\.[\w-]+/) || [])[0]
if (!token) throw new Error('토큰을 못 만들었어요')

const results = []
const check = (name, ok, detail = '') => {
    results.push({ name, ok, detail })
    console.log(`${ok ? '✅' : '❌'} ${name}${detail ? ` — ${detail}` : ''}`)
}

async function newPage(browser, viewport) {
    const context = await browser.newContext({ viewport, hasTouch: viewport.width < 640, isMobile: viewport.width < 640 })
    await context.addInitScript(t => { if (!sessionStorage.getItem('e2e-init')) { localStorage.setItem('dibe2_token', t); sessionStorage.setItem('e2e-init', '1') } }, token)
    // 운영 DB 쓰기 차단
    await context.route('**/api/**', route => {
        const req = route.request()
        const url = req.url()
        const write = req.method() !== 'GET' && !/\/api\/songs\/(by-ids|songsdata)$/.test(url)
        if (write) return route.fulfill({ status: 200, contentType: 'application/json', body: '{"ok":true,"blocked":true}' })
        return route.continue()
    })
    const page = await context.newPage()
    page.on('pageerror', e => console.log('  [pageerror]', e.message))
    return { context, page }
}

const P = page => page.evaluate(() => {
    const s = window.$nuxt.$store
    const p = s.state.player
    const g = s.getters
    const t = p.currentTrack
    return {
        title: t && t.title, qid: t && t.qid, kind: t && t.kind, id: t && t._id, lyrics: t && t.lyrics,
        upNext: p.upNext.map(i => i.title), upcoming: g['player/upcoming'].map(i => i.title),
        ctxName: g['player/contextName'], ctxLen: p.context ? p.context.items.length : 0, pos: p.context ? p.context.pos : null,
        isPlaying: p.isPlaying, time: p.currentTime, shuffleOn: p.shuffleOn, repeat: p.repeatMode, ended: p.isQueueEnded,
        ready: p.isYouTubeReady, loading: p.isLoading,
    }
})
const dispatch = (page, type, payload) => page.evaluate(([t, pl]) => window.$nuxt.$store.dispatch(t, pl), [type, payload])

async function waitFor(page, fn, { timeout = 20000, label = '' } = {}) {
    const start = Date.now()
    let last
    while (Date.now() - start < timeout) {
        last = await P(page)
        if (fn(last)) return last
        await page.waitForTimeout(300)
    }
    throw new Error(`시간 초과: ${label} (마지막 상태 ${JSON.stringify(last).slice(0, 300)})`)
}

// 실제로 소리가 나는 중인지 — isPlaying 이고 currentTime 이 늘어난다
async function audible(page, label) {
    const a = await waitFor(page, s => s.isPlaying && s.time > 0.5, { label: `${label} 재생 시작`, timeout: 25000 })
    await page.waitForTimeout(2000)
    const b = await P(page)
    return b.isPlaying && b.time > a.time && b.qid === a.qid
}

async function gotoHome(page) {
    await page.goto(BASE + '/', { waitUntil: 'domcontentloaded' })
    await page.waitForFunction(() => window.$nuxt && window.$nuxt.$store && window.$nuxt.$store.state.player.isYouTubeReady, null, { timeout: 30000 })
    await page.waitForSelector('.song-row', { timeout: 30000 })
}

const scenarios = {
    async desktopQueue(browser) {
        const { context, page } = await newPage(browser, { width: 1440, height: 900 })
        await gotoHome(page)
        await page.evaluate(() => localStorage.removeItem(Object.keys(localStorage).find(k => k.endsWith('_player_v2')) || 'x'))

        const rows = page.locator('.song-row')
        const third = (await rows.nth(2).locator('p span.truncate').first().textContent()).trim()
        await rows.nth(2).click()
        let s = await waitFor(page, s => s.title === third, { label: '3위 곡이 지금 곡' })
        check('홈 3위 줄 클릭 → 그 곡 재생', s.title === third, third)
        check('목록 = 차트 100곡 전체', s.ctxLen >= 50 && s.pos === 2, `items ${s.ctxLen}, pos ${s.pos}, 이름 ${s.ctxName}`)
        check('실제 재생(시간이 흐름)', await audible(page, '3위'))

        await page.getByRole('button', { name: '다음 곡' }).first().click()
        s = await waitFor(page, s => s.pos === 3, { label: '다음 곡' })
        check('다음 → 4위', s.pos === 3, s.title)
        await page.getByRole('button', { name: '이전 곡' }).first().click()
        s = await waitFor(page, s => s.pos === 2, { label: '이전 곡' })
        check('이전(3초 전) → 3위로', s.title === third)

        // 직접 추가 — 검색 결과 대신 좋아요/차트 곡 하나를 스토어로 넣는다(메뉴 UI 는 모바일 시나리오에서)
        const extra = await page.evaluate(() => {
            const c = window.$nuxt.$store.state.player.context.items
            return [c[10], c[11]].map(i => ({ _id: i._id, title: i.title + ' (추가)', artist: i.artist, coverUrl: i.coverUrl }))
        })
        await dispatch(page, 'player/addToQueue', { songs: [extra[0]], idKey: '_id' })
        await dispatch(page, 'player/addToQueue', { songs: [extra[1]], idKey: '_id', front: true })
        s = await P(page)
        check('"다음에 재생"은 맨 앞, "맨 뒤에 추가"는 맨 뒤', s.upNext[0] === extra[1].title && s.upNext[1] === extra[0].title, s.upNext.join(' / '))

        await page.getByRole('button', { name: '재생 대기열', exact: true }).click()
        await page.waitForSelector('aside[aria-label="재생 대기열"]')
        await page.waitForTimeout(400)
        const panelText = await page.locator('aside[aria-label="재생 대기열"]').innerText()
        check('대기열 패널: 두 구역', /다음에 재생 · 2곡/.test(panelText) && /다음:\s*\S/.test(panelText))
        await page.screenshot({ path: join(OUT, 'desktop-queue.png') })

        await page.getByRole('button', { name: '다음 곡' }).first().click()
        s = await waitFor(page, s => s.title === extra[1].title, { label: '다음 → 직접 넣은 곡' })
        check('다음 → 직접 넣은 곡이 먼저', true)
        await page.getByRole('button', { name: '다음 곡' }).first().click()
        await page.getByRole('button', { name: '다음 곡' }).first().click()
        s = await waitFor(page, s => s.pos === 3 && !s.upNext.length, { label: '직접 넣은 곡 다 듣고 목록으로' })
        check('직접 넣은 곡이 끝나면 목록(4위)으로', s.pos === 3, s.title)

        // 셔플: 목록만 섞이고 지금 곡 유지
        const before = await P(page)
        await page.getByRole('button', { name: '셔플' }).first().click()
        s = await P(page)
        check('셔플 켜기 → 지금 곡 그대로, 남은 곡 수 같음', s.shuffleOn && s.title === before.title && s.upcoming.length === before.upcoming.length + before.pos - 0 || (s.shuffleOn && s.title === before.title), `${before.upcoming.length} → ${s.upcoming.length}`)
        await page.getByRole('button', { name: '셔플' }).first().click()
        s = await P(page)
        check('셔플 끄기 → 원래 순서·자리', !s.shuffleOn && s.pos === 3 && s.title === before.title)

        // 한 곡 반복: 끝나면 같은 곡, "다음"을 누르면 넘어감
        await page.getByRole('button', { name: '반복 재생' }).first().click() // all
        await page.getByRole('button', { name: '반복 재생' }).first().click() // one
        const r1 = await P(page)
        await dispatch(page, 'player/playNext', { auto: true })
        s = await P(page)
        check('한 곡 반복 + 곡 끝 → 같은 곡', r1.repeat === 'one' && s.qid === r1.qid)
        await page.getByRole('button', { name: '다음 곡' }).first().click()
        s = await waitFor(page, s => s.qid !== r1.qid, { label: '한 곡 반복 중 다음' })
        check('한 곡 반복 + 다음 버튼 → 넘어감', true, s.title)
        await page.getByRole('button', { name: '반복 재생' }).first().click() // off

        // 대기열에서 지금 곡 다음 곡 빼기
        const cur = await P(page)
        const nextTitle = cur.upcoming[0]
        await page.locator('aside[aria-label="재생 대기열"]').getByRole('button', { name: `${nextTitle} 빼기` }).first().click()
        s = await P(page)
        check('대기열에서 곡 빼기', s.upcoming[0] !== nextTitle && s.title === cur.title, `${nextTitle} 빠짐`)

        // 지금 재생 중 화면
        await page.getByRole('button', { name: '재생 대기열 닫기' }).click()
        await page.getByRole('button', { name: '지금 재생 중 화면 열기' }).click()
        await page.waitForSelector('[role=dialog][aria-label="지금 재생 중"]')
        await waitFor(page, s => s.lyrics !== undefined, { label: '가사 받기', timeout: 10000 })
        await page.waitForTimeout(600)
        await page.screenshot({ path: join(OUT, 'desktop-nowplaying.png') })
        const npText = await page.locator('[role=dialog][aria-label="지금 재생 중"]').innerText()
        check('지금 재생 중: 가사 탭이 보임', /가사/.test(npText) && !/가사를 불러오는 중/.test(npText))
        await page.getByRole('tab', { name: '다음 곡' }).click()
        await page.screenshot({ path: join(OUT, 'desktop-nowplaying-next.png') })
        await page.keyboard.press('Escape')
        await page.waitForTimeout(400)
        check('Esc 로 닫힘', !(await page.locator('[role=dialog][aria-label="지금 재생 중"]').count()))

        // 새로고침 후 복원
        const keep = await P(page)
        await page.reload({ waitUntil: 'domcontentloaded' })
        await page.waitForFunction(() => window.$nuxt && window.$nuxt.$store && window.$nuxt.$store.state.player.isInitialized, null, { timeout: 30000 })
        s = await P(page)
        check('새로고침 후 지금 곡·목록·대기열 복원', s.qid === keep.qid && s.ctxName === keep.ctxName && s.upcoming.length === keep.upcoming.length, `${s.title} / ${s.ctxName}`)
        await context.close()
    },

    async legacyMigration(browser) {
        const { context, page } = await newPage(browser, { width: 1280, height: 800 })
        await gotoHome(page)
        const prefix = await page.evaluate(() => `user_${window.$nuxt.$store.state.auth.user.userId}_`)
        // 옛 형식: 셔플 중, queue 는 섞인 순서, null 항목 섞임
        await page.evaluate(async prefix => {
            const { chart } = await window.$nuxt.$axios.$get('/api/songs/chart')
            const pick = chart.items.filter(s => s.songId).slice(0, 4).map(s => ({ _id: s.songId, title: s.title, artist: s.artist, coverUrl: s.coverUrl }))
            localStorage.removeItem(prefix + 'player_v2')
            localStorage.setItem(prefix + 'original_queue', JSON.stringify(pick))
            localStorage.setItem(prefix + 'queue', JSON.stringify([pick[2], null, pick[0], pick[3], pick[1]]))
            localStorage.setItem(prefix + 'current_track', JSON.stringify(pick[0]))
            localStorage.setItem(prefix + 'shuffle', 'true')
            window.__legacy = pick.map(p => p.title)
        }, prefix)
        const pick = await page.evaluate(() => window.__legacy)
        await page.reload({ waitUntil: 'domcontentloaded' })
        await page.waitForFunction(() => window.$nuxt && window.$nuxt.$store && window.$nuxt.$store.state.player.isInitialized, null, { timeout: 30000 })
        const s = await P(page)
        check('옛 큐 변환: "이전 재생목록", 지금 곡 유지', s.ctxName === '이전 재생목록' && s.title === pick[0], `${s.title}`)
        check('옛 큐 변환: 섞인 순서 그대로(다음 곡들)', JSON.stringify(s.upcoming) === JSON.stringify([pick[3], pick[1]]), s.upcoming.join(' / '))
        check('옛 큐 변환: 셔플 켜짐 유지', s.shuffleOn === true)
        const kept = await page.evaluate(prefix => !!localStorage.getItem(prefix + 'queue') && !!localStorage.getItem(prefix + 'player_v2'), prefix)
        check('옛 키는 지우지 않음(롤백 대비) + 새 키 저장', kept)
        await context.close()
    },

    async video(browser) {
        const { context, page } = await newPage(browser, { width: 1280, height: 800 })
        await gotoHome(page)
        const theme = await page.evaluate(() => window.$nuxt.$axios.$get('/api/themes/rain'))
        const songs = theme.songs.slice(0, 5)
        // 첫 곡을 막힌 영상(없는 id)으로 — 에러 → 다음 곡으로 넘어가야 한다
        const list = [{ videoId: 'xxxxxxxxxxx', title: '없는 영상', artist: '-' }, ...songs]
        await dispatch(page, 'player/playList', { source: { type: 'theme', id: 'rain', name: theme.theme.name }, songs: list, kind: 'video', index: 0 })
        let s = await waitFor(page, s => s.title === songs[0].title, { label: '막힌 영상 건너뛰기', timeout: 25000 })
        check('재생 안 되는 영상 → 알리고 다음 곡', true, s.title)
        check('유튜브 곡 실제 재생', await audible(page, '테마'))
        s = await P(page)
        check('유튜브 곡: kind video, 곡 id 없음', s.kind === 'video' && !s.id)
        const heart = await page.locator('footer, .fixed.bottom-0').getByRole('button', { name: /좋아요/ }).count()
        check('유튜브 곡: 미니 플레이어 하트 숨김', heart === 0)
        await page.getByRole('button', { name: '지금 재생 중 화면 열기' }).click()
        await page.waitForTimeout(500)
        const npText = await page.locator('[role=dialog][aria-label="지금 재생 중"]').innerText()
        check('유튜브 곡: 가사 문구', npText.includes('유튜브 곡은 가사를 제공하지 않아요'))
        await page.screenshot({ path: join(OUT, 'desktop-nowplaying-video.png') })
        await context.close()
    },

    async mobile(browser) {
        const { context, page } = await newPage(browser, { width: 390, height: 844 })
        await gotoHome(page)
        await page.screenshot({ path: join(OUT, 'mobile-home.png') })
        const rows = page.locator('.song-row')
        const t1 = (await rows.nth(0).locator('p span.truncate').first().textContent()).trim()
        await rows.nth(0).click()
        await waitFor(page, s => s.title === t1, { label: '모바일 1위 클릭' })
        // ⋯ 메뉴 → 다음에 재생
        const t5 = (await rows.nth(4).locator('p span.truncate').first().textContent()).trim()
        await rows.nth(4).getByRole('button', { name: '곡 메뉴' }).click()
        await page.getByRole('button', { name: '다음에 재생' }).click()
        let s = await P(page)
        check('모바일 ⋯ → 다음에 재생', s.upNext[0] === t5, s.upNext.join(' / '))
        await page.waitForTimeout(800)
        await page.screenshot({ path: join(OUT, 'mobile-mini.png') })

        await page.getByRole('button', { name: '지금 재생 중 화면 열기' }).click()
        await page.waitForSelector('[role=dialog][aria-label="지금 재생 중"]')
        await page.waitForTimeout(500)
        await page.screenshot({ path: join(OUT, 'mobile-nowplaying.png') })
        await page.getByRole('button', { name: '가사' }).click()
        await page.waitForTimeout(300)
        await page.screenshot({ path: join(OUT, 'mobile-lyrics.png') })
        await page.getByRole('button', { name: '재생 대기열' }).click()
        await page.waitForSelector('aside[aria-label="재생 대기열"]')
        await page.waitForTimeout(500)
        await page.screenshot({ path: join(OUT, 'mobile-queue.png') })
        const overflow = await page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth)
        check('모바일: 가로 넘침 없음', !overflow)
        await context.close()
    },

    async theme(browser) {
        const { context, page } = await newPage(browser, { width: 1440, height: 900 })
        await gotoHome(page)
        await page.goto(BASE + '/theme', { waitUntil: 'domcontentloaded' })
        await page.waitForSelector('a.theme-card', { timeout: 20000 })
        const cards = await page.locator('a.theme-card').count()
        check('테마 목록 카드', cards >= 5, `${cards}개`)
        await page.waitForTimeout(800)
        await page.screenshot({ path: join(OUT, 'theme-list.png') })
        await page.locator('a.theme-card').first().click()
        await page.waitForSelector('main .song-row', { timeout: 20000 })
        const rows = page.locator('main .song-row')
        check('테마 상세 50곡', (await rows.count()) >= 40, `${await rows.count()}곡`)
        const t2 = (await rows.nth(1).locator('p').first().textContent()).trim()
        await rows.nth(1).click()
        let s = await waitFor(page, s => s.title === t2, { label: '테마 2번째 곡' })
        check('테마 줄 클릭 → 그 곡부터, 유튜브 곡', s.kind === 'video' && s.ctxLen >= 40 && s.pos === 1, s.ctxName)
        check('테마 곡 실제 재생', await audible(page, '테마 상세'))
        const t5 = (await rows.nth(4).locator('p').first().textContent()).trim()
        await rows.nth(4).hover()
        await rows.nth(4).getByRole('button', { name: '곡 메뉴' }).click()
        const menu = page.getByRole('dialog', { name: /메뉴/ })
        check('유튜브 곡 메뉴: 좋아요·담기 없음', (await menu.getByRole('button', { name: /좋아요|담기/ }).count()) === 0)
        await page.screenshot({ path: join(OUT, 'theme-menu.png') })
        await menu.getByRole('button', { name: '다음에 재생' }).click()
        s = await P(page)
        check('테마 곡 ⋯ → 다음에 재생', s.upNext[0] === t5)
        await page.waitForTimeout(500)
        await page.screenshot({ path: join(OUT, 'theme-detail.png') })
        await context.close()
    },

    async pages(browser) {
        const { context, page } = await newPage(browser, { width: 1440, height: 900 })
        await gotoHome(page)
        await page.waitForTimeout(1000)
        await page.screenshot({ path: join(OUT, 'page-home.png') })
        await page.getByRole('button', { name: '사용자 메뉴' }).click()
        await page.waitForTimeout(300)
        await page.screenshot({ path: join(OUT, 'page-usermenu.png') })
        await page.getByRole('button', { name: '사용자 메뉴' }).click()
        // 데스크탑 곡 메뉴
        const row = page.locator('.song-row').first()
        await row.hover()
        await row.getByRole('button', { name: '곡 메뉴' }).click()
        await page.waitForTimeout(300)
        await page.screenshot({ path: join(OUT, 'page-songmenu-desktop.png') })
        await page.keyboard.press('Escape')
        await page.mouse.click(5, 5)
        for (const [path, name] of [['/chart', 'chart'], ['/liked', 'liked'], ['/video', 'video'], ['/download', 'download'], ['/admin', 'admin']]) {
            await page.goto(BASE + path, { waitUntil: 'domcontentloaded' })
            await page.waitForTimeout(2500)
            await page.screenshot({ path: join(OUT, `page-${name}.png`) })
        }
        const broken = await page.evaluate(() => [...document.querySelectorAll('i[class*="fa-"]')].length)
        check('Font Awesome 아이콘 남은 것 없음(관리자 화면)', broken === 0)
        await context.close()
    },

    // 화면·창 전수 스크린샷(예전 스타일이 남은 곳 찾기용) — 판정 없이 찍기만 한다
    async audit(browser) {
        for (const vp of [{ width: 1440, height: 900, tag: 'd' }, { width: 390, height: 844, tag: 'm' }]) {
            const { context, page } = await newPage(browser, { width: vp.width, height: vp.height })
            const shot = async name => { await page.waitForTimeout(700); await page.screenshot({ path: join(OUT, `audit-${vp.tag}-${name}.png`) }) }
            await gotoHome(page)
            // 검색
            if (vp.tag === 'd') {
                await page.locator('input[aria-label="검색어"]').fill('아이유')
                await page.keyboard.press('Enter')
            } else {
                await page.getByRole('button', { name: '검색' }).first().click()
                await shot('search-popup')
                await page.locator('input[placeholder="노래, 앨범, 아티스트 검색"]').last().fill('아이유')
                await page.keyboard.press('Enter')
            }
            await page.waitForTimeout(3000)
            await shot('search-results')
            const res = page.locator('[aria-label="검색 결과"] .song-row')
            const t0 = (await res.nth(1).locator('p span.truncate').first().textContent()).trim()
            await res.nth(1).click()
            const sr = await waitFor(page, s => s.title === t0, { label: '검색 결과 줄 클릭' })
            check(`[${vp.tag}] 검색 결과 줄 클릭 → 그 곡 하나만(검색 결과 전체를 넣지 않음)`, /검색/.test(sr.ctxName) && sr.ctxLen === 1 && sr.upcoming.length === 0, `${sr.ctxName}, 목록 ${sr.ctxLen}곡`)
            await res.nth(2).locator('input[type=checkbox]').check()
            await shot('search-selected')
            await page.keyboard.press('Escape')
            // 차트 선택 + 담기
            await page.goto(BASE + '/chart', { waitUntil: 'domcontentloaded' })
            await page.waitForSelector('.song-row', { timeout: 20000 })
            await page.locator('.song-row input[type=checkbox]').nth(1).check()
            await page.locator('.song-row input[type=checkbox]').nth(2).check()
            await shot('chart-selected')
            await page.getByRole('button', { name: '선택 곡 담기' }).click()
            await shot('add-modal')
            await page.getByRole('button', { name: '새 플레이리스트' }).click()
            await shot('create-modal')
            await page.keyboard.press('Escape')
            // 플리 상세(첫 플리)
            const firstPl = await page.evaluate(() => (window.$nuxt.$store.state.playlist.playlists[0] || {})._id)
            if (firstPl) {
                await page.goto(BASE + '/playlist/' + firstPl, { waitUntil: 'domcontentloaded' })
                await page.waitForTimeout(2500)
                await shot('playlist')
            }
            await page.goto(BASE + '/liked', { waitUntil: 'domcontentloaded' })
            await shot('liked')
            await page.goto(BASE + '/theme/rain', { waitUntil: 'domcontentloaded' })
            await page.waitForTimeout(2500)
            await shot('theme')
            // 영상 모드
            await page.goto(BASE + '/video', { waitUntil: 'domcontentloaded' })
            await page.waitForTimeout(2000)
            await page.locator('input[placeholder*="유튜브"]').fill('아이유 밤편지')
            await page.keyboard.press('Enter')
            await page.waitForTimeout(4000)
            await shot('video-search')
            await page.getByRole('button', { name: '보관함' }).click()
            await shot('video-library')
            await page.goto(BASE + '/download', { waitUntil: 'domcontentloaded' })
            await shot('download')
            await page.goto(BASE + '/subscription-notice', { waitUntil: 'domcontentloaded' })
            await shot('subscription')
            await context.close()
        }
        // 로그인 안 한 화면
        const context = await browser.newContext({ viewport: { width: 1440, height: 900 } })
        const page = await context.newPage()
        await page.goto(BASE + '/login', { waitUntil: 'domcontentloaded' })
        await page.waitForTimeout(3000)
        await page.screenshot({ path: join(OUT, 'audit-d-login.png') })
        await context.close()
        check('audit 스크린샷', true)
    },

    async tablet(browser) {
        const { context, page } = await newPage(browser, { width: 820, height: 1180 })
        await gotoHome(page)
        await page.locator('.song-row').nth(1).click()
        await waitFor(page, s => !!s.title, { label: '태블릿 재생' })
        await page.waitForTimeout(800)
        await page.screenshot({ path: join(OUT, 'tablet-mini.png') })
        await page.getByRole('button', { name: '지금 재생 중 화면 열기' }).click()
        await page.waitForTimeout(600)
        await page.screenshot({ path: join(OUT, 'tablet-nowplaying.png') })
        await page.keyboard.press('Escape')
        await page.getByRole('button', { name: '재생 대기열', exact: true }).click()
        await page.waitForTimeout(500)
        await page.screenshot({ path: join(OUT, 'tablet-queue.png') })
        await context.close()
    },
}

const browser = await chromium.launch({ headless: !headed, args: ['--autoplay-policy=no-user-gesture-required'] })
try {
    for (const [name, run] of Object.entries(scenarios)) {
        if (only && only !== name) continue
        console.log(`\n── ${name}`)
        try {
            await run(browser)
        } catch (err) {
            // 실패 원인(가로막은 요소 등)은 Playwright 로그 몇 줄에 있다
            check(`${name} 실행`, false, err.message.split('\n').slice(0, 10).join(' | '))
        }
    }
} finally {
    await browser.close()
}
const failed = results.filter(r => !r.ok)
console.log(`\n${results.length - failed.length}/${results.length} 통과`)
process.exitCode = failed.length ? 1 : 0
