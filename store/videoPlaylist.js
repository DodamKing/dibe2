// store/videoPlaylist.js

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
    REMOVE_VIDEOS_FROM_PLAYLIST(state, { playlistId, videoIds }) {
        const playlist = state.playlists.find(p => p._id === playlistId)
        if (playlist) {
            playlist.videos = playlist.videos.filter(video => !videoIds.includes(video.videoId))
        }
    },
    SET_CURRENT_PLAYLIST(state, playlist) {
        state.currentPlaylist = playlist;
    },
    SET_PLAYLIST_NAME(state, { name }) {
        if (state.currentPlaylist) {
            state.currentPlaylist.name = name
        }
    }
}

export const actions = {
    async fetchPlaylists({ commit }) {
        try {
            const { playlists } = await this.$axios.$get('/api/video-playlists')
            commit('SET_PLAYLISTS', playlists)
        } catch (error) {
            console.error('Failed to fetch video playlists:', error)
        }
    },
    async createPlaylist({ commit }, playlistName) {
        try {
            const response = await this.$axios.$post('/api/video-playlists', { name: playlistName })
            commit('ADD_PLAYLIST', response.playlist)
            return response.playlist
        } catch (error) {
            console.error('Failed to create video playlist:', error)
            throw error
        }
    },
    async deletePlaylist({ commit }, playlistId) {
        try {
            const { updatedPlaylists } = await this.$axios.$delete('/api/video-playlists/' + playlistId)
            commit('SET_PLAYLISTS', updatedPlaylists)
        } catch (err) {
            console.error('비디오 플레이리스트 삭제 오류: ', err)
        }
    },
    async addVideosToPlaylist({ commit }, { playlistId, videos }) {
        try {
            const { success, playlist, addedVideos } = await this.$axios.$post(`/api/video-playlists/${playlistId}/videos`, { videos })
            if (success) {
                commit('UPDATE_PLAYLIST', playlist)
                return { success, addedVideos }
            }
        } catch (err) {
            console.error('비디오 플레이리스트 영상 추가 오류: ', err)
        }
    },
    async removeVideosFromPlaylist({ commit }, { playlistId, videoIds }) {
        try {
            const { success, removedCount } = await this.$axios.$delete(`/api/video-playlists/${playlistId}/videos`, { data: { videoIds } })
            if (success) {
                commit('REMOVE_VIDEOS_FROM_PLAYLIST', { playlistId, videoIds })
                return { success, removedCount }
            }
        } catch (err) {
            console.error('비디오 플레이리스트에서 영상 제거 실패:', err)
        }
    },
    async fetchPlaylistDetail({ commit }, playlistId) {
        try {
            const { success, playlist } = await this.$axios.$get(`/api/video-playlists/${playlistId}`);
            if (success) commit('SET_CURRENT_PLAYLIST', playlist);
            return success;
        } catch (error) {
            console.error('비디오 플레이리스트 상세 정보 조회 중 오류 발생:', error);
            throw error;
        }
    },
    async updatePlaylistName({ commit }, { playlistId, name }) {
        try {
            const result = await this.$axios.$put(`/api/video-playlists/${playlistId}/name`, { name })
            if (result.success) commit('SET_PLAYLIST_NAME', { name: result.name })
            return result
        } catch (error) {
            console.error('비디오 플레이리스트 제목 수정 중 오류 발생:', error);
            throw error;
        }
    }
}

export const getters = {
    getPlaylistById: (state) => (id) => {
        return state.playlists.find(playlist => playlist._id === id)
    },
}
