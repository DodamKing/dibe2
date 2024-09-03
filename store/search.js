export const state = () => ({
    searchQuery: '',
    searchResults: {
        songs: [],
        albums: [],
        artists: [],
        lyrics: []
    },
    showSearch: false,
    showSearchResults: false
})

export const mutations = {
    SET_SEARCH_QUERY(state, query) {
        state.searchQuery = query
    },
    SET_SEARCH_RESULTS(state, results) {
        state.searchResults = results
    },
    SET_SHOW_SEARCH(state, show) {
        state.showSearch = show
    },
    SET_SHOW_SEARCH_RESULTS(state, show) {
        state.showSearchResults = show
    }
}

export const actions = {
    async performSearch({ commit, state }) {
        const query = state.searchQuery.trim()
        if (query === '') return

        try {
            const results = await this.$axios.$get('/api/songs/search?query=' + query)
            commit('SET_SEARCH_RESULTS', results)
            commit('SET_SHOW_SEARCH_RESULTS', true)
        } catch (error) {
            console.error('검색 중 오류 발생:', error)
            // 에러 처리 로직 추가
        }
    },
    toggleSearch({ commit, state }) {
        commit('SET_SHOW_SEARCH', !state.showSearch)
    },
    closeSearchResults({ commit }) {
        commit('SET_SHOW_SEARCH_RESULTS', false)
    },
    updateSearchQuery({ commit }, query) {
        commit('SET_SEARCH_QUERY', query)
    }
}