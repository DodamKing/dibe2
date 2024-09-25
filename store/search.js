export const state = () => ({
    searchQuery: '',
    searchResults: [],
    showSearch: false,
    showSearchResults: false,
    loading: false,
    error: null,
    currentPage: 1,
    hasMore: true,
    activeTab: 'title'
})

export const mutations = {
    SET_SEARCH_QUERY(state, query) {
        state.searchQuery = query
    },
    SET_SEARCH_RESULTS(state, { results, append }) {
        if (append) {
            state.searchResults = [...state.searchResults, ...results]
        } else {
            state.searchResults = results
        }
    },
    SET_SHOW_SEARCH(state, show) {
        state.showSearch = show
    },
    SET_SHOW_SEARCH_RESULTS(state, show) {
        state.showSearchResults = show
    },
    SET_LOADING(state, loading) {
        state.loading = loading
    },
    SET_ERROR(state, error) {
        state.error = error
    },
    INCREMENT_PAGE(state) {
        state.currentPage++
    },
    SET_HAS_MORE(state, hasMore) {
        state.hasMore = hasMore
    },
    RESET_SEARCH_STATE(state) {
        state.searchResults = []
        state.currentPage = 1
        state.hasMore = true
    },
    SET_ACTIVE_TAB(state, tab) {
        state.activeTab = tab
    }
}

export const actions = {
    async performSearch({ commit, dispatch, state }) {
        const query = state.searchQuery.trim()
        if (query === '') return

        commit('RESET_SEARCH_STATE')
        commit('SET_SHOW_SEARCH_RESULTS', true)

        await dispatch('fetchResults')
    },
    async fetchResults({ commit, state }) {
        if (!state.hasMore) return

        commit('SET_LOADING', true)
        commit('SET_ERROR', null)

        try {
            const response = await this.$axios.$get('/api/songs/search', {
                params: {
                    query: state.searchQuery,
                    type: state.activeTab,
                    page: state.currentPage,
                    limit: 20  // 또는 원하는 페이지 크기
                }
            })
            
            commit('SET_SEARCH_RESULTS', { 
                results: response.items, 
                append: state.currentPage > 1 
            })
            commit('SET_HAS_MORE', response.hasMore)
            commit('INCREMENT_PAGE')
        } catch (error) {
            console.error('검색 중 오류 발생:', error)
            commit('SET_ERROR', '검색 중 오류가 발생했습니다.')
        } finally {
            commit('SET_LOADING', false)
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
    },
    changeActiveTab({ commit, dispatch }, tab) {
        commit('SET_ACTIVE_TAB', tab)
        commit('RESET_SEARCH_STATE')
        dispatch('fetchResults')
    }
}