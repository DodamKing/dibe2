module.exports = {
    isAuthenticated: (req, res, next) => {
        if (req.session.userId) next()
        else res.status(401).json({ message: '인증이 필요합니다.' })
    },

    isNotAuthenticated: (req, res, next) => {
        if (!req.session.userId) next()
        else res.status(403).json({ message: '이미 로그인되어 있습니다.' })
    },

    sessionCheckMiddleware: (req, res, next) => {
        // 공개 경로 목록 (이것만 허용)
        const publicPaths = ['/users/login', '/users/register', '/users/google', '/users/google/callback', '/users/kakao', '/users/kakao/callback'];

        // 세션이 없는 경우
        if (!req.session?.user) {
            // 공개 경로만 허용
            if (publicPaths.includes(req.path)) {
                return next();
            }
            // 그 외에는 모두 차단
            return res.status(401).json({ message: '사용자 인증이 필요합니다.' });
        }

        // 여기서부터는 세션이 있는 경우의 처리

        // 이미 로그인된 사용자가 로그인/회원가입 등 공개 경로 접근 시
        if (publicPaths.includes(req.path)) {
            return res.redirect('/'); // 또는 다른 적절한 페이지로 리다이렉트
        }

        // 관리자가 아닌 경우 구독 기간 체크
        if (!req.session.user.isAdmin) {
            const expiryDate = req.session.user.expiryDate ? new Date(req.session.user.expiryDate) : null;
            const isExpired = !expiryDate || expiryDate < new Date();

            // 만료된 경우, 로그아웃 요청만 허용
            if (isExpired && req.path !== '/users/logout') {
                return res.status(403).json({
                    message: '사용 기간이 만료되었습니다.',
                    requireSubscription: true
                });
            }
        }

        next();
    },

    adminMiddleware: (req, res, next) => {
        if (req.session.user && req.session.user.isAdmin) next()
        else res.status(403).json({ message: '관리자 권한이 필요합니다.'})
    }
}