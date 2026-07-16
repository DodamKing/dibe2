// store/player.js
import youtubePlayer from "~/utils/youtubePlayer"

const getStorageKey = (rootState, key) => {
    if (!rootState.auth.loggedIn) return null
    const userId = rootState.auth.user.userId
    return `user_${userId}_${key}`
}

// localStorage 캐시는 표시에 필요한 최소 필드만. lyrics 등은 lazy fetch.
const stripForCache = (song) => {
    if (!song) return song
    const { _id, title, artist, coverUrl } = song
    return { _id, title, artist, coverUrl }
}

export const state = () => ({
    currentTrack: null,
    queue: [],
    isPlaying: false,
    currentTime: 0,
    duration: 0,
    volume: 100,
    shuffleOn: false,
    repeatOn: false,
    repeatMode: 'off',
    originalQueue: [],
    isLoading: false,
    isInitialized: false,
    isYouTubeReady: false,
    isQueueEnded: false,
    // 새로고침 복원 시 기억해둔 위치 — 다음 play()에서 한 번만 seek하고 비움(currentTime과는 별개)
    resumePosition: null,
})

export const mutations = {
    SET_CURRENT_TRACK(state, track) {
        state.currentTrack = track
    },
    SET_QUEUE(state, queue) {
        state.queue = queue
    },
    ADD_TO_QUEUE(state, track) {
        state.queue.push(track)
    },
    ADD_MULTIPLE_TO_QUEUE(state, songs) {
        state.queue.push(...songs)
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
        state.volume = volume;
    },
    SET_SHUFFLE(state, shuffleOn) {
        state.shuffleOn = shuffleOn
    },
    SET_REPEAT(state, repeatOn) {
        state.repeatOn = repeatOn
    },
    RESTORE_ORIGINAL_QUEUE(state) {
        state.queue = [...state.originalQueue]
    },
    SET_IS_LOADING(state, isLoading) {
        state.isLoading = isLoading
    },
    SET_IS_INITIALIZED(state, isInitialized) {
        state.isInitialized = isInitialized
    },
    REMOVE_FROM_QUEUE(state, trackIds) {
        state.queue = state.queue.filter(track => !trackIds.includes(track._id))
    },
    SET_REPEAT_MODE(state, mode) {
        state.repeatMode = mode
        state.repeatOn = mode !== 'off'
    },
    SET_RESUME_POSITION(state, position) {
        state.resumePosition = position
    },
    SHUFFLE_QUEUE(state) {
        if (state.currentTrack) {
            // 현재 재생 중인 트랙을 제외하고 나머지를 셔플
            const currentTrackIndex = state.queue.findIndex(track => track._id === state.currentTrack._id)
            const remainingTracks = state.queue.filter((_, index) => index !== currentTrackIndex)

            for (let i = remainingTracks.length - 1; i > 0; i--) {
                const j = Math.floor(Math.random() * (i + 1));
                [remainingTracks[i], remainingTracks[j]] = [remainingTracks[j], remainingTracks[i]];
            }

            // 현재 트랙을 첫 번째로 하고 셔플된 나머지 트랙을 그 뒤에 붙임
            state.queue = [state.currentTrack, ...remainingTracks]
        } else {
            // 현재 재생 중인 트랙이 없으면 전체 큐를 셔플
            const shuffled = [...state.queue]
            for (let i = shuffled.length - 1; i > 0; i--) {
                const j = Math.floor(Math.random() * (i + 1));
                [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
            }
            state.queue = shuffled
        }
    },
    SET_ORIGINAL_QUEUE(state, queue) {
        state.originalQueue = [...queue]
    },
    SET_YOUTUBE_READY(state, isReady) {
        state.isYouTubeReady = isReady
    },
    SET_CUSTOM_METADATA(state, { trackId, metadata }) {
        state.customMetadata[trackId] = metadata;
    },
    SET_QUEUE_ENDED(state, isEnded) {
        state.isQueueEnded = isEnded
    },
    SET_CURRENT_TRACK_LYRICS(state, lyrics) {
        if (state.currentTrack) {
            state.currentTrack = { ...state.currentTrack, lyrics }
        }
    },
}

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

    initializeQueue({ commit, rootState }) {
        if (!rootState.auth.loggedIn) return

        const queueKey = getStorageKey(rootState, 'queue')
        const trackKey = getStorageKey(rootState, 'current_track')
        const volumeKey = getStorageKey(rootState, 'volume')
        const repeatModeKey = getStorageKey(rootState, 'repeat_mode')
        const shuffleKey = getStorageKey(rootState, 'shuffle')
        const originalQueueKey = getStorageKey(rootState, 'original_queue')
        const positionKey = getStorageKey(rootState, 'position')

        const savedQueue = localStorage.getItem(queueKey)
        if (savedQueue) {
            commit('SET_QUEUE', JSON.parse(savedQueue))
        }
        const savedCurrentTrack = localStorage.getItem(trackKey)
        if (savedCurrentTrack) {
            commit('SET_CURRENT_TRACK', JSON.parse(savedCurrentTrack))
        }
        const savedVolume = localStorage.getItem(volumeKey)
        if (savedVolume) commit('SET_VOLUME', Number(savedVolume))

        const savedRepeatMode = localStorage.getItem(repeatModeKey)
        if (savedRepeatMode) commit('SET_REPEAT_MODE', savedRepeatMode)

        const savedShuffle = localStorage.getItem(shuffleKey)
        if (savedShuffle) commit('SET_SHUFFLE', JSON.parse(savedShuffle))

        const savedOriginalQueue = localStorage.getItem(originalQueueKey)
        if (savedOriginalQueue) commit('SET_ORIGINAL_QUEUE', JSON.parse(savedOriginalQueue))

        // 마지막으로 듣던 곡의 위치만 기억(비디오 user_{id}_video_position과 동일 패턴) — 다음 play()에서 한 번만 소비
        const savedPosition = localStorage.getItem(positionKey)
        if (savedPosition) {
            try {
                const parsed = JSON.parse(savedPosition)
                if (parsed && parsed.time > 5) commit('SET_RESUME_POSITION', parsed)
            } catch (e) { /* ignore */ }
        }
    },

    savePosition({ state, rootState }) {
        if (!state.currentTrack) return
        const key = getStorageKey(rootState, 'position')
        if (key) localStorage.setItem(key, JSON.stringify({ trackId: state.currentTrack._id, time: state.currentTime }))
    },

    resetIsInitialized({ commit }) {
        commit('SET_IS_INITIALIZED', false)
    },

    async addToPlaylist({ commit, dispatch, state }, song) {
        const songExists = state.queue.some(
            queuedSong => queuedSong.title === song.title && queuedSong.artist === song.artist
        )
        if (songExists) return // 이곳에 토스트 날려야 함

        const { songData } = await this.$axios.$get(`/api/songs/songdata?title=${song.title}&artist=${song.artist}`)
        commit('ADD_TO_QUEUE', songData)
        await dispatch('saveQueue')

        if (!state.currentTrack) {
            // commit('SET_CURRENT_TRACK', songData)
            await dispatch('setCurrentTrack', songData)
        }
    },

    async addMultipleToPlaylist({ commit, state, dispatch }, songs) {
        try {
            const QUEUE_LIMIT = 1000;

            // 큐 제한 체크
            if (state.queue.length >= QUEUE_LIMIT) {
                return { added: 0, message: 'QUEUE_FULL' };
            }

            // 추가 가능한 곡 수 체크
            if (state.queue.length + songs.length > QUEUE_LIMIT) {
                const remainingSlots = QUEUE_LIMIT - state.queue.length;
                return { added: 0, message: 'QUEUE_LIMIT_EXCEEDED', remaining: remainingSlots };
            }

            const plainSongs = [...songs];
            const uniqueSongs = plainSongs.filter(newSong =>
                !state.queue.some(queuedSong =>
                    queuedSong.title === newSong.title &&
                    queuedSong.artist === newSong.artist
                )
            );

            // 모든 곡이 중복인 경우
            if (uniqueSongs.length === 0) {
                return { added: 0, message: 'ALL_DUPLICATES' };
            }

            const { songDatas } = await this.$axios.$post('/api/songs/songsdata', { songs: uniqueSongs })
            commit('ADD_MULTIPLE_TO_QUEUE', songDatas)
            await dispatch('saveQueue')

            if (!state.currentTrack) await dispatch('setCurrentTrack', songDatas[0])

            // 중복 곡 수 계산해서 함께 전달
            const duplicateCount = songs.length - uniqueSongs.length;
            return {
                added: songDatas.length,
                duplicates: duplicateCount,
                message: 'SUCCESS'
            };
        } catch (err) {
            console.error(err)
            return { added: 0, message: 'ERROR' };
        }
    },

    saveQueue({ state, rootState }) {
        const key = getStorageKey(rootState, 'queue')
        if (key) localStorage.setItem(key, JSON.stringify(state.queue.map(stripForCache)))
    },

    setCurrentTrack({ commit, rootState }, track) {
        commit('SET_CURRENT_TRACK', track)

        const key = getStorageKey(rootState, 'current_track')
        if (key) localStorage.setItem(key, JSON.stringify(stripForCache(track)))
    },

    async refreshQueueData({ state, commit, dispatch, rootState }) {
        const ids = state.queue.map(s => s && s._id).filter(Boolean)
        if (ids.length === 0) return

        try {
            const { songs } = await this.$axios.$post('/api/songs/by-ids', { ids })
            if (!songs || songs.length === 0) return

            const freshMap = new Map(songs.map(s => [s._id, s]))

            // 큐 순서 유지하면서 fresh 데이터로 교체 (DB에서 사라진 곡은 기존 항목 유지)
            const updatedQueue = state.queue.map(item => freshMap.get(item._id) || item)
            commit('SET_QUEUE', updatedQueue)
            await dispatch('saveQueue')

            // originalQueue도 갱신 (셔플 해제 시 사용)
            if (state.originalQueue.length > 0) {
                const updatedOriginal = state.originalQueue.map(item => freshMap.get(item._id) || item)
                commit('SET_ORIGINAL_QUEUE', updatedOriginal)
                const originalQueueKey = getStorageKey(rootState, 'original_queue')
                if (originalQueueKey) localStorage.setItem(originalQueueKey, JSON.stringify(updatedOriginal.map(stripForCache)))
            }

            // currentTrack도 fresh로
            if (state.currentTrack && freshMap.has(state.currentTrack._id)) {
                await dispatch('setCurrentTrack', freshMap.get(state.currentTrack._id))
            }
        } catch (err) {
            // 네트워크 에러 등 — 캐시 유지
            console.error('큐 fresh 갱신 실패:', err)
        }
    },

    async fetchCurrentTrackLyrics({ state, commit }) {
        if (!state.currentTrack) return
        try {
            const { lyrics } = await this.$axios.$get(`/api/songs/lyrics/${state.currentTrack._id}`)
            commit('SET_CURRENT_TRACK_LYRICS', lyrics || '')
        } catch (err) {
            console.error('가사 fetch 실패:', err)
        }
    },

    async play({ commit, state, dispatch }) {
        if (state.isQueueEnded && state.queue.length > 0) {
            // 큐가 끝났지만 재생 목록에 곡이 있는 경우, 첫 번째 곡으로 설정
            await dispatch('setCurrentTrack', state.queue[0])
            commit('SET_QUEUE_ENDED', false)
        }

        if (state.currentTrack && state.isYouTubeReady) {
            commit('SET_IS_LOADING', true)
            try {
                const youtubeId = await this.$axios.$get('/api/songs/youtubeId/' + state.currentTrack._id)
                // 아직 youtubeUrl이 없는 곡. loadVideoById(null)은 예외 없이 조용히 넘어가서
                // 재생 중 표시만 남고 소리는 안 나므로 여기서 끊는다.
                if (!youtubeId) {
                    commit('SET_ERROR_MESSAGE', 'This track is not playable yet. Please try again later.')
                    commit('SET_IS_PLAYING', false)
                    return
                }
                if (youtubeId !== youtubePlayer.getCurrentVideoId()) youtubePlayer.loadVideo(youtubeId)
                youtubePlayer.play()
                // 재생 위치 점프는 onStateChange의 PLAYING 시점(initYoutubePlayer)에서 처리 —
                // loadVideoById 직후 곧바로 seekTo하면 아직 안 먹는 경우가 있어서 안전한 시점으로 미룸
                commit('SET_IS_PLAYING', true)
                commit('SET_QUEUE_ENDED', false) // 재생이 시작되면 큐 종료 상태 해제
            } catch (error) {
                console.error('Failed to play track:', error)
                commit('SET_ERROR_MESSAGE', 'Failed to play the track. Please try again.')
            } finally {
                commit('SET_IS_LOADING', false)
            }
        }
    },

    pause({ commit, dispatch }) {
        youtubePlayer.pause()
        commit('SET_IS_PLAYING', false)
        dispatch('savePosition')
    },

    playNext({ commit, state, dispatch }) {
        if (state.repeatMode === 'one') {
            dispatch('seek', 0)
            dispatch('play')
            return
        }

        const currentIndex = state.queue.findIndex(track => track._id === state.currentTrack?._id)
        if (currentIndex < state.queue.length - 1) {
            dispatch('setCurrentTrack', state.queue[currentIndex + 1])
            dispatch('play')
        } else if (state.repeatMode === 'all') {
            // 반복 재생이 켜져 있으면 첫 번째 트랙으로 돌아감
            dispatch('setCurrentTrack', state.queue[0])
            dispatch('play')
        } else {
            // 큐의 마지막 곡이었을 경우
            commit('SET_IS_PLAYING', false)
            commit('SET_QUEUE_ENDED', true) // 큐가 끝났음을 표시
        }
    },

    playPrevious({ state, dispatch }) {
        const currentIndex = state.queue.findIndex(track => track._id === state.currentTrack?._id)
        if (currentIndex > 0) {
            dispatch('setCurrentTrack', state.queue[currentIndex - 1])
            dispatch('play')
        }
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
            youtubePlayer.seek(time);
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
                    dispatch('playNext')
                } else if (event.data === YT.PlayerState.PLAYING) {
                    commit('SET_IS_PLAYING', true)
                    // 새로고침 복원 후 그 곡이 실제로 재생되기 시작하는 순간에만 기억해둔 위치로 점프(한 번 쓰고 비움).
                    // loadVideoById 직후 곧바로 seekTo를 호출하면 아직 새 영상이 버퍼링 전이라 씹히는 경우가 있어서,
                    // 실제로 PLAYING 상태가 된 이 시점(=안전하게 seek 가능한 시점)으로 미룸
                    if (state.resumePosition && state.currentTrack && state.resumePosition.trackId === state.currentTrack._id) {
                        youtubePlayer.seek(state.resumePosition.time)
                        commit('SET_RESUME_POSITION', null)
                    }
                } else if (event.data === YT.PlayerState.PAUSED) {
                    commit('SET_IS_PLAYING', false)
                }
            },
            // onError callback
            (error) => {
                console.error('YouTube player error:', error)
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
                if (state.isPlaying) dispatch('savePosition')
            }
        }
    },

    toggleShuffle({ commit, rootState, state, dispatch }) {
        const newShuffleState = !state.shuffleOn
        if (newShuffleState) {
            commit('SET_ORIGINAL_QUEUE', state.queue) // 현재 큐를 원본으로 저장
            commit('SHUFFLE_QUEUE')

            const originalQueueKey = getStorageKey(rootState, 'original_queue')
            if (originalQueueKey) localStorage.setItem(originalQueueKey, JSON.stringify(state.originalQueue.map(stripForCache)))
        } else {
            commit('RESTORE_ORIGINAL_QUEUE')
        }

        commit('SET_SHUFFLE', newShuffleState)
        dispatch('saveQueue')

        const shuffleKey = getStorageKey(rootState, 'shuffle')
        if (shuffleKey) localStorage.setItem(shuffleKey, JSON.stringify(newShuffleState))
    },

    toggleRepeat({ commit, rootState, state }) {
        const modes = ['off', 'all', 'one'];
        const currentIndex = modes.indexOf(state.repeatMode);
        const nextMode = modes[(currentIndex + 1) % modes.length]
        commit('SET_REPEAT_MODE', nextMode);

        const repeatModeKey = getStorageKey(rootState, 'repeat_mode')
        if (repeatModeKey) localStorage.setItem(repeatModeKey, nextMode)
    },

    async playEntirePlaylist({ commit, dispatch }, playlist) {
        if (playlist && playlist.songs && playlist.songs.length > 0) {
            const { songDatas } = await this.$axios.$post('/api/songs/songsdata', { songs: playlist.songs })
            commit('SET_QUEUE', songDatas)
            if (!state.currentTrack || state.currentTrack._id !== songDatas[0]._id) {
                await dispatch('setCurrentTrack', songDatas[0])
            }
            dispatch('play')
            dispatch('saveQueue')
        }
    },

    async playShuffledPlaylist({ commit, dispatch }, playlist) {
        if (playlist && playlist.songs && playlist.songs.length > 0) {
            const { songDatas } = await this.$axios.$post('/api/songs/songsdata', { songs: playlist.songs })
            const shuffledSongs = [...songDatas].sort(() => Math.random() - 0.5)
            commit('SET_QUEUE', shuffledSongs)
            if (!state.currentTrack || state.currentTrack._id !== shuffledSongs[0]._id) {
                await dispatch('setCurrentTrack', shuffledSongs[0])
            }
            dispatch('play')
            dispatch('saveQueue')
        }
    },

    async removeFromQueue({ commit, state, dispatch }, trackIds) {
        commit('REMOVE_FROM_QUEUE', trackIds)
        await dispatch('saveQueue')

        // 현재 재생 중인 트랙이 제거되었는지 확인
        if (trackIds.includes(state.currentTrack?._id)) {
            if (state.queue.length > 0) {
                // 큐에 남은 곡이 있으면 다음 곡을 재생
                await dispatch('setCurrentTrack', state.queue[0])
                dispatch('play')
            } else {
                // 큐가 비어있으면 재생을 중지하고 현재 트랙을 null로 설정
                await dispatch('setCurrentTrack', null)
                commit('SET_IS_PLAYING', false)
                youtubePlayer.stop()
            }
        }
    },
}

export const getters = {
    hasPreviousTrack: (state) => {
        if (!state.currentTrack) return false;
        const currentIndex = state.queue.findIndex(track => track._id === state.currentTrack._id);
        return currentIndex > 0;
    },
    hasNextTrack: (state) => {
        if (!state.currentTrack) return false;
        const currentIndex = state.queue.findIndex(track => track._id === state.currentTrack._id);
        return currentIndex < state.queue.length - 1;
    },
    shuffleIcon: (state) => {
        return state.shuffleOn ? 'shuffle' : 'shuffle-off'
    },
}