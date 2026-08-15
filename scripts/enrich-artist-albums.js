/**
 * artist-rows.jsonl 에 등장하는 앨범을 훑어 장르·스타일·유형·발매일을 받는다. (DB 안 씀)
 *
 * 곡이 아니라 **앨범 단위**로 도는 이유: 벅스는 장르를 트랙이 아니라 앨범에 붙이고,
 * 같은 앨범 곡이 여러 개라 곡 단위로 돌면 같은 페이지를 반복해서 받는다.
 * (306행 → 유니크 앨범 147개)
 *
 * `유형`/`발매일`까지 받는 이유: 같은 곡이 정규·OST 통합반·베스트반에 중복 수록되는데,
 * 어느 걸 남길지 **앨범명 문자열로 추측하면 틀린다**(`Guckkasten` vs
 * `Guckkasten (Before Regular Album)`). 유형·발매일이 있으면 근거로 고를 수 있다.
 *
 * 캐시를 디스크에 남겨서 재실행이 공짜가 되게 한다.
 *
 * 사용법:
 *   node scripts/enrich-artist-albums.js --dry-run
 *   node scripts/enrich-artist-albums.js
 */
require('dotenv').config()

const fs = require('fs')
const path = require('path')
const B = require('./lib/bugs')

const DATA_DIR = path.join(__dirname, '..', 'data')
const IN_FILE = path.join(DATA_DIR, 'artist-rows.jsonl')
const OUT_FILE = path.join(DATA_DIR, 'artist-albums.json')

const arg = (n, d) => { const i = process.argv.indexOf('--' + n); return i !== -1 ? process.argv[i + 1] : d }
const has = n => process.argv.includes('--' + n)

const DRY_RUN = has('dry-run')
const LIMIT = parseInt(arg('limit', '0')) || 0
const FAIL_LIMIT = parseInt(arg('fail-limit', '5'))

const client = B.createClient()

async function main() {
    if (!fs.existsSync(IN_FILE)) throw new Error(`${IN_FILE} 없음. 먼저 crawl-artist-tracks.js 를 돌릴 것`)
    const rows = fs.readFileSync(IN_FILE, 'utf8').split('\n').filter(Boolean).map(JSON.parse)

    // 앨범명은 로그용. 같은 albumId 는 앨범명도 같으므로 아무 행에서 가져와도 된다.
    const albums = new Map()
    for (const r of rows) if (r.albumId && !albums.has(r.albumId)) albums.set(r.albumId, r.album)

    let cache = {}
    try { cache = JSON.parse(fs.readFileSync(OUT_FILE, 'utf8')) } catch { }

    const pending = [...albums.keys()].filter(id => !cache[id])
    const todo = LIMIT ? pending.slice(0, LIMIT) : pending

    console.log(`행 ${rows.length} | 유니크 앨범 ${albums.size} | 캐시 ${Object.keys(cache).length} | 이번 세션 ${todo.length}`)
    console.log(`예상 약 ${(todo.length * 1.55 / 60).toFixed(1)}분 | dry-run: ${DRY_RUN}\n`)
    if (!todo.length) return console.log('할 일 없음.')

    let ok = 0, failed = 0, consecutiveFails = 0
    for (const [i, id] of todo.entries()) {
        try {
            const { data } = await client.get(B.albumUrl(id), { headers: client.h('https://music.bugs.co.kr/') })
            const info = B.parseAlbumDetail(data)
            cache[id] = info
            consecutiveFails = 0
            ok++
            if (!DRY_RUN && ok % 10 === 0) fs.writeFileSync(OUT_FILE, JSON.stringify(cache, null, 1))
            if (i % 10 === 0 || DRY_RUN) {
                console.log(`[${i + 1}/${todo.length}] ${(albums.get(id) || '').slice(0, 34)} → ${info.type || '?'} | ${info.releaseDate || '?'} | ${info.genre.join(',') || '장르없음'}`)
            }
        } catch (err) {
            failed++
            console.error(`[!] album ${id} (${albums.get(id)}): ${err.response?.status || err.message}`)
            consecutiveFails++
            // 차단당한 뒤에도 계속 두들기면 얻는 것 없이 상대 서버만 때린다.
            if (consecutiveFails >= FAIL_LIMIT) { console.error(`연속 ${FAIL_LIMIT}회 실패 — 중단`); break }
        }
        await B.sleep(B.jitter())
    }

    if (!DRY_RUN) fs.writeFileSync(OUT_FILE, JSON.stringify(cache, null, 1))
    const types = {}
    Object.values(cache).forEach(a => { types[a.type || '(없음)'] = (types[a.type || '(없음)'] || 0) + 1 })
    console.log(`\n=== 종료 === 성공 ${ok} | 실패 ${failed} | 누적 ${Object.keys(cache).length}/${albums.size}`)
    console.log(`유형 분포:`, types)
    console.log(`장르 없는 앨범: ${Object.values(cache).filter(a => !a.genre.length).length}개`)
    if (!DRY_RUN) console.log(`출력: ${OUT_FILE}`)
}

main().catch(err => { console.error(err); process.exit(1) })
