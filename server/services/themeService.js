const { Theme, ThemeSong } = require('../models')

// 상세 설계는 docs/THEME_PLAYLIST.md
const HALF_LIFE_DAYS = 45 // 수집에서 안 보이게 된 곡의 점수 반감기
const PRUNE_SCORE = 0.05  // 감쇠로 이 아래가 되면 풀에서 삭제

const LIST = { fixed: 15, core: 20, explore: 15, foreignCap: 5 }

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
 * 대표곡 15(core 상위, 항상 포함) + 핵심 20(나머지 core 점수 비례 랜덤) + 탐색 15(explore 균등 랜덤)
 * 해외곡은 전체 최대 5. 핵심 2곡 사이에 탐색 1곡꼴로 섞는다.
 */
function buildList(pool, seed, opts = LIST) {
    const rnd = seeded(seed)
    // 가중 비복원 추출 (Efraimidis-Spirakis): key = u^(1/w) 상위 n개
    const pickWeighted = (arr, n, w) => arr
        .map((s) => ({ s, k: Math.pow(rnd(), 1 / Math.max(w(s), 1e-6)) }))
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
    return out
}

function toItem(s) {
    return {
        videoId: s.videoId,
        title: s.title,
        artist: s.artist,
        duration: s.duration,
        thumbnail: `https://i.ytimg.com/vi/${s.videoId}/hqdefault.jpg`,
        tier: s.tier,
    }
}

// GET /api/themes
async function listThemes() {
    const themes = await Theme.find({ active: true }).sort({ order: 1 }).lean()
    return themes.map((t) => ({
        key: t.key,
        name: t.name,
        songCount: t.lastStats ? (t.lastStats.core || 0) + (t.lastStats.explore || 0) : 0,
        updatedAt: t.lastRefreshedAt || null,
    }))
}

// GET /api/themes/:key?seed= — 없는(또는 비활성) 테마면 null
async function getThemePlaylist(key, seedParam) {
    const theme = await Theme.findOne({ key, active: true }).lean()
    if (!theme) return null
    const pool = await ThemeSong.find({ theme: key })
        .select('videoId title artist duration score tier foreign')
        .lean()
    const parsed = parseInt(seedParam, 10)
    const seed = Number.isFinite(parsed) && parsed > 0 ? parsed : Math.floor(Math.random() * 2147483646) + 1
    return {
        theme: { key: theme.key, name: theme.name },
        seed,
        updatedAt: theme.lastRefreshedAt || null,
        songs: buildList(pool, seed).map(toItem),
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
    listThemes,
    getThemePlaylist,
    syncThemeDefinitions,
    loadShares,
    applyRefresh,
}
