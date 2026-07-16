/**
 * songs.jsonl 의 각 곡에 장르/스타일 + 가사를 채워 songs-enriched.jsonl 로 적재. (DB 안 씀)
 *
 * 곡 단위로 완결시켜서 한 줄씩 append 한다. 중간에 죽어도 그 줄까지 남고,
 * 재실행하면 이미 끝난 곡을 건너뛴다. 총 요청량이 크므로 --limit 으로 세션을 쪼개
 * 며칠에 걸쳐 돌리는 걸 전제로 한다.
 *
 * 앨범 캐시는 디스크에 남긴다. 안 그러면 세션마다 같은 앨범을 다시 받아 총량이 늘어난다.
 *
 * 사용법:
 *   node scripts/enrich-songs.js --limit 20 --dry-run   # 20곡 시험, 파일 안 씀
 *   node scripts/enrich-songs.js --limit 2000           # 이번 세션 2000곡
 *   node scripts/enrich-songs.js --skip-lyrics          # 장르만
 */
require('dotenv').config()

const fs = require('fs')
const path = require('path')
const readline = require('readline')
const B = require('./lib/bugs')

const DATA_DIR = path.join(__dirname, '..', 'data')
const IN_FILE = path.join(DATA_DIR, 'songs.jsonl')
const OUT_FILE = path.join(DATA_DIR, 'songs-enriched.jsonl')
const CACHE_FILE = path.join(DATA_DIR, 'album-cache.json')

const arg = (n, d) => { const i = process.argv.indexOf('--' + n); return i !== -1 ? process.argv[i + 1] : d }
const has = n => process.argv.includes('--' + n)

const DRY_RUN = has('dry-run')
const SKIP_LYRICS = has('skip-lyrics')
const LIMIT = parseInt(arg('limit', '0')) || 0
// 세션을 요청 수로 끊는다. 곡 수로 끊으면 앨범 캐시 적중률이 초반/후반에 달라
// 실제 요청량이 들쭉날쭉해진다.
const MAX_REQUESTS = parseInt(arg('max-requests', '0')) || 0
// 차단당한 뒤에도 계속 두들기면 얻는 것도 없이 상대 서버만 때린다. 감지하면 즉시 멈춘다.
const FAIL_LIMIT = parseInt(arg('fail-limit', '5'))
const MIN_DELAY = parseInt(arg('min-delay', '500'))
const MAX_DELAY = parseInt(arg('max-delay', '2000'))

const key = s => `${s.title}|||${s.artist}`

async function readJsonl(file) {
    if (!fs.existsSync(file)) return []
    const out = []
    const rl = readline.createInterface({ input: fs.createReadStream(file), crlfDelay: Infinity })
    for await (const line of rl) if (line.trim()) out.push(JSON.parse(line))
    return out
}

const loadCache = () => { try { return new Map(Object.entries(JSON.parse(fs.readFileSync(CACHE_FILE, 'utf8')))) } catch { return new Map() } }
const saveCache = c => fs.writeFileSync(CACHE_FILE, JSON.stringify(Object.fromEntries(c)))

