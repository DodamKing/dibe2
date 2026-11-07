// utils/queue.js — 재생 대기열 계산(순수 함수). 화면·네트워크·localStorage를 모른다.
// store/player.js 가 이 함수들로 다음 상태를 만들고, tests/queue.test.mjs 가 그대로 검증한다.
//
// 구조 — **한 줄 목록 + 지금 위치** (멜론·지니·벅스의 "현재 재생목록" 방식, 2026-11-07 사용자 결정)
//   context : { source, items, order, pos }
//             items = 목록(원래 순서). order = 재생 순서(items 의 인덱스, 셔플이면 섞여 있다)
//             pos   = order 안에서 지금 곡의 위치. order.slice(0, pos) = 지난 곡(패널에 그대로 남는다)
//   currentTrack = items[order[pos]]
//
// 예전엔 2구역(목록 + "다음에 재생" upNext, 스포티파이 방식)이었다. upNext 곡은 한 번 재생되면 사라져서
// 검색에서 한 곡 틀고 몇 곡 추가 → 다 듣고 나면 처음 한 곡만 남아 그것만 반복되는 버그가 났다.
// 이제 직접 넣은 곡도 목록 안에 들어가 **들은 뒤에도 남고 전체 반복에 포함된다.**
//   줄 클릭·전체 재생 = 목록 교체 / "다음에 재생" = 지금 곡 바로 뒤 / "맨 뒤에 추가" = 끝
//
// item = { qid, kind: 'song'|'video', _id?, videoId?, title, artist, coverUrl, added? }
//   qid 는 대기열에 들어갈 때마다 새로 붙는다 → 같은 곡을 두 번 넣어도 따로 다룬다
//   added = 직접 넣은 곡(한도 계산용). 목록 통째 재생은 한도가 없다

export const ADD_LIMIT = 500

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
    const { qid, kind, _id, videoId, title, artist, coverUrl, added } = item
    return added ? { qid, kind, _id, videoId, title, artist, coverUrl, added } : { qid, kind, _id, videoId, title, artist, coverUrl }
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

// 앞으로 나올 곡들(패널 "다음" 구역)
export function upcomingContext(state) {
    const ctx = state.context
    if (!ctx) return []
    return ctx.order.slice(ctx.pos + 1).map(i => ctx.items[i]).filter(Boolean)
}

// 이미 들은 곡들(지금 곡 앞쪽)
export function playedContext(state) {
    const ctx = state.context
    if (!ctx || ctx.pos <= 0) return []
    return ctx.order.slice(0, ctx.pos).map(i => ctx.items[i]).filter(Boolean)
}

// 목록을 새로 시작한다(대기열 교체)
export function startContext(state, { source, items, index = 0, shuffle = false }, random = Math.random) {
    const list = items.filter(Boolean)
    if (!list.length) return state
    const first = shuffle && (index === null || index === undefined) ? null : Math.min(Math.max(index || 0, 0), list.length - 1)
    const order = buildOrder(list.length, shuffle, first, random)
    const pos = first === null ? 0 : order.indexOf(first)
    const context = { source, items: list, order, pos }
    return { ...state, context, currentTrack: list[order[pos]], isQueueEnded: false }
}

/**
 * 다음 곡으로. auto=true 는 곡이 끝나서 넘어가는 경우 — 한 곡 반복이면 그 곡을 다시 튼다.
 * 사용자가 누른 "다음"(auto=false)은 한 곡 반복이어도 넘어간다.
 * 반환: { state, result } — result: 'replay' | 'advanced' | 'ended'
 */
export function advance(state, { auto = false } = {}, random = Math.random) {
    if (auto && state.repeatMode === 'one' && state.currentTrack) return { state, result: 'replay' }

    const ctx = state.context
    if (ctx && ctx.pos + 1 < ctx.order.length) {
        const pos = ctx.pos + 1
        return { state: { ...state, context: { ...ctx, pos }, currentTrack: contextItemAt(ctx, pos), isQueueEnded: false }, result: 'advanced' }
    }

    if (ctx && ctx.items.length && state.repeatMode !== 'off') {
        // 전체 반복(또는 한 곡 반복 중 "다음"): 처음으로. 셔플이면 새로 섞는다. 직접 넣은 곡도 목록이라 같이 돈다
        const order = state.shuffleOn ? buildOrder(ctx.items.length, true, null, random) : ctx.order
        const next = { ...ctx, order, pos: 0 }
        return { state: { ...state, context: next, currentTrack: contextItemAt(next, 0), isQueueEnded: false }, result: 'advanced' }
    }

    return { state: { ...state, isQueueEnded: true }, result: 'ended' }
}

