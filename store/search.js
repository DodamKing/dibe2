import { addRecent } from '~/utils/recentSearches'

// 검색(2026-11-08 개편 — docs/SEARCH.md). 기본 탭은 '전체'(제목·가수·앨범). fuzzy = 정확히 맞는 게 없어 오타로 찾은 결과
export const state = () => ({
    searchQuery: '',
    searchResults: [],
    showSearch: false,
    showSearchResults: false,
    loading: false,
    error: null,
    currentPage: 1,
    hasMore: true,
    activeTab: 'all',
    fuzzy: false,
    total: 0,
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
    },
    SET_META(state, { fuzzy, total }) {
        state.fuzzy = !!fuzzy
        state.total = total || 0
    },
}

export const actions = {
    async performSearch({ commit, dispatch, state }) {
        const query = state.searchQuery.trim()
        if (query === '') return

        commit('RESET_SEARCH_STATE')
        commit('SET_SHOW_SEARCH_RESULTS', true)
        addRecent('music', query)

        await dispatch('fetchResults')
    },
    // 자동완성·가수 칩에서 가수 고르기 → 가수 탭으로 그 이름 검색
    async searchArtist({ commit, dispatch }, name) {
        commit('SET_SEARCH_QUERY', name)
        commit('SET_ACTIVE_TAB', 'artist')
        await dispatch('performSearch')
    },
    // 헤더·모바일 검색창에서 새로 검색 → 탭은 '전체'로
    async searchAll({ commit, dispatch }, query) {
        commit('SET_SEARCH_QUERY', query)
        commit('SET_ACTIVE_TAB', 'all')
        await dispatch('performSearch')
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
            if (state.currentPage === 1) commit('SET_META', response)
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