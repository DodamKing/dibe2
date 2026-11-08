const { Theme, ThemeSong } = require('../models')

// 상세 설계는 docs/THEME_PLAYLIST.md
const HALF_LIFE_DAYS = 45 // 수집에서 안 보이게 된 곡의 점수 반감기
const PRUNE_SCORE = 0.05  // 감쇠로 이 아래가 되면 풀에서 삭제

// 대표곡은 매주 나오므로 적게(15 → 5, 2026-11-08). 나머지는 주마다 바뀐다
const LIST = { fixed: 5, core: 30, explore: 15, foreignCap: 5, lastWeekWeight: 0.25 }

// ---------- 주간 목록 (2026-11-08) ----------
// 목록은 한 주(월요일 00:00 KST 시작) 동안 고정 — 누가 언제 들어가도 같은 50곡. 주가 바뀌면 새로 뽑는다.
// 지난주 목록에 나온 곡은 뽑힐 확률을 lastWeekWeight 배로(대표곡 제외) — 연달아 같은 곡이 덜 나오게
const WEEK_MS = 7 * 864e5
const KST_MS = 9 * 36e5
const MONDAY_OFFSET_MS = 4 * 864e5 // 1970-01-01은 목요일 → 첫 월요일은 1-05
const weekOf = (now = Date.now()) => Math.floor((now + KST_MS - MONDAY_OFFSET_MS) / WEEK_MS)
const weekStartOf = (week) => new Date(week * WEEK_MS + MONDAY_OFFSET_MS - KST_MS)

// 테마·주 → seed (테마마다 다른 순서가 나오게 키를 섞는다). 1 ~ 2^31-2
function weekSeed(themeKey, week) {
    let h = 2166136261
    for (const ch of `${themeKey}:${week}`) h = Math.imul(h ^ ch.charCodeAt(0), 16777619)
    return ((h >>> 0) % 2147483646) + 1
}

// 지난주 목록을 다시 계산해 감점 기준으로 쓴다. 지난주 목록도 그 전주를 감점해 만들었으므로 몇 주 거슬러
// 올라가서 계산한다(깊이 제한 — 그 이상은 영향이 거의 없다). 풀이 갱신되면 지난주 목록도 새 풀 기준으로 계산된다
const WEEK_DEPTH = 3
function buildWeekList(pool, themeKey, week, depth = WEEK_DEPTH) {
    const prev = depth > 0 ? buildWeekList(pool, themeKey, week - 1, depth - 1) : []
    return buildList(pool, weekSeed(themeKey, week), LIST, new Set(prev.map((s) => s.videoId)))
}

// 같은 함수 인스턴스가 살아 있는 동안 주간 목록 캐시 (테마·주·수집 시각이 같으면 같은 목록)
const weekCache = new Map()
async function weekListFor(theme, week) {
    const ck = `${theme.key}:${week}:${theme.lastRefreshedAt ? new Date(theme.lastRefreshedAt).getTime() : 0}`
    if (weekCache.has(ck)) return weekCache.get(ck)
    const pool = await loadPool(theme.key)
    const list = buildWeekList(pool, theme.key, week)
    if (weekCache.size > 50) weekCache.clear()
    weekCache.set(ck, list)
    return list
}

const loadPool = (key) => ThemeSong.find({ theme: key })
    .select('videoId title artist duration score tier foreign')
    .lean()

// 시드 고정 난수 (mulberry32) — 같은 seed면 같은 목록
function seeded(a) {
    return () => {
        a = (a + 0x6d2b79f5) | 0
        let t = Math.imul(a ^ (a >>> 15), 1 | a)
        t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
        return ((t ^ (t >>> 14)) >>> 0) / 4294967296
    }
}

/**
 * 후보 풀에서 50곡 고르기 (순수 함수 — 스크립트 dry-run 샘플에서도 쓴다)
 * 대표곡 5(core 상위, 항상 포함) + 핵심 30(나머지 core 점수 비례 랜덤) + 탐색 15(explore 균등 랜덤)
 * 해외곡은 전체 최대 5. 핵심 2곡 사이에 탐색 1곡꼴로 섞는다. 첫 곡은 국내곡(커버로 쓴다).
 * avoid(videoId Set) = 지난주에 나온 곡 — 대표곡 외에는 뽑힐 가중치를 opts.lastWeekWeight 배로
 */
