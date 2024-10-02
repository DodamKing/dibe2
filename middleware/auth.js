export default function({ store, redirect, route }) {
    const publicPages = ['/login', '/register'];
    const isPublicPage = publicPages.includes(route.path);
    const isLoggedIn = store.state.auth.loggedIn;
    const isAdmin = store.state.auth.user && store.state.auth.user.isAdmin

    if (!isLoggedIn && !isPublicPage) {
        return redirect('/login');
    }

    if (isLoggedIn && isPublicPage) {
        return redirect('/');
    }

    if (route.path.startsWith('/admin') && !isAdmin) return redirect('/')
}