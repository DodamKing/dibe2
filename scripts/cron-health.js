/**
 * 크론 헬스체크 (읽기 전용). 프로덕션 Netlify 크론은 실패해도 슬랙 알림 없이 조용히 죽을 수 있어
 * (타임아웃 강제종료, 또는 per-song catch 가 에러를 삼켜 outer catch 가 안 도는 경우),
 * 로그 대신 **DB 상태로** "크론이 실제로 최근 곡을 채우고 있나"를 판단한다.
 *
 * 백로그 집계는 각 크론의 실제 쿼리 필터(LYRICS_PENDING 등)와 동일한 조건을 쓴다 —
 * "얼마나 더 채워야 하나"에 그대로 답이 되도록.
 *
 * 사용법: node scripts/cron-health.js
 */
require('dotenv').config()

const mongoose = require('mongoose')
const { connectToMongoDB, Song, Chart } = require('../server/models')

const DAY = 86400e3
const KST = d => d ? new Date(d.getTime() + 9 * 3600e3).toISOString().replace('T', ' ').slice(0, 19) + ' KST' : '(없음)'
const ago = d => d ? ((Date.now() - d.getTime()) / DAY).toFixed(1) + '일 전' : '-'
const n = x => x.toLocaleString()

async function latest(field) {
    const doc = await Song.findOne({ [field]: { $ne: null } }).sort({ [field]: -1 }).select(field).lean()
    return doc ? doc[field] : null
}

async function main() {
    await connectToMongoDB()
    if (mongoose.connection.readyState !== 1) { console.error('DB 연결 실패'); process.exit(1) }

    const total = await Song.countDocuments()
    console.log(`\n=== 전체 곡 ${n(total)}개 ===\n`)

    // ── 1) 각 크론이 마지막으로 "일한" 시각. 오늘 날짜면 정상 ──────────────
    console.log('■ 크론 최근 실행 흔적 (오늘 날짜면 정상)')
    const chart = await latest('lastChartedAt')
    const ly = await latest('lyricsCheckedAt')
    const yt = await latest('youtubeCheckedAt')
    console.log(`  chart  (lastChartedAt)   : ${KST(chart)}  (${ago(chart)})`)
    console.log(`  lyrics (lyricsCheckedAt) : ${KST(ly)}  (${ago(ly)})`)
    console.log(`  youtube(youtubeCheckedAt): ${KST(yt)}  (${ago(yt)})`)
    console.log(`  genre  → 마커 없음. 아래 백로그 0 여부로 판단`)

    const ly48 = await Song.countDocuments({ lyricsCheckedAt: { $gte: new Date(Date.now() - 2 * DAY) } })
    const yt48 = await Song.countDocuments({ youtubeCheckedAt: { $gte: new Date(Date.now() - 2 * DAY) } })
    console.log(`  최근 48h 마커: lyrics ${ly48}곡, youtube ${yt48}곡`)

    // ── 2) 미처리 백로그 — 각 크론의 실제 쿼리 조건과 동일 ────────────────
    // youtube: updateYoutubeUrls 필터
    const ytBacklog = await Song.countDocuments({
        youtubeUrl: { $in: [null, ''] },
        youtubeCheckedAt: { $exists: false },
    })
    // lyrics: LYRICS_PENDING 필터 (adult·detailLink 없음·마커 제외 → 크론이 실제로 시도할 곡)
    const lyBacklog = await Song.countDocuments({
        lyrics: { $in: [null, ''] },
        lyricsCheckedAt: { $exists: false },
        adult: { $ne: true },
        detailLink: { $ne: null },
    })
    // genre: updateGenres 필터
    const gnBacklog = await Song.countDocuments({ genre: { $exists: false }, coverUrl: { $ne: null } })

    console.log('\n■ 미처리 백로그 (크론이 실제로 시도할 곡 = 값 없고 마커/제외조건도 아님)')
    console.log(`  youtubeUrl : ${n(ytBacklog)}`)
    console.log(`  lyrics     : ${n(lyBacklog)}`)
    console.log(`  genre      : ${n(gnBacklog)}`)

    // 참고: 못 채워 "닫은" 곡 (마커/adult/빈배열)
    const ytClosed = await Song.countDocuments({ youtubeCheckedAt: { $exists: true } })
    const lyClosed = await Song.countDocuments({ lyricsCheckedAt: { $exists: true }, lyrics: { $in: [null, ''] } })
    const lyAdult = await Song.countDocuments({ adult: true, lyrics: { $in: [null, ''] } })
    console.log('\n  (참고) 못 받아 닫은 곡: ' +
        `youtube ${n(ytClosed)} · lyrics(없음확정) ${n(lyClosed)} · lyrics(19금) ${n(lyAdult)}`)

    // ── 3) 크론 속도로 백로그 소진까지 걸리는 시간(ETA) ──────────────────
    // youtube: 곡당 (검색 ~1s + sleep 1s) ≈ 2s → 22s 예산에 ~10곡/일.
    // lyrics/genre: sleep 없음, 관측(가사 48h 140곡 ≈ 35곡/run) 기준.
    const RATE = { youtube: 10, lyrics: 35, genre: 60 }
    console.log('\n■ 크론만으로 소진 ETA (대략)')
    console.log(`  youtube: ${n(ytBacklog)} / ~${RATE.youtube}곡·일 ≈ ${Math.round(ytBacklog / RATE.youtube)}일 (${(ytBacklog / RATE.youtube / 365).toFixed(1)}년)`)
    console.log(`  lyrics : ${n(lyBacklog)} / ~${RATE.lyrics}곡·일 ≈ ${Math.round(lyBacklog / RATE.lyrics)}일 (${(lyBacklog / RATE.lyrics / 365).toFixed(1)}년)`)
    console.log(`  genre  : ${gnBacklog === 0 ? '완료(백로그 0)' : `${n(gnBacklog)} / ~${RATE.genre}곡·일 ≈ ${Math.round(gnBacklog / RATE.genre)}일`}`)
    console.log('  ※ 신곡(차트 상위)은 매일 앞자리에서 바로 처리됨. 위 ETA는 대량 적재분(꼬리) 기준.')
    console.log('  ※ 대량 소진이 목표면 크론이 아니라 scripts/ 로컬 백필이 정답(30초 제한 없음).')

    // ── 4) 머리(최근 차트) 커버리지 — 크론이 신곡을 실제로 채우는지 ──────
    const head = await Song.find({ lastChartedAt: { $ne: null } })
        .sort({ lastChartedAt: -1, chartHits: -1 }).limit(100)
        .select('youtubeUrl lyrics genre adult').lean()
    const cov = (pred) => head.filter(pred).length
    console.log('\n■ 최근 차트 상위 100곡 커버리지 (신곡 처리 상태)')
    console.log(`  youtubeUrl: ${cov(s => s.youtubeUrl)}/100`)
    console.log(`  lyrics    : ${cov(s => s.lyrics || s.adult)}/100 (19금 포함)`)
    console.log(`  genre     : ${cov(s => s.genre && s.genre.length)}/100`)

    // Chart 는 내용이 바뀔 때만 lastUpdated 를 찍는다(매 실행 아님) — 참고용
    const chartDoc = await Chart.findOne().select('lastUpdated').lean()
    console.log(`\n■ Chart 컬렉션 최종 변경: ${KST(chartDoc && chartDoc.lastUpdated)} (${ago(chartDoc && chartDoc.lastUpdated)})`)

    await mongoose.disconnect()
}

main().catch(e => { console.error(e); process.exit(1) })
