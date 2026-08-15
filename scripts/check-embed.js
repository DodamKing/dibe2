/**
 * 채택한 유튜브 영상이 **우리 앱에서 실제로 재생되는지** 확인한다. (DB 안 씀)
 *
 * 검색 결과에 떴다고 재생되는 게 아니다. 우리는 `youtube-nocookie` iframe 으로 트는데,
 *   - 영상이 삭제·비공개됨
 *   - 업로더가 **임베드를 차단**함  ← 영상은 살아 있는데 앱에서만 안 나온다
 *   - 지역 차단
 * 이면 재생이 실패한다. 특히 이번 채택분엔 팬 업로드가 많아 삭제 위험이 실재한다.
 *
 * oEmbed 로 확인한다. 검색이 아니라 가벼운 메타데이터 조회라 부담이 작다.
 *   200 → 임베드 가능      401/403 → 임베드 차단      404 → 없는 영상
 *
 * 못 트는 게 나오면 --swap 으로 같은 곡의 다음 후보로 자동 교체한다(같은 판정 기준을 통과한
 * 후보만). 대안이 없으면 적재에서 뺀다 — 재생이 안 되는 URL 은 없는 것보다 나쁘다.
 *
 * 사용법:
 *   node scripts/check-embed.js --limit 10
 *   node scripts/check-embed.js            # 전체 확인만
 *   node scripts/check-embed.js --swap     # 확인 + 실패분 교체/제외까지
 */
const fs = require('fs')
const path = require('path')
const https = require('https')

const DATA_DIR = path.join(__dirname, '..', 'data')
const YT_FILE = path.join(DATA_DIR, 'artist-youtube.jsonl')
const CACHE_FILE = path.join(DATA_DIR, 'embed-check.json')

const arg = (n, d) => { const i = process.argv.indexOf('--' + n); return i !== -1 ? process.argv[i + 1] : d }
const has = n => process.argv.includes('--' + n)
const LIMIT = parseInt(arg('limit', '0')) || 0
const SWAP = has('swap')
const MIN_DELAY = parseInt(arg('min-delay', '300'))
const MAX_DELAY = parseInt(arg('max-delay', '900'))

const sleep = ms => new Promise(r => setTimeout(r, ms))
const jitter = () => MIN_DELAY + Math.floor(Math.random() * (MAX_DELAY - MIN_DELAY))

function oembed(videoId) {
    const url = `https://www.youtube.com/oembed?url=${encodeURIComponent('https://www.youtube.com/watch?v=' + videoId)}&format=json`
    return new Promise(resolve => {
        const req = https.get(url, { headers: { 'User-Agent': 'Mozilla/5.0' } }, res => {
            res.resume()
            resolve(res.statusCode)
        })
        req.on('error', () => resolve(0))
        req.setTimeout(15000, () => { req.destroy(); resolve(0) })
    })
}

const rows = fs.readFileSync(YT_FILE, 'utf8').split('\n').filter(Boolean).map(JSON.parse)
let cache = {}
try { cache = JSON.parse(fs.readFileSync(CACHE_FILE, 'utf8')) } catch { }

async function main() {
    const targets = rows.filter(r => r.include && r.pick)
    const pending = targets.filter(r => !(r.pick in cache))
    const todo = LIMIT ? pending.slice(0, LIMIT) : pending

    console.log(`적재 대상 ${targets.length}곡 | 확인함 ${targets.length - pending.length} | 이번 세션 ${todo.length}`)
    console.log(`예상 약 ${(todo.length * ((MIN_DELAY + MAX_DELAY) / 2 + 400) / 60000).toFixed(1)}분 | swap: ${SWAP}\n`)

    let ok = 0, bad = 0
    for (const [i, r] of todo.entries()) {
        const code = await oembed(r.pick)
        cache[r.pick] = code
        if (code === 200) ok++
        else {
            bad++
            console.log(`[X] ${code}  ${r.title.slice(0, 30)}  ${r.pick}`)
        }
        if (i % 20 === 0) fs.writeFileSync(CACHE_FILE, JSON.stringify(cache))
        if (i % 40 === 0) console.log(`   ... ${i + 1}/${todo.length}`)
        await sleep(jitter())
    }
    fs.writeFileSync(CACHE_FILE, JSON.stringify(cache))
    console.log(`\n확인 ${ok + bad}건 — 재생 가능 ${ok} | 불가 ${bad}`)

    // 실패분 처리
    const failed = targets.filter(r => cache[r.pick] !== undefined && cache[r.pick] !== 200)
    if (!failed.length) return console.log('못 트는 영상 없음.')

    console.log(`\n=== 재생 불가 ${failed.length}곡 ===`)
    for (const r of failed) {
        // 같은 판정 기준을 통과한 후보만 대안으로 본다 — 급하다고 기준을 낮추면 틀린 게 들어간다.
        const alts = r.candidates.filter(c => c.videoId !== r.pick && c.titleMatch && c.artistMatch && !c.negative
            && (r.bugsDuration ? (c.diff != null && Math.abs(c.diff) <= 5) : c.durOk)
            && cache[c.videoId] !== 404 && cache[c.videoId] !== 401 && cache[c.videoId] !== 403)
            .sort((a, b) => (b.officialChannel - a.officialChannel) || (Math.abs(a.diff ?? 99) - Math.abs(b.diff ?? 99)))
        console.log(`  ${r.title.slice(0, 30).padEnd(31)} ${cache[r.pick]} → 대안 ${alts.length}개`)
        if (!SWAP) continue
        if (!alts.length) {
            r.include = false; r.decidedBy = 'system:embed-fail'
            r.decidedWhy = `채택 영상이 재생 불가(HTTP ${cache[r.pick]})이고 같은 기준을 통과하는 대안이 없어 적재에서 제외`
            console.log(`     → 제외`)
            continue
        }
        // 대안도 확인해야 한다. 확인 안 한 걸 넣으면 같은 문제를 반복한다.
        let picked = null
        for (const a of alts) {
            const code = cache[a.videoId] ?? await oembed(a.videoId)
            cache[a.videoId] = code
            await sleep(jitter())
            if (code === 200) { picked = a; break }
        }
        if (picked) {
            r.pick = picked.videoId; r.decidedBy = 'system:embed-swap'
            r.decidedWhy = `원래 채택 영상이 재생 불가라 같은 기준을 통과한 다음 후보로 교체: ${picked.vtitle}`
            console.log(`     → 교체: ${picked.vtitle.slice(0, 40)} [${picked.channel.slice(0, 18)}]`)
        } else {
            r.include = false; r.decidedBy = 'system:embed-fail'
            r.decidedWhy = '채택 영상과 대안 모두 재생 불가라 적재에서 제외'
            console.log(`     → 대안도 전부 재생 불가, 제외`)
        }
    }

    if (SWAP) {
        fs.writeFileSync(YT_FILE, rows.map(r => JSON.stringify(r)).join('\n') + '\n')
        fs.writeFileSync(CACHE_FILE, JSON.stringify(cache))
        console.log(`\n출력: ${YT_FILE}`)
    }
}

main().catch(e => { console.error(e); process.exit(1) })
