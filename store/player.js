// store/player.js
// 재생 대기열은 2구역 — "다음에 재생"(upNext, 직접 넣은 곡) + "지금 듣는 목록"(context).
// 계산은 전부 utils/queue.js(순수 함수, tests/queue.test.mjs)가 하고, 여기선 상태 반영·재생·저장만 한다.
// 설계: docs/PLAYER_V2_PLAN.md
import youtubePlayer from "~/utils/youtubePlayer"
import * as Q from "~/utils/queue"

const getStorageKey = (rootState, key) => {
    if (!rootState.auth.loggedIn) return null
    const userId = rootState.auth.user.userId
    return `user_${userId}_${key}`
}

// 재생 실패(임베드 차단·아직 유튜브 주소 없는 곡)가 이만큼 연달아 나면 넘기기를 멈춘다
const MAX_FAIL_STREAK = 5
// "이전"을 눌렀을 때 이보다 오래 들었으면 곡 처음으로(업계 공통)
const RESTART_THRESHOLD = 3

const emptyTally = () => ({ trackId: null, seconds: 0, counted: false, lastTick: 0 })

export const state = () => ({
    currentTrack: null,
    upNext: [],
    context: null,
    history: [],
    isPlaying: false,
    currentTime: 0,
    duration: 0,
    volume: 100,
    shuffleOn: false,
    repeatMode: 'off',
    isLoading: false,
    isInitialized: false,
    isYouTubeReady: false,
    isQueueEnded: false,
    // 새로고침 복원 시 기억해둔 위치 — 다음 play()에서 한 번만 seek하고 비움(currentTime과는 별개)
    resumePosition: null,
    // 화면 아래 알림(재생 실패·좋아요 실패·담기 완료 등). 레이아웃이 토스트로 띄우고 비운다
    notice: null,
    // 재생 수 기록용 — 이 곡을 실제로 들은 시간. 앱과 같은 기준(30초 또는 절반)에 닿으면 1회 기록.
    // trackId 는 qid(대기열 항목) 기준 — 같은 곡이 연달아 나와도 두 번째 재생을 따로 센다
    playTally: emptyTally(),
    failStreak: 0,
})

export const mutations = {
    SET_CURRENT_TRACK(state, track) {
        state.currentTrack = track
    },
    // 대기열 계산 결과 반영(지금 곡은 SET_CURRENT_TRACK 으로 따로 — mediaSession·titleUpdate 플러그인이 그걸 본다)
    APPLY_QUEUE(state, q) {
        state.upNext = q.upNext
        state.context = q.context
        state.history = q.history
        state.shuffleOn = q.shuffleOn
        state.isQueueEnded = q.isQueueEnded
    },
    SET_IS_PLAYING(state, isPlaying) {
        state.isPlaying = isPlaying
    },
    SET_CURRENT_TIME(state, time) {
        state.currentTime = time
    },
    SET_DURATION(state, duration) {
        state.duration = duration
    },
    SET_VOLUME(state, volume) {
        state.volume = volume
    },
    SET_IS_LOADING(state, isLoading) {
        state.isLoading = isLoading
    },
    SET_IS_INITIALIZED(state, isInitialized) {
        state.isInitialized = isInitialized
    },
    SET_REPEAT_MODE(state, mode) {
        state.repeatMode = mode
    },
    SET_RESUME_POSITION(state, position) {
        state.resumePosition = position
    },
    SET_NOTICE(state, message) {
        state.notice = message
    },
    SET_PLAY_TALLY(state, tally) {
        state.playTally = tally
    },
    SET_FAIL_STREAK(state, n) {
        state.failStreak = n
    },
    SET_YOUTUBE_READY(state, isReady) {
        state.isYouTubeReady = isReady
    },
    // lyrics 가 undefined = 아직 안 받아옴(로딩), '' = 받아왔는데 가사가 없는 곡. UI가 이걸 구분한다.
    SET_CURRENT_TRACK_LYRICS(state, { lyrics, adult }) {
        if (state.currentTrack) {
            state.currentTrack = { ...state.currentTrack, lyrics, adult }
        }
    },
    // 곡 id 가 없던 항목(차트 항목 등)을 재생 직전에 찾았을 때 — 같은 qid 를 전부 고친다
    PATCH_ITEM(state, { qid, patch }) {
        const fix = item => (item && item.qid === qid ? { ...item, ...patch } : item)
        if (state.currentTrack && state.currentTrack.qid === qid) state.currentTrack = fix(state.currentTrack)
        state.upNext = state.upNext.map(fix)
        if (state.context) state.context = { ...state.context, items: state.context.items.map(fix) }
    },
}

