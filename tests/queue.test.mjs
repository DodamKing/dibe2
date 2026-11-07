// 재생 대기열 계산 테스트 — `npm test` (Node 내장 test runner, 의존성 없음)
// 구조: 한 줄 목록 + 지금 위치 (utils/queue.js 머리말)
import { test } from 'node:test'
import assert from 'node:assert/strict'
import {
    toSongItem, toVideoItem, startContext, advance, restart, stepBack, addToQueue, removeItems,
    moveInQueue, othersThanCurrent, queueItems, jumpTo, setShuffle, upcomingContext, playedContext, hasNext,
    queueLength, migrateLegacy, mergeUpNext, buildOrder, ADD_LIMIT,
} from '../utils/queue.js'

const empty = () => ({ currentTrack: null, context: null, shuffleOn: false, repeatMode: 'off', isQueueEnded: false })
const songs = n => Array.from({ length: n }, (_, i) => ({ songId: `s${i}`, title: `곡${i}`, artist: `가수${i}` }))
const items = n => songs(n).map(s => toSongItem(s, 'songId'))
const titles = list => list.map(i => i.title)
const song = t => toSongItem({ _id: t, title: t })
// 재생 순서 전체(들은 곡 + 지금 + 다음)
const whole = s => s.context.order.map(i => s.context.items[i].title)
// 결정적인 "랜덤": 항상 0 → 셔플이 뒤집기처럼 동작
const rnd0 = () => 0

function started(n = 5, opts = {}) {
    return startContext({ ...empty(), ...opts.state }, { source: { type: 'chart', name: '차트' }, items: items(n), index: opts.index ?? 0, shuffle: opts.shuffle })
}

// ── 이번 버그(2026-11-07) ──

test('버그: 검색에서 한 곡 재생 + 뒤에 추가 → 다 듣고 나도 추가한 곡이 남고, 전체 반복이면 전부 돈다', () => {
    let s = startContext({ ...empty(), repeatMode: 'all' }, { source: { type: 'search', name: '"약속" 검색' }, items: [song('A')], index: 0 })
    s = addToQueue(s, [song('B'), song('C')]).state
    assert.deepEqual(whole(s), ['A', 'B', 'C'])
    s = advance(s, { auto: true }).state
    assert.equal(s.currentTrack.title, 'B')
    s = advance(s, { auto: true }).state
    assert.equal(s.currentTrack.title, 'C')
    // 예전엔 여기서 A 하나만 남아 A 만 반복됐다
    s = advance(s, { auto: true }).state
    assert.equal(s.currentTrack.title, 'A')
    s = advance(s, { auto: true }).state
    assert.equal(s.currentTrack.title, 'B')
    assert.deepEqual(whole(s), ['A', 'B', 'C'])
})

test('버그: 반복 없음이면 끝에서 멈추고, 다시 재생하면 처음부터 전부', () => {
    let s = startContext(empty(), { source: {}, items: [song('A')], index: 0 })
    s = addToQueue(s, [song('B')]).state
    s = advance(s, { auto: true }).state
    const r = advance(s, { auto: true })
    assert.equal(r.result, 'ended')
    const again = restart(r.state)
    assert.equal(again.currentTrack.title, 'A')
    assert.deepEqual(whole(again), ['A', 'B'])
})

// ── 기본 ──

test('목록을 그 곡부터 재생하고 이어서 다음 곡으로 간다', () => {
    let s = started(5, { index: 2 })
    assert.equal(s.currentTrack.title, '곡2')
    s = advance(s).state
    assert.equal(s.currentTrack.title, '곡3')
    s = advance(s).state
    const r = advance(s)
    assert.equal(r.state.currentTrack.title, '곡4')
    assert.equal(r.state.isQueueEnded, true)
})

test('들은 곡은 목록 위쪽에 남는다', () => {
    let s = started(4)
    s = advance(s).state
    s = advance(s).state
    assert.deepEqual(titles(playedContext(s)), ['곡0', '곡1'])
    assert.deepEqual(titles(upcomingContext(s)), ['곡3'])
})

