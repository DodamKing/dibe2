/**
 * artist-songs.jsonl 의 각 곡에 대해 유튜브 후보를 받아 **채점 근거와 함께** 기록한다. (DB 안 씀)
 *
 * fill-youtube.js 와 다른 점: 저쪽은 조건에 맞는 **첫 번째를 집고 나머지를 버린다**.
 * 그래서 videoId 가 붙었어도 그게 맞는 곡인지 확인할 방법이 없다 — 무명 곡일수록
 * 유튜브는 0건을 주는 대신 **비슷한 다른 곡**을 돌려준다. 여기서는 후보 10개를 전부
 * 남기고, 왜 그렇게 판정했는지도 같이 적어서 사람이 검증할 수 있게 한다.
 * (후보를 10개 받는 건 공짜다. 검색 1회가 어차피 한 페이지를 통째로 준다)
 *
 * 판정 기준의 **순서**가 곧 정책이다:
 *   ① 제목·아티스트 일치 — 필수 조건. 하나라도 어긋나면 '확실'이 될 수 없다
 *   ② 공식(또는 `- Topic`) 채널 — 같은 조건이면 이쪽을 고른다. 음질도 낫고 삭제될 위험이 적다
 *   ③ 길이 — 판단을 돕는 보조 신호. 라이브·다른 버전을 걸러내는 데 쓴다
 *
 * 판정 3단계:
 *   확실 — ①을 만족 + 길이 근접 + 부정 신호 없음 → 적재
 *   애매 — 한쪽만 일치하거나 근거가 부족 → **적재하지 않는다**
 *   없음 — 후보 없음 → 적재하지 않는다
 *
 * 애매를 넣지 않는 이유: 틀린 영상이 붙으면 그 곡을 재생했을 때 **다른 노래가 나온다.**
 * 그건 URL이 비어 있는 것보다 나쁘다. 비어 있으면 lazy fill 이 재생 시점에 다시 찾지만,
 * 잘못 채워져 있으면 아무도 그게 틀린 줄 모른다.
 *
 * ⚠️ 유튜브는 429 대신 **빈 결과를 조용히 돌려주는** 식으로 막는다. 그러면 예외가 안 나서
 * 남은 곡을 전부 "영상 없음"으로 기록해 버린다. 연속 0건을 차단 신호로 보고 즉시 멈춘다.
 *
 * 사용법:
 *   node scripts/verify-youtube.js --limit 30      # 시험
 *   node scripts/verify-youtube.js                 # 전체 (재실행하면 끝낸 곡은 건너뜀)
 *   node scripts/verify-youtube.js --include-existing   # DB에 있으나 URL 없는 곡도 포함
 */
require('dotenv').config()

const fs = require('fs')
const path = require('path')
const YouTubeSearch = require('youtube-search-api')

const DATA_DIR = path.join(__dirname, '..', 'data')
const IN_FILE = path.join(DATA_DIR, 'artist-songs.jsonl')
const REPORT_FILE = path.join(DATA_DIR, 'artist-report.json')
const TRACKS_FILE = path.join(DATA_DIR, 'artist-tracks.jsonl')
const OUT_FILE = path.join(DATA_DIR, 'artist-youtube.jsonl')

const arg = (n, d) => { const i = process.argv.indexOf('--' + n); return i !== -1 ? process.argv[i + 1] : d }
const has = n => process.argv.includes('--' + n)

const DRY_RUN = has('dry-run')
const LIMIT = parseInt(arg('limit', '0')) || 0
const INCLUDE_EXISTING = has('include-existing')
const FAIL_LIMIT = parseInt(arg('fail-limit', '5'))
const EMPTY_LIMIT = parseInt(arg('empty-limit', '8'))
const MIN_DELAY = parseInt(arg('min-delay', '700'))
const MAX_DELAY = parseInt(arg('max-delay', '1500'))

const sleep = ms => new Promise(r => setTimeout(r, ms))
const jitter = () => MIN_DELAY + Math.floor(Math.random() * (MAX_DELAY - MIN_DELAY))
const key = s => `${s.title}|||${s.artist}`

