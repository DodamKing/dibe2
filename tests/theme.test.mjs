// 테마 주간 목록 테스트 — `npm test`. 구조: docs/THEME_PLAYLIST.md "50곡 구성"
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { createRequire } from 'node:module'

const require = createRequire(import.meta.url)
const { buildList, buildWeekList, weekOf, weekStartOf } = require('../server/services/themeService.js')

const pool = [
    ...Array.from({ length: 120 }, (_, i) => ({ videoId: `c${i}`, tier: 'core', score: 100 - i * 0.5, foreign: i % 10 === 0 })),
    ...Array.from({ length: 80 }, (_, i) => ({ videoId: `e${i}`, tier: 'explore', score: 0.3, foreign: false })),
]
const ids = (l) => l.map((s) => s.videoId)

test('주 경계는 월요일 00:00 KST', () => {
    const mon = Date.parse('2026-11-02T00:00:00+09:00')
    assert.equal(weekOf(mon), weekOf(mon + 6 * 864e5 + 86399e3))
    assert.equal(weekOf(mon - 1), weekOf(mon) - 1)
    assert.equal(weekStartOf(weekOf(mon)).getTime(), mon)
})

test('같은 주는 같은 목록, 50곡, 중복 없음', () => {
    const a = buildWeekList(pool, 'rain', 100)
    assert.deepEqual(ids(a), ids(buildWeekList(pool, 'rain', 100)))
    assert.equal(a.length, 50)
    assert.equal(new Set(ids(a)).size, 50)
})

test('대표곡(core 점수 상위 5)은 매주 들어간다', () => {
    const top = pool.filter((s) => s.tier === 'core').slice(0, 5).map((s) => s.videoId)
    for (const w of [100, 101, 102]) {
        const l = ids(buildWeekList(pool, 'rain', w))
        for (const id of top) assert.ok(l.includes(id), `${w}주에 ${id} 없음`)
    }
})

test('지난주 곡은 덜 나온다', () => {
    let damped = 0
    let plain = 0
    for (let w = 100; w < 120; w++) {
        const prev = new Set(ids(buildWeekList(pool, 'rain', w - 1)))
        const overlap = (l) => l.filter((s) => prev.has(s.videoId)).length
        damped += overlap(buildWeekList(pool, 'rain', w))
        plain += overlap(buildList(pool, 1000 + w)) // 감점 없이 뽑은 목록
    }
    assert.ok(damped < plain, `감점 ${damped} >= 감점 없음 ${plain}`)
})

test('첫 곡(커버)은 국내곡, 해외곡은 최대 5', () => {
    for (let w = 100; w < 130; w++) {
        const l = buildWeekList(pool, 'rain', w)
        assert.equal(l[0].foreign, false)
        assert.ok(l.filter((s) => s.foreign).length <= 5)
    }
})
