// store/index.js
import { titleUpdatePlugin  } from "./plugins/titleUpdate"
import { mediaSessionPlugin } from "./plugins/mediaSession"

export const actions = {
    nuxtServerInit({ commit }, { req }) {
        const user = req.session?.user
        if (user) {
            commit('auth/setUser', user)
        }
    }
}

export const plugins = [titleUpdatePlugin, mediaSessionPlugin]