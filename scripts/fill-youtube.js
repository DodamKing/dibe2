/**
 * songs.jsonl 의 각 곡에 YouTube videoId를 붙여 songs-youtube.jsonl 로 적재. (DB 안 씀)
 *
 * 선택 로직은 server/services/songService.js 의 updateYoutubeUrls 와 **의도적으로 동일**하다.
 *   검색어 "{제목} {아티스트} official audio" → 2~6분짜리 첫 번째.
 * 채널을 공식 우선으로 점수화하는 안을 시험했다가 폐기했다. 공식 채널은 MV·직캠·라이브를
 * 올리는 곳이라 오히려 음원이 아닌 걸 집었고(15곡 중 MV 0건 → 4건, 아예 다른 곡까지),
 * 정작 음원은 재업로드 채널에 깔끔하게 올라와 있었다. "official audio"라는 검색어가
 * 낡은 게 아니라 음원 업로드를 노리는 장치였다. 상세는 docs/WORK_LOG.md 2026-07-16.
 *
 * 벅스와 다른 호스트라 enrich-songs.js 와 병렬로 돌려도 서로 영향이 없다.
 *
 * 사용법:
 *   node scripts/fill-youtube.js --limit 100 --dry-run
 *   node scripts/fill-youtube.js --limit 2000
 */
require('dotenv').config()

const fs = require('fs')
const path = require('path')
const readline = require('readline')
const YouTubeSearch = require('youtube-search-api')

const DATA_DIR = path.join(__dirname, '..', 'data')
const IN_FILE = path.join(DATA_DIR, 'songs.jsonl')
const OUT_FILE = path.join(DATA_DIR, 'songs-youtube.jsonl')

const arg = (n, d) => { const i = process.argv.indexOf('--' + n); return i !== -1 ? process.argv[i + 1] : d }
const has = n => process.argv.includes('--' + n)

const DRY_RUN = has('dry-run')
const LIMIT = parseInt(arg('limit', '0')) || 0
const FAIL_LIMIT = parseInt(arg('fail-limit', '5'))
// 유튜브는 벅스처럼 429/403을 던지는 대신 **빈 결과를 조용히 돌려주는** 식으로 막을 수 있다.
// 그러면 예외가 안 나서 위 FAIL_LIMIT이 안 걸리고, 전 곡을 videoId:null로 기록해 버린다.
// 그래서 "검색 결과 0개"가 연속되면 차단으로 보고 멈춘다. 실제 미스는 결과는 있는데
// 2~6분 조건에 안 맞는 경우라, 결과 자체가 0개인 게 연달아 나오는 건 정상이 아니다.
const EMPTY_LIMIT = parseInt(arg('empty-limit', '8'))
const MIN_DELAY = parseInt(arg('min-delay', '700'))
const MAX_DELAY = parseInt(arg('max-delay', '1500'))

const sleep = ms => new Promise(r => setTimeout(r, ms))
const jitter = () => MIN_DELAY + Math.floor(Math.random() * (MAX_DELAY - MIN_DELAY))
const key = s => `${s.title}|||${s.artist}`

// youtube-search-api 는 encodeURI 를 쓰는데 encodeURI 는 '#' 을 인코딩하지 않는다.
// 그래서 '#'부터 뒤가 전부 URL 프래그먼트로 잘려나가 search_query 가 통째로 비어버린다
// ("#첫사랑 볼빨간사춘기" → 검색어 ""). 제목에 # 있는 곡은 영원히 못 찾는다.
const stripHash = s => s.replace(/#/g, ' ').replace(/\s+/g, ' ').trim()

// 괄호 안 부기(아티스트 영문명·피처링·부제)가 검색을 죽이는 경우가 있다.
// 실측: "Learn To Love Jxxn(진) official audio" → 0건, "(진)" 빼면 5건.
// 다만 "사계 (Four Seasons)"처럼 괄호가 도움이 되는 경우도 있어서, 처음부터 빼지 않고
// 0건일 때만 폴백으로 쓴다.
const simplify = s => s.replace(/[([][^)\]]*[)\]]/g, ' ').replace(/\s+/g, ' ').trim()

// songService.js 와 동일
function parseDuration(simpleText) {
    if (!simpleText) return null
    const parts = simpleText.split(':').map(Number)
    if (parts.some(isNaN)) return null
    if (parts.length === 3) return parts[0] * 3600 + parts[1] * 60 + parts[2]
    if (parts.length === 2) return parts[0] * 60 + parts[1]
    return null
}

async function searchOnce(q) {
    const res = await YouTubeSearch.GetListByKeyword(q, false, 10)
    const items = res?.items || []
    for (const item of items) {
        const d = parseDuration(item.length?.simpleText)
        if (d === null) continue
        if (d >= 120 && d <= 360) {
            return { hit: { videoId: item.id, duration: item.length.simpleText, channel: item.channelTitle || '', vtitle: item.title || '' }, resultCount: items.length }
        }
    }
    // hit 없음과 "검색 결과 자체가 0개"는 구분해야 한다. 후자가 연속되면 차단 신호다.
    return { hit: null, resultCount: items.length }
}

async function findVideoId(song) {
    const q = stripHash(`${song.title} ${song.artist} official audio`)
    let r = await searchOnce(q)

    // 결과가 0건일 때만 괄호를 걷어내고 한 번 더. 잘 되는 쿼리는 건드리지 않으므로 회귀가 없고,
    // 추가 요청은 실패한 곡(실측 0.8%)에만 발생한다.
    if (r.resultCount === 0) {
        const q2 = stripHash(`${simplify(song.title)} ${simplify(song.artist)} official audio`)
        if (q2 && q2 !== q) {
            await sleep(jitter())
            return { ...await searchOnce(q2), retried: true }
        }
    }
    return r
}

