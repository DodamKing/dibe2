// 음원 검색 테스트 — `npm test`. 구조: docs/SEARCH.md
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { createRequire } from 'node:module'

const require = createRequire(import.meta.url)
const { normalize, chosung, toJamo, engToKor, fuzzyDistance } = require('../server/utils/searchText.js')
const svc = require('../server/services/searchService.js')

test('정규화·초성·자모', () => {
    assert.equal(normalize('아이유 (IU)'), '아이유iu')
    assert.equal(chosung('아이유iu'), 'ㅇㅇㅇiu')
    assert.equal(toJamo('와닭'), 'ㅇㅗㅏㄷㅏㄹㄱ')
})

test('한영 자판 변환', () => {
    assert.equal(engToKor('dkdldb'), '아이유')
    assert.equal(engToKor('tkfkdgo'), '사랑해')
    assert.equal(engToKor('gksrmf'), '한글')
    assert.equal(engToKor('dkssud'), '안녕')
    assert.equal(engToKor('ekfrrhkdlf'), '닭과일') // 겹받침 뒤 모음 → 뒤 낱자가 넘어감
    assert.equal(engToKor('love'), null) // 한글 음절이 안 나오면 변환 안 함
    assert.equal(engToKor('아이유'), null)
})

test('부분 문자열 오타 거리', () => {
    assert.equal(fuzzyDistance(toJamo('아이우'), toJamo('아이유'), 2), 1)
    assert.equal(fuzzyDistance('suprnatural', 'supernatural', 2), 1)
    assert.equal(fuzzyDistance(toJamo('밤편지'), toJamo('좋은날'), 2), 3) // max 초과 = max+1
})

const rows = [
    { _id: 'a1', title: '밤편지', artist: '아이유(IU)', album: '팔레트', playCount: 50 },
    { _id: 'a2', title: '좋은 날', artist: '아이유(IU)', album: 'REAL', playCount: 30 },
    { _id: 'a3', title: 'Love wins all', artist: 'IU', album: 'The Winning', playCount: 5 }, // 영어로만 적힌 같은 가수
    { _id: 'b1', title: '비 오는 날 듣기 좋은 노래', artist: '에픽하이 (EPIK HIGH)', album: 'X', playCount: 100 },
    { _id: 'b2', title: '참 좋은 날', artist: '이찬원', album: 'Y', playCount: 1 },
    { _id: 'c1', title: '소년만화', artist: 'QWER', album: '2nd Mini', playCount: 9 },
    { _id: 'd1', title: '갑자기', artist: '아이오아이(I.O.I)', album: 'Z', playCount: 9 },
    { _id: 'e1', title: '아이 좋아', artist: '린(LYn)', album: 'W', playCount: 0 },
]
svc._resetForTest(svc.indexFromRows(rows))
const ids = async (q, type) => (await svc.search(q, type)).items.map((x) => x.id)

test('초성·자판 변환·앨범', async () => {
    assert.deepEqual(await ids('ㅂㅍㅈ'), ['a1'])
    assert.deepEqual(await ids('ㅅㄴㅁㅎ'), ['c1'])
    assert.deepEqual((await ids('dkdldb')).slice(0, 3).sort(), ['a1', 'a2', 'a3'])
    assert.deepEqual(await ids('팔레트'), ['a1'])
    assert.deepEqual(await ids('팔레트', 'title'), []) // 제목 탭은 앨범을 안 본다
})

test('자동 별칭 — "아이유(IU)"에서 배워 "IU"로만 적힌 곡도 "아이유"로 찾는다', async () => {
    assert.ok((await ids('아이유')).includes('a3'))
})

test('정렬 — 정확 일치가 위, 여러 단어는 붙여 맞은 곡이 위', async () => {
    assert.equal((await ids('좋은 날'))[0], 'a2')
    assert.ok((await ids('좋은 날')).indexOf('b2') < (await ids('좋은 날')).indexOf('b1'))
})

