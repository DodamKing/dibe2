export const state = () => ({
    playlists: [],
    currentPlaylist: null,
})

export const mutations = {
    SET_PLAYLISTS(state, playlists) {
        state.playlists = playlists
    },
    ADD_PLAYLIST(state, playlist) {
        state.playlists.push(playlist)
    },
    SET_CURRENT_PLAYLIST(state, playlist) {
        state.currentPlaylist = playlist
    },
}

export const actions = {
    async fetchPlaylists({ commit }) {
        try {
            // API 호출로 플레이리스트 목록을 가져옵니다.
            const response = await this.$axios.$get('/api/playlists')
            commit('SET_PLAYLISTS', response.playlists)
        } catch (error) {
            console.error('Failed to fetch playlists:', error)
            // 에러 처리 로직 (예: 사용자에게 알림)
        }
    },
    async createPlaylist({ commit }, playlistName) {
        try {
            // API 호출로 새 플레이리스트를 생성합니다.
            const response = await this.$axios.$post('/api/playlists', { name: playlistName })
            commit('ADD_PLAYLIST', response.playlist)
            return response.playlist
        } catch (error) {
            console.error('Failed to create playlist:', error)
            throw error // 컴포넌트에서 에러 처리를 위해 에러를 다시 throw합니다.
        }
    },
    setCurrentPlaylist({ commit }, playlist) {
        commit('SET_CURRENT_PLAYLIST', playlist)
    },
}

export const getters = {
    getPlaylistById: (state) => (id) => {
        return state.playlists.find(playlist => playlist.id === id)
    },
}