test('"다음에 재생"은 지금 곡 바로 뒤, "맨 뒤에 추가"는 끝', () => {
    let s = started(3) // 곡0 재생 중
    s = addToQueue(s, [song('A')]).state
    s = addToQueue(s, [song('B')], { front: true }).state
    assert.deepEqual(whole(s), ['곡0', 'B', '곡1', '곡2', 'A'])
    // 연달아 "다음에 재생"하면 마지막에 넣은 곡이 가장 먼저(멜론과 같음)
    s = addToQueue(s, [song('C')], { front: true }).state
    assert.deepEqual(titles(upcomingContext(s)).slice(0, 2), ['C', 'B'])
})

test('여러 곡을 한 번에 "다음에 재생"하면 넣은 순서대로', () => {
    let s = started(3, { index: 1 })
    s = addToQueue(s, [song('A'), song('B')], { front: true }).state
    assert.deepEqual(whole(s), ['곡0', '곡1', 'A', 'B', '곡2'])
    assert.equal(s.currentTrack.title, '곡1')
})

test('비어 있을 때 추가하면 첫 곡이 지금 곡, 목록 이름은 "재생 대기열"', () => {
    const r = addToQueue(empty(), [song('A'), song('B')])
    assert.equal(r.state.currentTrack.title, 'A')
    assert.equal(r.state.context.source.name, '재생 대기열')
    assert.deepEqual(titles(upcomingContext(r.state)), ['B'])
})

test('대기열이 끝나 멈춘 뒤 추가하면, 재생은 방금 넣은 곡부터', () => {
    let s = started(2, { index: 1 })
    s = advance(s, { auto: true }).state
    assert.equal(s.isQueueEnded, true)
    s = addToQueue(s, [song('A')]).state
    assert.equal(s.isQueueEnded, false)
    assert.equal(s.currentTrack.title, 'A')
})

test('같은 곡을 두 번 넣어도 따로 다룬다', () => {
    let s = started(2)
    const x = { _id: 'x', title: 'X' }
    s = addToQueue(s, [toSongItem(x), toSongItem(x)]).state
    const xs = s.context.items.filter(i => i.title === 'X')
    assert.equal(xs.length, 2)
    assert.notEqual(xs[0].qid, xs[1].qid)
    s = removeItems(s, [xs[0].qid]).state
    assert.equal(s.context.items.filter(i => i.title === 'X').length, 1)
})

test('직접 추가 한도는 직접 넣은 곡에만(500), 목록 통째 재생은 한도 없음', () => {
    assert.equal(ADD_LIMIT, 500)
    const many = Array.from({ length: ADD_LIMIT + 5 }, (_, i) => song(`m${i}`))
    const r = addToQueue(started(3), many)
    assert.equal(r.added, ADD_LIMIT)
    assert.equal(r.full, true)
    assert.equal(addToQueue(r.state, [song('z')]).added, 0)
    const big = startContext(empty(), { source: {}, items: items(1500), index: 0 })
    assert.equal(big.context.items.length, 1500)
    assert.equal(addToQueue(big, [song('z')]).added, 1)
})

// ── 반복·이전 ──

test('한 곡 반복: 곡이 끝나면 다시, 사용자가 누르면 넘어간다', () => {
    const s = started(3, { state: { repeatMode: 'one' } })
    assert.equal(advance(s, { auto: true }).result, 'replay')
    const r = advance(s, { auto: false })
    assert.equal(r.result, 'advanced')
    assert.equal(r.state.currentTrack.title, '곡1')
})

test('전체 반복: 끝나면 처음으로', () => {
    const s = started(2, { index: 1, state: { repeatMode: 'all' } })
    const r = advance(s, { auto: true })
    assert.equal(r.state.currentTrack.title, '곡0')
    assert.equal(r.state.isQueueEnded, false)
})

test('반복 없음: 끝나면 멈추고, 다시 재생하면 처음부터', () => {
    const s = started(2, { index: 1 })
    const r = advance(s, { auto: true })
    assert.equal(r.result, 'ended')
    assert.equal(r.state.currentTrack.title, '곡1')
    assert.equal(restart(r.state).currentTrack.title, '곡0')
    assert.equal(hasNext(s), false)
})

test('이전: 앞 곡으로(추가한 곡도 똑같이), 첫 곡이면 갈 곳 없음 / 전체 반복이면 마지막 곡', () => {
    let s = started(3)
    s = addToQueue(s, [song('A')], { front: true }).state
    s = advance(s).state // A
    s = advance(s).state // 곡1
    s = stepBack(s)
    assert.equal(s.currentTrack.title, 'A')
    s = stepBack(s)
    assert.equal(s.currentTrack.title, '곡0')
    assert.equal(stepBack(s), null)
    assert.equal(stepBack({ ...s, repeatMode: 'all' }).currentTrack.title, '곡2')
})

