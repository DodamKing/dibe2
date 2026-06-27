// store/videoQueue.js — 음원 큐(store/player.js)의 축소판. 셔플/반복/볼륨 없음, 1차는 순서재생 + 자동 다음곡만.

const getStorageKey = (rootState, key) => {
    if (!rootState.auth.loggedIn) return null
    const userId = rootState.auth.user.userId
    return `user_${userId}_${key}`
}

export const state = () => ({
    queue: [],
    currentVideo: null,
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
}

export const actions = {
    initializeQueue({ commit, rootState }) {
        if (!rootState.auth.loggedIn) return

        const queueKey = getStorageKey(rootState, 'video_queue')
        const currentKey = getStorageKey(rootState, 'video_current')

        const savedQueue = localStorage.getItem(queueKey)
        if (savedQueue) commit('SET_QUEUE', JSON.parse(savedQueue))

        const savedCurrent = localStorage.getItem(currentKey)
        if (savedCurrent) commit('SET_CURRENT_VIDEO', JSON.parse(savedCurrent))
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
        const currentIndex = state.queue.findIndex(video => video.id === state.currentVideo?.id)
        if (currentIndex !== -1 && currentIndex < state.queue.length - 1) {
            dispatch('setCurrentVideo', state.queue[currentIndex + 1])
        }
    },

    playPrevious({ state, dispatch }) {
        const currentIndex = state.queue.findIndex(video => video.id === state.currentVideo?.id)
        if (currentIndex > 0) {
            dispatch('setCurrentVideo', state.queue[currentIndex - 1])
        }
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
