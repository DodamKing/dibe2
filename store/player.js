// store/player.js
import audioPlayer from "~/utils/audioPlayer"

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
    isLoading: false
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

    async addMultipleToPlaylist({ commit, state }, songs) {
        try {
            const { songDatas } = await this.$axios.$post('/api/songs/songsdata', { songs })
            commit('ADD_MULTIPLE_TO_QUEUE', songDatas)
            if (!state.currentTrack) commit('SET_CURRENT_TRACK', songDatas[0])
            return songDatas.length
        } catch (err) {
            console.error(err)
        }
    },

    setCurrentTrack({ commit, dispatch }, track) {
        commit('SET_CURRENT_TRACK', track)
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

    setVolume({ commit }, volume) {
        audioPlayer.setVolume(volume);
        commit('SET_VOLUME', volume);
    },

    seek({ commit, state, dispatch }, time) {
        if (state.currentTrack) {
            audioPlayer.seek(time);
            commit('SET_CURRENT_TIME', time)
        }
    },

    initAudioPlayer({ dispatch }) {
        audioPlayer.init();
        // audioPlayer.setVolume(state.volume)
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