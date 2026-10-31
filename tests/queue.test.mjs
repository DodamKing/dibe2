// 재생 대기열 계산 테스트 — `npm test` (Node 내장 test runner, 의존성 없음)
import { test } from 'node:test'
import assert from 'node:assert/strict'
import {
    toSongItem, toVideoItem, startContext, advance, restart, stepBack, addUpNext, removeItems,
    moveUpNext, moveContext, jumpTo, setShuffle, upcomingContext, isFromContext, hasNext,
    queueLength, migrateLegacy, buildOrder, UP_NEXT_LIMIT,
} from '../utils/queue.js'

const empty = () => ({ currentTrack: null, upNext: [], context: null, history: [], shuffleOn: false, repeatMode: 'off', isQueueEnded: false })
const songs = n => Array.from({ length: n }, (_, i) => ({ songId: `s${i}`, title: `곡${i}`, artist: `가수${i}` }))
const items = n => songs(n).map(s => toSongItem(s, 'songId'))
const titles = list => list.map(i => i.title)
// 결정적인 "랜덤": 항상 0 → 셔플이 뒤집기처럼 동작
const rnd0 = () => 0

function started(n = 5, opts = {}) {
    return startContext({ ...empty(), ...opts.state }, { source: { type: 'chart', name: '차트' }, items: items(n), index: opts.index ?? 0, shuffle: opts.shuffle })
}

test('목록을 그 곡부터 재생하고 이어서 다음 곡으로 간다', () => {
    let s = started(5, { index: 2 })
    assert.equal(s.currentTrack.title, '곡2')
    assert.ok(isFromContext(s))
    s = advance(s).state
    assert.equal(s.currentTrack.title, '곡3')
    s = advance(s).state
    s = advance(s).state
    assert.equal(s.currentTrack.title, '곡4')
    assert.equal(s.isQueueEnded, true)
})

test('직접 넣은 곡이 먼저 나오고, 끝나면 목록으로 돌아간다', () => {
    let s = started(5)
    s = addUpNext(s, [toSongItem({ _id: 'u1', title: 'U1' }), toSongItem({ _id: 'u2', title: 'U2' })]).state
    s = advance(s).state
    assert.equal(s.currentTrack.title, 'U1')
    assert.equal(isFromContext(s), false)
    s = advance(s).state
    assert.equal(s.currentTrack.title, 'U2')
    s = advance(s).state
    assert.equal(s.currentTrack.title, '곡1')
})

test('"다음에 재생"은 맨 앞, "맨 뒤에 추가"는 맨 뒤', () => {
    let s = started(3)
    s = addUpNext(s, [toSongItem({ _id: 'a', title: 'A' })]).state
    s = addUpNext(s, [toSongItem({ _id: 'b', title: 'B' })], { front: true }).state
    assert.deepEqual(titles(s.upNext), ['B', 'A'])
})

test('같은 곡을 두 번 넣어도 따로 다룬다', () => {
    let s = started(2)
    const song = { _id: 'x', title: 'X' }
    s = addUpNext(s, [toSongItem(song), toSongItem(song)]).state
    assert.equal(s.upNext.length, 2)
    assert.notEqual(s.upNext[0].qid, s.upNext[1].qid)
    s = removeItems(s, [s.upNext[0].qid]).state
    assert.equal(s.upNext.length, 1)
})

test('직접 추가 한도는 upNext 에만 걸린다', () => {
    let s = started(3)
    const many = Array.from({ length: UP_NEXT_LIMIT + 5 }, (_, i) => toSongItem({ _id: `m${i}`, title: `m${i}` }))
    const r = addUpNext(s, many)
    assert.equal(r.added, UP_NEXT_LIMIT)
    assert.equal(r.full, true)
    assert.equal(addUpNext(r.state, [toSongItem({ _id: 'z' })]).added, 0)
    // 목록은 한도 없이 통째로
    const big = startContext(empty(), { source: {}, items: items(1500), index: 0 })
    assert.equal(big.context.items.length, 1500)
})

test('한 곡 반복: 곡이 끝나면 다시, 사용자가 누르면 넘어간다', () => {
    let s = started(3, { state: { repeatMode: 'one' } })
    assert.equal(advance(s, { auto: true }).result, 'replay')
    const r = advance(s, { auto: false })
    assert.equal(r.result, 'advanced')
    assert.equal(r.state.currentTrack.title, '곡1')
})

test('전체 반복: 끝나면 처음으로', () => {
    let s = started(2, { index: 1, state: { repeatMode: 'all' } })
    const r = advance(s, { auto: true })
    assert.equal(r.state.currentTrack.title, '곡0')
    assert.equal(r.state.isQueueEnded, false)
})

