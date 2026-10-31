// store/likes.js
// 좋아요 상태를 한 곳에서 관리한다 — 차트 줄·좋아요 목록·하단 플레이어가 같은 값을 본다.
// 키는 Song._id. 차트 항목은 `_id`가 곡이 아니라 차트 항목 id라 **`songId`로 넣을 것**(docs/API_ENDPOINTS.md).
// 서버가 원본이고 여기는 화면용 캐시다. 누르면 먼저 바꿔 보여주고(낙관적) 실패하면 되돌린다.
import Vue from 'vue'

export const state = () => ({
    liked: {},        // songId → true/false. 키가 없으면 "모름"
    total: null,      // 좋아요한 곡 수(홈 카드용). null = 아직 모름
    pending: {},      // songId → true (요청 중 — 연타 방지)
})

export const getters = {
    isLiked: state => id => !!(id && state.liked[id]),
    isKnown: state => id => !!id && Object.prototype.hasOwnProperty.call(state.liked, id),
}

export const mutations = {
    SET(state, { id, liked }) {
        Vue.set(state.liked, id, liked)
    },
    SET_TOTAL(state, total) {
        state.total = total
    },
    ADD_TOTAL(state, delta) {
        if (state.total !== null) state.total = Math.max(0, state.total + delta)
    },
    SET_PENDING(state, { id, on }) {
        if (on) Vue.set(state.pending, id, true)
        else Vue.delete(state.pending, id)
    },
    RESET(state) {
        state.liked = {}
        state.total = null
        state.pending = {}
    },
}

export const actions = {
    // 응답에 실려 온 liked 를 반영. items 는 { id, liked } 배열
    seed({ commit }, items) {
        for (const { id, liked } of items) {
            if (id && typeof liked === 'boolean') commit('SET', { id, liked })
        }
    },

    // 모르는 곡만 서버에 물어본다(by-ids 가 liked 를 실어준다). 하단 플레이어의 현재 곡용
    async ensure({ state, dispatch }, ids) {
        const unknown = ids.filter(id => id && !Object.prototype.hasOwnProperty.call(state.liked, id))
        if (!unknown.length) return
        try {
            const { songs } = await this.$axios.$post('/api/songs/by-ids', { ids: unknown })
            dispatch('seed', (songs || []).map(s => ({ id: s._id, liked: !!s.liked })))
        } catch (err) {
            // 모르면 빈 하트로 둔다
        }
    },

    async fetchTotal({ commit }) {
        try {
            const { total } = await this.$axios.$get('/api/songs/liked?limit=1')
            commit('SET_TOTAL', total)
        } catch (err) {
            // 카드에 숫자만 안 뜬다
        }
    },

    async toggle({ state, commit }, id) {
        if (!id || state.pending[id]) return
        const next = !state.liked[id]
        commit('SET', { id, liked: next })
        commit('ADD_TOTAL', next ? 1 : -1)
        commit('SET_PENDING', { id, on: true })
        try {
            if (next) await this.$axios.$post(`/api/songs/${id}/like`)
            else await this.$axios.$delete(`/api/songs/${id}/like`)
        } catch (err) {
            commit('SET', { id, liked: !next })
            commit('ADD_TOTAL', next ? -1 : 1)
            commit('player/SET_NOTICE', '좋아요를 저장하지 못했어요. 다시 시도해 주세요.', { root: true })
        } finally {
            commit('SET_PENDING', { id, on: false })
        }
    },
}
