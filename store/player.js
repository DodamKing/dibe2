// store/player.js
// import audioPlayer from "~/utils/audioPlayer"
import youtubePlayer from "~/utils/youtubePlayer"

const getStorageKey = (rootState, key) => {
    if (!rootState.auth.loggedIn) return null
    const userId = rootState.auth.user.userId
    return `user_${userId}_${key}`
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
}

export const actions = {
    async initializeAudioSystem({ commit, dispatch, state }) {
        if (!state.isInitialized) {
            await dispatch('initYoutubePlayer')
            await dispatch('initializeQueue')
            commit('SET_IS_INITIALIZED', true)
        }
    },

    initializeQueue({ commit, rootState }) {
        if (!rootState.auth.loggedIn) return

        const queueKey = getStorageKey(rootState, 'queue')
        const trackKey = getStorageKey(rootState, 'current_track')
        const volumeKey = getStorageKey(rootState, 'volume')
        const repeatModeKey = getStorageKey(rootState, 'repeat_mode')
        const shuffleKey = getStorageKey(rootState, 'shuffle')
        const originalQueueKey = getStorageKey(rootState, 'original_queue')

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
            const { songDatas } = await this.$axios.$post('/api/songs/songsdata', { songs })
            commit('ADD_MULTIPLE_TO_QUEUE', songDatas)
            await dispatch('saveQueue')

            if (!state.currentTrack) await dispatch('setCurrentTrack', songDatas[0])
            return songDatas.length
        } catch (err) {
            console.error(err)
        }
    },

    saveQueue({ state, rootState }) {
        const key = getStorageKey(rootState, 'queue')
        if (key) localStorage.setItem(key, JSON.stringify(state.queue))
    },

    setCurrentTrack({ commit, rootState }, track) {
        commit('SET_CURRENT_TRACK', track)

        const key = getStorageKey(rootState, 'current_track')
        if (key) localStorage.setItem(key, JSON.stringify(track))
    },

    async play({ commit, state, dispatch }) {
        if (state.isQueueEnded && state.queue.length > 0) {
            // 큐가 끝났지만 재생 목록에 곡이 있는 경우, 첫 번째 곡으로 설정
            await dispatch('setCurrentTrack', state.queue[0])
            commit('SET_QUEUE_ENDED', false)
        }

        if (state.currentTrack && state.isYouTubeReady) {
            commit('SET_IS_LOADING', true)
            const youtubeId = await this.$axios.$get('/api/songs/youtubeId/' + state.currentTrack._id)
            try {
                if (youtubeId !== youtubePlayer.getCurrentVideoId()) youtubePlayer.loadVideo(youtubeId)
                youtubePlayer.play()
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

    pause({ commit }) {
        youtubePlayer.pause()
        commit('SET_IS_PLAYING', false)
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

    updateTrackProgress({ commit, state }) {
        if (state.isYouTubeReady && youtubePlayer) {
            const currentTime = youtubePlayer.getCurrentTime()
            const duration = youtubePlayer.getDuration()
            if (currentTime !== undefined && duration !== undefined) {
                commit('SET_CURRENT_TIME', currentTime)
                commit('SET_DURATION', duration)
            }
        }
    },

    toggleShuffle({ commit, rootState, state, dispatch }) {
        const newShuffleState = !state.shuffleOn
        if (newShuffleState) {
            commit('SET_ORIGINAL_QUEUE', state.queue) // 현재 큐를 원본으로 저장
            commit('SHUFFLE_QUEUE')

            const originalQueueKey = getStorageKey(rootState, 'original_queue')
            if (originalQueueKey) localStorage.setItem(originalQueueKey, JSON.stringify(state.originalQueue))
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
    repeatModeIcon: (state) => {
        switch (state.repeatMode) {
            case 'off':
                return 'fa-repeat'
            case 'all':
                return 'fa-repeat'
            case 'one':
                return 'fa-redo'
            default:
                return 'fa-repeat'
        }
    },
    shuffleIcon: (state) => {
        return state.shuffleOn ? 'shuffle' : 'shuffle-off'
    },
}