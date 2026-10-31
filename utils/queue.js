// utils/queue.js — 재생 대기열 계산(순수 함수). 화면·네트워크·localStorage를 모른다.
// store/player.js 가 이 함수들로 다음 상태를 만들고, tests/queue.test.mjs 가 그대로 검증한다.
//
// 구조 (스포티파이·애플뮤직과 같은 2구역, docs/PLAYER_V2_PLAN.md)
//   upNext  : [item]  "다음에 재생" — 직접 넣은 곡. 항상 먼저 나오고, 재생되면 빠진다
//   context : { source, items, order, pos }  "다음: ○○에서" — 지금 듣는 목록
//             order = 재생 순서(items 의 인덱스). 셔플이면 섞여 있다
//             pos   = order 안에서 마지막으로 재생한 목록 곡의 위치. upNext 곡을 듣는 동안엔 그대로 둔다
//   history : [item]  upNext 곡을 연달아 들을 때의 "이전 곡"용
//   currentTrack : 지금 곡. 목록 곡인지는 items[order[pos]].qid 와 같은지로 판단한다
//
// item = { qid, kind: 'song'|'video', _id?, videoId?, title, artist, coverUrl }
//   qid 는 대기열에 들어갈 때마다 새로 붙는다 → 같은 곡을 두 번 넣어도 따로 다룬다

export const UP_NEXT_LIMIT = 1000
const HISTORY_LIMIT = 50

let seq = 0
export function newQid() {
    seq = (seq + 1) % 1e6
    return `q${Date.now().toString(36)}${seq.toString(36)}${Math.random().toString(36).slice(2, 6)}`
}

// 곡 객체 → 대기열 항목. idKey: 곡 id가 든 필드(차트·플리 항목은 'songId', DB 곡은 '_id')
export function toSongItem(song, idKey = '_id') {
    if (!song) return null
    const id = song[idKey]
    return {
        qid: newQid(),
        kind: 'song',
        _id: id ? String(id) : undefined,
        title: song.title,
        artist: song.artist,
        coverUrl: song.coverUrl || '',
    }
}

// 유튜브 곡(테마) → 대기열 항목
export function toVideoItem(video) {
    if (!video || !video.videoId) return null
    return {
        qid: newQid(),
        kind: 'video',
        videoId: video.videoId,
        title: video.title,
        artist: video.artist || '',
        coverUrl: video.thumbnail || video.coverUrl || `https://i.ytimg.com/vi/${video.videoId}/hqdefault.jpg`,
    }
}

// localStorage 에 남길 최소 필드
export function stripItem(item) {
    if (!item) return item
    const { qid, kind, _id, videoId, title, artist, coverUrl } = item
    return { qid, kind, _id, videoId, title, artist, coverUrl }
}

function shuffled(arr, random = Math.random) {
    const a = [...arr]
    for (let i = a.length - 1; i > 0; i--) {
        const j = Math.floor(random() * (i + 1));
        [a[i], a[j]] = [a[j], a[i]]
    }
    return a
}

// 재생 순서. 셔플이면 first(인덱스)를 맨 앞에 두고 나머지를 섞는다
export function buildOrder(n, shuffle, first = null, random = Math.random) {
    const all = Array.from({ length: n }, (_, i) => i)
    if (!shuffle) return all
    if (first === null || first < 0 || first >= n) return shuffled(all, random)
    return [first, ...shuffled(all.filter(i => i !== first), random)]
}

export function contextItemAt(context, pos) {
    if (!context || pos < 0 || pos >= context.order.length) return null
    return context.items[context.order[pos]] || null
}

export function isFromContext(state) {
    const cur = state.currentTrack
    const at = contextItemAt(state.context, state.context ? state.context.pos : -1)
    return !!(cur && at && at.qid === cur.qid)
}

// 앞으로 나올 목록 곡들(패널 아래 구역)
export function upcomingContext(state) {
    const ctx = state.context
    if (!ctx) return []
    return ctx.order.slice(ctx.pos + 1).map(i => ctx.items[i]).filter(Boolean)
}

