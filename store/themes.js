// store/themes.js — 테마 플레이리스트(상황·분위기 추천) 목록. 홈 구역과 /theme 이 같이 쓴다.
// 목록은 하루 한 번 꼴로만 바뀌어서 한 번 받으면 이 세션 동안 다시 안 받는다. 상세(50곡)는 페이지가 직접 받는다.
// API·수집 구조: docs/THEME_PLAYLIST.md

export const state = () => ({
    list: [],
    loaded: false,
})

export const mutations = {
    SET_LIST(state, list) {
        state.list = list
        state.loaded = true
    },
}

export const actions = {
    async fetchList({ state, commit }) {
        if (state.loaded) return state.list
        try {
            const { themes } = await this.$axios.$get('/api/themes')
            commit('SET_LIST', themes || [])
        } catch (err) {
            console.error('테마 목록 실패:', err)
        }
        return state.list
    },
}
