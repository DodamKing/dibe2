// 최근 검색어 — 이 브라우저(localStorage)에만 남는다. 음원·영상은 키를 따로(2026-11-08, docs/SEARCH.md)
// 사생활 모드·저장소 막힘이면 조용히 빈 목록
const MAX = 10
const keyOf = (kind) => `dibe2_recent_search_${kind}`

export function getRecent(kind) {
    try {
        const v = JSON.parse(localStorage.getItem(keyOf(kind)) || '[]')
        return Array.isArray(v) ? v.filter((s) => typeof s === 'string') : []
    } catch (e) {
        return []
    }
}

function save(kind, list) {
    try { localStorage.setItem(keyOf(kind), JSON.stringify(list.slice(0, MAX))) } catch (e) { /* 저장 못 해도 검색은 된다 */ }
}

export function addRecent(kind, query) {
    const q = String(query || '').trim()
    if (!q) return getRecent(kind)
    const list = [q, ...getRecent(kind).filter((s) => s !== q)].slice(0, MAX)
    save(kind, list)
    return list
}

export function removeRecent(kind, query) {
    const list = getRecent(kind).filter((s) => s !== query)
    save(kind, list)
    return list
}

export function clearRecent(kind) {
    save(kind, [])
    return []
}