// ── 셔플 ──

test('셔플: 지금 곡을 맨 앞에, 끄면 원래 순서의 지금 곡 자리로', () => {
    let s = started(5, { index: 2 })
    s = setShuffle(s, true, rnd0)
    assert.equal(s.currentTrack.title, '곡2')
    assert.equal(s.context.order[0], 2)
    assert.equal(upcomingContext(s).length, 4)
    s = setShuffle(s, false)
    assert.equal(s.context.pos, 2)
    assert.deepEqual(titles(upcomingContext(s)), ['곡3', '곡4'])
})

test('셔플 중 "다음에 재생"한 곡은 바로 다음, 셔플을 꺼도 지금 곡 바로 뒤에 있다', () => {
    let s = started(5, { index: 2 })
    s = setShuffle(s, true, rnd0)
    s = addToQueue(s, [song('A')], { front: true }).state
    assert.equal(upcomingContext(s)[0].title, 'A')
    s = setShuffle(s, false)
    assert.deepEqual(titles(upcomingContext(s)), ['A', '곡3', '곡4'])
})

test('셔플 상태로 목록 시작: 누른 곡이 먼저', () => {
    const s = started(6, { index: 4, shuffle: true })
    assert.equal(s.currentTrack.title, '곡4')
    assert.equal(new Set(s.context.order).size, 6)
})

// ── 빼기·옮기기·바로 재생 ──

test('곡을 빼면 순서·위치가 맞게 다시 매겨진다', () => {
    let s = started(5, { index: 1 })
    const r = removeItems(s, [s.context.items[3].qid, s.context.items[0].qid])
    s = r.state
    assert.equal(r.currentRemoved, false)
    assert.equal(s.currentTrack.title, '곡1')
    assert.deepEqual(titles(upcomingContext(s)), ['곡2', '곡4'])
    assert.deepEqual(titles(playedContext(s)), [])
})

test('지금 곡을 빼면 currentRemoved, 다음 advance 는 빠진 곡의 다음 곡', () => {
    const s = started(4, { index: 1 })
    const r = removeItems(s, [s.currentTrack.qid])
    assert.equal(r.currentRemoved, true)
    assert.equal(advance(r.state).state.currentTrack.title, '곡2')
})

test('전부 빼면 목록이 사라지고, 그 뒤 추가하면 새 목록', () => {
    let s = started(2)
    s = removeItems(s, s.context.items.map(i => i.qid)).state
    assert.equal(s.context, null)
    assert.equal(hasNext(s), false)
    s = addToQueue({ ...s, currentTrack: null }, [song('A')]).state
    assert.equal(s.currentTrack.title, 'A')
})

test('곡을 다 빼서 지금 곡이 없을 때 추가하면 넣은 곡이 지금 곡', () => {
    let s = started(3, { index: 2 })
    s = { ...s, currentTrack: null }
    s = addToQueue(s, [song('A')]).state
    assert.equal(s.currentTrack.title, 'A')
    assert.equal(s.context.items[s.context.order[s.context.pos]].title, 'A')
})

test('순서 바꾸기 — 다음 곡끼리', () => {
    let s = started(5) // 곡0 재생 중
    s = moveInQueue(s, 4, 1)
    assert.deepEqual(titles(queueItems(s)), ['곡0', '곡4', '곡1', '곡2', '곡3'])
    assert.equal(s.currentTrack.title, '곡0')
    assert.equal(advance(s).state.currentTrack.title, '곡4')
})

test('순서 바꾸기 — 다음 곡을 지금 곡 위로 올리면 지난 곡이 되고, 지금 곡 다음이 바뀐다', () => {
    let s = started(3) // 곡0 재생 중, 다음 곡1
    s = moveInQueue(s, 1, 0)
    assert.deepEqual(titles(queueItems(s)), ['곡1', '곡0', '곡2'])
    assert.equal(s.currentTrack.title, '곡0')
    assert.equal(s.context.pos, 1)
    assert.equal(advance(s).state.currentTrack.title, '곡2')
})

