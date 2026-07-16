/**
 * 벅스 장르 차트 수집 → 원시 행을 JSONL로 적재. (DB 쓰기 없음)
 *
 * 집계하지 않고 받은 행을 그대로 적는다. 인기도 기준이나 중복 키 정의를 나중에
 * 바꾸고 싶어져도 재크롤링 없이 집계만 다시 하면 되기 때문(scripts/aggregate-songs.js).
 *
 * 진행 상황을 페이지(장르+날짜) 단위로 남겨서 중단/재개해도 같은 페이지를 두 번 받지 않는다.
 * 총 요청량이 커서 한 번에 몰지 말고 --limit으로 세션을 쪼개 며칠에 걸쳐 돌리는 걸 전제로 한다.
 *
 * 사용법:
 *   node scripts/crawl-bugs-charts.js --genres nb,nid --from 202401 --to 202403 --dry-run
 *   node scripts/crawl-bugs-charts.js --limit 100          # 이번 세션 100페이지만
 *   node scripts/crawl-bugs-charts.js --period week        # 주단위(기본 월단위)
 */
require('dotenv').config()

const fs = require('fs')
const path = require('path')
const axios = require('axios')
const cheerio = require('cheerio')
const B = require('./lib/bugs')

// 국내 장르만. 코드는 벅스 차트 페이지의 링크 경로에서 확인한 값.
const GENRES = {
    nb: '발라드', ndp: '댄스/팝', nid: '아이돌', nrh: '랩/힙합', nrs: '알앤비/소울',
    nkelec: '일렉트로닉', nkrock: '락/메탈', nkjazz: '재즈', nindie: '인디',
    ntrot: '성인가요', nfa: '포크/어쿠스틱',
}

// 2019-10 이전 날짜는 가장 오래된 차트로 폴백된다(같은 데이터가 중복될 뿐이라 긁을 가치 없음).
const EARLIEST = '201910'

const DATA_DIR = path.join(__dirname, '..', 'data')
const ROWS_FILE = path.join(DATA_DIR, 'bugs-chart-rows.jsonl')
const PROGRESS_FILE = path.join(DATA_DIR, 'bugs-crawl-progress.json')

const arg = (name, def) => {
    const i = process.argv.indexOf('--' + name)
    return i !== -1 ? process.argv[i + 1] : def
}
const has = name => process.argv.includes('--' + name)

const DRY_RUN = has('dry-run')
const PERIOD = arg('period', 'month')
const LIMIT = parseInt(arg('limit', '0')) || 0
const FROM = arg('from', EARLIEST)
const TO = arg('to', null)
const GENRE_LIST = arg('genres', Object.keys(GENRES).join(',')).split(',').filter(g => GENRES[g])

// 지터. 정확히 N초 간격은 그 자체로 강한 봇 신호라 매번 흔든다.
const MIN_DELAY = parseInt(arg('min-delay', '500'))
const MAX_DELAY = parseInt(arg('max-delay', '2000'))
const sleep = ms => new Promise(r => setTimeout(r, ms))
const jitter = () => MIN_DELAY + Math.floor(Math.random() * (MAX_DELAY - MIN_DELAY))

const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36'

// 받은 쿠키를 물고 다닌다. 진짜 브라우저는 세션을 유지하는데 매번 새 세션으로 붙으면 티가 난다.
let cookieJar = ''
const client = axios.create({ timeout: 20000 })
client.interceptors.response.use(res => {
    const sc = res.headers['set-cookie']
    if (sc) cookieJar = sc.map(c => c.split(';')[0]).join('; ')
    return res
})

function headers(referer) {
    const h = {
        'User-Agent': UA,
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
        'Accept-Language': 'ko-KR,ko;q=0.9,en-US;q=0.8,en;q=0.7',
        'Referer': referer || 'https://music.bugs.co.kr/chart',
    }
    if (cookieJar) h.Cookie = cookieJar
    return h
}