test('오타는 정확히 맞는 게 없을 때만, 길이가 비슷한 쪽이 위', async () => {
    const r = await svc.search('아이우')
    assert.equal(r.fuzzy, true)
    assert.notEqual(r.items[0].id, 'd1')
    assert.equal((await svc.search('밤편지')).fuzzy, false)
})

test('자동완성 곡 칸 — 제목으로 맞은 곡 먼저, 모자라면 가수 등으로 채운다', async () => {
    const a = await svc.suggest('아이')
    assert.equal(a.songs[0]._id, 'e1') // 인기 낮아도 제목 일치가 가수로 맞은 곡(아이유·아이오아이)보다 위
    assert.equal(a.songs.length, 5)
    assert.equal(a.artists[0].name.includes('아이'), true)
    const b = await svc.suggest('아이유 좋은')
    assert.deepEqual(b.songs.map((x) => x._id), ['a2']) // 제목만으론 0곡 → 전체 순위로 채움
})

// 색인이 아직 없을 때(콜드 스타트 첫 요청) — DB 를 가짜로 바꿔 끼운다.
// 전체 읽기(all)는 손으로 풀 때까지 안 끝난다 → 끝나기 전에 답이 오면 임시 색인으로 답한 것
function coldStart() {
    let release
    const state = { loaded: false, quickCalls: 0 }
    svc._resetForTest(null)
    svc._source.all = () => new Promise((resolve) => { release = () => { state.loaded = true; resolve(rows) } })
    svc._source.matching = async (filter, limit) => {
        state.quickCalls++
        const hit = (r) => filter.$and.every((c) => c.$or.some((o) => {
            const [f, { $regex }] = Object.entries(o)[0]
            return $regex.test(String(r[f] || ''))
        }))
        return rows.filter(hit).sort((a, b) => (b.playCount || 0) - (a.playCount || 0)).slice(0, limit)
    }
    state.release = () => release()
    return state
}

test('색인 없을 때 — 글자 그대로 맞으면 색인을 안 기다리고 바로 답한다', async () => {
    const s = coldStart()
    const r = await svc.search('좋은 날')
    assert.equal(s.loaded, false)
    assert.equal(r.items[0].id, 'a2') // 임시 색인도 같은 점수 규칙
    assert.ok(r.items.some((x) => x.id === 'b2'))
    const sg = await svc.suggest('밤편')
    assert.equal(s.loaded, false)
    assert.deepEqual(sg.songs.map((x) => x._id), ['a1'])
    assert.equal(sg.artists.length, 0)
    s.release()
})

test('색인 없을 때 — 초성·한영·오타처럼 임시 색인이 못 찾으면 진짜 색인을 기다린다', async () => {
    const s = coldStart()
    const p = svc.search('ㅂㅍㅈ')
    setTimeout(() => s.release(), 20)
    assert.deepEqual((await p).items.map((x) => x.id), ['a1'])
    assert.equal(s.loaded, true)
    // 색인이 생긴 뒤엔 DB 를 안 읽는다
    const before = s.quickCalls
    assert.deepEqual(await ids('dkdldb').then((x) => x.slice(0, 3).sort()), ['a1', 'a2', 'a3'])
    assert.equal(s.quickCalls, before)
})

test('색인 없을 때 — 다음 페이지(quick:false)는 임시 색인을 안 쓴다', async () => {
    const s = coldStart()
    const p = svc.search('좋은', 'all', { quick: false })
    setTimeout(() => s.release(), 20)
    await p
    assert.equal(s.quickCalls, 0)
    assert.equal(s.loaded, true)
})

test('검색어의 정규식 특수문자는 글자로 본다', async () => {
    const s = coldStart()
    const r = await svc.suggest('(IU')
    assert.equal(s.loaded, false)
    assert.ok(r.songs.length > 0)
    s.release()
})
