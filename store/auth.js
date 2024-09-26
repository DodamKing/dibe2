export const state = () => ({
    loggedIn: false,
    user: null
})

export const mutations = {
    setUser(state, user) {
        state.loggedIn = user !== null
        state.user = user
    }
}

export const actions = {
    async login({ commit }, credentials) {
        try {
            const { user, code, message } = await this.$axios.$post('/api/users/login', credentials)

            if (code === 1) {
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
            commit('setUser', null)
        } catch (err) {
            console.error('로그아웃 에러:', err)
        }
    },

}