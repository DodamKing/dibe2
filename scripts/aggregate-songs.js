/**
 * 수집한 원시 차트 행(JSONL) → 유니크 곡 목록으로 집계. (DB 읽기만, 쓰기 없음)
 *
 * 중복은 버리는 게 아니라 세어서 인기도로 쓴다. 차트 중복률이 80%대라
 * "몇 번 등장했나"가 그대로 인기 신호가 된다.
 *
 * 키는 title+artist. 기존 곡도 helper.js의 같은 추출 로직으로 저장됐으므로 키가 맞는다.
 *
 * 사용법:
 *   node scripts/aggregate-songs.js                 # 통계만
 *   node scripts/aggregate-songs.js --top 10000 --out data/songs.jsonl
 */
require('dotenv').config()

const fs = require('fs')
const path = require('path')
const readline = require('readline')
const mongoose = require('mongoose')
const { connectToMongoDB, Song } = require('../server/models')

const DATA_DIR = path.join(__dirname, '..', 'data')
const ROWS_FILE = path.join(DATA_DIR, 'bugs-chart-rows.jsonl')

const arg = (n, d) => { const i = process.argv.indexOf('--' + n); return i !== -1 ? process.argv[i + 1] : d }
const TOP = parseInt(arg('top', '0')) || 0
const OUT = arg('out', null)

const GENRE_NAMES = {
    nb: '발라드', ndp: '댄스/팝', nid: '아이돌', nrh: '랩/힙합', nrs: '알앤비/소울',
    nkelec: '일렉트로닉', nkrock: '락/메탈', nkjazz: '재즈', nindie: '인디',
    ntrot: '성인가요', nfa: '포크/어쿠스틱',
}

const key = (title, artist) => `${title}|||${artist}`

async function main() {
    if (!fs.existsSync(ROWS_FILE)) throw new Error(`${ROWS_FILE} 없음. 먼저 crawl-bugs-charts.js를 돌릴 것`)

    // 1) 원시 행 집계
    const songs = new Map()
    let rowCount = 0
    const rl = readline.createInterface({ input: fs.createReadStream(ROWS_FILE), crlfDelay: Infinity })
    for await (const line of rl) {
        if (!line.trim()) continue
        const r = JSON.parse(line)
        rowCount++
        const k = key(r.title, r.artist)
        let s = songs.get(k)
        if (!s) {
            s = {
                title: r.title, artist: r.artist, album: r.album,
                coverUrl: r.coverUrl, detailLink: r.detailLink,
                adult: false,
                chartHits: 0, bestRank: 999, chartGenres: new Set(),
                firstSeen: r.date, lastSeen: r.date,
            }
            songs.set(k, s)
        }
        // 19금은 한 번이라도 배지가 붙었으면 19금이다. 벅스가 나중에 배지를 붙인 경우
        // 같은 곡의 옛 행엔 배지가 없어서, 행 하나만 보면 놓친다.
        if (r.adult) s.adult = true
        s.chartHits++
        if (r.rank && r.rank < s.bestRank) s.bestRank = r.rank
        s.chartGenres.add(r.genre)
        if (r.date < s.firstSeen) s.firstSeen = r.date
        if (r.date > s.lastSeen) s.lastSeen = r.date
    }

    // 2) 기존 DB와 대조 (읽기만)
    await connectToMongoDB()
    if (mongoose.connection.readyState !== 1) throw new Error('MongoDB 연결 실패')
    const dbSongs = await Song.find({}).select('title artist').lean()
    const dbKeys = new Set(dbSongs.map(s => key(s.title, s.artist)))

    let existing = 0
    for (const [k, s] of songs) {
        s.existing = dbKeys.has(k)
        if (s.existing) existing++
    }

    // 3) 인기순(차트 등장 횟수) 정렬
    const list = [...songs.values()].sort((a, b) => b.chartHits - a.chartHits || a.bestRank - b.bestRank)
    const fresh = list.filter(s => !s.existing)

    console.log(`=== 집계 ===`)
    console.log(`원시 행 ${rowCount.toLocaleString()} → 유니크 곡 ${songs.size.toLocaleString()} (중복률 ${(100 - songs.size / rowCount * 100).toFixed(0)}%)`)
    console.log(`DB 기존곡 ${dbSongs.length.toLocaleString()} | 그중 이번 수집과 겹침 ${existing.toLocaleString()}`)
    console.log(`→ 신규 곡 ${fresh.length.toLocaleString()}`)

    console.log(`\n=== 등장 횟수 분포 (신규만) ===`)
    for (const t of [1, 2, 5, 10, 20]) {
        console.log(`  ${String(t).padStart(2)}회 이상: ${fresh.filter(s => s.chartHits >= t).length.toLocaleString()}곡`)
    }

    console.log(`\n=== 인기 상위 8곡 ===`)
    for (const s of list.slice(0, 8)) {
        const g = [...s.chartGenres].map(c => GENRE_NAMES[c] || c).join(',')
        console.log(`  ${String(s.chartHits).padStart(3)}회 최고${String(s.bestRank).padStart(3)}위  ${s.existing ? '[기존]' : '[신규]'} ${s.title} - ${s.artist} (${g})`)
    }

    if (OUT) {
        const picked = (TOP ? fresh.slice(0, TOP) : fresh)
        const out = fs.createWriteStream(OUT)
        for (const s of picked) out.write(JSON.stringify({ ...s, chartGenres: [...s.chartGenres] }) + '\n')
        out.end()
        console.log(`\n출력: ${OUT} — 신규 ${picked.length.toLocaleString()}곡`)
    } else {
        console.log(`\n(--out 을 주면 파일로 저장. 지금은 통계만)`)
    }

    await mongoose.disconnect()
}

main().catch(err => { console.error(err.message); process.exit(1) })
