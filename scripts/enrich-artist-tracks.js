/**
 * artist-songs.jsonl 의 각 곡에 대해 트랙 상세를 받아 **가사 + 재생시간**을 적재. (DB 읽기만)
 *
 * 둘을 같이 받는 이유: **같은 페이지에 있다.** 따로 돌면 197요청을 두 번 낸다.
 *
 * 재생시간이 왜 중요한가: 유튜브 매칭의 고정 상한(2~6분)을 대체한다. 상한 방식은
 * 6분 넘는 곡(국카스텐 `Mandrake` 6:09, `Faust` 6:22)을 영영 못 찾고, 반대로 라이브·
 * 콘서트 영상이 통과한다(`이방인` → 온스테이지 라이브 4:08. 원곡은 3:53). 곡별 실제
 * 길이와 대조하면 둘 다 해결된다.
 *
 * ⚠️ 이 길이는 **벅스 음원 길이**지 유튜브 영상 길이가 아니다. 실제 재생은 유튜브라
 * 몇 초씩 어긋난다. 진행바·남은시간에 쓰면 안 되고, 목록 표시와 매칭 기준으로만 쓴다.
 *
 * 가사는 없을 수 있다(연주곡·미등록). 요청이 성공했는데 비어 있으면 `''` 로 **닫아서**
 * 기록한다 — 네트워크 실패(재시도 대상)와 구분해야 매일 재시도당하지 않는다.
 *
 * 사용법:
 *   node scripts/enrich-artist-tracks.js --limit 5 --dry-run
 *   node scripts/enrich-artist-tracks.js            # 전체 (재실행하면 끝낸 곡은 건너뜀)
 */
require('dotenv').config()

const fs = require('fs')
const path = require('path')
const cheerio = require('cheerio')
const B = require('./lib/bugs')

const DATA_DIR = path.join(__dirname, '..', 'data')
const IN_FILE = path.join(DATA_DIR, 'artist-songs.jsonl')
const OUT_FILE = path.join(DATA_DIR, 'artist-tracks.jsonl')

const arg = (n, d) => { const i = process.argv.indexOf('--' + n); return i !== -1 ? process.argv[i + 1] : d }
const has = n => process.argv.includes('--' + n)

const DRY_RUN = has('dry-run')
const LIMIT = parseInt(arg('limit', '0')) || 0
const FAIL_LIMIT = parseInt(arg('fail-limit', '5'))

const client = B.createClient()
const key = s => `${s.title}|||${s.artist}`

/** 트랙 상세의 `재생 시간 = 06:09` → 369초. 앨범 페이지의 값은 앨범 전체라 못 쓴다. */
function parseTrackDuration(html) {
    const $ = cheerio.load(html)
    let text = ''
    $('table.info tbody tr').each((i, el) => {
        if ($(el).find('th').text().trim() === '재생 시간') text = $(el).find('td').text().trim()
    })
    const m = /^(\d{1,2}):(\d{2})(?::(\d{2}))?$/.exec(text)
    if (!m) return { durationText: text, duration: null }
    const sec = m[3]
        ? (+m[1]) * 3600 + (+m[2]) * 60 + (+m[3])
        : (+m[1]) * 60 + (+m[2])
    return { durationText: text, duration: sec }
}

const readJsonl = f => fs.existsSync(f)
    ? fs.readFileSync(f, 'utf8').split('\n').filter(Boolean).map(JSON.parse) : []

async function main() {
    const songs = readJsonl(IN_FILE)
    if (!songs.length) throw new Error(`${IN_FILE} 없음. build-artist-songs.js 를 먼저 돌릴 것`)

    const done = new Set(readJsonl(OUT_FILE).map(key))
    const pending = songs.filter(s => !done.has(key(s)) && s.detailLink)
    const noLink = songs.filter(s => !s.detailLink)
    const todo = LIMIT ? pending.slice(0, LIMIT) : pending

    if (noLink.length) console.log(`⚠ detailLink 없는 곡 ${noLink.length}건 — 건너뜀`)
    console.log(`대상 ${songs.length}곡 | 완료 ${done.size} | 남음 ${pending.length} | 이번 세션 ${todo.length}`)
    console.log(`예상 약 ${(todo.length * 1.9 / 60).toFixed(1)}분 | dry-run: ${DRY_RUN}\n`)
    if (!todo.length) return console.log('할 일 없음.')

    const out = DRY_RUN ? null : fs.createWriteStream(OUT_FILE, { flags: 'a' })
    const st = { ok: 0, noLyrics: 0, noDuration: 0, failed: 0 }
    let consecutiveFails = 0, stopReason = null
    const startedAt = Date.now()

    for (const [i, song] of todo.entries()) {
        try {
            const { data } = await client.get(song.detailLink, { headers: client.h('https://music.bugs.co.kr/') })
            const { duration, durationText } = parseTrackDuration(data)
            const lyrics = B.parseLyrics(data)   // 없으면 '' — "찾아봤는데 없더라"
            consecutiveFails = 0
            st.ok++
            if (!lyrics) st.noLyrics++
            if (duration === null) st.noDuration++

            // 곡 하나가 끝날 때마다 적는다. 중간에 끊겨도 여기까지는 남고 재실행 시 건너뛴다.
            if (!DRY_RUN) out.write(JSON.stringify({
                title: song.title, artist: song.artist, trackId: song.trackId,
                duration, durationText, lyrics, adult: song.adult,
            }) + '\n')

            if (DRY_RUN || i % 20 === 0) {
                console.log(`[${i + 1}/${todo.length}] ${song.title.slice(0, 30)} → ${durationText || '길이?'} | 가사 ${lyrics ? lyrics.length + '자' : '없음'}`)
            }
        } catch (err) {
            st.failed++
            console.error(`[!] ${song.title}: ${err.response?.status || err.message}`)
            consecutiveFails++
            if (consecutiveFails >= FAIL_LIMIT) { stopReason = `연속 ${FAIL_LIMIT}회 실패 — 중단`; break }
        }
        await B.sleep(B.jitter())
    }

    if (!DRY_RUN) out.end()
    console.log(`\n=== 세션 종료 ===`)
    if (stopReason) console.log(`중단 사유: ${stopReason}`)
    console.log(`성공 ${st.ok} | 가사 없음 ${st.noLyrics} | 길이 못 읽음 ${st.noDuration} | 실패 ${st.failed}`)
    console.log(`소요 ${((Date.now() - startedAt) / 60000).toFixed(1)}분 | 누적 ${done.size + st.ok}/${songs.length}`)
    if (!DRY_RUN) console.log(`출력: ${OUT_FILE}`)
}

main().catch(err => { console.error(err); process.exit(1) })
