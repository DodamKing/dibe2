/**
 * artist-rows.jsonl + artist-albums.json → 적재 후보 곡 목록. (DB 읽기만, 쓰기 없음)
 *
 * 세 가지를 한다:
 *   1) Inst/MR 제외 — 재생해도 노래가 안 나오는 트랙
 *   2) 같은 곡의 중복 수록반 정리 — 앨범 **유형·발매일**을 근거로 원본 수록반을 고른다
 *   3) 기존 DB(Song)와 title+artist 로 대조 — 이미 있는 곡은 제외
 *
 * ⚠️ **`trackId` 로 발매 순서를 판단하면 안 된다.** 벅스 trackId 는 체계가 두 개 섞여 있어
 * `6381374`(2023년 곡)가 `32108399`(2020년 곡)보다 작다. 반드시 발매일을 쓸 것.
 *
 * 사용법:
 *   node scripts/build-artist-songs.js            # 분석 + 파일 생성
 *   node scripts/build-artist-songs.js --verbose  # 중복 42종 선택 내역까지
 */
require('dotenv').config()

const fs = require('fs')
const path = require('path')
const mongoose = require('mongoose')
// 🔴 반드시 connectToMongoDB() 를 쓸 것. .env의 MONGODB_URI엔 DB 이름이 없어서
// mongoose.connect(process.env.MONGODB_URI)를 직접 부르면 조용히 test DB(유령)에 붙는다.
const { connectToMongoDB, Song } = require('../server/models')

const DATA_DIR = path.join(__dirname, '..', 'data')
const ROWS_FILE = path.join(DATA_DIR, 'artist-rows.jsonl')
const ALBUMS_FILE = path.join(DATA_DIR, 'artist-albums.json')
const OUT_FILE = path.join(DATA_DIR, 'artist-songs.jsonl')
const REPORT_FILE = path.join(DATA_DIR, 'artist-report.json')

const has = n => process.argv.includes('--' + n)
const VERBOSE = has('verbose')
const DRY_RUN = has('dry-run')

/**
 * 연주 트랙 판별. 표기가 **두 가지**라 둘 다 잡아야 한다.
 *   괄호형: `돌덩이 (Inst.)`, `NEO (Instrumental)`, `Show Down(Inst.)`
 *   꼬리형: `이방인 Instrument`, `플레어 (Flare) Instrument`  ← 괄호가 없다
 * 꼬리형은 제목 **끝**으로 좁힌다. 아무 데나 걸면 `Instant`·`Mr.` 같은 진짜 제목을 잘라먹는다.
 */
const INST = /[(\[]\s*(inst|instrument|instrumental|반주|mr)\s*\.?\s*[)\]]|\s(inst|instrument|instrumental|mr|반주)\s*\.?\s*$/i

/**
 * 중복 수록반 중 원본을 고르는 순서.
 *
 * 유형을 발매일보다 먼저 보는 이유: 경연·행사 음원이 정규반보다 **먼저** 나오는 경우가 있다
 * (`푸에고` 런던올림픽 응원가 2012 → 정규 `Frame`, `Blue` 유재하 경연대회 → EP `Purple`).
 * 발매일만 보면 이런 곡이 행사반으로 들어간다.
 */
const TYPE_RANK = { '정규': 0, 'EP(미니)': 1, '싱글': 2, 'OST': 3, '스페셜': 4, '컴필레이션': 5 }
const rank = t => (t in TYPE_RANK ? TYPE_RANK[t] : 4)
const key = r => `${r.title}|||${r.artist}`

/**
 * 중복 판정용 키. 제목을 그대로 쓰면 **같은 녹음을 놓친다** — 실측으로 드러난 것들:
 *   `한잔의 추억` vs `한 잔의 추억`                     띄어쓰기만 다름 (둘 다 4:35)
 *   `MAMBRINO` vs `MAMBRINO (Remaster)`            리마스터, 길이 동일 (3:08)
 *   `Vagabond ...` vs `... (Movie Still ver.)`      같은 앨범·같은 길이, 영상만 다름
 * 유튜브 검증에서 이 쌍들이 **같은 영상**으로 잡히면서 발견됐다.
 *
 * 괄호 부기를 통째로 지우지는 않는다 — `몽타주 (Montage)`(싱글 3:40)와 `Montage`(정규 3:42)는
 * 길이가 달라 실제로 다른 녹음이라, 합치면 한쪽을 잃는다.
 */
const REDUNDANT = /\s*[([](remaster(ed)?|movie\s*still\s*ver\.?|리마스터)[)\]]/gi
const dupKey = r => `${r.title.replace(REDUNDANT, '').replace(/\s+/g, '').toLowerCase()}|||${r.artist}`

/**
 * 벅스의 `유형` 값이 틀린 경우가 있어서 그 위에 감점을 얹는다. 실측된 오류:
 *   - `비밀의 숲 2 OST`(통합반)가 **싱글**로 등록 → 원본 `OST Part.2` 를 이김
 *   - `런던 2012 올림픽 MBC 공식 응원가`가 **정규**로 등록 → 진짜 정규 `Frame` 을 이김
 *   - `Guckkasten (Before Regular Album)`(데뷔 전 모음)도 **정규** → 정규 1집을 이김
 */
