// store/videoQueue.js — 음원 큐(store/player.js)의 축소판. 볼륨 없음(페이지 로컬 YT.Player가 직접 관리).
// 셔플/반복은 player.js와 동일 패턴이지만, repeat 'one'의 실제 재시작(seekTo)은 비디오가 공유 싱글톤이 아니라
// 페이지 로컬 YT.Player 인스턴스라서 store가 아니라 pages/video/index.vue에서 처리함.

const getStorageKey = (rootState, key) => {
    if (!rootState.auth.loggedIn) return null
    const userId = rootState.auth.user.userId
    return `user_${userId}_${key}`
}

export const state = () => ({
    queue: [],
    currentVideo: null,
    shuffleOn: false,
    repeatMode: 'off',
    originalQueue: [],
})

export const mutations = {
    SET_QUEUE(state, queue) {
        state.queue = queue
    },
    ADD_TO_QUEUE(state, video) {
        state.queue.push(video)
    },
    ADD_MULTIPLE_TO_QUEUE(state, videos) {
        state.queue.push(...videos)
    },
    REMOVE_FROM_QUEUE(state, videoIds) {
        state.queue = state.queue.filter(video => !videoIds.includes(video.id))
    },
    SET_CURRENT_VIDEO(state, video) {
        state.currentVideo = video
    },
    SET_SHUFFLE(state, shuffleOn) {
        state.shuffleOn = shuffleOn
    },
    SET_REPEAT_MODE(state, mode) {
        state.repeatMode = mode
    },
    SET_ORIGINAL_QUEUE(state, queue) {
        state.originalQueue = [...queue]
    },
    RESTORE_ORIGINAL_QUEUE(state) {
        state.queue = [...state.originalQueue]
    },
    SHUFFLE_QUEUE(state) {
        if (state.currentVideo) {
            // 현재 재생 중인 영상을 제외하고 나머지를 셔플
            const currentIndex = state.queue.findIndex(video => video.id === state.currentVideo.id)
            const remaining = state.queue.filter((_, index) => index !== currentIndex)

            for (let i = remaining.length - 1; i > 0; i--) {
                const j = Math.floor(Math.random() * (i + 1));
                [remaining[i], remaining[j]] = [remaining[j], remaining[i]];
            }

            state.queue = [state.currentVideo, ...remaining]
        } else {
            const shuffled = [...state.queue]
            for (let i = shuffled.length - 1; i > 0; i--) {
                const j = Math.floor(Math.random() * (i + 1));
                [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
            }
            state.queue = shuffled
        }
    },
}

export const actions = {
    initializeQueue({ commit, rootState }) {
        if (!rootState.auth.loggedIn) return

        const queueKey = getStorageKey(rootState, 'video_queue')
        const currentKey = getStorageKey(rootState, 'video_current')
        const shuffleKey = getStorageKey(rootState, 'video_shuffle')
        const repeatModeKey = getStorageKey(rootState, 'video_repeat_mode')
        const originalQueueKey = getStorageKey(rootState, 'video_original_queue')

        const savedQueue = localStorage.getItem(queueKey)
        if (savedQueue) commit('SET_QUEUE', JSON.parse(savedQueue))

        const savedCurrent = localStorage.getItem(currentKey)
        if (savedCurrent) commit('SET_CURRENT_VIDEO', JSON.parse(savedCurrent))

        const savedShuffle = localStorage.getItem(shuffleKey)
        if (savedShuffle) commit('SET_SHUFFLE', JSON.parse(savedShuffle))

        const savedRepeatMode = localStorage.getItem(repeatModeKey)
        if (savedRepeatMode) commit('SET_REPEAT_MODE', savedRepeatMode)

        const savedOriginalQueue = localStorage.getItem(originalQueueKey)
        if (savedOriginalQueue) commit('SET_ORIGINAL_QUEUE', JSON.parse(savedOriginalQueue))
    },

    addToQueue({ commit, state, dispatch }, video) {
        const exists = state.queue.some(queued => queued.id === video.id)
        if (exists) return { added: 0, message: 'ALL_DUPLICATES' }

        commit('ADD_TO_QUEUE', video)
        dispatch('saveQueue')
        return { added: 1, message: 'SUCCESS' }
    },

    addMultipleToQueue({ commit, state, dispatch }, videos) {
        const uniqueVideos = videos.filter(video =>
            !state.queue.some(queued => queued.id === video.id)
        )

        if (uniqueVideos.length === 0) return { added: 0, message: 'ALL_DUPLICATES' }

        commit('ADD_MULTIPLE_TO_QUEUE', uniqueVideos)
        dispatch('saveQueue')

        return {
            added: uniqueVideos.length,
            duplicates: videos.length - uniqueVideos.length,
            message: 'SUCCESS'
        }
    },

    removeFromQueue({ commit, dispatch }, videoIds) {
        commit('REMOVE_FROM_QUEUE', videoIds)
        dispatch('saveQueue')
    },

    saveQueue({ state, rootState }) {
        const key = getStorageKey(rootState, 'video_queue')
        if (key) localStorage.setItem(key, JSON.stringify(state.queue))
    },

    setCurrentVideo({ commit, rootState }, video) {
        commit('SET_CURRENT_VIDEO', video)

        const key = getStorageKey(rootState, 'video_current')
        if (key) localStorage.setItem(key, JSON.stringify(video))
    },

    setQueueAndPlay({ commit, dispatch }, videos) {
        if (!videos || videos.length === 0) return
        commit('SET_QUEUE', videos)
        dispatch('saveQueue')
        dispatch('setCurrentVideo', videos[0])
    },

    playNext({ state, dispatch }) {
        // repeat 'one'의 재시작(seekTo)은 페이지 로컬 YT.Player를 갖고 있는 컴포넌트에서 처리하고
        // 여기까지는 호출되지 않음(pages/video/index.vue의 playNext 메서드 참고). 여기는 일반 다음곡 + 전체반복만.
        const currentIndex = state.queue.findIndex(video => video.id === state.currentVideo?.id)
        if (currentIndex !== -1 && currentIndex < state.queue.length - 1) {
            dispatch('setCurrentVideo', state.queue[currentIndex + 1])
        } else if (state.repeatMode === 'all' && state.queue.length > 0) {
            dispatch('setCurrentVideo', state.queue[0])
        }
    },

    playPrevious({ state, dispatch }) {
        const currentIndex = state.queue.findIndex(video => video.id === state.currentVideo?.id)
        if (currentIndex > 0) {
            dispatch('setCurrentVideo', state.queue[currentIndex - 1])
        }
    },

    toggleShuffle({ commit, rootState, state, dispatch }) {
        const newShuffleState = !state.shuffleOn
        if (newShuffleState) {
            commit('SET_ORIGINAL_QUEUE', state.queue)
            commit('SHUFFLE_QUEUE')

            const originalQueueKey = getStorageKey(rootState, 'video_original_queue')
            if (originalQueueKey) localStorage.setItem(originalQueueKey, JSON.stringify(state.originalQueue))
        } else {
            commit('RESTORE_ORIGINAL_QUEUE')
        }

        commit('SET_SHUFFLE', newShuffleState)
        dispatch('saveQueue')

        const shuffleKey = getStorageKey(rootState, 'video_shuffle')
        if (shuffleKey) localStorage.setItem(shuffleKey, JSON.stringify(newShuffleState))
    },

    toggleRepeat({ commit, rootState, state }) {
        const modes = ['off', 'all', 'one']
        const currentIndex = modes.indexOf(state.repeatMode)
        const nextMode = modes[(currentIndex + 1) % modes.length]
        commit('SET_REPEAT_MODE', nextMode)

        const repeatModeKey = getStorageKey(rootState, 'video_repeat_mode')
        if (repeatModeKey) localStorage.setItem(repeatModeKey, nextMode)
    },
}

export const getters = {
    hasPreviousVideo: (state) => {
        if (!state.currentVideo) return false
        const currentIndex = state.queue.findIndex(video => video.id === state.currentVideo.id)
        return currentIndex > 0
    },
    hasNextVideo: (state) => {
        if (!state.currentVideo) return false
        const currentIndex = state.queue.findIndex(video => video.id === state.currentVideo.id)
        return currentIndex !== -1 && currentIndex < state.queue.length - 1
    },
}
