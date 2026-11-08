/**
 * 음원 검색 엔진 (2026-11-08) — 1.4만 곡의 제목·가수·앨범을 함수 인스턴스 메모리에 색인해 점수로 정렬한다.
 * 상세·결정 근거는 docs/SEARCH.md
 *
 * 토큰(띄어쓰기로 나눈 검색어)마다 각 필드에서 가장 좋은 점수를 고르고, 모든 토큰이 어딘가 맞아야 결과에 든다(AND).
 *   정확 일치 100 > 앞부분 80 > 포함 60 > 초성(정확 70·앞 55·포함 45) > 오타(자모 거리 1~2) 30-8×거리
 *   한영 자판 변환("dkdldb" → "아이유")은 같은 규칙에 0.95배. 앨범 필드는 0.7배
 *   인기(재생 수·차트 등장)는 같은 점수대에서 순서를 가르는 정도로만 더한다
 * 오타 비교는 비싸서(곡×필드×자모) 정확·포함으로 찾은 곡이 적을 때만 돈다
 */
const db = require('../models')
const { normalize, chosung, toJamo, engToKor, isChosungOnly, fuzzyDistance } = require('../utils/searchText')

const INDEX_TTL_MS = 10 * 60 * 1000 // 곡은 하루 한 번(08:00 차트) 늘어난다 — 10분이면 충분히 신선
// 오타 비교는 정확·포함·초성·자판 변환으로 **하나도 못 찾았을 때만** 돈다. 실측(2026-11-08): "결과 10개 미만이면"으로
// 했더니 "밤편지"(정확 1곡)에 엉뚱한 18곡이 붙고 "아이우"가 943곡이 됐다
const FIELD_WEIGHT = { title: 1, artist: 1, album: 0.7 }

let cache = null // { builtAt, songs: [{ id, pop, f: { title: Key, artist: Key[], album: Key } }] }
let building = null

// 필드 하나의 검색 키
function keyOf(text) {
    const n = normalize(text)
    return { n, c: chosung(n), j: null } // 자모는 오타 비교 때 처음 필요할 때 만든다
}
const jamoOf = (k) => (k.j == null ? (k.j = toJamo(k.n)) : k.j)

// "아이유(IU)" → ["아이유(IU)", "아이유", "IU"]
function artistParts(artist) {
    const s = String(artist || '')
    const parts = [s]
    const m = s.match(/^(.+?)\s*\(([^()]+)\)\s*$/)
    if (m) parts.push(m[1], m[2])
    return parts
}

/**
 * 자동 별칭: "아이유(IU)"처럼 한·영이 같이 적힌 가수명에서 서로를 묶는다 →
 * 같은 가수의 다른 곡이 "IU"로만 적혀 있어도 "아이유"로 찾아진다. 손으로 넣는 별칭 사전은 다음 작업(관리자)
 */
function buildAliases(rows) {
    const groups = new Map() // normalized part → Set(normalized parts)
    for (const r of rows) {
        const m = String(r.artist || '').match(/^(.+?)\s*\(([^()]+)\)\s*$/)
        if (!m) continue
        const a = normalize(m[1])
        const b = normalize(m[2])
        if (!a || !b || a === b) continue
        const g = new Set([...(groups.get(a) || []), ...(groups.get(b) || []), a, b])
        for (const k of g) groups.set(k, g)
    }
    return groups
}

async function buildIndex() {
    const rows = await db.Song.find({}, 'title artist album playCount chartHits').lean()
    return indexFromRows(rows)
}

// 곡 행 → 색인 (DB 없이 테스트할 수 있게 분리)
function indexFromRows(rows) {
    const aliases = buildAliases(rows)
    const songs = rows.map((r) => {
        const names = new Set()
        for (const p of artistParts(r.artist)) {
            const n = normalize(p)
            if (!n) continue
            names.add(n)
            for (const a of aliases.get(n) || []) names.add(a)
        }
        return {
            id: r._id,
            pop: Math.log10(1 + (r.playCount || 0)) * 3 + Math.min(r.chartHits || 0, 50) * 0.2,
            f: {
                title: keyOf(r.title),
                artist: [...names].map((n) => ({ n, c: chosung(n), j: null })),
                album: keyOf(r.album),
            },
        }
    })
    return { builtAt: Date.now(), songs }
}

function getIndex() {
    if (cache && Date.now() - cache.builtAt < INDEX_TTL_MS) return cache
    if (!building) building = buildIndex().then((c) => { cache = c; return c }).finally(() => { building = null })
    // 오래된 색인이 있으면 새로 만드는 동안 그걸로 답한다(첫 색인만 기다린다)
    return cache || building
}