// youtube-search-api 는 encodeURI 를 쓰는데 encodeURI 는 '#' 을 인코딩하지 않아
// '#' 뒤가 URL 프래그먼트로 잘려 검색어가 통째로 빈다. (이번 197곡엔 없지만 규칙은 유지)
const stripHash = s => s.replace(/#/g, ' ').replace(/\s+/g, ' ').trim()
const stripParen = s => s.replace(/[([][^)\]]*[)\]]/g, ' ').replace(/\s+/g, ' ').trim()

// 비교용 정규화. 한글/영문/숫자만 남긴다 — 공백·하이픈·물결·따옴표 표기가 채널마다 제각각이라
// 그대로 비교하면 같은 곡도 안 맞는다.
const norm = s => String(s || '').toLowerCase().replace(/[^0-9a-z가-힣]/g, '')

/**
 * 아티스트 별칭. 벅스 표기는 `국카스텐(Guckkasten)` `하현우(국카스텐)` `이홍기 (FT아일랜드)` 형태라
 * 통째로 비교하면 유튜브 제목/채널명과 절대 안 맞는다. 괄호 안팎을 다 후보로 쓴다.
 */
function artistAliases(song) {
    const out = new Set()
    const add = s => { const n = norm(s); if (n.length >= 2) out.add(n) }
    const push = name => {
        add(name)
        add(name.replace(/[([][^)\]]*[)\]]/g, ''))          // 괄호 밖
        const m = name.match(/[([]([^)\]]*)[)\]]/)
        if (m) add(m[1])                                     // 괄호 안
    }
    push(song.artist)
    ;(song.artistsAll || []).forEach(push)
    // 제목 괄호 안의 부캐 표기도 별칭이 된다: `Don't Cry (우리 동네 음악대장)` → 복면가왕 클립.
    // 단 `(원곡가수 조용필)` 은 넣으면 안 된다 — 조용필 원곡 영상이 통과해 버린다.
    const t = song.title.match(/[([]([^)\]]*)[)\]]/)
    if (t && !/원곡|feat|prod|inst|ver\.?$|remix|acoustic/i.test(t[1])) add(t[1])
    return [...out]
}

/**
 * 음원이 아닌 영상. 걸리면 '확실'로 자동 통과시키지 않는다.
 *
 * 길이 대조만으로는 못 걸러진다 — **라이브가 원곡과 몇 초 차이인 경우가 실제로 있다**
 * (`파우스트` EBS 스페이스 공감 −1초, `바이올렛원드` 0초, `Get Back` 더 시즌즈 +5초).
 * 그래서 방송 프로그램·공연 표기를 이름으로 잡는다.
 */
const NEGATIVE = new RegExp([
    // 반주 — **이게 제일 위험하다.** 반주 버전은 원곡과 길이가 똑같아서 길이 대조가 통하지 않는다.
    // 제목으로만 걸러낼 수 있다(실측: 11곡이 `(Instrumental)` / `(Inst.)` 영상으로 잡혔었다).
    'instrumental', '\\binst\\b', 'inst\\.', '\\bmr\\b', '반주',
    '노래방', 'karaoke', '\\btj\\b', '금영', '제거',
    'reaction', '리액션', '커버', '\\bcover\\b', '교차편집', '\\bmix\\b',
    '메이킹', 'behind', 'teaser', '예고', '스페셜클립',
    // 라이브·공연
    '라이브', '\\blive\\b', '직캠', 'fancam', '공연', '콘서트', '페스티벌', '무대', '\\[4k\\]',
    '스페이스\\s*공감', '스케치북', 'sketchbook', '시즌즈', '유희열', '해프닝', '난장',
    // 방송 — 영어 표기로도 나온다
    '불후의', 'immortal\\s*songs', '가요톱', '음악중심', 'music\\s*core', '인기가요', 'inkigayo',
    '엠카운트', 'mcountdown', '쇼챔피언', 'show\\s*champion', '러브레터',
    '옥타브', '음정', '편집영상', '전곡', 'full\\s*album',
].join('|'), 'i')