test('반복 없음: 끝나면 멈추고, 다시 재생하면 처음부터', () => {
    let s = started(2, { index: 1 })
    const r = advance(s, { auto: true })
    assert.equal(r.result, 'ended')
    assert.equal(r.state.currentTrack.title, '곡1')
    assert.equal(restart(r.state).currentTrack.title, '곡0')
    assert.equal(hasNext(s), false)
})

test('이전: 목록 곡이면 앞 곡, 첫 곡이면 갈 곳 없음', () => {
    let s = started(4, { index: 2 })
    s = stepBack(s)
    assert.equal(s.currentTrack.title, '곡1')
    assert.equal(stepBack(started(3)), null)
})

test('이전: 직접 넣은 곡에서 누르면 그 곡은 대기열 맨 앞으로 돌아가고, 다음을 누르면 다시 나온다', () => {
    let s = started(5) // 곡0
    s = addUpNext(s, [toSongItem({ _id: 'u1', title: 'U1' }), toSongItem({ _id: 'u2', title: 'U2' })]).state
    s = advance(s).state // U1
    s = advance(s).state // U2
    s = stepBack(s)
    assert.equal(s.currentTrack.title, 'U1')
    assert.deepEqual(titles(s.upNext), ['U2'])
    s = stepBack(s)
    assert.equal(s.currentTrack.title, '곡0')
    assert.ok(isFromContext(s))
    assert.deepEqual(titles(s.upNext), ['U1', 'U2'])
    s = advance(s).state
    assert.equal(s.currentTrack.title, 'U1')
})

test('목록 안에서 이전 → 다음 하면 원래 곡으로 돌아온다', () => {
    let s = started(5, { index: 3 })
    s = stepBack(s)
    s = advance(s).state
    assert.equal(s.currentTrack.title, '곡3')
})

test('셔플은 목록만 섞고 지금 곡을 맨 앞에 둔다', () => {
    let s = started(5, { index: 2 })
    s = addUpNext(s, [toSongItem({ _id: 'u', title: 'U' })]).state
    s = setShuffle(s, true, rnd0)
    assert.equal(s.currentTrack.title, '곡2')
    assert.ok(isFromContext(s))
    assert.equal(s.context.order[0], 2)
    assert.deepEqual(titles(s.upNext), ['U'])
    assert.equal(upcomingContext(s).length, 4)
    // 끄면 원래 순서, 지금 곡 자리 유지
    s = setShuffle(s, false)
    assert.equal(s.context.pos, 2)
    assert.deepEqual(titles(upcomingContext(s)), ['곡3', '곡4'])
})

test('직접 넣은 곡을 듣는 중 셔플을 켜면, 그 곡이 끝난 뒤 섞인 목록 맨 앞부터', () => {
    let s = started(4)
    s = addUpNext(s, [toSongItem({ _id: 'u', title: 'U' })]).state
    s = advance(s).state // U
    s = setShuffle(s, true, rnd0)
    assert.equal(s.context.pos, -1)
    assert.equal(upcomingContext(s).length, 4)
    s = advance(s).state
    assert.ok(isFromContext(s))
})

test('셔플 상태로 목록 시작: 누른 곡이 먼저', () => {
    const s = started(6, { index: 4, shuffle: true })
    assert.equal(s.currentTrack.title, '곡4')
    assert.equal(new Set(s.context.order).size, 6)
})

test('목록에서 곡을 빼면 순서·위치가 맞게 다시 매겨진다', () => {
    let s = started(5, { index: 1 })
    const q3 = s.context.items[3].qid
    const q0 = s.context.items[0].qid
    const r = removeItems(s, [q3, q0])
    s = r.state
    assert.equal(r.currentRemoved, false)
    assert.equal(s.currentTrack.title, '곡1')
    assert.ok(isFromContext(s))
    assert.deepEqual(titles(upcomingContext(s)), ['곡2', '곡4'])
})

test('지금 곡을 빼면 currentRemoved, 다음 advance 는 빠진 곡의 다음 곡', () => {
    let s = started(4, { index: 1 })
    const r = removeItems(s, [s.currentTrack.qid])
    assert.equal(r.currentRemoved, true)
    const next = advance({ ...r.state }).state
    assert.equal(next.currentTrack.title, '곡2')
})

test('목록 곡을 전부 빼면 목록이 사라진다', () => {
    let s = started(2)
    s = removeItems(s, s.context.items.map(i => i.qid)).state
    assert.equal(s.context, null)
    assert.equal(hasNext(s), false)
})

