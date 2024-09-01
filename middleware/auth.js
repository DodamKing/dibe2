export default function({ store, redirect, route }) {
    const publicPages = ['/login', '/register'];
    const isPublicPage = publicPages.includes(route.path);
    const isLoggedIn = store.state.auth.loggedIn;

    if (!isLoggedIn && !isPublicPage) {
        return redirect('/login');
    }

    if (isLoggedIn && isPublicPage) {
        return redirect('/');
    }
}