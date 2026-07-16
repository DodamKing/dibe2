/**
 * 기존 곡에 장르/스타일 백필.
 *
 * 벅스는 장르를 트랙이 아니라 앨범 페이지에 붙인다. 앨범 ID는 coverUrl 경로 끝에
 * 그대로 들어있어서(.../album/images/50/206680/20668087.jpg → 20668087) 트랙
 * 페이지를 거치지 않고 앨범 페이지만 때리면 된다. 같은 앨범 곡은 캐시로 묶인다.
 *
 * 사용법:
 *   node scripts/backfill-genre.js --dry-run      # 저장 없이 통계만
 *   node scripts/backfill-genre.js --limit 50     # 50곡만
 *   node scripts/backfill-genre.js                # 전체 백필
 */
require('dotenv').config()

const axios = require('axios')
const cheerio = require('cheerio')
const mongoose = require('mongoose')
const { connectToMongoDB, Song } = require('../server/models')

const DRY_RUN = process.argv.includes('--dry-run')
const limitArg = process.argv.indexOf('--limit')
const LIMIT = limitArg !== -1 ? parseInt(process.argv[limitArg + 1]) : 0
const DELAY_MS = 300

const UA = { headers: { 'User-Agent': 'Mozilla/5.0' } }
const sleep = ms => new Promise(r => setTimeout(r, ms))

function albumIdFromCoverUrl(coverUrl) {
    const m = /\/album\/images\/\d+\/\d+\/(\d+)\./.exec(coverUrl || '')
    return m ? m[1] : null
}

async function albumIdFromDetailLink(detailLink) {
    const { data } = await axios.get(detailLink, UA)
    const href = cheerio.load(data)('table.info a[href*="/album/"]').first().attr('href')
    const m = /\/album\/(\d+)/.exec(href || '')
    return m ? m[1] : null
}

function splitField(text) {
    return text.split(',').map(s => s.trim()).filter(Boolean)
}

async function fetchAlbumGenre(albumId) {
    const { data } = await axios.get(`https://music.bugs.co.kr/album/${albumId}`, UA)
    const $ = cheerio.load(data)
    const out = { genre: [], style: [] }

    $('table.info tbody tr').each((i, el) => {
        const label = $(el).find('th').text().trim()
        const value = $(el).find('td').text().trim().replace(/\s+/g, ' ')
        if (label === '장르') out.genre = splitField(value)
        else if (label === '스타일') out.style = splitField(value)
    })

    return out
}

async function main() {
    await connectToMongoDB()
    if (mongoose.connection.readyState !== 1) throw new Error('MongoDB 연결 실패')
    console.log(`DB: ${mongoose.connection.db.databaseName} | dry-run: ${DRY_RUN}`)

    let query = Song.find({ genre: { $exists: false } }).select('_id title artist coverUrl detailLink')
    if (LIMIT) query = query.limit(LIMIT)
    const songs = await query.lean()

    console.log(`대상 ${songs.length}곡`)

    const cache = new Map()
    const stats = { updated: 0, noAlbumId: 0, noGenre: 0, failed: 0, fetches: 0 }

    for (const [i, song] of songs.entries()) {
        const label = `${song.title} - ${song.artist}`
        try {
            let albumId = albumIdFromCoverUrl(song.coverUrl)
            if (!albumId && song.detailLink) {
                albumId = await albumIdFromDetailLink(song.detailLink)
                await sleep(DELAY_MS)
            }
            if (!albumId) {
                stats.noAlbumId++
                console.warn(`[${i + 1}/${songs.length}] 앨범ID 못 찾음: ${label}`)
                continue
            }

            if (!cache.has(albumId)) {
                cache.set(albumId, await fetchAlbumGenre(albumId))
                stats.fetches++
                await sleep(DELAY_MS)
            }
            const { genre, style } = cache.get(albumId)

            if (!genre.length) {
                stats.noGenre++
                console.warn(`[${i + 1}/${songs.length}] 장르 없음: ${label}`)
                continue
            }

            if (!DRY_RUN) await Song.updateOne({ _id: song._id }, { $set: { genre, style } })
            stats.updated++
            console.log(`[${i + 1}/${songs.length}] ${label} → ${genre.join(', ')}`)
        } catch (err) {
            stats.failed++
            console.error(`[${i + 1}/${songs.length}] 실패: ${label} — ${err.message}`)
        }
    }

    console.log('\n=== 결과 ===')
    console.log(`갱신 ${stats.updated} | 앨범ID 없음 ${stats.noAlbumId} | 장르 없음 ${stats.noGenre} | 실패 ${stats.failed}`)
    console.log(`앨범 페이지 요청 ${stats.fetches}회 (곡 ${songs.length}개 → 캐시 적중률 ${songs.length ? Math.round((1 - stats.fetches / songs.length) * 100) : 0}%)`)

    await mongoose.disconnect()
}

main().catch(err => {
    console.error(err)
    process.exit(1)
})