async function main() {
    const songs = await readJsonl(IN_FILE)
    if (!songs.length) throw new Error(`${IN_FILE} 없음/빈 파일. aggregate-songs.js --out 을 먼저 돌릴 것`)

    const done = new Set((await readJsonl(OUT_FILE)).map(key))
    const pending = songs.filter(s => !done.has(key(s)))
    const todo = LIMIT ? pending.slice(0, LIMIT) : pending

    const cache = loadCache()
    const client = B.createClient()

    console.log(`전체 ${songs.length.toLocaleString()}곡 | 완료 ${done.size.toLocaleString()} | 남음 ${pending.length.toLocaleString()} | 이번 세션 ${todo.length.toLocaleString()}`)
    console.log(`앨범 캐시 ${cache.size.toLocaleString()}개 보유 | 가사 ${SKIP_LYRICS ? '건너뜀' : '포함'} | 간격 ${MIN_DELAY}~${MAX_DELAY}ms | dry-run: ${DRY_RUN}`)
    const reqPerSong = (SKIP_LYRICS ? 0 : 1) + 0.7
    console.log(`예상 요청 약 ${Math.round(todo.length * reqPerSong).toLocaleString()}회 / 약 ${(todo.length * reqPerSong * ((MIN_DELAY + MAX_DELAY) / 2 + 300) / 3600000).toFixed(1)}시간\n`)
    if (!todo.length) return console.log('할 일 없음.')

    const out = DRY_RUN ? null : fs.createWriteStream(OUT_FILE, { flags: 'a' })
    const st = { ok: 0, noAlbum: 0, noGenre: 0, noLyrics: 0, failed: 0, albumFetch: 0, lyricsFetch: 0 }
    const startedAt = Date.now()
    let requests = 0
    let consecutiveFails = 0
    let stopReason = null

    for (const [i, song] of todo.entries()) {
        if (MAX_REQUESTS && requests >= MAX_REQUESTS) { stopReason = `요청 상한 ${MAX_REQUESTS}회 도달`; break }
        const label = `${song.title} - ${song.artist}`
        try {
            // --- 장르/스타일 (앨범 페이지, 캐시) ---
            let genre = [], style = []
            const albumId = B.albumIdFromCoverUrl(song.coverUrl)
            if (!albumId) st.noAlbum++
            else {
                if (!cache.has(albumId)) {
                    const { data } = await client.get(B.albumUrl(albumId), { headers: client.h() })
                    cache.set(albumId, B.parseAlbumInfo(data))
                    st.albumFetch++; requests++
                    if (!DRY_RUN && st.albumFetch % 20 === 0) saveCache(cache)
                    await B.sleep(B.jitter(MIN_DELAY, MAX_DELAY))
                }
                ;({ genre, style } = cache.get(albumId))
                if (!genre.length) st.noGenre++
            }

            // --- 가사 (트랙 상세 페이지) ---
            let lyrics = ''
            if (!SKIP_LYRICS && song.detailLink) {
                const { data } = await client.get(song.detailLink, { headers: client.h(B.albumUrl(albumId || '')) })
                lyrics = B.parseLyrics(data)
                st.lyricsFetch++; requests++
                if (!lyrics) st.noLyrics++
                await B.sleep(B.jitter(MIN_DELAY, MAX_DELAY))
            }

            if (!DRY_RUN) out.write(JSON.stringify({ ...song, genre, style, lyrics }) + '\n')
            st.ok++
            consecutiveFails = 0
            if (st.ok % 25 === 0 || DRY_RUN) {
                console.log(`[${i + 1}/${todo.length}] 요청 ${requests} | ${label} → 장르 [${genre.join(',') || '-'}]${SKIP_LYRICS ? '' : ` | 가사 ${lyrics.length}자`}`)
            }
        } catch (err) {
            st.failed++
            const status = err.response?.status
            console.error(`[!] ${label}: ${status || err.message}`)

            // 429/403은 "그만 좀 해라"라는 명시적 신호다. 한 번만 봐도 즉시 멈춘다.
            if (status === 429 || status === 403) { stopReason = `차단 신호 감지 (HTTP ${status})`; break }

            consecutiveFails++
            if (consecutiveFails >= FAIL_LIMIT) { stopReason = `연속 ${FAIL_LIMIT}회 실패`; break }
            await B.sleep(B.jitter(MIN_DELAY, MAX_DELAY))
        }
    }

    if (!DRY_RUN) { out.end(); saveCache(cache) }

    const elapsed = (Date.now() - startedAt) / 1000
    console.log(`\n=== 세션 종료 ===`)
    if (stopReason) console.log(`중단 사유: ${stopReason}`)
    console.log(`성공 ${st.ok} | 실패 ${st.failed} | 앨범ID 없음 ${st.noAlbum} | 장르 없음 ${st.noGenre}${SKIP_LYRICS ? '' : ` | 가사 없음 ${st.noLyrics}`}`)
    console.log(`요청: 앨범 ${st.albumFetch} + 가사 ${st.lyricsFetch} = ${requests}회`)
    console.log(`앨범 캐시 적중 ${st.ok - st.albumFetch - st.noAlbum}회 절약 | 캐시 누적 ${cache.size}개`)
    console.log(`소요 ${(elapsed / 60).toFixed(1)}분 | 요청당 ${Math.round(elapsed * 1000 / Math.max(requests, 1))}ms | 곡당 요청 ${(requests / Math.max(st.ok, 1)).toFixed(2)}회`)
    console.log(`누적 완료 ${done.size + st.ok} / ${songs.length} (${((done.size + st.ok) / songs.length * 100).toFixed(1)}%)`)
    if (!DRY_RUN) console.log(`출력: ${OUT_FILE}`)
}

main().catch(err => { console.error(err); process.exit(1) })
