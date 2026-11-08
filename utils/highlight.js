// 검색어와 맞은 부분을 나눈다 — [{ t, hit }]. 띄어쓰기·기호·대소문자는 무시하고 맞춘다("좋은날" → "좋은 날"의 "좋은 날").
// 초성·한영 자판 변환·오타로 맞은 곡은 글자가 안 겹치므로 강조 없이 통째로 돌려준다. v-html 없이 쓰려고 조각으로 돌려준다
const keep = (c) => /[\p{L}\p{N}]/u.test(c)

export function highlightParts(text, query) {
    const s = String(text || '')
    const q = [...String(query || '').toLowerCase()].filter(keep).join('')
    if (!s || !q) return [{ t: s, hit: false }]
    // 원문 글자 위치를 기억하며 정규화
    const chars = [...s]
    const norm = []
    const pos = []
    chars.forEach((c, i) => { if (keep(c)) { norm.push(c.toLowerCase()); pos.push(i) } })
    // 토큰별로(띄어쓴 검색어) 첫 일치 구간을 표시
    const hit = new Array(chars.length).fill(false)
    const tokens = String(query).toLowerCase().split(/\s+/).map((t) => [...t].filter(keep).join('')).filter(Boolean)
    const joined = norm.join('')
    for (const tok of [q, ...tokens]) {
        const at = joined.indexOf(tok)
        if (at < 0) continue
        const from = pos[at]
        const to = pos[at + [...tok].length - 1]
        for (let i = from; i <= to; i++) hit[i] = true
        if (tok === q) break // 붙여 쓴 전체가 맞으면 그걸로 충분
    }
    const out = []
    chars.forEach((c, i) => {
        const last = out[out.length - 1]
        if (last && last.hit === hit[i]) last.t += c
        else out.push({ t: c, hit: hit[i] })
    })
    return out
}
