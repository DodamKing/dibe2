export default function (req, res, next) {
    const allowedOrigins = [
        'https://www.youtube.com',
        'https://www.youtube-nocookie.com',
        'https://dibe2.dimad.site',
        'http://localhost:3000'
    ];

    const origin = req.headers.origin;

    if (allowedOrigins.includes(origin)) {
        res.setHeader('Access-Control-Allow-Origin', origin);
        res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
        res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
        res.setHeader('Access-Control-Allow-Credentials', 'true');
    } else {
        // 허용되지 않은 origin인 경우, 기본 origin 설정
        res.setHeader('Access-Control-Allow-Origin', process.env.NODE_ENV === 'production' ? 'https://dibe2.dimad.site' : 'http://localhost:3000');
    }

    // preflight request 처리
    if (req.method === 'OPTIONS') {
        res.writeHead(204);
        res.end();
        return;
    }

    next();
}