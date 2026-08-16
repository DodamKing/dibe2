/**
 * 아티스트별 수집분을 DB에 적재한다. **아티스트 파이프라인의 마지막 단계.**
 *
 *   artist-songs.jsonl    기준(제목·아티스트·앨범·커버·detailLink·adult·genre·style)
 *   artist-tracks.jsonl   trackId 로 조인 → duration / lyrics
 *   artist-youtube.jsonl  include && pick → youtubeUrl
 *
 * 차트용 `load-songs.js` 와 왜 따로 두는가 — 분기가 정반대다:
 *   ① 차트 적재는 가사를 안 넣고 크론에 맡기지만, 여기는 **트랙 상세를 이미 받아뒀으므로 같이 넣는다**
 *      (크론에 백로그를 새로 만들지 않는다)
 *   ② 차트 적재는 DB에 있는 곡을 **건너뛰지만**, 여기는 **갱신한다** — 기존 곡의 유튜브 URL을
 *      사람이 직접 검증해 고른 게 이번 산출물이기 때문이다
 *
 * 🔴 **유튜브 URL 이 없는 곡은 적재하지 않는다.** 이번 수집의 전제였다 —
 * 틀린 영상이 붙으면 재생 시 다른 노래가 나오므로 URL 이 비어 있는 것보다 나쁘고,
 * 애매한 건 아예 안 넣기로 했다. `artist-songs.jsonl` 에서 행을 지우는 대신 여기서 거른다.
 * **왜 빠졌는지가 `artist-youtube.jsonl` 의 `decidedWhy` 에 남아야** 나중에 되짚을 수 있다.
 *
 * `chartHits`/`lastChartedAt` 은 넣지 않는다 — 차트 수집분이 아니라 아티스트 전곡 수집이라
 * 차트 등장 이력 자체가 없다. 크론 정렬에서 뒤로 밀리지만, 가사·장르·URL 을 다 채워 넣으므로
 * 크론이 집을 일이 애초에 거의 없다.
 *
 * 사용법:
 *   node scripts/load-artist-songs.js              # 분석만 (기본 dry-run)
 *   node scripts/load-artist-songs.js --apply      # 실제 적재
 *   node scripts/load-artist-songs.js --apply --limit 10   # 일부만 (시험)
 */
require('dotenv').config()

const fs = require('fs')
const path = require('path')
const mongoose = require('mongoose')
// 🔴 반드시 connectToMongoDB() 를 쓸 것. .env의 MONGODB_URI엔 DB 이름이 없어서
// mongoose.connect(process.env.MONGODB_URI)를 직접 부르면 조용히 test DB(유령)에 붙는다.
const db = require('../server/models')
const { connectToMongoDB } = require('../server/models')

const DATA_DIR = path.join(__dirname, '..', 'data')
const APPLY = process.argv.includes('--apply')
const arg = (n, d) => { const i = process.argv.indexOf('--' + n); return i !== -1 ? process.argv[i + 1] : d }
const LIMIT = parseInt(arg('limit', '0')) || 0

const key = (t, a) => `${t}|||${a}`
const readJsonl = f => {
    const file = path.join(DATA_DIR, f)
    if (!fs.existsSync(file)) throw new Error(`${file} 없음`)
    return fs.readFileSync(file, 'utf8').split('\n').filter(Boolean).map(JSON.parse)
}

