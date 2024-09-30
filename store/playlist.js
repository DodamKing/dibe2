// store/playlist.js

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
    UPDATE_PLAYLIST(state, updatedPlaylist) {
        const index = state.playlists.findIndex(p => p._id === updatedPlaylist._id);
        if (index !== -1) {
            state.playlists.splice(index, 1, updatedPlaylist);
        }
    },
    REMOVE_SONGS_FROM_PLAYLIST(state, { playlistId, songIds }) {
        const playlist = state.playlists.find(p => p._id === playlistId)
        if (playlist) {
            playlist.songs = playlist.songs.filter(song => !songIds.includes(song.songId))
        }
    },
    SET_CURRENT_PLAYLIST(state, playlist) {
        state.currentPlaylist = playlist;
    },
}

export const actions = {
    async fetchPlaylists({ commit }) {
        try {
            // API 호출로 플레이리스트 목록을 가져옵니다.
            const { playlists } = await this.$axios.$get('/api/playlists')
            commit('SET_PLAYLISTS', playlists)
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
    async deletePlaylist({ commit }, playlistId) {
        try {
            const { updatedPlaylists } = await this.$axios.$delete('/api/playlists/' + playlistId)
            commit('SET_PLAYLISTS', updatedPlaylists)
        } catch (err) {
            console.error('플레이 리스트 삭제 오류: ', err)
        }
    },
    async addSongsToPlaylist({ commit }, { playlistId, songs }) {
        try {
            const { success, playlist, addedSongs } = await this.$axios.$post(`/api/playlists/${playlistId}/songs`, { songs })
            if (success) {
                commit('UPDATE_PLAYLIST', playlist)
                return { success, addedSongs }
            }
        } catch (err) {
            console.error('내 플레이리스트 곡 추가 오류: ', err)
        }
    },
    async removeSongsFromPlaylist({ commit, dispatch }, { playlistId, songIds }) {
        try {
            const { success, removedCount } = await this.$axios.$delete(`/api/playlists/${playlistId}/songs`, { data: { songIds } })
            if (success) {
                commit('REMOVE_SONGS_FROM_PLAYLIST', { playlistId, songIds })
                return { success, removedCount }
            }
        } catch (err) {
            console.error('플레이리스트에서 노래 제거 실패:', err)
        }
    },
    async fetchPlaylistDetail({ commit }, playlistId) {
        try {
            const { success, playlist } = await this.$axios.$get(`/api/playlists/${playlistId}`);
            if (success) commit('SET_CURRENT_PLAYLIST', playlist);
            return success;
        } catch (error) {
            console.error('플레이리스트 상세 정보 조회 중 오류 발생:', error);
            throw error;
        }
    },
}

export const getters = {
    getPlaylistById: (state) => (id) => {
        return state.playlists.find(playlist => playlist.id === id)
    },
}