function buildDates() {
    const out = []
    const startY = +FROM.slice(0, 4), startM = +FROM.slice(4, 6)
    const end = TO ? new Date(+TO.slice(0, 4), +TO.slice(4, 6) - 1, 1) : new Date(2026, 6, 1)
    let d = new Date(startY, startM - 1, 1)
    while (d <= end) {
        const y = d.getFullYear(), m = String(d.getMonth() + 1).padStart(2, '0'), day = String(d.getDate()).padStart(2, '0')
        out.push(`${y}${m}${day}`)
        if (PERIOD === 'week') d.setDate(d.getDate() + 7)
        else d.setMonth(d.getMonth() + 1)
    }
    return out
}

const loadProgress = () => {
    try { return new Set(JSON.parse(fs.readFileSync(PROGRESS_FILE, 'utf8'))) } catch { return new Set() }
}
const saveProgress = done => fs.writeFileSync(PROGRESS_FILE, JSON.stringify([...done]))

async function fetchChart(genre, date) {
    const url = `https://music.bugs.co.kr/chart/track/day/${genre}?chartdate=${date}`
    const { data } = await client.get(url, { headers: headers('https://music.bugs.co.kr/chart') })
    const $ = cheerio.load(data)
    const rows = []
    $('.list > tbody > tr').each((i, el) => {
        const $el = $(el)
        const { title, adult } = B.parseTitleCell($el.find('.title'))
        const artist = $el.find('.artist > a').first().text().trim()
        if (!title || !artist) return
        rows.push({
            genre, date,
            rank: +$el.find('.ranking > strong').text().trim() || null,
            title, artist,
            album: $el.find('.album').text().trim(),
            coverUrl: $el.find('.thumbnail > img').attr('src') || '',
            detailLink: $el.find('.trackInfo').attr('href') || '',
            adult,
        })
    })
    return rows
}

async function main() {
    if (!DRY_RUN) fs.mkdirSync(DATA_DIR, { recursive: true })

    const dates = buildDates()
    const done = loadProgress()
    const pages = []
    for (const g of GENRE_LIST) for (const d of dates) {
        if (!done.has(`${g}|${d}`)) pages.push([g, d])
    }
    const todo = LIMIT ? pages.slice(0, LIMIT) : pages

    console.log(`장르 ${GENRE_LIST.length}개 × 날짜 ${dates.length}개(${PERIOD}) = 총 ${GENRE_LIST.length * dates.length}페이지`)
    console.log(`이미 받음 ${done.size} | 남음 ${pages.length} | 이번 세션 ${todo.length}`)
    console.log(`간격 ${MIN_DELAY}~${MAX_DELAY}ms 랜덤 | dry-run: ${DRY_RUN}`)
    console.log(`예상 소요 약 ${Math.round(todo.length * ((MIN_DELAY + MAX_DELAY) / 2 + 300) / 60000)}분\n`)
    if (!todo.length) return console.log('받을 페이지 없음.')

    const out = DRY_RUN ? null : fs.createWriteStream(ROWS_FILE, { flags: 'a' })
    let rowCount = 0, pageCount = 0, failed = 0

    for (const [genre, date] of todo) {
        try {
            const rows = await fetchChart(genre, date)
            if (!DRY_RUN) for (const r of rows) out.write(JSON.stringify(r) + '\n')
            rowCount += rows.length
            pageCount++
            done.add(`${genre}|${date}`)
            if (!DRY_RUN && pageCount % 10 === 0) saveProgress(done)
            console.log(`[${pageCount}/${todo.length}] ${GENRES[genre]} ${date} → ${rows.length}행`)
        } catch (err) {
            failed++
            console.error(`[!] ${GENRES[genre]} ${date} 실패: ${err.response?.status || err.message}`)
        }
        await sleep(jitter())
    }

    if (!DRY_RUN) { out.end(); saveProgress(done) }
    console.log(`\n=== 세션 종료 ===`)
    console.log(`페이지 ${pageCount} | 수집행 ${rowCount} | 실패 ${failed}`)
    console.log(`누적 진행 ${done.size} / ${GENRE_LIST.length * dates.length} 페이지`)
    if (!DRY_RUN) console.log(`출력: ${ROWS_FILE}`)
}

main().catch(err => { console.error(err); process.exit(1) })