test('순서 바꾸기 — 지금 곡을 옮겨도 재생은 그대로, 위치가 따라간다', () => {
    let s = started(4, { index: 1 }) // 곡1 재생 중
    s = moveInQueue(s, 1, 3)
    assert.deepEqual(titles(queueItems(s)), ['곡0', '곡2', '곡3', '곡1'])
    assert.equal(s.currentTrack.title, '곡1')
    assert.equal(s.context.pos, 3)
    assert.equal(hasNext(s), false)
})

test('비우기 — 지금 곡만 남긴다', () => {
    let s = started(4, { index: 2 })
    s = removeItems(s, othersThanCurrent(s).map(i => i.qid)).state
    assert.deepEqual(titles(queueItems(s)), ['곡2'])
    assert.equal(s.currentTrack.title, '곡2')
    assert.equal(s.context.pos, 0)
})

test('패널에서 곡 누르기: 다음 곡이든 들은 곡이든 그 자리로', () => {
    let s = started(5)
    s = jumpTo(s, s.context.items[3].qid)
    assert.equal(s.currentTrack.title, '곡3')
    assert.deepEqual(titles(playedContext(s)), ['곡0', '곡1', '곡2'])
    s = jumpTo(s, s.context.items[1].qid)
    assert.equal(s.currentTrack.title, '곡1')
    assert.equal(advance(s).state.currentTrack.title, '곡2')
})

// ── 항목 ──

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

test('queueLength = 지금 곡 + 다음 곡들', () => {
    let s = started(5, { index: 1 })
    s = addToQueue(s, [song('u')]).state
    assert.equal(queueLength(s), 1 + 4)
})

test('buildOrder', () => {
    assert.deepEqual(buildOrder(3, false), [0, 1, 2])
    const o = buildOrder(5, true, 3)
    assert.equal(o[0], 3)
    assert.equal(new Set(o).size, 5)
})

// ── 2구역 시절 저장분 합치기 ──

test('2구역 저장분: 들은 목록 곡 → 지금 곡 → 다음에 재생 곡 → 남은 목록 곡', () => {
    const s = started(4, { index: 1 }) // 곡1 재생 중(목록 곡)
    const r = mergeUpNext({ context: s.context, upNext: [song('U1'), song('U2')], currentTrack: s.currentTrack })
    const m = { ...empty(), ...r }
    assert.equal(m.currentTrack.title, '곡1')
    assert.deepEqual(whole(m), ['곡0', '곡1', 'U1', 'U2', '곡2', '곡3'])
    assert.ok(m.context.items.find(i => i.title === 'U1').added)
})

test('2구역 저장분: "다음에 재생" 곡을 듣던 중이었으면 그 곡이 목록 지금 자리 바로 뒤로', () => {
    const s = started(3) // 목록 pos=0 (곡0)
    const r = mergeUpNext({ context: s.context, upNext: [song('U2')], currentTrack: song('U1') })
    const m = { ...empty(), ...r }
    assert.equal(m.currentTrack.title, 'U1')
    assert.deepEqual(whole(m), ['곡0', 'U1', 'U2', '곡1', '곡2'])
    assert.equal(advance(m).state.currentTrack.title, 'U2')
})

test('2구역 저장분: 목록 없이 다음에 재생 곡만 있었으면 그걸로 목록', () => {
    const r = mergeUpNext({ context: null, upNext: [song('U2')], currentTrack: song('U1') })
    assert.deepEqual(r.context.items.map(i => i.title), ['U1', 'U2'])
    assert.equal(r.currentTrack.title, 'U1')
    assert.equal(mergeUpNext({ context: null, upNext: [], currentTrack: null }).context, null)
})

test('새 형식 저장분은 그대로', () => {
    const s = started(3, { index: 1 })
    const r = mergeUpNext({ context: s.context, upNext: undefined, currentTrack: s.currentTrack })
    assert.deepEqual(r.context, s.context)
    assert.equal(r.currentTrack.qid, s.currentTrack.qid)
})

// ── 옛 저장 형식(배열 하나) 변환 ──
const legacy = ids => ids.map(id => ({ _id: id, title: `T${id}`, artist: 'A', coverUrl: '' }))

test('옛 큐 변환 — 보통', () => {
    const r = migrateLegacy({ queue: legacy(['a', 'b', 'c']), originalQueue: [], currentTrack: { _id: 'b' }, shuffleOn: false })
    assert.equal(r.context.source.type, 'legacy')
    assert.equal(r.currentTrack._id, 'b')
    assert.equal(r.context.pos, 1)
    assert.deepEqual(titles(upcomingContext(r)), ['Tc'])
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
