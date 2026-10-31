/**
 * 곡 참조(songId) 바로잡기 — 2026-10-31 일회성.
 *
 * 1) 차트(Chart·PopChart) 항목에 `songId` 채우기
 *    크론도 다음 실행 때 스스로 채우지만(updateChartData 가 songId 를 비교하게 바뀜) 기다리지 않으려고.
 * 2) 플레이리스트의 깨진 `songId` 다시 잇기
 *    웹이 차트 항목을 그대로 플리에 넣어 **차트 항목의 서브문서 id**(곡이 아님)가 songId 로 저장돼 왔다.
 *    그 id 는 차트가 갱신될 때마다 새로 생기는 값이라 어떤 Song 도 가리키지 않는다.
 *    title+artist 로 Song 을 찾아 다시 잇는다(Song 에 title+artist 중복 0 — 2026-10-31 확인).
 *    못 찾은 항목은 건드리지 않고 목록만 출력한다.
 *
 * 두 경우 모두 `updateOne` 으로 쓴다 — Chart 의 pre('findOneAndUpdate') 가 lastUpdated 를
 * 바꾸면 "차트 내용이 바뀐 시각"이 거짓이 되기 때문.
 *
 * 사용법:
 *   node scripts/fix-song-refs.js            # 조회만 (기본 dry-run)
 *   node scripts/fix-song-refs.js --apply    # 실제 수정
 */
require('dotenv').config()

// 🔴 반드시 connectToMongoDB() 를 쓸 것. .env의 MONGODB_URI엔 DB 이름이 없어서
// mongoose.connect(process.env.MONGODB_URI) 를 직접 부르면 조용히 test DB(유령)에 붙는다.
const mongoose = require('mongoose')
const db = require('../server/models')
const { connectToMongoDB } = require('../server/models')

const APPLY = process.argv.includes('--apply')

async function findSongId(title, artist) {
    const song = await db.Song.findOne({ title, artist }).select('_id').lean()
    return song ? song._id : null
}

async function fixChart(name, model) {
    const chart = await model.findOne().lean()
    if (!chart) return console.log(`[${name}] 문서 없음`)

    let filled = 0, missing = 0
    const items = []
    for (const item of chart.items) {
        if (item.songId) { items.push(item); continue }
        const songId = await findSongId(item.title, item.artist)
        if (songId) filled++
        else { missing++; console.log(`  [${name}] Song 없음: ${item.rank}. ${item.title} / ${item.artist}`) }
        items.push(songId ? { ...item, songId } : item)
    }
    console.log(`[${name}] ${chart.items.length}곡 — 채움 ${filled} · 못 찾음 ${missing} · 이미 있음 ${chart.items.length - filled - missing}`)
    if (APPLY && filled) await model.updateOne({ _id: chart._id }, { $set: { items } })
}

async function fixPlaylists() {
    const playlists = await db.Playlist.find().lean()
    const allIds = [...new Set(playlists.flatMap(p => p.songs.map(s => String(s.songId))))]
    const existing = new Set(
        (await db.Song.find({ _id: { $in: allIds.filter(id => mongoose.Types.ObjectId.isValid(id)) } }).select('_id').lean())
            .map(s => String(s._id))
    )

    let fixed = 0, unresolved = 0
    for (const p of playlists) {
        let changed = false
        const songs = []
        for (const s of p.songs) {
            if (existing.has(String(s.songId))) { songs.push(s); continue }
            const songId = await findSongId(s.title, s.artist)
            if (songId) {
                songs.push({ ...s, songId })
                changed = true
                fixed++
            } else {
                songs.push(s)
                unresolved++
                console.log(`  [플리 "${p.name}"] Song 없음: ${s.title} / ${s.artist}`)
            }
        }
        if (APPLY && changed) await db.Playlist.updateOne({ _id: p._id }, { $set: { songs } })
    }
    console.log(`[플레이리스트] 깨진 songId — 다시 이음 ${fixed} · 못 찾음 ${unresolved}`)
}

async function main() {
    await connectToMongoDB()
    console.log(APPLY ? '=== 적용 모드 ===' : '=== 조회만 (적용하려면 --apply) ===')
    await fixChart('Chart', db.Chart)
    await fixChart('PopChart', db.PopChart)
    await fixPlaylists()
    await mongoose.disconnect()
}

main().catch(e => { console.error(e); process.exit(1) })
