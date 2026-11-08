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

// DB 읽기 — 테스트에서 바꿔 끼울 수 있게 한곳에 모은다
const ROW_FIELDS = 'title artist album coverUrl playCount chartHits'
const source = {
    all: () => db.Song.find({}, ROW_FIELDS).lean(),
    matching: (filter, limit) => db.Song.find(filter, ROW_FIELDS).sort({ playCount: -1 }).limit(limit).lean(),
}

async function buildIndex() {
    const t0 = Date.now()
    const rows = await source.all()
    const index = indexFromRows(rows)
    // 운영(Netlify 함수 로그)에서 색인 생성이 실제로 몇 초인지 보려고 남긴다 — 로컬→Atlas 실측은 약 3초
    console.log(`[search] 색인 생성 ${Date.now() - t0}ms (${rows.length}곡)`)
    return index
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
            raw: { title: r.title, artist: r.artist, coverUrl: r.coverUrl || null }, // 자동완성 표시용(DB 다시 안 읽게)
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
    if (!building) {
        building = buildIndex().then((c) => { cache = c; return c }).finally(() => { building = null })
        // 아무도 안 기다리는 생성(이전 색인·임시 색인으로 답한 경우)이 실패해도 처리 안 된 거부로 함수가 죽지 않게.
        // 기다리는 요청은 그대로 에러를 받는다
        building.catch((e) => console.error('[search] 색인 생성 실패:', e.message))
    }
    // 오래된 색인이 있으면 새로 만드는 동안 그걸로 답한다
    return cache || building
}

/**
 * 임시 색인 — 이 인스턴스에 색인이 아직 없을 때(콜드 스타트 뒤 첫 검색) 검색어가 글자 그대로 들어 있는 곡만
 * DB 에서 읽어(재생 수 순 최대 QUICK_LIMIT) 만든다. 앱 첫 자동완성이 색인을 기다리느라 7초 걸렸다(2026-11-08).
 * 초성·한영 자판·오타로만 맞는 곡은 여기 없다 → 못 찾으면 null, 부른 쪽이 진짜 색인을 기다린다
 */
const QUICK_LIMIT = 300
const escapeRx = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
// 글자 사이 띄어쓰기 허용 — 색인의 normalize 가 공백을 지우는 것과 맞춘다("좋은날" → "좋은 날")
const looseRx = (raw) => new RegExp([...raw].map(escapeRx).join('\\s*'), 'i')

async function quickIndex(query, fields) {
    const raws = String(query || '').trim().split(/\s+/).filter((r) => normalize(r))
    if (!raws.length) return null
    const filter = { $and: raws.map((r) => ({ $or: fields.map((f) => ({ [f]: { $regex: looseRx(r) } })) })) }
    try {
        const rows = await source.matching(filter, QUICK_LIMIT)
        return rows.length ? indexFromRows(rows) : null
    } catch (e) {
        console.error('[search] 임시 색인 실패:', e.message)
        return null
    }
}

/**
 * 색인을 골라 run(index, temp)을 돌린다. 색인이 있으면 그것(오래됐으면 뒤에서 새로 만든다).
 * 없으면 quickOk 일 때 임시 색인으로 먼저 돌려 보고, run 이 null(못 찾음)이면 진짜 색인을 기다린다
 */
async function withIndex(query, fields, quickOk, run) {
    const pending = getIndex()
    if (cache) return run(cache, false)
    if (quickOk) {
        const temp = await quickIndex(query, fields)
        const r = temp && run(temp, true)
        if (r) return r
    }
    return run(await pending, false)
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
async function search(query, type = 'all', { quick = true } = {}) {
    const fields = FIELDS_BY_TYPE[type] || FIELDS_BY_TYPE.all
    const tokens = parseQuery(query)
    if (!tokens.length) return { items: [], total: 0, fuzzy: false }
    return withIndex(query, fields, quick, (index, temp) => {
        let hits = rank(index, tokens, fields, false)
        let fuzzy = false
        if (!hits.length) {
            if (temp) return null
            hits = rank(index, tokens, fields, true)
            fuzzy = hits.length > 0
        }
        hits.sort((a, b) => b.score - a.score || a.song.f.title.n.length - b.song.f.title.n.length)
        return { items: hits.map((h) => ({ id: h.song.id, score: h.score })), total: hits.length, fuzzy }
    })
}

/**
 * 입력 중 자동완성 — 가수 몇 명 + 곡 몇 개. 색인에 있는 값만 써서 DB를 안 읽는다(타이핑마다 불리므로)
 * 가수 = 가수 필드로 맞은 곡을 가수명별로 묶어 최고 점수·곡 수 순. 커버는 그 가수의 가장 높은 곡
 */
/**
 * 자동완성 곡 칸 = 제목으로 맞은 곡 먼저, 모자라면 전체 순위로 채운다.
 * 전체 순위만 쓰면 "아이"에 아이유·아이오아이 곡이 곡 칸까지 차지해 위의 가수 칸과 겹쳤다(2026-11-08).
 * 제목만 쓰면 "아이유 좋은"·"newjeans"·오타가 비어서 채우기로
 */
function pickSongs(all, byTitle, n) {
    const out = byTitle.slice(0, n)
    const seen = new Set(out.map((h) => h.song.id))
    for (const h of all) {
        if (out.length >= n) break
        if (!seen.has(h.song.id)) { out.push(h); seen.add(h.song.id) }
    }
    return out
}

async function suggest(query, { artists: nArtists = 3, songs: nSongs = 5 } = {}) {
    const tokens = parseQuery(query)
    if (!tokens.length) return { artists: [], songs: [], fuzzy: false }
    return withIndex(query, FIELDS_BY_TYPE.all, true, (index, temp) => suggestFrom(index, temp, tokens, nArtists, nSongs))
}

function suggestFrom(index, temp, tokens, nArtists, nSongs) {
    const sortHits = (h) => h.sort((a, b) => b.score - a.score || a.song.f.title.n.length - b.song.f.title.n.length)
    let all = rank(index, tokens, FIELDS_BY_TYPE.all, false)
    let fuzzy = false
    if (!all.length) {
        if (temp) return null
        all = rank(index, tokens, FIELDS_BY_TYPE.all, true)
        fuzzy = all.length > 0
    }
    sortHits(all)
    const byArtist = sortHits(rank(index, tokens, ['artist'], fuzzy))
    const groups = new Map()
    for (const h of byArtist) {
        const name = h.song.raw.artist
        const g = groups.get(name)
        if (g) g.count++
        else groups.set(name, { name, count: 1, best: h.score, coverUrl: h.song.raw.coverUrl })
    }
    return {
        artists: [...groups.values()].sort((a, b) => b.best - a.best || b.count - a.count).slice(0, nArtists)
            .map(({ name, count, coverUrl }) => ({ name, count, coverUrl })),
        songs: pickSongs(all, fuzzy ? [] : sortHits(rank(index, tokens, ['title'], false)), nSongs)
            .map((h) => ({ _id: h.song.id, ...h.song.raw })),
        fuzzy,
    }
}

const _resetForTest = (c = null) => { cache = c; building = null }

module.exports = { search, suggest, buildIndex, indexFromRows, buildAliases, parseQuery, getIndex, _resetForTest, _source: source, FIELDS_BY_TYPE }