function buildList(pool, seed, opts = LIST, avoid = new Set()) {
    const rnd = seeded(seed)
    const damp = (s) => (avoid.has(s.videoId) ? (opts.lastWeekWeight == null ? 1 : opts.lastWeekWeight) : 1)
    // 가중 비복원 추출 (Efraimidis-Spirakis): key = u^(1/w) 상위 n개
    const pickWeighted = (arr, n, w) => arr
        .map((s) => ({ s, k: Math.pow(rnd(), 1 / Math.max(w(s) * damp(s), 1e-6)) }))
        .sort((a, b) => b.k - a.k).slice(0, n).map((x) => x.s)
    const shuffle = (arr) => arr.map((s) => ({ s, k: rnd() })).sort((a, b) => a.k - b.k).map((x) => x.s)
    let foreignUsed = 0
    const capForeign = (arr, n) => arr.filter((s) => !s.foreign || foreignUsed++ < opts.foreignCap).slice(0, n)

    const core = pool.filter((s) => s.tier === 'core').sort((a, b) => b.score - a.score)
    const explore = pool.filter((s) => s.tier === 'explore')

    const fixed = capForeign(core.slice(0, opts.fixed + opts.foreignCap), opts.fixed)
    const rest = core.filter((s) => !fixed.includes(s))
    const corePicked = capForeign(pickWeighted(rest, opts.core + opts.foreignCap, (s) => s.score), opts.core)
    let explorePicked = pickWeighted(explore, opts.explore, () => 1)
    // 탐색 풀이 모자라면 남은 core로 채운다
    if (explorePicked.length < opts.explore) {
        const used = new Set([...fixed, ...corePicked])
        explorePicked = explorePicked.concat(capForeign(pickWeighted(rest.filter((s) => !used.has(s)), opts.explore - explorePicked.length, (s) => s.score), opts.explore))
    }

    const main = shuffle([...fixed, ...corePicked])
    const out = []
    const seen = new Set()
    const push = (s) => { if (!seen.has(s.videoId)) { seen.add(s.videoId); out.push(s) } }
    let ci = 0
    let ei = 0
    while (ci < main.length || ei < explorePicked.length) {
        for (let k = 0; k < 2 && ci < main.length; k++) push(main[ci++])
        if (ei < explorePicked.length) push(explorePicked[ei++])
    }
    // 첫 곡 = 커버. 해외곡이면 첫 국내곡을 맨 앞으로
    const firstDomestic = out.findIndex((s) => !s.foreign)
    if (firstDomestic > 0) out.unshift(out.splice(firstDomestic, 1)[0])
    return out
}

function toItem(s) {
    return {
        videoId: s.videoId,
        title: s.title,
        artist: s.artist,
        duration: s.duration,
        thumbnail: thumbnailOf(s.videoId),
        tier: s.tier,
    }
}

const thumbnailOf = (videoId) => `https://i.ytimg.com/vi/${videoId}/hqdefault.jpg`

// GET /api/themes
// cover = 이번 주 목록의 첫 곡(국내곡) 썸네일 — 앱 카드 그림. 앱이 테마별 그림을 들고 있지 않아도
// 정의 추가(배포 없음)만으로 새 테마 카드가 그려진다. 목록과 함께 매주 바뀐다
// listUpdatedAt = 이번 주 목록이 바뀐 시각(월요일 00:00 KST) — 화면의 "○월 ○일 업데이트"
// updatedAt = 후보 풀 수집 시각(관리자용. 예전 앱 호환으로 이름 유지)
async function listThemes(now = Date.now()) {
    const themes = await Theme.find({ active: true }).sort({ order: 1 }).lean()
    const week = weekOf(now)
    const lists = await Promise.all(themes.map((t) => weekListFor(t, week)))
    return themes.map((t, i) => ({
        key: t.key,
        name: t.name,
        songCount: t.lastStats ? (t.lastStats.core || 0) + (t.lastStats.explore || 0) : 0,
        updatedAt: t.lastRefreshedAt || null,
        listUpdatedAt: weekStartOf(week),
        cover: lists[i][0] ? thumbnailOf(lists[i][0].videoId) : null,
    }))
}

// GET /api/themes/:key?seed= — 없는(또는 비활성) 테마면 null
// seed 없음 = 이번 주 목록(기본). seed 있음 = 그 seed로 뽑은 목록(앱의 "아까 그 목록" 재현 — 주간 seed도 그대로 재현된다)
async function getThemePlaylist(key, seedParam, now = Date.now()) {
    const theme = await Theme.findOne({ key, active: true }).lean()
    if (!theme) return null
    const week = weekOf(now)
    const parsed = parseInt(seedParam, 10)
    const custom = Number.isFinite(parsed) && parsed > 0 && parsed !== weekSeed(key, week)
    const songs = custom ? buildList(await loadPool(key), parsed) : await weekListFor(theme, week)
    return {
        theme: { key: theme.key, name: theme.name },
        seed: custom ? parsed : weekSeed(key, week),
        updatedAt: theme.lastRefreshedAt || null,
        listUpdatedAt: weekStartOf(week),
        songs: songs.map(toItem),
    }
}

