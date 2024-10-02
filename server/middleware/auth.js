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
        // 공개 경로 목록
        const publicPaths = ['/users/login', '/users/register', '/users/google', '/users/google/callback', '/users/kakao', '/users/kakao/callback'];

        if (!req.session || typeof req.session.user === 'undefined') {
            if (publicPaths.includes(req.path) || req.path.startsWith('/public/')) {
                // 공개 경로는 통과
                return next();
            } else {
                // 그 외의 경우 로그인 페이지로 리다이렉트
                return res.status(401).json({ message: '사용자 인증이 필요합니다.'})
            }
        }

        // 세션이 있는 경우
        if (publicPaths.includes(req.path) && req.path !== '/logout') {
            return res.json()
        }

        next();
    },

    adminMiddleware: (req, res, next) => {
        if (req.session.user && req.session.user.isAdmin) next()
        else res.status(403).json({ message: '관리자 권한이 필요합니다.'})
    }
}