/**
 * 유튜브가 유통사 음원으로 **자동 생성한 채널**(`Yunmin - Topic`). 사람이 올린 게 아니라
 * 배급 음원 그대로라 공식 채널과 같은 급으로 신뢰할 수 있다.
 */
const TOPIC_CHANNEL = /\s-\s*topic$/i

/**
 * 업로드가 음원 쪽인지 영상 쪽인지. **공식 여부보다 아래 순위**로만 쓴다.
 *
 * **길이보다 아래**에 둔다. 위에 두면 34곡이 바뀌는데 그중 상당수가 개악이었다(실측):
 *   `Regret` → `Regret (Acoustic ver.)`,  `Hi Bully` → `(Acoustic ver.)`   다른 버전
 *   `PUPPET (Remaster)` → `PUPPET (English Lyric Ver.)`                    다른 녹음
 *   `Miserere` → 공식 MV 대신 개인채널(−4초)
 * `Lyric Video (Eng ver.)` 류가 "오디오형"으로 분류돼 정확한 공식 음원을 밀어내기 때문이다.
 * 공식 M/V는 대개 음원 그대로고, 편집본은 길이 대조에서 이미 걸러진다.
 * 그래서 **길이까지 같을 때만** 쓰는 마지막 tie-break 다 (`Take Me Down` M/V → OFFICIAL AUDIO).
 */
const AUDIO_HINT = /(official\s*audio|\baudio\b|lyrics?\s*video|lyric|가사|음원|\[mp3\])/i
const VIDEO_HINT = /(m\/v|\bmv\b|뮤직비디오|music\s*video|official\s*video|performance\s*video)/i
const audioRank = c => TOPIC_CHANNEL.test(c.channel) ? 0
    : AUDIO_HINT.test(c.vtitle) ? 1
        : VIDEO_HINT.test(c.vtitle) ? 3 : 2

function parseDuration(text) {
    if (!text) return null
    const p = text.split(':').map(Number)
    if (p.some(isNaN)) return null
    if (p.length === 3) return p[0] * 3600 + p[1] * 60 + p[2]
    if (p.length === 2) return p[0] * 60 + p[1]
    return null
}

/**
 * 길이 허용 오차. 벅스 음원 길이와 유튜브 영상 길이의 차이를 실측한 값에서 나왔다
 * (제목·아티스트가 다 맞는 후보 147건 기준):
 *   0~2초 65건 · 3~5초 20건  ← 음원
 *   16초 이상 31건            ← 라이브·페스티벌·어쿠스틱 버전
 *   음수 20건                 ← 방송 클립(앞뒤 잘림)·다른 버전
 * 유튜브 업로드는 앞뒤로 무음이 조금 붙어 대체로 +1~3초다. 음수도 조금은 정상이라
 * (`나 혼자` 공식 채널 −1초) 절대값으로 본다.
 */
const SURE_SEC = 5
const MAYBE_SEC = 15
// 벅스 길이를 못 받은 곡용 폴백. 고정 상한이지만 6분이 아니라 12분 — 6분은 프로그레시브
// 록 곡을 통째로 놓친다(`Mandrake` 6:09, `Faust` 6:19).
const FALLBACK_MIN = 100, FALLBACK_MAX = 720

function scoreItem(item, song, aliases, bugsDur) {
    const vtitle = item.title || ''
    const channel = item.channelTitle || ''
    const dur = parseDuration(item.length?.simpleText)
    const nv = norm(vtitle), nc = norm(channel)

    // 제목은 원형과 괄호 제거형 둘 다 본다. `붉은 밭 (Acoustic ver.)` 처럼 부기가 붙으면
    // 영상 제목엔 보통 그 부기가 없다.
    const nt = norm(song.title), nts = norm(stripParen(song.title))
    const titleMatch = (nt.length >= 2 && nv.includes(nt)) || (nts.length >= 2 && nv.includes(nts))
    const artistMatch = aliases.some(a => nv.includes(a) || nc.includes(a))
    // 채널명 자체가 아티스트인 경우(= 공식/전용 채널). 길이가 똑같아도 방송 클립·해설
    // 영상보다 이쪽을 우선해야 한다(`변신` → "옥타브 확인!" 영상이 0초 차이로 이겼다).
    const officialChannel = aliases.some(a => nc.includes(a)) || TOPIC_CHANNEL.test(channel)
    // 채널명도 같이 본다 — `MR 노래방 l MR karaoke` 처럼 채널 쪽에만 표기된 경우가 있다.
    const negative = NEGATIVE.test(vtitle) || NEGATIVE.test(channel)

    const diff = (bugsDur && dur !== null) ? dur - bugsDur : null
    const durOk = diff !== null
        ? Math.abs(diff) <= SURE_SEC
        : (dur !== null && dur >= FALLBACK_MIN && dur <= FALLBACK_MAX)

    return {
        videoId: item.id, vtitle, channel,
        duration: item.length?.simpleText || '', durationSec: dur, diff,
        titleMatch, artistMatch, durOk, negative, officialChannel,
    }
}