// 토큰 하나가 키 하나에 얼마나 맞나 (0 = 안 맞음)
function strictScore(t, k) {
    if (!k.n) return 0
    if (k.n === t) return 100
    if (k.n.startsWith(t)) return 80
    if (k.n.includes(t)) return 60
    return 0
}
// 초성 중간 일치는 4글자 이상만 — "ㅇㅇㅇ" 중간 일치를 허용하니 715곡이 걸렸다
function chosungScore(t, k) {
    if (!k.c) return 0
    if (k.c === t) return 70
    if (k.c.startsWith(t)) return 55
    if (t.length >= 4 && k.c.includes(t)) return 45
    return 0
}

/** 검색어 → 토큰 변형들. 영문만인 토큰은 한영 자판 변환본도 같이 본다 */
function parseQuery(query) {
    return String(query || '').trim().split(/\s+/).map((raw) => {
        const t = normalize(raw)
        if (!t) return null
        const kor = engToKor(raw) // 원문 기준(대문자 = 쌍자음)
        return { t, kor: kor && normalize(kor), cho: isChosungOnly(t), jamo: toJamo(t) }
    }).filter(Boolean)
}

function scoreToken(tok, keys, weight, fuzzy) {
    let best = 0
    for (const k of keys) {
        let s = tok.cho ? chosungScore(tok.t, k) : strictScore(tok.t, k)
        if (!s && tok.kor) s = strictScore(tok.kor, k) * 0.95
        if (!s && fuzzy && !tok.cho && tok.jamo.length >= 4 && k.n) {
            // 허용 거리: 자모·글자 4~9 → 1, 10+ → 2 (짧은 말에 2를 주면 아무 곡이나 걸린다)
            const max = tok.jamo.length >= 10 ? 2 : 1
            const d = fuzzyDistance(tok.jamo, jamoOf(k), max)
            // 길이가 비슷할수록 위로 — "아이우"가 "아이오아이"(거리 1)보다 "아이유"(거리 1)에 가깝게
            if (d <= max) s = Math.max(5, 30 - 8 * d - Math.min(10, Math.abs(jamoOf(k).length - tok.jamo.length) * 1.5))
        }
        if (s * weight > best) best = s * weight
    }
    return best
}

function rank(index, tokens, fields, fuzzy) {
    const out = []
    // 여러 단어면 붙여 쓴 전체("좋은 날" → "좋은날")가 한 필드에 그대로 있으면 가산 — 단어가 흩어져 맞은 곡보다 위로
    const phrase = tokens.length > 1 ? tokens.map((t) => t.t).join('') : null
    for (const song of index.songs) {
        let total = 0
        let ok = true
        for (const tok of tokens) {
            let best = 0
            for (const f of fields) {
                const keys = f === 'artist' ? song.f.artist : [song.f[f]]
                const s = scoreToken(tok, keys, FIELD_WEIGHT[f], fuzzy)
                if (s > best) best = s
            }
            if (!best) { ok = false; break }
            total += best
        }
        if (!ok) continue
        if (phrase) {
            let p = 0
            for (const f of fields) for (const k of (f === 'artist' ? song.f.artist : [song.f[f]])) p = Math.max(p, strictScore(phrase, k) * FIELD_WEIGHT[f])
            total += p * 0.5
        }
        out.push({ song, score: total + song.pop })
    }
    return out
}

const FIELDS_BY_TYPE = { all: ['title', 'artist', 'album'], title: ['title'], artist: ['artist'], album: ['album'] }

/**
 * @returns {{ items: [{id, score}], total, fuzzy }} — 점수순. fuzzy=true 면 오타 비교까지 써서 찾은 결과
 */
async function search(query, type = 'all') {
    const fields = FIELDS_BY_TYPE[type] || FIELDS_BY_TYPE.all
    const tokens = parseQuery(query)
    if (!tokens.length) return { items: [], total: 0, fuzzy: false }
    const index = await getIndex()
    let hits = rank(index, tokens, fields, false)
    let fuzzy = false
    if (!hits.length) {
        hits = rank(index, tokens, fields, true)
        fuzzy = hits.length > 0
    }
    hits.sort((a, b) => b.score - a.score || a.song.f.title.n.length - b.song.f.title.n.length)
    return { items: hits.map((h) => ({ id: h.song.id, score: h.score })), total: hits.length, fuzzy }
}

const _resetForTest = (c = null) => { cache = c }

module.exports = { search, buildIndex, indexFromRows, buildAliases, parseQuery, getIndex, _resetForTest, FIELDS_BY_TYPE }
