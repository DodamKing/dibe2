export default function ({ $axios, redirect }) {
    $axios.onError((error) => {
        if (error.response && error.response.status === 401) {
            localStorage.removeItem('dibe2_token')
            $axios.setToken(false)
            return redirect('/login')
        }
    })
}