/** 후보들에서 최종 판정과 채택 영상을 고른다. 요청 없이 계산만 하므로 언제든 다시 돌릴 수 있다. */
function decide(cands, bugsDur) {
    const near = d => d !== null && Math.abs(d) <= SURE_SEC
    const nearish = d => d !== null && Math.abs(d) <= MAYBE_SEC

    const sure = cands
        .filter(c => c.titleMatch && c.artistMatch && !c.negative
            && (bugsDur ? near(c.diff) : c.durOk))
        // 공식 채널 → 길이가 가까운 것 → 그래도 같으면 음원형 업로드.
        .sort((a, b) => (b.officialChannel - a.officialChannel)
            || (Math.abs(a.diff ?? 99) - Math.abs(b.diff ?? 99))
            || (audioRank(a) - audioRank(b)))

    if (sure.length) return { verdict: '확실', pick: sure[0] }

    const maybe = cands
        .filter(c => (c.titleMatch || c.artistMatch) && (bugsDur ? nearish(c.diff) : c.durOk))
        // 순서가 중요하다.
        //  ① 음원이 아닌 것(반주·라이브)을 먼저 밀어낸다 — `Home` 이 "MR노래방"으로 잡혔던 이유
        //  ② 그 다음이 **제목 일치**. 공식 채널을 이보다 앞에 두면 안 된다 — 실제로 `Home` 이
        //     같은 가수의 **다른 곡**(`일상으로의 초대`)으로 바뀌었다. 제목이 틀리면 채널이
        //     공식이든 아니든 쓸모가 없다.
        .sort((a, b) => (a.negative - b.negative)
            || (b.titleMatch - a.titleMatch)
            || (b.officialChannel - a.officialChannel)
            || (b.artistMatch - a.artistMatch)
            || (Math.abs(a.diff ?? 99) - Math.abs(b.diff ?? 99)))

    return maybe.length ? { verdict: '애매', pick: maybe[0] } : { verdict: '없음', pick: null }
}

async function searchOnce(q) {
    const res = await YouTubeSearch.GetListByKeyword(q, false, 10)
    return res?.items || []
}

async function verifySong(song) {
    const aliases = artistAliases(song)
    const bugsDur = song.duration || null
    const q1 = stripHash(`${song.title} ${song.artist} official audio`)
    let items = await searchOnce(q1)
    let queries = [q1], resultCount = items.length
    let cands = items.map(it => scoreItem(it, song, aliases, bugsDur))

    // 폴백은 **'확실'이 안 나왔을 때만** 돈다. 잘 되는 쿼리는 건드리지 않으므로 회귀가 없고,
    // 추가 요청도 실패한 곡에만 발생한다. 괄호 부기가 검색을 죽이는 경우가 실제로 있다
    // (`모나리자 (원곡가수 조용필)` → 조용필 원곡이 잡힘).
    if (decide(cands, bugsDur).verdict !== '확실') {
        const q2 = stripHash(`${stripParen(song.title)} ${stripParen(song.artist)} official audio`)
        if (q2 && norm(q2) !== norm(q1)) {
            await sleep(jitter())
            const items2 = await searchOnce(q2)
            queries.push(q2)
            resultCount += items2.length
            // videoId 중복 제거 — 두 쿼리가 같은 영상을 줄 수 있다.
            const seen = new Set(cands.map(c => c.videoId))
            cands = cands.concat(items2.map(it => scoreItem(it, song, aliases, bugsDur)).filter(c => !seen.has(c.videoId)))
        }
    }

    const { verdict, pick } = decide(cands, bugsDur)
    // 판정 근거가 보이도록 가까운 순으로 남긴다.
    cands.sort((a, b) => Math.abs(a.diff ?? 999) - Math.abs(b.diff ?? 999))

    return {
        title: song.title, artist: song.artist, album: song.album,
        detailLink: song.detailLink, source: song.source || 'new',
        bugsDuration: bugsDur, queries, resultCount, verdict,
        pick: pick ? pick.videoId : null,
        candidates: cands.slice(0, 8),
    }
}

