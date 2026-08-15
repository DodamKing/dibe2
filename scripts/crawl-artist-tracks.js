/**
 * 벅스 아티스트별 전곡 수집 → 원시 행을 JSONL로 적재. (DB 쓰기 없음)
 *
 * 차트 크롤러(crawl-bugs-charts.js)와 목적이 다르다. 저쪽은 "인기곡을 넓게",
 * 이쪽은 "특정 가수의 곡을 빠짐없이". 그래서 인기도(chartHits) 신호가 없다.
 *
 * 차트 크롤러와 같은 원칙: **받은 행을 그대로 적는다.** MR/Inst 제외나 중복 판정은
 * 다음 단계(filter-artist-songs.js)가 하므로, 기준을 바꿔도 재크롤링이 필요 없다.
 *
 * ⚠️ `artist` 는 **`.artist > a` 첫 번째**에서 뽑는다. 차트 크롤러와 같은 규칙이어야
 * `title+artist` 키가 맞아서 기존 DB와 중복 대조가 성립한다. 바꾸지 말 것.
 *
 * 사용법:
 *   node scripts/crawl-artist-tracks.js --search 국카스텐        # 아티스트 후보만 출력
 *   node scripts/crawl-artist-tracks.js --artist 80052013        # 전곡 수집
 *   node scripts/crawl-artist-tracks.js --artist 80052013,80078064 --dry-run
 */
require('dotenv').config()

const fs = require('fs')
const path = require('path')
const cheerio = require('cheerio')
const B = require('./lib/bugs')

const DATA_DIR = path.join(__dirname, '..', 'data')
const ROWS_FILE = path.join(DATA_DIR, 'artist-rows.jsonl')
const PROGRESS_FILE = path.join(DATA_DIR, 'artist-crawl-progress.json')

const arg = (n, d) => { const i = process.argv.indexOf('--' + n); return i !== -1 ? process.argv[i + 1] : d }
const has = n => process.argv.includes('--' + n)

const DRY_RUN = has('dry-run')
const SEARCH = arg('search', null)
const ARTISTS = (arg('artist', '') || '').split(',').map(s => s.trim()).filter(Boolean)
// 페이지가 0행이면 끝이지만, 벅스가 이상하게 굴 때 무한루프로 두들기지 않도록 상한을 둔다.
const MAX_PAGES = parseInt(arg('max-pages', '40'))

const client = B.createClient()

/** 아티스트 전용 검색. 통합검색은 곡·앨범에 딸린 무관한 아티스트까지 섞여 나와서 못 쓴다. */
async function searchArtists(q) {
    const url = `https://music.bugs.co.kr/search/artist?q=${encodeURIComponent(q)}`
    const { data } = await client.get(url, { headers: client.h('https://music.bugs.co.kr/') })
    const $ = cheerio.load(data)
    const out = []
    $('ul.artistList > li').each((i, el) => {
        const $el = $(el)
        const $a = $el.find('a[href*="/artist/"]').first()
        const id = (/\/artist\/(\d+)/.exec($a.attr('href') || '') || [])[1]
        if (!id) return
        // 이름 옆의 "그룹 (남성) 인디, 락/메탈" 같은 부가정보가 동명이인 구분에 결정적이라 같이 보여준다.
        const info = $el.text().trim().replace(/\s+/g, ' ')
            .replace(/아티스트 좋아/g, '').replace(/기타 기능/g, '').trim()
        out.push({ id, name: $a.attr('title') || $a.text().trim(), info })
    })
    return out
}

/**
 * 참여 아티스트 전체를 뽑는다.
 *
 * 벅스는 셀에 **대표 1명만** 링크로 보여주고, 나머지는 "아티스트 전체보기"(`a.more`)의
 * `onclick` 인자에 `이름||표시명||id||OK\n...` 로 밀어넣는다. 그래서 링크만 긁으면
 * 협업곡인지 알 수 없다(게다가 `.more` 자체가 `a` 라서 대표 이름이 두 번 세어진다).
 *
 * 이게 필요한 이유: 아티스트 페이지엔 **다른 사람 명의의 참여곡**이 섞인다
 * (하현우 페이지의 `HYBRID | 최강창민`). 대표 아티스트만 봐서는 우리 대상 가수가
 * 실제로 참여한 곡인지 판별할 수 없다.
 */
function parseArtists($cell) {
    // ⚠️ `a.artistTitle` 은 **협업곡 행에만** 붙는다. 단독 아티스트 행은 클래스 없는 평범한 `a` 라
    // `.artistTitle` 로만 찾으면 대부분의 행이 통째로 사라진다(실측: 306곡 → 24곡).
    const primary = ($cell.find('a.artistTitle').first().text()
        || $cell.find('a').not('.more').first().text()).trim()
    const onclick = $cell.find('a.more').attr('onclick') || ''
    const m = /openMultiArtistSearchResultPopLayer\(this,\s*'([^']*)'/.exec(onclick)
    if (!m) return { primary, all: primary ? [{ name: primary, id: null }] : [] }
    const all = m[1].split(/\\n|\n/).map(line => {
        const p = line.split('||')
        return p.length >= 3 ? { name: p[1].trim(), id: p[2].trim() } : null
    }).filter(Boolean)
    return { primary, all: all.length ? all : [{ name: primary, id: null }] }
}