async function main() {
    const songs = readJsonl('artist-songs.jsonl')
    const tracks = readJsonl('artist-tracks.jsonl')
    const youtube = readJsonl('artist-youtube.jsonl')

    const trackMap = new Map(tracks.map(t => [String(t.trackId), t]))
    const ytMap = new Map(youtube.filter(r => r.include && r.pick).map(r => [key(r.title, r.artist), r.pick]))
    // 곡 목록에 없는 include 행 = 이미 DB에 있던 곡. URL 만 갱신 대상이다.
    const songKeys = new Set(songs.map(s => key(s.title, s.artist)))
    const existingOnly = youtube.filter(r => r.include && r.pick && !songKeys.has(key(r.title, r.artist)))

    console.log(`곡 목록 ${songs.length} | 트랙 상세 ${tracks.length} | 유튜브 확정 ${ytMap.size} (그중 기존 DB 곡 ${existingOnly.length})`)

    await connectToMongoDB()
    if (mongoose.connection.readyState !== 1) throw new Error('MongoDB 연결 실패')

    // 이번에 건드릴 곡만 조회한다(전체 스캔 대신). 갱신 여부를 값으로 판단해야 해서 필드까지 받는다.
    const targets = [...songs.map(s => ({ title: s.title, artist: s.artist })),
    ...existingOnly.map(r => ({ title: r.title, artist: r.artist }))]
    const found = await db.Song.find({ $or: targets }).select('title artist lyrics duration youtubeUrl').lean()
    const dbMap = new Map(found.map(d => [key(d.title, d.artist), d]))
    console.log(`DB 조회 ${targets.length}건 중 이미 있는 곡 ${dbMap.size}`)

    const inserts = []
    const updates = []
    const st = { noYoutube: 0, noTrack: 0, noLyrics: 0, noGenre: 0, urlChanged: 0, urlSame: 0, lyricsKept: 0 }

    for (const s of songs) {
        const k = key(s.title, s.artist)

        // 🔴 URL 없는 곡은 여기서 끊는다 (사람이 제외한 곡 + 스크립트가 근거 부족으로 뺀 곡).
        const videoId = ytMap.get(k)
        if (!videoId) { st.noYoutube++; continue }
        const youtubeUrl = `https://www.youtube.com/watch?v=${videoId}`

        const t = trackMap.get(String(s.trackId))
        if (!t) st.noTrack++
        // 가사를 못 받은 곡은 마커(lyricsCheckedAt)를 찍지 않는다 — 원래 없는 건지 크롤링 실패인지
        // 구분이 안 되므로, 크론이 자연히 재시도하게 둔다(6곡뿐이라 백로그가 되지 않는다).
        const lyrics = t?.lyrics || undefined
        if (!lyrics) st.noLyrics++
        const duration = t?.duration ?? undefined

        // 빈 배열 = "찾아봤는데 없더라". updateGenres 의 재시도 대상($exists:false)에서 빠진다.
        const genre = s.genre || []
        const style = s.style || []
        if (!genre.length) st.noGenre++

        const cur = dbMap.get(k)
        if (cur) {
            // 이미 있는 곡 — 사람이 검증한 URL 과 이번에 받은 길이/가사만 얹는다.
            // 가사는 **DB 값이 있으면 그대로 둔다**(이미 채워진 걸 굳이 갈아끼우지 않는다).
            const set = { youtubeUrl }
            if (duration != null) set.duration = duration
            if (lyrics && !cur.lyrics) set.lyrics = lyrics; else if (lyrics) st.lyricsKept++
            cur.youtubeUrl === youtubeUrl ? st.urlSame++ : st.urlChanged++
            updates.push({ _id: cur._id, title: s.title, set })
        } else {
            inserts.push({
                title: s.title,
                artist: s.artist,
                album: s.album,
                coverUrl: s.coverUrl,
                detailLink: s.detailLink || undefined,
                adult: !!s.adult,
                genre,
                style,
                duration,
                lyrics,
                youtubeUrl,
            })
        }
        if (LIMIT && inserts.length + updates.length >= LIMIT) break
    }

    // 기존 DB 곡 — 곡 목록엔 없으므로 URL 만 갱신한다(길이·가사는 이번에 받은 게 없다).
    for (const r of existingOnly) {
        const cur = dbMap.get(key(r.title, r.artist))
        if (!cur) { console.log(`  [!] DB에 없는 기존곡: ${r.title} — 건너뜀`); continue }
        const youtubeUrl = `https://www.youtube.com/watch?v=${r.pick}`
        cur.youtubeUrl === youtubeUrl ? st.urlSame++ : st.urlChanged++
        if (cur.youtubeUrl !== youtubeUrl) updates.push({ _id: cur._id, title: r.title, set: { youtubeUrl } })
    }

    console.log(`\n=== 신규 적재 ${inserts.length}곡 / 갱신 ${updates.length}곡 ===`)
    console.log(`  URL 없어 제외 ${st.noYoutube}곡 (곡 목록엔 남아 있고 적재만 안 한다)`)
    console.log(`  트랙 상세 못 찾음 ${st.noTrack} | 가사 없음 ${st.noLyrics} | 장르 없음(빈 배열로 닫음) ${st.noGenre}`)
    console.log(`  URL 바뀜 ${st.urlChanged} | 이미 같음 ${st.urlSame} | 기존 가사 유지 ${st.lyricsKept}`)

    if (inserts.length) {
        const s = inserts[0]
        console.log(`\n=== 샘플 (신규 1번째) ===`)
        console.log(`  ${s.title} - ${s.artist} | ${s.album}`)
        console.log(`  duration ${s.duration}초 | genre ${JSON.stringify(s.genre)} | style ${JSON.stringify(s.style)}`)
        console.log(`  lyrics ${s.lyrics ? s.lyrics.length + '자' : '(없음 — 크론이 재시도)'} | ${s.youtubeUrl}`)
    }
    if (updates.length) {
        console.log(`\n=== 갱신 목록 ===`)
        updates.forEach(u => console.log(`  ${u.title.padEnd(34)} ${Object.keys(u.set).join(', ')}`))
    }

    if (!APPLY) return console.log(`\n(dry-run — 실제로 넣으려면 --apply)`)

    console.log(`\n적재 시작...`)
    if (inserts.length) {
        // ordered:false — 한 건이 실패해도 나머지는 들어간다
        const res = await db.Song.insertMany(inserts, { ordered: false })
        console.log(`  신규 ${res.length}곡 삽입`)
    }
    if (updates.length) {
        const res = await db.Song.bulkWrite(updates.map(u => ({
            updateOne: { filter: { _id: u._id }, update: { $set: u.set } },
        })))
        console.log(`  기존 ${res.modifiedCount}곡 갱신`)
    }

    console.log(`\n=== 검증 ===`)
    // 🔴 아티스트 이름으로 긁으면 안 된다 — 같은 가수의 **기존 차트 수집분**이 섞여
    // "URL 없음 29" 같은 숫자가 나와 이번 적재가 실패한 것처럼 보인다(실제론 무관한 곡들).
    // 이번에 넣거나 고친 곡만 키로 다시 조회한다.
    const touched = [...inserts.map(d => ({ title: d.title, artist: d.artist })),
    ...existingOnly.map(r => ({ title: r.title, artist: r.artist }))]
    const mine = await db.Song.find({ $or: touched }).select('title artist duration lyrics youtubeUrl').lean()
    console.log(`  이번 적재분 ${mine.length} (기대 ${touched.length})`)
    console.log(`  그중 youtubeUrl 없음 ${mine.filter(s => !s.youtubeUrl).length} (0이어야 한다)`)
    console.log(`  duration 있음 ${mine.filter(s => s.duration != null).length} | 가사 있음 ${mine.filter(s => s.lyrics).length}`)
    console.log(`  전체 곡 ${(await db.Song.countDocuments()).toLocaleString()}`)

    // 한 영상이 두 곡에 붙으면 하나는 반드시 틀린 곡이다. 적재 후에 다시 확인한다.
    const dup = {}
    mine.forEach(s => { if (s.youtubeUrl) dup[s.youtubeUrl] = (dup[s.youtubeUrl] || 0) + 1 })
    const shared = Object.entries(dup).filter(([, n]) => n > 1)
    console.log(`  같은 영상을 쓰는 곡 ${shared.length}건 (0이어야 한다)`)
    shared.forEach(([url]) => console.log(`    ${url} ← ${mine.filter(s => s.youtubeUrl === url).map(s => s.title).join(' / ')}`))
}

main()
    .catch(err => { console.error(err); process.exitCode = 1 })
    .finally(() => mongoose.connection.close())