// 목록을 새로 시작한다. upNext 는 건드리지 않는다
export function startContext(state, { source, items, index = 0, shuffle = false }, random = Math.random) {
    const list = items.filter(Boolean)
    if (!list.length) return state
    const first = shuffle && (index === null || index === undefined) ? null : Math.min(Math.max(index || 0, 0), list.length - 1)
    const order = buildOrder(list.length, shuffle, first, random)
    const pos = first === null ? 0 : order.indexOf(first)
    const context = { source, items: list, order, pos }
    return { ...state, context, currentTrack: list[order[pos]], history: [], isQueueEnded: false }
}

/**
 * 다음 곡으로. auto=true 는 곡이 끝나서 넘어가는 경우 — 한 곡 반복이면 그 곡을 다시 튼다.
 * 사용자가 누른 "다음"(auto=false)은 한 곡 반복이어도 넘어간다.
 * 반환: { state, result } — result: 'replay' | 'advanced' | 'ended'
 */
export function advance(state, { auto = false } = {}, random = Math.random) {
    if (auto && state.repeatMode === 'one' && state.currentTrack) return { state, result: 'replay' }

    const fromCtx = isFromContext(state)
    const prev = state.currentTrack

    if (state.upNext.length) {
        const [next, ...rest] = state.upNext
        // upNext 곡을 연달아 들을 때만 history 에 쌓는다(목록 곡의 "이전"은 pos-1 로 간다)
        const history = prev && !fromCtx ? [...state.history, prev].slice(-HISTORY_LIMIT) : []
        return { state: { ...state, upNext: rest, currentTrack: next, history, isQueueEnded: false }, result: 'advanced' }
    }

    const ctx = state.context
    if (ctx && ctx.pos + 1 < ctx.order.length) {
        const pos = ctx.pos + 1
        return { state: { ...state, context: { ...ctx, pos }, currentTrack: contextItemAt(ctx, pos), history: [], isQueueEnded: false }, result: 'advanced' }
    }

    if (ctx && ctx.items.length && state.repeatMode !== 'off') {
        // 전체 반복(또는 한 곡 반복 중 "다음"): 처음으로. 셔플이면 새로 섞는다
        const order = state.shuffleOn ? buildOrder(ctx.items.length, true, null, random) : ctx.order
        const next = { ...ctx, order, pos: 0 }
        return { state: { ...state, context: next, currentTrack: contextItemAt(next, 0), history: [], isQueueEnded: false }, result: 'advanced' }
    }

    return { state: { ...state, isQueueEnded: true }, result: 'ended' }
}

// 대기열이 끝난 뒤 다시 재생 — 목록 처음부터(셔플이면 새로 섞음)
export function restart(state, random = Math.random) {
    const ctx = state.context
    if (!ctx || !ctx.items.length) return { ...state, isQueueEnded: false }
    const order = state.shuffleOn ? buildOrder(ctx.items.length, true, null, random) : buildOrder(ctx.items.length, false)
    const next = { ...ctx, order, pos: 0 }
    return { ...state, context: next, currentTrack: contextItemAt(next, 0), history: [], isQueueEnded: false }
}

/**
 * 이전 곡. (3초 넘게 들었으면 처음으로 — 그 판단은 스토어가 currentTime 으로 한다)
 * 목록 곡이면 pos-1. upNext 출신 곡이면 지금 곡을 upNext 맨 앞에 되돌려 놓고
 * history → 없으면 마지막 목록 곡으로 간다(되돌린 곡은 "다음"을 누르면 다시 나온다).
 * 갈 곳이 없으면 null.
 */
