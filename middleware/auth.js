export default function({ store, redirect, route }) {
    if (!store.state.auth.loggedIn && route.path !== '/login') return redirect('/login')

    if (store.state.auth.loggedIn && route.path === '/login') return redirect('/')
}