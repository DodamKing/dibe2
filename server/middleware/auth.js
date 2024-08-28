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
        console.log('Session:', req.session);
        console.log('User ID:', req.session.userId);

        // 공개 경로 목록
        const publicPaths = ['/login', '/register', '/api/login', '/api/register', '/favicon.ico'];

        // API 경로 확인
        const isApiRequest = req.path.startsWith('/api/');

        if (!req.session || typeof req.session.userId === 'undefined') {
            if (publicPaths.includes(req.path) || req.path.startsWith('/public/')) {
                // 공개 경로는 통과
                return next();
            } else if (isApiRequest) {
                // API 요청의 경우 JSON 응답
                return res.status(401).json({ message: '인증이 필요합니다.' });
            } else {
                // 그 외의 경우 로그인 페이지로 리다이렉트
                return res.redirect('/login');
            }
        }

        // 세션이 있는 경우
        if (publicPaths.includes(req.path) && req.path !== '/logout') {
            // 이미 로그인한 사용자가 로그인/회원가입 페이지에 접근하는 경우
            return res.redirect('/');  // 홈페이지 또는 대시보드로 리다이렉트
        }

        next();
    }
}