export function stepBack(state) {
    const ctx = state.context
    const cur = state.currentTrack
    if (!cur) return null

    if (isFromContext(state)) {
        if (ctx.pos > 0) {
            const pos = ctx.pos - 1
            return { ...state, context: { ...ctx, pos }, currentTrack: contextItemAt(ctx, pos), isQueueEnded: false }
        }
        if (state.repeatMode === 'all' && ctx.order.length > 1) {
            const pos = ctx.order.length - 1
            return { ...state, context: { ...ctx, pos }, currentTrack: contextItemAt(ctx, pos), isQueueEnded: false }
        }
        return null
    }

    const upNext = [cur, ...state.upNext]
    if (state.history.length) {
        const history = state.history.slice(0, -1)
        return { ...state, upNext, history, currentTrack: state.history[state.history.length - 1], isQueueEnded: false }
    }
    const back = contextItemAt(ctx, ctx ? ctx.pos : -1)
    if (back) return { ...state, upNext, currentTrack: back, isQueueEnded: false }
    return null
}

// 직접 추가. front=true 면 "다음에 재생"(맨 앞), 아니면 맨 뒤
export function addUpNext(state, items, { front = false } = {}) {
    const list = items.filter(Boolean)
    const room = UP_NEXT_LIMIT - state.upNext.length
    if (room <= 0) return { state, added: 0, full: true }
    const take = list.slice(0, room)
    const upNext = front ? [...take, ...state.upNext] : [...state.upNext, ...take]
    return { state: { ...state, upNext }, added: take.length, full: take.length < list.length }
}

/**
 * 대기열에서 빼기. 지금 곡이 빠지면 currentRemoved=true — 스토어가 다음 곡으로 넘긴다.
 * 목록에서 빼면 order 를 다시 매기고, pos 는 "다음에 advance 하면 빠진 곡의 다음 곡"이 되도록 맞춘다.
 */
export function removeItems(state, qids) {
    const drop = new Set(qids)
    const upNext = state.upNext.filter(i => !drop.has(i.qid))
    const history = state.history.filter(i => !drop.has(i.qid))
    const currentRemoved = !!(state.currentTrack && drop.has(state.currentTrack.qid))

    let context = state.context
    if (context) {
        const remap = new Map()
        const items = []
        context.items.forEach((item, i) => {
            if (!drop.has(item.qid)) {
                remap.set(i, items.length)
                items.push(item)
            }
        })
        if (items.length !== context.items.length) {
            const order = []
            let pos = -1
            context.order.forEach((oldIdx, p) => {
                if (remap.has(oldIdx)) order.push(remap.get(oldIdx))
                if (p === context.pos) pos = order.length - 1 // 지금 자리(빠졌으면 바로 앞 곡)
            })
            context = items.length ? { ...context, items, order, pos } : null
        }
    }
    return { state: { ...state, upNext, history, context }, currentRemoved }
}

// "다음에 재생" 안에서 순서 바꾸기
export function moveUpNext(state, from, to) {
    const upNext = [...state.upNext]
    if (from < 0 || from >= upNext.length || to < 0 || to >= upNext.length) return state
    const [item] = upNext.splice(from, 1)
    upNext.splice(to, 0, item)
    return { ...state, upNext }
}

// 앞으로 나올 목록 곡 안에서 순서 바꾸기(from·to 는 upcomingContext 기준 위치). order 만 바뀐다 —
// 셔플을 끄면 원래 순서로 돌아간다(스포티파이와 같음)
export function moveContext(state, from, to) {
    const ctx = state.context
    if (!ctx) return state
    const head = ctx.order.slice(0, ctx.pos + 1)
    const tail = ctx.order.slice(ctx.pos + 1)
    if (from < 0 || from >= tail.length || to < 0 || to >= tail.length) return state
    const [idx] = tail.splice(from, 1)
    tail.splice(to, 0, idx)
    return { ...state, context: { ...ctx, order: [...head, ...tail] } }
}