// ---------- 수집 반영 (scripts/refresh-themes.js 에서 호출) ----------

// 테마 정의 upsert. 정의에서 빠진 테마는 비활성(데이터는 남긴다)
async function syncThemeDefinitions(defs) {
    await Theme.bulkWrite(defs.map((d) => ({
        updateOne: {
            filter: { key: d.key },
            update: { $set: { name: d.name, order: d.order, active: true } },
            upsert: true,
        },
    })))
    await Theme.updateMany({ key: { $nin: defs.map((d) => d.key) } }, { $set: { active: false } })
}

// 이번 수집에 없는 테마들의 share (테마 특이성 계산용) → songKey → (theme → share)
async function loadShares(excludeKeys) {
    const rows = await ThemeSong.find({ theme: { $nin: excludeKeys } }).select('theme songKey share').lean()
    const shares = new Map()
    for (const r of rows) {
        if (!shares.has(r.songKey)) shares.set(r.songKey, new Map())
        shares.get(r.songKey).set(r.theme, r.share || 0)
    }
    return shares
}

/**
 * 한 테마의 수집 결과를 풀에 반영 (누적 + 감쇠).
 * 새 점수 = max(기존 점수 × 감쇠, 이번 점수). 안 보인 곡은 감쇠만, PRUNE 아래면 삭제.
 * 합(+)이 아니라 max인 이유: 같은 날 재실행해도 점수가 부풀지 않고, 신곡이 첫 주부터 제 점수로 들어온다.
 */
async function applyRefresh(themeKey, songs, { playlists }, now = new Date()) {
    const theme = await Theme.findOne({ key: themeKey }).lean()
    const days = theme && theme.lastRefreshedAt ? (now - new Date(theme.lastRefreshedAt)) / 864e5 : 0
    const decay = Math.pow(0.5, days / HALF_LIFE_DAYS)

    const rows = await ThemeSong.find({ theme: themeKey }).select('songKey videoId score').lean()
    const existing = new Map(rows.map((e) => [e.songKey, e]))
    // 🔴 songKey는 아티스트 별칭(헤이즈=heize)을 쓰는데, 별칭은 "그 실행에서 수집한 데이터"로만 학습된다.
    // 전 테마 실행과 한 테마 실행의 키가 달라질 수 있어(실측 rain 17곡) 키가 안 맞으면 같은 영상으로 찾는다
    const byVideo = new Map(rows.map((e) => [e.videoId, e]))
    const ops = []
    const result = { inserted: 0, updated: 0, decayed: 0, pruned: 0, decay }

    for (const s of songs) {
        let prev = existing.get(s.songKey)
        if (!prev) {
            const sameVideo = byVideo.get(s.videoId)
            if (sameVideo && existing.has(sameVideo.songKey)) prev = sameVideo
        }
        const score = Math.max(prev ? prev.score * decay : 0, s.score)
        ops.push({
            updateOne: {
                filter: prev ? { _id: prev._id } : { theme: themeKey, songKey: s.songKey },
                update: {
                    $set: {
                        songKey: s.songKey, videoId: s.videoId, title: s.title, artist: s.artist, duration: s.duration,
                        score, count: s.count, share: s.share, tier: s.tier, foreign: s.foreign, lastSeenAt: now,
                    },
                },
                upsert: !prev,
            },
        })
        result[prev ? 'updated' : 'inserted']++
        if (prev) existing.delete(prev.songKey)
    }
    for (const e of existing.values()) {
        const score = e.score * decay
        if (score < PRUNE_SCORE) {
            ops.push({ deleteOne: { filter: { _id: e._id } } })
            result.pruned++
        } else if (decay < 1) {
            ops.push({ updateOne: { filter: { _id: e._id }, update: { $set: { score } } } })
            result.decayed++
        }
    }
    if (ops.length) await ThemeSong.bulkWrite(ops, { ordered: false })

    const core = await ThemeSong.countDocuments({ theme: themeKey, tier: 'core' })
    const explore = await ThemeSong.countDocuments({ theme: themeKey, tier: 'explore' })
    await Theme.updateOne({ key: themeKey }, { $set: { lastRefreshedAt: now, lastStats: { playlists, core, explore } } })
    return { ...result, core, explore }
}

module.exports = {
    buildList,
    buildWeekList,
    weekOf,
    weekStartOf,
    weekSeed,
    listThemes,
    getThemePlaylist,
    syncThemeDefinitions,
    loadShares,
    applyRefresh,
}
