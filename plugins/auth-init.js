function getCookie(name) {
  const match = document.cookie.match(new RegExp('(^| )' + name + '=([^;]+)'))
  return match ? decodeURIComponent(match[2]) : null
}

function deleteCookie(name) {
  document.cookie = name + '=; expires=Thu, 01 Jan 1970 00:00:00 GMT; path=/'
}

export default async function ({ store, $axios }) {
  if (!process.client) return

  // OAuth 콜백에서 쿠키로 전달된 토큰 수신
  const oauthToken = getCookie('dibe2_oauth_token')
  if (oauthToken) {
    localStorage.setItem('dibe2_token', oauthToken)
    deleteCookie('dibe2_oauth_token')
  }

  // OAuth 리다이렉트 후 URL 정리 (?state, ?code 등 제거)
  const params = new URLSearchParams(window.location.search)
  if (params.has('state') || params.has('code')) {
    window.history.replaceState({}, '', window.location.pathname)
  }

  // localStorage에서 토큰 복원
  const savedToken = localStorage.getItem('dibe2_token')
  if (savedToken) {
    $axios.setToken(savedToken, 'Bearer')
    try {
      const { user } = await $axios.$get('/api/users/me')
      if (user) {
        store.commit('auth/setUser', user)
      }
    } catch (err) {
      // 401 응답일 때만 토큰 삭제 (네트워크 에러, 타임아웃 등은 무시)
      if (err.response && err.response.status === 401) {
        localStorage.removeItem('dibe2_token')
        $axios.setToken(false)
      }
    }
  }
}