async function readJsonl(file) {
    if (!fs.existsSync(file)) return []
    return fs.readFileSync(file, 'utf8').split('\n').filter(Boolean).map(JSON.parse)
}

/**
 * 이미 받아둔 후보에 판정만 다시 매긴다. **네트워크 요청 0.**
 * 기준(허용 오차·채널 우선순위)을 바꿀 때마다 재검색하면 그것만으로 차단당한다.
 */
async function rescore() {
    const rows = await readJsonl(OUT_FILE)
    if (!rows.length) return console.log(`${OUT_FILE} 없음`)
    const durs = new Map((await readJsonl(TRACKS_FILE)).map(t => [key(t), t.duration]))
    const before = {}, after = {}
    const out = rows.map(r => {
        before[r.verdict] = (before[r.verdict] || 0) + 1
        // 길이 대조와 공식 채널 판정은 **저장된 원자료에서 다시 계산한다**. 기준을 바꿀 때마다
        // 재검색하는 걸 피하려면 판정에 필요한 값이 후보 안에 다 들어 있어야 한다.
        const bugsDur = r.bugsDuration || durs.get(key(r)) || null
        const aliases = artistAliases({ title: r.title, artist: r.artist, artistsAll: r.artistsAll || [] })
        r.bugsDuration = bugsDur
        r.candidates = r.candidates.map(c => {
            const diff = (bugsDur && c.durationSec != null) ? c.durationSec - bugsDur : null
            return {
                ...c, diff,
                officialChannel: aliases.some(a => norm(c.channel).includes(a)) || TOPIC_CHANNEL.test(c.channel),
                negative: NEGATIVE.test(c.vtitle) || NEGATIVE.test(c.channel),
                durOk: diff !== null ? Math.abs(diff) <= SURE_SEC
                    : (c.durationSec != null && c.durationSec >= FALLBACK_MIN && c.durationSec <= FALLBACK_MAX),
            }
        }).sort((a, b) => Math.abs(a.diff ?? 999) - Math.abs(b.diff ?? 999))
        const { verdict, pick } = decide(r.candidates, bugsDur)
        after[verdict] = (after[verdict] || 0) + 1
        if (verdict !== r.verdict) console.log(`   ${r.verdict} → ${verdict}   ${r.title}`)
        // '확실'만 적재한다. pick 은 검토 화면에서 근거를 보여주려고 남겨둔다.
        return { ...r, verdict, pick: pick ? pick.videoId : null, include: verdict === '확실' }
    })
    if (!DRY_RUN) fs.writeFileSync(OUT_FILE, out.map(r => JSON.stringify(r)).join('\n') + '\n')
    console.log(`\n재채점 ${rows.length}곡 — 이전`, before, '→ 이후', after)
    if (!DRY_RUN) console.log(`출력: ${OUT_FILE}`)
}

/**
 * 공식 채널 영상을 못 찾은 곡만 **검색어를 바꿔 한 번 더** 훑는다.
 *
 * 1차 검색어 `"{제목} {아티스트} official audio"` 는 `- Topic` 채널을 잘 못 잡는다 —
 * Topic 영상은 제목이 곡 이름뿐이라 "official audio" 가 오히려 방해가 된다.
 * 기존 후보는 버리지 않고 **합쳐서** 다시 채점하므로, 더 나은 게 없으면 지금 픽이 유지된다(회귀 없음).
 */
