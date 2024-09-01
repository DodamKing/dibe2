// store/player.js
import audioPlayer from "~/utils/audioPlayer"

export const state = () => ({
    currentTrack: null,
    queue: [],
    isPlaying: false,
    currentTime: 0,
    duration: 0,
    volume: 1
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
    }
}

export const actions = {
    async addToPlaylist({ commit, dispatch, state }, song) {
        const { songData } = await this.$axios.$get(`/api/songs/songdata?title=${song.title}&artist=${song.artist}`)
        commit('ADD_TO_QUEUE', songData)

        if (!state.currentTrack) {
            commit('SET_CURRENT_TRACK', songData)
        }
    },

    setCurrentTrack({ commit, dispatch }, track) {
        commit('SET_CURRENT_TRACK', track)
        // dispatch('play')
    },

    async play({ commit, state }) {
        if (state.currentTrack) {
            try {
                const url = `/api/songs/stream/${state.currentTrack._id}`
                await audioPlayer.play(url)
                commit('SET_IS_PLAYING', true)
            } catch (error) {
                console.error('Failed to play track:', error)
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

    setVolume({ commit }, volume) {
        audioPlayer.setVolume(volume);
        commit('SET_VOLUME', volume);
    },

    seek({ state }, time) {
        if (state.currentTrack) {
            audioPlayer.seek(time);
        }
    },

    initAudioPlayer({ dispatch }) {
        audioPlayer.init();
        // audioPlayer.setVolume(state.volume)
        audioPlayer.setOnTrackEndedCallback(() => {
            dispatch('playNext');
        });
        audioPlayer.setOnTimeUpdateCallback((currentTime, duration) => {
            dispatch('updateTrackProgress', { currentTime, duration });
        });
    },

    updateTrackProgress({ commit }, { currentTime, duration }) {
        commit('SET_CURRENT_TIME', currentTime);
        commit('SET_DURATION', duration);
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