test('순서 바꾸기 — 다음에 재생 / 남은 목록', () => {
    let s = started(5)
    s = addUpNext(s, ['A', 'B', 'C'].map(t => toSongItem({ _id: t, title: t }))).state
    s = moveUpNext(s, 2, 0)
    assert.deepEqual(titles(s.upNext), ['C', 'A', 'B'])
    s = moveContext(s, 3, 0)
    assert.deepEqual(titles(upcomingContext(s)), ['곡4', '곡1', '곡2', '곡3'])
    assert.equal(s.currentTrack.title, '곡0')
})

test('패널에서 곡 누르기: 다음에 재생 곡이면 그 앞 곡들은 빠지고, 목록 곡이면 그 자리로', () => {
    let s = started(5)
    s = addUpNext(s, ['A', 'B', 'C'].map(t => toSongItem({ _id: t, title: t }))).state
    s = jumpTo(s, s.upNext[1].qid)
    assert.equal(s.currentTrack.title, 'B')
    assert.deepEqual(titles(s.upNext), ['C'])
    s = jumpTo(s, s.context.items[3].qid)
    assert.equal(s.currentTrack.title, '곡3')
    assert.deepEqual(titles(s.upNext), ['C'])
    assert.equal(advance(s).state.currentTrack.title, 'C')
})

test('유튜브 곡 항목', () => {
    const v = toVideoItem({ videoId: 'abc', title: '빗소리', artist: '가수', thumbnail: 't.jpg' })
    assert.equal(v.kind, 'video')
    assert.equal(v._id, undefined)
    assert.equal(v.coverUrl, 't.jpg')
    assert.equal(toVideoItem({ title: 'x' }), null)
    assert.match(toVideoItem({ videoId: 'zz', title: 'y' }).coverUrl, /i\.ytimg\.com\/vi\/zz\//)
})

test('곡 id 가 없는 차트 항목도 들어간다(재생 직전에 찾는다)', () => {
    const it = toSongItem({ title: 'T', artist: 'A' }, 'songId')
    assert.equal(it._id, undefined)
    assert.equal(it.kind, 'song')
})

test('queueLength', () => {
    let s = started(5, { index: 1 })
    s = addUpNext(s, [toSongItem({ _id: 'u' })]).state
    assert.equal(queueLength(s), 1 + 1 + 3)
})

test('buildOrder', () => {
    assert.deepEqual(buildOrder(3, false), [0, 1, 2])
    const o = buildOrder(5, true, 3)
    assert.equal(o[0], 3)
    assert.equal(new Set(o).size, 5)
})

// ── 옛 저장 형식 변환 ──
const legacy = ids => ids.map(id => ({ _id: id, title: `T${id}`, artist: 'A', coverUrl: '' }))

test('옛 큐 변환 — 보통', () => {
    const r = migrateLegacy({ queue: legacy(['a', 'b', 'c']), originalQueue: [], currentTrack: { _id: 'b' }, shuffleOn: false })
    assert.equal(r.context.source.type, 'legacy')
    assert.equal(r.currentTrack._id, 'b')
    assert.equal(r.context.pos, 1)
    assert.deepEqual(titles(upcomingContext({ ...r, history: [] })), ['Tc'])
})

test('옛 큐 변환 — 셔플 중이면 original_queue 가 원래 순서, 섞인 순서는 그대로', () => {
    const r = migrateLegacy({ queue: legacy(['c', 'a', 'b']), originalQueue: legacy(['a', 'b', 'c']), currentTrack: { _id: 'c' }, shuffleOn: true })
    assert.deepEqual(r.context.items.map(i => i._id), ['a', 'b', 'c'])
    assert.deepEqual(r.context.order, [2, 0, 1])
    assert.equal(r.context.pos, 0)
    assert.equal(r.currentTrack._id, 'c')
})

test('옛 큐 변환 — null 항목 버림, 큐에 없는 지금 곡은 맨 앞에', () => {
    const r = migrateLegacy({ queue: [null, ...legacy(['a']), null], originalQueue: null, currentTrack: { _id: 'z', title: 'Tz' }, shuffleOn: false })
    assert.deepEqual(r.context.items.map(i => i._id), ['z', 'a'])
    assert.equal(r.currentTrack._id, 'z')
})

test('옛 큐 변환 — 아무것도 없으면 null', () => {
    assert.equal(migrateLegacy({ queue: [], originalQueue: [], currentTrack: null, shuffleOn: false }), null)
})