async function secondPass() {
    const rows = await readJsonl(OUT_FILE)
    if (!rows.length) return console.log(`${OUT_FILE} 없음`)
    const durs = new Map((await readJsonl(TRACKS_FILE)).map(t => [key(t), t.duration]))

    const needs = rows.filter(r => {
        const p = r.candidates.find(c => c.videoId === r.pick)
        return !p || !p.officialChannel
    })
    const todo = LIMIT ? needs.slice(0, LIMIT) : needs
    console.log(`전체 ${rows.length}곡 | 공식 채널 못 찾음 ${needs.length} | 이번 세션 ${todo.length}`)
    console.log(`예상 약 ${(todo.length * ((MIN_DELAY + MAX_DELAY) / 2 + 800) / 60000).toFixed(1)}분\n`)
    if (!todo.length) return

    const byKey = new Map(rows.map(r => [key(r), r]))
    let improved = 0, consecutiveEmpty = 0, stopReason = null
    for (const [i, r] of todo.entries()) {
        try {
            const song = { title: r.title, artist: r.artist, artistsAll: r.artistsAll || [] }
            const aliases = artistAliases(song)
            const bugsDur = r.bugsDuration || durs.get(key(r)) || null
            // "official audio" 를 뺀다. 이게 Topic 채널을 밀어내던 원인이다.
            const q = stripHash(`${stripParen(r.title)} ${stripParen(r.artist)}`)
            const items = await searchOnce(q)
            if (!items.length) {
                if (++consecutiveEmpty >= EMPTY_LIMIT) { stopReason = `연속 ${EMPTY_LIMIT}회 0건 — 차단 의심`; break }
            } else consecutiveEmpty = 0

            const seen = new Set(r.candidates.map(c => c.videoId))
            const fresh = items.map(it => scoreItem(it, song, aliases, bugsDur)).filter(c => !seen.has(c.videoId))
            const merged = r.candidates.concat(fresh)
            const { verdict, pick } = decide(merged, bugsDur)
            const wasOfficial = r.candidates.find(c => c.videoId === r.pick)?.officialChannel
            const nowOfficial = pick?.officialChannel

            const rec = byKey.get(key(r))
            rec.queries = (rec.queries || []).concat(q)
            rec.candidates = merged.sort((a, b) => Math.abs(a.diff ?? 999) - Math.abs(b.diff ?? 999)).slice(0, 10)
            rec.verdict = verdict
            rec.pick = pick ? pick.videoId : null

            if (!wasOfficial && nowOfficial) {
                improved++
                console.log(`[${i + 1}/${todo.length}] ★ ${r.title.slice(0, 26)} → ${pick.vtitle.slice(0, 36)} [${pick.channel.slice(0, 20)}] ${pick.diff > 0 ? '+' : ''}${pick.diff}초`)
            } else if (i % 15 === 0) {
                console.log(`[${i + 1}/${todo.length}] ${r.title.slice(0, 30)} — 그대로`)
            }
        } catch (err) {
            console.error(`[!] ${r.title}: ${err.message}`)
        }
        await sleep(jitter())
    }

    if (!DRY_RUN) fs.writeFileSync(OUT_FILE, [...byKey.values()].map(r => JSON.stringify(r)).join('\n') + '\n')
    if (stopReason) console.log(`\n중단: ${stopReason}`)
    console.log(`\n=== 2차 검색 종료 === 공식 채널로 개선 ${improved}곡 / 시도 ${todo.length}`)
    if (!DRY_RUN) console.log(`출력: ${OUT_FILE}`)
}

