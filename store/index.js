// store/index.js

export const actions = {
    nuxtServerInit({ commit }, { req }) {
        const user = req.session?.user
        if (user) {
            commit('auth/setUser', user)
        }
    }
}