// 스토어 상태 → utils/queue 가 다루는 모양
const queueState = state => ({
    currentTrack: state.currentTrack,
    upNext: state.upNext,
    context: state.context,
    history: state.history,
    shuffleOn: state.shuffleOn,
    repeatMode: state.repeatMode,
    isQueueEnded: state.isQueueEnded,
})

export const actions = {
    async initializeAudioSystem({ commit, dispatch, state }) {
        // 좀비 방어: #youtube-player가 DOM에 살아있는지 매번 확인
        const playerEl = typeof document !== 'undefined' ? document.getElementById('youtube-player') : null
        const isPlayerAlive = playerEl && document.body.contains(playerEl)
        const wasInitialized = state.isInitialized

        if (wasInitialized && isPlayerAlive) return

        // 좀비 상태(이미 init됐는데 DOM이 사라짐)거나 첫 진입인데 div가 없는 경우 → div 복구
        if (!isPlayerAlive) {
            const div = document.createElement('div')
            div.id = 'youtube-player'
            div.className = 'hidden'
            document.body.appendChild(div)
            commit('SET_YOUTUBE_READY', false)
        }

        await dispatch('initYoutubePlayer')

        // 큐는 첫 진입에만 초기화 (좀비 복구 시엔 기존 큐 유지)
        if (!wasInitialized) {
            await dispatch('initializeQueue')
            dispatch('refreshQueueData')
        }

        commit('SET_IS_INITIALIZED', true)
    },

    initializeQueue({ commit, dispatch, rootState }) {
        if (!rootState.auth.loggedIn) return
        const read = (key) => {
            try {
                const raw = localStorage.getItem(getStorageKey(rootState, key))
                return raw ? JSON.parse(raw) : null
            } catch (e) {
                return null
            }
        }

        const savedVolume = read('volume')
        if (savedVolume !== null) commit('SET_VOLUME', Number(savedVolume))
        const savedRepeat = localStorage.getItem(getStorageKey(rootState, 'repeat_mode'))
        if (savedRepeat) commit('SET_REPEAT_MODE', savedRepeat)

        let saved = read('player_v2')
        if (!saved) {
            // 옛 형식(배열 하나) → 새 형식. 옛 키는 이번 릴리스에선 지우지 않는다(배포 롤백 대비)
            const shuffleOn = !!read('shuffle')
            const migrated = Q.migrateLegacy({
                queue: read('queue'),
                originalQueue: read('original_queue'),
                currentTrack: read('current_track'),
                shuffleOn,
            })
            if (migrated) saved = { ...migrated, history: [], shuffleOn }
        }
        if (saved) {
            commit('APPLY_QUEUE', {
                upNext: saved.upNext || [],
                context: saved.context || null,
                history: saved.history || [],
                shuffleOn: !!saved.shuffleOn,
                isQueueEnded: false,
            })
            commit('SET_CURRENT_TRACK', saved.currentTrack || null)
            dispatch('persistQueue')
            if (saved.currentTrack) dispatch('fetchCurrentTrackLyrics')
        }

        // 마지막으로 듣던 곡의 위치만 기억(비디오 user_{id}_video_position과 동일 패턴) — 다음 play()에서 한 번만 소비
        const savedPosition = read('position')
        if (savedPosition && savedPosition.time > 5) commit('SET_RESUME_POSITION', savedPosition)
    },

    persistQueue({ state, rootState }) {
        const key = getStorageKey(rootState, 'player_v2')
        if (!key) return
        const ctx = state.context
        try {
            localStorage.setItem(key, JSON.stringify({
                currentTrack: Q.stripItem(state.currentTrack),
                upNext: state.upNext.map(Q.stripItem),
                context: ctx ? { source: ctx.source, items: ctx.items.map(Q.stripItem), order: ctx.order, pos: ctx.pos } : null,
                history: state.history.map(Q.stripItem),
                shuffleOn: state.shuffleOn,
            }))
        } catch (e) {
            // 용량 초과 등 — 메모리 대기열은 그대로 쓴다
        }
    },

    // utils/queue 계산 결과를 반영하고 저장한다
    applyQueue({ commit, dispatch, state }, next) {
        commit('APPLY_QUEUE', next)
        if ((next.currentTrack && next.currentTrack.qid) !== (state.currentTrack && state.currentTrack.qid)) {
            dispatch('setCurrentTrack', next.currentTrack)
        }
        dispatch('persistQueue')
    },

    savePosition({ state, rootState }) {
        if (!state.currentTrack) return
        const key = getStorageKey(rootState, 'position')
        if (key) localStorage.setItem(key, JSON.stringify({ trackId: state.currentTrack.qid, time: state.currentTime }))
    },

    resetIsInitialized({ commit }) {
        commit('SET_IS_INITIALIZED', false)
    },

    setCurrentTrack({ commit, dispatch }, track) {
        commit('SET_CURRENT_TRACK', track || null)
        commit('SET_CURRENT_TIME', 0)
        commit('SET_DURATION', 0)
        // 곡이 바뀔 때마다 가사를 미리 받아 둔다(가사 화면을 열면 바로 보이게). 서버가 즉석에서 채우면 1초쯤 걸린다
        if (track) dispatch('fetchCurrentTrackLyrics')
    },

    // ── 목록 재생 / 직접 추가 ─────────────────────────────────────────

    /**
     * 목록을 그 곡부터 재생 — 목록에서 줄 클릭, 전체 재생, 셔플 재생.
     * songs: 화면의 곡 목록 그대로. idKey: 곡 id가 든 필드(차트·플리 'songId', 좋아요·검색 '_id').
     * kind 'video' = 테마(유튜브 곡). "다음에 재생"에 넣어 둔 곡은 지켜진다.
     */
    async playList({ dispatch, state }, { source, songs, idKey = 'songId', kind = 'song', index = 0, shuffle = false }) {
        const items = (songs || []).map(s => (kind === 'video' ? Q.toVideoItem(s) : Q.toSongItem(s, idKey))).filter(Boolean)
        if (!items.length) return
        const startIndex = shuffle && index === null ? null : Math.max(0, Math.min(index || 0, items.length - 1))
        let next = Q.startContext(queueState(state), { source, items, index: startIndex, shuffle })
        // 셔플 재생 버튼이면 셔플을 켠 상태로 둔다
        if (shuffle) next = { ...next, shuffleOn: true }
        else if (state.shuffleOn) next = Q.setShuffle(next, true)
        await dispatch('applyQueue', next)
        dispatch('play')
    },

    /**
     * 직접 추가. front=true "다음에 재생"(맨 앞) / false "대기열 맨 뒤에 추가".
     * 반환 { added, full } — full: 한도(1000곡)에 걸려 일부만 들어갔거나 하나도 못 넣음
     */
    async addToQueue({ dispatch, state }, { songs, idKey = '_id', kind = 'song', front = false }) {
        const items = (songs || []).map(s => (kind === 'video' ? Q.toVideoItem(s) : Q.toSongItem(s, idKey))).filter(Boolean)
        const r = Q.addUpNext(queueState(state), items, { front })
        let next = r.state
        // 아무것도 안 듣고 있었으면 첫 곡을 지금 곡으로(재생은 사용자가 누를 때) — 예전과 같은 동작
        if (!next.currentTrack && next.upNext.length) {
            next = { ...next, currentTrack: next.upNext[0], upNext: next.upNext.slice(1) }
        }
        await dispatch('applyQueue', next)
        return { added: r.added, full: r.full }
    },

    // 대기열 패널에서 곡을 눌렀을 때
    async playQueueItem({ dispatch, state }, qid) {
        await dispatch('applyQueue', Q.jumpTo(queueState(state), qid))
        dispatch('play')
    },

    async removeFromQueue({ commit, dispatch, state }, qids) {
        const wasPlaying = state.isPlaying
        const { state: removed, currentRemoved } = Q.removeItems(queueState(state), qids)
        if (!currentRemoved) {
            await dispatch('applyQueue', removed)
            return
        }
        const { state: next, result } = Q.advance(removed, { auto: false })
        if (result === 'ended' || !next.currentTrack || next.currentTrack.qid === state.currentTrack.qid) {
            // 남은 곡이 없다 — 멈추고 비운다
            await dispatch('applyQueue', { ...removed, currentTrack: null, isQueueEnded: false })
            commit('SET_IS_PLAYING', false)
            youtubePlayer.stop()
            return
        }
        await dispatch('applyQueue', next)
        if (wasPlaying) dispatch('play')
    },

    clearUpNext({ dispatch, state }) {
        return dispatch('removeFromQueue', state.upNext.map(i => i.qid))
    },

    clearUpcoming({ dispatch, state }) {
        return dispatch('removeFromQueue', Q.upcomingContext(queueState(state)).map(i => i.qid))
    },

    moveUpNext({ dispatch, state }, { from, to }) {
        return dispatch('applyQueue', Q.moveUpNext(queueState(state), from, to))
    },

    moveUpcoming({ dispatch, state }, { from, to }) {
        return dispatch('applyQueue', Q.moveContext(queueState(state), from, to))
    },

    // ── 가사·갱신 ─────────────────────────────────────────────────────

    async refreshQueueData({ state, commit, dispatch }) {
        const all = [state.currentTrack, ...state.upNext, ...(state.context ? state.context.items : [])]
        const ids = [...new Set(all.filter(i => i && i.kind === 'song' && i._id).map(i => i._id))]
        if (ids.length === 0) return

        try {
            const { songs } = await this.$axios.$post('/api/songs/by-ids', { ids })
            if (!songs || songs.length === 0) return

            const freshMap = new Map(songs.map(s => [String(s._id), s]))
            // by-ids 가 liked 를 실어준다 — 하단 플레이어 하트용으로 공유 상태에 반영
            dispatch('likes/seed', songs.map(s => ({ id: s._id, liked: !!s.liked })), { root: true })

            // 서버 객체로 통째 바꾸지 않는다 — qid·kind 를 지키고 표시 필드만 합친다(DB에서 사라진 곡은 그대로)
            const merge = (item) => {
                const fresh = item && item.kind === 'song' && freshMap.get(item._id)
                return fresh ? { ...item, title: fresh.title, artist: fresh.artist, coverUrl: fresh.coverUrl } : item
            }
            commit('APPLY_QUEUE', {
                upNext: state.upNext.map(merge),
                context: state.context ? { ...state.context, items: state.context.items.map(merge) } : null,
                history: state.history,
                shuffleOn: state.shuffleOn,
                isQueueEnded: state.isQueueEnded,
            })
            // ⚠️ currentTrack 도 합치되 lyrics/adult 는 살린다 — `/by-ids` 응답엔 lyrics 가 없어서(의도적 제외)
            // 덮으면 fetchCurrentTrackLyrics 가 방금 채운 가사가 날아간다(2026-07-17 레이스, FRONTEND.md)
            if (state.currentTrack) commit('SET_CURRENT_TRACK', merge(state.currentTrack))
            dispatch('persistQueue')
        } catch (err) {
            // 네트워크 에러 등 — 캐시 유지
            console.error('큐 fresh 갱신 실패:', err)
        }
    },

    async fetchCurrentTrackLyrics({ state, commit }) {
        const track = state.currentTrack
        if (!track) return
        // 유튜브 곡(테마)은 가사가 없다 — UI가 kind 로 문구를 고른다
        if (track.kind === 'video' || !track._id) return
        // 응답이 오기 전에 곡이 바뀔 수 있다. 서버가 가사를 즉석에서 채우면(lazy fill)
        // 벅스를 긁느라 1초 가까이 걸려서 더 잘 어긋난다 — 늦게 온 응답을 다음 곡에 붙이면 안 된다.
        // qid 로 비교한다 — 같은 곡이 연달아 나와도 새 항목이면 새로 받는다
        const qid = track.qid
        try {
            const { lyrics, adult } = await this.$axios.$get(`/api/songs/lyrics/${track._id}`)
            if (state.currentTrack?.qid !== qid) return
            commit('SET_CURRENT_TRACK_LYRICS', { lyrics: lyrics || '', adult: !!adult })
        } catch (err) {
            console.error('가사 fetch 실패:', err)
        }
    },

    // ── 재생 ──────────────────────────────────────────────────────────

    // 지금 곡의 유튜브 영상 id. 곡 id 가 없는 항목(차트 항목 등)은 여기서 처음 찾는다
    async resolveVideoId({ state, commit, dispatch }) {
        const track = state.currentTrack
        if (track.kind === 'video') return track.videoId
        let songId = track._id
        if (!songId) {
            const { songData } = await this.$axios.$get('/api/songs/songdata', { params: { title: track.title, artist: track.artist } })
            if (!songData) return null
            songId = String(songData._id)
            commit('PATCH_ITEM', { qid: track.qid, patch: { _id: songId, coverUrl: track.coverUrl || songData.coverUrl } })
            dispatch('persistQueue')
            dispatch('fetchCurrentTrackLyrics')
            dispatch('likes/ensure', [songId], { root: true })
        }
        return this.$axios.$get('/api/songs/youtubeId/' + songId)
    },

    async play({ commit, state, dispatch }) {
        if (state.isQueueEnded && state.context) {
            // 대기열이 끝난 뒤 다시 재생 — 목록 처음부터
            await dispatch('applyQueue', Q.restart(queueState(state)))
        }

        if (!state.currentTrack || !state.isYouTubeReady) return
        const qid = state.currentTrack.qid
        commit('SET_IS_LOADING', true)
        try {
            const videoId = await dispatch('resolveVideoId')
            if (state.currentTrack?.qid !== qid) return // 기다리는 사이 다른 곡으로 넘어감
            // 아직 유튜브 주소가 없는 곡. loadVideoById(null)은 예외 없이 조용히 넘어가서
            // 재생 중 표시만 남고 소리는 안 나므로 여기서 끊고 다음 곡으로 넘긴다.
            if (!videoId) {
                dispatch('playFailed', '아직 재생할 수 없는 곡이라 건너뛰었어요.')
                return
            }
            if (videoId !== youtubePlayer.getCurrentVideoId()) youtubePlayer.loadVideo(videoId)
            youtubePlayer.play()
            // 재생 위치 점프는 onStateChange의 PLAYING 시점(initYoutubePlayer)에서 처리 —
            // loadVideoById 직후 곧바로 seekTo하면 아직 안 먹는 경우가 있어서 안전한 시점으로 미룸
            commit('SET_IS_PLAYING', true)
        } catch (error) {
            console.error('Failed to play track:', error)
            commit('SET_NOTICE', '곡을 재생하지 못했어요. 다시 시도해 주세요.')
            commit('SET_IS_PLAYING', false)
        } finally {
            commit('SET_IS_LOADING', false)
        }
    },

    // 재생 실패(유튜브 주소 없음·임베드 차단 등) — 알리고 다음 곡으로. 연달아 실패하면 멈춘다
    playFailed({ commit, dispatch, state }, message) {
        const streak = state.failStreak + 1
        commit('SET_IS_PLAYING', false)
        if (streak >= MAX_FAIL_STREAK) {
            commit('SET_FAIL_STREAK', 0)
            commit('SET_NOTICE', '재생할 수 있는 곡을 찾지 못해 멈췄어요.')
            return
        }
        commit('SET_FAIL_STREAK', streak)
        commit('SET_NOTICE', message)
        const { state: next, result } = Q.advance(queueState(state), { auto: false })
        if (result !== 'advanced') return
        dispatch('applyQueue', next)
        dispatch('play')
    },

    pause({ commit, dispatch }) {
        youtubePlayer.pause()
        commit('SET_IS_PLAYING', false)
        dispatch('savePosition')
    },

    // payload.auto=true 는 곡이 끝나서 넘어가는 경우(한 곡 반복이면 그 곡을 다시).
    // 버튼·미디어 키에서 부르면 payload 가 이벤트 객체이거나 없다 → 사용자 조작으로 본다
    playNext({ commit, state, dispatch }, payload) {
        const auto = !!(payload && payload.auto === true)
        const { state: next, result } = Q.advance(queueState(state), { auto })
        if (result === 'replay') {
            dispatch('seek', 0)
            dispatch('play')
            return
        }
        if (result === 'ended') {
            dispatch('applyQueue', next)
            commit('SET_IS_PLAYING', false)
            return
        }
        dispatch('applyQueue', next)
        dispatch('play')
    },

    playPrevious({ state, dispatch }) {
        if (!state.currentTrack) return
        const back = state.currentTime > RESTART_THRESHOLD ? null : Q.stepBack(queueState(state))
        if (!back) {
            dispatch('seek', 0)
            return
        }
        dispatch('applyQueue', back)
        dispatch('play')
    },

    togglePlay({ dispatch, state }) {
        if (state.currentTrack) {
            if (state.isPlaying) {
                dispatch('pause')
            } else {
                dispatch('play')
            }
        }
    },

    setVolume({ commit, rootState }, volume) {
        commit('SET_VOLUME', volume)
        youtubePlayer.setVolume(volume)

        const volumeKey = getStorageKey(rootState, 'volume')
        if (volumeKey) localStorage.setItem(volumeKey, volume)
    },

    seek({ commit, state }, time) {
        if (state.currentTrack) {
            youtubePlayer.seek(time)
            commit('SET_CURRENT_TIME', time)
        }
    },

    initYoutubePlayer({ state, dispatch, commit }) {
        /* global YT */
        youtubePlayer.init(
            // onReady callback
            () => {
                commit('SET_YOUTUBE_READY', true)
                youtubePlayer.setVolume(state.volume)
            },
            // onStateChange callback
            (event) => {
                if (event.data === YT.PlayerState.ENDED) {
                    // 한 곡 반복이면 같은 곡이 다시 시작된다 — 그것도 새 재생으로 세도록 비운다
                    commit('SET_PLAY_TALLY', emptyTally())
                    dispatch('playNext', { auto: true })
                } else if (event.data === YT.PlayerState.PLAYING) {
                    commit('SET_IS_PLAYING', true)
                    commit('SET_FAIL_STREAK', 0)
                    // 새로고침 복원 후 그 곡이 실제로 재생되기 시작하는 순간에만 기억해둔 위치로 점프(한 번 쓰고 비움).
                    // loadVideoById 직후 곧바로 seekTo를 호출하면 아직 새 영상이 버퍼링 전이라 씹히는 경우가 있어서,
                    // 실제로 PLAYING 상태가 된 이 시점(=안전하게 seek 가능한 시점)으로 미룸.
                    // trackId 는 qid(새 형식) — 옛 형식으로 저장된 위치는 곡 _id 라 그것도 받아 준다
                    const pos = state.resumePosition
                    const cur = state.currentTrack
                    if (pos && cur && (pos.trackId === cur.qid || (cur._id && pos.trackId === cur._id))) {
                        youtubePlayer.seek(pos.time)
                        commit('SET_RESUME_POSITION', null)
                    }
                } else if (event.data === YT.PlayerState.PAUSED) {
                    commit('SET_IS_PLAYING', false)
                }
            },
            // onError callback — 2: 잘못된 id / 5: 재생 불가 / 100: 없는 영상 / 101·150: 임베드 차단
            (error) => {
                console.error('YouTube player error:', error && error.data)
                dispatch('playFailed', '재생할 수 없는 곡이라 건너뛰었어요.')
            }
        )

        setInterval(() => {
            const currentTime = youtubePlayer.getCurrentTime()
            const duration = youtubePlayer.getDuration()
            dispatch('updateTrackProgress', { currentTime, duration })
        }, 1000)
    },

    updateTrackProgress({ commit, state, dispatch }) {
        if (state.isYouTubeReady && youtubePlayer) {
            const currentTime = youtubePlayer.getCurrentTime()
            const duration = youtubePlayer.getDuration()
            if (currentTime !== undefined && duration !== undefined) {
                commit('SET_CURRENT_TIME', currentTime)
                commit('SET_DURATION', duration)
                if (state.isPlaying) {
                    dispatch('savePosition')
                    dispatch('tallyPlay', duration)
                }
            }
        }
    },

    // 재생 수 기록 — 앱과 같은 기준: 이 곡을 **실제로 30초 또는 절반** 들으면 1회(넘긴 곡은 안 셈).
    // 폴링 횟수가 아니라 경과 시간으로 더한다(좀비 복구로 폴링이 겹쳐도 두 배로 세지 않게, 한 틱 최대 2초).
    // 서버는 같은 곡 20초 내 재발사를 무시하므로 중복 걱정은 없다. 유튜브 곡(테마)은 곡 id가 없어 세지 않는다
    tallyPlay({ state, commit }, duration) {
        const track = state.currentTrack
        if (!track || track.kind !== 'song' || !track._id) return
        const now = Date.now()
        let { trackId, seconds, counted, lastTick } = state.playTally
        if (trackId !== track.qid) {
            trackId = track.qid
            seconds = 0
            counted = false
            lastTick = now
        }
        seconds += Math.min((now - lastTick) / 1000, 2)
        if (!counted && (seconds >= 30 || (duration > 0 && seconds >= duration / 2))) {
            counted = true
            // 웹은 "어디서 틀었나"를 추적하지 않는다 → unknown
            this.$axios.$post(`/api/songs/${track._id}/play`, { source: 'unknown' }).catch(() => {})
        }
        commit('SET_PLAY_TALLY', { trackId, seconds, counted, lastTick: now })
    },

    toggleShuffle({ dispatch, state }) {
        return dispatch('applyQueue', Q.setShuffle(queueState(state), !state.shuffleOn))
    },

    toggleRepeat({ commit, rootState, state }) {
        const modes = ['off', 'all', 'one']
        const nextMode = modes[(modes.indexOf(state.repeatMode) + 1) % modes.length]
        commit('SET_REPEAT_MODE', nextMode)

        const repeatModeKey = getStorageKey(rootState, 'repeat_mode')
        if (repeatModeKey) localStorage.setItem(repeatModeKey, nextMode)
    },
}

export const getters = {
    // "이전"은 곡이 있으면 항상 누를 수 있다(3초 넘게 들었으면 처음으로, 아니면 앞 곡)
    hasPreviousTrack: state => !!state.currentTrack,
    hasNextTrack: state => !!state.currentTrack && Q.hasNext(queueState(state)),
    upcoming: state => Q.upcomingContext(queueState(state)),
    queueLength: state => Q.queueLength(queueState(state)),
    contextName: state => (state.context && state.context.source && state.context.source.name) || '',
}
