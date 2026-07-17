/**
 * 수집·보강한 곡을 DB에 적재한다. **파이프라인의 마지막 단계.**
 *
 *   songs.jsonl          기준(제목·아티스트·앨범·커버·detailLink·adult·chartHits·lastSeen)
 *   songs-enriched.jsonl genre / style 만 가져온다
 *   songs-youtube.jsonl  videoId → youtubeUrl
 *
 * ⚠️ chartHits/adult 는 **songs.jsonl(재집계본)에서** 가져온다. songs-enriched.jsonl 의
 * 집계 필드는 제목 정리 전 값이라 stale 하다(오르트구름 31 vs 33).
 *
 * lastChartedAt = songs.jsonl 의 `lastSeen`(실제 마지막 차트 등장월). 고정값을 박지 않는 이유:
 * 이 값이 크론의 처리 순서를 정하는데, 고정하면 12,632곡이 전부 "방금 차트에 올랐다"가 되어
 * 적재분 내부에 순서가 사라진다. 실제 등장월을 넣으면 **최근 곡부터** 자연스럽게 처리된다.
 * (내일 차트 크론이 찍는 now 가 여전히 제일 앞이라 신곡 우선은 그대로)
 *
 * lyrics 는 넣지 않는다 — 재생 시점 lazy fill + 크론(08:30)이 채운다.
 * genre 가 없으면 `[]`로 **닫아서** 넣는다. updateGenres 는 `$exists: false` 만 보므로
 * 빈 배열은 "찾아봤는데 없더라"로 취급되어 매일 재시도당하지 않는다.
 *
 * 사용법:
 *   node scripts/load-songs.js              # 분석만 (기본 dry-run)
 *   node scripts/load-songs.js --apply      # 실제 적재
 *   node scripts/load-songs.js --apply --limit 100   # 일부만 (시험)
 */
require('dotenv').config()

const fs = require('fs')
const path = require('path')
const readline = require('readline')
const mongoose = require('mongoose')
// 🔴 반드시 connectToMongoDB() 를 쓸 것. .env의 MONGODB_URI엔 DB 이름이 없어서
// mongoose.connect(process.env.MONGODB_URI)를 직접 부르면 조용히 test DB(유령)에 붙는다.
const db = require('../server/models')
const { connectToMongoDB } = require('../server/models')

const DATA_DIR = path.join(__dirname, '..', 'data')
const APPLY = process.argv.includes('--apply')
const arg = (n, d) => { const i = process.argv.indexOf('--' + n); return i !== -1 ? process.argv[i + 1] : d }
const LIMIT = parseInt(arg('limit', '0')) || 0
const BATCH = 1000

const key = (t, a) => `${t}|||${a}`

async function readJsonl(file) {
    if (!fs.existsSync(file)) throw new Error(`${file} 없음`)
    const out = []
    const rl = readline.createInterface({ input: fs.createReadStream(file), crlfDelay: Infinity })
    for await (const line of rl) if (line.trim()) out.push(JSON.parse(line))
    return out
}

/** "20260101" → Date. 차트 수집이 월 단위라 일자는 항상 01이다. */
function parseChartDate(yyyymmdd) {
    const s = String(yyyymmdd)
    if (!/^\d{8}$/.test(s)) return null
    return new Date(`${s.slice(0, 4)}-${s.slice(4, 6)}-${s.slice(6, 8)}T00:00:00Z`)
}

