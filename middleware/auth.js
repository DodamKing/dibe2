export default function ({ store, redirect, route }) {
    const publicPages = ['/login', '/register', '/subscription-notice']
    const user = store.state.auth.user

    const isPublicPage = publicPages.includes(route.path)
    const isLoggedIn = store.state.auth.loggedIn

    // subscription-notice 페이지는 로그인된 상태에서만 접근 가능
    if (route.path === '/subscription-notice' && !isLoggedIn) {
        return redirect('/login')
    }

    // 일반 공개 페이지는 로그인하면 접근 불가
    if (isLoggedIn && isPublicPage && route.path !== '/subscription-notice') {
        return redirect('/')
    }

    // 비공개 페이지는 로그인 필수
    if (!isLoggedIn && !isPublicPage) {
        return redirect('/login')
    }

    // 로그인된 경우에만 체크
    if (isLoggedIn && !isPublicPage) {  // 비공개 페이지 접근 시에만 체크하도록 수정
        // 관리자 페이지 접근 체크
        if (route.path.startsWith('/admin') && !user.isAdmin) {
            return redirect('/')
        }

        // 구독 상태 체크 (관리자는 제외)
        if (!user.isAdmin) {  // 관리자 체크를 먼저
            const expiryTimestamp = user.expiryDate ? new Date(user.expiryDate).getTime() : null
            if (!expiryTimestamp || expiryTimestamp < Date.now()) {
                return redirect('/subscription-notice')
            }
        }
    }
}