// 대기열이 끝난 뒤 다시 재생 — 목록 처음부터(셔플이면 새로 섞음)
export function restart(state, random = Math.random) {
    const ctx = state.context
    if (!ctx || !ctx.items.length) return { ...state, isQueueEnded: false }
    const order = state.shuffleOn ? buildOrder(ctx.items.length, true, null, random) : buildOrder(ctx.items.length, false)
    const next = { ...ctx, order, pos: 0 }
    return { ...state, context: next, currentTrack: contextItemAt(next, 0), isQueueEnded: false }
}

/**
 * 이전 곡. (3초 넘게 들었으면 처음으로 — 그 판단은 스토어가 currentTime 으로 한다)
 * 앞 곡으로. 첫 곡이면 전체 반복일 때만 마지막 곡으로. 갈 곳이 없으면 null.
 */
export function stepBack(state) {
    const ctx = state.context
    if (!state.currentTrack || !ctx) return null
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

/**
 * 목록에 곡을 끼워 넣는다. itemAt = items(원래 순서) 안 자리, orderAt = order(재생 순서) 안 자리.
 * 원래 순서에도 같은 자리에 넣어야 셔플을 껐을 때 "넣은 자리"가 유지된다.
 */
function insertInto(ctx, list, itemAt, orderAt) {
    const k = list.length
    const items = [...ctx.items.slice(0, itemAt), ...list, ...ctx.items.slice(itemAt)]
    const shifted = ctx.order.map(i => (i >= itemAt ? i + k : i))
    const added = list.map((_, j) => itemAt + j)
    const order = [...shifted.slice(0, orderAt), ...added, ...shifted.slice(orderAt)]
    const pos = ctx.pos >= orderAt ? ctx.pos + k : ctx.pos
    return { ...ctx, items, order, pos }
}

export function addedCount(state) {
    return state.context ? state.context.items.filter(i => i.added).length : 0
}

/**
 * 직접 추가. front=true "다음에 재생"(지금 곡 바로 뒤), 아니면 맨 뒤.
 * 대기열이 비어 있으면 넣은 곡들로 새 목록을 만들고 첫 곡을 지금 곡으로(재생은 사용자가 누를 때).
 * 반환 { state, added, full } — full: 한도(ADD_LIMIT)에 걸려 일부만 들어갔거나 하나도 못 넣음
 */
export function addToQueue(state, items, { front = false } = {}) {
    const room = ADD_LIMIT - addedCount(state)
    const list = items.filter(Boolean)
    if (room <= 0) return { state, added: 0, full: list.length > 0 }
    const take = list.slice(0, room).map(i => ({ ...i, added: true }))
    if (!take.length) return { state, added: 0, full: false }
    const full = take.length < list.length

    const ctx = state.context
    if (!ctx || !ctx.items.length) {
        const context = { source: { type: 'queue', id: null, name: '재생 대기열' }, items: take, order: buildOrder(take.length, false), pos: 0 }
        return { state: { ...state, context, currentTrack: take[0], isQueueEnded: false }, added: take.length, full }
    }

    const cur = ctx.pos >= 0 ? ctx.order[ctx.pos] : -1
    const next = front
        ? insertInto(ctx, take, cur + 1, ctx.pos + 1)
        : insertInto(ctx, take, ctx.items.length, ctx.order.length)
    // 지금 곡이 없거나(곡을 다 빼서 멈춤) 대기열이 끝까지 재생돼 멈춘 상태면, 넣은 첫 곡을 지금 곡으로 —
    // 재생을 누르면 처음부터가 아니라 방금 넣은 곡부터 나온다
    if (!state.currentTrack || state.isQueueEnded) {
        const pos = next.order.findIndex(i => next.items[i].qid === take[0].qid)
        return { state: { ...state, context: { ...next, pos }, currentTrack: take[0], isQueueEnded: false }, added: take.length, full }
    }
    return { state: { ...state, context: next }, added: take.length, full }
}

/**
 * 대기열에서 빼기. 지금 곡이 빠지면 currentRemoved=true — 스토어가 다음 곡으로 넘긴다.
 * order 를 다시 매기고, pos 는 "다음에 advance 하면 빠진 곡의 다음 곡"이 되도록 맞춘다.
 */
export function removeItems(state, qids) {
    const drop = new Set(qids)
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
    return { state: { ...state, context }, currentRemoved }
}

// 패널에 보이는 순서 그대로의 전체 목록(들은 곡 + 지금 곡 + 다음 곡)
export function queueItems(state) {
    const ctx = state.context
    if (!ctx) return []
    return ctx.order.map(i => ctx.items[i]).filter(Boolean)
}

/**
 * 대기열 안에서 순서 바꾸기(from·to 는 queueItems 기준 위치 = 패널 순서). 지금 곡을 옮겨도 재생은 그대로이고
 * pos 가 지금 곡을 따라간다. order 만 바뀐다 — 셔플을 끄면 원래 순서로 돌아간다(스포티파이와 같음).
 * 패널은 한 목록이라 들은 곡·지금 곡까지 전부 옮길 수 있다(2026-11-07 사용자 결정)
 */
export function moveInQueue(state, from, to) {
    const ctx = state.context
    if (!ctx) return state
    const n = ctx.order.length
    if (from < 0 || from >= n || to < 0 || to >= n || from === to) return state
    const cur = ctx.pos >= 0 ? ctx.order[ctx.pos] : null
    const order = [...ctx.order]
    const [idx] = order.splice(from, 1)
    order.splice(to, 0, idx)
    const pos = cur === null ? ctx.pos : order.indexOf(cur)
    return { ...state, context: { ...ctx, order, pos } }
}

// "비우기" — 지금 곡만 남긴다(재생은 그대로)
export function othersThanCurrent(state) {
    const cur = state.currentTrack
    return queueItems(state).filter(i => !cur || i.qid !== cur.qid)
}

// 패널에서 곡을 눌러 바로 재생(들은 곡이든 다음 곡이든 그 자리로)
export function jumpTo(state, qid) {
    const ctx = state.context
    if (!ctx) return state
    const pos = ctx.order.findIndex(i => ctx.items[i] && ctx.items[i].qid === qid)
    if (pos === -1) return state
    return { ...state, context: { ...ctx, pos }, currentTrack: contextItemAt(ctx, pos), isQueueEnded: false }
}

// 셔플 켜기/끄기 — 켜면 지금 곡을 맨 앞에 두고 나머지를 섞는다(들은 곡 표시는 비워진다). 끄면 원래 순서의 지금 곡 자리로
export function setShuffle(state, on, random = Math.random) {
    const ctx = state.context
    if (!ctx) return { ...state, shuffleOn: on }
    const anchor = ctx.pos >= 0 ? ctx.order[ctx.pos] : null
    let order
    let pos
    if (on) {
        order = buildOrder(ctx.items.length, true, anchor, random)
        pos = anchor === null ? -1 : 0
    } else {
        order = buildOrder(ctx.items.length, false)
        pos = anchor === null ? -1 : anchor
    }
    return { ...state, shuffleOn: on, context: { ...ctx, order, pos } }
}

// 대기열 남은 곡 수(지금 곡 + 다음 곡들)
export function queueLength(state) {
    return (state.currentTrack ? 1 : 0) + upcomingContext(state).length
}

export function hasNext(state) {
    const ctx = state.context
    if (!ctx) return false
    if (ctx.pos + 1 < ctx.order.length) return true
    return state.repeatMode !== 'off' && ctx.items.length > 0
}

/**
 * 2구역 시절 저장 형식(context + upNext + history, 2026-11-01~11-07) → 한 줄.
 * 순서: 들은 목록 곡 → 지금 곡 → "다음에 재생" 곡들 → 남은 목록 곡 (2026-11-07 결정)
 * 지금 곡이 upNext 출신이면(목록의 pos 자리 곡이 아니면) 목록 지금 자리 바로 뒤에 넣는다.
 */
export function mergeUpNext({ context, upNext, currentTrack }) {
    const extra = (upNext || []).filter(Boolean).map(i => ({ ...i, added: true }))
    let ctx = context && context.items && context.items.length ? context : null
    const at = contextItemAt(ctx, ctx ? ctx.pos : -1)
    const curInCtx = !!(currentTrack && at && at.qid === currentTrack.qid)

    if (!ctx) {
        const list = [currentTrack ? { ...currentTrack, added: true } : null, ...extra].filter(Boolean)
        if (!list.length) return { context: null, currentTrack: null }
        return {
            context: { source: { type: 'queue', id: null, name: '재생 대기열' }, items: list, order: buildOrder(list.length, false), pos: 0 },
            currentTrack: list[0],
        }
    }

    let cur = currentTrack
    if (cur && !curInCtx) {
        cur = { ...cur, added: true }
        const ci = ctx.pos >= 0 ? ctx.order[ctx.pos] : -1
        ctx = insertInto(ctx, [cur], ci + 1, ctx.pos + 1)
        ctx = { ...ctx, pos: ctx.pos + 1 }
    }
    if (extra.length) {
        const ci = ctx.pos >= 0 ? ctx.order[ctx.pos] : -1
        ctx = insertInto(ctx, extra, ci + 1, ctx.pos + 1)
    }
    return { context: ctx, currentTrack: cur || contextItemAt(ctx, Math.max(ctx.pos, 0)) }
}

/**
 * 옛 저장 형식(배열 하나, 2026-11 이전) → 새 형식. 셔플 중이었다면 queue 는 이미 섞인 순서라
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
    return { context, currentTrack: curIdx === undefined ? items[order[0]] : items[curIdx] }
}