async function main() {
    const [songs, enriched, youtube] = await Promise.all([
        readJsonl(path.join(DATA_DIR, 'songs.jsonl')),
        readJsonl(path.join(DATA_DIR, 'songs-enriched.jsonl')),
        readJsonl(path.join(DATA_DIR, 'songs-youtube.jsonl')),
    ])

    const genreMap = new Map(enriched.map(s => [key(s.title, s.artist), s]))
    const ytMap = new Map(youtube.map(s => [key(s.title, s.artist), s.videoId]))

    console.log(`songs ${songs.length.toLocaleString()} | enriched ${enriched.length.toLocaleString()} | youtube ${youtube.length.toLocaleString()}`)

    await connectToMongoDB()
    if (mongoose.connection.readyState !== 1) throw new Error('MongoDB 연결 실패')

    // DB에 이미 있는 곡은 건너뛴다. aggregate 의 `existing` 을 믿지 않고 지금 다시 확인한다
    // (그 사이 차트 크론이 곡을 더 넣었을 수 있다).
    const dbKeys = new Set((await db.Song.find({}).select('title artist').lean()).map(s => key(s.title, s.artist)))
    console.log(`DB 기존곡 ${dbKeys.size.toLocaleString()}`)

    const docs = []
    const st = { skipExisting: 0, noGenre: 0, withYoutube: 0, adult: 0, noDetailLink: 0, noDate: 0 }

    for (const s of songs) {
        const k = key(s.title, s.artist)
        if (dbKeys.has(k)) { st.skipExisting++; continue }

        const enr = genreMap.get(k)
        const genre = enr?.genre || []
        const style = enr?.style || []
        if (!genre.length) st.noGenre++

        const videoId = ytMap.get(k)
        if (videoId) st.withYoutube++
        if (s.adult) st.adult++
        if (!s.detailLink) st.noDetailLink++

        const lastChartedAt = parseChartDate(s.lastSeen)
        if (!lastChartedAt) st.noDate++

        docs.push({
            title: s.title,
            artist: s.artist,
            album: s.album,
            coverUrl: s.coverUrl,
            detailLink: s.detailLink || undefined,
            adult: !!s.adult,
            chartHits: s.chartHits,
            lastChartedAt: lastChartedAt || undefined,
            // 빈 배열 = "찾아봤는데 없더라". updateGenres 의 재시도 대상($exists:false)에서 빠진다.
            genre,
            style,
            youtubeUrl: videoId ? `https://www.youtube.com/watch?v=${videoId}` : undefined,
            // lyrics 는 안 넣는다 — lazy fill + 크론이 채운다
        })
        if (LIMIT && docs.length >= LIMIT) break
    }

    console.log(`\n=== 적재 대상 ${docs.length.toLocaleString()}곡 ===`)
    console.log(`  DB에 이미 있어 건너뜀 ${st.skipExisting.toLocaleString()}`)
    console.log(`  장르 없음(빈 배열로 닫음) ${st.noGenre} | 19금 ${st.adult} | youtubeUrl 보유 ${st.withYoutube.toLocaleString()}`)
    console.log(`  detailLink 없음 ${st.noDetailLink}(가사 못 받는 곡) | lastSeen 파싱 실패 ${st.noDate}`)

    if (docs.length) {
        const sample = docs[0]
        console.log(`\n=== 샘플 (1번째) ===`)
        console.log(`  ${sample.title} - ${sample.artist}`)
        console.log(`  chartHits ${sample.chartHits} | lastChartedAt ${sample.lastChartedAt?.toISOString().slice(0, 10)}`)
        console.log(`  genre ${JSON.stringify(sample.genre)} | style ${JSON.stringify(sample.style)}`)
        console.log(`  youtubeUrl ${sample.youtubeUrl || '(없음 — lazy fill이 채움)'}`)
    }

    if (!APPLY) return console.log(`\n(dry-run — 실제로 넣으려면 --apply)`)

    console.log(`\n적재 시작...`)
    let inserted = 0
    for (let i = 0; i < docs.length; i += BATCH) {
        const chunk = docs.slice(i, i + BATCH)
        // ordered:false — 한 건이 실패해도 나머지는 들어간다
        const res = await db.Song.insertMany(chunk, { ordered: false })
        inserted += res.length
        console.log(`  ${inserted.toLocaleString()} / ${docs.length.toLocaleString()}`)
    }

    console.log(`\n=== 검증 ===`)
    const total = await db.Song.countDocuments()
    console.log(`  전체 곡 ${total.toLocaleString()}`)
    console.log(`  adult:true ${await db.Song.countDocuments({ adult: true })}`)
    console.log(`  youtubeUrl 보유 ${(await db.Song.countDocuments({ youtubeUrl: { $nin: [null, ''] } })).toLocaleString()}`)
    console.log(`  genre 필드 있음 ${(await db.Song.countDocuments({ genre: { $exists: true } })).toLocaleString()}`)
    console.log(`  lastChartedAt 있음 ${(await db.Song.countDocuments({ lastChartedAt: { $exists: true } })).toLocaleString()}`)
    console.log(`  오염 제목 ${await db.Song.countDocuments({ title: /^\[[^\]]+\]\s*\n/ })}건 (0이어야 함)`)

    // 크론이 실제로 어떤 순서로 집는지 (가사 대상 상위 5곡)
    console.log(`\n=== 가사 크론이 내일 처리할 순서 (상위 5) ===`)
    const next = await db.Song.find({
        lyrics: { $in: [null, ''] }, lyricsCheckedAt: { $exists: false },
        adult: { $ne: true }, detailLink: { $ne: null },
    }).sort({ lastChartedAt: -1, chartHits: -1 }).limit(5).select('title artist chartHits lastChartedAt').lean()
    next.forEach((s, i) => console.log(`  ${i + 1}. ${s.title} - ${s.artist} (${s.chartHits}회, ${s.lastChartedAt?.toISOString().slice(0, 7)})`))
}

main()
    .catch(err => { console.error(err); process.exitCode = 1 })
    .finally(() => mongoose.connection.close())