/** 아티스트 트랙 목록 한 페이지. 끝을 넘기면 0행이 와서 그게 종료 신호가 된다. */
async function fetchTrackPage(artistId, page) {
    const url = `https://music.bugs.co.kr/artist/${artistId}/tracks?page=${page}`
    const { data } = await client.get(url, { headers: client.h(`https://music.bugs.co.kr/artist/${artistId}`) })
    const $ = cheerio.load(data)
    const rows = []
    $('table.list.trackList > tbody > tr').each((i, el) => {
        const $el = $(el)
        const { title, adult } = B.parseTitleCell($el.find('.title'))
        // 차트 크롤러와 동일 규칙(대표 아티스트) — 키(title+artist)가 맞아야 기존 DB와 대조가 된다.
        const { primary: artist, all } = parseArtists($el.find('.artist'))
        if (!title || !artist) return
        const coverUrl = $el.find('.thumbnail img').attr('src') || ''
        rows.push({
            sourceArtistId: artistId,
            trackId: $el.find('input[type=checkbox]').attr('value') || null,
            page,
            title, artist,
            // 참여 아티스트 전체. 협업곡 판별과 눈 검증에 쓴다(키에는 안 씀).
            artistsAll: all.map(a => a.name),
            // 대상 가수가 이 곡에 실제로 참여했는지. 대표 명의가 남이어도 여기로 걸러낸다.
            sourceInCredits: all.some(a => a.id === artistId),
            album: $el.find('.album').first().text().trim().replace(/\s+/g, ' '),
            albumId: B.albumIdFromCoverUrl(coverUrl),
            coverUrl,
            detailLink: ($el.find('.trackInfo').attr('href') || '').split('?')[0],
            adult,
        })
    })
    return rows
}

/** 한 아티스트 전곡. 중간에 실패하면 통째로 버린다 — 반쪽 기록이 파일에 남는 게 더 나쁘다. */
async function crawlArtist(artistId) {
    const all = []
    const seen = new Set()
    for (let page = 1; page <= MAX_PAGES; page++) {
        const rows = await fetchTrackPage(artistId, page)
        if (!rows.length) break
        // 페이징이 고장나 같은 페이지를 계속 주면 0행이 안 나온다. 중복 trackId 로도 끊는다.
        const fresh = rows.filter(r => r.trackId && !seen.has(r.trackId))
        if (!fresh.length) break
        fresh.forEach(r => seen.add(r.trackId))
        all.push(...fresh)
        console.log(`    page ${page} → ${rows.length}행 (신규 ${fresh.length})`)
        await B.sleep(B.jitter())
    }
    return all
}

const loadProgress = () => { try { return JSON.parse(fs.readFileSync(PROGRESS_FILE, 'utf8')) } catch { return {} } }

async function main() {
    if (SEARCH) {
        const list = await searchArtists(SEARCH)
        console.log(`\n"${SEARCH}" 아티스트 후보 ${list.length}명\n`)
        list.forEach((a, i) => console.log(`  [${i}] ${a.id}  ${a.info}`))
        console.log(`\n→ 맞는 id를 골라: node scripts/crawl-artist-tracks.js --artist <id>`)
        return
    }
    if (!ARTISTS.length) return console.log('--search <이름> 또는 --artist <id> 중 하나가 필요함')

    if (!DRY_RUN) fs.mkdirSync(DATA_DIR, { recursive: true })
    const progress = loadProgress()
    const out = DRY_RUN ? null : fs.createWriteStream(ROWS_FILE, { flags: 'a' })
    let total = 0

    for (const id of ARTISTS) {
        if (progress[id]) { console.log(`[skip] ${id} — 이미 수집함 (${progress[id].count}곡)`); continue }
        console.log(`\n[수집] artist ${id}`)
        try {
            const rows = await crawlArtist(id)
            if (!rows.length) { console.log(`  → 0곡. id가 맞는지 확인할 것`); continue }
            if (!DRY_RUN) {
                for (const r of rows) out.write(JSON.stringify(r) + '\n')
                progress[id] = { count: rows.length, name: rows[0].artist }
                fs.writeFileSync(PROGRESS_FILE, JSON.stringify(progress, null, 2))
            }
            total += rows.length
            console.log(`  → ${rows.length}곡 (대표 표기: ${rows[0].artist})`)
        } catch (err) {
            console.error(`  [!] 실패: ${err.response?.status || err.message} — 이 아티스트는 통째로 건너뜀`)
        }
        await B.sleep(B.jitter())
    }

    if (!DRY_RUN) out.end()
    console.log(`\n=== 종료 === 이번 세션 ${total}곡 | dry-run: ${DRY_RUN}`)
    if (!DRY_RUN) console.log(`출력: ${ROWS_FILE}`)
}

main().catch(err => { console.error(err); process.exit(1) })