// 패널에서 곡을 눌러 바로 재생. upNext 곡이면 그 앞의 upNext 곡들은 건너뛴 것으로 보고 뺀다(스포티파이와 같음)
export function jumpTo(state, qid) {
    const ui = state.upNext.findIndex(i => i.qid === qid)
    if (ui !== -1) {
        return { ...state, currentTrack: state.upNext[ui], upNext: state.upNext.slice(ui + 1), history: [], isQueueEnded: false }
    }
    const ctx = state.context
    if (ctx) {
        const pos = ctx.order.findIndex(i => ctx.items[i] && ctx.items[i].qid === qid)
        if (pos !== -1) return { ...state, context: { ...ctx, pos }, currentTrack: contextItemAt(ctx, pos), history: [], isQueueEnded: false }
    }
    return state
}

// 셔플 켜기/끄기 — 목록만 다시 섞는다(upNext 는 그대로)
export function setShuffle(state, on, random = Math.random) {
    const ctx = state.context
    if (!ctx) return { ...state, shuffleOn: on }
    const fromCtx = isFromContext(state)
    const anchor = ctx.pos >= 0 ? ctx.order[ctx.pos] : null // 마지막으로 재생한 목록 곡(items 인덱스)
    let order
    let pos
    if (on) {
        if (fromCtx) {
            order = buildOrder(ctx.items.length, true, anchor, random)
            pos = 0
        } else {
            // upNext 곡을 듣는 중 — 목록은 처음부터 섞어 두고, upNext 가 끝나면 그 맨 앞부터
            order = buildOrder(ctx.items.length, true, null, random)
            pos = -1
        }
    } else {
        order = buildOrder(ctx.items.length, false)
        pos = anchor === null ? -1 : anchor
    }
    return { ...state, shuffleOn: on, context: { ...ctx, order, pos } }
}

// 대기열 전체 곡 수(지금 곡 + 다음에 재생 + 남은 목록)
export function queueLength(state) {
    return (state.currentTrack ? 1 : 0) + state.upNext.length + upcomingContext(state).length
}

export function hasNext(state) {
    if (state.upNext.length) return true
    const ctx = state.context
    if (!ctx) return false
    if (ctx.pos + 1 < ctx.order.length) return true
    return state.repeatMode !== 'off' && ctx.items.length > 0
}

/**
 * 옛 저장 형식(배열 하나) → 새 형식. 셔플 중이었다면 queue 는 이미 섞인 순서라
 * original_queue 를 원래 순서로 쓴다. null 항목은 버리고, 지금 곡이 목록에 없으면 맨 앞에 넣는다.
 */
export function migrateLegacy({ queue, originalQueue, currentTrack, shuffleOn }) {
    const clean = arr => (Array.isArray(arr) ? arr.filter(s => s && s._id) : [])
    const played = clean(queue)
    const original = shuffleOn && clean(originalQueue).length ? clean(originalQueue) : played
    if (!original.length && !(currentTrack && currentTrack._id)) return null

    const items = original.map(s => toSongItem(s))
    const byId = new Map(items.map((it, i) => [it._id, i]))
    let curIdx = currentTrack && currentTrack._id ? byId.get(String(currentTrack._id)) : undefined
    if (currentTrack && currentTrack._id && curIdx === undefined) {
        items.unshift(toSongItem(currentTrack))
        byId.clear()
        items.forEach((it, i) => byId.set(it._id, i))
        curIdx = 0
    }

    // 섞여 있던 재생 순서를 그대로 살린다(셔플 중이 아니면 원래 순서)
    let order
    if (shuffleOn) {
        order = []
        const seen = new Set()
        played.forEach(s => {
            const i = byId.get(String(s._id))
            if (i !== undefined && !seen.has(i)) { seen.add(i); order.push(i) }
        })
        items.forEach((_, i) => { if (!seen.has(i)) order.push(i) })
    } else {
        order = buildOrder(items.length, false)
    }
    const pos = curIdx === undefined ? 0 : order.indexOf(curIdx)
    const context = { source: { type: 'legacy', id: null, name: '이전 재생목록' }, items, order, pos }
    return { context, upNext: [], currentTrack: curIdx === undefined ? items[order[0]] : items[curIdx] }
}
