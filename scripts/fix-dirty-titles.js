/**
 * DB에 박힌 오염된 제목(`[19금]\n곡명`)을 정리하고 같은 값을 `adult` 플래그로 이관한다.
 *
 * 왜 지금이냐: 파서 수정(`.title` → `.title a`)을 **배포하기 전에** 돌려야 한다.
 * 배포 후엔 차트 크론이 깨끗한 제목으로 저장을 시도하는데 DB엔 오염된 제목이 남아 있어
 * `saveSongData`의 {title, artist} 중복 판별이 **다른 곡으로 보고 중복을 박는다.**
 *
 * 배지는 뒤에 **개행**이 붙는다(실측: [19금] 243/243, [권리없는 곡] 62/62).
 * `[드포즈 극장] 바그다드 카페`처럼 대괄호가 진짜 제목인 곡은 공백으로 이어지므로
 * `^\[[^\]]+\]\n` (개행 필수)로만 잘라야 훼손되지 않는다.
 *
 * 충돌(정리한 제목이 이미 DB에 있음)은 **오염본을 삭제**한다. 배지가 없었다면 그 곡은
 * 애초에 `saveSongData`에서 "이미 존재하는 곡"으로 스킵됐을 것이기 때문(= 원래 동작 복원).
 * 실제 사례: 제니 ExtraL 이 싱글(2/22)과 정규앨범 Ruby(3/12)로 두 번 들어옴 — 벅스 트랙 ID가
 * 서로 다른 별개 트랙인데 우리 키는 {title, artist} 라 하나여야 했다. 배지가 그 판별을 깼다.
 * 단 좋아요/재생/플레이리스트 **참조가 하나라도 있으면 지우지 않고 멈춘다**(사람이 판단할 일).
 *
 * 사용법:
 *   node scripts/fix-dirty-titles.js            # 조회만 (기본 dry-run)
 *   node scripts/fix-dirty-titles.js --apply    # 실제 수정
 */
require('dotenv').config()

// 🔴 반드시 connectToMongoDB() 를 쓸 것. .env의 MONGODB_URI엔 DB 이름이 없어서
// mongoose.connect(process.env.MONGODB_URI) 를 직접 부르면 조용히 test DB(유령)에 붙는다.
const db = require('../server/models')
const { connectToMongoDB } = require('../server/models')

const APPLY = process.argv.includes('--apply')

// 배지 = 대괄호 + 개행. 개행이 없으면 진짜 제목이므로 건드리지 않는다.
const BADGE_RE = /^\[([^\]]+)\]\s*\n\s*/

async function countRefs(songId) {
    const [likes, plays, inPlaylists] = await Promise.all([
        db.Like.countDocuments({ song: songId }),
        db.PlayEvent.countDocuments({ song: songId }),
        db.Playlist.countDocuments({ 'songs.songId': songId }),
    ])
    return { likes, plays, inPlaylists, total: likes + plays + inPlaylists }
}

async function main() {
    await connectToMongoDB()

    // 개행이 뒤따르는 대괄호로 시작하는 제목만
    const dirty = await db.Song.find({ title: /^\[[^\]]+\]\s*\n/ }).lean()
    console.log(`오염된 곡 ${dirty.length}개\n`)
    if (!dirty.length) return console.log('할 일 없음.')

    const plan = []
    for (const s of dirty) {
        const m = BADGE_RE.exec(s.title)
        const badge = m[1]
        const cleanTitle = s.title.replace(BADGE_RE, '').trim()
        const adult = badge === '19금'

        // 정리한 제목이 이미 존재하면 중복이 된다.
        const collision = await db.Song.findOne({
            _id: { $ne: s._id }, title: cleanTitle, artist: s.artist,
        }).select('_id title artist youtubeUrl lyrics').lean()

        // 오염본을 지우기 전에 딸린 참조가 없는지 본다. 있으면 지우면 안 된다.
        const refs = collision ? await countRefs(s._id) : null

        plan.push({ s, badge, cleanTitle, adult, collision, refs })

        console.log(`[${badge}] ${JSON.stringify(s.title)}`)
        console.log(`   → title: ${JSON.stringify(cleanTitle)}${adult ? ' | adult: true' : ''}`)
        console.log(`   artist: ${s.artist} | 가사 ${s.lyrics ? s.lyrics.length + '자' : '없음'} | youtubeUrl ${s.youtubeUrl ? 'O' : 'X'}`)
        if (collision) {
            console.log(`   ⚠️ 충돌 — 정리하면 기존 곡과 같은 키가 된다. 오염본(이 문서)을 삭제한다:`)
            console.log(`      남길 곡: _id=${collision._id} 가사 ${collision.lyrics ? 'O' : 'X'} youtubeUrl ${collision.youtubeUrl ? 'O' : 'X'}`)
            console.log(`      삭제할 곡의 참조: Like ${refs.likes} | PlayEvent ${refs.plays} | Playlist ${refs.inPlaylists}`)
            if (refs.total > 0) console.log(`      🔴 참조가 있다! 지우면 이력이 날아간다 — 중단 대상`)
        }
        console.log('')
    }

    const collisions = plan.filter(p => p.collision)
    const blocked = collisions.filter(p => p.refs.total > 0)
    console.log(`=== 요약: 정리 대상 ${plan.length} | 19금 ${plan.filter(p => p.adult).length} | 충돌 ${collisions.length}(삭제 예정) ===`)

    if (blocked.length) {
        console.log(`\n🔴 참조가 딸린 충돌 ${blocked.length}건 — 자동 수정 중단. 이력 이관 정책을 정한 뒤 다시 돌릴 것.`)
        return
    }
    if (!APPLY) return console.log('\n(dry-run — 실제로 고치려면 --apply)')

    let updated = 0, deleted = 0
    for (const p of plan) {
        if (p.collision) {
            await db.Song.deleteOne({ _id: p.s._id })
            deleted++
            console.log(`삭제(중복): ${JSON.stringify(p.s.title)} → 남김 _id=${p.collision._id}`)
        } else {
            await db.Song.updateOne({ _id: p.s._id }, { $set: { title: p.cleanTitle, adult: p.adult } })
            updated++
            console.log(`수정: ${JSON.stringify(p.cleanTitle)}${p.adult ? ' (19금)' : ''}`)
        }
    }
    console.log(`\n수정 ${updated}곡 | 삭제 ${deleted}곡`)

    // 정리 후 오염이 실제로 없어졌는지 스스로 확인한다.
    const left = await db.Song.countDocuments({ title: /^\[[^\]]+\]\s*\n/ })
    const adults = await db.Song.countDocuments({ adult: true })
    console.log(`검증: 남은 오염 ${left}건(0이어야 함) | adult=true ${adults}곡`)
}

main()
    .catch(err => { console.error(err); process.exitCode = 1 })
    .finally(() => require('mongoose').connection.close())