const BAD_ALBUM = /(best collection|before regular album|응원가|경연대회)/i
// 분할 발매반의 통합반: 같은 곡의 다른 후보가 "이 앨범명 + Part/Final" 이면 이쪽이 나중에 묶은 쪽.
// ⚠️ prefix 만으로 보면 안 된다 — `은수 좋은 날 OST`(원본)가 `OST Special` 의 prefix 라
// 원본이 감점당한다. 뒤에 Part/Final 이 붙은 경우로 좁힌다.
const PART = /^\s*[-:]?\s*(part|vol|final)/i
const isBundle = (r, g) => g.some(o => o !== r
    && o.album.startsWith(r.album) && o.album.length > r.album.length
    && PART.test(o.album.slice(r.album.length)))

const penalty = (r, g) => (isBundle(r, g) ? 2 : 0) + (BAD_ALBUM.test(r.album) ? 1 : 0)

function pickOriginal(group) {
    return [...group].sort((a, b) =>
        penalty(a, group) - penalty(b, group) ||
        rank(a.albumType) - rank(b.albumType) ||
        String(a.releaseDate).localeCompare(String(b.releaseDate)) ||
        Number(a.trackId) - Number(b.trackId)
    )[0]
}

async function main() {
    const rows = fs.readFileSync(ROWS_FILE, 'utf8').split('\n').filter(Boolean).map(JSON.parse)
    const albums = JSON.parse(fs.readFileSync(ALBUMS_FILE, 'utf8'))

    // 1) Inst/MR 제외
    const inst = rows.filter(r => INST.test(r.title))
    const playable = rows.filter(r => !INST.test(r.title))
    console.log(`수집 ${rows.length}행 → Inst/MR ${inst.length}곡 제외 → ${playable.length}행`)

    // 앨범 정보 붙이기
    const withAlbum = playable.map(r => {
        const a = albums[r.albumId] || {}
        return { ...r, albumType: a.type || '', releaseDate: a.releaseDate || '', genre: a.genre || [], style: a.style || [] }
    })
    const noAlbumInfo = withAlbum.filter(r => !r.albumType)
    if (noAlbumInfo.length) console.log(`  ⚠ 앨범 정보 없는 행 ${noAlbumInfo.length}건`)

    // 2) 중복 정리
    const groups = new Map()
    withAlbum.forEach(r => {
        if (!groups.has(dupKey(r))) groups.set(dupKey(r), [])
        groups.get(dupKey(r)).push(r)
    })
    const picked = [...groups.values()].map(pickOriginal)
    const dupGroups = [...groups.values()].filter(g => g.length > 1)
    console.log(`중복 ${dupGroups.length}종 / 여분 ${withAlbum.length - groups.size}행 정리 → ${picked.length}곡`)

    if (VERBOSE) {
        console.log(`\n--- 중복 선택 내역 ---`)
        dupGroups.forEach(g => {
            const win = pickOriginal(g)
            console.log(`■ ${g[0].title}`)
            ;[...g].sort((a, b) => penalty(a, g) - penalty(b, g) || rank(a.albumType) - rank(b.albumType) || String(a.releaseDate).localeCompare(String(b.releaseDate)))
                .forEach(r => console.log(`   ${r === win ? '남김 ✔' : '버림  '} [${r.albumType}]${penalty(r, g) ? ' 감점' + penalty(r, g) : '    '} ${r.releaseDate}  ${r.album}`))
        })
    }

    // 3) 기존 DB 대조. title+artist 는 차트 크롤러와 같은 규칙으로 뽑았으므로 키가 맞는다.
    await connectToMongoDB()
    const existing = await Song.find(
        { $or: picked.map(r => ({ title: r.title, artist: r.artist })) },
        { title: 1, artist: 1, youtubeUrl: 1 }
    ).lean()
    const existSet = new Set(existing.map(s => `${s.title}|||${s.artist}`))
    const fresh = picked.filter(r => !existSet.has(key(r)))

    console.log(`\n기존 DB에 이미 있음 ${existing.length}곡 → 신규 ${fresh.length}곡`)
    if (existing.length) existing.slice(0, 20).forEach(s => console.log(`   (중복) ${s.title} | ${s.artist}${s.youtubeUrl ? '' : '  [DB에 youtubeUrl 없음]'}`))

    const byArtist = {}
    fresh.forEach(r => { byArtist[r.artist] = (byArtist[r.artist] || 0) + 1 })
    console.log(`\n아티스트별 신규:`, byArtist)
    console.log(`장르 없는 곡: ${fresh.filter(r => !r.genre.length).length}곡`)

    if (!DRY_RUN) {
        fs.writeFileSync(OUT_FILE, fresh.map(r => JSON.stringify(r)).join('\n') + '\n')
        console.log(`\n출력: ${OUT_FILE} (${fresh.length}곡)`)

        // 눈으로 검증하려면 "남긴 것"만으론 부족하다. **뭘 왜 버렸는지**가 같이 있어야
        // 규칙이 잘못 걸러낸 곡을 찾을 수 있다. report-artist-songs.js 가 이걸 화면으로 만든다.
        const dropped = []
        dupGroups.forEach(g => {
            const win = pickOriginal(g)
            g.filter(r => r !== win).forEach(r => dropped.push({ ...r, wonBy: win.album, wonType: win.albumType, wonDate: win.releaseDate }))
        })
        fs.writeFileSync(REPORT_FILE, JSON.stringify({
            counts: { rows: rows.length, inst: inst.length, dupGroups: dupGroups.length, dropped: dropped.length, existing: existing.length, fresh: fresh.length },
            fresh, inst, dropped,
            existing: existing.map(s => ({ title: s.title, artist: s.artist, hasYoutube: !!s.youtubeUrl })),
        }, null, 1))
        console.log(`검증용 리포트: ${REPORT_FILE}`)
    }
    await mongoose.connection.close()
}

main().catch(async err => { console.error(err); try { await mongoose.connection.close() } catch { } process.exit(1) })
