export const state = () => ({
    loggedIn: false,
    user: null
})

export const mutations = {
    setUser(state, user) {
        state.loggedIn = user !== null
        state.user = user
    },
}

export const actions = {
    async login({ commit, dispatch }, credentials) {
        try {
            const { user, code, message, token } = await this.$axios.$post('/api/users/login', credentials)

            if (code === 1) {
                localStorage.setItem('dibe2_token', token)
                this.$axios.setToken(token, 'Bearer')
                commit('setUser', user)
                return { success: true, message }
            }
            else if (code === 2) {
                return { success: false, message }
            }
            else return { success: false, message }

        } catch (err) {
            console.error('로그인 에러:', err)
            return { success: false, message: '서버 오류가 발생했습니다. 잠시 후 다시 시도해 주세요.' }
        }
    },

    async logout({ commit }) {
        try {
            await this.$axios.post('/api/users/logout')
        } catch (err) {
            console.error('로그아웃 에러:', err)
        } finally {
            localStorage.removeItem('dibe2_token')
            this.$axios.setToken(false)
            commit('setUser', null)
            // 좋아요는 사용자별 값이라 다음 로그인 사용자에게 남기지 않는다
            commit('likes/RESET', null, { root: true })
        }
    },

}
