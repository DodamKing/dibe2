// store/player.js
import audioPlayer from "~/utils/audioPlayer"

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
    volume: 1,
    shuffleOn: false,
    repeatOn: false,
    originalQueue: [],
    isLoading: false,
    isInitialized: false
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
    SHUFFLE_QUEUE(state) {
        state.originalQueue = [...state.queue]

        for (let i = state.queue.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [state.queue[i], state.queue[j]] = [state.queue[j], state.queue[i]];
        }
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
}

export const actions = {
    async initializeAudioSystem({ commit, dispatch, state }) {
        if (!state.isInitialized) {
            await dispatch('initializeQueue')
            dispatch('initAudioPlayer')
            commit('SET_IS_INITIALIZED', true)
        }
    },

    initializeQueue({ commit, rootState }) {
        if (!rootState.auth.loggedIn) return

        const queueKey = getStorageKey(rootState, 'queue')
        const trackKey = getStorageKey(rootState, 'current_track')
        const volumeKey = getStorageKey(rootState, 'volume')

        const savedQueue = localStorage.getItem(queueKey)
        if (savedQueue) {
            commit('SET_QUEUE', JSON.parse(savedQueue))
        }
        const savedCurrentTrack = localStorage.getItem(trackKey)
        if (savedCurrentTrack) {
            commit('SET_CURRENT_TRACK', JSON.parse(savedCurrentTrack))
        }
        const savedVolume = localStorage.getItem(volumeKey)
        if (savedVolume) commit('SET_VOLUME', parseFloat(savedVolume))
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
        // dispatch('play')
    },

    async play({ commit, state }) {
        if (state.currentTrack) {
            commit('SET_IS_LOADING', true)
            try {
                const url = `/api/songs/stream/${state.currentTrack._id}`
                await audioPlayer.play(url)
                commit('SET_IS_PLAYING', true)
            } catch (error) {
                console.error('Failed to play track:', error)
            } finally {
                commit('SET_IS_LOADING', false)
            }
        }
    },

    pause({ commit }) {
        audioPlayer.pause()
        commit('SET_IS_PLAYING', false)
    },

    playNext({ commit, state, dispatch }) {
        const currentIndex = state.queue.findIndex(track => track._id === state.currentTrack?._id)
        if (currentIndex < state.queue.length - 1) {
            commit('SET_CURRENT_TRACK', state.queue[currentIndex + 1])
            dispatch('play')
        } else if (state.repeatOn) {
            // 반복 재생이 켜져 있으면 첫 번째 트랙으로 돌아감
            commit('SET_CURRENT_TRACK', state.queue[0])
            dispatch('play')
        } else {
            // 큐의 마지막 곡이었을 경우
            commit('SET_CURRENT_TRACK', null)
            commit('SET_IS_PLAYING', false)
        }
    },

    playPrevious({ commit, state, dispatch }) {
        const currentIndex = state.queue.findIndex(track => track._id === state.currentTrack?._id)
        if (currentIndex > 0) {
            commit('SET_CURRENT_TRACK', state.queue[currentIndex - 1])
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
        audioPlayer.setVolume(volume);
        commit('SET_VOLUME', volume);

        const volumeKey = getStorageKey(rootState, 'volume')
        if (volumeKey) localStorage.setItem(volumeKey, volume)
    },

    seek({ commit, state, dispatch }, time) {
        if (state.currentTrack) {
            audioPlayer.seek(time);
            commit('SET_CURRENT_TIME', time)
        }
    },

    initAudioPlayer({ state, dispatch }) {
        audioPlayer.init()
        audioPlayer.setVolume(state.volume)
        audioPlayer.setOnTrackEndedCallback(() => {
            if (state.repeatOn && !state.shuffleOn) {
                // 한 곡 반복 재생
                dispatch('seek', 0);
                dispatch('play');
            } else {
                dispatch('playNext');
            }
        });
        audioPlayer.setOnTimeUpdateCallback((currentTime, duration) => {
            dispatch('updateTrackProgress', { currentTime, duration });
        });
    },

    updateTrackProgress({ commit }, { currentTime, duration }) {
        commit('SET_CURRENT_TIME', currentTime);
        commit('SET_DURATION', duration);
    },

    toggleShuffle({ commit, state }) {
        const shuffleOn = !state.shuffleOn
        commit('SET_SHUFFLE', shuffleOn)
        if (shuffleOn) {
            // commit('SHUFFLE_QUEUE')
            alert('셔플 켬, 구현 필요')
        } else {
            // commit('RESTORE_ORIGINAL_QUEUE')
            alert('셔플 끔, 구현 필요')
        }
    },

    toggleRepeat({ commit, state }) {
        commit('SET_REPEAT', !state.repeatOn)
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
                commit('SET_CURRENT_TRACK', null)
                commit('SET_IS_PLAYING', false)
                audioPlayer.stop()
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
    }
}