async function readJsonl(file) {
    if (!fs.existsSync(file)) return []
    const out = []
    const rl = readline.createInterface({ input: fs.createReadStream(file), crlfDelay: Infinity })
    for await (const line of rl) if (line.trim()) out.push(JSON.parse(line))
    return out
}

async function main() {
    const songs = await readJsonl(IN_FILE)
    if (!songs.length) throw new Error(`${IN_FILE} 없음. aggregate-songs.js --out 을 먼저 돌릴 것`)

    // 못 찾은 곡도 기록해 둔다. 안 그러면 세션마다 같은 곡을 또 검색한다.
    // (프로덕션에선 lazy fill 이 재생 시점에 다시 시도하므로 손해가 아니다)
    const done = new Set((await readJsonl(OUT_FILE)).map(key))
    const pending = songs.filter(s => !done.has(key(s)))
    const todo = LIMIT ? pending.slice(0, LIMIT) : pending

    console.log(`전체 ${songs.length.toLocaleString()}곡 | 완료 ${done.size.toLocaleString()} | 남음 ${pending.length.toLocaleString()} | 이번 세션 ${todo.length.toLocaleString()}`)
    console.log(`검색어: "{제목} {아티스트} official audio" → 2~6분 첫 번째 (기존 로직과 동일)`)
    console.log(`간격 ${MIN_DELAY}~${MAX_DELAY}ms | dry-run: ${DRY_RUN}`)
    console.log(`예상 약 ${(todo.length * ((MIN_DELAY + MAX_DELAY) / 2 + 800) / 60000).toFixed(1)}분\n`)
    if (!todo.length) return console.log('할 일 없음.')

    const out = DRY_RUN ? null : fs.createWriteStream(OUT_FILE, { flags: 'a' })
    const st = { found: 0, missing: 0, failed: 0, empty: 0, retried: 0, rescued: 0 }
    const startedAt = Date.now()
    let consecutiveFails = 0
    let consecutiveEmpty = 0
    let stopReason = null

    for (const [i, song] of todo.entries()) {
        const label = `${song.title} - ${song.artist}`
        try {
            const { hit, resultCount, retried } = await findVideoId(song)
            consecutiveFails = 0
            if (retried) { st.retried++; if (hit) st.rescued++ }

            if (resultCount === 0) {
                st.empty++
                consecutiveEmpty++
                // 결과 0개가 연속 = 차단 신호. 여기서 안 멈추면 남은 곡 전부를
                // null로 기록해 버리고(재시도도 안 됨) 끝에 가서야 알게 된다.
                if (consecutiveEmpty >= EMPTY_LIMIT) {
                    stopReason = `검색 결과 0개가 연속 ${EMPTY_LIMIT}회 — 유튜브가 막았을 가능성이 높음. 기록 중단`
                    break
                }
            } else {
                consecutiveEmpty = 0
            }

            if (hit) st.found++; else st.missing++

            if (!DRY_RUN) out.write(JSON.stringify({
                title: song.title, artist: song.artist,
                videoId: hit ? hit.videoId : null,
            }) + '\n')

            if (DRY_RUN || (st.found + st.missing) % 25 === 0) {
                console.log(hit
                    ? `[${i + 1}/${todo.length}] ${label.slice(0, 38)} → ${hit.videoId} (${hit.duration}) ${hit.channel.slice(0, 16)}`
                    : `[${i + 1}/${todo.length}] ${label.slice(0, 38)} → 없음 (검색결과 ${resultCount}개)`)
            }
        } catch (err) {
            st.failed++
            console.error(`[!] ${label}: ${err.message}`)
            consecutiveFails++
            if (consecutiveFails >= FAIL_LIMIT) { stopReason = `연속 ${FAIL_LIMIT}회 에러 — 유튜브가 막았을 수 있음`; break }
        }
        await sleep(jitter())
    }

    if (!DRY_RUN) out.end()
    const elapsed = (Date.now() - startedAt) / 1000
    console.log(`\n=== 세션 종료 ===`)
    if (stopReason) console.log(`중단 사유: ${stopReason}`)
    console.log(`찾음 ${st.found} | 못 찾음 ${st.missing} | 에러 ${st.failed} | 검색결과 0개 ${st.empty}`)
    console.log(`성공률 ${(st.found / Math.max(st.found + st.missing, 1) * 100).toFixed(1)}%`)
    console.log(`단순화 재시도 ${st.retried}회 → 그중 ${st.rescued}곡 건짐`)
    // 흩어진 0건은 정상(그 곡이 유튜브에 없음). 연속으로 몰리면 EMPTY_LIMIT 이 잡는다.
    if (st.empty > 0) console.log(`  (검색결과 0개 ${st.empty}건 — 흩어져 있으면 정상, 연속이면 차단 신호)`)
    console.log(`소요 ${(elapsed / 60).toFixed(1)}분 | 곡당 ${Math.round(elapsed * 1000 / Math.max(todo.length, 1))}ms`)
    console.log(`누적 완료 ${done.size + st.found + st.missing} / ${songs.length}`)
    if (!DRY_RUN) console.log(`출력: ${OUT_FILE}`)
}

main().catch(err => { console.error(err); process.exit(1) })