async function main() {
    if (has('rescore')) return rescore()
    if (has('second-pass')) return secondPass()

    const songs = await readJsonl(IN_FILE)
    if (!songs.length) throw new Error(`${IN_FILE} 없음. build-artist-songs.js 를 먼저 돌릴 것`)

    // 벅스 음원 길이. 이게 있어야 고정 상한 대신 곡별 대조를 쓸 수 있다.
    const durs = new Map((await readJsonl(TRACKS_FILE)).map(t => [key(t), t.duration]))
    if (!durs.size) console.log(`⚠ ${TRACKS_FILE} 없음 — 길이 대조 없이 폴백 규칙으로 돈다`)

    let targets = songs.map(s => ({ ...s, source: 'new', duration: durs.get(key(s)) || null }))
    if (INCLUDE_EXISTING) {
        // 기존 DB에 있는데 youtubeUrl 이 비어 있는 곡. 어차피 검색을 도는 김에 같이 채운다.
        const rep = JSON.parse(fs.readFileSync(REPORT_FILE, 'utf8'))
        const extra = rep.existing.filter(s => !s.hasYoutube)
            .map(s => ({ title: s.title, artist: s.artist, album: '', artistsAll: [s.artist], source: 'existing' }))
        targets = targets.concat(extra)
        console.log(`기존 DB 곡 ${extra.length}건 포함`)
    }

    const done = new Set((await readJsonl(OUT_FILE)).map(key))
    const pending = targets.filter(s => !done.has(key(s)))
    const todo = LIMIT ? pending.slice(0, LIMIT) : pending

    console.log(`대상 ${targets.length}곡 | 완료 ${done.size} | 남음 ${pending.length} | 이번 세션 ${todo.length}`)
    console.log(`간격 ${MIN_DELAY}~${MAX_DELAY}ms | dry-run: ${DRY_RUN}`)
    console.log(`예상 약 ${(todo.length * ((MIN_DELAY + MAX_DELAY) / 2 + 800) / 60000).toFixed(1)}분 (폴백 제외)\n`)
    if (!todo.length) return console.log('할 일 없음.')

    const out = DRY_RUN ? null : fs.createWriteStream(OUT_FILE, { flags: 'a' })
    const st = { 확실: 0, 애매: 0, 없음: 0, failed: 0, fallback: 0 }
    let consecutiveFails = 0, consecutiveEmpty = 0, stopReason = null
    const startedAt = Date.now()

    for (const [i, song] of todo.entries()) {
        const label = `${song.title} - ${song.artist}`
        try {
            const r = await verifySong(song)
            consecutiveFails = 0
            if (r.queries.length > 1) st.fallback++

            if (r.resultCount === 0) {
                consecutiveEmpty++
                // 흩어진 0건은 정상(그 곡이 유튜브에 없음). 연속이면 차단 신호다.
                if (consecutiveEmpty >= EMPTY_LIMIT) {
                    stopReason = `검색 결과 0개가 연속 ${EMPTY_LIMIT}회 — 유튜브가 막았을 가능성이 높음. 기록 중단`
                    break
                }
            } else consecutiveEmpty = 0

            st[r.verdict]++
            // 곡 하나가 끝날 때마다 적는다. 중간에 끊겨도 여기까지는 남고, 재실행하면 건너뛴다.
            if (!DRY_RUN) out.write(JSON.stringify(r) + '\n')

            const top = r.candidates[0]
            console.log(`[${i + 1}/${todo.length}] ${r.verdict}  ${label.slice(0, 34)}` +
                (top ? `  → ${top.vtitle.slice(0, 40)} (${top.duration}, ${top.channel.slice(0, 14)})` : '  → 후보 없음'))
        } catch (err) {
            st.failed++
            console.error(`[!] ${label}: ${err.message}`)
            consecutiveFails++
            if (consecutiveFails >= FAIL_LIMIT) { stopReason = `연속 ${FAIL_LIMIT}회 에러 — 유튜브가 막았을 수 있음`; break }
        }
        await sleep(jitter())
    }

    if (!DRY_RUN) out.end()
    const elapsed = (Date.now() - startedAt) / 1000
    console.log(`\n=== 세션 종료 ===`)
    if (stopReason) console.log(`중단 사유: ${stopReason}`)
    console.log(`확실 ${st.확실} | 애매 ${st.애매} | 없음 ${st.없음} | 에러 ${st.failed}`)
    console.log(`폴백 재검색 ${st.fallback}회 | 소요 ${(elapsed / 60).toFixed(1)}분`)
    if (!DRY_RUN) console.log(`출력: ${OUT_FILE}`)
}

main().catch(err => { console.error(err); process.exit(1) })
